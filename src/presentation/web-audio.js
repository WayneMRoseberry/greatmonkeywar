// The audio backend that really plays sound, with the Web Audio API (sound
// PRD reqs 8-13, 17-18, 21-22). It has the operations the audio player
// (audio.js) needs. The AudioContext is passed in, so tests use a fake;
// only main.js makes a real one.

/**
 * Resolves to the backend, once every file in `sounds` ({ path: ArrayBuffer },
 * from the loader) has been decoded. A file that fails to decode is left out:
 * playing it returns false, and the audio player reports it.
 */
export async function createWebAudioBackend({ context, sounds }) {
  // Everything plays through one gain node, so mute is a single volume change.
  const master = context.createGain();
  master.connect(context.destination);

  const buffers = new Map();
  await Promise.all(Object.entries(sounds).map(async ([path, bytes]) => {
    try {
      buffers.set(path, await context.decodeAudioData(bytes));
    } catch {
      // Not decodable: left out, so playing it returns false.
    }
  }));

  /** Starts `buffer` from its beginning through the master gain. */
  function start(buffer, loop) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(master);
    source.start();
    return source;
  }

  let music = null;   // the buffer source playing the music, or null

  return {
    playMusic(path, { loop }) {
      this.stopMusic();
      const buffer = buffers.get(path);
      if (!buffer) return false;
      music = start(buffer, loop);
      return true;
    },
    stopMusic() {
      if (!music) return;
      music.stop();
      music.disconnect();
      music = null;
    },
    /** A new source each time, so sound effects overlap each other and the music. */
    playSound(path) {
      const buffer = buffers.get(path);
      if (!buffer) return false;
      const source = start(buffer, false);
      source.onended = () => source.disconnect();
      return true;
    },
    setMuted(muted) {
      master.gain.value = muted ? 0 : 1;
    },
    /** A browser keeps a new AudioContext suspended until the player presses a key or clicks. */
    isLocked: () => context.state === 'suspended',
    unlock() {
      context.resume();
    },
  };
}
