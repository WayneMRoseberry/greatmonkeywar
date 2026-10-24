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
import { updateObjects } from './objects.js';

const copyObjects = (objects) => objects.map((o) => o.copy());

/**
 * A copy of `state` that shares nothing changeable with it. The loaded game
 * data is read-only and the same for every state, so it is shared, not copied.
 * Players and objects are copied with their copy() methods, which keep them
 * sealed Player and CarriableObject instances (structuredClone would turn them
 * into plain objects).
 */
function copyState({ data, player, objects, levelStart, ...rest }) {
  const { player: startPlayer, objects: startObjects, ...startRest } = levelStart;
  return {
    ...structuredClone(rest),
    data,
    player: player.copy(),
    objects: copyObjects(objects),
    levelStart: { ...structuredClone(startRest), player: startPlayer.copy(), objects: copyObjects(startObjects) },
  };
}

/**
 * Restarting the level when the player's health reaches 0 (req 27): everything
 * returns to how it was when the level started, from the level-start snapshot.
 * The snapshot itself is kept, so the level can restart again.
 */
function restartLevel(state) {
  const { levelStart } = state;
  state.player = levelStart.player.copy();
  state.objects = copyObjects(levelStart.objects);
  state.rewardCount = levelStart.rewardCount;
}

export function step(state, input, dt) {
  const next = copyState(state);
  next.time += dt;
  updatePlayer(next, input, dt);
  updateObjects(next, input);   // after the player moves, so a held object follows them
  // Checked last, so health reaching 0 by any means (pits, damage) restarts the level.
  if (next.player.health <= 0) restartLevel(next);
  return next;
}
