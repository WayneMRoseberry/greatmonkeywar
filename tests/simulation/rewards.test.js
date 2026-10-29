// Tests for rewards (task 4.9; PRD reqs 42-43, and 27 for restarting).
//
// Grids use the standard legend (level-builder.js): b is a reward worth 1.
// The player is 1 × 1 tile, so a player and a reward in neighbouring cells
// share an edge.
//
// Decided:
//  - a reward's box is its whole grid cell, 1 × 1 tile;
//  - the player collects a reward by overlapping it (sharing an edge isn't enough);
//  - only the player collects rewards: objects pass through them;
//  - a reward with no value in its legend entry is worth 1 (docs/data-formats.md).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player } from '../../src/simulation/player.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { FIXED_DT, STEPS_PER_SECOND, SoundEvent } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const ONE_TILE = { width: 1, height: 1 };

function stateFor(grid, legend = {}) {
  return createLevelState(buildData(grid, { player: { size: ONE_TILE }, legend }), TEST_LEVEL);
}

/** Steps with `input` until `done(state)` is true, and returns that state; fails after `maxSteps`. */
function stepUntil(state, input, done, maxSteps = 10 * STEPS_PER_SECOND) {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    current = step(current, input, FIXED_DT);
    if (done(current)) return current;
  }
  assert.fail(`not done after ${maxSteps} steps`);
}

describe('rewards in the initial state (req 42)', () => {
  test('each reward placement becomes a reward filling its cell, with the value and colour from the legend', () => {
    const value = 5;
    const color = '#00ff00';
    const column = 2;
    const row = 0;
    const { rewards } = stateFor(['P.$.G', '#####'], { $: { reward: { value, color } } });
    assert.deepEqual(rewards, [{ x: column, y: row, width: 1, height: 1, value, color }]);
  });

  test('a reward with no value in the legend is worth 1', () => {
    const { rewards } = stateFor(['P.$.G', '#####'], { $: { reward: { color: '#00ff00' } } });
    assert.equal(rewards[0].value, 1);
  });

  test('rewards are listed in grid order: rows top to bottom, then left to right', () => {
    const { rewards } = stateFor(['..b.b', 'Pb..G', '#####']);
    assert.deepEqual(rewards.map(({ x, y }) => ({ x, y })), [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }]);
  });

  test('a level with no rewards has an empty list', () => {
    assert.deepEqual(stateFor(['P..G', '####']).rewards, []);
  });

  test('the level-start snapshot has the rewards, as a separate copy', () => {
    const state = stateFor(['P.b.G', '#####']);
    assert.deepEqual(state.levelStart.rewards, state.rewards);
    assert.notEqual(state.levelStart.rewards, state.rewards);
  });
});

