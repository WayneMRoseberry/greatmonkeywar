// Drawing a level to the canvas (PRD reqs 66-68, 70, 76-79).
//
// levelView works out what is on screen; drawLevel draws it. World positions
// are in tiles; the view turns them into canvas pixels.

import { visibleArea, cameraFor } from '../simulation/camera.js';
import { layerSize, layerCopies } from '../simulation/parallax.js';
import { punchArea } from '../simulation/punch.js';
import { isDefeated } from '../simulation/enemies.js';
import { heldObject } from '../simulation/objects.js';
import { drawEntitySprite, playerAnimation } from './sprites.js';

/** How many times a second a flashing shape (invincible player, defeated enemy) is shown or hidden. */
export const FLASH_PER_SECOND = 10;

/** The punch flash: a half-transparent white over the punch area (Design Considerations). */
export const PUNCH_FLASH_COLOR = '#ffffff';
const PUNCH_FLASH_ALPHA = 0.5;

/** A punch area with no width (no sprite) is drawn this wide, in tiles, so it can be seen. */
export const PUNCH_FLASH_MIN_WIDTH = 0.1;

/**
 * What is on screen for `state` on a canvas of `canvasSize` pixels:
 * { scale (pixels per tile), area (visibleArea), camera ({ x, y }, the
 * view's top-left in the world), pixelWidth, pixelHeight }.
 */
export function levelView(state, canvasSize, visibleHeight) {
  const area = visibleArea(canvasSize.width, canvasSize.height, visibleHeight);
  return {
    scale: area.scale,
    area,
    camera: cameraFor(state.level, state.player, area),
    pixelWidth: canvasSize.width,
    pixelHeight: canvasSize.height,
  };
}

/** Fills the world box `box` in `color`. */
function fillBox(ctx, view, box, color) {
  ctx.fillStyle = color;
  ctx.fillRect((box.x - view.camera.x) * view.scale, (box.y - view.camera.y) * view.scale,
    box.width * view.scale, box.height * view.scale);
}

/** True on the "shown" half of each flash. */
const flashShown = (time) => Math.floor(time * FLASH_PER_SECOND) % 2 === 0;

function drawLayers(ctx, state, view, images) {
  const { layers } = state.data.levels[state.levelName].background;
  for (const layer of layers) {
    const loaded = images[layer.image];
    if (!loaded) continue;   // validation reports a missing image; draw what there is
    const size = layerSize(loaded.width, loaded.height, view.area.height);
    const copies = layerCopies({
      cameraX: view.camera.x, scrollFactor: layer.scrollFactor, imageWidth: size.width,
      viewWidth: view.area.width, repeat: layer.repeat ?? true,
    });
    for (const x of copies) {
      ctx.drawImage(loaded.image, x * view.scale, 0, size.width * view.scale, size.height * view.scale);
    }
  }
}

/**
 * Fills the tile at (column, row) in `color`, its edges rounded to whole
 * pixels: each tile then starts exactly where the one before it ends, so no
 * anti-aliased seams show between tiles.
 */
function fillTile(ctx, view, column, row, color) {
  const left = Math.round((column - view.camera.x) * view.scale);
  const right = Math.round((column + 1 - view.camera.x) * view.scale);
  const top = Math.round((row - view.camera.y) * view.scale);
  const bottom = Math.round((row + 1 - view.camera.y) * view.scale);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, right - left, bottom - top);
}

/** The tiles in view, each a square in its type's colour (solid or not). */
function drawTiles(ctx, state, view) {
  const { level } = state;
  const firstColumn = Math.max(0, Math.floor(view.camera.x));
  const lastColumn = Math.min(level.width - 1, Math.ceil(view.camera.x + view.area.width));
  const firstRow = Math.max(0, Math.floor(view.camera.y));
  const lastRow = Math.min(level.height - 1, Math.ceil(view.camera.y + view.area.height));
  for (let row = firstRow; row <= lastRow; row++) {
    const line = [...level.grid[row]];
    for (let column = firstColumn; column <= lastColumn; column++) {
      const type = level.tileTypes[line[column]];
      if (type) fillTile(ctx, view, column, row, type.color);
    }
  }
}

/** The goal's colour, from its legend entry. */
function goalColor(state) {
  const entry = Object.values(state.data.levels[state.levelName].legend).find((e) => e.goal);
  return entry.color;
}

/**
 * Draws an entity: its sprite if its definition names one that is loaded
 * (sprites.js), otherwise its shape in its definition's colour (req 76, 79).
 */
function drawEntity(ctx, view, entity, definition, animation, assets) {
  if (!drawEntitySprite(ctx, view, entity, definition, animation, assets)) fillBox(ctx, view, entity, definition.color);
}

function drawPunchFlash(ctx, state, view) {
  const area = punchArea(state);
  const facingLeft = area.x < state.player.x;
  const width = Math.max(area.width, PUNCH_FLASH_MIN_WIDTH);
  const x = facingLeft ? area.x + area.width - width : area.x;
  ctx.save();
  ctx.globalAlpha = PUNCH_FLASH_ALPHA;
  fillBox(ctx, view, { x, y: area.y, width, height: area.height }, PUNCH_FLASH_COLOR);
  ctx.restore();
}

/**
 * Draws the level `state` in `view`: the background colour over the whole
 * canvas, the parallax layers (the first in the data is the farthest), the
 * tiles, the goal, rewards, objects, enemies, the player, then the punch
 * flash. An invincible player and a defeated enemy flash. `assets` is
 * { images: { path: { image, width, height } }, warn(message) }.
 */
export function drawLevel(ctx, state, view, levelAssets) {
  const { data, player, time } = state;
  const assets = { ...levelAssets, sheets: data.sprites };
  ctx.fillStyle = data.levels[state.levelName].background.color;
  ctx.fillRect(0, 0, view.pixelWidth, view.pixelHeight);
  drawLayers(ctx, state, view, assets.images);
  drawTiles(ctx, state, view);
  fillBox(ctx, view, state.goal, goalColor(state));
  for (const reward of state.rewards) fillBox(ctx, view, reward, reward.color);
  for (const object of state.objects) {
    drawEntity(ctx, view, object, data.objects[object.type], { name: 'idle', time }, assets);
  }
  for (const enemy of state.enemies) {
    if (isDefeated(enemy) && !flashShown(time)) continue;
    drawEntity(ctx, view, enemy, data.characters[enemy.type], { name: 'run', time }, assets);
  }
  if (player.invincibleTime <= 0 || flashShown(time)) {
    const animation = { name: playerAnimation(player, heldObject(state) !== null), time };
    drawEntity(ctx, view, player, data.characters.player, animation, assets);
  }
  if (player.punchTime > 0) drawPunchFlash(ctx, state, view);
}
