// Tests for the recording fake canvas context (task 7.1).
//
// createFakeContext() stands in for a CanvasRenderingContext2D in tests of
// drawing code. Each drawing call is recorded as { op, args, style }, where
// style is a copy of the drawing state when the call was made. save() and
// restore() push and pop that state, as on a real canvas.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext, createFakeCanvas } from './fake-canvas.js';

describe('recording draw calls', () => {
  test('each drawing call is recorded with its arguments, in order', () => {
    const ctx = createFakeContext();
    ctx.fillRect(1, 2, 3, 4);
    ctx.strokeRect(5, 6, 7, 8);
    ctx.fillText('hello', 9, 10);
    ctx.clearRect(0, 0, 11, 12);
    assert.deepEqual(ctx.calls.map(({ op, args }) => ({ op, args })), [
      { op: 'fillRect', args: [1, 2, 3, 4] },
      { op: 'strokeRect', args: [5, 6, 7, 8] },
      { op: 'fillText', args: ['hello', 9, 10] },
      { op: 'clearRect', args: [0, 0, 11, 12] },
    ]);
  });

  test('drawImage records the image and every position argument', () => {
    const ctx = createFakeContext();
    const image = { name: 'sheet' };
    ctx.drawImage(image, 1, 2, 3, 4, 5, 6, 7, 8);
    assert.deepEqual(ctx.calls[0], { op: 'drawImage', args: [image, 1, 2, 3, 4, 5, 6, 7, 8], style: ctx.calls[0].style });
  });

  test('each call carries the style in use when it was made', () => {
    const ctx = createFakeContext();
    ctx.fillStyle = '#ff0000';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#00ff00';
    ctx.font = '20px sans-serif';
    ctx.fillText('x', 0, 0);
    assert.equal(ctx.calls[0].style.fillStyle, '#ff0000');
    assert.equal(ctx.calls[0].style.globalAlpha, 0.5);
    assert.equal(ctx.calls[1].style.fillStyle, '#00ff00');
    assert.equal(ctx.calls[1].style.font, '20px sans-serif');
  });

  test('the style starts at the canvas defaults', () => {
    const { style } = (() => { const ctx = createFakeContext(); ctx.fillRect(0, 0, 1, 1); return ctx.calls[0]; })();
    assert.deepEqual(style, {
      fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1, lineWidth: 1, font: '10px sans-serif',
      textAlign: 'start', textBaseline: 'alphabetic', transform: [1, 0, 0, 1, 0, 0],
    });
  });

  test('changing the style later doesn\'t change what an earlier call recorded', () => {
    const ctx = createFakeContext();
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#0000ff';
    assert.equal(ctx.calls[0].style.fillStyle, '#ff0000');
  });
});

describe('save, restore, and transforms', () => {
  test('restore brings back the style saved by save', () => {
    const ctx = createFakeContext();
    ctx.fillStyle = '#ff0000';
    ctx.save();
    ctx.fillStyle = '#00ff00';
    ctx.restore();
    ctx.fillRect(0, 0, 1, 1);
    assert.equal(ctx.calls.at(-1).style.fillStyle, '#ff0000');
  });

  test('translate and scale build up the transform; restore undoes them', () => {
    const ctx = createFakeContext();
    ctx.save();
    ctx.translate(10, 20);
    ctx.scale(-1, 2);
    ctx.fillRect(0, 0, 1, 1);
    ctx.restore();
    ctx.fillRect(0, 0, 1, 1);
    assert.deepEqual(ctx.calls.find((c) => c.op === 'fillRect').style.transform, [-1, 0, 0, 2, 10, 20]);
    assert.deepEqual(ctx.calls.at(-1).style.transform, [1, 0, 0, 1, 0, 0]);
  });

  test('setTransform replaces the transform', () => {
    const ctx = createFakeContext();
    ctx.translate(5, 5);
    ctx.setTransform(2, 0, 0, 2, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    assert.deepEqual(ctx.calls.at(-1).style.transform, [2, 0, 0, 2, 1, 1]);
  });
});

describe('helpers for tests', () => {
  test('measureText gives a width that grows with the text and the font size', () => {
    const ctx = createFakeContext();
    ctx.font = '10px sans-serif';
    const short = ctx.measureText('ab').width;
    const long = ctx.measureText('abcd').width;
    ctx.font = '20px sans-serif';
    const big = ctx.measureText('ab').width;
    assert.ok(long > short);
    assert.ok(big > short);
  });

  test('callsOf(op) lists just the calls of one kind', () => {
    const ctx = createFakeContext();
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillText('a', 0, 0);
    ctx.fillRect(1, 1, 1, 1);
    assert.deepEqual(ctx.callsOf('fillRect').map((c) => c.args), [[0, 0, 1, 1], [1, 1, 1, 1]]);
  });

  test('texts() lists the text drawn, in order', () => {
    const ctx = createFakeContext();
    ctx.fillText('one', 0, 0);
    ctx.fillText('two', 0, 0);
    assert.deepEqual(ctx.texts(), ['one', 'two']);
  });

  test('a fake canvas has a size, a style, and gives its fake context', () => {
    const canvas = createFakeCanvas(300, 200);
    assert.equal(canvas.width, 300);
    assert.equal(canvas.height, 200);
    assert.deepEqual(canvas.style, {});
    const ctx = canvas.getContext('2d');
    assert.equal(canvas.getContext('2d'), ctx, 'the same context each time');
    assert.ok(Array.isArray(ctx.calls));
  });
});
