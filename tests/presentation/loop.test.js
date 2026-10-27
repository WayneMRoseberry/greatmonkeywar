// Tests for the game loop (task 7.2; PRD reqs 4-5).
//
// createLoop({ update, draw, now, schedule, fixedDt, maxFrameSeconds }) runs
// the game: each frame it runs as many fixed steps (update(fixedDt)) as the
// time since the last frame allows, carries the leftover time to the next
// frame, then draws once. now() is the clock in milliseconds, and schedule(fn)
// asks for fn to run on the next frame (requestAnimationFrame in the browser);
// both are passed in so tests control time.
// Decided: after a long pause (a frame more than maxFrameSeconds after the
// last, default 0.25 s), only maxFrameSeconds of steps are run and the rest of
// the time is dropped, so the game doesn't race to catch up.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLoop, MAX_FRAME_SECONDS } from '../../src/presentation/loop.js';
import { FIXED_DT, STEPS_PER_SECOND } from '../../src/simulation/constants.js';

/** A loop with a fake clock and scheduler; `advance(ms)` moves the clock and runs the scheduled frame. */
function fakeLoop(options = {}) {
  let time = 1000;
  let scheduled = null;
  const updates = [];
  let draws = 0;
  const loop = createLoop({
    update: (dt) => updates.push(dt),
    draw: () => { draws++; },
    now: () => time,
    schedule: (fn) => { scheduled = fn; },
    ...options,
  });
  return {
    loop,
    updates,
    draws: () => draws,
    scheduled: () => scheduled,
    advance(ms) {
      time += ms;
      const fn = scheduled;
      scheduled = null;
      fn();
    },
  };
}

const STEP_MS = 1000 / STEPS_PER_SECOND;

describe('the game loop (reqs 4-5)', () => {
  test('starting it asks for a frame, without stepping or drawing yet', () => {
    const fake = fakeLoop();
    fake.loop.start();
    assert.equal(typeof fake.scheduled(), 'function');
    assert.deepEqual(fake.updates, []);
    assert.equal(fake.draws(), 0);
  });

  test('a frame one step\'s time later runs one fixed step and draws once', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(STEP_MS);
    assert.deepEqual(fake.updates, [FIXED_DT]);
    assert.equal(fake.draws(), 1);
  });

  test('each frame asks for the next one', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(STEP_MS);
    assert.equal(typeof fake.scheduled(), 'function');
  });

  test('a frame two and a half steps later runs two steps, and the leftover half carries to the next frame', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(2.5 * STEP_MS);
    assert.equal(fake.updates.length, 2);
    fake.advance(0.5 * STEP_MS);
    assert.equal(fake.updates.length, 3, 'the leftover half and this half make one more step');
  });

  test('a frame with no time passed runs no steps but still draws', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(0);
    assert.deepEqual(fake.updates, []);
    assert.equal(fake.draws(), 1);
  });

  test('one second of frames at 60 per second runs exactly 60 steps', () => {
    const fake = fakeLoop();
    fake.loop.start();
    for (let i = 0; i < STEPS_PER_SECOND; i++) fake.advance(STEP_MS);
    assert.equal(fake.updates.length, STEPS_PER_SECOND);
    assert.equal(fake.draws(), STEPS_PER_SECOND);
  });

  test('frames at 30 per second run two steps each', () => {
    const fake = fakeLoop();
    fake.loop.start();
    for (let i = 0; i < 30; i++) fake.advance(2 * STEP_MS);
    assert.equal(fake.updates.length, STEPS_PER_SECOND);
  });

  test('after a long pause only maxFrameSeconds of steps are run, and the rest is dropped', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(5000);
    assert.equal(fake.updates.length, Math.round(MAX_FRAME_SECONDS * STEPS_PER_SECOND));
    fake.advance(STEP_MS);
    assert.equal(fake.updates.length, Math.round(MAX_FRAME_SECONDS * STEPS_PER_SECOND) + 1, 'no catching up afterwards');
  });

  test('maxFrameSeconds and fixedDt can be set', () => {
    const fixedDt = 0.1;
    const fake = fakeLoop({ fixedDt, maxFrameSeconds: 0.5 });
    fake.loop.start();
    fake.advance(2000);
    assert.equal(fake.updates.length, 5);
    assert.ok(fake.updates.every((dt) => dt === fixedDt));
  });

  test('stopping it stops asking for frames', () => {
    const fake = fakeLoop();
    fake.loop.start();
    fake.advance(STEP_MS);
    fake.loop.stop();
    const next = fake.scheduled();
    next?.();
    assert.equal(fake.draws(), 1, 'a frame already asked for does nothing after stop');
  });
});
