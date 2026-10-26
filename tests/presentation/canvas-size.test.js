// Tests for sizing the canvas (task 7.4; PRD req 6).
//
// The canvas always fills the window, sized in device pixels so it stays
// sharp on high-density screens: its pixel size is the window's size times the
// device pixel ratio, rounded. It is resized when the window is resized and
// when fullscreen is switched on or off. The window and document are passed
// in, so tests use fakes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canvasPixelSize, fitCanvas, watchCanvasSize } from '../../src/presentation/canvas-size.js';
import { createFakeCanvas } from '../helpers/fake-canvas.js';

/** A fake window or document that records its event listeners and can fire events. */
function fakeEventTarget(fields = {}) {
  const listeners = {};
  return {
    ...fields,
    listeners,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn); },
    fire(type) { for (const fn of listeners[type] ?? []) fn({ type }); },
  };
}

describe('canvas pixel size (req 6)', () => {
  test('the window\'s size times the device pixel ratio', () => {
    assert.deepEqual(canvasPixelSize(800, 600, 2), { width: 1600, height: 1200 });
  });

  test('rounded to whole pixels', () => {
    assert.deepEqual(canvasPixelSize(801, 601, 1.25), { width: Math.round(801 * 1.25), height: Math.round(601 * 1.25) });
  });

  test('a missing device pixel ratio counts as 1', () => {
    assert.deepEqual(canvasPixelSize(800, 600, undefined), { width: 800, height: 600 });
  });
});

describe('fitting the canvas to the window', () => {
  test('sets the canvas\'s pixel size from the window and returns it', () => {
    const canvas = createFakeCanvas(1, 1);
    const win = fakeEventTarget({ innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1.5 });
    const size = fitCanvas(canvas, win);
    assert.deepEqual(size, canvasPixelSize(1024, 768, 1.5));
    assert.deepEqual({ width: canvas.width, height: canvas.height }, size);
  });

  test('when the window is resized, the canvas is resized and onResize is told the new size', () => {
    const canvas = createFakeCanvas(1, 1);
    const win = fakeEventTarget({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    const doc = fakeEventTarget();
    const sizes = [];
    watchCanvasSize(canvas, win, doc, (size) => sizes.push(size));
    win.innerWidth = 1280;
    win.innerHeight = 720;
    win.fire('resize');
    assert.deepEqual({ width: canvas.width, height: canvas.height }, { width: 1280, height: 720 });
    assert.deepEqual(sizes.at(-1), { width: 1280, height: 720 });
  });

  test('watching fits the canvas at once', () => {
    const canvas = createFakeCanvas(1, 1);
    const win = fakeEventTarget({ innerWidth: 640, innerHeight: 480, devicePixelRatio: 1 });
    watchCanvasSize(canvas, win, fakeEventTarget(), () => {});
    assert.equal(canvas.width, 640);
  });

  test('switching fullscreen on or off resizes the canvas too', () => {
    const canvas = createFakeCanvas(1, 1);
    const win = fakeEventTarget({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    const doc = fakeEventTarget();
    watchCanvasSize(canvas, win, doc, () => {});
    win.innerWidth = 1920;
    win.innerHeight = 1080;
    doc.fire('fullscreenchange');
    assert.equal(canvas.width, 1920);
  });

  test('the returned function stops watching', () => {
    const canvas = createFakeCanvas(1, 1);
    const win = fakeEventTarget({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });
    const doc = fakeEventTarget();
    const stop = watchCanvasSize(canvas, win, doc, () => {});
    stop();
    win.innerWidth = 100;
    win.fire('resize');
    doc.fire('fullscreenchange');
    assert.equal(canvas.width, 800);
  });
});
