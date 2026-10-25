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
import { updateObjects, updateFalling } from './objects.js';
import { collectRewards } from './rewards.js';
import { updateEnemies, hitEnemiesWithThrownObjects, resolveEnemyContact } from './enemies.js';

const copyObjects = (objects) => objects.map((o) => o.copy());
const copyEnemies = (enemies) => enemies.map((e) => e.copy());

/**
 * A copy of `state` that shares nothing changeable with it. The loaded game
 * data is read-only and the same for every state, so it is shared, not copied.
 * Players, enemies, and objects are copied with their copy() methods, which
 * keep them sealed Player, Enemy, and CarriableObject instances
 * (structuredClone would turn them into plain objects).
 */
function copyState({ data, player, enemies, objects, levelStart, ...rest }) {
  const { player: startPlayer, enemies: startEnemies, objects: startObjects, ...startRest } = levelStart;
  return {
    ...structuredClone(rest),
    data,
    player: player.copy(),
    enemies: copyEnemies(enemies),
    objects: copyObjects(objects),
    levelStart: {
      ...structuredClone(startRest),
      player: startPlayer.copy(),
      enemies: copyEnemies(startEnemies),
      objects: copyObjects(startObjects),
    },
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
  state.enemies = copyEnemies(levelStart.enemies);
  state.objects = copyObjects(levelStart.objects);
  state.rewards = structuredClone(levelStart.rewards);
  state.rewardCount = levelStart.rewardCount;
}

export function step(state, input, dt) {
  const next = copyState(state);
  next.time += dt;
  updatePlayer(next, input, dt);
  updateObjects(next, input);   // after the player moves, so a held object follows them
  updateFalling(next, dt);      // after updateObjects, so thrown and dropped objects move at once
  updateEnemies(next, dt);      // after objects, so they walk on crates as they now are
  hitEnemiesWithThrownObjects(next);   // before the player's contact, so an enemy hit this step can't hurt them
  resolveEnemyContact(next, state.player);   // stomps, then contact damage, once everything has moved; state.player is where the player started
  collectRewards(next);
  // Checked last, so health reaching 0 by any means (pits, damage) restarts the level.
  if (next.player.health <= 0) restartLevel(next);
  return next;
}
