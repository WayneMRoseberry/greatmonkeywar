// The debug overlay (F3; PRD req 10 and Design Considerations).

import { SteamStatus } from '../platform/platform.js';
import { hudFontSize } from './hud.js';

const fixed = (n) => n.toFixed(2);

/**
 * The overlay's text, one line each: frames per second, the player's position
 * and velocity, whether they are on the ground, the held object, the input
 * device, the window size, the visible world area, the music playing and the
 * sound state (sound PRD req 26), and Steam's status and user name (from the
 * platform). With no level, the player lines show "-".
 * `info` is { fps, player, held (object type or null), device, viewport, area,
 * platform, music (file or null), sound (SoundState, audio.js) }.
 */
export function debugLines({ fps, player, held, device, viewport, area, platform, music, sound }) {
  const steamName = platform.getSteamUserName();
  const steam = platform.getSteamStatus() === SteamStatus.CONNECTED ? `connected (${steamName})` : 'unavailable';
  return [
    `FPS: ${Math.round(fps)}`,
    player ? `Player: x ${fixed(player.x)}, y ${fixed(player.y)}` : 'Player: -',
    player ? `Velocity: vx ${fixed(player.vx)}, vy ${fixed(player.vy)}` : 'Velocity: -',
    player ? `On ground: ${player.onGround ? 'yes' : 'no'}` : 'On ground: -',
    `Holding: ${held ?? 'nothing'}`,
    `Input: ${device}`,
    `Window: ${viewport.width} × ${viewport.height} px`,
    `Visible: ${fixed(area.width)} × ${fixed(area.height)} tiles`,
    `Music: ${music ?? 'none'}`,
    `Sound: ${sound}`,
    `Steam: ${steam}`,
  ];
}

/** Draws `lines` right-aligned in the viewport's top-right corner, over a half-transparent dark box. */
export function drawDebugOverlay(ctx, lines, viewport) {
  const size = Math.round(hudFontSize(viewport.height) * 0.7);
  const lineHeight = size * 1.3;
  const margin = size;
  ctx.save();
  ctx.font = `${size}px monospace`;
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 2 * margin;
  const height = lines.length * lineHeight + margin;
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#000000';
  ctx.fillRect(viewport.width - width, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, viewport.width - margin, margin / 2 + i * lineHeight));
  ctx.restore();
}
