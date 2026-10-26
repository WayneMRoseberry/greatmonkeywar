// Tests for enemies: patrolling (task 5.2; PRD reqs 49-50) and contact damage (task 5.3; req 51).
//
// Grids use the standard legend (level-builder.js): e is a "beetle" enemy,
// c a stackable crate. Unless a test says otherwise the enemy is 1 × 1 tile,
// so its edges line up with the tiles. By default an enemy starts walking left.
//
// Decided for patrolling:
//  - an enemy on the ground walks at its patrol speed (character definition)
//    in the direction it faces;
//  - it turns around when it walks into a wall: a solid tile, the level's
//    side edge, or a resting stackable object;
//  - it turns around at the edge of a platform or stack: a step that would
//    take its front edge past the end of the ground under it isn't taken, so
//    it never hangs over the edge;
//  - in the air it doesn't move sideways: it falls straight down under gravity
//    (tuning, as for the player) and patrols again once it lands;
//  - an enemy entirely below the level (in a pit) is removed;
//  - enemies pass through each other and through the player (touching the
//    player is contact damage, task 5.3), and a resting crate they already
//    overlap isn't solid to them, so they can walk out of it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { Enemy, liveEnemies } from '../../src/simulation/enemies.js';
import { Player } from '../../src/simulation/player.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const ONE_TILE = { width: 1, height: 1 };
const SPEED = 2;
const TUNING = { gravity: 30, maxFallSpeed: 12 };

/** A state from `grid` with a 1 × 1 player and enemy, the enemy's patrol speed SPEED, and TUNING (plus `tuning`). */
function enemyState(grid, { enemy = {}, legend = {}, player = {}, tuning = {} } = {}) {
  return createLevelState(buildData(grid, {
    player: { size: ONE_TILE, ...player }, enemy: { size: ONE_TILE, speed: SPEED, ...enemy }, tuning: { ...TUNING, ...tuning }, legend,
  }), TEST_LEVEL);
}

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

const bottom = (box) => box.y + box.height;
const right = (box) => box.x + box.width;

/** Steps `count` times with no input, calling `check(state, i)` after each step; returns the last state. */
function stepWatching(state, count, check) {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = step(current, NO_INPUT, FIXED_DT);
    check(current, i);
  }
  return current;
}

/** Steps with `input` (none by default) until `done(state)`, and returns that state; fails after `maxSteps`. */
function stepUntil(state, done, maxSteps = 10 * STEPS_PER_SECOND, input = NO_INPUT) {
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    current = step(current, input, FIXED_DT);
    if (done(current)) return current;
  }
  assert.fail(`not done after ${maxSteps} steps`);
}

