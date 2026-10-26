// Tests for the cut scene view (task 7.13; PRD reqs 62, 65), with the
// recording fake canvas.
//
// drawCutscene(ctx, scene, shown, assets, characters, viewport, bindings)
// draws a cut scene as cutsceneAt (cutscene.js) says it is at this moment.
// The stage (scene.stage, in tiles) is scaled to fit inside the viewport,
// keeping its proportions, and centred; the rest is filled with
// backgroundColor (req 65). The background image covers the stage exactly.
// Decided:
//  - an actor is drawn from its character's sprite if it has one (playing the
//    actor's animation), otherwise as its character's coloured shape, its
//    box's bottom-centre at the actor's stage position; hidden actors aren't drawn;
//  - narration shows in a half-transparent box along the bottom of the stage,
//    one line per narration line; with no narration there is no box;
//  - a skip hint in the viewport's bottom-right corner names the first
//    keyboard key and gamepad button bound to confirm, e.g. "Enter / A: skip".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { drawCutscene, stageFit, skipHint, NARRATION_BOX_COLOR } from '../../src/presentation/cutscene-view.js';
import { createFakeContext } from '../helpers/fake-canvas.js';
import { Facing } from '../../src/simulation/constants.js';

const SCENE = {
  formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/camp.png', backgroundColor: '#112233',
  actors: [], narration: [],
};
const BACKGROUND = { image: { name: 'camp' }, width: 1600, height: 900 };
const CHARACTERS = {
  player: { size: { width: 1, height: 2 }, color: '#d2691e' },
  hero: { size: { width: 1, height: 2 }, color: '#d2691e', sprite: 'hero' },
};
const SHEET = {
  image: 'sprites/hero.png', frameWidth: 32, frameHeight: 64, pixelsPerTile: 32,
  animations: { idle: { frames: [0], fps: 1 }, run: { frames: [1], fps: 1 } },
};
const BINDINGS = { keyboard: { confirm: ['Enter', 'Space'] }, gamepad: { confirm: ['a'] } };

function drawn({ viewport = { width: 1600, height: 900 }, shown = { actors: [], narration: [], ended: false }, images = { 'images/camp.png': BACKGROUND } } = {}) {
  const ctx = createFakeContext();
  const assets = { images: { ...images, 'sprites/hero.png': { image: { name: 'hero' }, width: 64, height: 64 } }, sheets: { hero: SHEET }, warn: () => {} };
  drawCutscene(ctx, SCENE, shown, assets, CHARACTERS, viewport, BINDINGS);
  return ctx;
}

