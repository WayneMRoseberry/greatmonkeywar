// The HUD (PRD req 44): health and reward count in the top-left corner, at a
// size that stays readable at any window size.

/** The HUD's font size is this share of the viewport's height... */
export const HUD_FONT_SHARE = 0.045;
/** ...but never smaller than this many pixels. */
export const MIN_HUD_FONT = 16;
/** How far the text is set in from the corner, in font sizes. */
export const HUD_MARGIN = 0.75;
// The space between lines, in font sizes.
const LINE_SPACING = 1.25;

/** The HUD's font size in pixels for a viewport `viewportHeight` pixels tall. */
export function hudFontSize(viewportHeight) {
  return Math.max(MIN_HUD_FONT, Math.round(viewportHeight * HUD_FONT_SHARE));
}

/**
 * Draws `text` with its top-left at (x, y) in white over a dark outline, so it
 * reads over any background. The font and alignment must already be set.
 */
export function outlinedText(ctx, text, x, y, size) {
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

/** What the label shown while sound is muted says (sound PRD req 19). */
export const SOUND_OFF_TEXT = 'Sound off';

/** Draws the "Sound off" label in the viewport's top-right corner, in the HUD's font and style. */
export function drawSoundOff(ctx, viewport) {
  const size = hudFontSize(viewport.height);
  const margin = HUD_MARGIN * size;
  ctx.save();
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  outlinedText(ctx, SOUND_OFF_TEXT, viewport.width - margin, margin, size);
  ctx.restore();
}

/** Draws the HUD for `status` ({ health, rewardCount }) on a viewport of { width, height } pixels. */
export function drawHud(ctx, status, viewport) {
  const size = hudFontSize(viewport.height);
  const margin = HUD_MARGIN * size;
  ctx.save();
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  outlinedText(ctx, `Health: ${status.health}`, margin, margin, size);
  outlinedText(ctx, `Rewards: ${status.rewardCount}`, margin, margin + LINE_SPACING * size, size);
  ctx.restore();
}
