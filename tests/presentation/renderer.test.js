// Tests for the renderer (task 7.7; PRD reqs 66-68, 70, 76): drawing a level
// to a canvas, checked with the recording fake canvas.
//
// levelView(level, canvasSize, visibleHeight) works out what is on screen
// (visibleArea and cameraFor, camera.js); drawLevel(ctx, level, view, assets)
// draws it, in this order: the level's background colour over the whole
// canvas, the parallax layers (the first is the farthest), the tiles, the
// goal, rewards, objects, enemies, the player, then the punch flash. Each is
// drawn as a coloured shape from data (req 76).
// Decided:
//  - flashing (invincibility, defeat) shows the shape on alternate tenths of
//    a second of level time (FLASH_PER_SECOND = 10 changes a second);
//  - the punch flash fills the punch area with a half-transparent white; a
//    punch area with no width (no sprite) is drawn PUNCH_FLASH_MIN_WIDTH wide,
//    just in front of the player, so it can be seen.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { levelView, drawLevel, FLASH_PER_SECOND, PUNCH_FLASH_COLOR, PUNCH_FLASH_MIN_WIDTH } from '../../src/presentation/renderer.js';
import { createFakeContext } from '../helpers/fake-canvas.js';
import { createLevelState } from '../../src/simulation/state.js';
import { Player } from '../../src/simulation/player.js';
import { Enemy } from '../../src/simulation/enemies.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { visibleArea, cameraFor } from '../../src/simulation/camera.js';

const VISIBLE_HEIGHT = 4;
const CANVAS = { width: 800, height: 400 };   // 100 pixels per tile, 8 tiles wide

/** A level from `grid` (standard legend, level-builder.js), its view, and a fake context drawn on. */
function drawn(grid, { overrides = {}, change = (s) => s, images = {} } = {}) {
  const state = change(createLevelState(buildData(grid, overrides), TEST_LEVEL));
  const view = levelView(state, CANVAS, VISIBLE_HEIGHT);
  const ctx = createFakeContext();
  drawLevel(ctx, state, view, { images, warn: () => {} });
  return { state, view, ctx };
}

/** The screen rectangle, in pixels, of a world box in `view`. */
const onScreen = (box, view) => [(box.x - view.camera.x) * view.scale, (box.y - view.camera.y) * view.scale, box.width * view.scale, box.height * view.scale];

