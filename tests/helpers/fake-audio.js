// A recording fake audio backend for tests of the audio player (sound task 3.1).
//
// createFakeAudioBackend({ locked, failing }) stands in for the Web Audio
// backend (src/presentation/web-audio.js): it has the same operations, and
// records each call in `calls` as { op, args }, in order. isLocked() answers
// without being recorded. It starts unlocked unless `locked` is true, and
// unlock() unlocks it. playMusic and playSound return true, or false for a
// path listed in `failing` (a sound that can't be played).

export function createFakeAudioBackend({ locked = false, failing = [] } = {}) {
  const calls = [];
  let isLocked = locked;
  const record = (op, args) => calls.push({ op, args });

  return {
    calls,
    /** The recorded calls of one kind. */
    callsOf: (op) => calls.filter((call) => call.op === op),
    playMusic(path, options) {
      record('playMusic', [path, options]);
      return !failing.includes(path);
    },
    stopMusic() { record('stopMusic', []); },
    playSound(path) {
      record('playSound', [path]);
      return !failing.includes(path);
    },
    setMuted(muted) { record('setMuted', [muted]); },
    isLocked: () => isLocked,
    unlock() {
      record('unlock', []);
      isLocked = false;
    },
  };
}
