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

describe('walls and edges (req 23)', () => {
  // A 1 × 1 player at speed 4, starting D = 2 tiles from a wall or level edge.
  // Each case sets dt, so one step moves m = SPEED × dt, compared with D.
  // (Collision details are tested in collision.test.js; these show the player uses it.)
  const SPEED = 4;
  const SIZE = { width: 1, height: 1 };
  const D = 2;
  const CASES = [
    { name: 'm < d: moves the full amount, still running', dt: 0.25, moved: 1, stopped: false },
    { name: 'm = d: arrives exactly touching, which is not a hit, still running', dt: 0.5, moved: D, stopped: false },
    { name: 'm > d: stops flush, never past', dt: 0.75, moved: D, stopped: true },
    { name: 'm many tiles more than d (a large dt): stops at the first wall', dt: 5, moved: D, stopped: true },
  ];

  // Each grid: player (P) in row 1, standing on ground. Walls (#) reach the player's row.
  const SITUATIONS = [
    {
      name: 'a wall to the right',
      grid: ['....#...#G', '.P..#...#.', '##########'],   // P's right edge at 2; first wall at column 4, a second at 8
      held: Input.RIGHT,
      sign: 1,
    },
    {
      name: 'a wall to the left',
      grid: ['G#...#....', '.#...#..P.', '##########'],   // P's left edge at 8; first wall ends at 6, a second at column 1
      held: Input.LEFT,
      sign: -1,
    },
    {
      name: 'the right edge of the level',
      grid: ['G.........', '.......P..', '##########'],   // P's right edge at 8; the level ends at 10
      held: Input.RIGHT,
      sign: 1,
    },
    {
      name: 'the left edge of the level',
      grid: ['.........G', '..P.......', '##########'],   // P's left edge at 2; the level starts at 0
      held: Input.LEFT,
      sign: -1,
    },
  ];

  function newState(grid) {
    return createLevelState(buildData(grid, { player: { size: SIZE, speed: SPEED } }), TEST_LEVEL);
  }

  for (const situation of SITUATIONS) {
    describe(situation.name, () => {
      for (const c of CASES) {
        test(c.name, () => {
          const start = newState(situation.grid);
          const after = step(start, holding(situation.held), c.dt);
          assertNear(after.player.x, start.player.x + situation.sign * c.moved, 'x');
          assert.equal(after.player.vx, c.stopped ? 0 : situation.sign * SPEED);
        });
      }

      test('d = 0 (already touching) while pushing: doesn\'t move, isn\'t running, faces the obstacle', () => {
        const touching = step(newState(situation.grid), holding(situation.held), 0.5);   // m = D: now touching
        const pushed = runSteps(step, touching, holding(situation.held), STEPS_PER_SECOND, FIXED_DT);
        assertNear(pushed.player.x, touching.player.x, 'x');
        assert.equal(pushed.player.vx, 0);
        assert.equal(pushed.player.facing, situation.sign > 0 ? Facing.RIGHT : Facing.LEFT);
      });
    });
  }

  test('pushing into a wall on the left, the player turns to face it even though they can\'t move', () => {
    // P starts facing right, already touching a wall on its left.
    const start = newState(['G#........', '.#P.......', '##########']);
    assert.equal(start.player.facing, Facing.RIGHT);
    const after = step(start, holding(Input.LEFT), FIXED_DT);
    assertNear(after.player.x, start.player.x, 'x');
    assert.equal(after.player.facing, Facing.LEFT);
  });

  test('after stopping at a wall, running the other way works normally', () => {
    const start = newState(['....#....G', '.P..#.....', '##########']);
    const atWall = step(start, holding(Input.RIGHT), 0.75);   // stops flush
    const back = step(atWall, holding(Input.LEFT), 0.25);
    assertNear(back.player.x, atWall.player.x - SPEED * 0.25, 'x');
    assert.equal(back.player.vx, -SPEED);
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
