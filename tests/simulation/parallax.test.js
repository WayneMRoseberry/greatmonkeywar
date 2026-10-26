// Tests for parallax background layers (task 7.6; PRD reqs 68, 70).
//
// Each layer has a scroll factor: 0 never moves, 1 moves with the level, and
// values between scroll partly, which gives depth. Positions here are in
// tiles, relative to the view's left edge.
// Decided:
//  - a layer's image is scaled to the view's height, keeping its proportions,
//    and doesn't move up or down (layerSize);
//  - a layer that repeats is drawn as side-by-side copies covering the whole
//    view; one that doesn't is drawn once, starting where the level starts.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { layerOffset, layerSize, layerCopies } from '../../src/simulation/parallax.js';

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

describe('scroll factor (req 68)', () => {
  test('a layer moves by the camera\'s movement times its scroll factor', () => {
    assert.equal(layerOffset(40, 0), 0, 'factor 0: never moves');
    assert.equal(layerOffset(40, 1), 40, 'factor 1: moves with the level');
    assert.equal(layerOffset(40, 0.25), 10, 'in between: moves partly');
  });
});

describe('layer size', () => {
  test('the image is scaled to the view\'s height, keeping its proportions', () => {
    const viewHeight = 12;
    const size = layerSize(800, 400, viewHeight);
    assert.equal(size.height, viewHeight);
    assertNear(size.width, viewHeight * (800 / 400), 'width');
  });
});

describe('copies (req 70)', () => {
  const IMAGE_WIDTH = 10;
  const VIEW_WIDTH = 25;

  test('a layer that doesn\'t repeat is drawn once, moved by its offset', () => {
    const copies = layerCopies({ cameraX: 8, scrollFactor: 0.5, imageWidth: IMAGE_WIDTH, viewWidth: VIEW_WIDTH, repeat: false });
    assert.deepEqual(copies, [-4]);
  });

  test('a repeating layer\'s copies cover the whole view, side by side', () => {
    const copies = layerCopies({ cameraX: 0, scrollFactor: 1, imageWidth: IMAGE_WIDTH, viewWidth: VIEW_WIDTH, repeat: true });
    assert.deepEqual(copies, [0, 10, 20]);
  });

  test('when scrolled, the first copy starts at or left of the view\'s edge, and the last reaches past its right edge', () => {
    for (const cameraX of [0, 3, 10, 37.5, 123.25]) {
      for (const scrollFactor of [0, 0.3, 1]) {
        const copies = layerCopies({ cameraX, scrollFactor, imageWidth: IMAGE_WIDTH, viewWidth: VIEW_WIDTH, repeat: true });
        assert.ok(copies[0] <= 1e-9 && copies[0] > -IMAGE_WIDTH - 1e-9, `first copy at ${copies[0]} (camera ${cameraX}, factor ${scrollFactor})`);
        assert.ok(copies.at(-1) + IMAGE_WIDTH >= VIEW_WIDTH - 1e-9, `last copy ends at ${copies.at(-1) + IMAGE_WIDTH}`);
        copies.slice(1).forEach((x, i) => assertNear(x - copies[i], IMAGE_WIDTH, 'copies side by side'));
      }
    }
  });

  test('the copies follow the layer\'s offset: they line up with it, modulo the image width', () => {
    const cameraX = 37;
    const scrollFactor = 0.5;
    const [first] = layerCopies({ cameraX, scrollFactor, imageWidth: IMAGE_WIDTH, viewWidth: VIEW_WIDTH, repeat: true });
    const shift = layerOffset(cameraX, scrollFactor);
    assertNear(((first + shift) % IMAGE_WIDTH + IMAGE_WIDTH) % IMAGE_WIDTH, 0, 'aligned with the layer');
  });

  test('a camera left of the level (a level narrower than the view) moves the layer right', () => {
    const copies = layerCopies({ cameraX: -6, scrollFactor: 1, imageWidth: IMAGE_WIDTH, viewWidth: VIEW_WIDTH, repeat: false });
    assert.deepEqual(copies, [6]);
  });

  test('an image with no width has no copies', () => {
    assert.deepEqual(layerCopies({ cameraX: 0, scrollFactor: 1, imageWidth: 0, viewWidth: VIEW_WIDTH, repeat: true }), []);
  });
});
