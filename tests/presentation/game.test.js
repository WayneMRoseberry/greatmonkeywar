// Tests for the game controller (task 7.15; PRD reqs 2, 10, 60), with a fake
// canvas, a fake platform, and a fake input reader.
//
// createGameController({ data, images, platform, canvas, inputReader, now, log })
// ties the game together. update(dt) reads input, handles the
// presentation-only keys, and steps the game flow (flow.js); draw() draws the
// current screen. The loop (loop.js) calls them.
// Decided:
//  - F3 (debug) and F11 (fullscreen) act on a new press only; F11 goes
//    through the platform's toggleFullscreen;
//  - when the flow reaches the finished screen, the platform's quit is
//    called, once; if it says to show thanks (browser mode), "Thanks for
//    playing" is drawn from then on, otherwise the canvas is left dark;
//  - the debug overlay's fps is measured from the time between draws, using `now`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGameController } from '../../src/presentation/game.js';
import { createFakeCanvas } from '../helpers/fake-canvas.js';
import { createFakePlatform } from '../../src/platform/fake-platform.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';
import { InputDevice } from '../../src/presentation/input.js';
import { SOUND_OFF_TEXT } from '../../src/presentation/hud.js';
import { SoundState } from '../../src/presentation/audio.js';
import { GAME_TITLE, menuHint, startMenuBoxes, levelCompleteMenuBoxes } from '../../src/presentation/screens.js';
import { Screen, MenuOption } from '../../src/simulation/flow.js';
import { FIXED_DT, STEPS_PER_SECOND, SoundEvent } from '../../src/simulation/constants.js';

const NO_KEYS = { fullscreen: false, debug: false, mute: false };
const MUTE_KEY = { ...NO_KEYS, mute: true };

/** A fake input reader: read() gives what `set` was last told. */
function fakeReader() {
  let current = { input: NO_INPUT, presentation: NO_KEYS, device: InputDevice.KEYBOARD, click: null, activated: false };
  return {
    read: () => current,
    set(input = NO_INPUT, presentation = NO_KEYS) { current = { ...current, input, presentation }; },
    setClick(click) { current = { ...current, click }; },
    setActivated(activated) { current = { ...current, activated }; },
  };
}

/** Data with one level where the goal is just right of the player (so it is also the last level). */
function oneLevel() {
  return buildData(['P.G', '###']);
}

const VIEWPORT = { width: 800, height: 600 };

/** The centre of a menu option's box. */
const centreOf = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * A stand-in for the audio player (audio.js) that records each update as
 * { screen, events }, and keeps mute and lock state like the real one.
 */
function fakeAudioPlayer({ locked = false, music = null } = {}) {
  let muted = false;
  let isLocked = locked;
  return {
    updates: [],
    unlocks: 0,
    update(game, events) { this.updates.push({ screen: game.screen, events: [...events] }); },
    toggleMute() { muted = !muted; },
    isMuted: () => muted,
    unlock() { this.unlocks += 1; isLocked = false; },
    isLocked: () => isLocked,
    currentMusic: () => music,
    soundState: () => (isLocked ? SoundState.LOCKED : muted ? SoundState.MUTED : SoundState.ON),
  };
}

function setUp({ data = oneLevel(), images = {}, platform = createFakePlatform(), audio = fakeAudioPlayer() } = {}) {
  const canvas = createFakeCanvas(VIEWPORT.width, VIEWPORT.height);
  const reader = fakeReader();
  let time = 0;
  const logs = [];
  const controller = createGameController({
    data, images, platform, canvas, inputReader: reader, now: () => time, log: (m) => logs.push(m), audio,
  });
  const ctx = canvas.getContext('2d');
  return {
    controller, reader, platform, ctx, logs, audio,
    tick: (ms) => { time += ms; },
    /** Holds `input` for one update, then releases it for one, so the next press is new. */
    press(input = NO_INPUT, presentation = NO_KEYS) {
      reader.set(input, presentation);
      controller.update(FIXED_DT);
      reader.set();
      controller.update(FIXED_DT);
    },
    /** Clicks at `point` (canvas pixels): the reader reports it for one update. */
    click(point) {
      reader.setClick(point);
      controller.update(FIXED_DT);
      reader.setClick(null);
    },
    /** Draws once and returns the texts drawn this time. */
    drawTexts() {
      ctx.calls.length = 0;
      controller.draw();
      return ctx.texts();
    },
  };
}

