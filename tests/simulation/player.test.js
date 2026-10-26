// Tests for the player: movement, jumping, collision, health (tasks 3.6-3.11).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player, damagePlayer } from '../../src/simulation/player.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { runSteps } from '../helpers/run.js';
import { Input, NO_INPUT, createInput, holding } from '../../src/simulation/input.js';

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

/**
 * Checks every part of the player's motion at once: position and speed (to
 * within rounding) and whether they're on the ground (exactly).
 */
function assertMotion(player, expected, when) {
  for (const key of ['x', 'y', 'vx', 'vy']) assertNear(player[key], expected[key], `${key} ${when}`);
  assert.equal(player.onGround, expected.onGround, `onGround ${when}`);
}

describe('the Player structure', () => {
  // The one central declaration of the player's properties is the Player class.
  const PROPERTIES = ['x', 'y', 'width', 'height', 'vx', 'vy', 'onGround', 'facing', 'health', 'jumpHeld',
    'invincibleTime', 'knockedBack', 'actionHeld', 'punchHeld', 'punchTime'];

  test('has exactly the declared properties', () => {
    assert.deepEqual(Object.keys(new Player()).sort(), [...PROPERTIES].sort());
  });

  test('starts at rest with safe defaults', () => {
    const player = new Player();
    assert.deepEqual({ ...player }, {
      x: 0, y: 0, width: 0, height: 0, vx: 0, vy: 0,
      onGround: false, facing: Facing.RIGHT, health: 0, jumpHeld: false,
      invincibleTime: 0, knockedBack: false, actionHeld: false, punchHeld: false, punchTime: 0,
    });
  });

  test('takes starting values for any of its properties', () => {
    const player = new Player({ x: 2.5, vy: -3, facing: Facing.LEFT, health: 4 });
    assert.equal(player.x, 2.5);
    assert.equal(player.vy, -3);
    assert.equal(player.facing, Facing.LEFT);
    assert.equal(player.health, 4);
    assert.equal(player.y, 0);   // not given: the default
  });

  test('rejects a starting value for a property it doesn\'t have, such as a typo', () => {
    assert.throws(() => new Player({ vxx: 1 }), /"vxx" is not a Player property/);
  });

  test('writing a property it doesn\'t have, such as a typo, throws instead of adding it', () => {
    const player = new Player();
    assert.throws(() => { player.vxx = 1; }, TypeError);
    assert.equal('vxx' in player, false);
  });

  test('its properties can\'t be removed', () => {
    const player = new Player();
    assert.throws(() => { delete player.x; }, TypeError);
  });

  test('its declared properties can be changed', () => {
    const player = new Player();
    player.x = 3;
    player.onGround = true;
    assert.equal(player.x, 3);
    assert.equal(player.onGround, true);
  });

  test('copy() gives a separate Player with the same values', () => {
    const player = new Player({ x: 1, vy: 2, facing: Facing.LEFT });
    const copy = player.copy();
    assert.ok(copy instanceof Player);
    assert.notEqual(copy, player);
    assert.deepEqual({ ...copy }, { ...player });
    copy.x = 9;
    assert.equal(player.x, 1);
    assert.throws(() => { copy.vxx = 1; }, TypeError);   // the copy is sealed too
  });
});

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

