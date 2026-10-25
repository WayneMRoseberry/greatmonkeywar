// Tests for carriable objects: picking up (tasks 4.2, 4.2a; PRD reqs 29-30)
// throwing (task 4.3; req 31), dropping (task 4.4; req 32), falling and resting
// (task 4.5; req 34), and stacking (task 4.6; req 35).
//
// Grids use the standard legend (level-builder.js): c is a stackable crate,
// o a coconut. Unless a test says otherwise the player is 1 × 1 tile, so a
// player and an object in neighbouring cells share an edge.
//
// Decided for picking up:
//  - "touching" means the boxes overlap or share an edge (not just a corner);
//  - of several touched objects, those on the side the player faces come
//    first, then the one whose centre is nearest the player's centre, then
//    the first in grid order;
//  - only a new press of action picks up: holding action doesn't.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../../src/simulation/step.js';
import { Player } from '../../src/simulation/player.js';
import { CarriableObject } from '../../src/simulation/objects.js';
import { FIXED_DT, STEPS_PER_SECOND, Facing } from '../../src/simulation/constants.js';
import { overlapsSolid, overlapsBox } from '../../src/simulation/collision.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const ONE_TILE = { width: 1, height: 1 };

function stateFor(grid, playerSize = ONE_TILE) {
  return createLevelState(buildData(grid, { player: { size: playerSize } }), TEST_LEVEL);
}

/** The state with the player's properties changed. */
function withPlayer(state, changes) {
  return { ...state, player: new Player({ ...state.player, ...changes }) };
}

const PRESS_ACTION = holding(Input.ACTION);

/** The indexes (in grid order) of the objects being held. */
const heldIndexes = (state) => state.objects.flatMap((o, i) => (o.held ? [i] : []));

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

/** Held objects sit with the bottom-centre of their box at the top-centre of the player's. */
function assertAboveHead(object, player, when) {
  assertNear(object.x + object.width / 2, player.x + player.width / 2, `object centre x ${when}`);
  assertNear(object.y + object.height, player.y, `object bottom ${when}`);
}

describe('the CarriableObject structure', () => {
  const PROPERTIES = ['type', 'x', 'y', 'width', 'height', 'vx', 'vy', 'resting', 'held', 'thrown'];

  test('has exactly the declared properties', () => {
    assert.deepEqual(Object.keys(new CarriableObject()).sort(), [...PROPERTIES].sort());
  });

  test('starts not held and not thrown', () => {
    const object = new CarriableObject();
    assert.equal(object.held, false);
    assert.equal(object.thrown, false);
  });
});

