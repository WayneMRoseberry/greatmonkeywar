// Drawing a cut scene (PRD reqs 62, 65): the stage scaled to fit the window
// and centred, its background image, the actors, the narration box, and a hint
// for skipping. What is showing comes from cutsceneAt (src/simulation/cutscene.js).

import { drawEntitySprite } from './sprites.js';
import { hudFontSize } from './hud.js';
import { confirmNames } from './binding-names.js';

/** The narration box: half-transparent black along the bottom of the stage. */
export const NARRATION_BOX_COLOR = '#000000';
const NARRATION_BOX_ALPHA = 0.6;
const TEXT_COLOR = '#ffffff';

/**
 * Where the stage (in tiles) sits in the viewport (in pixels): scaled to fit
 * inside it, keeping its proportions, and centred (req 65).
 * { scale (pixels per tile), left, top, width, height } in pixels.
 */
export function stageFit(stage, viewport) {
  const scale = Math.min(viewport.width / stage.width, viewport.height / stage.height);
  const width = stage.width * scale;
  const height = stage.height * scale;
  return { scale, left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height };
}

/** The skip hint: the first keyboard key and gamepad button bound to confirm, e.g. "Enter / A: skip". */
export function skipHint(bindings) {
  return `${confirmNames(bindings)}: skip`;
}

function drawActor(ctx, fit, shownActor, characters, assets) {
  const definition = characters[shownActor.character];
  const { width, height } = definition.size;
  const box = { x: shownActor.x - width / 2, y: shownActor.y - height, width, height, facing: shownActor.facing };
  // A view whose camera puts the stage's top-left at the fitted stage's corner on screen.
  const view = { scale: fit.scale, camera: { x: -fit.left / fit.scale, y: -fit.top / fit.scale } };
  const animation = { name: shownActor.animation, time: shownActor.animationTime };
  if (drawEntitySprite(ctx, view, box, definition, animation, assets)) return;
  ctx.fillStyle = definition.color;
  ctx.fillRect(fit.left + box.x * fit.scale, fit.top + box.y * fit.scale, width * fit.scale, height * fit.scale);
}

function drawNarration(ctx, fit, lines, size) {
  const lineHeight = size * 1.4;
  const boxHeight = lines.length * lineHeight + size;
  const boxTop = fit.top + fit.height - boxHeight;
  ctx.save();
  ctx.globalAlpha = NARRATION_BOX_ALPHA;
  ctx.fillStyle = NARRATION_BOX_COLOR;
  ctx.fillRect(fit.left, boxTop, fit.width, boxHeight);
  ctx.restore();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT_COLOR;
  lines.forEach((line, i) => ctx.fillText(line, fit.left + fit.width / 2, boxTop + size / 2 + (i + 0.5) * lineHeight));
}

/**
 * Draws the cut scene `scene` as `shown` (from cutsceneAt): the background
 * colour over the viewport, the background image covering the fitted stage,
 * each visible actor (its character's sprite, or its shape), the narration
 * box along the bottom of the stage when there is narration, and the skip hint
 * in the viewport's bottom-right corner. `assets` is { images, sheets, warn };
 * `characters` is data.characters.
 */
export function drawCutscene(ctx, scene, shown, assets, characters, viewport, bindings) {
  const fit = stageFit(scene.stage, viewport);
  const size = hudFontSize(viewport.height);
  ctx.save();
  ctx.fillStyle = scene.backgroundColor;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  const background = assets.images[scene.background];
  if (background) ctx.drawImage(background.image, fit.left, fit.top, fit.width, fit.height);
  for (const shownActor of shown.actors) {
    if (shownActor.visible) drawActor(ctx, fit, shownActor, characters, assets);
  }
  if (shown.narration.length > 0) drawNarration(ctx, fit, shown.narration, size);
  ctx.font = `${Math.round(size * 0.7)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(skipHint(bindings), viewport.width - size / 2, viewport.height - size / 2);
  ctx.restore();
}
