// Punching (PRD reqs 38-41).
//
// updatePunch changes `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.

import { Facing } from './constants.js';
import { Input } from './input.js';
import { touches } from './collision.js';

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

/**
 * One step of punching, once the player has moved and turned (req 38): a new
 * press of punch punches, in the direction the player now faces; holding the
 * button doesn't punch again. A punch starts the punch flash, punchTime, at
 * punchSeconds (tuning); it counts down each step.
 */
export function updatePunch(state, input, dt) {
  const { player } = state;
  player.punchTime = Math.max(0, player.punchTime - dt);
  const pressed = input[Input.PUNCH] && !player.punchHeld;
  player.punchHeld = input[Input.PUNCH];
  if (pressed) player.punchTime = state.data.tuning.punchSeconds;
}