describe('pick up (reqs 29-30)', () => {
  describe('touching', () => {
    test('pressing action next to an object, sharing an edge, picks it up', () => {
      const state = stateFor(['.Pc.G', '#####']);
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
    });

    test('pressing action while overlapping an object picks it up', () => {
      // A crate in exactly the player's box.
      const state = stateFor(['.P..G', '#####']);
      const crate = new CarriableObject({ type: 'crate', x: state.player.x, y: state.player.y, ...ONE_TILE, resting: true });
      assert.deepEqual(heldIndexes(step({ ...state, objects: [crate] }, PRESS_ACTION, FIXED_DT)), [0]);
    });

    test('pressing action with a gap between the player and the object does nothing', () => {
      const state = stateFor(['.P.c.G', '######']);
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), []);
    });

    test('an object touching the player only at a corner is not picked up', () => {
      // The crate is up and to the right of the player: their corners meet.
      const state = stateFor(['..c.G', '.P...', '#####']);
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), []);
    });

    test('touching an object without pressing action does nothing', () => {
      const state = stateFor(['.Pc.G', '#####']);
      assert.deepEqual(heldIndexes(step(state, NO_INPUT, FIXED_DT)), []);
    });

    test('any kind of object can be picked up, stackable or not', () => {
      // A coconut (not stackable) on the ground, against the player's right side.
      const state = stateFor(['.P..G', '#####']);
      const { coconut } = state.data.objects;
      const object = new CarriableObject({
        type: 'coconut', x: state.player.x + state.player.width,
        y: state.player.y + state.player.height - coconut.size.height, ...coconut.size, resting: true,
      });
      assert.equal(coconut.stackable ?? false, false);
      assert.deepEqual(heldIndexes(step({ ...state, objects: [object] }, PRESS_ACTION, FIXED_DT)), [0]);
    });
  });

  describe('only a new press picks up', () => {
    test('action held since the last step does not pick up', () => {
      const state = withPlayer(stateFor(['.Pc.G', '#####']), { actionHeld: true });
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), []);
    });

    test('releasing action and pressing it again picks up', () => {
      const state = withPlayer(stateFor(['.Pc.G', '#####']), { actionHeld: true });
      const released = step(state, NO_INPUT, FIXED_DT);
      assert.deepEqual(heldIndexes(step(released, PRESS_ACTION, FIXED_DT)), [0]);
    });

    test('walking into an object while holding action from before does not pick it up', () => {
      // The player starts with a gap to the crate, holding action, and runs right into it.
      let state = stateFor(['P.c..G', '######']);
      const runAndAction = holding(Input.RIGHT, Input.ACTION);
      state = step(state, runAndAction, FIXED_DT);   // a new press, but nothing is touching yet
      assert.deepEqual(heldIndexes(state), []);
      for (let i = 0; i < 60; i++) state = step(state, runAndAction, FIXED_DT);
      assert.deepEqual(heldIndexes(state), []);
    });

    test('the player remembers whether action was held', () => {
      const state = stateFor(['.P..G', '#####']);
      assert.equal(step(state, PRESS_ACTION, FIXED_DT).player.actionHeld, true);
      assert.equal(step(state, NO_INPUT, FIXED_DT).player.actionHeld, false);
    });
  });

  describe('the held object', () => {
    test('moves above the player\'s head in the same step it is picked up', () => {
      const after = step(stateFor(['.Pc.G', '#####']), PRESS_ACTION, FIXED_DT);
      assertAboveHead(after.objects[0], after.player, 'after picking up');
    });

    test('sits above the head of a player of any size, centred', () => {
      const tall = { width: 0.6, height: 1.8 };
      const state = stateFor(['......G', '.......', '..P....', '#######'], tall);
      // A coconut overlapping the player's feet.
      const { coconut } = state.data.objects;
      const object = new CarriableObject({ type: 'coconut', x: state.player.x, y: state.player.y + state.player.height - coconut.size.height, ...coconut.size, resting: true });
      const after = step({ ...state, objects: [object] }, PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(after), [0]);
      assertAboveHead(after.objects[0], after.player, 'after picking up');
    });

    test('follows the player as they run and jump', () => {
      let state = step(stateFor(['..........', '.Pc......G', '##########']), PRESS_ACTION, FIXED_DT);
      const script = [holding(Input.RIGHT), holding(Input.RIGHT, Input.JUMP), holding(Input.LEFT), NO_INPUT];
      for (const input of script) {
        for (let i = 0; i < 10; i++) {
          state = step(state, input, FIXED_DT);
          assertAboveHead(state.objects[0], state.player, `holding ${JSON.stringify(input)}, step ${i}`);
        }
      }
    });

    test('is not moving on its own and not at rest', () => {
      const [object] = step(stateFor(['.Pc.G', '#####']), PRESS_ACTION, FIXED_DT).objects;
      assert.equal(object.vx, 0);
      assert.equal(object.vy, 0);
      assert.equal(object.resting, false);
    });

    test('stays held when action is released', () => {
      let state = step(stateFor(['.Pc.G', '#####']), PRESS_ACTION, FIXED_DT);
      for (let i = 0; i < 10; i++) state = step(state, NO_INPUT, FIXED_DT);
      assert.deepEqual(heldIndexes(state), [0]);
    });
  });

  describe('one object at a time (req 30)', () => {
    test('pressing action again while holding one does not pick up another it touches', () => {
      // Crates on both sides; the player picks up the one in front (right), turns, and presses again.
      let state = step(stateFor(['cPc.G', '#####']), PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(state), [1]);
      state = step(state, NO_INPUT, FIXED_DT);
      state = withPlayer(state, { facing: Facing.LEFT });
      state = step(state, PRESS_ACTION, FIXED_DT);
      assert.equal(state.objects[0].held, false);
    });
  });

  describe('choosing among several touched objects', () => {
    const WIDE = { width: 3, height: 1 };   // placed in column 2, it spans columns 1-3

    test('an object on the side the player faces is chosen over a nearer one behind', () => {
      // Facing right: crate 0 (column 1) is behind and nearer; crate 1 (column 4) is in front, touching.
      const state = stateFor(['.cP.c..G', '########'], WIDE);
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [1]);
    });

    test('facing left, the object on the left is chosen', () => {
      const state = withPlayer(stateFor(['cPc.G', '#####']), { facing: Facing.LEFT });
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
    });

    test('of several in front, the one whose centre is nearest is chosen, even if it comes later in grid order', () => {
      // Facing left: crate 0 (column 0) touches the player's left edge; crate 1 (column 1) is inside the player, nearer.
      const state = withPlayer(stateFor(['ccP...G', '#######'], WIDE), { facing: Facing.LEFT });
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [1]);
    });

    test('with nothing in front, an object behind is picked up', () => {
      const state = stateFor(['cP..G', '#####']);   // facing right; the crate is on the left
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
    });

    test('equally near objects in front: the first in grid order is chosen', () => {
      // A 1 × 2 player with two crates stacked against its right side, centres equally far.
      const state = stateFor(['..c.G', '.Pc..', '#####'], { width: 1, height: 2 });
      assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 4.2a: the held object collides. Decided: the player and the held object
// move together as two boxes, so a barrier either one meets stops both; and
// picking up fails when the object wouldn't fit above the player's head.

/**
 * The state with one more object, of `type`, already held above the player's
 * head; it comes after the level's own objects (last in the list).
 * `definition` (optional) adds or replaces that object definition.
 */
function holdingNew(state, type, definition) {
  const data = definition ? { ...state.data, objects: { ...state.data.objects, [type]: definition } } : state.data;
  const { size } = data.objects[type];
  const { player } = state;
  const object = new CarriableObject({
    type, ...size, held: true,
    x: player.x + player.width / 2 - size.width / 2,
    y: player.y - size.height,
  });
  return { ...state, data, objects: [...state.objects, object] };
}

/** Steps `count` times with `input`, failing if an object is ever inside a solid tile; returns the last state. */
function stepNeverInsideSolid(state, input, count) {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = step(current, input, FIXED_DT);
    for (const object of current.objects) {
      assert.equal(overlapsSolid(current.level, object), null, `object inside a solid tile at step ${i}`);
    }
  }
  return current;
}

describe('carrying under barriers (task 4.2a)', () => {
  const OVERHANG_GRID = ['....###..', '.P......G', '#########'];   // the overhang covers columns 4-6 of row 0

  test('walking into an overhang too low for the held object stops the player, with the object flush against it', () => {
    const overhangColumn = 4;
    const state = holdingNew(stateFor(OVERHANG_GRID), 'crate');
    const after = stepNeverInsideSolid(state, holding(Input.RIGHT), STEPS_PER_SECOND);
    const [crate] = after.objects;
    assertNear(crate.x + crate.width, overhangColumn, 'crate right edge');
    assertAboveHead(crate, after.player, 'against the overhang');
    assert.equal(after.player.vx, 0);
  });

  test('without an object, the same player walks under the overhang', () => {
    const overhangColumn = 4;
    let state = stateFor(OVERHANG_GRID);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, holding(Input.RIGHT), FIXED_DT);
    assert.ok(state.player.x > overhangColumn, `player x was ${state.player.x}`);
  });

  test('a gap exactly the player\'s height plus the object\'s can be carried through', () => {
    const overhangEnd = 7;   // the overhang covers columns 4-6
    const state = holdingNew(stateFor(['....###..', '.........', '.P......G', '#########']), 'crate');
    const after = stepNeverInsideSolid(state, holding(Input.RIGHT), 2 * STEPS_PER_SECOND);
    assert.ok(after.player.x >= overhangEnd, `player x was ${after.player.x}`);
  });

  test('a wall the held object reaches first stops a narrower player before the player reaches it', () => {
    const wallColumn = 5;
    const narrow = { width: 0.6, height: 1 };
    const state = holdingNew(stateFor(['....G#', '.P...#', '######'], narrow), 'crate');
    const after = stepNeverInsideSolid(state, holding(Input.RIGHT), STEPS_PER_SECOND);
    const [crate] = after.objects;
    assertNear(crate.x + crate.width, wallColumn, 'crate right edge');
    assert.ok(after.player.x + after.player.width < wallColumn, 'the player is short of the wall');
    assert.equal(after.player.vx, 0);
  });

  test('jumping into a ceiling: the held object stops just below it, and the player stops rising', () => {
    const ceilingBottom = 1;   // the ceiling is row 0
    const state = holdingNew(stateFor(['#####', '.....', '.....', '.P..G', '#####']), 'crate');
    let current = stepNeverInsideSolid(state, holding(Input.JUMP), 1);
    let hitCeiling = false;
    for (let i = 0; i < STEPS_PER_SECOND && !hitCeiling; i++) {
      current = stepNeverInsideSolid(current, NO_INPUT, 1);
      const [crate] = current.objects;
      if (Math.abs(crate.y - ceilingBottom) < 1e-9) {
        hitCeiling = true;
        assert.equal(current.player.vy, 0, 'vy after the object hits the ceiling');
        assertAboveHead(crate, current.player, 'at the ceiling');
      }
    }
    assert.ok(hitCeiling, 'the held object never reached the ceiling');
  });

  test('a wide held object caught on a ledge holds the player up, and the player can jump from there', () => {
    // A 3-wide plank over a 1-wide player; the ledge in column 3 is beside the player, under the plank.
    const ledgeTop = 2;
    const plank = { formatVersion: 1, name: 'Plank', size: { width: 3, height: 0.5 }, color: '#8b5a2b' };
    const state = holdingNew(stateFor(['......', '..P...', '...#..', '......', '.....G', '######']), 'plank', plank);
    const landed = stepNeverInsideSolid(state, NO_INPUT, STEPS_PER_SECOND);
    const [held] = landed.objects;
    assertNear(held.y + held.height, ledgeTop, 'plank bottom');
    assert.equal(landed.player.onGround, true);
    assert.equal(landed.player.vy, 0);

    const jumped = step(landed, holding(Input.JUMP), FIXED_DT);
    assert.ok(jumped.player.vy < 0, `vy after pressing jump was ${jumped.player.vy}`);
  });

  test('a held object is never inside a solid over a long mixed run', () => {
    const grid = [
      '..........##........',
      '...##.......#.......',
      '..................#.',
      '.P......##.........G',
      '####################',
    ];
    let state = holdingNew(stateFor(grid), 'crate');
    const script = [holding(Input.RIGHT), holding(Input.RIGHT, Input.JUMP), NO_INPUT, holding(Input.LEFT, Input.JUMP), holding(Input.LEFT)];
    for (let round = 0; round < 4; round++) {
      for (const input of script) state = stepNeverInsideSolid(state, input, 20);
    }
  });
});

