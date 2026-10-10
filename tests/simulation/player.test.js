// Tests for the player: movement, jumping, collision, health (tasks 3.6-3.11).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { runSteps } from '../helpers/run.js';
import { Input, NO_INPUT, createInput, holding } from '../../src/simulation/input.js';

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
    const after = runSteps(step, start, holding(Input.RIGHT), seconds * STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x + SPEED * seconds, 'x');
    assert.equal(after.player.vx, SPEED);
  });

  test('holding left moves left at the speed from the player definition', () => {
    const start = newState();
    const seconds = 1;
    const after = runSteps(step, start, holding(Input.LEFT), seconds * STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x - SPEED * seconds, 'x');
    assert.equal(after.player.vx, -SPEED);
  });

  test('a different speed in the player definition gives a different distance', () => {
    const slowSpeed = 2;
    const start = newState(slowSpeed);
    const after = runSteps(step, start, holding(Input.RIGHT), STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x + slowSpeed, 'x');
  });

  test('with no direction held, the player stays still', () => {
    const start = newState();
    const after = runSteps(step, start, NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x, 'x');
    assert.equal(after.player.vx, 0);
  });

  test('letting go stops the player at once', () => {
    const running = runSteps(step, newState(), holding(Input.RIGHT), STEPS_PER_SECOND / 2, FIXED_DT);
    const stopped = step(running, NO_INPUT, FIXED_DT);
    assertNear(stopped.player.x, running.player.x, 'x');
    assert.equal(stopped.player.vx, 0);
  });

  test('holding left and right together cancels out', () => {
    const start = newState();
    const after = runSteps(step, start, holding(Input.LEFT, Input.RIGHT), STEPS_PER_SECOND, FIXED_DT);
    assertNear(after.player.x, start.player.x, 'x');
    assert.equal(after.player.vx, 0);
  });

  test('one step moves speed × dt', () => {
    const start = newState();
    const after = step(start, holding(Input.RIGHT), FIXED_DT);
    assertNear(after.player.x, start.player.x + SPEED * FIXED_DT, 'x');
  });
});

describe('facing', () => {
  // Facing follows the direction the player is trying to run (the held input),
  // and stays the same when neither or both directions are held. It's used to
  // aim throws and punches.
  const GRID = [
    '..............',
    '......P......G',
    '##############',
  ];

  /** The player's facing after each step of `inputs`, starting from a new level. */
  function facingAfterEach(...inputs) {
    let state = createLevelState(buildData(GRID), TEST_LEVEL);
    return inputs.map((held) => {
      state = step(state, held, FIXED_DT);
      return state.player.facing;
    });
  }

  const LEFT = holding(Input.LEFT);
  const RIGHT = holding(Input.RIGHT);
  const BOTH = holding(Input.LEFT, Input.RIGHT);

  test('holding left faces left; holding right faces right', () => {
    assert.deepEqual(facingAfterEach(LEFT, RIGHT, LEFT), [Facing.LEFT, Facing.RIGHT, Facing.LEFT]);
  });

  test('turns on the first step a direction is held', () => {
    assert.deepEqual(facingAfterEach(RIGHT, LEFT), [Facing.RIGHT, Facing.LEFT]);
  });

  test('keeps facing the same way after letting go', () => {
    assert.deepEqual(facingAfterEach(LEFT, NO_INPUT, NO_INPUT), [Facing.LEFT, Facing.LEFT, Facing.LEFT]);
  });

  test('keeps facing the same way while both directions are held', () => {
    assert.deepEqual(facingAfterEach(LEFT, BOTH, BOTH), [Facing.LEFT, Facing.LEFT, Facing.LEFT]);
    assert.deepEqual(facingAfterEach(RIGHT, BOTH), [Facing.RIGHT, Facing.RIGHT]);
  });

  test('other inputs don\'t change facing', () => {
    const others = holding(Input.UP, Input.DOWN, Input.JUMP, Input.ACTION, Input.PUNCH, Input.CONFIRM);
    assert.deepEqual(facingAfterEach(LEFT, others), [Facing.LEFT, Facing.LEFT]);
  });

  test('with nothing held from the start, keeps the starting facing', () => {
    const startFacing = createLevelState(buildData(GRID), TEST_LEVEL).player.facing;
    assert.deepEqual(facingAfterEach(NO_INPUT, NO_INPUT), [startFacing, startFacing]);
  });
});
