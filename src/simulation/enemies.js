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
import { damagePlayer } from './player.js';
import { withoutNegativeZero } from './numbers.js';

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

/**
 * True if the player touches `enemy` from above: they moved down this step,
 * and their feet were at or above the enemy's top before the move (`before`
 * is the player as they were at the start of the step). That is a stomp
 * (task 5.4), not contact damage.
 */
function touchesFromAbove(player, before, enemy) {
  const movedDown = player.y > before.y;
  return movedDown && before.y + before.height <= enemy.y + TOUCH_EPS;
}

// Allowance for rounding error when comparing the player's feet with an enemy's top.
const TOUCH_EPS = 1e-9;

/**
 * Defeats `enemy`, whatever its health (stomps, thrown objects, punches).
 * For now it is removed at once; task 5.10 adds a short defeat state first.
 */
export function defeatEnemy(state, enemy) {
  state.enemies = state.enemies.filter((e) => e !== enemy);
}

/**
 * Thrown objects hitting enemies (task 5.5, req 33), once objects and enemies
 * have moved. A thrown object (one still in flight) hits every enemy its box
 * overlaps, and each is defeated whatever its health. The object then drops
 * straight down: both its speeds become 0 and it is no longer thrown, so it
 * can be picked up again at once and can't defeat another enemy as it falls.
 * Dropped, falling, resting, and held objects don't defeat enemies.
 */
export function hitEnemiesWithThrownObjects(state) {
  for (const object of state.objects) {
    if (!object.thrown) continue;
    // Known limitation: hits are found by overlap where the object ends up
    // this step, not along the path it moved. At usual throw speeds an object
    // moves far less than an enemy's width per step, so it can't miss. But if
    // throwSpeed.x (tuning) were high enough to carry it more than an enemy's
    // width in one step (above about 50 tiles/s for a 0.9-wide enemy at 60
    // steps per second), a throw could pass through a thin enemy without
    // hitting it. To fix: test the area the object swept this step (its box
    // before and after the move, joined) instead of only its final box.
    const hit = state.enemies.filter((enemy) => overlapsBox(object, enemy));
    if (hit.length === 0) continue;
    for (const enemy of hit) defeatEnemy(state, enemy);
    object.vx = 0;
    object.vy = 0;
    object.thrown = false;
  }
}

/**
 * The player touching enemies, after everything has moved. Touching means the
 * boxes overlap (sharing an edge isn't enough), and only the player's own box
 * counts: a held object touching an enemy doesn't. `before` is the player as
 * they were at the start of the step.
 *  - Stomping (task 5.4, req 52), first: every enemy touched from above
 *    (touchesFromAbove) is defeated, whatever its health and even while the
 *    player is invincible, and the player bounces upward at stompBounceSpeed
 *    (tuning), once however many were stomped, whether or not jump is held.
 *  - Contact damage (task 5.3, req 51): every other enemy touched (from the
 *    side or below) damages the player. damagePlayer (player.js) takes 1
 *    health, knocks the player away from the enemy, and makes them
 *    invincible, so touching several enemies at once costs 1 health.
 */
export function resolveEnemyContact(state, before) {
  const { player } = state;
  const touched = state.enemies.filter((enemy) => overlapsBox(player, enemy));
  const stomped = touched.filter((enemy) => touchesFromAbove(player, before, enemy));
  for (const enemy of stomped) defeatEnemy(state, enemy);
  if (stomped.length > 0) {
    player.vy = withoutNegativeZero(-state.data.tuning.stompBounceSpeed);   // y increases downwards
    player.onGround = false;
  }
  for (const enemy of touched) {
    if (!stomped.includes(enemy)) damagePlayer(state, enemy);
  }
}