describe('no room to pick up (task 4.2a)', () => {
  const NARROW = { width: 0.6, height: 1 };

  test('in a tunnel only as high as the player, an object can\'t be picked up', () => {
    const state = stateFor(['#####', '.Pc.G', '#####']);
    const after = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(after), []);
    assert.deepEqual({ ...after.objects[0] }, { ...state.objects[0] });   // left where it was
  });

  test('a smaller object fits where a larger one doesn\'t', () => {
    // A tunnel 1 tile high; the player is half a tile tall, so half a tile is left above their head.
    const short = { width: 1, height: 0.5 };
    const state = stateFor(['#####', '.P..G', '#####'], short);
    const { coconut, crate } = state.data.objects;
    const beside = (type, size) => new CarriableObject({
      type, ...size, x: state.player.x + state.player.width, y: state.player.y + state.player.height - size.height, resting: true,
    });
    assert.equal(coconut.size.height, short.height);   // a coconut fits exactly above the player
    assert.ok(crate.size.height > short.height);       // a crate doesn't
    assert.deepEqual(heldIndexes(step({ ...state, objects: [beside('coconut', coconut.size)] }, PRESS_ACTION, FIXED_DT)), [0]);
    assert.deepEqual(heldIndexes(step({ ...state, objects: [beside('crate', crate.size)] }, PRESS_ACTION, FIXED_DT)), []);
  });

  test('against the level\'s left edge, an object wider than the player can\'t be picked up (it would stick out)', () => {
    const state = withPlayer(stateFor(['.P..G', '#####'], NARROW), { x: 0 });
    const crate = new CarriableObject({ type: 'crate', x: 0, y: state.player.y, ...ONE_TILE, resting: true });
    assert.deepEqual(heldIndexes(step({ ...state, objects: [crate] }, PRESS_ACTION, FIXED_DT)), []);
  });

  test('against a wall, an object wider than the player can\'t be picked up (it would overlap the wall)', () => {
    const wallRight = 1;   // the wall is column 0
    const state = withPlayer(stateFor(['#...G', '#P...', '#####'], NARROW), { x: wallRight });
    const crate = new CarriableObject({ type: 'crate', x: wallRight, y: state.player.y, ...ONE_TILE, resting: true });
    assert.deepEqual(heldIndexes(step({ ...state, objects: [crate] }, PRESS_ACTION, FIXED_DT)), []);
  });

  test('the same object can be picked up once the player steps away from the wall', () => {
    const wallRight = 1;
    const awayFromWall = wallRight + 0.5;
    const state = withPlayer(stateFor(['#...G', '#P...', '#####'], NARROW), { x: awayFromWall });
    const crate = new CarriableObject({ type: 'crate', x: awayFromWall, y: state.player.y, ...ONE_TILE, resting: true });
    assert.deepEqual(heldIndexes(step({ ...state, objects: [crate] }, PRESS_ACTION, FIXED_DT)), [0]);
  });
});

// ---------------------------------------------------------------------------
// Task 4.3: throwing. Decided:
//  - 4.3 is the launch only: objects don't move on their own until object
//    gravity and collision arrive (task 4.5), which also tests the arc;
//  - the throw speed is throwSpeed from tuning, whatever the player's own speed;
//  - a thrown object can't be picked up again until it lands (4.5 clears `thrown`).

describe('throw (req 31)', () => {
  const THROW_GRID = ['..........', '....P....G', '##########'];
  const THROW_SPEED = { x: 7, y: 3 };

  /**
   * A state where the player stands on the ground holding a crate; `playerChanges` adjusts the player.
   * Gravity is 0, so the speed the object is thrown with is still its speed after the throwing step
   * (objects start moving in the step they are released, task 4.5).
   */
  function throwState(playerChanges = {}) {
    const state = createLevelState(
      buildData(THROW_GRID, { player: { size: ONE_TILE }, tuning: { throwSpeed: THROW_SPEED, gravity: 0 } }), TEST_LEVEL);
    return holdingNew(withPlayer(state, playerChanges), 'crate');
  }

  test('pressing action while holding an object lets go of it, and it is thrown', () => {
    const after = step(throwState(), PRESS_ACTION, FIXED_DT);
    const [object] = after.objects;
    assert.equal(object.held, false);
    assert.equal(object.thrown, true);
    assert.equal(object.resting, false);
    assert.deepEqual(heldIndexes(after), []);
  });

  test('facing right, it is thrown forward to the right and upward, at the throw speed in tuning', () => {
    const [object] = step(throwState({ facing: Facing.RIGHT }), PRESS_ACTION, FIXED_DT).objects;
    assert.equal(object.vx, THROW_SPEED.x);
    assert.equal(object.vy, -THROW_SPEED.y);   // y increases downwards, so upward is negative
  });

  test('facing left, it is thrown forward to the left and upward', () => {
    const [object] = step(throwState({ facing: Facing.LEFT }), PRESS_ACTION, FIXED_DT).objects;
    assert.equal(object.vx, -THROW_SPEED.x);
    assert.equal(object.vy, -THROW_SPEED.y);
  });

  test('turning and throwing in the same step throws in the new direction', () => {
    const [object] = step(throwState({ facing: Facing.RIGHT }), holding(Input.LEFT, Input.ACTION), FIXED_DT).objects;
    assert.equal(object.vx, -THROW_SPEED.x);
  });

  test('the throw starts from above the player\'s head, where the player is after this step\'s move', () => {
    const after = step(throwState(), holding(Input.RIGHT, Input.ACTION), FIXED_DT);
    // The object has already made its first move at its own speed; undo that to find where it was let go.
    const [object] = after.objects;
    const released = { ...object, x: object.x - object.vx * FIXED_DT, y: object.y - object.vy * FIXED_DT };
    assertAboveHead(released, after.player, 'when thrown');
  });

  test('a throw speed of zero gives a speed of exactly 0, not -0, in either direction', () => {
    // -0 would make otherwise equal states compare as different (deepEqual tells 0 and -0 apart).
    const state = createLevelState(
      buildData(THROW_GRID, { player: { size: ONE_TILE }, tuning: { throwSpeed: { x: 0, y: 0 }, gravity: 0 } }), TEST_LEVEL);
    const [object] = step(holdingNew(withPlayer(state, { facing: Facing.LEFT }), 'crate'), PRESS_ACTION, FIXED_DT).objects;
    assert.equal(object.vx, 0);
    assert.equal(object.vy, 0);
  });

  test('the throw speed doesn\'t depend on the player\'s own speed (running, jumping)', () => {
    const moving = throwState({ vx: 6, vy: -5 });
    const [object] = step(moving, holding(Input.RIGHT, Input.ACTION), FIXED_DT).objects;
    assert.equal(object.vx, THROW_SPEED.x);
    assert.equal(object.vy, -THROW_SPEED.y);
  });

  test('the press that picks an object up doesn\'t also throw it, however long action is held', () => {
    let state = stateFor(['.Pc.G', '#####']);
    for (let i = 0; i < STEPS_PER_SECOND; i++) state = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(state), [0]);
    assert.equal(state.objects[0].thrown, false);
  });

  test('a thrown object no longer follows the player', () => {
    // From the moment of the throw, what the player does makes no difference to the object.
    const thrown = step(throwState(), PRESS_ACTION, FIXED_DT);
    let still = thrown;
    let running = thrown;
    for (let i = 0; i < 10; i++) {
      still = step(still, NO_INPUT, FIXED_DT);
      running = step(running, holding(Input.RIGHT), FIXED_DT);
    }
    assert.notDeepEqual({ ...running.player }, { ...still.player });
    assert.deepEqual({ ...running.objects[0] }, { ...still.objects[0] });
  });

  test('a thrown object can\'t be caught: pressing action again while it touches the player doesn\'t pick it up', () => {
    let state = step(throwState(), PRESS_ACTION, FIXED_DT);
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(state), []);
    assert.equal(state.objects[0].thrown, true);
  });

  test('after a throw, another object the player touches can be picked up with a new press', () => {
    const holdingCrate = throwState();
    const { player } = holdingCrate;
    const beside = new CarriableObject({ type: 'crate', ...ONE_TILE, x: player.x + player.width, y: player.y, resting: true });
    let state = { ...holdingCrate, objects: [...holdingCrate.objects, beside] };
    state = step(state, PRESS_ACTION, FIXED_DT);   // throws the crate held above the head
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(state), [1]);
  });
});