const actor = (changes) => ({ character: 'player', facing: Facing.RIGHT, x: 8, y: 8, visible: true, animation: 'idle', animationTime: 0, ...changes });

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label} was ${actual}, expected ${expected}`);
}

describe('fitting the stage (req 65)', () => {
  test('a viewport of the stage\'s shape: the stage fills it', () => {
    assert.deepEqual(stageFit(SCENE.stage, { width: 1600, height: 900 }), { scale: 100, left: 0, top: 0, width: 1600, height: 900 });
  });

  test('a wider viewport: as tall as the viewport, centred sideways', () => {
    const fit = stageFit(SCENE.stage, { width: 2000, height: 900 });
    assert.equal(fit.scale, 100);
    assert.equal(fit.left, (2000 - 1600) / 2);
    assert.equal(fit.top, 0);
  });

  test('a taller viewport: as wide as the viewport, centred up and down', () => {
    const fit = stageFit(SCENE.stage, { width: 800, height: 900 });
    assert.equal(fit.scale, 50);
    assert.equal(fit.top, (900 - 450) / 2);
  });
});

describe('drawing the cut scene (req 62)', () => {
  test('first the background colour fills the viewport, then the image covers the stage exactly', () => {
    const viewport = { width: 2000, height: 900 };
    const ctx = drawn({ viewport });
    assert.deepEqual(ctx.calls[0].args, [0, 0, viewport.width, viewport.height]);
    assert.equal(ctx.calls[0].style.fillStyle, SCENE.backgroundColor);
    const [image] = ctx.callsOf('drawImage');
    const fit = stageFit(SCENE.stage, viewport);
    assert.deepEqual(image.args, [BACKGROUND.image, fit.left, fit.top, fit.width, fit.height]);
  });

  test('a background image that isn\'t loaded is skipped (the colour still shows)', () => {
    const ctx = drawn({ images: {} });
    assert.equal(ctx.callsOf('drawImage').length, 0);
  });

  test('an actor without a sprite is its character\'s shape, bottom-centred on its stage position', () => {
    const viewport = { width: 2000, height: 900 };
    const shown = { actors: [actor({ x: 8, y: 8 })], narration: [], ended: false };
    const ctx = drawn({ viewport, shown });
    const fit = stageFit(SCENE.stage, viewport);
    const { width, height } = CHARACTERS.player.size;
    const [shape] = ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === CHARACTERS.player.color);
    const expected = [fit.left + (8 - width / 2) * fit.scale, fit.top + (8 - height) * fit.scale, width * fit.scale, height * fit.scale];
    shape.args.forEach((value, i) => assertNear(value, expected[i], `shape ${i}`));
  });

  test('an actor whose character has a sprite is drawn from it', () => {
    const shown = { actors: [actor({ character: 'hero', animation: 'run' })], narration: [], ended: false };
    const ctx = drawn({ shown });
    assert.ok(ctx.callsOf('drawImage').some((c) => c.args[0].name === 'hero'));
  });

  test('a hidden actor isn\'t drawn', () => {
    const shown = { actors: [actor({ visible: false })], narration: [], ended: false };
    const ctx = drawn({ shown });
    assert.equal(ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === CHARACTERS.player.color).length, 0);
  });
});

describe('narration and the skip hint (Design Considerations)', () => {
  test('narration lines show in a box along the bottom of the stage', () => {
    const viewport = { width: 1600, height: 900 };
    const lines = ['Our hero escapes...', '...and rests.'];
    const ctx = drawn({ viewport, shown: { actors: [], narration: lines, ended: false } });
    const [box] = ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === NARRATION_BOX_COLOR);
    assert.ok(box, 'a narration box');
    assert.ok(box.style.globalAlpha < 1, 'half-transparent');
    const fit = stageFit(SCENE.stage, viewport);
    assertNear(box.args[1] + box.args[3], fit.top + fit.height, 'its bottom at the stage\'s bottom');
    for (const line of lines) {
      const text = ctx.callsOf('fillText').find((c) => c.args[0] === line);
      assert.ok(text, line);
      assert.ok(text.args[2] >= box.args[1] && text.args[2] <= box.args[1] + box.args[3], `${line} inside the box`);
    }
  });

  test('with no narration there is no box', () => {
    const ctx = drawn();
    assert.equal(ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === NARRATION_BOX_COLOR).length, 0);
  });

  test('the skip hint names the first keyboard key and gamepad button for confirm, in the bottom-right corner', () => {
    assert.equal(skipHint(BINDINGS), 'Enter / A: skip');
    const viewport = { width: 1600, height: 900 };
    const ctx = drawn({ viewport });
    const hint = ctx.callsOf('fillText').find((c) => c.args[0] === 'Enter / A: skip');
    assert.ok(hint, 'the hint is drawn');
    assert.equal(hint.style.textAlign, 'right');
    assert.ok(hint.args[1] > viewport.width / 2 && hint.args[2] > viewport.height / 2, 'bottom-right');
  });

  test('key codes are shown as their key names', () => {
    assert.equal(skipHint({ keyboard: { confirm: ['KeyE'] }, gamepad: { confirm: ['b'] } }), 'E / B: skip');
    assert.equal(skipHint({ keyboard: { confirm: ['Space'] }, gamepad: { confirm: ['start'] } }), 'Space / START: skip');
  });
});
