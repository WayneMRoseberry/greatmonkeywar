// Tests for the visible area and the camera (tasks 7.3 and 7.5; PRD reqs 6, 66-67).
//
// visibleArea(viewportWidth, viewportHeight, visibleHeight): how much of the
// world a viewport of that pixel size shows. The visible height in tiles is
// fixed (display.json), so the scale is pixels per tile, the same both ways
// (never stretched), and a wider viewport shows more of the world sideways.
//
// cameraFor(level, target, area): the world position of the view's top-left
// corner. The camera centres on the target (the player) and stays inside the
// level; if the view is wider (or taller) than the level, the level is centred
// instead, and the space beside it is filled with the background colour.
// Decided: a viewport with no height (a minimised window) shows nothing: scale and width 0.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { visibleArea, cameraFor } from '../../src/simulation/camera.js';

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

describe('visible area (7.3, req 6)', () => {
  const VISIBLE_HEIGHT = 12;

  const cases = [
    { name: 'a 16:9 window', width: 1920, height: 1080 },
    { name: 'a 4:3 window', width: 1024, height: 768 },
    { name: 'a tall, narrow window', width: 400, height: 1000 },
    { name: 'a very wide window', width: 3440, height: 600 },
    { name: 'a small window', width: 320, height: 240 },
  ];
  for (const { name, width, height } of cases) {
    test(`${name} (${width} × ${height}): the visible height is fixed, the width follows the shape`, () => {
      const area = visibleArea(width, height, VISIBLE_HEIGHT);
      assertNear(area.height, VISIBLE_HEIGHT, 'height in tiles');
      assertNear(area.scale, height / VISIBLE_HEIGHT, 'pixels per tile');
      assertNear(area.width, width / area.scale, 'width in tiles');
      assertNear(area.width / area.height, width / height, 'the same shape as the window: never stretched');
    });
  }

  test('a wider window of the same height shows more of the world sideways, at the same scale', () => {
    const narrow = visibleArea(800, 600, VISIBLE_HEIGHT);
    const wide = visibleArea(1600, 600, VISIBLE_HEIGHT);
    assert.equal(wide.scale, narrow.scale);
    assert.ok(wide.width > narrow.width);
  });

  test('a taller window of the same shape shows the same area, bigger', () => {
    const small = visibleArea(800, 600, VISIBLE_HEIGHT);
    const big = visibleArea(1600, 1200, VISIBLE_HEIGHT);
    assertNear(big.width, small.width, 'width in tiles');
    assert.ok(big.scale > small.scale);
  });

  test('a viewport with no height shows nothing', () => {
    assert.deepEqual(visibleArea(800, 0, VISIBLE_HEIGHT), { scale: 0, width: 0, height: VISIBLE_HEIGHT });
  });
});

describe('follow (7.5, reqs 66-67)', () => {
  const LEVEL = { width: 100, height: 30 };
  const AREA = { width: 20, height: 12 };
  const box = (x, y) => ({ x, y, width: 1, height: 2 });

  test('in the middle of the level, the camera centres on the target', () => {
    const target = box(50, 15);
    const camera = cameraFor(LEVEL, target, AREA);
    assertNear(camera.x, target.x + target.width / 2 - AREA.width / 2, 'x');
    assertNear(camera.y, target.y + target.height / 2 - AREA.height / 2, 'y');
  });

  test('near the left edge, it stops at the level\'s left edge', () => {
    assert.equal(cameraFor(LEVEL, box(2, 15), AREA).x, 0);
  });

  test('near the right edge, it stops at the level\'s right edge', () => {
    assert.equal(cameraFor(LEVEL, box(99, 15), AREA).x, LEVEL.width - AREA.width);
  });

  test('near the top and bottom, it stops at the level\'s top and bottom', () => {
    assert.equal(cameraFor(LEVEL, box(50, 0), AREA).y, 0);
    assert.equal(cameraFor(LEVEL, box(50, 29), AREA).y, LEVEL.height - AREA.height);
  });

  test('a target above the top of the level (jumping above it) doesn\'t take the camera outside it', () => {
    assert.equal(cameraFor(LEVEL, box(50, -5), AREA).y, 0);
  });

  test('a level narrower than the view is centred sideways, whatever the target does', () => {
    const narrow = { width: 10, height: 30 };
    const expected = (narrow.width - AREA.width) / 2;   // negative: space on both sides
    assert.equal(cameraFor(narrow, box(1, 15), AREA).x, expected);
    assert.equal(cameraFor(narrow, box(9, 15), AREA).x, expected);
  });

  test('a level shorter than the view is centred up and down, and the camera only follows sideways', () => {
    const short = { width: 100, height: 8 };
    const camera = cameraFor(short, box(50, 4), AREA);
    assert.equal(camera.y, (short.height - AREA.height) / 2);
    assertNear(camera.x, 50 + 0.5 - AREA.width / 2, 'x still follows');
  });

  test('a level exactly as wide as the view starts at 0', () => {
    assert.equal(cameraFor({ width: AREA.width, height: 30 }, box(3, 15), AREA).x, 0);
  });
});
