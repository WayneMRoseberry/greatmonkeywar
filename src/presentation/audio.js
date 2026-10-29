// The audio player (sound PRD reqs 8-13, 15, 17-18, 20-22, 25): decides what
// music and sounds should play, from the game flow's state (flow.js) and the
// sound events of each frame, and asks a backend to play them.
//
// The backend (src/presentation/web-audio.js, or a fake in tests) has:
//   playMusic(path, { loop }) starts `path` from its beginning, replacing any
//                             music playing; returns false if it can't play it
//   stopMusic()               stops the music
//   playSound(path)           plays `path` once, over everything else; returns
//                             false if it can't play it
//   setMuted(muted)           silences everything, or not; music keeps going
//   isLocked()                true while the browser won't play sound yet
//   unlock()                  lets sound play (after a key press or click)

import { Screen } from '../simulation/flow.js';

/** Whether sound can be heard, for the debug overlay and the test hook (req 26). */
export const SoundState = Object.freeze({
  ON: 'on',
  MUTED: 'muted',     // by the mute key
  LOCKED: 'locked',   // browser mode, before the first key press or click
});

/**
 * The music the game should have on its current screen, as { path, loop },
 * or null for silence: the start screen's from audio.json, a level's or cut
 * scene's from its own file. A completed level with a completeJingle has the
 * jingle, played once; without one, its music carries on (req 10).
 */
function wantedMusic(data, game) {
  const loop = (path) => (path === undefined ? null : { path, loop: true });
  switch (game.screen) {
    case Screen.START: return loop(data.audio.startMusic);
    case Screen.PLAYING: return loop(data.levels[game.level.levelName].music);
    case Screen.LEVEL_COMPLETE: {
      const { music, completeJingle } = data.levels[game.level.levelName];
      return completeJingle === undefined ? loop(music) : { path: completeJingle, loop: false };
    }
    case Screen.CUTSCENE: return loop(data.cutscenes[game.cutscene.name].music);
    default: return null;
  }
}

/**
 * The audio player for validated game `data`, playing through `backend`;
 * `log(message)` is for warnings. update(game, events) is called once per
 * frame. currentMusic() is the music file playing, or null. toggleMute()
 * and isMuted() are the mute key's. While the backend is locked nothing
 * plays; unlock() and isLocked() are for the first key press or click.
 */
export function createAudioPlayer({ data, backend, log }) {
  const warned = new Set();   // files already reported as unplayable

  /** Reports a file the backend couldn't play, once (req 25); the game carries on without it. */
  function check(played, path) {
    if (played || warned.has(path)) return;
    warned.add(path);
    log(`Couldn't play the sound file data/${path}, so it will be silent. Check that it is a working Ogg Vorbis or Opus file.`);
  }

  let music = null;   // { path, loop } playing now, or null
  let scene = null;   // while a cut scene shows: { name, next }, next being the index of its next timed sound
  let muted = false;  // the game always starts with sound on (req 20)
  let locked = backend.isLocked();   // browser mode, until the first key press or click (req 21)
  let lastGame = null;               // the game as of the latest update, for unlock()

  /**
   * Plays a sound effect or cut scene sound. While muted or locked it is
   * skipped, not saved for later (reqs 18, 21); the music, though, keeps
   * playing silently while muted.
   */
  function playSound(path) {
    if (!muted && !locked) check(backend.playSound(path), path);
  }

  /**
   * Cuts straight to `wanted`; the same file already playing carries on (req 9).
   * Music that can't be played still counts as playing, so it isn't retried every frame.
   */
  function changeMusic(wanted) {
    if (wanted?.path === music?.path) return;
    if (wanted) check(backend.playMusic(wanted.path, { loop: wanted.loop }), wanted.path);
    else backend.stopMusic();
    music = wanted;
  }

  /**
   * A cut scene's timed sounds (req 12): each plays once, on the first frame
   * its time has been reached. Leaving the cut scene (it ended or was skipped)
   * forgets it, so sounds not reached never play, and seeing it again starts over.
   */
  function playCutsceneSounds(game) {
    if (game.screen !== Screen.CUTSCENE) {
      scene = null;
      return;
    }
    const { name, time } = game.cutscene;
    if (scene?.name !== name) scene = { name, next: 0 };
    const sounds = data.cutscenes[name].sounds ?? [];
    while (scene.next < sounds.length && sounds[scene.next].time <= time) {
      playSound(sounds[scene.next].sound);
      scene.next += 1;
    }
  }

  /** Each event's sound from audio.json, once per frame however often the event happened (reqs 13, 15). */
  function playEventSounds(events) {
    const sounds = data.audio.sounds ?? {};
    for (const event of new Set(events)) {
      if (event in sounds) playSound(sounds[event]);
    }
  }

  return {
    update(game, events) {
      lastGame = game;
      if (!locked) changeMusic(wantedMusic(data, game));
      playCutsceneSounds(game);
      playEventSounds(events);
    },
    /**
     * Lets sound play, after the first key press or click in browser mode: the
     * current screen's music starts from its beginning (req 21). Does nothing
     * if sound isn't locked.
     */
    unlock() {
      if (!locked) return;
      backend.unlock();
      locked = false;
      if (lastGame) changeMusic(wantedMusic(data, lastGame));
    },
    isLocked: () => locked,
    currentMusic: () => music?.path ?? null,
    /** Turns all sound off, or back on (req 17). */
    toggleMute() {
      muted = !muted;
      backend.setMuted(muted);
    },
    isMuted: () => muted,
    /** SoundState: locked shows first, since nothing can be heard until then even if unmuted. */
    soundState: () => (locked ? SoundState.LOCKED : muted ? SoundState.MUTED : SoundState.ON),
  };
}
