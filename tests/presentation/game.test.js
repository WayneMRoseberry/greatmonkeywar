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
import { GAME_TITLE } from '../../src/presentation/screens.js';
import { Screen } from '../../src/simulation/flow.js';
import { FIXED_DT, STEPS_PER_SECOND } from '../../src/simulation/constants.js';

const NO_KEYS = { fullscreen: false, debug: false };

/** A fake input reader: read() gives what `set` was last told. */
function fakeReader() {
  let current = { input: NO_INPUT, presentation: NO_KEYS, device: InputDevice.KEYBOARD };
  return {
    read: () => current,
    set(input = NO_INPUT, presentation = NO_KEYS) { current = { ...current, input, presentation }; },
  };
}

/** Data with one level where the goal is just right of the player (so it is also the last level). */
function oneLevel() {
  return buildData(['P.G', '###']);
}

function setUp({ data = oneLevel(), platform = createFakePlatform() } = {}) {
  const canvas = createFakeCanvas(800, 600);
  const reader = fakeReader();
  let time = 0;
  const logs = [];
  const controller = createGameController({
    data, images: {}, platform, canvas, inputReader: reader, now: () => time, log: (m) => logs.push(m),
  });
  const ctx = canvas.getContext('2d');
  return {
    controller, reader, platform, ctx, logs,
    tick: (ms) => { time += ms; },
    /** Holds `input` for one update, then releases it for one, so the next press is new. */
    press(input = NO_INPUT, presentation = NO_KEYS) {
      reader.set(input, presentation);
      controller.update(FIXED_DT);
      reader.set();
      controller.update(FIXED_DT);
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
