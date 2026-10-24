// Tests for carriable objects: picking up (task 4.2; PRD reqs 29-30).
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
import { overlapsSolid } from '../../src/simulation/collision.js';
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
  const PROPERTIES = ['type', 'x', 'y', 'width', 'height', 'vx', 'vy', 'resting', 'held'];

  test('has exactly the declared properties', () => {
    assert.deepEqual(Object.keys(new CarriableObject()).sort(), [...PROPERTIES].sort());
  });

  test('starts not held', () => {
    assert.equal(new CarriableObject().held, false);
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
 * The state with one object of `type` already held, above the player's head.
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
  return { ...state, data, objects: [object] };
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
