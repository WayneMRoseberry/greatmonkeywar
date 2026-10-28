// Tests for the screens (task 7.12; PRD reqs 7, 56, 58, 85), with the
// recording fake canvas.
// Decided:
//  - menu options are labelled "Start", "Next level", and "Exit game"; the
//    selected one has a highlight box (HIGHLIGHT_COLOR) behind its text, and
//    is the only one that does;
//  - the start screen fills the canvas with a dark background and shows the
//    game's name above its menu;
//  - the start screen's background image (display.json "startBackground"),
//    when loaded, covers the whole canvas over the dark background, keeping
//    its proportions and centred, so its edges may be cut off (coverFit);
//  - both menus show a hint, "Enter / A or click: choose", from the first
//    confirm bindings (like the cut scene's skip hint);
//  - each menu option has a box for mouse clicks (startMenuBoxes,
//    levelCompleteMenuBoxes): the same box the highlight is drawn in, so a
//    click lands where the player sees the button; optionAt finds the box a
//    point is in;
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
  menuHint, startMenuBoxes, levelCompleteMenuBoxes, optionAt, coverFit,
} from '../../src/presentation/screens.js';
import { MenuOption } from '../../src/simulation/flow.js';
import { createFakeContext } from '../helpers/fake-canvas.js';

const VIEWPORT = { width: 1280, height: 720 };
const BINDINGS = { keyboard: { confirm: ['Enter'] }, gamepad: { confirm: ['a'] } };

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

describe('the menu hint', () => {
  test('it names the first keyboard key and gamepad button for confirm, and clicking', () => {
    assert.equal(menuHint(BINDINGS), 'Enter / A or click: choose');
  });

  test('key codes are shown as their key names', () => {
    assert.equal(menuHint({ keyboard: { confirm: ['KeyE'] }, gamepad: { confirm: ['b'] } }), 'E / B or click: choose');
  });
});

describe('start screen (req 56)', () => {
  const MENU = { options: [MenuOption.START], selected: 0 };

  function drawn() {
    const ctx = createFakeContext();
    drawStartScreen(ctx, MENU, VIEWPORT, BINDINGS);
    return ctx;
  }

  test('a dark background over the whole canvas, the game\'s name, and a highlighted Start button', () => {
    const ctx = drawn();
    assert.deepEqual(ctx.calls[0].args, [0, 0, VIEWPORT.width, VIEWPORT.height]);
    assert.ok(ctx.texts().includes(GAME_TITLE));
    const start = textCall(ctx, 'Start');
    const [box] = highlights(ctx);
    assert.ok(box && boxHolds(box.args, start.args[1], start.args[2]), 'the highlight is behind Start');
  });

  test('the menu hint is drawn below the menu', () => {
    const ctx = drawn();
    const hint = textCall(ctx, menuHint(BINDINGS));
    assert.ok(hint, 'the hint is drawn');
    assert.ok(hint.args[2] > textCall(ctx, 'Start').args[2], 'below Start');
  });

  test('the Start button\'s box, for clicks, is where its highlight is drawn', () => {
    const ctx = drawn();
    const [highlight] = highlights(ctx);
    const [box] = startMenuBoxes(createFakeContext(), MENU, VIEWPORT);
    assert.deepEqual([box.x, box.y, box.width, box.height], highlight.args);
  });
});

describe('fitting an image to cover the canvas', () => {
  test('an image the canvas\'s shape fills it exactly', () => {
    const image = { width: VIEWPORT.width / 4, height: VIEWPORT.height / 4 };
    assert.deepEqual(coverFit(image, VIEWPORT), { left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height });
  });

  test('a taller image: as wide as the canvas, centred up and down (top and bottom cut off)', () => {
    const image = { width: 100, height: 100 };
    const scale = VIEWPORT.width / image.width;
    assert.deepEqual(coverFit(image, VIEWPORT), {
      left: 0, top: (VIEWPORT.height - image.height * scale) / 2, width: VIEWPORT.width, height: image.height * scale,
    });
  });

  test('a wider image: as tall as the canvas, centred left and right (sides cut off)', () => {
    const image = { width: 400, height: 100 };
    const scale = VIEWPORT.height / image.height;
    assert.deepEqual(coverFit(image, VIEWPORT), {
      left: (VIEWPORT.width - image.width * scale) / 2, top: 0, width: image.width * scale, height: VIEWPORT.height,
    });
  });
});