describe('gravity and jumping (reqs 21-23)', () => {
  // Tuning set here so expected values can be computed from named numbers.
  const GRAVITY = 10;          // tiles/s², downwards
  const JUMP_SPEED = 6;        // tiles/s, upwards
  const MAX_FALL_SPEED = 1000; // high enough not to matter, except in its own test
  const SIZE = { width: 1, height: 1 };
  const SPEED = 4;

  function newState(grid, tuning = {}) {
    return createLevelState(buildData(grid, {
      player: { size: SIZE, speed: SPEED },
      tuning: { gravity: GRAVITY, jumpSpeed: JUMP_SPEED, maxFallSpeed: MAX_FALL_SPEED, ...tuning },
    }), TEST_LEVEL);
  }

  /** The state with some of the player's properties changed (for setting up falls). */
  function withPlayer(state, changes) {
    return { ...state, player: new Player({ ...state.player, ...changes }) };
  }

  describe('standing and falling', () => {
    test('a player standing on the ground stays put and is on the ground', () => {
      const start = newState(['....G', '.P...', '#####']);
      const after = runSteps(step, start, NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
      assertNear(after.player.y, start.player.y, 'y');
      assert.equal(after.player.vy, 0);
      assert.equal(after.player.onGround, true);
    });

    test('in open air, gravity speeds the player up by gravity × dt each step', () => {
      // P starts in row 1 with nothing below until the ground in row 9.
      const start = newState(['....G', '.P...', '.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####']);

      // Step 1: vy grows by GRAVITY × dt from rest, and the player falls vy × dt. Still in the air.
      const one = step(start, NO_INPUT, FIXED_DT);
      const vy1 = GRAVITY * FIXED_DT;
      assertMotion(one.player, { x: start.player.x, y: start.player.y + vy1 * FIXED_DT, vx: 0, vy: vy1, onGround: false }, 'after one step');

      // Step 2: vy grows by GRAVITY × dt again. Still in the air.
      const two = step(one, NO_INPUT, FIXED_DT);
      const vy2 = vy1 + GRAVITY * FIXED_DT;
      assertMotion(two.player, { x: start.player.x, y: one.player.y + vy2 * FIXED_DT, vx: 0, vy: vy2, onGround: false }, 'after two steps');
    });

    test('falling never gets faster than maxFallSpeed', () => {
      const maxFallSpeed = 3;
      const tall = ['....G', '.P...', ...Array(40).fill('.....'), '#####'];
      const start = newState(tall, { maxFallSpeed });
      // Reaching maxFallSpeed takes maxFallSpeed / GRAVITY seconds; run for longer.
      const after = runSteps(step, start, NO_INPUT, STEPS_PER_SECOND, FIXED_DT);
      assert.equal(after.player.vy, maxFallSpeed);
      const next = step(after, NO_INPUT, FIXED_DT);
      assert.equal(next.player.vy, maxFallSpeed);
      assertNear(next.player.y, after.player.y + maxFallSpeed * FIXED_DT, 'y');
    });
  });

  describe('landing: one step\'s fall m compared with the distance d to the ground', () => {
    // P (1 × 1) in row 1 has its bottom edge at 2; the ground's top is at row 4,
    // so D = 2. A second floor at row 7 shows a big fall doesn't pass through.
    const GRID = ['....G', '.P...', '.....', '.....', '#####', '.....', '.....', '#####'];
    const D = 2;
    const DT = 0.5;

    /** A falling start state whose next step moves down exactly m. */
    function fallingBy(m) {
      // One step: vy becomes vy0 + GRAVITY × DT, then moves vy × DT, so choose vy0 to give m.
      const vy0 = m / DT - GRAVITY * DT;
      return withPlayer(newState(GRID), { vy: vy0 });
    }

    test('m < d: falls the full amount, not on the ground yet', () => {
      const m = 1;
      const start = fallingBy(m);
      const after = step(start, NO_INPUT, DT);
      assertNear(after.player.y, start.player.y + m, 'y');
      assert.equal(after.player.onGround, false);
      assertNear(after.player.vy, m / DT, 'vy');
    });

    test('m = d: arrives exactly on the ground, which isn\'t landing until the next step pulls down', () => {
      const start = fallingBy(D);
      const arrived = step(start, NO_INPUT, DT);
      assertNear(arrived.player.y, start.player.y + D, 'y');
      assert.equal(arrived.player.onGround, false);

      const next = step(arrived, NO_INPUT, FIXED_DT);
      assertNear(next.player.y, arrived.player.y, 'y on the next step');
      assert.equal(next.player.onGround, true);
      assert.equal(next.player.vy, 0);
    });

    test('m > d: lands on top of the ground, not inside it, and stops falling', () => {
      const start = fallingBy(3);
      const after = step(start, NO_INPUT, DT);
      assertNear(after.player.y, start.player.y + D, 'y');
      assert.equal(after.player.onGround, true);
      assert.equal(after.player.vy, 0);
    });

    test('m many tiles more than d: lands on the first floor, never passing through it', () => {
      const start = fallingBy(20);
      const after = step(start, NO_INPUT, DT);
      assertNear(after.player.y, start.player.y + D, 'y');
      assert.equal(after.player.onGround, true);
      assert.equal(after.player.vy, 0);
    });
  });

  describe('hitting a ceiling: one step\'s rise m compared with the distance d to the ceiling', () => {
    // P (1 × 1) stands in row 3, top edge at 3; the ceiling in row 0 ends at 1, so D = 2.
    const GRID = ['#####', '.....', '.....', '.P..G', '#####'];
    const D = 2;
    const DT = 0.5;

    /** Jumping sets vy to -jumpSpeed, and the first step rises jumpSpeed × DT: choose jumpSpeed to give m. */
    function jumpRising(m) {
      return newState(GRID, { jumpSpeed: m / DT });
    }

    test('m < d: rises the full amount, still rising', () => {
      const m = 1;
      const start = jumpRising(m);
      const after = step(start, holding(Input.JUMP), DT);
      assertNear(after.player.y, start.player.y - m, 'y');
      assertNear(after.player.vy, -m / DT, 'vy');
    });

    test('m = d: arrives exactly touching the ceiling, which is not a hit, still rising', () => {
      const start = jumpRising(D);
      const after = step(start, holding(Input.JUMP), DT);
      assertNear(after.player.y, start.player.y - D, 'y');
      assertNear(after.player.vy, -D / DT, 'vy');
    });

    test('m > d: stops just below the ceiling, and stops rising', () => {
      const start = jumpRising(3);
      const after = step(start, holding(Input.JUMP), DT);
      assertNear(after.player.y, start.player.y - D, 'y');
      assert.equal(after.player.vy, 0);
    });
  });

  describe('jumping', () => {
    const GRID = ['.......G', '.......', '.......', '.P.....', '#######'].map((row) => row.padEnd(8, '.'));

    test('pressing jump on the ground sets upward speed to jumpSpeed and rises jumpSpeed × dt that step', () => {
      const start = newState(GRID);
      const after = step(start, holding(Input.JUMP), FIXED_DT);
      assert.equal(after.player.vy, -JUMP_SPEED);
      assertNear(after.player.y, start.player.y - JUMP_SPEED * FIXED_DT, 'y');
      assert.equal(after.player.onGround, false);
    });

    test('a jump comes back down and lands where it started', () => {
      const start = newState(GRID);
      const jumped = step(start, holding(Input.JUMP), FIXED_DT);
      // A jump lasts about 2 × JUMP_SPEED / GRAVITY seconds; run comfortably longer.
      const landed = runSteps(step, jumped, NO_INPUT, 2 * STEPS_PER_SECOND, FIXED_DT);
      assertNear(landed.player.y, start.player.y, 'y');
      assert.equal(landed.player.onGround, true);
      assert.equal(landed.player.vy, 0);
    });

    test('no double jump: pressing again in the air does nothing', () => {
      const start = newState(GRID);
      const rising = step(start, holding(Input.JUMP), FIXED_DT);
      const released = step(rising, NO_INPUT, FIXED_DT);
      const pressedAgain = step(released, holding(Input.JUMP), FIXED_DT);
      // Still following the same arc: gravity has slowed the rise, with no new boost.
      assertNear(pressedAgain.player.vy, released.player.vy + GRAVITY * FIXED_DT, 'vy');
    });

    test('jump can\'t start while falling through the air', () => {
      const open = ['.......G', '.P.....', '.......', '.......', '.......', '.......', '#######'].map((row) => row.padEnd(8, '.'));
      const start = newState(open);
      const falling = step(start, NO_INPUT, FIXED_DT);
      const after = step(falling, holding(Input.JUMP), FIXED_DT);
      assertNear(after.player.vy, falling.player.vy + GRAVITY * FIXED_DT, 'vy');
    });

    test('holding jump through a landing doesn\'t jump again; releasing and pressing again does', () => {
      const start = newState(GRID);
      const heldThroughJump = runSteps(step, start, holding(Input.JUMP), 2 * STEPS_PER_SECOND, FIXED_DT);
      assertNear(heldThroughJump.player.y, start.player.y, 'y after landing with jump still held');
      assert.equal(heldThroughJump.player.onGround, true);

      const released = step(heldThroughJump, NO_INPUT, FIXED_DT);
      const pressed = step(released, holding(Input.JUMP), FIXED_DT);
      assert.equal(pressed.player.vy, -JUMP_SPEED);
    });

    test('a player who arrived exactly on the ground can jump on the very next step', () => {
      const grid = ['....G', '.P...', '.....', '.....', '#####'];
      const d = 2;   // P's bottom edge at 2; the ground's top at 4
      const dt = 0.5;
      const start = withPlayer(newState(grid), { vy: d / dt - GRAVITY * dt });
      const arrived = step(start, NO_INPUT, dt);
      assert.equal(arrived.player.onGround, false);   // exactly touching: not landed yet

      const jumped = step(arrived, holding(Input.JUMP), FIXED_DT);
      assert.equal(jumped.player.vy, -JUMP_SPEED);
    });

    test('running and jumping at the same time does both', () => {
      const start = newState(GRID);
      const after = step(start, holding(Input.RIGHT, Input.JUMP), FIXED_DT);
      assertNear(after.player.x, start.player.x + SPEED * FIXED_DT, 'x');
      assertNear(after.player.y, start.player.y - JUMP_SPEED * FIXED_DT, 'y');
    });

    test('a running jump can carry the player onto a higher platform', () => {
      // A 1-tile-high step up at column 3; standing jump height is about JUMP_SPEED² / (2 × GRAVITY) = 1.8 tiles.
      const grid = ['.......G', '........', '........', '.P.#####', '########'];
      const start = newState(grid);
      const stepTop = 3;   // the platform (row 3) has its top edge at 3, one tile above the ground (row 4)
      // The jump lasts about a second; run for two (holding right ends at the level's edge, still on the platform).
      const after = runSteps(step, start, (i) => holding(Input.RIGHT, ...(i === 0 ? [Input.JUMP] : [])), 2 * STEPS_PER_SECOND, FIXED_DT);
      assertNear(after.player.y, stepTop - SIZE.height, 'y on the platform');
      assert.equal(after.player.onGround, true);
    });
  });
});

describe('taking damage (reqs 24-25)', () => {
  const HEALTH = 3;
  const INVINCIBILITY_SECONDS = 1;
  const KNOCKBACK = { x: 5, y: 7 };   // tiles/s: x away from the source, y upwards
  const SPEED = 4;
  const SIZE = { width: 1, height: 1 };
  // Open ground, P in the middle (column 6), room to be knocked either way.
  const GRID = ['............G', '......P......', '#############'];

  function newState() {
    return createLevelState(buildData(GRID, {
      player: { size: SIZE, speed: SPEED, health: HEALTH },
      tuning: { invincibilitySeconds: INVINCIBILITY_SECONDS, knockback: KNOCKBACK },
    }), TEST_LEVEL);
  }

  /** A 1 × 1 source box (e.g. an enemy) whose centre is `offset` tiles right of the player's centre. */
  function sourceAt(state, offset) {
    const centre = state.player.x + state.player.width / 2;
    return { x: centre + offset - 0.5, y: state.player.y, width: 1, height: 1 };
  }

  test('loses 1 health', () => {
    const state = newState();
    assert.equal(damagePlayer(state, sourceAt(state, -1)), true);
    assert.equal(state.player.health, HEALTH - 1);
  });

  test('a knockback of 0 in tuning gives speeds of exactly 0, not -0, whichever way the player is knocked', () => {
    // -0 would make otherwise equal states compare as different (deepEqual tells 0 and -0 apart).
    for (const offset of [-1, 1]) {   // a source on the left (knocked right), then on the right (knocked left)
      const state = createLevelState(buildData(GRID, {
        player: { size: SIZE, speed: SPEED, health: HEALTH },
        tuning: { invincibilitySeconds: INVINCIBILITY_SECONDS, knockback: { x: 0, y: 0 } },
      }), TEST_LEVEL);
      damagePlayer(state, sourceAt(state, offset));
      assert.equal(state.player.vx, 0, `vx with the source at ${offset}`);
      assert.equal(state.player.vy, 0, `vy with the source at ${offset}`);
    }
  });

  test('becomes invincible for invincibilitySeconds', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));
    assert.equal(state.player.invincibleTime, INVINCIBILITY_SECONDS);
  });

  test('while invincible, more damage does nothing', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));
    assert.equal(damagePlayer(state, sourceAt(state, -1)), false);
    assert.equal(state.player.health, HEALTH - 1);
  });

  test('invincibility counts down each step and ends after invincibilitySeconds; then damage works again', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));
    const halfway = runSteps(step, state, NO_INPUT, STEPS_PER_SECOND / 2, FIXED_DT);
    assertNear(halfway.player.invincibleTime, INVINCIBILITY_SECONDS / 2, 'invincibleTime halfway');

    const after = runSteps(step, halfway, NO_INPUT, STEPS_PER_SECOND / 2 + 1, FIXED_DT);
    assert.equal(after.player.invincibleTime, 0);
    assert.equal(damagePlayer(after, sourceAt(after, -1)), true);
    assert.equal(after.player.health, HEALTH - 2);
  });

  test('health never goes below 0', () => {
    const state = createLevelState(buildData(GRID, { player: { size: SIZE, health: 1 } }), TEST_LEVEL);
    damagePlayer(state, sourceAt(state, -1));
    state.player.invincibleTime = 0;
    damagePlayer(state, sourceAt(state, -1));
    assert.equal(state.player.health, 0);
  });

  test('hit from the left: knocked right and upwards', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));
    assert.equal(state.player.vx, KNOCKBACK.x);
    assert.equal(state.player.vy, -KNOCKBACK.y);
    assert.equal(state.player.knockedBack, true);
  });

  test('hit from the right: knocked left and upwards', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, 1));
    assert.equal(state.player.vx, -KNOCKBACK.x);
    assert.equal(state.player.vy, -KNOCKBACK.y);
  });

  test('hit dead-centre: knocked backwards, opposite to the way the player faces', () => {
    const facingRight = newState();
    damagePlayer(facingRight, sourceAt(facingRight, 0));
    assert.equal(facingRight.player.vx, -KNOCKBACK.x);

    const facingLeft = newState();
    facingLeft.player.facing = Facing.LEFT;
    damagePlayer(facingLeft, sourceAt(facingLeft, 0));
    assert.equal(facingLeft.player.vx, KNOCKBACK.x);
  });

  test('while knocked back, running input is ignored: the knockback carries the player', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));   // knocked right
    const after = step(state, holding(Input.LEFT), FIXED_DT);
    assert.equal(after.player.vx, KNOCKBACK.x);
    assertNear(after.player.x, state.player.x + KNOCKBACK.x * FIXED_DT, 'x');
    assert.equal(after.player.facing, Facing.RIGHT);   // facing isn't changed while knocked back
  });

  test('knockback ends on landing, and running works again', () => {
    const state = newState();
    damagePlayer(state, sourceAt(state, -1));
    // Airborne for about 2 × KNOCKBACK.y / gravity seconds; run comfortably longer.
    const landed = runSteps(step, state, NO_INPUT, 2 * STEPS_PER_SECOND, FIXED_DT);
    assert.equal(landed.player.onGround, true);
    assert.equal(landed.player.knockedBack, false);
    const running = step(landed, holding(Input.LEFT), FIXED_DT);
    assert.equal(running.player.vx, -SPEED);
  });

  test('a wall stops knockback like any other movement', () => {
    // P at column 2 with a wall at column 3, right beside it.
    const state = createLevelState(buildData(['....G', '..P#.', '#####'], {
      player: { size: SIZE }, tuning: { knockback: KNOCKBACK },
    }), TEST_LEVEL);
    damagePlayer(state, sourceAt(state, -1));   // knocked right, into the wall
    const after = step(state, NO_INPUT, FIXED_DT);
    assertNear(after.player.x, state.player.x, 'x');
    assert.equal(after.player.vx, 0);
  });
});

