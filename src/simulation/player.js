// The player's movement and condition, updated once per simulation step.
//
// These functions change `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.
//
// Assumes valid data: the state was built by createLevelState (state.js) from
// data that was validated when loaded (src/data/validate.js). createLevelState
// fails with a LevelDataError if the player definition is missing, so it is
// always present here and isn't checked again. The data is read-only (frozen).

/** Running left and right (PRD requirement 20). */
export function updatePlayer(state, input, dt) {
  const { player } = state;
  const { speed } = state.data.characters.player;
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = direction * speed;
  player.x += player.vx * dt;
}
