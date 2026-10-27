// Sprites (PRD reqs 77-79): choosing animation frames and drawing them.
//
// A sprite sheet (docs/data-formats.md) is an image cut into frames of
// frameWidth × frameHeight pixels, numbered left to right then top to bottom.
// A frame is drawn frameWidth / pixelsPerTile tiles wide, its bottom-centre on
// the entity's box's bottom-centre, flipped when the entity faces left.

import { Facing } from '../simulation/constants.js';

const FALLBACK_ANIMATION = 'idle';

/**
 * The frame number to show for animation `name` at `time` seconds into it:
 * frames in order at the animation's fps, looping, or holding the last frame
 * if `loop` is false. An animation the sheet doesn't have falls back to idle.
 */
export function frameFor(sheet, name, time) {
  const animation = sheet.animations[name] ?? sheet.animations[FALLBACK_ANIMATION];
  const { frames, fps, loop = true } = animation;
  const n = Math.floor(time * fps);
  return frames[loop ? n % frames.length : Math.min(n, frames.length - 1)];
}

/** Where frame number `frame` is in the sheet's image (`imageWidth` pixels wide), in pixels. */
export function frameSource(sheet, frame, imageWidth) {
  const columns = Math.max(1, Math.floor(imageWidth / sheet.frameWidth));
  return {
    sx: (frame % columns) * sheet.frameWidth,
    sy: Math.floor(frame / columns) * sheet.frameHeight,
    sw: sheet.frameWidth,
    sh: sheet.frameHeight,
  };
}

/** The world box a frame of `sheet` is drawn in for an entity's `box`: bottom-centred on it. */
export function spriteBox(sheet, box) {
  const width = sheet.frameWidth / sheet.pixelsPerTile;
  const height = sheet.frameHeight / sheet.pixelsPerTile;
  return { x: box.x + box.width / 2 - width / 2, y: box.y + box.height - height, width, height };
}

// The missing sprites already warned about, for each warn function (so once per game).
const warned = new WeakMap();

function warnOnce(warn, key, message) {
  if (!warned.has(warn)) warned.set(warn, new Set());
  const seen = warned.get(warn);
  if (seen.has(key)) return;
  seen.add(key);
  warn(message);
}

/**
 * Draws `entity` from its definition's sprite, if it has one, playing
 * `animation` ({ name, time }); returns true if it did. Returns false, so the
 * caller draws the shape, when the definition names no sprite, or names one
 * whose sheet or image is missing; a missing one is warned about once (req 79).
 * `assets` is { sheets (data.sprites), images, warn }.
 */
export function drawEntitySprite(ctx, view, entity, definition, animation, assets) {
  const name = definition.sprite;
  if (name === undefined) return false;
  const sheet = assets.sheets[name];
  if (!sheet) {
    warnOnce(assets.warn, name, `Sprite "${name}" is missing; drawing a coloured shape instead.`);
    return false;
  }
  const loaded = assets.images[sheet.image];
  if (!loaded) {
    warnOnce(assets.warn, name, `The image "${sheet.image}" for sprite "${name}" didn't load; drawing a coloured shape instead.`);
    return false;
  }

  const source = frameSource(sheet, frameFor(sheet, animation.name, animation.time), loaded.width);
  const box = spriteBox(sheet, entity);
  const x = (box.x - view.camera.x) * view.scale;
  const y = (box.y - view.camera.y) * view.scale;
  const width = box.width * view.scale;
  const height = box.height * view.scale;
  if (entity.facing === Facing.LEFT) {
    ctx.save();
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(loaded.image, source.sx, source.sy, source.sw, source.sh, 0, y, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(loaded.image, source.sx, source.sy, source.sw, source.sh, x, y, width, height);
  }
  return true;
}

/**
 * The player's animation, in order of priority: "hurt" while knocked back,
 * "punch" while the punch shows, "jump" or "fall" in the air, "carry" when
 * holding an object, "run" when moving, else "idle". Any the sheet lacks
 * falls back to idle (frameFor), so idle and run are enough (req 78).
 */
export function playerAnimation(player, holding) {
  if (player.knockedBack) return 'hurt';
  if (player.punchTime > 0) return 'punch';
  if (!player.onGround) return player.vy < 0 ? 'jump' : 'fall';
  if (holding) return 'carry';
  if (player.vx !== 0) return 'run';
  return 'idle';
}
