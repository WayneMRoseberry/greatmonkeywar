// Tests for the audio player (sound tasks 3.2-3.8; sound PRD reqs 8-13, 15,
// 17-18, 20-22, 25), with the recording fake audio backend.
//
// createAudioPlayer({ data, backend, log }) decides what should be playing;
// update(game, events) is called once per frame with the game flow's state
// (flow.js) and the sound events of the frame's steps.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioPlayer, SoundState } from '../../src/presentation/audio.js';
import { createFakeAudioBackend } from '../helpers/fake-audio.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { createGame, stepGame, Screen } from '../../src/simulation/flow.js';
import { Input, holding } from '../../src/simulation/input.js';
import { FIXED_DT, SoundEvent } from '../../src/simulation/constants.js';

const START_MUSIC = 'audio/music/start.ogg';
const LEVEL_MUSIC = 'audio/music/level.ogg';
const SECOND_MUSIC = 'audio/music/second.ogg';
const CUTSCENE_MUSIC = 'audio/music/scene.ogg';
const SECOND_LEVEL = 'second';
const CUTSCENE = 'between';
const LOOP = { loop: true };

/**
 * Game data with TEST_LEVEL, then a cut scene, then SECOND_LEVEL. `audio`,
 * `level`, `second`, and `cutscene` are fields merged into audio.json, the
 * first level, the second level, and the cut scene.
 */
function gameData({ audio = { startMusic: START_MUSIC }, level = { music: LEVEL_MUSIC }, second = { music: SECOND_MUSIC }, cutscene = { music: CUTSCENE_MUSIC } } = {}) {
  const data = buildData(['P.G', '###'], { audio, level: { cutscene: CUTSCENE, ...level } });
  const first = data.levels[TEST_LEVEL];
  data.levels[SECOND_LEVEL] = { ...first, name: 'Second', cutscene: undefined, music: undefined, completeJingle: undefined, ...second };
  data.levelList.levels.push(SECOND_LEVEL);
  data.cutscenes[CUTSCENE] = {
    formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/c.png', backgroundColor: '#000000',
    actors: [], narration: [], ...cutscene,
  };
  return data;
}

/** A player and fake backend for `data`, plus the start screen's game. */
function setUp(data = gameData(), backendOptions = {}) {
  const backend = createFakeAudioBackend(backendOptions);
  const logs = [];
  const player = createAudioPlayer({ data, backend, log: (message) => logs.push(message) });
  return { data, backend, logs, player, game: createGame(data) };
}

/** The game on each screen, from the start screen's `game`. */
const playing = (game) => stepGame(game, holding(Input.CONFIRM), FIXED_DT);
const onScreen = (game, screen, more = {}) => ({ ...game, screen, ...more });
const inCutscene = (game, time = 0) => onScreen(playing(game), Screen.CUTSCENE, { cutscene: { name: CUTSCENE, time } });
const onSecondLevel = (game) => ({ ...playing(game), levelIndex: 1, level: { ...playing(game).level, levelName: SECOND_LEVEL } });

/** The music calls (playMusic and stopMusic), as [op, ...args]. */
const musicCalls = (backend) => backend.calls
  .filter((call) => call.op === 'playMusic' || call.op === 'stopMusic')
  .map((call) => [call.op, ...call.args]);

