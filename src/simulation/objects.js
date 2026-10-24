// Carriable objects: crates, coconuts, and the like (PRD reqs 28-37).
//
// Assumes valid data: objects are built by createLevelState (state.js), which
// fails with a LevelDataError if an object's definition is missing, so every
// object's `type` names a definition in data.objects.
//
// updateObjects changes `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.

import { Facing } from './constants.js';
import { Input } from './input.js';
import { touches, fitsIn } from './collision.js';

/**
 * An object's changing state: the one central declaration of its properties.
 * Instances are sealed, as Player's are: assigning a property that isn't
 * declared here throws a TypeError.
 *
 * Positions and sizes are in tiles; speeds in tiles per second. What doesn't
 * change (stackable, colour, sprite) stays in the object definition.
 */
export class CarriableObject {
  type = '';              // the object definition's name in data.objects, e.g. 'crate'
  x = 0;                  // left edge of the collision box
  y = 0;                  // top edge of the collision box; y increases downwards
  width = 0;              // collision box size, from the object definition
  height = 0;
  vx = 0;                 // horizontal speed: + is right, - is left
  vy = 0;                 // vertical speed: + is falling, - is rising
  resting = false;        // true when on something solid; a resting stackable object is itself solid (req 35)
  held = false;           // true while the player carries it above their head (reqs 29-30)
  thrown = false;         // true from being thrown until it lands; can't be picked up meanwhile (req 31)

  /** A CarriableObject with the given starting values; anything not given keeps its default. */
  constructor(values = {}) {
    for (const name of Object.keys(values)) {
      if (!Object.hasOwn(this, name)) throw new Error(`"${name}" is not a CarriableObject property`);
    }
    Object.assign(this, values);
    Object.seal(this);
  }

  /** A separate CarriableObject with the same values. */
  copy() {
    return new CarriableObject({ ...this });
  }
}

const centreX = (box) => box.x + box.width / 2;
const centreY = (box) => box.y + box.height / 2;

/**
 * The object the player would pick up: of the objects touching the player
 * (other than ones thrown and still in flight),
 * those on the side they face come first, then the one whose centre is
 * nearest the player's centre, then the first in the list. Null if none.
 */
function objectToPickUp(state) {
  const { player, objects } = state;
  const ahead = player.facing === Facing.RIGHT ? 1 : -1;
  const rank = (object) => ({
    behind: (centreX(object) - centreX(player)) * ahead > 0 ? 0 : 1,
    distance: Math.hypot(centreX(object) - centreX(player), centreY(object) - centreY(player)),
  });
  let best = null;
  let bestRank = null;
  for (const object of objects) {
    if (object.thrown || !touches(player, object)) continue;
    const r = rank(object);
    // Strictly better only, so a tie keeps the earlier object.
    if (!best || r.behind < bestRank.behind || (r.behind === bestRank.behind && r.distance < bestRank.distance)) {
      best = object;
      bestRank = r;
    }
  }
  return best;
}

/** The object the player is holding, or null. */
export function heldObject(state) {
  return state.objects.find((o) => o.held) ?? null;
}

/** Where `object` goes above the player's head: its bottom-centre at the player's top-centre. */
function aboveHead(object, player) {
  return { ...object, x: centreX(player) - object.width / 2, y: player.y - object.height };
}

function placeAboveHead(object, player) {
  const { x, y } = aboveHead(object, player);
  object.x = x;
  object.y = y;
}

/**
 * One step of objects, after the player has moved:
 *  - Picking up (reqs 29-30): a new press of action while holding nothing
 *    picks up an object the player is touching (overlapping or sharing an
 *    edge). Only a new press counts: holding action doesn't pick up again.
 *    One object at a time: while holding one, action doesn't pick up another.
 *  - No room, no pick-up (task 4.2a): if the chosen object, above the head,
 *    would overlap a solid tile or stick out past the level's sides, nothing
 *    is picked up. Together with the player moving with the held object
 *    (player.js), this keeps a held object out of solids.
 *  - A held object is carried above the player's head, still and not at rest.
 *  - Throwing (req 31): a new press of action while holding lets go of the
 *    object from above the head, forward in the direction the player faces
 *    and upward, at throwSpeed (tuning), whatever the player's own speed.
 *    It is then `thrown` and can't be picked up until it lands (task 4.5).
 *    The press that picks an object up never throws it: only a later press.
 *  - Dropping (req 32): with down held, a new press of action drops the held
 *    object beside the player's feet instead of throwing it (dropObject).
 */
export function updateObjects(state, input) {
  const { player } = state;
  const actionPressed = input[Input.ACTION] && !player.actionHeld;
  player.actionHeld = input[Input.ACTION];

  const held = heldObject(state);
  if (held) {
    placeAboveHead(held, player);
    if (actionPressed && input[Input.DOWN]) dropObject(state, held);
    else if (actionPressed) throwObject(held, player, state.data.tuning.throwSpeed);
  } else if (actionPressed) {
    const chosen = objectToPickUp(state);
    if (chosen && fitsIn(state.level, aboveHead(chosen, player))) {
      chosen.held = true;
      chosen.resting = false;
      chosen.vx = 0;
      chosen.vy = 0;
      placeAboveHead(chosen, player);
    }
  }
}

/**
 * `speed`, with -0 (from negating or flipping a speed of 0) turned into 0, so
 * states that are equal also compare as equal (deepEqual tells 0 and -0 apart).
 */
const withoutNegativeZero = (speed) => speed + 0;

/** Where `object` goes down beside the player's feet on `side` (+1 right, -1 left): flush against the player, bottoms level. */
function besideFeet(object, player, side) {
  const x = side > 0 ? player.x + player.width : player.x - object.width;
  return { ...object, x, y: player.y + player.height - object.height };
}

/**
 * Drops the held object beside the player's feet (req 32): on the side they
 * face if it fits there, else on the other side; if neither fits, the player
 * keeps holding it. It starts at dropSpeed (tuning), x away from the player
 * and y upward, and isn't thrown, so it can be picked up again at once.
 */
function dropObject(state, object) {
  const { player } = state;
  const forward = player.facing === Facing.RIGHT ? 1 : -1;
  const side = [forward, -forward].find((s) => fitsIn(state.level, besideFeet(object, player, s)));
  if (side === undefined) return;

  const { x, y } = besideFeet(object, player, side);
  const { dropSpeed } = state.data.tuning;
  object.held = false;
  object.x = x;
  object.y = y;
  object.vx = withoutNegativeZero(side * dropSpeed.x);
  object.vy = withoutNegativeZero(-dropSpeed.y);   // y increases downwards
}

function throwObject(object, player, throwSpeed) {
  const forward = player.facing === Facing.RIGHT ? 1 : -1;
  object.held = false;
  object.thrown = true;
  object.vx = withoutNegativeZero(forward * throwSpeed.x);
  object.vy = withoutNegativeZero(-throwSpeed.y);   // y increases downwards
}
