// The single simulation update (PRD requirement 72).
//
// step(state, input, dt) returns the next state after `dt` seconds with the
// given input state held. It never changes the state or input passed in.
//
// Assumes valid data: `state` comes from createLevelState (state.js) or from an
// earlier step(). Data is validated when loaded (src/data/validate.js), and
// createLevelState fails with a LevelDataError rather than build a state from a
// broken level, so the update functions called here don't check the data again.

import { updatePlayer } from './player.js';

/**
 * A copy of `state` that shares nothing changeable with it. The loaded game
 * data is read-only and the same for every state, so it is shared, not copied.
 */
function copyState({ data, ...rest }) {
  return { ...structuredClone(rest), data };
}

export function step(state, input, dt) {
  const next = copyState(state);
  next.time += dt;
  updatePlayer(next, input, dt);
  return next;
}