describe('music by screen (reqs 8-9, 11)', () => {
  test('the start screen plays startMusic, looping', () => {
    const { player, backend, game } = setUp();
    player.update(game, []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP]]);
  });

  test('the same screen next frame changes nothing', () => {
    const { player, backend, game } = setUp();
    player.update(game, []);
    player.update(game, []);
    assert.equal(musicCalls(backend).length, 1);
  });

  test('playing a level: the level\'s music, cutting straight from the start music', () => {
    const { player, backend, game } = setUp();
    player.update(game, []);
    player.update(playing(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP], ['playMusic', LEVEL_MUSIC, LOOP]]);
  });

  test('a cut scene: its music', () => {
    const { player, backend, game } = setUp();
    player.update(inCutscene(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', CUTSCENE_MUSIC, LOOP]]);
  });

  test('a screen with no music named: the music stops', () => {
    const { player, backend, game } = setUp(gameData({ level: {} }));
    player.update(game, []);
    player.update(playing(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP], ['stopMusic']]);
  });

  test('nothing named and nothing playing: no calls at all', () => {
    const { player, backend, game } = setUp(gameData({ audio: {} }));
    player.update(game, []);
    assert.deepEqual(backend.calls, []);
  });

  test('the next screen naming the same file: it keeps playing, not restarted', () => {
    const { player, backend, game } = setUp(gameData({ level: { music: START_MUSIC } }));
    player.update(game, []);
    player.update(playing(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP]]);
  });

  test('the next level\'s own music after the first level\'s', () => {
    const { player, backend, game } = setUp();
    player.update(playing(game), []);
    player.update(onSecondLevel(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', LEVEL_MUSIC, LOOP], ['playMusic', SECOND_MUSIC, LOOP]]);
  });

  test('the game finishing: the music stops', () => {
    const { player, backend, game } = setUp();
    player.update(game, []);
    player.update(onScreen(game, Screen.FINISHED), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP], ['stopMusic']]);
  });

  test('currentMusic() is the file playing, or null', () => {
    const { player, game } = setUp();
    assert.equal(player.currentMusic(), null);
    player.update(game, []);
    assert.equal(player.currentMusic(), START_MUSIC);
    player.update(onScreen(game, Screen.FINISHED), []);
    assert.equal(player.currentMusic(), null);
  });
});

