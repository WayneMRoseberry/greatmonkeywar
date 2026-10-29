// Tests for step(state, input, dt), the single simulation update (task 3.4; PRD reqs 5, 72).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player, damagePlayer } from '../../src/simulation/player.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { Enemy } from '../../src/simulation/enemies.js';
import { FIXED_DT, STEPS_PER_SECOND, SoundEvent } from '../../src/simulation/constants.js';
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

describe('sound events (sound PRD req 14)', () => {
  test('each step starts with no events: the last step\'s events are not carried over', () => {
    const state = { ...newState(), events: [SoundEvent.JUMP] };
    assert.deepEqual(step(state, NO_INPUT, FIXED_DT).events, []);
  });

  describe('losing the last health: playerDefeated instead of playerHurt, and the events survive the restart', () => {
    const LAST_HEALTH = 1;
    /** Holds right from the start of `grid` until a step records events, and returns that step's events. */
    function firstEvents(grid) {
      let state = createLevelState(buildData(grid, { player: { health: LAST_HEALTH } }), TEST_LEVEL);
      for (let i = 0; i < 10 * STEPS_PER_SECOND && state.events.length === 0; i++) state = step(state, holding(Input.RIGHT), FIXED_DT);
      return state.events;
    }

    test('falling into a pit', () => {
      assert.deepEqual(firstEvents(['.....G', 'P.....', '##.###']), [SoundEvent.PLAYER_DEFEATED]);
    });

    test('touched by an enemy', () => {
      assert.deepEqual(firstEvents(['.....G', 'P..e..', '######']), [SoundEvent.PLAYER_DEFEATED]);
    });
  });

  test('a step doesn\'t change the events of the state passed in', () => {
    const state = newState();
    step(state, holding(Input.JUMP), FIXED_DT);
    assert.deepEqual(state.events, []);
  });
});

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

describe('restart when health reaches 0 (req 27)', () => {
  const START_HEALTH = 3;
  const SIZE = { width: 1, height: 1 };
  // P at column 2, above the gap in the bottom row: falling in costs 1 health.
  const PIT_GRID = ['....G', '..P..', '##.##'];
  // P on solid ground, for tests that damage the player directly.
  const GROUND_GRID = ['....G', '..P..', '#####'];

  function newState(grid) {
    return createLevelState(buildData(grid, { player: { size: SIZE, health: START_HEALTH } }), TEST_LEVEL);
  }

  /** The state with the player's properties and the reward count changed, as if partway through the level. */
  function partway(state, playerChanges, rewardCount) {
    return { ...state, player: new Player({ ...state.player, ...playerChanges }), rewardCount };
  }

  /** Steps with no input until the player's position jumps back to the start; returns that state. */
  function stepUntilBackAtStart(state) {
    let current = state;
    for (let i = 0; i < 10 * STEPS_PER_SECOND; i++) {
      current = step(current, NO_INPUT, FIXED_DT);
      if (current.player.y === state.start.y && current.player.vy === 0) return current;
    }
    assert.fail('the player never went back to the start');
  }

  test('falling into a pit with 1 health left restarts the level: health, position, and reward count as at the start', () => {
    const start = newState(PIT_GRID);
    const lastLife = partway(start, { health: 1 }, 5);
    const restarted = stepUntilBackAtStart(lastLife);
    assert.deepEqual({ ...restarted.player }, { ...start.levelStart.player });
    assert.equal(restarted.player.health, START_HEALTH);
    assert.equal(restarted.rewardCount, start.levelStart.rewardCount);
  });

  test('damage that brings health to 0 restarts the level on the next step', () => {
    const start = newState(GROUND_GRID);
    const state = partway(start, { health: 1 }, 2);
    const enemy = { x: state.player.x - 1, y: state.player.y, width: 1, height: 1 };
    damagePlayer(state, enemy);
    assert.equal(state.player.health, 0);

    const restarted = step(state, NO_INPUT, FIXED_DT);
    assert.deepEqual({ ...restarted.player }, { ...start.levelStart.player });
    assert.equal(restarted.rewardCount, start.levelStart.rewardCount);
  });

  test('a restart clears invincibility and knockback (as they were at the start)', () => {
    const start = newState(GROUND_GRID);
    const state = partway(start, { health: 0, invincibleTime: 0.5, knockedBack: true }, 0);
    const restarted = step(state, NO_INPUT, FIXED_DT);
    assert.equal(restarted.player.invincibleTime, start.levelStart.player.invincibleTime);
    assert.equal(restarted.player.knockedBack, start.levelStart.player.knockedBack);
  });

  test('with health left, nothing is restarted', () => {
    const start = newState(GROUND_GRID);
    const state = partway(start, { health: 1 }, 5);
    const after = step(state, NO_INPUT, FIXED_DT);
    assert.equal(after.player.health, 1);
    assert.equal(after.rewardCount, 5);
  });

  test('the snapshot itself is unchanged by a restart, so the level can restart again', () => {
    const start = newState(PIT_GRID);
    const firstRestart = stepUntilBackAtStart(partway(start, { health: 1 }, 0));
    assert.deepEqual({ ...firstRestart.levelStart.player }, { ...start.levelStart.player });

    const secondRestart = stepUntilBackAtStart(partway(firstRestart, { health: 1 }, 0));
    assert.equal(secondRestart.player.health, START_HEALTH);
  });

  test('the restarted player is a separate copy of the snapshot', () => {
    const start = newState(GROUND_GRID);
    const restarted = step(partway(start, { health: 0 }, 0), NO_INPUT, FIXED_DT);
    assert.notEqual(restarted.player, restarted.levelStart.player);
    restarted.player.x += 3;
    assert.equal(restarted.levelStart.player.x, start.levelStart.player.x);
  });
});

