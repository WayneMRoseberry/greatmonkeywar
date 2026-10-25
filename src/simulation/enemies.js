// Enemies: patrolling characters the player can stomp, punch, or hit with a
// thrown object (PRD reqs 40, 48-53).
//
// Assumes valid data: enemies are built by createLevelState (state.js), which
// fails with a LevelDataError if an enemy's definition is missing or is the
// player's, so every enemy's `type` names an enemy definition in
// data.characters.

import { Facing } from './constants.js';
import { moveBox, isSupported, overlapsBox } from './collision.js';
import { solidObjects } from './objects.js';

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
  vx = 0;                 // horizontal speed: + is right, - is left; the patrol speed in the facing direction, 0 in the air
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

// The width of the strip at an enemy's leading bottom edge that must have
// ground under it for the enemy to step forward. Thin, so it stands for the
// front edge itself.
const FOOT = 1e-3;

/** The thin strip along the front of `box`, on the side `direction` (+1 right, -1 left) points to. */
function frontFoot(box, direction) {
  const x = direction > 0 ? box.x + box.width - FOOT : box.x;
  return { x, y: box.y, width: FOOT, height: box.height };
}

/**
 * One step of enemies (task 5.2, reqs 49-50), after objects have moved:
 *  - On the ground, an enemy walks at its patrol speed (character definition)
 *    in the direction it faces. It turns around when it walks into a wall (a
 *    solid tile, the level's side edge, or a solid object), stopping flush
 *    against it. It also turns around at the edge of a platform or stack: a
 *    step that would take its front edge past the end of the ground under it
 *    isn't taken, so it never hangs over the edge.
 *  - In the air it doesn't move sideways (vx 0): it falls straight down under
 *    gravity and maxFallSpeed (tuning), and patrols again once it lands.
 *  - An enemy entirely below the level (in a pit) is removed.
 * Enemies collide with solid tiles, the level's sides, and solid objects
 * (resting stackable ones, objects.js), except a solid object they already
 * overlap, which they can walk out of. They pass through each other and
 * through the player.
 */
export function updateEnemies(state, dt) {
  const { level } = state;
  const { gravity, maxFallSpeed } = state.data.tuning;
  const allSolids = solidObjects(state);

  for (const enemy of state.enemies) {
    const solids = allSolids.filter((solid) => !overlapsBox(enemy, solid));
    const direction = enemy.facing === Facing.RIGHT ? 1 : -1;
    const standing = isSupported(level, enemy, solids);

    enemy.vx = standing ? direction * state.data.characters[enemy.type].speed : 0;
    if (enemy.vx !== 0) walk(state, enemy, direction, solids, dt);

    enemy.vy = Math.min(enemy.vy + gravity * dt, maxFallSpeed);
    const fell = moveBox(level, enemy, 0, enemy.vy * dt, solids);
    enemy.y = fell.y;
    if (fell.onGround || fell.hitCeiling) enemy.vy = 0;
  }

  state.enemies = state.enemies.filter((enemy) => enemy.y < level.height);
}

/** One step of walking forward: stops at a wall or an edge, and turns around there. */
function walk(state, enemy, direction, solids, dt) {
  const moved = moveBox(state.level, enemy, enemy.vx * dt, 0, solids);
  const ahead = { ...enemy, x: moved.x };
  const blocked = moved.hitLeft || moved.hitRight;
  const atEdge = !isSupported(state.level, frontFoot(ahead, direction), solids);
  // At a wall it ends flush against it; at an edge it stays put, short of it.
  if (blocked || !atEdge) enemy.x = moved.x;
  if (blocked || atEdge) turn(enemy);
}

function turn(enemy) {
  enemy.facing = enemy.facing === Facing.RIGHT ? Facing.LEFT : Facing.RIGHT;
  enemy.vx = -enemy.vx;
}
