// Punching (PRD reqs 38-41).
//
// updatePunch changes `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.

import { Facing } from './constants.js';
import { Input } from './input.js';
import { touches } from './collision.js';
import { defeatEnemy } from './enemies.js';
import { heldObject } from './objects.js';

/**
 * How far the player's sprite frame reaches past their body on each side, in
 * tiles. The frame (frameWidth / pixelsPerTile tiles wide) is drawn centred on
 * the collision box (docs/data-formats.md). With no sprite, or a sprite the
 * data doesn't have, the shape drawn is the box itself, so the reach is 0; a
 * frame narrower than the body also gives 0, never a reach inside the body.
 */
function reachBeyondBody(state) {
  const { player } = state;
  const sheet = state.data.sprites[state.data.characters.player.sprite];
  if (!sheet) return 0;
  return Math.max(0, (sheet.frameWidth / sheet.pixelsPerTile - player.width) / 2);
}

/**
 * The punch area (req 39): from the player's front edge (the side they face)
 * out to the edge of their sprite frame on that side, and as tall as their
 * collision box. With no reach beyond the body it has no width: it is just
 * the front edge.
 */
export function punchArea(state) {
  const { player } = state;
  const reach = reachBeyondBody(state);
  const x = player.facing === Facing.RIGHT ? player.x + player.width : player.x - reach;
  return { x, y: player.y, width: reach, height: player.height };
}

/**
 * The enemies a punch would hit (req 39): every enemy that overlaps the punch
 * area or touches it. With no reach beyond the body, that is exactly the
 * enemies touching or overlapping the player's front edge. Enemies behind the
 * player aren't in reach.
 */
export function enemiesInReach(state) {
  const area = punchArea(state);
  return state.enemies.filter((enemy) => touches(area, enemy));
}

// Punch damage when the player definition gives none (docs/data-formats.md, req 40).
const DEFAULT_PUNCH_DAMAGE = 1;

/**
 * One step of punching, once the player has moved and turned (req 38): a new
 * press of punch punches, in the direction the player now faces; holding the
 * button doesn't punch again. A punch starts the punch flash, punchTime, at
 * punchSeconds (tuning); it counts down each step.
 * The punch hits on the step it is pressed (req 40): every enemy in reach
 * loses health equal to the player definition's punchDamage, and is defeated
 * (defeatEnemy) when its health reaches 0.
 * No punching while carrying (req 41), judged after this step's pick-up,
 * throw, or drop: a press made while carrying does nothing and is used up, so
 * letting go of the object while still holding punch doesn't punch.
 */
export function updatePunch(state, input, dt) {
  const { player } = state;
  player.punchTime = Math.max(0, player.punchTime - dt);
  const pressed = input[Input.PUNCH] && !player.punchHeld;
  player.punchHeld = input[Input.PUNCH];
  if (!pressed || heldObject(state)) return;

  player.punchTime = state.data.tuning.punchSeconds;
  const damage = state.data.characters.player.punchDamage ?? DEFAULT_PUNCH_DAMAGE;
  for (const enemy of enemiesInReach(state)) {
    enemy.health = Math.max(0, enemy.health - damage);
    if (enemy.health === 0) defeatEnemy(state, enemy);
  }
}