describe('patrol (reqs 49-50)', () => {
  describe('walking', () => {
    test('an enemy on the ground walks left at its patrol speed', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x - SPEED * FIXED_DT, 'x');
      assert.equal(after.vx, -SPEED);
      assert.equal(after.facing, Facing.LEFT);
    });

    test('an enemy placed facing right walks right at its patrol speed', () => {
      const state = enemyState(['P.......G', '....r....', '#########'], { legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x + SPEED * FIXED_DT, 'x');
      assert.equal(after.vx, SPEED);
    });

    test('the patrol speed comes from the enemy\'s character definition', () => {
      const speed = 5;
      const state = enemyState(['P.......G', '....e....', '#########'], { enemy: { speed } });
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, before.x - speed * FIXED_DT, 'x');
    });

    test('an enemy walking on the ground stays on it: it doesn\'t sink or rise', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const startY = state.enemies[0].y;
      stepWatching(state, 30, (s, i) => assertNear(s.enemies[0].y, startY, `y at step ${i}`));
    });
  });

  describe('turning at walls', () => {
    test('walking into a solid tile, it stops flush against it and turns around', () => {
      const wallRight = 3;   // the wall is column 2
      const state = enemyState(['P.......G', '..#.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const [enemy] = turned.enemies;
      assertNear(enemy.x, wallRight, 'flush against the wall');
      assert.equal(enemy.vx, SPEED);
    });

    test('after turning at a wall it walks the other way', () => {
      const state = enemyState(['P.......G', '..#.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const after = step(turned, NO_INPUT, FIXED_DT);
      assertNear(after.enemies[0].x, turned.enemies[0].x + SPEED * FIXED_DT, 'x');
    });

    test('the level\'s left and right edges are walls it turns at', () => {
      const levelWidth = 6;
      const state = enemyState(['.....G', '..e..P', '######']);
      const atLeft = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      assertNear(atLeft.enemies[0].x, 0, 'flush against the left edge');
      const atRight = stepUntil(atLeft, (s) => s.enemies[0].facing === Facing.LEFT);
      assertNear(right(atRight.enemies[0]), levelWidth, 'flush against the right edge');
    });

    test('a crate resting on the ground is a wall it turns at', () => {
      const crateRight = 3;   // the crate is column 2
      const state = enemyState(['P.......G', '..c.e....', '#########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      assertNear(turned.enemies[0].x, crateRight, 'flush against the crate');
    });
  });

  describe('turning at edges', () => {
    test('on a platform it walks to each edge and turns, never hanging over either edge', () => {
      // The platform is columns 3-5 of row 2; the enemy stands on it in column 4.
      const platformLeft = 3;
      const platformRight = 6;
      const state = enemyState(['P........G', '....e.....', '...###....', '..........', '##########']);
      const startY = state.enemies[0].y;
      const facings = new Set();
      stepWatching(state, 4 * STEPS_PER_SECOND, (s, i) => {
        const [enemy] = s.enemies;
        assert.ok(enemy.x >= platformLeft - 1e-9, `left edge past the platform at step ${i}: ${enemy.x}`);
        assert.ok(right(enemy) <= platformRight + 1e-9, `right edge past the platform at step ${i}: ${right(enemy)}`);
        assertNear(enemy.y, startY, `y at step ${i}`);
        facings.add(enemy.facing);
      });
      assert.deepEqual([...facings].sort(), [Facing.LEFT, Facing.RIGHT].sort(), 'it turned both ways');
    });

    test('it turns within one step of the edge', () => {
      const platformLeft = 3;
      const state = enemyState(['P........G', '....e.....', '...###....', '..........', '##########']);
      const turned = stepUntil(state, (s) => s.enemies[0].facing === Facing.RIGHT);
      const gap = turned.enemies[0].x - platformLeft;
      assert.ok(gap >= -1e-9 && gap <= SPEED * FIXED_DT + 1e-9, `turned ${gap} from the edge`);
    });

    test('on a single crate it turns at both edges and never falls off', () => {
      const crateTop = 2;
      const state = enemyState(['P.......G', '....e....', '....c....', '#########']);
      const facings = new Set();
      stepWatching(state, 2 * STEPS_PER_SECOND, (s, i) => {
        assertNear(bottom(s.enemies[0]), crateTop, `bottom at step ${i}`);
        facings.add(s.enemies[0].facing);
      });
      assert.equal(facings.size, 2, 'it turned both ways');
    });

    test('on top of a row of crates it walks across them without snagging, and turns at the stack\'s ends', () => {
      // Crates in columns 2-4 of row 2; the enemy starts on the middle one.
      const stackLeft = 2;
      const stackRight = 5;
      const state = enemyState(['P.......G', '...e.....', '..ccc....', '#########']);
      const startY = state.enemies[0].y;
      let walked = 0;
      let previousX = state.enemies[0].x;
      stepWatching(state, 4 * STEPS_PER_SECOND, (s, i) => {
        const [enemy] = s.enemies;
        assert.ok(enemy.x >= stackLeft - 1e-9 && right(enemy) <= stackRight + 1e-9, `off the stack at step ${i}`);
        assertNear(enemy.y, startY, `y at step ${i}`);
        walked += Math.abs(enemy.x - previousX);
        previousX = enemy.x;
      });
      assert.ok(walked > stackRight - stackLeft, `it walked ${walked} tiles in all`);
    });
  });

  describe('falling', () => {
    test('an enemy with nothing under it falls straight down under gravity, not moving sideways', () => {
      const state = enemyState(['P.......G', '....e....', '.........', '.........', '#########']);
      const [before] = state.enemies;
      const [after] = step(state, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.vy, TUNING.gravity * FIXED_DT, 'vy');
      assertNear(after.y, before.y + TUNING.gravity * FIXED_DT * FIXED_DT, 'y');
      assertNear(after.x, before.x, 'x');
      assert.equal(after.vx, 0);
    });

    test('falling speeds up to maxFallSpeed and no faster', () => {
      const grid = ['P...G', '..e..', ...Array.from({ length: 40 }, () => '.....'), '#####'];
      let reachedMax = false;
      stepWatching(enemyState(grid), STEPS_PER_SECOND, (s, i) => {
        const expected = Math.min((i + 1) * TUNING.gravity * FIXED_DT, TUNING.maxFallSpeed);
        assertNear(s.enemies[0].vy, expected, `vy at step ${i}`);
        reachedMax ||= expected === TUNING.maxFallSpeed;
      });
      assert.ok(reachedMax, 'the test should reach maxFallSpeed');
    });

    test('it lands on the ground, then patrols again in the direction it faces', () => {
      const groundTop = 4;
      const state = enemyState(['P.......G', '....e....', '.........', '.........', '#########']);
      const startX = state.enemies[0].x;
      const landed = stepUntil(state, (s) => s.enemies[0].vy === 0 && bottom(s.enemies[0]) > state.enemies[0].y + 1);
      assertNear(bottom(landed.enemies[0]), groundTop, 'landed on the ground');
      assertNear(landed.enemies[0].x, startX, 'it fell straight down');
      const walking = step(landed, NO_INPUT, FIXED_DT);
      assert.ok(walking.enemies[0].x < landed.enemies[0].x, 'it walks left again');
    });

    test('it lands on a crate', () => {
      const crateTop = 3;
      const state = enemyState(['P.......G', '....e....', '.........', '....c....', '#########']);
      const landed = stepUntil(state, (s) => s.enemies[0].vy === 0 && s.enemies[0].y > state.enemies[0].y);
      assertNear(bottom(landed.enemies[0]), crateTop, 'on the crate');
    });

    test('when the crate under it is picked up, it falls', () => {
      // The enemy stands on the crate in column 2; the player, in column 1, picks the crate up.
      const groundTop = 3;
      const state = enemyState(['.....G', '..e...', '.Pc...', '######']);
      const picked = step(state, holding(Input.ACTION), FIXED_DT);
      assert.ok(picked.objects[0].held, 'the player picked up the crate');
      const landed = stepUntil(picked, (s) => bottom(s.enemies[0]) > groundTop - 1e-9);
      assertNear(bottom(landed.enemies[0]), groundTop, 'it fell to the ground');
    });

    test('an enemy that falls into a pit is removed from the level', () => {
      const state = enemyState(['P.e..G', '##.###']);
      const after = stepUntil(state, (s) => s.enemies.length === 0);
      assert.deepEqual(after.enemies, []);
    });
  });

  describe('what enemies don\'t collide with', () => {
    test('enemies pass through each other', () => {
      // Two enemies walking towards each other, then past each other.
      const state = enemyState(['P.........G', '..r....e...', '###########'], { legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
      const passed = stepUntil(state, (s) => s.enemies[0].x > s.enemies[1].x + 1);
      assert.equal(passed.enemies[0].facing, Facing.RIGHT);
      assert.equal(passed.enemies[1].facing, Facing.LEFT);
    });

    test('an enemy walks through the player without turning', () => {
      // The player is invincible throughout, so touching the enemy doesn't knock them out of its way (task 5.3).
      const invincibleSeconds = 100;
      const state = enemyState(['.........G', '..P..e....', '##########']);
      const invincible = { ...state, player: new Player({ ...state.player, invincibleTime: invincibleSeconds }) };
      const passed = stepUntil(invincible, (s) => right(s.enemies[0]) < s.player.x);
      assert.equal(passed.enemies[0].facing, Facing.LEFT);
    });

    test('a coconut doesn\'t stop an enemy', () => {
      const state = enemyState(['P.......G', '..o.e....', '#########']);
      const coconutLeft = state.objects[0].x;
      const passed = stepUntil(state, (s) => right(s.enemies[0]) < coconutLeft);
      assert.equal(passed.enemies[0].facing, Facing.LEFT);
    });

    test('a crate resting where the enemy stands isn\'t solid to it: it walks out', () => {
      const state = enemyState(['P.......G', '....e....', '#########']);
      const [enemy] = state.enemies;
      const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: enemy.x, y: enemy.y, resting: true });
      const [after] = step({ ...state, objects: [crate] }, NO_INPUT, FIXED_DT).enemies;
      assertNear(after.x, enemy.x - SPEED * FIXED_DT, 'x');
      assert.equal(after.facing, Facing.LEFT);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 5.3: contact damage (req 51). Decided:
//  - the player touches an enemy when their boxes overlap (sharing an edge
//    isn't enough);
//  - a touch is "from above" when the player moved down this step and their
//    feet were at or above the enemy's top before the move; that is a stomp
//    (task 5.4) and does no damage. Any other touch (from the side or below)
//    damages the player: damagePlayer (player.js), so 1 health, knockback
//    away from the enemy, and invincibility, which also stops more damage.

describe('contact (req 51)', () => {
  const HEALTH = 3;
  const KNOCKBACK = { x: 5, y: 7 };
  const INVINCIBILITY_SECONDS = 1;
  const CONTACT = { player: { health: HEALTH }, tuning: { knockback: KNOCKBACK, invincibilitySeconds: INVINCIBILITY_SECONDS } };

  /** The state with the player's properties changed. */
  const withPlayer = (state, changes) => ({ ...state, player: new Player({ ...state.player, ...changes }) });

  /** Steps with `input` until the player has lost health, and returns that state; fails after `maxSteps`. */
  function stepUntilHurt(state, input = NO_INPUT, maxSteps = 5 * STEPS_PER_SECOND) {
    let current = state;
    for (let i = 0; i < maxSteps; i++) {
      current = step(current, input, FIXED_DT);
      if (current.player.health < state.player.health) return current;
    }
    assert.fail('the player was never hurt');
  }

  test('an enemy walking into the player from the side hurts them: 1 health, knocked away from it, invincible', () => {
    const state = enemyState(['.........G', '..P..e....', '##########'], CONTACT);   // the enemy comes from the right
    const hurt = stepUntilHurt(state);
    assert.equal(hurt.player.health, HEALTH - 1);
    assert.equal(hurt.player.vx, -KNOCKBACK.x, 'knocked left, away from the enemy');
    assert.equal(hurt.player.vy, -KNOCKBACK.y, 'and upward');
    assert.equal(hurt.player.invincibleTime, INVINCIBILITY_SECONDS);
  });

  test('the player running into an enemy from the side is hurt', () => {
    // The enemy walks right, away from the player, but the player runs faster and catches it.
    const state = enemyState(['.........G', '.P.r......', '##########'], { ...CONTACT, legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
    const hurt = stepUntilHurt(state, holding(Input.RIGHT));
    assert.equal(hurt.player.vx, -KNOCKBACK.x, 'knocked left, away from the enemy');
  });

  test('an enemy falling onto the player from above hurts them (the player is touched from below)', () => {
    const state = enemyState(['.........G', '.....e....', '..........', '..........', '.....P....', '##########'], CONTACT);
    const hurt = stepUntilHurt(state);
    assert.equal(hurt.player.health, HEALTH - 1);
  });

  test('jumping up into an enemy from below hurts the player', () => {
    const state = enemyState(['.........G', '.....e....', '..........', '..........', '.....P....', '##########'], CONTACT);
    const hurt = stepUntilHurt(state, holding(Input.JUMP));
    assert.equal(hurt.player.health, HEALTH - 1);
  });

  test('falling onto an enemy from above does no damage: the player keeps their health (it is a stomp, task 5.4)', () => {
    // The enemy stands on a 1-tile pillar, so it can't walk away; the player drops onto it from above.
    // The stomp defeats it in the step they first touch (task 5.4).
    const state = enemyState(['.....P...G', '..........', '..........', '.....e....', '.....#....', '##########'], CONTACT);
    const touched = stepUntil(state, (s) => liveEnemies(s).length === 0);
    assert.equal(touched.player.health, HEALTH);
  });

  test('standing exactly flush beside an enemy, sharing an edge, does no damage', () => {
    // The enemy starts flush against the player's right side and walks away from them.
    const state = enemyState(['.........G', '..Pr......', '##########'], { ...CONTACT, legend: { r: { enemy: 'beetle', facing: Facing.RIGHT } } });
    let current = state;
    for (let i = 0; i < STEPS_PER_SECOND; i++) current = step(current, NO_INPUT, FIXED_DT);
    assert.equal(current.player.health, HEALTH);
  });

  test('while the player is invincible, touching an enemy does no more damage', () => {
    const state = enemyState(['.........G', '..P......', '##########'], CONTACT);
    const { player } = state;
    const touching = { ...withPlayer(state, { invincibleTime: INVINCIBILITY_SECONDS }), enemies: [enemyAt(state, player.x, player.y)] };
    assert.equal(step(touching, NO_INPUT, FIXED_DT).player.health, HEALTH);
  });

  test('touching two enemies at once costs only 1 health', () => {
    const state = enemyState(['.........G', '..P......', '##########'], CONTACT);
    const { player } = state;
    const overlapping = { ...state, enemies: [enemyAt(state, player.x - 0.5, player.y), enemyAt(state, player.x + 0.5, player.y)] };
    assert.equal(step(overlapping, NO_INPUT, FIXED_DT).player.health, HEALTH - 1);
  });

  test('a touch that brings health to 0 restarts the level', () => {
    const state = enemyState(['.........G', '..P......', '##########'], CONTACT);
    const { player } = state;
    const lastLife = { ...withPlayer(state, { health: 1 }), enemies: [enemyAt(state, player.x, player.y)] };
    const restarted = step(lastLife, NO_INPUT, FIXED_DT);
    assert.equal(restarted.player.health, state.levelStart.player.health);
    assert.deepEqual(restarted.enemies.map((e) => ({ ...e })), state.levelStart.enemies.map((e) => ({ ...e })));
  });

  test('an enemy touching only the object the player holds does no damage', () => {
    const state = enemyState(['.........G', '.........', '..P......', '##########'], CONTACT);
    const { player } = state;
    const held = new CarriableObject({ type: 'crate', ...ONE_TILE, x: player.x, y: player.y - 1, held: true });
    // The enemy overlaps the top half of the held crate, well clear of the player.
    const touchingCrate = { ...state, objects: [held], enemies: [enemyAt(state, player.x, player.y - 1.5)] };
    assert.equal(step(touchingCrate, NO_INPUT, FIXED_DT).player.health, HEALTH);
  });
});

// ---------------------------------------------------------------------------
// Task 5.4: stomping (req 52). Decided:
//  - a touch from above (as defined for 5.3) is a stomp: the enemy is
//    defeated whatever its health, and the player bounces upward at
//    stompBounceSpeed (tuning), whether or not jump is held;
//  - for now a defeated enemy is removed at once (5.10 adds a short defeat
//    state before removal, in the same one place);
//  - stomps are resolved before side contacts in the same step; several
//    enemies stomped at once are all defeated, with one bounce; stomping works
//    while invincible (invincibility only protects against damage).

describe('stomp (req 52)', () => {
  const HEALTH = 3;
  const STOMP_BOUNCE = 8;
  const STOMP = { player: { health: HEALTH }, tuning: { stompBounceSpeed: STOMP_BOUNCE, knockback: { x: 5, y: 7 } } };
  // The enemy stands on a 1-tile pillar (column 5), so it can't walk away; the player drops onto it from above.
  const PILLAR_GRID = ['.....P...G', '..........', '..........', '.....e....', '.....#....', '##########'];

  /** Steps with no input until there are fewer enemies than at the start, and returns that state. */
  function stepUntilStomped(state) {
    return stepUntil(state, (s) => liveEnemies(s).length < liveEnemies(state).length);
  }

  test('falling onto an enemy defeats it and bounces the player upward at stompBounceSpeed', () => {
    const stomped = stepUntilStomped(enemyState(PILLAR_GRID, STOMP));
    assert.deepEqual(liveEnemies(stomped), []);
    assert.equal(stomped.player.vy, -STOMP_BOUNCE);
    assert.equal(stomped.player.health, HEALTH);
  });

  test('the enemy is defeated whatever its health', () => {
    const health = 5;
    const stomped = stepUntilStomped(enemyState(PILLAR_GRID, { ...STOMP, enemy: { health } }));
    assert.deepEqual(liveEnemies(stomped), []);
  });

  test('after the bounce the player rises, and is never hurt by the stomped enemy', () => {
    const state = enemyState(PILLAR_GRID, STOMP);
    const stomped = stepUntilStomped(state);
    const rising = step(stomped, NO_INPUT, FIXED_DT);
    assert.ok(rising.player.y < stomped.player.y, 'the player moves up after the bounce');
    let current = rising;
    for (let i = 0; i < 2 * STEPS_PER_SECOND; i++) current = step(current, NO_INPUT, FIXED_DT);
    assert.equal(current.player.health, HEALTH);
  });

  test('a stomp bounce of 0 gives an upward speed of exactly 0, not -0', () => {
    // -0 would make otherwise equal states compare as different (deepEqual tells 0 and -0 apart).
    const stomped = stepUntilStomped(enemyState(PILLAR_GRID, { ...STOMP, tuning: { ...STOMP.tuning, stompBounceSpeed: 0 } }));
    assert.equal(stomped.player.vy, 0);
  });

  test('holding jump while stomping doesn\'t change the bounce', () => {
    // The player falls from row 0 (a jump press there does nothing: not standing), still holding jump at the stomp.
    let holdingJump = enemyState(PILLAR_GRID, STOMP);
    for (let i = 0; i < 10 * STEPS_PER_SECOND && liveEnemies(holdingJump).length > 0; i++) {
      holdingJump = step(holdingJump, holding(Input.JUMP), FIXED_DT);
    }
    assert.deepEqual(liveEnemies(holdingJump), [], 'the enemy was stomped');
    assert.equal(holdingJump.player.vy, -STOMP_BOUNCE);
  });

  test('stomping works while the player is invincible', () => {
    const state = enemyState(PILLAR_GRID, STOMP);
    const invincible = { ...state, player: new Player({ ...state.player, invincibleTime: 100 }) };
    const stomped = stepUntilStomped(invincible);
    assert.deepEqual(liveEnemies(stomped), []);
  });

  test('an enemy touched from the side or below is not defeated', () => {
    const state = enemyState(['.........G', '.....e....', '..........', '..........', '.....P....', '##########'], STOMP);
    let current = state;
    for (let i = 0; i < 5 * STEPS_PER_SECOND && current.player.health === HEALTH; i++) current = step(current, holding(Input.JUMP), FIXED_DT);
    assert.equal(current.player.health, HEALTH - 1, 'the player was hurt');
    assert.equal(liveEnemies(current).length, 1, 'the enemy is still there');
  });

  /** A state where the player, falling, is just above the given enemies' tops, so the next step touches them. */
  function fallingOnto(state, enemyBoxes) {
    const fallSpeed = 3;
    const player = new Player({ ...state.player, y: 1, vy: fallSpeed });
    return { ...state, player, enemies: enemyBoxes(player).map(([x, y]) => enemyAt(state, x, y)) };
  }

  test('two enemies stomped at once are both defeated, with one bounce', () => {
    const state = enemyState(['.........G', '..........', '..........', '..P.......', '##########'], STOMP);
    const justBelowFeet = (player) => player.y + player.height + 0.01;
    const twoUnder = fallingOnto(state, (p) => [[p.x - 0.5, justBelowFeet(p)], [p.x + 0.5, justBelowFeet(p)]]);
    const after = step(twoUnder, NO_INPUT, FIXED_DT);
    assert.deepEqual(liveEnemies(after), []);
    assert.equal(after.player.vy, -STOMP_BOUNCE);
  });

  test('a stomp and a side touch in the same step: the stomped enemy is defeated, and the other one still hurts', () => {
    const state = enemyState(['.........G', '..........', '..........', '..P.......', '##########'], STOMP);
    // One enemy just below the player's feet (a stomp); one beside the player, level with them (a side touch).
    const both = fallingOnto(state, (p) => [[p.x, p.y + p.height + 0.01], [p.x + 0.5, p.y]]);
    const side = both.enemies[1];
    const after = step(both, NO_INPUT, FIXED_DT);
    assert.equal(liveEnemies(after).length, 1);
    assertNear(liveEnemies(after)[0].x, side.x, 'the enemy left is the one beside the player');   // in the air, it doesn't move sideways
    assert.equal(after.player.health, HEALTH - 1);
  });
});

// ---------------------------------------------------------------------------
// Task 5.5: thrown objects (req 33). Decided:
//  - a thrown object (one still `thrown`, in flight) hits an enemy when their
//    boxes overlap; this is checked each step once objects and enemies have
//    moved, before the player's contact with enemies;
//  - every enemy it overlaps in that step is defeated, whatever its health;
//  - the object then drops straight down: both speeds 0, no longer thrown, so
//    it can be picked up again at once and can't defeat another enemy below;
//  - only thrown objects defeat enemies: dropped, falling, resting, and held
//    ones don't.

describe('thrown objects (req 33)', () => {
  const THROW_SPEED = { x: 8, y: 2 };
  const THROWN = { tuning: { throwSpeed: THROW_SPEED, dropSpeed: { x: 0, y: 0 } } };
  // The player (column 1) throws right at the enemy (column 5), which walks towards them.
  const THROW_GRID = ['..........G', '...........', '.P...e.....', '###########'];

  /** The state with the player holding a 1 × 1 crate above their head, as well as the level's own objects. */
  function holdingCrate(state) {
    const { player } = state;
    const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: player.x, y: player.y - 1, held: true });
    return { ...state, objects: [...state.objects, crate] };
  }

  /** A crate in flight at (x, y), thrown with speed (vx, vy). */
  const thrownCrate = (x, y, vx, vy) => new CarriableObject({ type: 'crate', ...ONE_TILE, x, y, vx, vy, thrown: true });

  test('a thrown object that hits an enemy defeats it', () => {
    const thrown = step(holdingCrate(enemyState(THROW_GRID, THROWN)), holding(Input.ACTION), FIXED_DT);
    assert.equal(thrown.objects[0].thrown, true, 'the crate is in flight');
    const hit = stepUntil(thrown, (s) => liveEnemies(s).length === 0);
    assert.deepEqual(liveEnemies(hit), []);
    assert.equal(hit.player.health, thrown.player.health, 'the player wasn\'t hurt');
  });

  test('in the step it hits, the object stops (both speeds 0) and is no longer thrown', () => {
    const thrown = step(holdingCrate(enemyState(THROW_GRID, THROWN)), holding(Input.ACTION), FIXED_DT);
    const [object] = stepUntil(thrown, (s) => liveEnemies(s).length === 0).objects;
    assert.equal(object.thrown, false);
    assert.equal(object.vx, 0);
    assert.equal(object.vy, 0);
    assert.equal(object.resting, false, 'it is still in the air');
  });

  test('after the hit it drops straight down, comes to rest on the ground, and can be picked up again', () => {
    const groundTop = 3;
    const thrown = step(holdingCrate(enemyState(THROW_GRID, THROWN)), holding(Input.ACTION), FIXED_DT);
    const hit = stepUntil(thrown, (s) => liveEnemies(s).length === 0);
    const hitX = hit.objects[0].x;
    const landed = stepUntil(hit, (s) => {
      assertNear(s.objects[0].x, hitX, 'it drops straight down');
      return s.objects[0].resting;
    });
    assertNear(bottom(landed.objects[0]), groundTop, 'it lands on the ground');
    // The player walks up to the crate (it is solid now, so they stop flush against it) and picks it up.
    const beside = stepUntil(landed, (s) => s.player.vx === 0 && s.player.x > landed.player.x, 10 * STEPS_PER_SECOND, holding(Input.RIGHT));
    const picked = step(step(beside, NO_INPUT, FIXED_DT), holding(Input.ACTION), FIXED_DT);
    assert.equal(picked.objects[0].held, true);
  });

  test('the enemy is defeated whatever its health', () => {
    const health = 5;
    const thrown = step(holdingCrate(enemyState(THROW_GRID, { ...THROWN, enemy: { health } })), holding(Input.ACTION), FIXED_DT);
    const hit = stepUntil(thrown, (s) => liveEnemies(s).length === 0);
    assert.deepEqual(liveEnemies(hit), []);
  });

  test('a thrown object defeats every enemy it overlaps in the same step', () => {
    const state = enemyState(['..........G', '...........', 'P..........', '###########'], THROWN);
    const crate = thrownCrate(5, 1, THROW_SPEED.x, 0);
    const twoEnemies = [enemyAt(state, crate.x + 0.5, crate.y), enemyAt(state, crate.x - 0.5, crate.y)];
    const after = step({ ...state, objects: [crate], enemies: twoEnemies }, NO_INPUT, FIXED_DT);
    assert.deepEqual(liveEnemies(after), []);
  });

  test('after a hit, the falling object doesn\'t defeat another enemy it falls onto', () => {
    // A thrown crate hits an enemy high up; another enemy waits on the ground straight below.
    // Both enemies barely move, so the one below is still under the crate when it lands.
    const crawling = 0.01;
    const state = enemyState(['..........G', '...........', '...........', 'P..........', '###########'], { ...THROWN, enemy: { speed: crawling } });
    const crate = thrownCrate(5, 0, THROW_SPEED.x, 0);
    const high = enemyAt(state, crate.x + 0.5, crate.y);
    const below = new Enemy({ ...enemyAt(state, crate.x, 3), vx: 0 });
    const hit = step({ ...state, objects: [crate], enemies: [high, below] }, NO_INPUT, FIXED_DT);
    assert.equal(liveEnemies(hit).length, 1, 'the high enemy was hit');
    const landed = stepUntil(hit, (s) => s.objects[0].resting);
    assert.equal(liveEnemies(landed).length, 1, 'the enemy below survives the falling crate');
  });

  test('a crate that falls onto an enemy without being thrown doesn\'t defeat it', () => {
    const crawling = 0.01;   // so the enemy stays under the falling crate
    const state = enemyState(['..c.......G', '...........', '..e.....P..', '###########'], { enemy: { speed: crawling } });
    const landed = stepUntil(state, (s) => s.objects[0].resting);
    assert.equal(liveEnemies(landed).length, 1);
  });

  test('a dropped object doesn\'t defeat an enemy it is dropped onto', () => {
    // The enemy is right beside the player, where the drop puts the object.
    const state = holdingCrate(enemyState(['..........G', '...........', '.P.........', '###########'], THROWN));
    const { player } = state;
    const besideFeet = { ...state, enemies: [new Enemy({ ...enemyAt(state, player.x + player.width, player.y), vx: 0 })] };
    const dropped = step(besideFeet, holding(Input.DOWN, Input.ACTION), FIXED_DT);
    assert.equal(dropped.objects[0].held, false, 'the crate was dropped');
    assert.equal(liveEnemies(dropped).length, 1);
  });

  test('a held object touching an enemy doesn\'t defeat it', () => {
    const state = holdingCrate(enemyState(['..........G', '...........', '.P.........', '###########'], THROWN));
    const crate = state.objects[0];
    const touchingCrate = { ...state, enemies: [new Enemy({ ...enemyAt(state, crate.x + 0.5, crate.y), vx: 0 })] };
    assert.equal(liveEnemies(step(touchingCrate, NO_INPUT, FIXED_DT)).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Task 5.10: the defeat state (req 53). Decided:
//  - a defeated enemy (stomped, punched to 0, or hit by a thrown object)
//    stays for defeatSeconds (tuning), so the renderer can flash it, then is
//    removed; with defeatSeconds 0 it is removed at once;
//  - Enemy.defeatTime is the time it has left (more than 0 means defeated);
//    it counts down at the start of each step, so every way of defeating an
//    enemy gets the full time;
//  - while defeated it is frozen (it doesn't walk or fall) and harmless: it
//    can't hurt the player, and can't be stomped, punched, or hit again.

describe('defeat (req 53)', () => {
  const DEFEAT_SECONDS = 0.5;
  const DEFEAT = { tuning: { defeatSeconds: DEFEAT_SECONDS } };
  // The enemy stands on a 1-tile pillar (column 5); the player drops onto it from above.
  const PILLAR_GRID = ['.....P...G', '..........', '..........', '.....e....', '.....#....', '##########'];

  /** Steps until the pillar enemy has been stomped, and returns that state. */
  const stomped = (options = DEFEAT) => stepUntil(enemyState(PILLAR_GRID, options), (s) => liveEnemies(s).length === 0);

  /** The state with one enemy at (x, y) already defeated, with `left` seconds of its defeat state left. */
  function withDefeatedEnemy(state, x, y, left = DEFEAT_SECONDS) {
    return { ...state, enemies: [new Enemy({ ...enemyAt(state, x, y), health: 0, defeatTime: left })] };
  }

  test('a stomped enemy stays, defeated, with defeatSeconds left', () => {
    const state = stomped();
    assert.equal(state.enemies.length, 1, 'it is still in the level');
    assert.deepEqual(liveEnemies(state), [], 'but it is defeated');
    assert.equal(state.enemies[0].defeatTime, DEFEAT_SECONDS);
  });

  test('its time counts down each step, and it is removed once defeatSeconds have passed', () => {
    const stepsToRemoval = DEFEAT_SECONDS * STEPS_PER_SECOND;
    let state = stomped();
    state = step(state, NO_INPUT, FIXED_DT);
    assertNear(state.enemies[0].defeatTime, DEFEAT_SECONDS - FIXED_DT, 'defeatTime after one step');
    for (let i = 1; i < stepsToRemoval - 1; i++) state = step(state, NO_INPUT, FIXED_DT);
    assert.equal(state.enemies.length, 1, `still there after ${stepsToRemoval - 1} steps`);
    state = step(state, NO_INPUT, FIXED_DT);
    assert.deepEqual(state.enemies, [], `removed after ${stepsToRemoval} steps`);
  });

  test('with defeatSeconds 0 a defeated enemy is removed at once', () => {
    const state = stomped({ tuning: { defeatSeconds: 0 } });
    assert.deepEqual(state.enemies, []);
  });

  test('punching an enemy to 0 health and hitting one with a thrown object also leave it in its defeat state', () => {
    const state = enemyState(['..........G', '...........', '..P........', '###########'], DEFEAT);
    const { player } = state;
    // One enemy overlapping the player's front edge (punched), one high up in a thrown crate's path.
    const punched = new Enemy({ ...enemyAt(state, player.x + player.width - 0.5, player.y), health: 1 });
    const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: 6, y: 0, vx: 8, vy: 0, thrown: true });
    const hit = enemyAt(state, crate.x + 0.5, crate.y);
    const after = step({ ...state, enemies: [punched, hit], objects: [crate] }, holding(Input.PUNCH), FIXED_DT);
    assert.deepEqual(after.enemies.map((e) => e.defeatTime), [DEFEAT_SECONDS, DEFEAT_SECONDS]);
  });

  test('while defeated it is frozen: it doesn\'t walk or fall', () => {
    // Defeated in mid-air, with open space below and beside it.
    const state = withDefeatedEnemy(enemyState(['..........G', '...........', '...........', 'P..........', '###########'], DEFEAT), 5, 0);
    const [before] = state.enemies;
    let current = state;
    for (let i = 0; i < 10; i++) {
      current = step(current, NO_INPUT, FIXED_DT);
      assert.equal(current.enemies[0].x, before.x, `x at step ${i}`);
      assert.equal(current.enemies[0].y, before.y, `y at step ${i}`);
    }
  });

  test('a defeated enemy can\'t hurt the player', () => {
    const state = enemyState(['..........G', '...........', '..P........', '###########'], DEFEAT);
    const { player } = state;
    const touching = withDefeatedEnemy(state, player.x, player.y);
    assert.equal(step(touching, NO_INPUT, FIXED_DT).player.health, player.health);
  });

  test('a defeated enemy can\'t be stomped again: the player falls through it without a bounce', () => {
    const state = enemyState(['..........G', '...........', '...........', '..P........', '###########'], DEFEAT);
    const fallSpeed = 3;
    const player = new Player({ ...state.player, y: 1, vy: fallSpeed });
    const below = withDefeatedEnemy({ ...state, player }, player.x, player.y + player.height + 0.01);
    const after = step(below, NO_INPUT, FIXED_DT);
    assert.ok(after.player.vy > 0, `still falling: vy ${after.player.vy}`);
    assertNear(after.enemies[0].defeatTime, DEFEAT_SECONDS - FIXED_DT, 'its time just counts down');
  });

  test('a defeated enemy can\'t be punched: its time just counts down', () => {
    const state = enemyState(['..........G', '...........', '..P........', '###########'], DEFEAT);
    const { player } = state;
    const inReach = withDefeatedEnemy(state, player.x + player.width - 0.5, player.y);
    const after = step(inReach, holding(Input.PUNCH), FIXED_DT);
    assertNear(after.enemies[0].defeatTime, DEFEAT_SECONDS - FIXED_DT, 'defeatTime');
  });

  test('a thrown object passes through a defeated enemy, still thrown', () => {
    const state = enemyState(['..........G', '...........', 'P..........', '###########'], DEFEAT);
    const throwSpeed = 8;
    const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: 5, y: 0, vx: throwSpeed, vy: 0, thrown: true });
    const after = step({ ...withDefeatedEnemy(state, crate.x + 0.5, crate.y), objects: [crate] }, NO_INPUT, FIXED_DT);
    assert.equal(after.objects[0].thrown, true);
    assert.equal(after.objects[0].vx, throwSpeed);
  });

  test('a restart brings defeated enemies back, undefeated', () => {
    const state = stomped();
    const lastLife = { ...state, player: new Player({ ...state.player, health: 0 }) };
    const restarted = step(lastLife, NO_INPUT, FIXED_DT);
    assert.equal(liveEnemies(restarted).length, restarted.levelStart.enemies.length);
    assert.equal(restarted.enemies[0].defeatTime, 0);
  });
});

/** A 1 × 1 enemy of the level's beetle type at (x, y), walking left. */
function enemyAt(state, x, y) {
  return new Enemy({ type: 'beetle', ...ONE_TILE, x, y, facing: Facing.LEFT, health: 1, vx: -state.data.characters.beetle.speed });
}