/** Plays from the start screen to the level-complete screen (walking right). */
function toLevelComplete(game) {
  game.press(holding(Input.CONFIRM));
  game.reader.set(holding(Input.RIGHT));
  for (let i = 0; i < 5 * STEPS_PER_SECOND && game.controller.getGame().screen !== Screen.LEVEL_COMPLETE; i++) {
    game.controller.update(FIXED_DT);
  }
  game.reader.set();
  game.controller.update(FIXED_DT);
  assert.equal(game.controller.getGame().screen, Screen.LEVEL_COMPLETE);
}

describe('stepping and drawing the screens', () => {
  test('it begins on the start screen, which is what is drawn', () => {
    const game = setUp();
    assert.equal(game.controller.getGame().screen, Screen.START);
    assert.ok(game.drawTexts().includes(GAME_TITLE));
  });

  test('the start screen is drawn over the display settings\' start background image', () => {
    const startBackground = 'images/title.png';
    const title = { image: { name: 'title' }, width: VIEWPORT.width, height: VIEWPORT.height };
    const game = setUp({ data: buildData(['P.G', '###'], { display: { startBackground } }), images: { [startBackground]: title } });
    game.drawTexts();
    assert.deepEqual(game.ctx.callsOf('drawImage').map((c) => c.args[0]), [title.image]);
  });

  test('update steps the game with the input read: confirm starts the level, which is then drawn with the HUD', () => {
    const game = setUp();
    game.press(holding(Input.CONFIRM));
    assert.equal(game.controller.getGame().screen, Screen.PLAYING);
    const texts = game.drawTexts();
    const [background] = game.ctx.calls;
    assert.equal(background.style.fillStyle, game.controller.getGame().data.levels[TEST_LEVEL].background.color);
    assert.ok(texts.some((t) => t.startsWith('Health:')), 'the HUD');
  });

  test('the level-complete panel is drawn over the level', () => {
    const game = setUp();
    toLevelComplete(game);
    const texts = game.drawTexts();
    assert.ok(texts.includes('Level complete'));
    assert.ok(texts.some((t) => t.startsWith('Health:')), 'the HUD is still drawn under the panel');
  });

  test('a cut scene is drawn with its skip hint', () => {
    const data = buildData(['P.G', '###'], { level: { cutscene: 'between' } });
    data.levels.second = { ...data.levels[TEST_LEVEL], grid: ['P..G', '####'] };
    delete data.levels.second.cutscene;
    data.levelList.levels.push('second');
    data.cutscenes.between = {
      formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/c.png', backgroundColor: '#000000',
      actors: [], narration: [{ start: 0, end: 5, text: 'Meanwhile...' }],
    };
    const game = setUp({ data });
    toLevelComplete(game);
    game.press(holding(Input.CONFIRM));   // Next level
    assert.equal(game.controller.getGame().screen, Screen.CUTSCENE);
    const texts = game.drawTexts();
    assert.ok(texts.includes('Meanwhile...'));
    assert.ok(texts.some((t) => t.endsWith(': skip')));
  });
});

describe('menus by mouse, and the menu hint', () => {
  test('the start screen and the level-complete panel show the menu hint', () => {
    const game = setUp();
    const hint = menuHint(game.controller.getGame().data.bindings);
    assert.ok(game.drawTexts().includes(hint), 'start screen');
    toLevelComplete(game);
    assert.ok(game.drawTexts().includes(hint), 'level complete');
  });

  test('clicking Start on the start screen starts the level', () => {
    const game = setUp();
    const [start] = startMenuBoxes(game.ctx, game.controller.getGame().menu, VIEWPORT);
    game.click(centreOf(start));
    assert.equal(game.controller.getGame().screen, Screen.PLAYING);
  });

  test('a click that isn\'t on an option does nothing', () => {
    const game = setUp();
    game.click({ x: 0, y: 0 });
    assert.equal(game.controller.getGame().screen, Screen.START);
  });

  test('clicking Exit game on the level-complete panel quits through the platform', () => {
    const game = setUp();
    toLevelComplete(game);
    const { menu } = game.controller.getGame();
    const boxes = levelCompleteMenuBoxes(game.ctx, menu, VIEWPORT);
    game.click(centreOf(boxes[menu.options.indexOf(MenuOption.EXIT)]));
    assert.equal(game.controller.getGame().screen, Screen.FINISHED);
    assert.equal(game.platform.quits, 1);
  });
});

