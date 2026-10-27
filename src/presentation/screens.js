// The screens (PRD reqs 7, 56, 58, 85): the start screen, the level-complete
// panel, "Thanks for playing", and the data error screen.

import { MenuOption } from '../simulation/flow.js';
import { hudFontSize } from './hud.js';
import { confirmNames } from './binding-names.js';

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

/** The menu hint: how to choose an option, e.g. "Enter / A or click: choose". */
export function menuHint(bindings) {
  return `${confirmNames(bindings)} or click: choose`;
}

/**
 * Where a menu's options are: one under another, centred on `x`, the first at
 * `top`. Each is { x, y, width, height }, the box the highlight is drawn in
 * when it is selected, and the area a click on it must land in.
 */
function menuBoxes(ctx, menu, { x, top, size }) {
  ctx.save();
  ctx.font = `bold ${size}px sans-serif`;
  const boxes = menu.options.map((option, i) => {
    const y = top + i * size * 2;
    const width = ctx.measureText(MENU_LABELS[option]).width + size * 2;
    const height = size * 1.6;
    return { x: x - width / 2, y: y - height / 2, width, height };
  });
  ctx.restore();
  return boxes;
}

/** Draws a menu's options in their boxes (menuBoxes); the selected one has a highlight behind it. */
function drawMenu(ctx, menu, place) {
  menuBoxes(ctx, menu, place).forEach((box, i) => {
    const selected = i === menu.selected;
    if (selected) {
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    centredText(ctx, MENU_LABELS[menu.options[i]], box.x + box.width / 2, box.y + box.height / 2, place.size,
      selected ? SELECTED_TEXT_COLOR : TEXT_COLOR);
  });
}

/** The index of the option whose box holds `point` ({ x, y }), or -1 if none does. */
export function optionAt(boxes, point) {
  return boxes.findIndex((box) =>
    point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
}

/** Where the start screen's menu goes. */
function startMenuPlace(viewport) {
  return { x: viewport.width / 2, top: viewport.height * 0.6, size: hudFontSize(viewport.height) * 1.2 };
}

/** The start screen's option boxes (menuBoxes), for clicks. */
export function startMenuBoxes(ctx, menu, viewport) {
  return menuBoxes(ctx, menu, startMenuPlace(viewport));
}

/** The start screen (req 56): the game's name, its menu (Start, highlighted), and the menu hint. */
export function drawStartScreen(ctx, menu, viewport, bindings) {
  const size = hudFontSize(viewport.height);
  ctx.save();
  fillBackground(ctx, viewport);
  centredText(ctx, GAME_TITLE, viewport.width / 2, viewport.height * 0.35, size * 2.5);
  drawMenu(ctx, menu, startMenuPlace(viewport));
  centredText(ctx, menuHint(bindings), viewport.width / 2, viewport.height * 0.85, size * 0.8);
  ctx.restore();
}

/** The level-complete panel's size and place, and where its menu goes. */
function levelCompleteLayout(menu, viewport) {
  const size = hudFontSize(viewport.height);
  const width = Math.min(viewport.width * 0.8, size * 20);
  const height = size * (10 + menu.options.length * 2);
  const left = (viewport.width - width) / 2;
  const top = (viewport.height - height) / 2;
  const x = viewport.width / 2;
  return { size, width, height, left, top, x, menu: { x, top: top + size * 7, size } };
}

/** The level-complete panel's option boxes (menuBoxes), for clicks. */
export function levelCompleteMenuBoxes(ctx, menu, viewport) {
  return menuBoxes(ctx, menu, levelCompleteLayout(menu, viewport).menu);
}

/**
 * The level-complete panel (req 58), drawn over the frozen game:
 * "Level complete", the reward count, the menu, and the menu hint.
 */
export function drawLevelComplete(ctx, menu, rewardCount, viewport, bindings) {
  const layout = levelCompleteLayout(menu, viewport);
  const { size, width, height, left, top, x } = layout;
  ctx.save();
  ctx.globalAlpha = PANEL_ALPHA;
  ctx.fillStyle = PANEL_COLOR;
  ctx.fillRect(left, top, width, height);
  ctx.globalAlpha = 1;
  centredText(ctx, 'Level complete', x, top + size * 2, size * 1.6);
  centredText(ctx, `Rewards: ${rewardCount}`, x, top + size * 4.5, size);
  drawMenu(ctx, menu, layout.menu);
  centredText(ctx, menuHint(bindings), x, top + height - size * 1.5, size * 0.8);
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
