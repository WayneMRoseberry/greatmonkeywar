// Tests for the screens (task 7.12; PRD reqs 7, 56, 58, 85), with the
// recording fake canvas.
// Decided:
//  - menu options are labelled "Start", "Next level", and "Exit game"; the
//    selected one has a highlight box (HIGHLIGHT_COLOR) behind its text, and
//    is the only one that does;
//  - the start screen fills the canvas with a dark background and shows the
//    game's name above its menu;
//  - the level-complete screen is a half-transparent panel drawn over the
//    frozen game (not clearing it), with "Level complete", the reward count,
//    and the menu;
//  - "Thanks for playing" is shown alone on a dark background;
//  - the data error screen lists every error, one per line, under a title,
//    wrapping long ones to the canvas width; the font shrinks (down to
//    MIN_ERROR_FONT) so more errors fit.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawStartScreen, drawLevelComplete, drawThanks, drawDataErrors, MENU_LABELS, HIGHLIGHT_COLOR, GAME_TITLE, MIN_ERROR_FONT,
} from '../../src/presentation/screens.js';
import { MenuOption } from '../../src/simulation/flow.js';
import { createFakeContext } from '../helpers/fake-canvas.js';

const VIEWPORT = { width: 1280, height: 720 };

/** The highlight boxes drawn. */
const highlights = (ctx) => ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === HIGHLIGHT_COLOR);

/** The fillText call for `text`. */
const textCall = (ctx, text) => ctx.callsOf('fillText').find((c) => c.args[0] === text);

/** True if the box [x, y, w, h] contains the point (x, y) of a text drawn centred. */
function boxHolds([bx, by, bw, bh], x, y) {
  return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}

describe('menu labels', () => {
  test('every menu option has a label', () => {
    assert.deepEqual(MENU_LABELS, { [MenuOption.START]: 'Start', [MenuOption.NEXT_LEVEL]: 'Next level', [MenuOption.EXIT]: 'Exit game' });
  });
});

describe('start screen (req 56)', () => {
  test('a dark background over the whole canvas, the game\'s name, and a highlighted Start button', () => {
    const ctx = createFakeContext();
    drawStartScreen(ctx, { options: [MenuOption.START], selected: 0 }, VIEWPORT);
    assert.deepEqual(ctx.calls[0].args, [0, 0, VIEWPORT.width, VIEWPORT.height]);
    assert.ok(ctx.texts().includes(GAME_TITLE));
    const start = textCall(ctx, 'Start');
    const [box] = highlights(ctx);
    assert.ok(box && boxHolds(box.args, start.args[1], start.args[2]), 'the highlight is behind Start');
  });
});

describe('level complete (req 58)', () => {
  const MENU = { options: [MenuOption.NEXT_LEVEL, MenuOption.EXIT], selected: 1 };

  function drawn(menu = MENU, rewardCount = 5) {
    const ctx = createFakeContext();
    drawLevelComplete(ctx, menu, rewardCount, VIEWPORT);
    return ctx;
  }

  test('a half-transparent panel over the game, not clearing it', () => {
    const ctx = drawn();
    const [panel] = ctx.callsOf('fillRect');
    assert.ok(panel.style.globalAlpha < 1, 'half-transparent');
    assert.ok(panel.args[2] < VIEWPORT.width, 'a panel, not the whole canvas');
  });

  test('the title, the reward count, and both options', () => {
    const texts = drawn().texts();
    for (const text of ['Level complete', 'Rewards: 5', 'Next level', 'Exit game']) assert.ok(texts.includes(text), text);
  });

  test('only the selected option is highlighted', () => {
    const ctx = drawn();
    const boxes = highlights(ctx);
    assert.equal(boxes.length, 1);
    const exit = textCall(ctx, 'Exit game');
    const next = textCall(ctx, 'Next level');
    assert.ok(boxHolds(boxes[0].args, exit.args[1], exit.args[2]), 'behind Exit game');
    assert.ok(!boxHolds(boxes[0].args, next.args[1], next.args[2]), 'not behind Next level');
  });

  test('on the last level, only Exit game is offered', () => {
    const texts = drawn({ options: [MenuOption.EXIT], selected: 0 }).texts();
    assert.ok(texts.includes('Exit game'));
    assert.ok(!texts.includes('Next level'));
  });
});

describe('thanks for playing (req 7)', () => {
  test('the message alone on a dark background', () => {
    const ctx = createFakeContext();
    drawThanks(ctx, VIEWPORT);
    assert.deepEqual(ctx.calls[0].args, [0, 0, VIEWPORT.width, VIEWPORT.height]);
    assert.deepEqual(ctx.texts(), ['Thanks for playing']);
  });
});

describe('data error screen (req 85)', () => {
  test('a title, then every error', () => {
    const errors = ['levels/level1.json: row 7 has 58 tiles but row 1 has 60.', 'config/tuning.json: "gravity" is missing.'];
    const ctx = createFakeContext();
    drawDataErrors(ctx, errors, VIEWPORT);
    const texts = ctx.texts();
    assert.match(texts[0], /problem/i);
    for (const error of errors) assert.ok(texts.includes(error), error);
  });

  test('a long error is wrapped to the canvas width, and all of its words are shown', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const ctx = createFakeContext();
    drawDataErrors(ctx, [long], { width: 400, height: 720 });
    const lines = ctx.texts().slice(1);
    assert.ok(lines.length > 1, 'wrapped onto several lines');
    assert.equal(lines.join(' '), long);
    for (const call of ctx.callsOf('fillText').slice(1)) {
      const size = Number.parseFloat(call.style.font.replace(/^\D*/, ''));
      assert.ok(call.args[0].length * size * 0.6 <= 400, `fits: "${call.args[0]}"`);   // the fake's measureText
    }
  });

  test('many errors: every one is shown, the font shrinking but not below the minimum', () => {
    const errors = Array.from({ length: 80 }, (_, i) => `data/file${i}.json: problem ${i}.`);
    const ctx = createFakeContext();
    drawDataErrors(ctx, errors, VIEWPORT);
    const texts = ctx.texts();
    for (const error of errors) assert.ok(texts.includes(error), error);
    const sizes = ctx.callsOf('fillText').map((c) => Number.parseFloat(c.style.font.replace(/^\D*/, '')));
    assert.ok(Math.min(...sizes) >= MIN_ERROR_FONT);
  });
});