describe('falling into a pit (req 26)', () => {
  const HEALTH = 3;
  const SIZE = { width: 1, height: 1 };
  // P at column 2, directly above the gap in the bottom row: it falls straight out of the level.
  const GRID = ['....G', '..P..', '##.##'];

  function newState() {
    return createLevelState(buildData(GRID, { player: { size: SIZE, health: HEALTH } }), TEST_LEVEL);
  }

  /** Steps with no input until the player's health changes; returns [before, after]. */
  function stepUntilHealthChanges(state) {
    let before = state;
    for (let i = 0; i < 10 * STEPS_PER_SECOND; i++) {
      const after = step(before, NO_INPUT, FIXED_DT);
      if (after.player.health !== before.player.health) return [before, after];
      before = after;
    }
    assert.fail('health never changed');
  }

  test('falling out of the level costs 1 health and puts the player back at the start, at rest', () => {
    const start = newState();
    const [, after] = stepUntilHealthChanges(start);
    assert.equal(after.player.health, HEALTH - 1);
    assertMotion(after.player, { x: start.start.x, y: start.start.y, vx: 0, vy: 0, onGround: false }, 'after respawning');
  });

  test('the step that falls out is the first with the player entirely below the level', () => {
    const start = newState();
    const [before] = stepUntilHealthChanges(start);
    assert.ok(before.player.y < start.level.height, 'the step before, part of the player was still in the level');
  });

  test('partly below the bottom is still falling, not yet in the pit', () => {
    const state = newState();
    const partlyOut = { ...state, player: new Player({ ...state.player, y: state.level.height - 0.5, vy: 0 }) };
    const after = step(partlyOut, NO_INPUT, FIXED_DT);
    assert.equal(after.player.health, HEALTH);
    assert.ok(after.player.y > partlyOut.player.y);
  });

  test('a top edge exactly at the bottom of the level counts as fallen in', () => {
    const state = newState();
    // Placed just above the boundary, falling: this step's fall reaches it exactly, or beyond.
    const atEdge = { ...state, player: new Player({ ...state.player, y: state.level.height, vy: 0 }) };
    const after = step(atEdge, NO_INPUT, FIXED_DT);
    assert.equal(after.player.health, HEALTH - 1);
  });

  test('invincibility doesn\'t protect against pits', () => {
    const state = newState();
    const invincible = { ...state, player: new Player({ ...state.player, invincibleTime: 5 }) };
    const [, after] = stepUntilHealthChanges(invincible);
    assert.equal(after.player.health, HEALTH - 1);
  });

  test('respawning ends any knockback', () => {
    const state = newState();
    const knocked = { ...state, player: new Player({ ...state.player, knockedBack: true }) };
    const [, after] = stepUntilHealthChanges(knocked);
    assert.equal(after.player.knockedBack, false);
  });

  test('a player with no health left doesn\'t go below 0', () => {
    const state = newState();
    const noHealth = { ...state, player: new Player({ ...state.player, health: 0, y: state.level.height }) };
    const after = step(noHealth, NO_INPUT, FIXED_DT);
    assert.ok(after.player.health >= 0);
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