describe('start screen background image', () => {
  const MENU = { options: [MenuOption.START], selected: 0 };
  const BACKGROUND = { image: { name: 'title' }, width: 100, height: 100 };

  test('drawn over the dark background, covering the canvas, under the title and menu', () => {
    const ctx = createFakeContext();
    drawStartScreen(ctx, MENU, VIEWPORT, BINDINGS, BACKGROUND);
    assert.equal(ctx.calls[0].op, 'fillRect');
    const imageIndex = ctx.calls.findIndex((c) => c.op === 'drawImage');
    const fit = coverFit(BACKGROUND, VIEWPORT);
    assert.deepEqual(ctx.calls[imageIndex].args, [BACKGROUND.image, fit.left, fit.top, fit.width, fit.height]);
    assert.ok(imageIndex < ctx.calls.indexOf(textCall(ctx, GAME_TITLE)), 'under the title');
  });

  test('no image given: only the dark background', () => {
    const ctx = createFakeContext();
    drawStartScreen(ctx, MENU, VIEWPORT, BINDINGS);
    assert.equal(ctx.callsOf('drawImage').length, 0);
  });
});

describe('level complete (req 58)', () => {
  const MENU = { options: [MenuOption.NEXT_LEVEL, MenuOption.EXIT], selected: 1 };

  function drawn(menu = MENU, rewardCount = 5) {
    const ctx = createFakeContext();
    drawLevelComplete(ctx, menu, rewardCount, VIEWPORT, BINDINGS);
    return ctx;
  }

  test('the menu hint is drawn inside the panel, below the options', () => {
    const ctx = drawn();
    const [panel] = ctx.callsOf('fillRect');
    const hint = textCall(ctx, menuHint(BINDINGS));
    assert.ok(hint && boxHolds(panel.args, hint.args[1], hint.args[2]), 'inside the panel');
    assert.ok(hint.args[2] > textCall(ctx, 'Exit game').args[2], 'below the last option');
  });

  test('each option has a box, for clicks, around its label; the selected one\'s is where its highlight is drawn', () => {
    const ctx = drawn();
    const boxes = levelCompleteMenuBoxes(createFakeContext(), MENU, VIEWPORT);
    assert.equal(boxes.length, MENU.options.length);
    MENU.options.forEach((option, i) => {
      const label = textCall(ctx, MENU_LABELS[option]);
      assert.ok(boxHolds([boxes[i].x, boxes[i].y, boxes[i].width, boxes[i].height], label.args[1], label.args[2]), MENU_LABELS[option]);
    });
    const selected = boxes[MENU.selected];
    assert.deepEqual([selected.x, selected.y, selected.width, selected.height], highlights(ctx)[0].args);
  });

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

describe('which option a click is on', () => {
  const BOXES = [{ x: 10, y: 10, width: 100, height: 20 }, { x: 10, y: 50, width: 100, height: 20 }];

  test('a point inside an option\'s box gives that option\'s index', () => {
    const second = BOXES[1];
    assert.equal(optionAt(BOXES, { x: second.x + second.width / 2, y: second.y + second.height / 2 }), 1);
  });

  test('a point outside every box gives -1', () => {
    const [first, second] = BOXES;
    assert.equal(optionAt(BOXES, { x: first.x, y: (first.y + first.height + second.y) / 2 }), -1, 'between the boxes');
    assert.equal(optionAt(BOXES, { x: first.x + first.width + 1, y: first.y }), -1, 'right of them');
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
