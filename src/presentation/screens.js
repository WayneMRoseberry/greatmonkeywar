// The screens (PRD reqs 7, 56, 58, 85): the start screen, the level-complete
// panel, "Thanks for playing", and the data error screen.

import { MenuOption } from '../simulation/flow.js';
import { hudFontSize } from './hud.js';

export const GAME_TITLE = 'Great Monkey War';

/** What each menu option says. */
export const MENU_LABELS = Object.freeze({
  [MenuOption.START]: 'Start',
  [MenuOption.NEXT_LEVEL]: 'Next level',
  [MenuOption.EXIT]: 'Exit game',
});

/** The box behind the selected menu option. */
export const HIGHLIGHT_COLOR = '#ffd23f';
const BACKGROUND_COLOR = '#14213d';
const PANEL_COLOR = '#000000';
const PANEL_ALPHA = 0.7;
const TEXT_COLOR = '#ffffff';
const SELECTED_TEXT_COLOR = '#14213d';

/** The data error screen's font never shrinks below this many pixels. */
export const MIN_ERROR_FONT = 10;

function fillBackground(ctx, viewport) {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/** Draws `text` centred on (x, y), at `size` pixels. */
function centredText(ctx, text, x, y, size, color = TEXT_COLOR) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Draws a menu's options one under another, centred on `x`, the first at `top`;
 * the selected one has a highlight box behind it.
 */
function drawMenu(ctx, menu, x, top, size) {
  menu.options.forEach((option, i) => {
    const label = MENU_LABELS[option];
    const y = top + i * size * 2;
    const selected = i === menu.selected;
    if (selected) {
      ctx.font = `bold ${size}px sans-serif`;
      const width = ctx.measureText(label).width + size * 2;
      const height = size * 1.6;
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);
    }
    centredText(ctx, label, x, y, size, selected ? SELECTED_TEXT_COLOR : TEXT_COLOR);
  });
}

/** The start screen (req 56): the game's name and its menu (Start, highlighted). */
export function drawStartScreen(ctx, menu, viewport) {
  const size = hudFontSize(viewport.height);
  ctx.save();
  fillBackground(ctx, viewport);
  centredText(ctx, GAME_TITLE, viewport.width / 2, viewport.height * 0.35, size * 2.5);
  drawMenu(ctx, menu, viewport.width / 2, viewport.height * 0.6, size * 1.2);
  ctx.restore();
}

/**
 * The level-complete panel (req 58), drawn over the frozen game:
 * "Level complete", the reward count, and the menu.
 */
export function drawLevelComplete(ctx, menu, rewardCount, viewport) {
  const size = hudFontSize(viewport.height);
  const width = Math.min(viewport.width * 0.8, size * 20);
  const height = size * (8 + menu.options.length * 2);
  const left = (viewport.width - width) / 2;
  const top = (viewport.height - height) / 2;
  const x = viewport.width / 2;
  ctx.save();
  ctx.globalAlpha = PANEL_ALPHA;
  ctx.fillStyle = PANEL_COLOR;
  ctx.fillRect(left, top, width, height);
  ctx.globalAlpha = 1;
  centredText(ctx, 'Level complete', x, top + size * 2, size * 1.6);
  centredText(ctx, `Rewards: ${rewardCount}`, x, top + size * 4.5, size);
  drawMenu(ctx, menu, x, top + size * 7, size);
  ctx.restore();
}

/** "Thanks for playing" (req 7), shown when the game can't close itself (browser mode). */
export function drawThanks(ctx, viewport) {
  ctx.save();
  fillBackground(ctx, viewport);
  centredText(ctx, 'Thanks for playing', viewport.width / 2, viewport.height / 2, hudFontSize(viewport.height) * 2);
  ctx.restore();
}

/** Splits `text` into lines no wider than `maxWidth` at the current font (a word longer than that gets a line of its own). */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The data error screen (req 85): a title, then every error (plain-language
 * messages from validate.js), one per line, wrapped to the canvas width. The
 * font shrinks, down to MIN_ERROR_FONT, until every line fits; at the
 * smallest size every error is still drawn.
 */
export function drawDataErrors(ctx, errors, viewport) {
  const title = 'The game data has problems, so the game can\'t start:';
  ctx.save();
  fillBackground(ctx, viewport);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let size = hudFontSize(viewport.height);
  let lines;
  for (;;) {
    ctx.font = `${size}px sans-serif`;
    const margin = size;
    lines = errors.flatMap((error) => wrap(ctx, error, viewport.width - 2 * margin));
    const height = (lines.length + 2) * size * 1.3 + 2 * margin;
    if (height <= viewport.height || size <= MIN_ERROR_FONT) break;
    size = Math.max(MIN_ERROR_FONT, size - 1);
  }
  const margin = size;
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.fillText(title, margin, margin);
  ctx.font = `${size}px sans-serif`;
  lines.forEach((line, i) => ctx.fillText(line, margin, margin + (i + 2) * size * 1.3));
  ctx.restore();
}