describe('objects across steps (req 27)', () => {
  // c is a stackable crate in the standard legend (level-builder.js).
  const OBJECT_GRID = ['........', '.P.c..G.', '########'];

  function newObjectState() {
    return createLevelState(buildData(OBJECT_GRID), TEST_LEVEL);
  }

  test('the new state\'s objects are separate copies: changing them doesn\'t change the old state', () => {
    const state = newObjectState();
    const next = step(state, NO_INPUT, FIXED_DT);
    const xBefore = state.objects[0].x;
    next.objects[0].x = xBefore + 5;
    next.levelStart.objects[0].x = xBefore + 5;
    assert.equal(state.objects[0].x, xBefore);
    assert.equal(state.levelStart.objects[0].x, xBefore);
  });

  test('objects stay CarriableObjects, with their structure locked, after any number of steps', () => {
    const after = runSteps(step, newObjectState(), NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
    for (const object of [...after.objects, ...after.levelStart.objects]) {
      assert.ok(object instanceof CarriableObject);
      assert.ok(Object.isSealed(object));
    }
  });

  test('a restart puts the objects back as they were when the level started, as separate copies', () => {
    const start = newObjectState();
    const [startObject] = start.objects;
    const moved = new CarriableObject({ ...startObject, x: startObject.x + 2, resting: false });
    const lastLife = { ...start, player: new Player({ ...start.player, health: 0 }), objects: [moved] };

    const restarted = step(lastLife, NO_INPUT, FIXED_DT);
    assert.deepEqual(restarted.objects.map((o) => ({ ...o })), start.levelStart.objects.map((o) => ({ ...o })));
    assert.notEqual(restarted.objects[0], restarted.levelStart.objects[0]);
  });
});

describe('enemies across steps (req 27)', () => {
  // e is a "beetle" enemy in the standard legend (level-builder.js).
  const ENEMY_GRID = ['........', '.P..e.G.', '########'];

  function newEnemyState() {
    return createLevelState(buildData(ENEMY_GRID), TEST_LEVEL);
  }

  test('the new state has separate copies of the enemies: changing them leaves the old state alone', () => {
    const state = newEnemyState();
    const next = step(state, NO_INPUT, FIXED_DT);
    const healthBefore = state.enemies[0].health;
    next.enemies[0].health = healthBefore + 5;
    next.levelStart.enemies[0].health = healthBefore + 5;
    assert.equal(state.enemies[0].health, healthBefore);
    assert.equal(state.levelStart.enemies[0].health, healthBefore);
  });

  test('enemies stay Enemy objects, with their structure locked, after any number of steps', () => {
    const after = runSteps(step, newEnemyState(), NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
    for (const enemy of [...after.enemies, ...after.levelStart.enemies]) {
      assert.ok(enemy instanceof Enemy);
      assert.ok(Object.isSealed(enemy));
    }
  });

  test('a restart puts the enemies back as they were when the level started, as separate copies', () => {
    const start = newEnemyState();
    const [startEnemy] = start.enemies;
    const hurt = new Enemy({ ...startEnemy, x: startEnemy.x + 2, health: 0 });
    const lastLife = { ...start, player: new Player({ ...start.player, health: 0 }), enemies: [hurt] };
    const restarted = step(lastLife, NO_INPUT, FIXED_DT);
    assert.deepEqual(restarted.enemies.map((e) => ({ ...e })), start.levelStart.enemies.map((e) => ({ ...e })));
    assert.notEqual(restarted.enemies[0], restarted.levelStart.enemies[0]);
  });
});
