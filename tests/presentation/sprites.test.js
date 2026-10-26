// Tests for sprites (task 7.8; PRD reqs 77-79), with the recording fake canvas.
//
// A sprite sheet (docs/data-formats.md) is an image cut into frames of
// frameWidth × frameHeight pixels, numbered left to right then top to bottom,
// with named animations (frames, fps, loop). It is drawn at frameWidth /
// pixelsPerTile tiles wide, its bottom-centre on the entity's box's
// bottom-centre, and flipped when the entity faces left.
// Decided:
//  - an animation that the sheet doesn't have falls back to "idle";
//  - the player's animation, in order of priority: "hurt" while knocked back,
//    "punch" while the punch shows, "jump" or "fall" in the air (rising or
//    not), "carry" when holding an object, "run" when moving, else "idle";
//  - when an entity's sprite, or its sheet's image, is missing, the shape is
//    drawn instead and a warning is logged, once for each missing sprite (req 79).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { frameFor, frameSource, spriteBox, drawEntitySprite, playerAnimation } from '../../src/presentation/sprites.js';
import { drawLevel, levelView } from '../../src/presentation/renderer.js';
import { createFakeContext } from '../helpers/fake-canvas.js';
import { Player } from '../../src/simulation/player.js';
import { Facing } from '../../src/simulation/constants.js';
import { createLevelState } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';

const SHEET = {
  formatVersion: 1, image: 'sprites/hero.png', frameWidth: 32, frameHeight: 48, pixelsPerTile: 32,
  animations: {
    idle: { frames: [0, 1], fps: 2 },
    run: { frames: [2, 3, 4], fps: 10 },
    jump: { frames: [5, 6], fps: 4, loop: false },
  },
};
const IMAGE = { image: { name: 'hero sheet' }, width: 128, height: 96 };   // 4 frames across, 2 down

describe('choosing the frame (req 77)', () => {
  test('an animation plays its frames in order at its fps, and loops', () => {
    const { frames, fps } = SHEET.animations.run;
    assert.equal(frameFor(SHEET, 'run', 0), frames[0]);
    assert.equal(frameFor(SHEET, 'run', 1 / fps), frames[1]);
    assert.equal(frameFor(SHEET, 'run', 2.5 / fps), frames[2]);
    assert.equal(frameFor(SHEET, 'run', 3 / fps), frames[0], 'loops back to the first frame');
  });

  test('an animation with loop false holds its last frame', () => {
    const { frames, fps } = SHEET.animations.jump;
    assert.equal(frameFor(SHEET, 'jump', 10 / fps), frames.at(-1));
  });

  test('an animation the sheet doesn\'t have falls back to idle', () => {
    assert.equal(frameFor(SHEET, 'carry', 0), SHEET.animations.idle.frames[0]);
  });

  test('a frame number gives its place in the image: left to right, then top to bottom', () => {
    const { frameWidth: w, frameHeight: h } = SHEET;
    assert.deepEqual(frameSource(SHEET, 0, IMAGE.width), { sx: 0, sy: 0, sw: w, sh: h });
    assert.deepEqual(frameSource(SHEET, 3, IMAGE.width), { sx: 3 * w, sy: 0, sw: w, sh: h });
    assert.deepEqual(frameSource(SHEET, 5, IMAGE.width), { sx: 1 * w, sy: h, sw: w, sh: h });
  });
});

describe('placing the frame', () => {
  test('the frame is frameWidth / pixelsPerTile tiles wide, its bottom-centre on the box\'s bottom-centre', () => {
    const box = { x: 3, y: 2, width: 0.8, height: 1.4 };
    const drawnBox = spriteBox(SHEET, box);
    const width = SHEET.frameWidth / SHEET.pixelsPerTile;
    const height = SHEET.frameHeight / SHEET.pixelsPerTile;
    assert.equal(drawnBox.width, width);
    assert.equal(drawnBox.height, height);
    assert.ok(Math.abs(drawnBox.x + width / 2 - (box.x + box.width / 2)) < 1e-9, 'centred');
    assert.ok(Math.abs(drawnBox.y + height - (box.y + box.height)) < 1e-9, 'bottoms level');
  });
});