describe('presentation keys (req 2)', () => {
  test('a new press of the debug key shows the overlay; another hides it', () => {
    const game = setUp();
    assert.ok(!game.drawTexts().some((t) => t.startsWith('FPS:')));
    game.press(NO_INPUT, { fullscreen: false, debug: true });
    assert.ok(game.drawTexts().some((t) => t.startsWith('FPS:')));
    game.press(NO_INPUT, { fullscreen: false, debug: true });
    assert.ok(!game.drawTexts().some((t) => t.startsWith('FPS:')));
  });

  test('holding the debug key toggles it only once', () => {
    const game = setUp();
    game.reader.set(NO_INPUT, { fullscreen: false, debug: true });
    for (let i = 0; i < 10; i++) game.controller.update(FIXED_DT);
    assert.ok(game.drawTexts().some((t) => t.startsWith('FPS:')));
  });

  test('a new press of the fullscreen key toggles fullscreen through the platform, once per press', () => {
    const game = setUp();
    game.reader.set(NO_INPUT, { fullscreen: true, debug: false });
    for (let i = 0; i < 10; i++) game.controller.update(FIXED_DT);
    assert.equal(game.platform.fullscreenToggles, 1);
  });

  test('the overlay shows the frames per second, measured between draws', () => {
    const game = setUp();
    game.press(NO_INPUT, { fullscreen: false, debug: true });
    for (let i = 0; i < 10; i++) {
      game.tick(1000 / 60);
      game.controller.draw();
    }
    game.tick(1000 / 60);
    assert.ok(game.drawTexts().includes('FPS: 60'));
  });

  test('the overlay shows Steam\'s status from the platform', () => {
    const game = setUp({ platform: createFakePlatform({ steam: 'connected', userName: 'Wayne' }) });
    game.press(NO_INPUT, { fullscreen: false, debug: true });
    assert.ok(game.drawTexts().includes('Steam: connected (Wayne)'));
  });
});

describe('quitting (req 60)', () => {
  /** Plays to level complete, then chooses Exit game (the only option on the last level). */
  function exited(game) {
    toLevelComplete(game);
    game.press(holding(Input.CONFIRM));
    assert.equal(game.controller.getGame().screen, Screen.FINISHED);
  }

  test('reaching the finished screen calls the platform\'s quit, once', () => {
    const game = setUp();
    exited(game);
    for (let i = 0; i < 10; i++) game.controller.update(FIXED_DT);
    assert.equal(game.platform.quits, 1);
  });

  test('when the platform says to show thanks (browser mode), "Thanks for playing" is drawn', () => {
    const game = setUp({ platform: createFakePlatform({ showThanks: true }) });
    exited(game);
    assert.deepEqual(game.drawTexts(), ['Thanks for playing']);
  });

  test('when the platform closes the game itself, no thanks screen is drawn', () => {
    const game = setUp({ platform: createFakePlatform({ showThanks: false }) });
    exited(game);
    assert.deepEqual(game.drawTexts(), []);
  });
});

