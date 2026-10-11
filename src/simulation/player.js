// The player's movement and condition, updated once per simulation step.
//
// These functions change `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.
//
// Assumes valid data: the state was built by createLevelState (state.js) from
// data that was validated when loaded (src/data/validate.js). createLevelState
// fails with a LevelDataError if the player definition is missing, so it is
// always present here and isn't checked again. The data is read-only (frozen).

import { Facing } from './constants.js';
import { Input } from './input.js';
import { moveBox } from './collision.js';

/**
 * The player's changing state: the one central declaration of its properties.
 * Instances are sealed: assigning a property that isn't declared here (such
 * as a typo) throws a TypeError, and properties can't be removed.
 *
 * Positions and sizes are in tiles; speeds in tiles per second.
 */
export class Player {
  x = 0;                  // left edge of the collision box
  y = 0;                  // top edge of the collision box; y increases downwards
  width = 0;              // collision box size, from the player definition
  height = 0;
  vx = 0;                 // horizontal speed: + is right, - is left; 0 when stopped by a wall
  vy = 0;                 // vertical speed: + is falling, - is rising; 0 on the ground or after hitting a ceiling
  onGround = false;       // true when the last move down was stopped by something solid
  facing = Facing.RIGHT;  // the direction the player is trying to run (Facing)
  health = 0;             // starts at the player definition's health
  jumpHeld = false;       // whether jump was held last step: only a new press jumps

  /** A Player with the given starting values; anything not given keeps its default. */
  constructor(values = {}) {
    for (const name of Object.keys(values)) {
      if (!Object.hasOwn(this, name)) throw new Error(`"${name}" is not a Player property`);
    }
    Object.assign(this, values);
    Object.seal(this);
  }

  /** A separate Player with the same values. */
  copy() {
    return new Player({ ...this });
  }
}

// How far below the player to look for ground when deciding if they're standing.
// Tiny, so only ground actually touching the player's feet counts.
const GROUND_PROBE = 1e-6;

/** True if there is something solid directly under the player's feet. */
function isStanding(state) {
  return moveBox(state.level, state.player, 0, GROUND_PROBE).onGround;
}

/**
 * One step of player movement:
 *  - Running left and right (req 20). Facing follows the direction the player is
 *    trying to run, even when a wall stops them, and stays the same when
 *    neither or both directions are held.
 *  - Gravity: vy grows by gravity × dt, up to maxFallSpeed (tuning).
 *  - Jumping (reqs 21-22): pressing jump while standing sets vy to -jumpSpeed.
 *    Only a new press jumps: holding jump doesn't jump again on landing.
 *    "Standing" is checked directly, so a player who arrived exactly on the
 *    ground last step (onGround still false) can jump at once.
 *  - Collision (req 23): the move goes through moveBox. A wall stops the
 *    player and makes vx 0; landing or hitting a ceiling makes vy 0.
 */
export function updatePlayer(state, input, dt) {
  const { player } = state;
  const { speed } = state.data.characters.player;
  const { gravity, jumpSpeed, maxFallSpeed } = state.data.tuning;

  const direction = (input[Input.RIGHT] ? 1 : 0) - (input[Input.LEFT] ? 1 : 0);
  if (direction !== 0) player.facing = direction > 0 ? Facing.RIGHT : Facing.LEFT;
  player.vx = direction * speed;

  const standing = isStanding(state);
  player.vy = Math.min(player.vy + gravity * dt, maxFallSpeed);
  const jumpPressed = input[Input.JUMP] && !player.jumpHeld;
  if (jumpPressed && standing) player.vy = -jumpSpeed;
  player.jumpHeld = input[Input.JUMP];

  const moved = moveBox(state.level, player, player.vx * dt, player.vy * dt);
  player.x = moved.x;
  player.y = moved.y;
  player.onGround = moved.onGround;
  if (moved.hitLeft || moved.hitRight) player.vx = 0;
  if (moved.onGround || moved.hitCeiling) player.vy = 0;
}
