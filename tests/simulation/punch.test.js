// Tests for punching (task 5.6 reach, 5.7 damage, 5.8 carrying; PRD reqs 38-41).
//
// Decided for the reach:
//  - the punch area runs sideways from the player's front edge (the side they
//    face) out to the edge of their sprite frame on that side; the frame is
//    drawn bottom-centred on the collision box, frameWidth / pixelsPerTile
//    tiles wide (docs/data-formats.md);
//  - with no sprite, or a frame no wider than the body, the area has no width:
//    it is just the player's front edge;
//  - the area is as tall as the player's collision box;
//  - an enemy is in reach if it overlaps the area or touches it, so with no
//    sprite exactly the enemies touching or overlapping the front edge are;
//    enemies behind the player aren't.
// Decided for pressing: only a new press of punch punches (holding doesn't
// repeat it); a punch starts the punch flash, punchTime, at punchSeconds
// (tuning), which counts down each step.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player } from '../../src/simulation/player.js';
import { Enemy } from '../../src/simulation/enemies.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { punchArea, enemiesInReach } from '../../src/simulation/punch.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const BODY = { width: 0.8, height: 1.4 };
const PUNCH_SECONDS = 0.15;
// Open ground; the player stands in column 4 of row 1.
const GRID = ['..........G', '....P......', '###########'];

/** A sprite sheet whose frames are `frameWidth` × 48 pixels at 32 pixels per tile. */
function spriteSheet(frameWidth) {
  return {
    formatVersion: 1, image: 'sprites/hero.png', frameWidth, frameHeight: 48, pixelsPerTile: 32,
    animations: { idle: { frames: [0], fps: 1 } },
  };
}

/**
 * A state with a BODY-sized player, facing `facing`. With `sheet`, the player
 * has the sprite "hero" with that sheet; with `spriteName` but no sheet, the
 * player names a sprite that isn't in the data. `player` and `enemy` are
 * fields merged into the player's and the beetle's definitions.
 */
function punchState({ sheet, spriteName = sheet ? 'hero' : undefined, facing = Facing.RIGHT, player = {}, enemy = {} } = {}) {
  const data = buildData(GRID, {
    player: { size: BODY, ...(spriteName ? { sprite: spriteName } : {}), ...player },
    enemy,
    tuning: { punchSeconds: PUNCH_SECONDS },
  });
  if (sheet) data.sprites.hero = sheet;
  const state = createLevelState(data, TEST_LEVEL);
  return { ...state, player: new Player({ ...state.player, facing }) };
}

/** The frame's width in tiles, for a sheet from spriteSheet(). */
const frameTiles = (sheet) => sheet.frameWidth / sheet.pixelsPerTile;

/** A 1 × 1 enemy at (x, y). */
const enemyAt = (x, y) => new Enemy({ type: 'beetle', x, y, width: 1, height: 1, health: 1 });

const right = (box) => box.x + box.width;

