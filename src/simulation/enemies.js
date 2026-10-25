// Enemies: patrolling characters the player can stomp, punch, or hit with a
// thrown object (PRD reqs 40, 48-53).
//
// Assumes valid data: enemies are built by createLevelState (state.js), which
// fails with a LevelDataError if an enemy's definition is missing or is the
// player's, so every enemy's `type` names an enemy definition in
// data.characters.

import { Facing } from './constants.js';

/**
 * An enemy's changing state: the one central declaration of its properties.
 * Instances are sealed, as Player's are: assigning a property that isn't
 * declared here throws a TypeError.
 *
 * Positions and sizes are in tiles; speeds in tiles per second. What doesn't
 * change (patrol speed, colour, sprite) stays in the character definition.
 */
export class Enemy {
  type = '';              // the character definition's name in data.characters, e.g. 'beetle'
  x = 0;                  // left edge of the collision box
  y = 0;                  // top edge of the collision box; y increases downwards
  width = 0;              // collision box size, from the character definition
  height = 0;
  vx = 0;                 // horizontal speed: + is right, - is left; the patrol speed in the facing direction
  vy = 0;                 // vertical speed: + is falling, - is rising
  facing = Facing.LEFT;   // the direction it walks (Facing)
  health = 0;             // starts at the character definition's health (req 40)

  /** An Enemy with the given starting values; anything not given keeps its default. */
  constructor(values = {}) {
    for (const name of Object.keys(values)) {
      if (!Object.hasOwn(this, name)) throw new Error(`"${name}" is not an Enemy property`);
    }
    Object.assign(this, values);
    Object.seal(this);
  }

  /** A separate Enemy with the same values. */
  copy() {
    return new Enemy({ ...this });
  }
}

/**
 * The enemy for a legend entry { enemy, facing }, with its box already placed
 * in its cell (`box`, by state.js) and its character definition: health from
 * the definition, walking in the placement's facing direction (left if it
 * gives none) at the definition's patrol speed.
 */
export function createEnemy(box, entry, definition) {
  const facing = entry.facing ?? Facing.LEFT;
  const direction = facing === Facing.RIGHT ? 1 : -1;
  return new Enemy({
    type: entry.enemy, ...box, facing, health: definition.health, vx: direction * definition.speed,
  });
}
