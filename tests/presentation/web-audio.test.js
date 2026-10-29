// Tests for the Web Audio backend (sound task 4.2), with a fake AudioContext
// that records the nodes made and how they are connected.
//
// Decided:
//  - every sound file is decoded once, when the backend is created, which
//    resolves when decoding has finished; a file that fails to decode, or a
//    path that wasn't loaded, plays nothing and makes play calls return false
//    (the audio player logs it, once);
//  - everything plays through one master gain node, which mute sets to 0;
//  - music is one looping (or, for a jingle, not looping) buffer source,
//    stopped when other music starts; each sound effect gets its own source,
//    so they overlap;
//  - locked means the context is suspended (a browser before the first key
//    press or click); unlock() resumes it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWebAudioBackend } from '../../src/presentation/web-audio.js';

const MUSIC = 'audio/music/start.ogg';
const OTHER_MUSIC = 'audio/music/level.ogg';
const SOUND = 'audio/sounds/jump.ogg';
const BROKEN = 'audio/sounds/broken.ogg';
const NOT_LOADED = 'audio/sounds/missing.ogg';

/** A fake AudioContext. decodeAudioData fails for the bytes `badBytes`, else gives { decodedFrom: bytes }. */
function fakeContext({ state = 'running', badBytes } = {}) {
  const connectable = (node) => Object.assign(node, {
    to: null,
    connect(target) { this.to = target; },
    disconnect() { this.to = null; },
  });
  const context = {
    state,
    destination: { name: 'destination' },
    sources: [],
    gains: [],
    decoded: [],
    resumes: 0,
    createGain() {
      const gain = connectable({ gain: { value: 1 } });
      context.gains.push(gain);
      return gain;
    },
    createBufferSource() {
      const source = connectable({
        buffer: null, loop: false, started: false, stopped: false,
        start() { this.started = true; },
        stop() { this.stopped = true; },
      });
      context.sources.push(source);
      return source;
    },
    decodeAudioData(bytes) {
      context.decoded.push(bytes);
      return bytes === badBytes ? Promise.reject(new Error('not audio')) : Promise.resolve({ decodedFrom: bytes });
    },
    resume() {
      context.resumes += 1;
      context.state = 'running';
      return Promise.resolve();
    },
  };
  return context;
}

/** Loaded sound files' bytes (stand-ins for ArrayBuffers). */
const BYTES = { [MUSIC]: { file: MUSIC }, [OTHER_MUSIC]: { file: OTHER_MUSIC }, [SOUND]: { file: SOUND }, [BROKEN]: { file: BROKEN } };

async function setUp(contextOptions = {}) {
  const context = fakeContext({ badBytes: BYTES[BROKEN], ...contextOptions });
  const backend = await createWebAudioBackend({ context, sounds: BYTES });
  const [master] = context.gains;
  return { context, backend, master };
}

describe('creating it', () => {
  test('decodes every loaded sound file once', async () => {
    const { context } = await setUp();
    assert.deepEqual(context.decoded, Object.values(BYTES));
  });

  test('one master gain node, connected to the speakers, at full volume', async () => {
    const { context, master } = await setUp();
    assert.equal(context.gains.length, 1);
    assert.equal(master.to, context.destination);
    assert.equal(master.gain.value, 1);
  });

  test('a file that fails to decode doesn\'t stop the rest', async () => {
    const { backend } = await setUp();
    assert.equal(backend.playSound(SOUND), true);
  });
});

describe('music', () => {
  test('playMusic starts the decoded file through the master gain, looping as asked', async () => {
    const { context, backend, master } = await setUp();
    assert.equal(backend.playMusic(MUSIC, { loop: true }), true);
    const [source] = context.sources;
    assert.deepEqual(source.buffer, { decodedFrom: BYTES[MUSIC] });
    assert.equal(source.loop, true);
    assert.equal(source.to, master);
    assert.equal(source.started, true);
  });

  test('a jingle doesn\'t loop', async () => {
    const { context, backend } = await setUp();
    backend.playMusic(MUSIC, { loop: false });
    assert.equal(context.sources[0].loop, false);
  });

  test('new music stops and disconnects the music playing', async () => {
    const { context, backend } = await setUp();
    backend.playMusic(MUSIC, { loop: true });
    backend.playMusic(OTHER_MUSIC, { loop: true });
    const [first, second] = context.sources;
    assert.equal(first.stopped, true);
    assert.equal(first.to, null);
    assert.equal(second.started, true);
    assert.equal(second.stopped, false);
  });

  test('stopMusic stops it; with no music playing it does nothing', async () => {
    const { context, backend } = await setUp();
    backend.stopMusic();
    backend.playMusic(MUSIC, { loop: true });
    backend.stopMusic();
    backend.stopMusic();
    assert.equal(context.sources[0].stopped, true);
  });

  test('a file that failed to decode, or wasn\'t loaded: returns false and plays nothing (the music playing stops)', async () => {
    const { context, backend } = await setUp();
    backend.playMusic(MUSIC, { loop: true });
    assert.equal(backend.playMusic(BROKEN, { loop: true }), false);
    assert.equal(backend.playMusic(NOT_LOADED, { loop: true }), false);
    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0].stopped, true);
  });
});

describe('sound effects', () => {
  test('each plays once through the master gain, in its own source, so they overlap', async () => {
    const { context, backend, master } = await setUp();
    assert.equal(backend.playSound(SOUND), true);
    backend.playSound(SOUND);
    assert.equal(context.sources.length, 2);
    for (const source of context.sources) {
      assert.deepEqual(source.buffer, { decodedFrom: BYTES[SOUND] });
      assert.equal(source.loop, false);
      assert.equal(source.to, master);
      assert.equal(source.started, true);
      assert.equal(source.stopped, false);
    }
  });

  test('a sound effect doesn\'t stop the music', async () => {
    const { context, backend } = await setUp();
    backend.playMusic(MUSIC, { loop: true });
    backend.playSound(SOUND);
    assert.equal(context.sources[0].stopped, false);
  });

  test('a file that failed to decode, or wasn\'t loaded: returns false and plays nothing', async () => {
    const { context, backend } = await setUp();
    assert.equal(backend.playSound(BROKEN), false);
    assert.equal(backend.playSound(NOT_LOADED), false);
    assert.equal(context.sources.length, 0);
  });
});

describe('mute and the lock', () => {
  test('setMuted turns the master gain to 0 and back to 1, leaving the music playing', async () => {
    const { context, backend, master } = await setUp();
    backend.playMusic(MUSIC, { loop: true });
    backend.setMuted(true);
    assert.equal(master.gain.value, 0);
    backend.setMuted(false);
    assert.equal(master.gain.value, 1);
    assert.equal(context.sources[0].stopped, false);
  });

  test('locked while the context is suspended; unlock() resumes it', async () => {
    const { context, backend } = await setUp({ state: 'suspended' });
    assert.equal(backend.isLocked(), true);
    backend.unlock();
    assert.equal(context.resumes, 1);
    assert.equal(backend.isLocked(), false);
  });

  test('a running context (Electron) isn\'t locked', async () => {
    const { backend } = await setUp({ state: 'running' });
    assert.equal(backend.isLocked(), false);
  });
});
