// Tests for the player: movement, jumping, collision, health (tasks 3.6-3.11).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { FIXED_DT, STEPS_PER_SECOND } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { input, NO_INPUT, runSteps } from '../helpers/run.js';

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

describe('running (req 20)', () => {
  // Open space around the start, so nothing gets in the way while running.
  const GRID = [
    '..............',
    '......P......G',
    '##############',
  ];
  const SPEED = 4.5;   // tiles per second, set in the player definition below

  function newState(speed = SPEED) {
    return createLevelState(buildData(GRID, { player: { speed } }), TEST_LEVEL);
  }

  test('holding right moves right at the speed from the player definition', () => {
    const start = newState();
    const seconds = 1;
    const after = runSteps(step, start, input({ right: true }), seconds * STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x + SPEED * seconds, 'x');
    assert.equal(after.player.vx, SPEED);
  });

  test('holding left moves left at the speed from the player definition', () => {
    const start = newState();
    const seconds = 1;
    const after = runSteps(step, start, input({ left: true }), seconds * STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x - SPEED * seconds, 'x');
    assert.equal(after.player.vx, -SPEED);
  });

  test('a different speed in the player definition gives a different distance', () => {
    const slowSpeed = 2;
    const start = newState(slowSpeed);
    const after = runSteps(step, start, input({ right: true }), STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x + slowSpeed, 'x');
  });

  test('with no direction held, the player stays still', () => {
    const start = newState();
    const after = runSteps(step, start, NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x, 'x');
    assert.equal(after.player.vx, 0);
  });

  test('letting go stops the player at once', () => {
    const running = runSteps(step, newState(), input({ right: true }), STEPS_PER_SECOND / 2, FIXED_DT);
    const stopped = step(running, NO_INPUT, FIXED_DT);
    assertNear(stopped.player.x, running.player.x, 'x');
    assert.equal(stopped.player.vx, 0);
  });

  test('holding left and right together cancels out', () => {
    const start = newState();
    const after = runSteps(step, start, input({ left: true, right: true }), STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x, 'x');
    assert.equal(after.player.vx, 0);
  });

  test('one step moves speed × dt', () => {
    const start = newState();
    const after = step(start, input({ right: true }), FIXED_DT);
    assertNear(after.player.x, start.player.x + SPEED * FIXED_DT, 'x');
  });
});