function assertBoxNear(actual, expected) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${key} was ${actual[key]}, expected ${expected[key]}`);
  }
}

describe('reach (reqs 38-39)', () => {
  describe('the punch area', () => {
    const WIDE = spriteSheet(48);   // 1.5 tiles wide: wider than the 0.8-tile body

    test('facing right: from the body\'s right edge to the frame\'s right edge, as tall as the body', () => {
      const state = punchState({ sheet: WIDE, facing: Facing.RIGHT });
      const { player } = state;
      const beyondBody = (frameTiles(WIDE) - player.width) / 2;   // the frame is centred on the body
      assertBoxNear(punchArea(state), { x: right(player), y: player.y, width: beyondBody, height: player.height });
    });

    test('facing left: from the body\'s left edge to the frame\'s left edge', () => {
      const state = punchState({ sheet: WIDE, facing: Facing.LEFT });
      const { player } = state;
      const beyondBody = (frameTiles(WIDE) - player.width) / 2;
      assertBoxNear(punchArea(state), { x: player.x - beyondBody, y: player.y, width: beyondBody, height: player.height });
    });

    test('with no sprite, the area is just the front edge: no width', () => {
      const state = punchState({ facing: Facing.RIGHT });
      const { player } = state;
      assertBoxNear(punchArea(state), { x: right(player), y: player.y, width: 0, height: player.height });
    });

    test('with a frame narrower than the body, the area is just the front edge: it never reaches inside the body', () => {
      const narrow = spriteSheet(16);   // 0.5 tiles wide
      assert.ok(frameTiles(narrow) < BODY.width);
      const state = punchState({ sheet: narrow, facing: Facing.LEFT });
      const { player } = state;
      assertBoxNear(punchArea(state), { x: player.x, y: player.y, width: 0, height: player.height });
    });

    test('a sprite named by the player but missing from the data counts as no sprite', () => {
      const state = punchState({ spriteName: 'missing', facing: Facing.RIGHT });
      assert.equal(punchArea(state).width, 0);
    });
  });

  describe('enemies in reach', () => {
    const WIDE = spriteSheet(48);
    const GAP = 0.01;

    /** The punch area of a state facing right with the WIDE sprite, and that state. */
    function facingRight() {
      const state = punchState({ sheet: WIDE, facing: Facing.RIGHT });
      return { state, area: punchArea(state) };
    }

    test('an enemy just inside the reach is in reach', () => {
      const { state, area } = facingRight();
      const enemy = enemyAt(right(area) - GAP, state.player.y);
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), [enemy]);
    });

    test('an enemy just outside the reach is not', () => {
      const { state, area } = facingRight();
      const enemy = enemyAt(right(area) + GAP, state.player.y);
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), []);
    });

    test('an enemy exactly touching the far edge of the reach is in reach', () => {
      const { state, area } = facingRight();
      const enemy = enemyAt(right(area), state.player.y);
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), [enemy]);
    });

    test('an enemy behind the player is not in reach, even touching their back', () => {
      const { state } = facingRight();
      const enemy = enemyAt(state.player.x - 1, state.player.y);   // its right edge touches the player's left edge
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), []);
    });

    test('an enemy above the body\'s height, with a gap, is not in reach', () => {
      const { state, area } = facingRight();
      const enemy = enemyAt(area.x, area.y - 1 - GAP);
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), []);
    });

    test('an enemy partly level with the body is in reach', () => {
      const { state, area } = facingRight();
      const enemy = enemyAt(area.x, area.y - 0.5);   // half of it above the player's head
      assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), [enemy]);
    });

    test('every enemy in reach is found', () => {
      const { state, area } = facingRight();
      const near = enemyAt(area.x, state.player.y);
      const far = enemyAt(right(area) - GAP, state.player.y);
      const behind = enemyAt(state.player.x - 1, state.player.y);
      assert.deepEqual(enemiesInReach({ ...state, enemies: [near, behind, far] }), [near, far]);
    });

    describe('with no sprite (only enemies touching the front edge)', () => {
      test('an enemy flush against the player\'s front is in reach', () => {
        const state = punchState({ facing: Facing.RIGHT });
        const enemy = enemyAt(right(state.player), state.player.y);
        assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), [enemy]);
      });

      test('an enemy overlapping the player\'s front edge is in reach', () => {
        const state = punchState({ facing: Facing.RIGHT });
        const enemy = enemyAt(right(state.player) - 0.5, state.player.y);
        assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), [enemy]);
      });

      test('an enemy with a gap in front of the player is not', () => {
        const state = punchState({ facing: Facing.RIGHT });
        const enemy = enemyAt(right(state.player) + GAP, state.player.y);
        assert.deepEqual(enemiesInReach({ ...state, enemies: [enemy] }), []);
      });
    });
  });
});

describe('one punch per press (req 38)', () => {
  const PUNCH = holding(Input.PUNCH);

  test('pressing punch starts a punch: the flash time is punchSeconds from tuning', () => {
    const after = step(punchState(), PUNCH, FIXED_DT);
    assert.equal(after.player.punchTime, PUNCH_SECONDS);
  });

  test('the flash counts down each step and ends after punchSeconds', () => {
    let state = step(punchState(), PUNCH, FIXED_DT);
    state = step(state, NO_INPUT, FIXED_DT);
    assert.ok(Math.abs(state.player.punchTime - (PUNCH_SECONDS - FIXED_DT)) < 1e-9, `punchTime was ${state.player.punchTime}`);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, NO_INPUT, FIXED_DT);
    assert.equal(state.player.punchTime, 0);
  });

  test('holding punch doesn\'t punch again: once the flash ends it stays ended', () => {
    let state = step(punchState(), PUNCH, FIXED_DT);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, PUNCH, FIXED_DT);
    assert.equal(state.player.punchTime, 0);
  });

  test('releasing punch and pressing it again punches again', () => {
    let state = step(punchState(), PUNCH, FIXED_DT);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, PUNCH, FIXED_DT);
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PUNCH, FIXED_DT);
    assert.equal(state.player.punchTime, PUNCH_SECONDS);
  });

  test('the player remembers whether punch was held', () => {
    assert.equal(step(punchState(), PUNCH, FIXED_DT).player.punchHeld, true);
    assert.equal(step(punchState(), NO_INPUT, FIXED_DT).player.punchHeld, false);
  });

  test('turning and punching in the same step punches in the new direction', () => {
    const after = step(punchState({ facing: Facing.RIGHT }), holding(Input.LEFT, Input.PUNCH), FIXED_DT);
    assert.equal(after.player.facing, Facing.LEFT);
    assert.ok(right(punchArea(after)) <= after.player.x + 1e-9, 'the punch area is on the player\'s left');
  });
});

// ---------------------------------------------------------------------------
// Task 5.7: punch damage (req 40). On the step a punch is pressed, every enemy
// in reach loses health equal to the player definition's punchDamage (1 if it
// has none, docs/data-formats.md), and is defeated (defeatEnemy, enemies.js)
// when its health reaches 0. Holding the button doesn't damage again.

// Shared by the damage and carrying tests. The player has a sprite frame wider
// than their body, so the punch reaches past their front edge; the test enemies
// stand inside that reach, clear of the player, and barely move, so they stay in reach.
const PUNCH = holding(Input.PUNCH);
const WIDE_SHEET = spriteSheet(48);
const CRAWLING = { speed: 0.0001 };
const INSIDE_REACH = 0.1;   // tiles past the player's front edge; the WIDE_SHEET reach is wider than this

/** A 1 × 1 enemy with `health`, on the ground, `offset` tiles past the player's front (they face right). */
function enemyInFront(state, health, offset = INSIDE_REACH) {
  const { player } = state;
  return new Enemy({ type: 'beetle', x: right(player) + offset, y: player.y + player.height - 1, width: 1, height: 1,
    health, facing: Facing.RIGHT });
}

/** A state facing right, with the WIDE_SHEET sprite, the player definition's punchDamage set, and one enemy of `health` in reach. */
function oneEnemy({ punchDamage, health }) {
  const state = punchState({ sheet: WIDE_SHEET, player: { punchDamage }, enemy: CRAWLING });
  assert.ok(punchArea(state).width > INSIDE_REACH, 'the enemy starts inside the reach');
  return { ...state, enemies: [enemyInFront(state, health)] };
}

describe('damage (req 40)', () => {

  test('damage 1 against health 1: the enemy is defeated', () => {
    const after = step(oneEnemy({ punchDamage: 1, health: 1 }), PUNCH, FIXED_DT);
    assert.deepEqual(after.enemies, []);
  });

  test('health greater than damage: the enemy loses health equal to the damage and survives', () => {
    const punchDamage = 1;
    const health = 3;
    const after = step(oneEnemy({ punchDamage, health }), PUNCH, FIXED_DT);
    assert.equal(after.enemies.length, 1);
    assert.equal(after.enemies[0].health, health - punchDamage);
  });

  test('the damage comes from the player definition', () => {
    const punchDamage = 2;
    const health = 3;
    const after = step(oneEnemy({ punchDamage, health }), PUNCH, FIXED_DT);
    assert.equal(after.enemies[0].health, health - punchDamage);
  });

  test('damage greater than the enemy\'s health defeats it', () => {
    const after = step(oneEnemy({ punchDamage: 3, health: 2 }), PUNCH, FIXED_DT);
    assert.deepEqual(after.enemies, []);
  });

  test('a player definition with no punchDamage deals 1', () => {
    const defaultDamage = 1;   // docs/data-formats.md: punchDamage defaults to 1
    const health = 3;
    const state = oneEnemy({ punchDamage: 2, health });
    const { punchDamage, ...withoutPunchDamage } = state.data.characters.player;
    const data = { ...state.data, characters: { ...state.data.characters, player: withoutPunchDamage } };
    const after = step({ ...state, data }, PUNCH, FIXED_DT);
    assert.equal(after.enemies[0].health, health - defaultDamage);
  });

  test('not pressing punch does no damage', () => {
    const health = 1;
    const after = step(oneEnemy({ punchDamage: 1, health }), NO_INPUT, FIXED_DT);
    assert.equal(after.enemies[0].health, health);
  });

  test('holding punch damages only once', () => {
    const punchDamage = 1;
    const health = 3;
    let state = step(oneEnemy({ punchDamage, health }), PUNCH, FIXED_DT);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, PUNCH, FIXED_DT);
    assert.equal(state.enemies[0].health, health - punchDamage);
  });

  test('each new press damages again', () => {
    const punchDamage = 1;
    const health = 3;
    let state = step(oneEnemy({ punchDamage, health }), PUNCH, FIXED_DT);
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PUNCH, FIXED_DT);
    assert.equal(state.enemies[0].health, health - 2 * punchDamage);
  });

  test('every enemy in reach is damaged; enemies out of reach are not', () => {
    const punchDamage = 1;
    const health = 3;
    const state = punchState({ sheet: WIDE_SHEET, player: { punchDamage }, enemy: CRAWLING });
    const near = enemyInFront(state, health);
    const further = enemyInFront(state, health, 2 * INSIDE_REACH);
    const outOfReach = enemyInFront(state, health, 2);
    const after = step({ ...state, enemies: [near, further, outOfReach] }, PUNCH, FIXED_DT);
    assert.deepEqual(after.enemies.map((e) => e.health), [health - punchDamage, health - punchDamage, health]);
  });
});

// ---------------------------------------------------------------------------
// Task 5.8: no punching while carrying (req 41). Decided:
//  - "carrying" is judged once this step's pick-up, throw, or drop has
//    happened: throw and punch pressed together throw and punch; pick-up and
//    punch pressed together pick up and don't punch;
//  - a press made while carrying is used up: the button still counts as held,
//    so letting go of the object while holding punch doesn't punch; only a new
//    press does.

describe('carrying (req 41)', () => {
  const HEALTH = 3;
  const PUNCH_AND_ACTION = holding(Input.PUNCH, Input.ACTION);

  /** The state with the player holding a 1 × 1 crate above their head. */
  function holdingCrate(state) {
    const { player } = state;
    const crate = new CarriableObject({
      type: 'crate', width: 1, height: 1, x: player.x + player.width / 2 - 0.5, y: player.y - 1, held: true,
    });
    return { ...state, objects: [...state.objects, crate] };
  }

  test('pressing punch while carrying doesn\'t punch: no flash and no damage', () => {
    const state = holdingCrate(oneEnemy({ punchDamage: 1, health: HEALTH }));
    const after = step(state, PUNCH, FIXED_DT);
    assert.equal(after.player.punchTime, 0);
    assert.equal(after.enemies[0].health, HEALTH);
  });

  test('a press made while carrying is used up: throwing while still holding punch doesn\'t punch', () => {
    let state = holdingCrate(oneEnemy({ punchDamage: 1, health: HEALTH }));
    state = step(state, PUNCH, FIXED_DT);              // pressed while carrying
    assert.equal(state.player.punchTime, 0, 'no punch while carrying');
    state = step(state, PUNCH_AND_ACTION, FIXED_DT);   // throws, punch still held
    assert.equal(state.objects[0].held, false, 'the crate was thrown');
    assert.equal(state.player.punchTime, 0, 'no punch on letting go');
    for (let i = 0; i < 10; i++) {
      state = step(state, PUNCH, FIXED_DT);
      assert.equal(state.player.punchTime, 0, `no punch while still holding the button, step ${i}`);
    }
  });

  test('after letting go, a new press of punch punches', () => {
    let state = holdingCrate(oneEnemy({ punchDamage: 1, health: HEALTH }));
    state = step(state, PUNCH, FIXED_DT);
    state = step(state, PUNCH_AND_ACTION, FIXED_DT);   // throws
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PUNCH, FIXED_DT);
    assert.equal(state.player.punchTime, PUNCH_SECONDS);
  });

  test('pressing throw and punch together throws and punches', () => {
    const state = holdingCrate(oneEnemy({ punchDamage: 1, health: HEALTH }));
    const after = step(state, PUNCH_AND_ACTION, FIXED_DT);
    assert.equal(after.objects[0].held, false, 'the crate was thrown');
    assert.equal(after.player.punchTime, PUNCH_SECONDS);
  });

  test('pressing drop and punch together drops and punches', () => {
    const state = holdingCrate(oneEnemy({ punchDamage: 1, health: HEALTH }));
    const after = step(state, holding(Input.DOWN, Input.ACTION, Input.PUNCH), FIXED_DT);
    assert.equal(after.objects[0].held, false, 'the crate was dropped');
    assert.equal(after.player.punchTime, PUNCH_SECONDS);
  });

  test('pressing pick-up and punch together picks up and doesn\'t punch', () => {
    // A crate on the ground behind the player (they face right), touching their back.
    const state = oneEnemy({ punchDamage: 1, health: HEALTH });
    const { player } = state;
    const crate = new CarriableObject({
      type: 'crate', width: 1, height: 1, x: player.x - 1, y: player.y + player.height - 1, resting: true,
    });
    const after = step({ ...state, objects: [crate] }, PUNCH_AND_ACTION, FIXED_DT);
    assert.equal(after.objects[0].held, true, 'the crate was picked up');
    assert.equal(after.player.punchTime, 0);
    assert.equal(after.enemies[0].health, HEALTH);
  });

  test('not carrying, punch works as usual', () => {
    const after = step(oneEnemy({ punchDamage: 1, health: HEALTH }), PUNCH, FIXED_DT);
    assert.equal(after.player.punchTime, PUNCH_SECONDS);
  });
});
