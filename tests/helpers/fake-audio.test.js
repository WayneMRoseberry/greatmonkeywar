// Tests for the recording fake audio backend (sound task 3.1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeAudioBackend } from './fake-audio.js';

const MUSIC = 'audio/music/start.ogg';
const SOUND = 'audio/sounds/jump.ogg';

test('records every call in order, with its arguments', () => {
  const backend = createFakeAudioBackend();
  backend.playMusic(MUSIC, { loop: true });
  backend.playSound(SOUND);
  backend.setMuted(true);
  backend.stopMusic();
  backend.unlock();
  assert.deepEqual(backend.calls, [
    { op: 'playMusic', args: [MUSIC, { loop: true }] },
    { op: 'playSound', args: [SOUND] },
    { op: 'setMuted', args: [true] },
    { op: 'stopMusic', args: [] },
    { op: 'unlock', args: [] },
  ]);
});

test('callsOf gives the calls of one kind', () => {
  const backend = createFakeAudioBackend();
  backend.playSound(SOUND);
  backend.stopMusic();
  backend.playSound(MUSIC);
  assert.deepEqual(backend.callsOf('playSound').map((call) => call.args[0]), [SOUND, MUSIC]);
});

test('starts unlocked unless told otherwise; unlock() unlocks it', () => {
  assert.equal(createFakeAudioBackend().isLocked(), false);
  const locked = createFakeAudioBackend({ locked: true });
  assert.equal(locked.isLocked(), true);
  locked.unlock();
  assert.equal(locked.isLocked(), false);
});

test('playing reports success, except for the paths it is told fail', () => {
  const backend = createFakeAudioBackend({ failing: [SOUND] });
  assert.equal(backend.playMusic(MUSIC, { loop: true }), true);
  assert.equal(backend.playSound(SOUND), false);
  assert.equal(backend.playMusic(SOUND, { loop: false }), false);
});

test('isLocked is a question, not recorded as a call', () => {
  const backend = createFakeAudioBackend();
  backend.isLocked();
  assert.deepEqual(backend.calls, []);
});