// ---------------------------------------------------------------------------
// Task 4.4: dropping. Decided:
//  - the object goes down beside the player's feet, flush against the side
//    they face, its bottom level with their feet; if it doesn't fit there, the
//    same place on the other side; if neither fits, the player keeps holding it;
//  - dropSpeed (tuning) uses throwSpeed's convention: x away from the player
//    (toward the side the object went down on), y upward;
//  - a dropped object isn't thrown, so it can be picked up again at once.

describe('drop (req 32)', () => {
  const DROP_GRID = ['..........', '....P....G', '##########'];
  const DROP_SPEED = { x: 2, y: 1 };
  const THROW_SPEED = { x: 7, y: 3 };
  const DOWN_ACTION = holding(Input.DOWN, Input.ACTION);

  const NO_DROP_SPEED = { x: 0, y: 0 };

  /**
   * A state built from `grid`, with the player holding an object of `type`; `playerChanges` adjusts the player.
   * Gravity is 0 and, unless given, so is the drop speed, so after the dropping step the object is still exactly
   * where it was put down and still has the speed it was dropped with (objects start moving in the step they
   * are released, task 4.5).
   */
  function dropState({ grid = DROP_GRID, type = 'crate', playerChanges = {}, dropSpeed = NO_DROP_SPEED } = {}) {
    const state = createLevelState(
      buildData(grid, { player: { size: ONE_TILE }, tuning: { dropSpeed, throwSpeed: THROW_SPEED, gravity: 0 } }), TEST_LEVEL);
    return holdingNew(withPlayer(state, playerChanges), type);
  }

  /** Asserts the object is beside the player's feet: flush against the given side, bottoms level. */
  function assertBesideFeet(object, player, side, when) {
    if (side === Facing.RIGHT) assertNear(object.x, player.x + player.width, `object left edge ${when}`);
    else assertNear(object.x + object.width, player.x, `object right edge ${when}`);
    assertNear(object.y + object.height, player.y + player.height, `object bottom ${when}`);
  }

  test('pressing down + action while holding lets go of the object, without throwing it', () => {
    const after = step(dropState(), DOWN_ACTION, FIXED_DT);
    const [object] = after.objects;
    assert.equal(object.held, false);
    assert.equal(object.thrown, false);
    assert.deepEqual(heldIndexes(after), []);
  });

  test('facing right, it goes down flush against the player\'s right side, bottom level with their feet', () => {
    const after = step(dropState({ playerChanges: { facing: Facing.RIGHT } }), DOWN_ACTION, FIXED_DT);
    assertBesideFeet(after.objects[0], after.player, Facing.RIGHT, 'after dropping');
  });

  test('facing left, it goes down flush against the player\'s left side', () => {
    const after = step(dropState({ playerChanges: { facing: Facing.LEFT } }), DOWN_ACTION, FIXED_DT);
    assertBesideFeet(after.objects[0], after.player, Facing.LEFT, 'after dropping');
  });

  test('an object shorter than the player also has its bottom level with the player\'s feet', () => {
    const after = step(dropState({ type: 'coconut' }), DOWN_ACTION, FIXED_DT);
    assertBesideFeet(after.objects[0], after.player, Facing.RIGHT, 'after dropping a coconut');
  });

  test('dropping in mid-air puts the object beside where the player\'s feet are then', () => {
    const inTheAir = dropState({ grid: ['..........', '..........', '....P....G', '..........', '##########'] });
    const after = step(inTheAir, DOWN_ACTION, FIXED_DT);
    assert.equal(after.player.onGround, false);
    assertBesideFeet(after.objects[0], after.player, Facing.RIGHT, 'after dropping in mid-air');
  });

  test('it starts with the drop speed in tuning: x away from the player, y upward', () => {
    const right = step(dropState({ dropSpeed: DROP_SPEED, playerChanges: { facing: Facing.RIGHT } }), DOWN_ACTION, FIXED_DT).objects[0];
    assert.equal(right.vx, DROP_SPEED.x);
    assert.equal(right.vy, -DROP_SPEED.y);
    const left = step(dropState({ dropSpeed: DROP_SPEED, playerChanges: { facing: Facing.LEFT } }), DOWN_ACTION, FIXED_DT).objects[0];
    assert.equal(left.vx, -DROP_SPEED.x);
    assert.equal(left.vy, -DROP_SPEED.y);
  });

  test('with a drop speed of zero (the usual setting), it starts still: exactly 0, not -0, on either side', () => {
    for (const facing of [Facing.RIGHT, Facing.LEFT]) {
      const [object] = step(dropState({ dropSpeed: { x: 0, y: 0 }, playerChanges: { facing } }), DOWN_ACTION, FIXED_DT).objects;
      assert.equal(object.vx, 0, `vx facing ${facing}`);
      assert.equal(object.vy, 0, `vy facing ${facing}`);
    }
  });

  test('action without down still throws', () => {
    const [object] = step(dropState(), PRESS_ACTION, FIXED_DT).objects;
    assert.equal(object.thrown, true);
    assert.equal(object.vx, THROW_SPEED.x);
  });

  test('only a new press of action drops: pressing down while action is still held does nothing', () => {
    let state = stateFor(['.Pc.G', '#####']);
    state = step(state, PRESS_ACTION, FIXED_DT);   // picks up
    for (let i = 0; i < 10; i++) state = step(state, DOWN_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(state), [0]);
  });

  test('a wall in front: the object goes down on the other side instead, moving away from the player', () => {
    const grid = ['..........', '....P#...G', '##########'];   // facing right, wall at column 5
    const after = step(dropState({ grid }), DOWN_ACTION, FIXED_DT);
    assertBesideFeet(after.objects[0], after.player, Facing.LEFT, 'after dropping away from the wall');
    const withSpeed = step(dropState({ grid, dropSpeed: DROP_SPEED }), DOWN_ACTION, FIXED_DT);
    assert.equal(withSpeed.objects[0].vx, -DROP_SPEED.x);
  });

  test('the level\'s edge in front: the object goes down on the other side', () => {
    const state = dropState({ grid: ['..........', 'P........G', '##########'], playerChanges: { facing: Facing.LEFT } });
    const after = step(state, DOWN_ACTION, FIXED_DT);
    assertBesideFeet(after.objects[0], after.player, Facing.RIGHT, 'after dropping away from the edge');
  });

  test('walls on both sides: nothing happens, and the player keeps holding the object', () => {
    const state = dropState({ grid: ['..........', '...#P#...G', '##########'] });
    const after = step(state, DOWN_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(after), [0]);
    assertAboveHead(after.objects[0], after.player, 'after a refused drop');
  });

  test('a dropped object can be picked up again with a new press', () => {
    let state = step(dropState(), DOWN_ACTION, FIXED_DT);
    state = step(state, NO_INPUT, FIXED_DT);
    state = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(state), [0]);
  });

  test('down + action with empty hands picks up as usual', () => {
    const state = stateFor(['.Pc.G', '#####']);
    assert.deepEqual(heldIndexes(step(state, DOWN_ACTION, FIXED_DT)), [0]);
  });

  test('a dropped object no longer follows the player', () => {
    const dropped = step(dropState(), DOWN_ACTION, FIXED_DT);
    let still = dropped;
    let running = dropped;
    for (let i = 0; i < 10; i++) {
      still = step(still, NO_INPUT, FIXED_DT);
      running = step(running, holding(Input.LEFT), FIXED_DT);
    }
    assert.notDeepEqual({ ...running.player }, { ...still.player });
    assert.deepEqual({ ...running.objects[0] }, { ...still.objects[0] });
  });
});