function assertRectNear(actual, expected, label) {
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${label}: ${actual} vs ${expected}`));
}

/** The fillRect calls drawn in `color`. */
const filledIn = (ctx, color) => ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === color);

// Wide enough that the camera follows; 4 rows, as tall as the view.
const GRID = ['........G..', '...........', '.P.e.c.b...', '###########'];

describe('the view (reqs 6, 66-67)', () => {
  test('from the canvas size and visible height, following the player', () => {
    const state = createLevelState(buildData(GRID), TEST_LEVEL);
    const view = levelView(state, CANVAS, VISIBLE_HEIGHT);
    const area = visibleArea(CANVAS.width, CANVAS.height, VISIBLE_HEIGHT);
    assert.equal(view.scale, area.scale);
    assert.deepEqual(view.area, area);
    assert.deepEqual(view.camera, cameraFor(state.level, state.player, area));
    assert.deepEqual({ width: view.pixelWidth, height: view.pixelHeight }, CANVAS);
  });
});

describe('drawing a level (req 76)', () => {
  test('first, the level\'s background colour fills the whole canvas (also around a level smaller than the view)', () => {
    const { state, ctx } = drawn(GRID);
    const [first] = ctx.calls;
    assert.equal(first.op, 'fillRect');
    assert.deepEqual(first.args, [0, 0, CANVAS.width, CANVAS.height]);
    assert.equal(first.style.fillStyle, state.data.levels[TEST_LEVEL].background.color);
  });

  test('each solid tile in view is drawn as a square in its colour', () => {
    const { state, view, ctx } = drawn(GRID);
    const color = state.level.tileTypes['#'].color;
    const tiles = filledIn(ctx, color);
    const column = 2;
    const row = 3;
    assert.ok(tiles.some((c) => onScreen({ x: column, y: row, width: 1, height: 1 }, view).every((v, i) => Math.abs(v - c.args[i]) < 1e-6)),
      'the tile at column 2, row 3');
    assert.ok(tiles.length >= Math.floor(view.area.width), 'a row of ground across the view');
  });

  test('tiles are drawn on whole pixels, each starting exactly where the one before it ends, so no seams show', () => {
    // A view whose scale and camera put tile edges between pixels.
    const state = createLevelState(buildData(GRID), TEST_LEVEL);
    const oddCanvas = { width: 803, height: 397 };
    const view = levelView(state, oddCanvas, VISIBLE_HEIGHT);
    const ctx = createFakeContext();
    drawLevel(ctx, state, view, { images: {}, warn: () => {} });
    const ground = filledIn(ctx, state.level.tileTypes['#'].color).map((c) => c.args).sort((a, b) => a[0] - b[0]);
    for (const [x, y, w, h] of ground) assert.ok([x, y, w, h].every(Number.isInteger), `whole pixels: ${[x, y, w, h]}`);
    ground.slice(1).forEach((rect, i) => assert.equal(rect[0], ground[i][0] + ground[i][2], 'no gap or overlap between neighbours'));
  });

  test('non-solid tiles are drawn too, in their colour', () => {
    const water = '#3366ff';
    const { ctx } = drawn(['P~.G', '####'], { overrides: { legend: { '~': { tile: { solid: false, color: water } } } } });
    assert.equal(filledIn(ctx, water).length, 1);
  });

  test('the player is drawn as a rectangle at their box, in their colour', () => {
    const { state, view, ctx } = drawn(GRID);
    const [player] = filledIn(ctx, state.data.characters.player.color);
    assertRectNear(player.args, onScreen(state.player, view), 'player');
  });

  test('enemies, objects, rewards, and the goal are drawn at their boxes, in their colours', () => {
    const { state, view, ctx } = drawn(GRID);
    const { data } = state;
    const [enemy] = filledIn(ctx, data.characters.beetle.color);
    assertRectNear(enemy.args, onScreen(state.enemies[0], view), 'enemy');
    const [object] = filledIn(ctx, data.objects.crate.color);
    assertRectNear(object.args, onScreen(state.objects[0], view), 'object');
    const [reward] = filledIn(ctx, state.rewards[0].color);
    assertRectNear(reward.args, onScreen(state.rewards[0], view), 'reward');
    const [goal] = filledIn(ctx, data.levels[TEST_LEVEL].legend.G.color);
    assertRectNear(goal.args, onScreen(state.goal, view), 'goal');
  });

  test('the drawing order: tiles, goal, rewards, objects, enemies, then the player on top', () => {
    const { state, ctx } = drawn(GRID);
    const { data } = state;
    const firstIndex = (color) => ctx.calls.findIndex((c) => c.op === 'fillRect' && c.style.fillStyle === color);
    const order = [
      state.level.tileTypes['#'].color, data.levels[TEST_LEVEL].legend.G.color, state.rewards[0].color,
      data.objects.crate.color, data.characters.beetle.color, data.characters.player.color,
    ].map(firstIndex);
    assert.ok(order.every((index) => index > 0), `all drawn: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });
});

