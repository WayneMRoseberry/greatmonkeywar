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
 * Running left and right (PRD requirement 20), stopped by walls and the level's
 * side edges (req 23). When something stops the player, vx becomes 0: they're
 * pushing but not moving.
 *
 * Facing: the player faces the direction they're trying to run, even when a
 * wall stops them, and keeps facing that way when neither or both are held.
 */
export function updatePlayer(state, input, dt) {
  const { player } = state;
  const { speed } = state.data.characters.player;
  const direction = (input[Input.RIGHT] ? 1 : 0) - (input[Input.LEFT] ? 1 : 0);
  if (direction !== 0) player.facing = direction > 0 ? Facing.RIGHT : Facing.LEFT;
  player.vx = direction * speed;

  const moved = moveBox(state.level, player, player.vx * dt, 0);
  player.x = moved.x;
  if (moved.hitLeft || moved.hitRight) player.vx = 0;
}