describe('collecting rewards (req 43)', () => {
  test('a player overlapping a reward collects it: it disappears and the count goes up by its value', () => {
    const value = 3;
    const state = stateFor(['.....', '.P..G', '#####'], { $: { reward: { value, color: '#00ff00' } } });
    const reward = { x: state.player.x, y: state.player.y, width: 1, height: 1, value, color: '#00ff00' };
    const after = step({ ...state, rewards: [reward] }, NO_INPUT, FIXED_DT);
    assert.deepEqual(after.rewards, []);
    assert.equal(after.rewardCount, state.rewardCount + value);
  });

  test('walking into a reward collects it', () => {
    const state = stateFor(['P..b..G', '#######']);
    const [reward] = state.rewards;
    const after = stepUntil(state, holding(Input.RIGHT), (s) => s.rewards.length === 0);
    assert.equal(after.rewardCount, state.rewardCount + reward.value);
  });

  test('standing flush beside a reward, sharing an edge, doesn\'t collect it', () => {
    const state = stateFor(['.Pb.G', '#####']);
    let current = state;
    for (let i = 0; i < STEPS_PER_SECOND; i++) current = step(current, NO_INPUT, FIXED_DT);
    assert.deepEqual(current.rewards, state.rewards);
    assert.equal(current.rewardCount, state.rewardCount);
  });

  test('several rewards touched in the same step are all collected, and their values added up', () => {
    const values = [2, 7];
    const state = stateFor(['.....', '.P..G', '#####']);
    const { player } = state;
    const rewards = values.map((value, i) => ({ x: player.x + i * 0.5, y: player.y, width: 1, height: 1, value, color: '#00ff00' }));
    const after = step({ ...state, rewards }, NO_INPUT, FIXED_DT);
    assert.deepEqual(after.rewards, []);
    assert.equal(after.rewardCount, state.rewardCount + values[0] + values[1]);
  });

  test('a collected reward stays gone and is counted only once', () => {
    const state = stateFor(['P..b..G', '#######']);
    const [reward] = state.rewards;
    let current = stepUntil(state, holding(Input.RIGHT), (s) => s.rewards.length === 0);
    for (let i = 0; i < STEPS_PER_SECOND; i++) current = step(current, holding(Input.LEFT), FIXED_DT);
    assert.deepEqual(current.rewards, []);
    assert.equal(current.rewardCount, state.rewardCount + reward.value);
  });

  test('only the player collects rewards: a crate falling through a reward leaves it', () => {
    const state = stateFor(['..c..', '..b..', 'P...G', '#####']);
    const landed = stepUntil(state, NO_INPUT, (s) => s.objects[0].resting);
    assert.deepEqual(landed.rewards, state.rewards);
    assert.equal(landed.rewardCount, state.rewardCount);
  });

  test('a held object overlapping a reward doesn\'t collect it', () => {
    const state = stateFor(['..b..', '..P.G', '#####']);
    const { player } = state;
    const held = new CarriableObject({ type: 'crate', ...ONE_TILE, x: player.x, y: player.y - 1, held: true });
    const after = step({ ...state, objects: [held] }, NO_INPUT, FIXED_DT);
    assert.deepEqual(after.rewards, state.rewards);
  });

  test('collecting doesn\'t change the state passed in', () => {
    const state = stateFor(['P..b..G', '#######']);
    const before = structuredClone(state.rewards);
    stepUntil(state, holding(Input.RIGHT), (s) => s.rewards.length === 0);
    assert.deepEqual(state.rewards, before);
  });
});

describe('restarting the level brings the rewards back (req 27)', () => {
  test('after collecting a reward and restarting, the reward is back and the count is as at the start', () => {
    const state = stateFor(['P..b..G', '#######']);
    const collected = stepUntil(state, holding(Input.RIGHT), (s) => s.rewards.length === 0);
    const lastLife = { ...collected, player: new Player({ ...collected.player, health: 0 }) };
    const restarted = step(lastLife, NO_INPUT, FIXED_DT);
    assert.deepEqual(restarted.rewards, state.levelStart.rewards);
    assert.equal(restarted.rewardCount, state.levelStart.rewardCount);
  });

  test('the restored rewards are a separate copy of the snapshot', () => {
    const state = stateFor(['P..b..G', '#######']);
    const restarted = step({ ...state, player: new Player({ ...state.player, health: 0 }) }, NO_INPUT, FIXED_DT);
    assert.notEqual(restarted.rewards, restarted.levelStart.rewards);
  });
});

describe('sound events (sound PRD req 14)', () => {
  test('collectReward: on the step a reward is collected, once', () => {
    const state = stateFor(['P.b.G', '#####']);
    const collected = stepUntil(state, holding(Input.RIGHT), (s) => s.rewardCount > state.rewardCount);
    assert.deepEqual(collected.events, [SoundEvent.COLLECT_REWARD]);
    assert.deepEqual(step(collected, holding(Input.RIGHT), FIXED_DT).events, []);
  });

  test('two rewards collected in the same step: one collectReward each', () => {
    const state = stateFor(['P...G', '#####']);
    const { x, y } = state.player;
    const twoHere = { ...state, rewards: [{ x, y, ...ONE_TILE, value: 1 }, { x, y, ...ONE_TILE, value: 1 }] };
    assert.deepEqual(step(twoHere, NO_INPUT, FIXED_DT).events, [SoundEvent.COLLECT_REWARD, SoundEvent.COLLECT_REWARD]);
  });
});
