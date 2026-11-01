// Tests for the HUD (task 7.11; PRD req 44), with the recording fake canvas.
//
// drawHud(ctx, { health, rewardCount }, viewport) shows the health and reward
// count as text in the top-left corner.
// Decided:
//  - two lines, "Health: n" and "Rewards: n";
//  - the font size grows with the viewport's height (HUD_FONT_SHARE of it),
//    but is never smaller than MIN_HUD_FONT pixels, so it stays readable;
//  - the text is set in from the corner by HUD_MARGIN font sizes, and is
//    white with a dark outline, so it reads over any background;
//  - while the player carries an object, a carry hint along the bottom shows
//    how to throw and drop it (down + action), in the names of the device used
//    last: "E: throw · Down + E: drop" or "X: throw · D-pad down + X: drop".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawHud, hudFontSize, HUD_FONT_SHARE, MIN_HUD_FONT, HUD_MARGIN, drawSoundOff, SOUND_OFF_TEXT, carryHint, drawCarryHint,
} from '../../src/presentation/hud.js';
import { InputDevice } from '../../src/presentation/input.js';
import { createFakeContext } from '../helpers/fake-canvas.js';

const STATUS = { health: 3, rewardCount: 7 };

function drawnAt(viewport) {
  const ctx = createFakeContext();
  drawHud(ctx, STATUS, viewport);
  return ctx;
}

describe('the HUD (req 44)', () => {
  test('it shows the health and the reward count', () => {
    const texts = drawnAt({ width: 1280, height: 720 }).texts();
    assert.deepEqual(texts, [`Health: ${STATUS.health}`, `Rewards: ${STATUS.rewardCount}`]);
  });

  test('the font size is a share of the viewport\'s height, never below the minimum', () => {
    assert.equal(hudFontSize(1000), Math.round(1000 * HUD_FONT_SHARE));
    assert.equal(hudFontSize(100), MIN_HUD_FONT);
    assert.ok(hudFontSize(2160) > hudFontSize(720), 'bigger on a bigger screen');
  });

  for (const viewport of [{ width: 320, height: 240 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }, { width: 2560, height: 400 }]) {
    test(`at ${viewport.width} × ${viewport.height} it sits in the top-left corner, in the font size for that height`, () => {
      const ctx = drawnAt(viewport);
      const size = hudFontSize(viewport.height);
      const margin = HUD_MARGIN * size;
      for (const call of ctx.callsOf('fillText')) {
        assert.ok(Math.abs(call.args[1] - margin) < 1e-9, 'set in from the left edge');
        assert.equal(call.style.font, `bold ${size}px sans-serif`);
        assert.equal(call.style.textBaseline, 'top');
        assert.ok(call.args[2] < viewport.height / 2, 'in the top half');
      }
      const [first, second] = ctx.callsOf('fillText');
      assert.ok(Math.abs(first.args[2] - margin) < 1e-9, 'set in from the top');
      assert.ok(second.args[2] >= first.args[2] + size, 'the second line below the first');
    });
  }

  test('the text is white with a dark outline drawn under it', () => {
    const ctx = drawnAt({ width: 1280, height: 720 });
    const [fill] = ctx.callsOf('fillText');
    const [stroke] = ctx.callsOf('strokeText');
    assert.equal(fill.style.fillStyle, '#ffffff');
    assert.ok(stroke, 'an outline');
    assert.ok(ctx.calls.indexOf(stroke) < ctx.calls.indexOf(fill), 'the outline first, so the text is on top');
  });
});

describe('the "Sound off" label (sound PRD req 19)', () => {
  const VIEWPORT = { width: 1280, height: 720 };

  function drawn() {
    const ctx = createFakeContext();
    drawSoundOff(ctx, VIEWPORT);
    return ctx;
  }

  test('it says "Sound off", in the HUD\'s font, white over a dark outline', () => {
    const ctx = drawn();
    const [text] = ctx.callsOf('fillText');
    assert.equal(text.args[0], SOUND_OFF_TEXT);
    assert.ok(text.style.font.includes(`${hudFontSize(VIEWPORT.height)}px`), text.style.font);
    assert.equal(text.style.fillStyle, '#ffffff');
    assert.equal(ctx.callsOf('strokeText').length, 1);
  });

  test('it sits in the top-right corner, set in by the HUD\'s margin', () => {
    const [text] = drawn().callsOf('fillText');
    const margin = HUD_MARGIN * hudFontSize(VIEWPORT.height);
    assert.equal(text.style.textAlign, 'right');
    assert.equal(text.style.textBaseline, 'top');
    assert.deepEqual(text.args.slice(1), [VIEWPORT.width - margin, margin]);
  });
});

describe('the carry hint (req 32)', () => {
  const VIEWPORT = { width: 1280, height: 720 };
  const BINDINGS = {
    keyboard: { action: ['KeyE'], down: ['ArrowDown'] },
    gamepad: { action: ['x'], down: ['dpadDown'] },
  };

  test('on the keyboard it names the first action key, and down + action for dropping', () => {
    assert.equal(carryHint(BINDINGS, InputDevice.KEYBOARD), 'E: throw · Down + E: drop');
  });

  test('on a gamepad it names the first action button, and down + action for dropping', () => {
    assert.equal(carryHint(BINDINGS, InputDevice.GAMEPAD), 'X: throw · D-pad down + X: drop');
  });

  test('a left-stick direction is named as the stick', () => {
    const bindings = { ...BINDINGS, gamepad: { action: ['y'], down: ['stickDown'] } };
    assert.equal(carryHint(bindings, InputDevice.GAMEPAD), 'Y: throw · Stick down + Y: drop');
  });

  test('it is drawn centred along the bottom, in the HUD\'s font, white over a dark outline', () => {
    const ctx = createFakeContext();
    drawCarryHint(ctx, BINDINGS, InputDevice.KEYBOARD, VIEWPORT);
    const [text] = ctx.callsOf('fillText');
    const margin = HUD_MARGIN * hudFontSize(VIEWPORT.height);
    assert.equal(text.args[0], carryHint(BINDINGS, InputDevice.KEYBOARD));
    assert.equal(text.style.textAlign, 'center');
    assert.equal(text.style.textBaseline, 'bottom');
    assert.deepEqual(text.args.slice(1), [VIEWPORT.width / 2, VIEWPORT.height - margin]);
    assert.ok(text.style.font.includes(`${hudFontSize(VIEWPORT.height)}px`), text.style.font);
    assert.equal(text.style.fillStyle, '#ffffff');
    assert.equal(ctx.callsOf('strokeText').length, 1);
  });
});