// ---------------------------------------------------------------------------
// Tasks 4.5 (falling and resting) and 4.6 (stacking). Decided:
//  - objects that aren't held or at rest fall under gravity and maxFallSpeed
//    (tuning, as for the player) and collide with solid tiles, the level's
//    sides, and resting stackable objects;
//  - hitting a wall or the side of a stack: sideways speed becomes 0 and the
//    object falls straight down, still thrown until it lands;
//  - landing: the object stops dead (both speeds 0) and is at rest; a thrown
//    object is no longer thrown, so it can be picked up again;
//  - falling into a pit (entirely below the level): the object returns to
//    where it was when the level started, still and not thrown, and falls or
//    comes to rest from there;
//  - resting stackable objects are solid to the player too (standing,
//    walking, jumping, walls), except one the player or held object already
//    overlaps, which the player can walk out of.

const FALL_TUNING = { gravity: 30, maxFallSpeed: 12, throwSpeed: { x: 6, y: 9 }, dropSpeed: { x: 0, y: 0 } };

/** A state from `grid` with FALL_TUNING (plus `tuning`), extra object definitions, and extra legend entries. */
function physicsState(grid, { tuning = {}, playerSize = ONE_TILE, objects = {}, legend = {} } = {}) {
  const data = buildData(grid, { player: { size: playerSize }, tuning: { ...FALL_TUNING, ...tuning }, legend });
  Object.assign(data.objects, objects);
  return createLevelState(data, TEST_LEVEL);
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

/** The most steps a test waits for a thrown or dropped object to come to rest. */
const MAX_FLIGHT_STEPS = 10 * STEPS_PER_SECOND;

const bottom = (box) => box.y + box.height;
const right = (box) => box.x + box.width;

describe('falling and resting (task 4.5, req 34)', () => {
  // Row 3 is the ground; the crate in row 0 has nothing under it.
  const FALL_GRID = ['..c..', '.....', 'P...G', '#####'];
  const GROUND_TOP = 3;

  test('an object with nothing under it falls under gravity from tuning', () => {
    const state = physicsState(FALL_GRID);
    const [before] = state.objects;
    const [after] = step(state, NO_INPUT, FIXED_DT).objects;
    const expectedVy = FALL_TUNING.gravity * FIXED_DT;
    assertNear(after.vy, expectedVy, 'vy');
    assertNear(after.y, before.y + expectedVy * FIXED_DT, 'y');
    assert.equal(after.resting, false);
  });

  test('falling speeds up by gravity × dt each step, up to maxFallSpeed, and no faster', () => {
    const grid = ['..c..', ...Array.from({ length: 40 }, () => '.....'), 'P...G', '#####'];
    let state = physicsState(grid);
    let reachedMax = false;
    for (let i = 1; i <= STEPS_PER_SECOND; i++) {
      state = step(state, NO_INPUT, FIXED_DT);
      const expected = Math.min(i * FALL_TUNING.gravity * FIXED_DT, FALL_TUNING.maxFallSpeed);
      assertNear(state.objects[0].vy, expected, `vy at step ${i}`);
      reachedMax ||= expected === FALL_TUNING.maxFallSpeed;
    }
    assert.ok(reachedMax, 'the test should reach maxFallSpeed');
  });

  test('it comes to rest on top of the ground: still, at rest, and never inside it', () => {
    const state = physicsState(FALL_GRID);
    const landed = stepUntil(state, NO_INPUT, (s) => s.objects[0].resting);
    const [object] = landed.objects;
    assertNear(bottom(object), GROUND_TOP, 'object bottom');
    assert.equal(object.vx, 0);
    assert.equal(object.vy, 0);
    stepNeverInsideSolid(state, NO_INPUT, STEPS_PER_SECOND);
  });

  test('a fall many tiles long in one step still lands on top of the ground, not inside or through it', () => {
    const longStep = 2;   // seconds: at maxFallSpeed, a move of many tiles
    const [object] = step(physicsState(FALL_GRID), NO_INPUT, longStep).objects;
    assertNear(bottom(object), GROUND_TOP, 'object bottom');
    assert.equal(object.resting, true);
  });

  test('an object at rest stays exactly where it is', () => {
    const state = physicsState(['P.c.G', '#####']);
    let current = state;
    for (let i = 0; i < STEPS_PER_SECOND; i++) current = step(current, NO_INPUT, FIXED_DT);
    assert.deepEqual({ ...current.objects[0] }, { ...state.objects[0] });
  });

  test('a held object is not affected by gravity', () => {
    const state = holdingNew(physicsState(['.....', 'P...G', '#####']), 'crate');
    let current = state;
    for (let i = 0; i < STEPS_PER_SECOND; i++) current = step(current, NO_INPUT, FIXED_DT);
    assert.deepEqual({ ...current.objects[0] }, { ...state.objects[0] });
  });

  describe('a thrown object (carried over from 4.3)', () => {
    const OPEN_GRID = [...Array.from({ length: 6 }, () => '.'.repeat(30)), '.'.repeat(14) + 'P' + '.'.repeat(14) + 'G', '#'.repeat(30)];
    const OPEN_GROUND_TOP = 7;

    for (const facing of [Facing.RIGHT, Facing.LEFT]) {
      test(`facing ${facing}: flies in an arc, forward at a steady speed, up and then down, and comes to rest`, () => {
        const forward = facing === Facing.RIGHT ? 1 : -1;
        const state = holdingNew(withPlayer(physicsState(OPEN_GRID), { facing }), 'crate');
        let current = step(state, PRESS_ACTION, FIXED_DT);
        const startY = current.objects[0].y;
        let highest = startY;
        let wentDown = false;
        for (let i = 0; !current.objects[0].resting; i++) {
          assert.ok(i < MAX_FLIGHT_STEPS, 'it never came to rest');
          const before = current.objects[0];
          current = step(current, NO_INPUT, FIXED_DT);
          const after = current.objects[0];
          if (after.resting) break;
          assertNear(after.x - before.x, forward * FALL_TUNING.throwSpeed.x * FIXED_DT, 'forward move per step');
          assertNear(after.vy, before.vy + FALL_TUNING.gravity * FIXED_DT, 'vy grows by gravity × dt');
          highest = Math.min(highest, after.y);
          wentDown ||= after.y > before.y;
        }
        const [landed] = current.objects;
        assert.ok(highest < startY, 'it rose first');
        assert.ok(wentDown, 'then it fell');
        assertNear(bottom(landed), OPEN_GROUND_TOP, 'landed on the ground');
        assert.ok(forward * (landed.x - state.objects[0].x) > 0, 'it landed forward of where it was thrown from');
        assert.equal(landed.thrown, false);
        assert.equal(landed.vx, 0);
        assert.equal(landed.vy, 0);
      });
    }

    test('hitting a wall: sideways speed becomes 0, and it falls straight down beside the wall, still thrown until it lands', () => {
      const wallColumn = 7;
      const groundTop = 5;
      const grid = ['.......#..', '.......#..', '.......#..', '.......#..', '...P...#.G', '##########'];
      let state = step(holdingNew(physicsState(grid), 'crate'), PRESS_ACTION, FIXED_DT);
      let hitWall = false;
      for (let i = 0; !state.objects[0].resting; i++) {
        assert.ok(i < MAX_FLIGHT_STEPS, 'it never came to rest');
        state = step(state, NO_INPUT, FIXED_DT);
        const [object] = state.objects;
        if (!hitWall && object.vx === 0) {
          hitWall = true;
          assertNear(right(object), wallColumn, 'flush against the wall');
        }
        if (hitWall) {
          assertNear(right(object), wallColumn, 'falls straight down beside the wall');
          if (!object.resting) assert.equal(object.thrown, true);
        }
      }
      assert.ok(hitWall, 'the throw should reach the wall');
      assertNear(bottom(state.objects[0]), groundTop, 'landed on the ground');
      assert.equal(state.objects[0].thrown, false);
    });

    test('hitting a ceiling: it stops rising there and falls back down', () => {
      const ceilingBottom = 1;
      const grid = ['##########', '..........', '..........', '..P......G', '##########'];
      let state = step(holdingNew(physicsState(grid), 'crate'), PRESS_ACTION, FIXED_DT);
      let hitCeiling = false;
      for (let i = 0; !state.objects[0].resting; i++) {
        assert.ok(i < MAX_FLIGHT_STEPS, 'it never came to rest');
        state = step(state, NO_INPUT, FIXED_DT);
        const [object] = state.objects;
        assert.ok(object.y >= ceilingBottom - 1e-9, `inside the ceiling: y ${object.y}`);
        if (Math.abs(object.y - ceilingBottom) < 1e-9 && object.vy === 0) hitCeiling = true;
      }
      assert.ok(hitCeiling, 'the throw should reach the ceiling');
    });

    test('once it has landed it can be picked up again', () => {
      // Thrown straight up (no forward speed), it comes down through the player and lands where they stand.
      const state = holdingNew(physicsState(['.....', 'P...G', '#####'], { tuning: { throwSpeed: { x: 0, y: 9 } } }), 'crate');
      let current = step(state, PRESS_ACTION, FIXED_DT);
      current = stepUntil(current, NO_INPUT, (s) => s.objects[0].resting);
      assert.equal(current.objects[0].thrown, false);
      current = step(current, PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(current), [0]);
    });
  });

  describe('a dropped object (carried over from 4.4)', () => {
    const DOWN_ACTION = holding(Input.DOWN, Input.ACTION);

    test('dropped on the ground with a drop speed of 0, it is at rest at once', () => {
      const [object] = step(holdingNew(physicsState(['.....', 'P...G', '#####']), 'crate'), DOWN_ACTION, FIXED_DT).objects;
      assert.equal(object.resting, true);
      assert.equal(object.vx, 0);
      assert.equal(object.vy, 0);
    });

    test('dropped in mid-air, it falls straight down from beside the player\'s feet and comes to rest on the ground', () => {
      const groundTop = 5;
      const grid = ['.....', 'P...G', '.....', '.....', '.....', '#####'];
      let state = step(holdingNew(physicsState(grid), 'crate'), DOWN_ACTION, FIXED_DT);
      const droppedX = state.objects[0].x;
      state = stepUntil(state, NO_INPUT, (s) => s.objects[0].resting);
      assertNear(state.objects[0].x, droppedX, 'x');
      assertNear(bottom(state.objects[0]), groundTop, 'landed on the ground');
    });

    test('dropped with a drop speed, it moves away from the player and upward, then falls and comes to rest', () => {
      const dropSpeed = { x: 2, y: 3 };
      const groundTop = 2;
      const state = holdingNew(physicsState(['.......', 'P.....G', '#######'], { tuning: { dropSpeed } }), 'crate');
      let current = step(state, DOWN_ACTION, FIXED_DT);
      const dropped = current.objects[0];
      current = step(current, NO_INPUT, FIXED_DT);
      assert.ok(current.objects[0].y < dropped.y, 'it moves upward first');
      current = stepUntil(current, NO_INPUT, (s) => s.objects[0].resting);
      assert.ok(current.objects[0].x > dropped.x, 'it moved away from the player (to the right)');
      assertNear(bottom(current.objects[0]), groundTop, 'landed on the ground');
    });

    test('a dropped object isn\'t thrown, so it can be picked up while it is still falling', () => {
      const grid = ['.....', 'P...G', '.....', '.....', '.....', '.....', '#####'];
      let state = step(holdingNew(physicsState(grid), 'crate'), DOWN_ACTION, FIXED_DT);   // player and object fall side by side
      state = step(state, NO_INPUT, FIXED_DT);
      assert.equal(state.objects[0].resting, false);
      state = step(state, PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(state), [0]);
    });
  });

  test('falling into a pit: the object returns, still and not thrown, to where it was when the level started, and comes to rest there', () => {
    const pitColumn = 5;
    const state = physicsState(['P.c.....G', '#####.###']);
    const [start] = state.levelStart.objects;
    const overPit = new CarriableObject({ ...start, x: pitColumn, y: start.y - 2, vx: 0, vy: 0, resting: false, thrown: true });
    const back = stepUntil({ ...state, objects: [overPit] }, NO_INPUT,
      (s) => s.objects[0].x === start.x && Math.abs(s.objects[0].y - start.y) < 1e-9);
    const [object] = back.objects;
    assert.equal(object.thrown, false);
    assert.equal(object.vx, 0);
    assert.equal(object.vy, 0);
    const settled = step(back, NO_INPUT, FIXED_DT);
    assert.equal(settled.objects[0].resting, true);
  });
});

describe('stacking (task 4.6, req 35)', () => {
  describe('objects land on resting stackable objects', () => {
    test('a falling crate lands and rests on a crate', () => {
      const state = stepUntil(physicsState(['..c..', '.....', 'P.c.G', '#####']), NO_INPUT, (s) => s.objects[0].resting);
      const [upper, lower] = state.objects;
      assertNear(bottom(upper), lower.y, 'upper crate bottom');
    });

    test('a falling crate lands on top of a stack of two', () => {
      const state = stepUntil(physicsState(['..c..', '.....', '..c..', 'P.c.G', '#####']), NO_INPUT, (s) => s.objects[0].resting);
      const [top, middle] = state.objects;
      assertNear(bottom(top), middle.y, 'top crate bottom');
    });

    test('a coconut lands and rests on a crate', () => {
      const state = stepUntil(physicsState(['..o..', '.....', 'P.c.G', '#####']), NO_INPUT, (s) => s.objects[0].resting);
      const [coconut, crate] = state.objects;
      assertNear(bottom(coconut), crate.y, 'coconut bottom');
    });

    test('a coconut is not a surface: a crate falls past a resting coconut and lands on the ground', () => {
      const groundTop = 3;
      const state = stepUntil(physicsState(['..c..', '.....', 'P.o.G', '#####']), NO_INPUT, (s) => s.objects[0].resting);
      assertNear(bottom(state.objects[0]), groundTop, 'crate bottom');
    });

    test('two crates falling together settle into a stack', () => {
      const groundTop = 4;
      const state = stepUntil(physicsState(['..c..', '..c..', '.....', 'P...G', '#####']), NO_INPUT,
        (s) => s.objects.every((o) => o.resting));
      const [upper, lower] = state.objects;
      assertNear(bottom(lower), groundTop, 'lower crate bottom');
      assertNear(bottom(upper), lower.y, 'upper crate bottom');
    });

    test('a thrown crate that hits the side of a stack stops sideways and falls to the ground beside it', () => {
      const stackColumn = 7;
      const groundTop = 5;
      const grid = ['..........', '.......c..', '.......c..', '.......c..', '...P...c.G', '##########'];
      let state = step(holdingNew(physicsState(grid), 'crate'), PRESS_ACTION, FIXED_DT);
      const thrownIndex = state.objects.length - 1;
      state = stepUntil(state, NO_INPUT, (s) => s.objects[thrownIndex].resting);
      const thrown = state.objects[thrownIndex];
      assertNear(right(thrown), stackColumn, 'beside the stack');
      assertNear(bottom(thrown), groundTop, 'on the ground');
    });
  });

  describe('the player and resting stackable objects', () => {
    test('the player lands and stands on a crate', () => {
      const state = stepUntil(physicsState(['.P...', '.....', '.c..G', '#####']), NO_INPUT, (s) => s.player.onGround);
      const [crate] = state.objects;
      assertNear(bottom(state.player), crate.y, 'player bottom');
      assert.equal(state.player.vy, 0);
    });

    test('the player walks along a row of crates at full speed, without sinking or snagging', () => {
      let state = physicsState(['.P.....G', '.cccccc.', '########']);
      const startX = state.player.x;
      const startY = state.player.y;
      const steps = 30;
      const speed = state.data.characters.player.speed;
      for (let i = 0; i < steps; i++) {
        state = step(state, holding(Input.RIGHT), FIXED_DT);
        assertNear(state.player.y, startY, `y at step ${i}`);
      }
      assertNear(state.player.x, startX + steps * speed * FIXED_DT, 'x');
    });

    test('the player jumps from a crate', () => {
      const state = physicsState(['.P..G', '.c...', '#####']);
      const after = step(state, holding(Input.JUMP), FIXED_DT);
      assert.ok(after.player.vy < 0, `vy was ${after.player.vy}`);
    });

    test('a crate stops the player like a wall', () => {
      const crateColumn = 4;
      const state = stepUntil(physicsState(['P...c..G', '########']), holding(Input.RIGHT), (s) => s.player.vx === 0);
      assertNear(right(state.player), crateColumn, 'player right edge');
    });

    test('a coconut is not solid: the player walks through it', () => {
      const state = physicsState(['P...o..G', '########']);
      const after = stepUntil(state, holding(Input.RIGHT), (s) => s.player.x > right(state.objects[0]));
      assert.ok(after.player.x > right(state.objects[0]));
    });

    test('an object that is not at rest is not solid: a falling crate doesn\'t stop the player', () => {
      const state = physicsState(['.....', 'P...G', '#####']);
      const { player } = state;
      const falling = new CarriableObject({ type: 'crate', ...ONE_TILE, x: right(player), y: player.y - 0.5, resting: false });
      const after = step({ ...state, objects: [falling] }, holding(Input.RIGHT), FIXED_DT);
      assertNear(after.player.x, player.x + state.data.characters.player.speed * FIXED_DT, 'player x');
    });

    test('the player can walk out of a resting crate they overlap, and it is solid again once they are out', () => {
      const state = physicsState(['.......', '..P...G', '#######']);
      const { player } = state;
      const crate = new CarriableObject({ type: 'crate', ...ONE_TILE, x: player.x, y: player.y, resting: true });
      let current = { ...state, objects: [crate] };
      current = step(current, holding(Input.RIGHT), FIXED_DT);
      assertNear(current.player.x, player.x + state.data.characters.player.speed * FIXED_DT, 'moved freely inside the crate');
      current = stepUntil(current, holding(Input.RIGHT), (s) => s.player.x >= right(crate));
      current = stepUntil(current, holding(Input.LEFT), (s) => s.player.vx === 0);
      assertNear(current.player.x, right(crate), 'stopped against the crate from outside');
    });

    test('a crate that falls onto the player passes through them, rests where they stand, and they can walk out', () => {
      const state = physicsState(['..c..', '.....', '..P.G', '#####']);
      let current = stepUntil(state, NO_INPUT, (s) => s.objects[0].resting);
      const [crate] = current.objects;
      assert.ok(overlapsBox(crate, current.player), 'the crate rests overlapping the player');
      current = stepUntil(current, holding(Input.RIGHT), (s) => s.player.x >= right(crate));
      assert.ok(!overlapsBox(crate, current.player));
    });
  });

  describe('fit checks count resting stackable objects (carried over from 4.2a and 4.4)', () => {
    const DOWN_ACTION = holding(Input.DOWN, Input.ACTION);

    test('a drop with a crate in front goes down on the other side', () => {
      const state = holdingNew(physicsState(['......', '..Pc.G', '######']), 'crate');   // facing right; crate to the right
      const after = step(state, DOWN_ACTION, FIXED_DT);
      const dropped = after.objects.at(-1);
      assert.equal(dropped.held, false);
      assertNear(right(dropped), after.player.x, 'dropped on the left');
    });

    test('a drop with crates on both sides doesn\'t happen: the player keeps holding the object', () => {
      const state = holdingNew(physicsState(['......', '.cPc.G', '######']), 'crate');
      const after = step(state, DOWN_ACTION, FIXED_DT);
      assert.equal(after.objects.at(-1).held, true);
    });

    test('no pick-up with a resting stackable object above the player\'s head', () => {
      // A 3-wide shelf rests on the tiles either side of a 1-wide slot; the player stands in the slot under it.
      const shelf = { formatVersion: 1, name: 'Shelf', size: { width: 3, height: 1 }, stackable: true, color: '#8b5a2b' };
      const withShelf = physicsState(['.....G', '.s....', '#P#...', '######'], { objects: { shelf }, legend: { s: { object: 'shelf' } } });
      const withoutShelf = physicsState(['.....G', '......', '#P#...', '######']);
      const coconutAtFeet = (state) => {
        const { coconut } = state.data.objects;
        const { player } = state;
        return new CarriableObject({ type: 'coconut', ...coconut.size, x: player.x, y: bottom(player) - coconut.size.height, resting: true });
      };
      assert.equal(withShelf.objects[0].resting, true);
      const blocked = step({ ...withShelf, objects: [...withShelf.objects, coconutAtFeet(withShelf)] }, PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(blocked), []);
      const free = step({ ...withoutShelf, objects: [coconutAtFeet(withoutShelf)] }, PRESS_ACTION, FIXED_DT);
      assert.deepEqual(heldIndexes(free), [0]);
    });

    test('a carried crate stops at a stack, as it does at a wall', () => {
      // A narrow player carries a crate that sticks out past their sides; the crate reaches the stack first.
      const stackColumn = 5;
      const narrow = { width: 0.6, height: 1 };
      const state = holdingNew(physicsState(['.........', '.....c...', '.P...c..G', '#########'], { playerSize: narrow }), 'crate');
      const after = stepUntil(state, holding(Input.RIGHT), (s) => s.player.vx === 0);
      const carried = after.objects.at(-1);
      assertNear(right(carried), stackColumn, 'carried crate right edge');
      assert.ok(right(after.player) < stackColumn, 'the player is short of the stack');
    });
  });
});

// ---------------------------------------------------------------------------
// Task 4.7: support removed. Decided: every step, each resting object checks
// (lowest first) for something solid directly under it: a solid tile or a
// resting stackable object. One with nothing under it stops resting and falls.

describe('support removed (task 4.7, req 36)', () => {
  test('picking up the bottom crate of a stack of two: the top one falls and comes to rest on the ground', () => {
    const groundTop = 3;
    const state = physicsState(['.....', '..c..', '.Pc.G', '#####']);   // the stack is in column 2, beside the player
    let current = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(current), [1]);
    const [top] = current.objects;
    assert.equal(top.resting, false, 'the top crate has lost its support');
    assert.ok(top.y > state.objects[0].y, 'and has started falling');
    current = stepUntil(current, NO_INPUT, (s) => s.objects[0].resting);
    assertNear(bottom(current.objects[0]), groundTop, 'top crate bottom');
  });

  test('picking up the bottom of a stack of three: the two above fall together and settle into a stack of two', () => {
    const groundTop = 3;
    const state = physicsState(['..c..', '..c..', '.Pc.G', '#####']);
    let current = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(current), [2]);
    current = stepUntil(current, NO_INPUT, (s) => s.objects[0].resting && s.objects[1].resting);
    const [top, middle] = current.objects;
    assertNear(bottom(middle), groundTop, 'middle crate bottom');
    assertNear(bottom(top), middle.y, 'top crate bottom');
  });

  test('a coconut resting on a crate falls when the crate is picked up', () => {
    const state = physicsState(['.....', '..o..', '.Pc.G', '#####']);
    const after = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(after), [1]);
    assert.equal(after.objects[0].resting, false);
  });

  test('objects not resting on the picked-up one stay exactly where they are', () => {
    // The last crate sits on the ground in column 4, away from the stack the player picks from.
    const state = physicsState(['.....G', '..c...', '.Pc.c.', '######']);
    const after = step(state, PRESS_ACTION, FIXED_DT);
    const untouched = state.objects.at(-1);
    assert.deepEqual({ ...after.objects.at(-1) }, { ...untouched });
  });

  test('an object still partly supported stays at rest', () => {
    // A 2-wide plank rests across crates in columns 2 and 3; the player, right of them, picks up the crate in column 3.
    const plank = { formatVersion: 1, name: 'Plank', size: { width: 2, height: 0.5 }, stackable: true, color: '#8b5a2b' };
    const state = physicsState(['.....G', '..p...', '..ccP.', '######'], { objects: { plank }, legend: { p: { object: 'plank' } } });
    assert.equal(state.objects[0].resting, true);
    const after = step(withPlayer(state, { facing: Facing.LEFT }), PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(after), [2]);
    assert.equal(after.objects[0].resting, true, 'the plank is still on the crate in column 2');
    assert.deepEqual({ ...after.objects[0] }, { ...state.objects[0] });
  });
});