describe('drawing an entity\'s sprite (reqs 77-79)', () => {
  const VIEW = { scale: 10, camera: { x: 0, y: 0 } };
  const DEFINITION = { sprite: 'hero', color: '#ff0000' };
  const box = (facing) => ({ x: 3, y: 2, width: 0.8, height: 1.4, facing });

  function draw({ facing = Facing.RIGHT, definition = DEFINITION, sheets = { hero: SHEET }, images = { 'sprites/hero.png': IMAGE } } = {}) {
    const ctx = createFakeContext();
    const warnings = [];
    const drew = drawEntitySprite(ctx, VIEW, box(facing), definition, { name: 'run', time: 0 }, { sheets, images, warn: (m) => warnings.push(m) });
    return { ctx, warnings, drew };
  }

  test('facing right, the frame is drawn at its place on screen, unflipped', () => {
    const { ctx, drew } = draw();
    assert.equal(drew, true);
    const [call] = ctx.callsOf('drawImage');
    const source = frameSource(SHEET, frameFor(SHEET, 'run', 0), IMAGE.width);
    const target = spriteBox(SHEET, box(Facing.RIGHT));
    assert.deepEqual(call.args, [IMAGE.image, source.sx, source.sy, source.sw, source.sh,
      target.x * VIEW.scale, target.y * VIEW.scale, target.width * VIEW.scale, target.height * VIEW.scale]);
    assert.deepEqual(call.style.transform, [1, 0, 0, 1, 0, 0]);
  });

  test('facing left, it is flipped: mirrored about its own centre', () => {
    const { ctx } = draw({ facing: Facing.LEFT });
    const [call] = ctx.callsOf('drawImage');
    const target = spriteBox(SHEET, box(Facing.LEFT));
    const [a, , , d, e] = call.style.transform;
    assert.equal(a, -1, 'mirrored sideways');
    assert.equal(d, 1);
    // The flipped frame drawn at (0, 0) covers the same screen area: from e - width to e.
    assert.ok(Math.abs(e - (target.x + target.width) * VIEW.scale) < 1e-9);
    assert.deepEqual(call.args.slice(5), [0, target.y * VIEW.scale, target.width * VIEW.scale, target.height * VIEW.scale]);
  });

  test('an entity with no sprite isn\'t drawn here (its shape is), and nothing is logged', () => {
    const { drew, warnings, ctx } = draw({ definition: { color: '#ff0000' } });
    assert.equal(drew, false);
    assert.deepEqual(warnings, []);
    assert.deepEqual(ctx.calls, []);
  });

  test('a sprite missing from the data: not drawn here (the shape is), and a warning is logged', () => {
    const { drew, warnings } = draw({ sheets: {} });
    assert.equal(drew, false);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /hero/);
  });

  test('a sprite whose image isn\'t loaded: not drawn here, and a warning is logged', () => {
    const { drew, warnings } = draw({ images: {} });
    assert.equal(drew, false);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /sprites\/hero\.png/);
  });

  test('each missing sprite is warned about only once, however often it is drawn', () => {
    const warnings = [];
    const assets = { sheets: {}, images: {}, warn: (m) => warnings.push(m) };
    for (let i = 0; i < 5; i++) drawEntitySprite(createFakeContext(), VIEW, box(Facing.RIGHT), DEFINITION, { name: 'idle', time: 0 }, assets);
    assert.equal(warnings.length, 1);
  });
});

describe('the player\'s animation (req 78)', () => {
  const standing = { vx: 0, vy: 0, onGround: true, punchTime: 0, knockedBack: false };
  const animationOf = (changes, holding = false) => playerAnimation(new Player({ ...standing, ...changes }), holding);

  test('standing still: idle', () => assert.equal(animationOf({}), 'idle'));
  test('moving on the ground: run', () => assert.equal(animationOf({ vx: 6 }), 'run'));
  test('rising in the air: jump', () => assert.equal(animationOf({ onGround: false, vy: -5 }), 'jump'));
  test('falling in the air: fall', () => assert.equal(animationOf({ onGround: false, vy: 5 }), 'fall'));
  test('holding an object on the ground: carry', () => assert.equal(animationOf({ vx: 6 }, true), 'carry'));
  test('while the punch shows: punch', () => assert.equal(animationOf({ punchTime: 0.1, vx: 6 }), 'punch'));
  test('while knocked back: hurt, before anything else', () => assert.equal(animationOf({ knockedBack: true, punchTime: 0.1 }), 'hurt'));
});

describe('the renderer uses sprites', () => {
  test('a player whose definition names a loaded sprite is drawn from it, not as a shape', () => {
    const data = buildData(['P.G', '###'], { player: { sprite: 'hero' } });
    data.sprites.hero = SHEET;
    const state = createLevelState(data, TEST_LEVEL);
    const ctx = createFakeContext();
    drawLevel(ctx, state, levelView(state, { width: 400, height: 200 }, 2), { images: { 'sprites/hero.png': IMAGE }, warn: () => {} });
    assert.equal(ctx.callsOf('drawImage').filter((c) => c.args[0] === IMAGE.image).length, 1);
    assert.equal(ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === data.characters.player.color).length, 0);
  });

  test('a player whose sprite is missing is drawn as a shape, and a warning is logged', () => {
    const data = buildData(['P.G', '###'], { player: { sprite: 'missing' } });
    const state = createLevelState(data, TEST_LEVEL);
    const ctx = createFakeContext();
    const warnings = [];
    drawLevel(ctx, state, levelView(state, { width: 400, height: 200 }, 2), { images: {}, warn: (m) => warnings.push(m) });
    assert.equal(ctx.callsOf('fillRect').filter((c) => c.style.fillStyle === data.characters.player.color).length, 1);
    assert.equal(warnings.length, 1);
  });
});