describe('parallax layers (reqs 68, 70)', () => {
  test('each layer\'s image is drawn, scaled to the view\'s height, the farthest first, before the tiles', () => {
    const far = { image: { name: 'far' }, width: 200, height: 100 };
    const near = { image: { name: 'near' }, width: 100, height: 100 };
    const layers = [{ image: 'images/far.png', scrollFactor: 0 }, { image: 'images/near.png', scrollFactor: 0.5 }];
    const { view, ctx, state } = drawn(GRID, {
      overrides: { level: { background: { color: '#87ceeb', layers } } },
      images: { 'images/far.png': far, 'images/near.png': near },
    });
    const draws = ctx.callsOf('drawImage');
    assert.equal(draws[0].args[0], far.image, 'the farthest layer first');
    assert.ok(draws.some((c) => c.args[0] === near.image));
    const [, , , width, height] = draws[0].args;
    assert.ok(Math.abs(height - view.area.height * view.scale) < 1e-6, 'as tall as the view');
    assert.ok(Math.abs(width - height * (far.width / far.height)) < 1e-6, 'keeping its proportions');
    const lastLayer = ctx.calls.lastIndexOf(draws.at(-1));
    const firstTile = ctx.calls.findIndex((c) => c.op === 'fillRect' && c.style.fillStyle === state.level.tileTypes['#'].color);
    assert.ok(lastLayer < firstTile, 'layers before the tiles');
  });

  test('a repeating layer is drawn in copies across the whole view', () => {
    const narrow = { image: { name: 'narrow' }, width: 100, height: 100 };   // 4 tiles wide at this view's height
    const { view, ctx } = drawn(GRID, {
      overrides: { level: { background: { color: '#87ceeb', layers: [{ image: 'images/narrow.png', scrollFactor: 1 }] } } },
      images: { 'images/narrow.png': narrow },
    });
    const draws = ctx.callsOf('drawImage');
    assert.ok(draws.length >= Math.ceil(view.area.width / view.area.height), `copies: ${draws.length}`);
    const right = Math.max(...draws.map((c) => c.args[1] + c.args[3]));
    assert.ok(right >= CANVAS.width - 1e-6, 'they reach the right edge');
  });

  test('a layer whose image isn\'t loaded is skipped', () => {
    const { ctx } = drawn(GRID, {
      overrides: { level: { background: { color: '#87ceeb', layers: [{ image: 'images/missing.png', scrollFactor: 1 }] } } },
    });
    assert.deepEqual(ctx.callsOf('drawImage'), []);
  });
});

describe('flashes', () => {
  const flashPhase = (time) => Math.floor(time * FLASH_PER_SECOND) % 2;
  const tenth = 1 / FLASH_PER_SECOND;

  test('while invincible, the player is shown and hidden in turn', () => {
    const at = (time) => drawn(GRID, { change: (s) => ({ ...s, time, player: new Player({ ...s.player, invincibleTime: 1 }) }) });
    const shown = at(0.5 * tenth);
    const hidden = at(1.5 * tenth);
    assert.equal(flashPhase(0.5 * tenth), 0);
    assert.equal(filledIn(shown.ctx, shown.state.data.characters.player.color).length, 1);
    assert.equal(filledIn(hidden.ctx, hidden.state.data.characters.player.color).length, 0);
  });

  test('a player who isn\'t invincible is always shown', () => {
    const { ctx, state } = drawn(GRID, { change: (s) => ({ ...s, time: 1.5 * tenth }) });
    assert.equal(filledIn(ctx, state.data.characters.player.color).length, 1);
  });

  test('a defeated enemy is shown and hidden in turn', () => {
    const at = (time) => drawn(GRID, {
      change: (s) => ({ ...s, time, enemies: s.enemies.map((e) => new Enemy({ ...e, defeatTime: 0.5 })) }),
    });
    const shown = at(0.5 * tenth);
    const hidden = at(1.5 * tenth);
    assert.equal(filledIn(shown.ctx, shown.state.data.characters.beetle.color).length, 1);
    assert.equal(filledIn(hidden.ctx, hidden.state.data.characters.beetle.color).length, 0);
  });

  test('while a punch is showing, the punch area is filled half-transparent, in front of the player', () => {
    const { state, view, ctx } = drawn(GRID, { change: (s) => ({ ...s, player: new Player({ ...s.player, punchTime: 0.1 }) }) });
    const [flash] = filledIn(ctx, PUNCH_FLASH_COLOR);
    assert.ok(flash, 'the punch flash is drawn');
    assert.ok(flash.style.globalAlpha < 1, 'half-transparent');
    const front = (state.player.x + state.player.width - view.camera.x) * view.scale;
    assert.ok(Math.abs(flash.args[0] - front) < 1e-6, 'starting at the player\'s front edge (facing right)');
    assert.ok(Math.abs(flash.args[2] - PUNCH_FLASH_MIN_WIDTH * view.scale) < 1e-6, 'a no-width reach is drawn a little wide');
    assert.equal(ctx.calls.at(-1), flash, 'drawn last, on top');
  });

  test('with no punch showing, there is no punch flash', () => {
    const { ctx } = drawn(GRID);
    assert.deepEqual(filledIn(ctx, PUNCH_FLASH_COLOR), []);
  });
});
