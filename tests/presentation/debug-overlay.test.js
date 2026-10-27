// Tests for the debug overlay (task 7.14; PRD req 10 and Design Considerations),
// with the recording fake canvas and the fake platform.
//
// debugLines(info) is the overlay's text; drawDebugOverlay(ctx, lines,
// viewport) draws it. `info` is what the game controller gathers each frame:
// { fps, player, held, device, viewport, area, platform }.
// Decided:
//  - one line each for: frames per second, the player's position, their
//    velocity, whether they are on the ground, the held object, the input
//    device, the window size, the visible world area, and Steam's status with
//    the user's name (from the platform);
//  - numbers are shown to 2 decimal places (fps as a whole number);
//  - with no level (start screen, cut scene), the player lines show "-";
//  - the overlay is drawn in the top-right corner, on a half-transparent dark box.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { debugLines, drawDebugOverlay } from '../../src/presentation/debug-overlay.js';
import { createFakeContext } from '../helpers/fake-canvas.js';
import { createFakePlatform } from '../../src/platform/fake-platform.js';
import { SteamStatus } from '../../src/platform/platform.js';
import { InputDevice } from '../../src/presentation/input.js';

const PLAYER = { x: 3.25, y: 7, vx: 6, vy: -2.5, onGround: false };
const INFO = {
  fps: 59.6,
  player: PLAYER,
  held: 'crate',
  device: InputDevice.GAMEPAD,
  viewport: { width: 1280, height: 720 },
  area: { width: 21.333333, height: 12 },
  platform: createFakePlatform({ steam: SteamStatus.CONNECTED, userName: 'Wayne' }),
};

describe('the overlay\'s lines (Design Considerations)', () => {
  test('frames per second, player position, velocity, on the ground, held object, device, window, visible area, and Steam', () => {
    assert.deepEqual(debugLines(INFO), [
      'FPS: 60',
      'Player: x 3.25, y 7.00',
      'Velocity: vx 6.00, vy -2.50',
      'On ground: no',
      'Holding: crate',
      'Input: gamepad',
      'Window: 1280 × 720 px',
      'Visible: 21.33 × 12.00 tiles',
      'Steam: connected (Wayne)',
    ]);
  });

  test('Steam unavailable has no user name (req 10)', () => {
    const lines = debugLines({ ...INFO, platform: createFakePlatform({ steam: SteamStatus.UNAVAILABLE }) });
    assert.equal(lines.at(-1), 'Steam: unavailable');
  });

  test('holding nothing, and on the ground', () => {
    const lines = debugLines({ ...INFO, held: null, player: { ...PLAYER, onGround: true } });
    assert.ok(lines.includes('Holding: nothing'));
    assert.ok(lines.includes('On ground: yes'));
  });

  test('with no level, the player lines show "-"', () => {
    const lines = debugLines({ ...INFO, player: null, held: null });
    assert.ok(lines.includes('Player: -'));
    assert.ok(lines.includes('Velocity: -'));
    assert.ok(lines.includes('On ground: -'));
  });
});

describe('drawing the overlay', () => {
  test('every line is drawn, right-aligned near the top-right corner, over a half-transparent box', () => {
    const viewport = { width: 1280, height: 720 };
    const lines = debugLines(INFO);
    const ctx = createFakeContext();
    drawDebugOverlay(ctx, lines, viewport);
    assert.deepEqual(ctx.texts(), lines);
    const [box] = ctx.callsOf('fillRect');
    assert.ok(box.style.globalAlpha < 1, 'half-transparent');
    assert.ok(box.args[0] + box.args[2] <= viewport.width + 1e-9 && box.args[0] > viewport.width / 2, 'on the right');
    for (const call of ctx.callsOf('fillText')) {
      assert.equal(call.style.textAlign, 'right');
      assert.ok(call.args[1] > viewport.width / 2 && call.args[1] <= viewport.width);
    }
  });
});
