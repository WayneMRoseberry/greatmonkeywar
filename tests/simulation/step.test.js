// Tests for step(state, input, dt), the single simulation update (task 3.4; PRD reqs 5, 72).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player } from '../../src/simulation/player.js';
import { FIXED_DT, STEPS_PER_SECOND } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { runSteps } from '../helpers/run.js';
import { Input, NO_INPUT, createInput, holding } from '../../src/simulation/input.js';
import { deepFreeze } from '../../src/data/load.js';

const GRID = [
  '........',
  '.P....G.',
  '########',
];

function newState() {
  return createLevelState(buildData(GRID), TEST_LEVEL);
}

/** Everything in a state except the shared, read-only loaded data. */
function withoutData({ data, ...rest }) {
  return rest;
}

describe('fixed time step', () => {
  test('there are 60 steps per second (req 4: 60 frames per second)', () => {
    assert.equal(STEPS_PER_SECOND, 60);
    assert.equal(FIXED_DT, 1 / STEPS_PER_SECOND);
  });
});

describe('step', () => {
  test('returns a new state object', () => {
    const state = newState();
    assert.notEqual(step(state, NO_INPUT, FIXED_DT), state);
  });

  test('does not change the state passed in', () => {
    const state = newState();
    // Compare plain copies of the values (structuredClone of both sides), before and after.
    const before = structuredClone(withoutData(state));
    step(state, holding(Input.RIGHT, Input.JUMP), FIXED_DT);
    assert.deepEqual(structuredClone(withoutData(state)), before);
  });

  test('does not change the input passed in', () => {
    const held = holding(Input.LEFT, Input.ACTION);
    const before = { ...held };
    step(newState(), held, FIXED_DT);
    assert.deepEqual(held, before);
  });

  test('the new state shares nothing changeable with the old one', () => {
    const state = newState();
    const next = step(state, NO_INPUT, FIXED_DT);
    const healthBefore = state.player.health;
    next.player.health = healthBefore + 5;
    next.levelStart.rewardCount = 99;
    assert.equal(state.player.health, healthBefore);
    assert.equal(state.levelStart.rewardCount, 0);
  });

  test('works with frozen (read-only) data, as the game loads it, so any attempt to change data fails loudly', () => {
    // The loader freezes game data (src/data/load.js). Running here on frozen data
    // means simulation code that tried to change the data would throw in this test.
    const data = deepFreeze(buildData(GRID));
    const state = createLevelState(data, TEST_LEVEL);
    const script = (i) => createInput({ [Input.RIGHT]: i % 2 === 0, [Input.LEFT]: i % 3 === 0, [Input.JUMP]: i % 5 === 0 });
    assert.doesNotThrow(() => runSteps(step, state, script, STEPS_PER_SECOND, FIXED_DT));
  });

  test('the player stays a Player, with its structure locked, after any number of steps', () => {
    const script = (i) => createInput({ [Input.RIGHT]: i % 40 < 25, [Input.JUMP]: i % 30 === 0 });
    const after = runSteps(step, newState(), script, 2 * STEPS_PER_SECOND, FIXED_DT);
    assert.ok(after.player instanceof Player);
    assert.ok(Object.isSealed(after.player));
    assert.ok(after.levelStart.player instanceof Player);
  });

  test('keeps the loaded data by reference', () => {
    const state = newState();
    assert.equal(step(state, NO_INPUT, FIXED_DT).data, state.data);
  });

  test('advances time by dt', () => {
    const state = newState();
    const dt = 0.25;
    assert.equal(step(state, NO_INPUT, dt).time, state.time + dt);
  });

  test('one second of fixed steps advances time by one second', () => {
    const after = runSteps(step, newState(), NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
    assert.ok(Math.abs(after.time - 1) < 1e-9, `time was ${after.time}`);
  });

  test('the same starting state and inputs always give the same result (determinism)', () => {
    // A scripted mix of inputs over two seconds.
    const script = (i) => createInput({ [Input.RIGHT]: i % 40 < 25, [Input.LEFT]: i % 90 > 70, [Input.JUMP]: i % 30 === 0, [Input.ACTION]: i === 50 });
    const count = 2 * STEPS_PER_SECOND;
    const a = runSteps(step, newState(), script, count, FIXED_DT);
    const b = runSteps(step, newState(), script, count, FIXED_DT);
    assert.deepEqual(withoutData(a), withoutData(b));
  });
});