describe('sound (sound PRD reqs 13-15)', () => {
  test('the events of every update since the last draw reach the audio player together, once, in the next draw', () => {
    const game = setUp();
    game.press(holding(Input.CONFIRM));        // menuChoose, then a level step
    game.reader.set(holding(Input.JUMP));
    game.controller.update(FIXED_DT);           // jump
    game.controller.draw();
    game.controller.draw();
    const [first, second] = game.audio.updates;
    assert.deepEqual(first, { screen: Screen.PLAYING, events: [SoundEvent.MENU_CHOOSE, SoundEvent.JUMP] });
    assert.deepEqual(second, { screen: Screen.PLAYING, events: [] });
  });

  test('a click on a menu option reaches the audio player as menuChoose', () => {
    const game = setUp();
    const [start] = startMenuBoxes(game.ctx, game.controller.getGame().menu, VIEWPORT);
    game.click(centreOf(start));
    game.controller.draw();
    assert.deepEqual(game.audio.updates[0].events, [SoundEvent.MENU_CHOOSE]);
  });

  test('every draw updates the audio player, even with no events', () => {
    const game = setUp();
    game.controller.draw();
    assert.deepEqual(game.audio.updates, [{ screen: Screen.START, events: [] }]);
  });
});

describe('the mute key (sound PRD reqs 16-17)', () => {
  test('a new press toggles the audio player\'s mute, once per press', () => {
    const game = setUp();
    game.reader.set(NO_INPUT, MUTE_KEY);
    game.controller.update(FIXED_DT);
    game.controller.update(FIXED_DT);   // still held: no second toggle
    assert.equal(game.audio.isMuted(), true);
    game.press(NO_INPUT, NO_KEYS);
    game.press(NO_INPUT, MUTE_KEY);
    assert.equal(game.audio.isMuted(), false);
  });
});

describe('unlocking sound (sound PRD req 21)', () => {
  test('the first key press or click unlocks the audio player', () => {
    const game = setUp({ audio: fakeAudioPlayer({ locked: true }) });
    game.controller.update(FIXED_DT);
    assert.equal(game.audio.unlocks, 0, 'nothing pressed yet');
    game.reader.setActivated(true);
    game.controller.update(FIXED_DT);
    game.controller.update(FIXED_DT);
    assert.equal(game.audio.unlocks, 1, 'once: it is no longer locked');
  });

  test('when sound isn\'t locked, a key press doesn\'t unlock again', () => {
    const game = setUp();
    game.reader.setActivated(true);
    game.controller.update(FIXED_DT);
    assert.equal(game.audio.unlocks, 0);
  });
});

describe('the "Sound off" label (sound PRD req 19)', () => {
  /** Mutes with a press of the mute key; returns the game. */
  function muted(options) {
    const game = setUp(options);
    game.press(NO_INPUT, MUTE_KEY);
    return game;
  }

  test('while muted it is drawn on the start screen, while playing, and in a cut scene', () => {
    const data = buildData(['P.G', '###'], { level: { cutscene: 'between' } });
    data.levels.second = { ...data.levels[TEST_LEVEL], grid: ['P..G', '####'] };
    delete data.levels.second.cutscene;
    data.levelList.levels.push('second');
    data.cutscenes.between = {
      formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/c.png', backgroundColor: '#000000',
      actors: [], narration: [{ start: 0, end: 5, text: 'Meanwhile...' }],   // 5 seconds long, so it is still showing
    };
    const game = muted({ data });
    assert.ok(game.drawTexts().includes(SOUND_OFF_TEXT), 'start screen');
    toLevelComplete(game);
    assert.ok(game.drawTexts().includes(SOUND_OFF_TEXT), 'level complete');
    game.press(holding(Input.CONFIRM));   // Next level: the cut scene first
    assert.equal(game.controller.getGame().screen, Screen.CUTSCENE);
    assert.ok(game.drawTexts().includes(SOUND_OFF_TEXT), 'cut scene');
  });

  test('not drawn while sound is on', () => {
    const game = setUp();
    assert.ok(!game.drawTexts().includes(SOUND_OFF_TEXT));
  });
});

describe('the debug overlay\'s sound lines (sound PRD req 26)', () => {
  test('they show the audio player\'s music and sound state', () => {
    const music = 'audio/music/start.ogg';
    const game = setUp({ audio: fakeAudioPlayer({ locked: true, music }) });
    game.press(NO_INPUT, { ...NO_KEYS, debug: true });
    const texts = game.drawTexts();
    assert.ok(texts.includes(`Music: ${music}`), 'music');
    assert.ok(texts.includes(`Sound: ${SoundState.LOCKED}`), 'sound');
  });
});