// ---------------------------------------------------------------------------
// Task 4.8: standing on. Decided: objects the player is standing on (their
// feet on its top, overlapping sideways) are left out when choosing what to
// pick up; another object they touch can still be picked up.

describe('standing on (task 4.8, req 37)', () => {
  test('standing on a crate, pressing action doesn\'t pick it up', () => {
    const state = physicsState(['.P..G', '.c...', '#####']);
    const after = step(state, PRESS_ACTION, FIXED_DT);
    assert.deepEqual(heldIndexes(after), []);
    assert.equal(after.objects[0].resting, true);
  });

  test('standing on a crate, a crate beside the player is picked up instead', () => {
    // The player stands on crate 1 (column 1); crate 0 (column 2, top row) is beside them, on crate 2.
    const state = physicsState(['.Pc..', '.cc.G', '#####']);
    assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
  });

  test('standing across two crates, neither is picked up', () => {
    const state = physicsState(['.P..G', '.cc..', '#####']);
    const straddling = withPlayer(state, { x: 1.5 });   // over the edge between the crates in columns 1 and 2
    assert.deepEqual(heldIndexes(step(straddling, PRESS_ACTION, FIXED_DT)), []);
  });

  test('a crate the player stands beside, on the ground, can still be picked up', () => {
    const state = physicsState(['.....', '.Pc.G', '#####']);
    assert.deepEqual(heldIndexes(step(state, PRESS_ACTION, FIXED_DT)), [0]);
  });
});
