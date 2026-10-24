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
import { moveBox, isSupported } from './collision.js';

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
  invincibleTime = 0;     // seconds of invincibility left after being damaged; the renderer flashes while > 0
  knockedBack = false;    // true from being damaged until landing: running input is ignored meanwhile

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

/**
 * Damages the player (reqs 24-25), e.g. when an enemy touches them. `source` is
 * the box of whatever did it. Unless invincible, the player loses 1 health
 * (never below 0), becomes invincible for invincibilitySeconds (tuning), and is
 * knocked back: away from the source's centre (backwards, opposite to their
 * facing, if hit dead-centre) and upwards, at the knockback speeds in tuning.
 * Returns true if the player was damaged, false if they were invincible.
 */
export function damagePlayer(state, source) {
  const { player } = state;
  if (player.invincibleTime > 0) return false;
  const { invincibilitySeconds, knockback } = state.data.tuning;

  player.health = Math.max(0, player.health - 1);
  player.invincibleTime = invincibilitySeconds;

  const offset = (player.x + player.width / 2) - (source.x + source.width / 2);
  const away = offset !== 0 ? Math.sign(offset) : (player.facing === Facing.RIGHT ? -1 : 1);
  player.vx = away * knockback.x;
  player.vy = -knockback.y;
  player.knockedBack = true;
  return true;
}

/** True if there is something solid directly under the player's feet. */
function isStanding(state) {
  return isSupported(state.level, state.player);
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

  player.invincibleTime = Math.max(0, player.invincibleTime - dt);

  // While knocked back, the knockback carries the player: running input is ignored.
  if (!player.knockedBack) {
    const direction = (input[Input.RIGHT] ? 1 : 0) - (input[Input.LEFT] ? 1 : 0);
    if (direction !== 0) player.facing = direction > 0 ? Facing.RIGHT : Facing.LEFT;
    player.vx = direction * speed;
  }

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
  if (moved.onGround) player.knockedBack = false;

  if (player.y >= state.level.height) fallIntoPit(state);
}

/**
 * Falling into a pit (req 26): once the player is entirely below the bottom of
 * the level, they lose 1 health (never below 0; invincibility doesn't protect
 * against this) and respawn at the start, at rest.
 */
function fallIntoPit(state) {
  const { player, start } = state;
  player.health = Math.max(0, player.health - 1);
  player.x = start.x;
  player.y = start.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.knockedBack = false;
}
