// The game loop (PRD reqs 4-5): fixed simulation steps, one draw per frame.
//
// The clock and the frame scheduler are passed in, so tests control time; in
// the browser they are performance.now and requestAnimationFrame.

import { FIXED_DT } from '../simulation/constants.js';

/**
 * The most time one frame may cover, in seconds. After a longer pause (the
 * window was hidden, the debugger stopped the page), only this much is
 * stepped and the rest is dropped, so the game doesn't race to catch up.
 */
export const MAX_FRAME_SECONDS = 0.25;

// Allowance for rounding error when deciding whether a whole step's time has built up.
const EPS = 1e-9;

/**
 * A loop that, each frame, runs update(fixedDt) as many times as the time
 * since the last frame allows, carries any leftover time to the next frame,
 * and then calls draw() once.
 *  - now(): the clock, in milliseconds;
 *  - schedule(fn): runs fn on the next frame;
 *  - fixedDt: the step length in seconds (FIXED_DT);
 *  - maxFrameSeconds: the most time one frame may cover (MAX_FRAME_SECONDS).
 */
export function createLoop({ update, draw, now, schedule, fixedDt = FIXED_DT, maxFrameSeconds = MAX_FRAME_SECONDS }) {
  let running = false;
  let last = 0;
  let leftover = 0;

  function frame() {
    if (!running) return;
    const time = now();
    leftover += Math.min((time - last) / 1000, maxFrameSeconds);
    last = time;
    while (leftover >= fixedDt - EPS) {
      update(fixedDt);
      leftover -= fixedDt;
    }
    leftover = Math.max(0, leftover);
    draw();
    schedule(frame);
  }

  return {
    start() {
      running = true;
      last = now();
      leftover = 0;
      schedule(frame);
    },
    stop() {
      running = false;
    },
  };
}