describe('level complete and restart (reqs 10-11)', () => {
  const JINGLE = 'audio/music/jingle.ogg';
  const complete = (game) => onScreen(playing(game), Screen.LEVEL_COMPLETE);

  test('with a completeJingle: the level music stops and the jingle plays once, not looping, and isn\'t repeated', () => {
    const { player, backend, game } = setUp(gameData({ level: { music: LEVEL_MUSIC, completeJingle: JINGLE } }));
    player.update(playing(game), []);
    player.update(complete(game), []);
    player.update(complete(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', LEVEL_MUSIC, LOOP], ['playMusic', JINGLE, { loop: false }]]);
  });

  test('without one: the level music keeps playing under the panel', () => {
    const { player, backend, game } = setUp();
    player.update(playing(game), []);
    player.update(complete(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', LEVEL_MUSIC, LOOP]]);
  });

  test('after the jingle, the next level\'s music starts', () => {
    const { player, backend, game } = setUp(gameData({ level: { music: LEVEL_MUSIC, completeJingle: JINGLE } }));
    player.update(complete(game), []);
    player.update(onSecondLevel(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', JINGLE, { loop: false }], ['playMusic', SECOND_MUSIC, LOOP]]);
  });

  test('a level restart (health reached 0) doesn\'t restart the music', () => {
    const { player, backend, game } = setUp();
    const level = playing(game);
    player.update(level, []);
    const restarted = { ...level, level: { ...level.level, player: level.level.levelStart.player.copy() } };
    player.update(restarted, []);
    assert.deepEqual(musicCalls(backend), [['playMusic', LEVEL_MUSIC, LOOP]]);
  });
});

describe('cut scene sounds (reqs 11-12)', () => {
  const CRASH = 'audio/sounds/crash.ogg';
  const SHOUT = 'audio/sounds/shout.ogg';
  const THUD = 'audio/sounds/thud.ogg';
  const BANG = 'audio/sounds/bang.ogg';
  const SOUNDS = [{ time: 0, sound: CRASH }, { time: 1, sound: SHOUT }, { time: 1, sound: THUD }, { time: 3, sound: BANG }];
  const withSounds = () => setUp(gameData({ cutscene: { music: CUTSCENE_MUSIC, sounds: SOUNDS } }));
  const played = (backend) => backend.callsOf('playSound').map((call) => call.args[0]);

  test('each plays once, on the first frame the cut scene\'s time has reached it; sounds at the same time play together', () => {
    const { player, backend, game } = withSounds();
    const frames = [0, 0.5, 1.5, 2, 3, 4];
    const playedBy = frames.map((time) => {
      player.update(inCutscene(game, time), []);
      return played(backend).length;
    });
    assert.deepEqual(played(backend), [CRASH, SHOUT, THUD, BANG]);
    assert.deepEqual(playedBy, [1, 1, 3, 3, 4, 4]);
  });

  test('a cut scene that ends or is skipped: the sounds not reached yet never play', () => {
    const { player, backend, game } = withSounds();
    player.update(inCutscene(game, 1.5), []);
    player.update(onSecondLevel(game), []);
    player.update(onSecondLevel(game), []);
    assert.deepEqual(played(backend), [CRASH, SHOUT, THUD]);
  });

  test('seeing the cut scene again starts its sounds from the beginning', () => {
    const { player, backend, game } = withSounds();
    player.update(inCutscene(game, 0), []);
    player.update(onSecondLevel(game), []);
    player.update(inCutscene(game, 0), []);
    assert.deepEqual(played(backend), [CRASH, CRASH]);
  });

  test('a cut scene without sounds plays none', () => {
    const { player, backend, game } = setUp();
    player.update(inCutscene(game, 10), []);
    assert.deepEqual(played(backend), []);
  });
});

describe('sound effects (reqs 13-15)', () => {
  const JUMP_SOUND = 'audio/sounds/jump.ogg';
  const REWARD_SOUND = 'audio/sounds/reward.ogg';
  const SOUNDS = { [SoundEvent.JUMP]: JUMP_SOUND, [SoundEvent.COLLECT_REWARD]: REWARD_SOUND };
  const withSounds = () => setUp(gameData({ audio: { sounds: SOUNDS } }));
  const played = (backend) => backend.callsOf('playSound').map((call) => call.args[0]);

  test('an event with a sound in audio.json plays it', () => {
    const { player, backend, game } = withSounds();
    player.update(playing(game), [SoundEvent.JUMP]);
    assert.deepEqual(played(backend), [JUMP_SOUND]);
  });

  test('an event with no sound named is silent', () => {
    const { player, backend, game } = withSounds();
    player.update(playing(game), [SoundEvent.LAND]);
    assert.deepEqual(played(backend), []);
  });

  test('the same event several times in one frame plays once; different events all play, in order', () => {
    const { player, backend, game } = withSounds();
    player.update(playing(game), [SoundEvent.COLLECT_REWARD, SoundEvent.JUMP, SoundEvent.COLLECT_REWARD]);
    assert.deepEqual(played(backend), [REWARD_SOUND, JUMP_SOUND]);
  });

  test('the same event in the next frame plays again', () => {
    const { player, backend, game } = withSounds();
    player.update(playing(game), [SoundEvent.JUMP]);
    player.update(playing(game), [SoundEvent.JUMP]);
    assert.deepEqual(played(backend), [JUMP_SOUND, JUMP_SOUND]);
  });
});

describe('mute (reqs 17-18, 20)', () => {
  const JUMP_SOUND = 'audio/sounds/jump.ogg';
  const CRASH = 'audio/sounds/crash.ogg';
  const data = () => gameData({
    audio: { startMusic: START_MUSIC, sounds: { [SoundEvent.JUMP]: JUMP_SOUND } },
    cutscene: { music: CUTSCENE_MUSIC, sounds: [{ time: 1, sound: CRASH }] },
  });
  const played = (backend) => backend.callsOf('playSound').map((call) => call.args[0]);

  test('starts with sound on', () => {
    const { player, backend } = setUp(data());
    assert.equal(player.isMuted(), false);
    assert.deepEqual(backend.callsOf('setMuted'), []);
  });

  test('toggleMute turns all sound off, then on again, through the backend', () => {
    const { player, backend } = setUp(data());
    player.toggleMute();
    assert.equal(player.isMuted(), true);
    player.toggleMute();
    assert.equal(player.isMuted(), false);
    assert.deepEqual(backend.callsOf('setMuted').map((call) => call.args[0]), [true, false]);
  });

  test('the music keeps its place: muting and unmuting doesn\'t restart it', () => {
    const { player, backend, game } = setUp(data());
    player.update(game, []);
    player.toggleMute();
    player.update(game, []);
    player.toggleMute();
    player.update(game, []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP]]);
  });

  test('while muted the music still follows the screens, so unmuting plays the right track', () => {
    const { player, backend, game } = setUp(data());
    player.toggleMute();
    player.update(playing(game), []);
    assert.deepEqual(musicCalls(backend), [['playMusic', LEVEL_MUSIC, LOOP]]);
  });

  test('sound effects while muted are skipped, and not played after unmuting', () => {
    const { player, backend, game } = setUp(data());
    player.toggleMute();
    player.update(playing(game), [SoundEvent.JUMP]);
    player.toggleMute();
    player.update(playing(game), []);
    assert.deepEqual(played(backend), []);
  });

  test('cut scene sounds reached while muted are skipped, and not played after unmuting', () => {
    const { player, backend, game } = setUp(data());
    player.toggleMute();
    player.update(inCutscene(game, 2), []);
    player.toggleMute();
    player.update(inCutscene(game, 3), []);
    assert.deepEqual(played(backend), []);
  });
});

describe('the browser lock (reqs 21-22)', () => {
  const JUMP_SOUND = 'audio/sounds/jump.ogg';
  const CRASH = 'audio/sounds/crash.ogg';
  const locked = () => setUp(gameData({
    audio: { startMusic: START_MUSIC, sounds: { [SoundEvent.JUMP]: JUMP_SOUND } },
    cutscene: { music: CUTSCENE_MUSIC, sounds: [{ time: 0, sound: CRASH }] },
  }), { locked: true });

  test('while locked nothing plays: no music, no sound effects, no cut scene sounds', () => {
    const { player, backend, game } = locked();
    player.update(game, []);
    player.update(playing(game), [SoundEvent.JUMP]);
    player.update(inCutscene(game, 1), []);
    assert.deepEqual(backend.calls, []);
    assert.equal(player.isLocked(), true);
    assert.equal(player.currentMusic(), null);
  });

  test('unlock() unlocks the backend and starts the current screen\'s music from the beginning', () => {
    const { player, backend, game } = locked();
    player.update(game, []);
    player.unlock();
    assert.equal(player.isLocked(), false);
    assert.deepEqual(backend.calls, [{ op: 'unlock', args: [] }, { op: 'playMusic', args: [START_MUSIC, LOOP] }]);
    player.update(game, []);
    assert.equal(backend.calls.length, 2, 'the next frame on the same screen changes nothing');
  });

  test('events from before the unlock are not played later', () => {
    const { player, backend, game } = locked();
    player.update(playing(game), [SoundEvent.JUMP]);
    player.unlock();
    player.update(playing(game), []);
    assert.deepEqual(backend.callsOf('playSound'), []);
  });

  test('a backend that isn\'t locked (Electron) plays the start music at once', () => {
    const { player, backend, game } = setUp();
    assert.equal(player.isLocked(), false);
    player.update(game, []);
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP]]);
  });

  test('unlock() when not locked does nothing', () => {
    const { player, backend, game } = setUp();
    player.update(game, []);
    player.unlock();
    assert.deepEqual(musicCalls(backend), [['playMusic', START_MUSIC, LOOP]]);
    assert.deepEqual(backend.callsOf('unlock'), []);
  });
});

describe('a sound that can\'t be played (req 25)', () => {
  const BROKEN = 'audio/sounds/broken.ogg';

  test('a sound effect: one warning naming the file, however often it is played; the game carries on', () => {
    const { player, logs, game } = setUp(gameData({ audio: { sounds: { [SoundEvent.JUMP]: BROKEN } } }), { failing: [BROKEN] });
    player.update(playing(game), [SoundEvent.JUMP]);
    player.update(playing(game), [SoundEvent.JUMP]);
    assert.equal(logs.length, 1);
    assert.ok(logs[0].includes(`data/${BROKEN}`), logs[0]);
  });

  test('music: one warning, and it isn\'t tried again every frame', () => {
    const { player, backend, logs, game } = setUp(gameData({ audio: { startMusic: BROKEN } }), { failing: [BROKEN] });
    player.update(game, []);
    player.update(game, []);
    assert.equal(logs.length, 1);
    assert.equal(backend.callsOf('playMusic').length, 1);
  });
});

describe('the sound state, for the debug overlay and the test hook (req 26)', () => {
  test('on, muted, or locked; locked shows over muted', () => {
    const on = setUp();
    assert.equal(on.player.soundState(), SoundState.ON);
    on.player.toggleMute();
    assert.equal(on.player.soundState(), SoundState.MUTED);
    const locked = setUp(gameData(), { locked: true });
    locked.player.toggleMute();
    assert.equal(locked.player.soundState(), SoundState.LOCKED);
  });

  test('SoundState can\'t be changed', () => {
    assert.ok(Object.isFrozen(SoundState));
  });
});
