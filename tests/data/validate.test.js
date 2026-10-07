// Tests for the data validator (PRD requirements 82-84, 87).
//
// Detection tests start from the valid fixture set in tests/data/fixtures/valid/,
// break one thing, and check WHAT the validator found: { file, code, details }.
// Message wording (req 84) is tested separately, once per problem code, by
// calling describeProblem directly, so rewording a message breaks only its own test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateData, describeProblem, formatProblem } from '../../src/data/validate.js';
import { readDataFolder } from '../../tools/validate-data.js';

const VALID_DIR = path.resolve('tests/data/fixtures/valid');
const VALID = readDataFolder(VALID_DIR);

/** The valid fixture set with some files replaced (object → JSON text, string → raw text, undefined → removed). */
function dataWith(fileChanges = {}, imageChanges = {}) {
  const files = { ...VALID.files };
  for (const [file, content] of Object.entries(fileChanges)) {
    if (content === undefined) delete files[file];
    else files[file] = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  }
  const images = { ...VALID.images };
  for (const [file, size] of Object.entries(imageChanges)) {
    if (size === undefined) delete images[file];
    else images[file] = size;
  }
  return { files, images };
}

/** A fixture file, parsed, for editing. */
function fixture(file) {
  return JSON.parse(VALID.files[file]);
}

const strip = ({ file, code, details }) => ({ file, code, details });

function errorsFor(fileChanges, imageChanges) {
  return validateData(dataWith(fileChanges, imageChanges)).errors.map(strip);
}

function warningsFor(fileChanges, imageChanges) {
  return validateData(dataWith(fileChanges, imageChanges)).warnings.map(strip);
}

/** Asserts the change produces exactly these problems, and nothing else. */
function assertErrors(fileChanges, expected, imageChanges) {
  assert.deepEqual(errorsFor(fileChanges, imageChanges), expected);
}

describe('valid data', () => {
  test('the valid fixture set has no errors or warnings', () => {
    const { errors, warnings } = validateData(VALID);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  test('parsed data is returned grouped by kind', () => {
    const { data } = validateData(VALID);
    assert.deepEqual(data.levelList.levels, ['level1', 'level2']);
    assert.deepEqual(Object.keys(data.levels).sort(), ['level1', 'level2']);
    assert.equal(data.characters.player.kind, 'player');
    assert.equal(data.objects.crate.stackable, true);
    assert.equal(data.cutscenes['after-level1'].actors.length, 2);
    assert.equal(data.sprites.hero.frameWidth, 32);
    assert.equal(data.tuning.gravity, 35);
    assert.deepEqual(data.bindings.gamepad.punch, ['b']);
    assert.equal(data.display.visibleHeight, 12);
  });

  test('a byte order mark at the start of a file is accepted', () => {
    assertErrors({ 'config/display.json': '﻿' + VALID.files['config/display.json'] }, []);
  });

  test('every problem carries the message describeProblem gives for it', () => {
    const level = fixture('levels/level1.json');
    level.grid[2] = level.grid[2].slice(0, -1);
    const { errors } = validateData(dataWith({ 'levels/level1.json': level, 'config/tuning.json': undefined }));
    assert.equal(errors.length, 2);
    for (const e of errors) assert.equal(e.message, describeProblem(e.code, e.details));
  });
});

describe('req 83: invalid JSON syntax', () => {
  test('reports the line and column of the mistake', () => {
    const broken = '{\n  "formatVersion": 1,\n  "visibleHeight": 12\n  "stickDeadZone": 0.3\n}\n';
    const [error] = errorsFor({ 'config/display.json': broken });
    assert.equal(error.code, 'invalid-json');
    assert.equal(error.details.line, 4);
    assert.equal(error.details.column, 3);
  });

  test('an empty file is invalid JSON', () => {
    assert.equal(errorsFor({ 'config/display.json': '' })[0].code, 'invalid-json');
  });
});

describe('req 83: missing required fields', () => {
  test('top-level field', () => {
    const level = fixture('levels/level2.json');
    delete level.name;
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'missing-field', details: { path: [], field: 'name' } },
    ]);
  });

  test('nested field', () => {
    const level = fixture('levels/level2.json');
    delete level.background.color;
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'missing-field', details: { path: ['background'], field: 'color' } },
    ]);
  });

  test('a required data file is missing', () => {
    assertErrors({ 'config/tuning.json': undefined }, [
      { file: 'config/tuning.json', code: 'missing-file', details: {} },
    ]);
  });
});

describe('req 83: wrong value types and values', () => {
  test('text where a whole number is needed', () => {
    const player = fixture('characters/player.json');
    player.health = 'three';
    assertErrors({ 'characters/player.json': player }, [
      { file: 'characters/player.json', code: 'wrong-type', details: { path: ['health'], expected: 'integer', value: 'three' } },
    ]);
  });

  test('a fraction where a whole number is needed', () => {
    const player = fixture('characters/player.json');
    player.health = 2.5;
    assertErrors({ 'characters/player.json': player }, [
      { file: 'characters/player.json', code: 'wrong-type', details: { path: ['health'], expected: 'integer', value: 2.5 } },
    ]);
  });

  test('a number out of range', () => {
    const level = fixture('levels/level1.json');
    level.background.layers[1].scrollFactor = 1.5;
    assertErrors({ 'levels/level1.json': level }, [
      { file: 'levels/level1.json', code: 'too-large', details: { path: ['background', 'layers', 1, 'scrollFactor'], limit: 1, inclusive: true, value: 1.5 } },
    ]);
  });

  test('a number that must be more than a limit', () => {
    const player = fixture('characters/player.json');
    player.speed = 0;
    assertErrors({ 'characters/player.json': player }, [
      { file: 'characters/player.json', code: 'too-small', details: { path: ['speed'], limit: 0, inclusive: false, value: 0 } },
    ]);
  });

  test('a value not in the allowed list', () => {
    const beetle = fixture('characters/beetle.json');
    beetle.kind = 'boss';
    assertErrors({ 'characters/beetle.json': beetle }, [
      { file: 'characters/beetle.json', code: 'not-allowed', details: { path: ['kind'], allowed: ['player', 'enemy'], value: 'boss' } },
    ]);
  });

  test('a badly written colour', () => {
    const crate = fixture('objects/crate.json');
    crate.color = 'brown';
    assertErrors({ 'objects/crate.json': crate }, [
      { file: 'objects/crate.json', code: 'bad-format', details: { path: ['color'], format: 'color', value: 'brown' } },
    ]);
  });

  test('a misspelled field name', () => {
    const crate = fixture('objects/crate.json');
    crate.colour = crate.color;
    assertErrors({ 'objects/crate.json': crate }, [
      { file: 'objects/crate.json', code: 'unknown-field', details: { path: [], field: 'colour', allowed: ['formatVersion', 'name', 'size', 'stackable', 'color', 'sprite'] } },
    ]);
  });

  test('the wrong format version', () => {
    const display = fixture('config/display.json');
    display.formatVersion = 2;
    assertErrors({ 'config/display.json': display }, [
      { file: 'config/display.json', code: 'wrong-format-version', details: { expected: 1, value: 2 } },
    ]);
  });

  test('an empty list', () => {
    assertErrors({ 'levels/levels.json': { formatVersion: 1, levels: [] } }, [
      { file: 'levels/levels.json', code: 'too-few-items', details: { path: ['levels'], limit: 1 } },
    ]);
  });

  test('a list with a duplicate', () => {
    assertErrors({ 'levels/levels.json': { formatVersion: 1, levels: ['level1', 'level2', 'level1'] } }, [
      { file: 'levels/levels.json', code: 'duplicate-item', details: { path: ['levels'], value: 'level1' } },
    ]);
  });

  test('empty text', () => {
    const crate = fixture('objects/crate.json');
    crate.name = '';
    assertErrors({ 'objects/crate.json': crate }, [
      { file: 'objects/crate.json', code: 'too-short', details: { path: ['name'], limit: 1 } },
    ]);
  });

  test('an unknown gamepad button', () => {
    const bindings = fixture('config/bindings.json');
    bindings.gamepad.jump = ['A'];
    const [error] = errorsFor({ 'config/bindings.json': bindings });
    assert.equal(error.code, 'not-allowed');
    assert.deepEqual(error.details.path, ['gamepad', 'jump', 0]);
    assert.equal(error.details.value, 'A');
  });

  test('"." cannot be a legend key', () => {
    const level = fixture('levels/level2.json');
    level.legend['.'] = { tile: { solid: true, color: '#000000' } };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'bad-key', details: { path: ['legend'], key: '.', format: 'legend-key' } },
    ]);
  });
});

describe('req 83: level grid', () => {
  test('rows of different lengths', () => {
    const level = fixture('levels/level1.json');
    level.grid[2] = level.grid[2].slice(0, -1);
    assertErrors({ 'levels/level1.json': level }, [
      { file: 'levels/level1.json', code: 'row-length', details: { row: 3, length: 11, expected: 12 } },
    ]);
  });

  test('unknown tile characters, reported once with where and how often', () => {
    const level = fixture('levels/level2.json');
    level.grid[0] = 'x..x....';
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'unknown-character', details: { character: 'x', row: 1, column: 1, count: 2 } },
    ]);
  });

  test('entities can\'t be placed outside the level: a longer row is a row-length error', () => {
    // Entities are placed in the grid itself (docs/data-formats.md), so an entity
    // "outside" the level can only happen by making a row longer than the others.
    const level = fixture('levels/level2.json');
    level.grid[1] += 'e';
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'row-length', details: { row: 2, length: 9, expected: 8 } },
    ]);
  });
});

describe('req 83: exactly one player start and goal', () => {
  test('no player start', () => {
    const level = fixture('levels/level2.json');
    level.grid[1] = level.grid[1].replace('P', '.');
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'player-start-count', details: { count: 0, positions: [] } },
    ]);
  });

  test('two goals', () => {
    const level = fixture('levels/level2.json');
    level.grid[0] = 'G.......';
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'goal-count', details: { count: 2, positions: [{ row: 1, column: 1 }, { row: 2, column: 8 }] } },
    ]);
  });
});

describe('req 83: legend entries', () => {
  test('an entry that is two things at once', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = { object: 'coconut', enemy: 'beetle' };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'legend-many-kinds', details: { key: 'o', kinds: ['enemy', 'object'] } },
    ]);
  });

  test('an entry that is nothing', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = {};
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'legend-no-kind', details: { key: 'o' } },
    ]);
  });

  test('a colour directly on a non-goal entry', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = { object: 'coconut', color: '#000000' };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'legend-stray-color', details: { key: 'o' } },
    ]);
  });

  test('a goal without a colour', () => {
    const level = fixture('levels/level2.json');
    delete level.legend.G.color;
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'goal-without-color', details: { key: 'G' } },
    ]);
  });

  test('an unused legend entry is a warning, not an error', () => {
    const level = fixture('levels/level2.json');
    level.legend.z = { tile: { solid: false, color: '#000000' } };
    assert.deepEqual(errorsFor({ 'levels/level2.json': level }), []);
    assert.deepEqual(warningsFor({ 'levels/level2.json': level }), [
      { file: 'levels/level2.json', code: 'unused-legend', details: { key: 'z' } },
    ]);
  });
});

describe('req 83: references to files that don\'t exist', () => {
  test('a level list that names a missing level', () => {
    assertErrors({ 'levels/levels.json': { formatVersion: 1, levels: ['level1', 'level3'] } }, [
      { file: 'levels/levels.json', code: 'missing-level', details: { item: 2, name: 'level3' } },
    ]);
  });

  test('a level list that names itself', () => {
    assertErrors({ 'levels/levels.json': { formatVersion: 1, levels: ['level1', 'levels'] } }, [
      { file: 'levels/levels.json', code: 'level-list-self', details: { item: 2 } },
    ]);
  });

  test('a level that names a missing cut scene', () => {
    const level = fixture('levels/level1.json');
    level.cutscene = 'ending';
    assertErrors({ 'levels/level1.json': level }, [
      { file: 'levels/level1.json', code: 'missing-cutscene', details: { name: 'ending' } },
    ]);
  });

  test('a level that places an enemy type with no definition', () => {
    const level = fixture('levels/level2.json');
    level.legend.e = { enemy: 'snake' };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'missing-enemy', details: { key: 'e', name: 'snake' } },
    ]);
  });

  test('a level that places an object type with no definition', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = { object: 'barrel' };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'missing-object', details: { key: 'o', name: 'barrel' } },
    ]);
  });

  test('a level that uses the player as an enemy', () => {
    const level = fixture('levels/level2.json');
    level.legend.e = { enemy: 'player' };
    assertErrors({ 'levels/level2.json': level }, [
      { file: 'levels/level2.json', code: 'enemy-is-player', details: { key: 'e', name: 'player' } },
    ]);
  });

  test('a missing background layer image', () => {
    assertErrors({}, [
      { file: 'levels/level1.json', code: 'missing-layer-image', details: { layer: 2, image: 'images/mid.png' } },
    ], { 'images/mid.png': undefined });
  });

  test('a missing cut scene background image', () => {
    assertErrors({}, [
      { file: 'cutscenes/after-level1.json', code: 'missing-background-image', details: { image: 'images/camp.png' } },
    ], { 'images/camp.png': undefined });
  });

  test('a missing sprite sheet image', () => {
    assertErrors({}, [
      { file: 'sprites/hero.json', code: 'missing-sprite-image', details: { image: 'sprites/hero.png' } },
    ], { 'sprites/hero.png': undefined });
  });

  test('a character that names a missing sprite sheet', () => {
    const player = fixture('characters/player.json');
    player.sprite = 'monkey';
    assertErrors({ 'characters/player.json': player }, [
      { file: 'characters/player.json', code: 'missing-sprite', details: { name: 'monkey' } },
    ]);
  });

  test('a cut scene actor that names a missing character', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[1].character = 'snake';
    assertErrors({ 'cutscenes/after-level1.json': scene }, [
      { file: 'cutscenes/after-level1.json', code: 'missing-character', details: { actor: 2, name: 'snake' } },
    ]);
  });

  test('a broken referenced file is reported once, not also as missing', () => {
    const errors = errorsFor({ 'objects/crate.json': '{ not json' });
    assert.deepEqual(errors.map((e) => [e.file, e.code]), [['objects/crate.json', 'invalid-json']]);
  });
});

describe('req 83: cut scene timings', () => {
  test('a negative time', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[0].start = -1;
    assertErrors({ 'cutscenes/after-level1.json': scene }, [
      { file: 'cutscenes/after-level1.json', code: 'too-small', details: { path: ['narration', 0, 'start'], limit: 0, inclusive: true, value: -1 } },
    ]);
  });

  test('keyframes out of order', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[0].keyframes[2].time = 2;
    assertErrors({ 'cutscenes/after-level1.json': scene }, [
      { file: 'cutscenes/after-level1.json', code: 'keyframe-order', details: { actor: 1, keyframe: 3, time: 2, previous: 3 } },
    ]);
  });

  test('narration lines out of order', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[1].start = 0.2;
    assertErrors({ 'cutscenes/after-level1.json': scene }, [
      { file: 'cutscenes/after-level1.json', code: 'narration-order', details: { line: 2, start: 0.2, previous: 0.5 } },
    ]);
  });

  test('a narration line that ends before it starts', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[0].end = 0.5;
    assertErrors({ 'cutscenes/after-level1.json': scene }, [
      { file: 'cutscenes/after-level1.json', code: 'narration-end', details: { line: 1, start: 0.5, end: 0.5 } },
    ]);
  });

  test('an animation the sprite sheet lacks is a warning', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[0].keyframes[0].animation = 'dance';
    assert.deepEqual(errorsFor({ 'cutscenes/after-level1.json': scene }), []);
    assert.deepEqual(warningsFor({ 'cutscenes/after-level1.json': scene }), [
      { file: 'cutscenes/after-level1.json', code: 'unknown-animation', details: { actor: 1, animation: 'dance', sprite: 'hero' } },
    ]);
  });
});

describe('characters and sprites', () => {
  test('punchDamage on an enemy', () => {
    const beetle = fixture('characters/beetle.json');
    beetle.punchDamage = 2;
    assertErrors({ 'characters/beetle.json': beetle }, [
      { file: 'characters/beetle.json', code: 'enemy-punch-damage', details: {} },
    ]);
  });

  test('player.json must be the player', () => {
    const player = fixture('characters/player.json');
    player.kind = 'enemy';
    delete player.punchDamage;
    assertErrors({ 'characters/player.json': player }, [
      { file: 'characters/player.json', code: 'player-kind', details: { kind: 'enemy' } },
    ]);
  });

  test('only player.json can be the player', () => {
    const beetle = fixture('characters/beetle.json');
    beetle.kind = 'player';
    assertErrors({ 'characters/beetle.json': beetle }, [
      { file: 'characters/beetle.json', code: 'enemy-kind', details: { kind: 'player' } },
    ]);
  });

  test('an animation frame outside the image', () => {
    const sprite = fixture('sprites/hero.json');
    sprite.animations.run.frames = [0, 1, 2];
    assertErrors({ 'sprites/hero.json': sprite }, [
      { file: 'sprites/hero.json', code: 'frame-out-of-range', details: { animation: 'run', frame: 2, frames: 2 } },
    ]);
  });

  test('a frame bigger than the image', () => {
    const sprite = fixture('sprites/hero.json');
    sprite.frameHeight = 64;
    assertErrors({ 'sprites/hero.json': sprite }, [
      { file: 'sprites/hero.json', code: 'frame-too-big', details: { frameWidth: 32, frameHeight: 64, imageWidth: 64, imageHeight: 48 } },
    ]);
  });

  test('a sprite sheet without an idle animation', () => {
    const sprite = fixture('sprites/hero.json');
    delete sprite.animations.idle;
    assertErrors({ 'sprites/hero.json': sprite }, [
      { file: 'sprites/hero.json', code: 'missing-field', details: { path: ['animations'], field: 'idle' } },
    ]);
  });
});

describe('files the game doesn\'t use', () => {
  test('are a warning', () => {
    assert.deepEqual(errorsFor({ 'config/sound.json': { volume: 1 } }), []);
    assert.deepEqual(warningsFor({ 'config/sound.json': { volume: 1 } }), [
      { file: 'config/sound.json', code: 'unrecognized-file', details: {} },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Wording (req 84): one test per problem code.

describe('describeProblem: plain-language messages', () => {
  const cases = {
    'invalid-json': [{ line: 4, column: 3, detail: "Expected ',' or '}' after property value" },
      'this file is not valid JSON near line 4, column 3. Look for a missing or extra comma, quote mark, or bracket there. (Details: Expected \',\' or \'}\' after property value.)'],
    'missing-file': [{}, 'this file is missing. The game cannot start without it.'],
    'unrecognized-file': [{}, 'this is not a file the game uses, so it was not checked. Check its name and folder (see docs/data-formats.md).'],
    'missing-field': [{ path: ['background'], field: 'color' }, '"color" is missing from background.'],
    'unknown-field': [{ path: [], field: 'colour', allowed: ['name', 'color'] },
      '"colour" is not a field that belongs here. Check its spelling. The fields allowed here are: "name", "color".'],
    'bad-key': [{ path: ['legend'], key: '.', format: 'legend-key' },
      'in legend, "." can\'t be used as a key: it must be a single character other than "." or a space.'],
    'wrong-type': [{ path: ['health'], expected: 'integer', value: 'three' }, '"health" should be a whole number, but it is the text "three".'],
    'wrong-value': [{ path: ['legend', 'P', 'playerStart'], expected: true, value: false },
      'in legend → P, "playerStart" must be true, but it is false.'],
    'wrong-format-version': [{ expected: 1, value: 2 },
      '"formatVersion" must be 1, but it is 2. This file may have been made for a different version of the game.'],
    'not-allowed': [{ path: ['kind'], allowed: ['player', 'enemy'], value: 'boss' },
      '"kind" must be one of "player", "enemy", but it is "boss".'],
    'too-small': [{ path: ['speed'], limit: 0, inclusive: false, value: 0 }, '"speed" must be more than 0, but it is 0.'],
    'too-large': [{ path: ['background', 'layers', 1, 'scrollFactor'], limit: 1, inclusive: true, value: 1.5 },
      'in background → layers → item 2, "scrollFactor" must be at most 1, but it is 1.5.'],
    'too-short': [{ path: ['name'], limit: 1 }, '"name" must not be empty.'],
    'too-long': [{ path: ['name'], limit: 3 }, '"name" must be at most 3 characters long.'],
    'bad-format': [{ path: ['color'], format: 'color', value: 'brown' }, '"color" is "brown", which is not a colour written like "#7a5230".'],
    'too-few-items': [{ path: ['levels'], limit: 1 }, '"levels" must have at least 1 entry.'],
    'duplicate-item': [{ path: ['levels'], value: 'level1' }, '"levels" lists "level1" more than once.'],
    'row-length': [{ row: 7, length: 58, expected: 60 }, 'row 7 has 58 tiles but row 1 has 60. All rows must be the same length.'],
    'unknown-character': [{ character: 'x', row: 3, column: 12, count: 1 },
      'the character "x" (at row 3, column 12) is not in the legend. Add it to "legend", or replace it with "." for empty space.'],
    'player-start-count': [{ count: 0, positions: [] },
      'the level has no player start. It needs exactly one: a grid character whose legend entry is "playerStart": true.'],
    'goal-count': [{ count: 2, positions: [{ row: 1, column: 1 }, { row: 2, column: 8 }] },
      'the level has 2 goals (at row 1, column 1; row 2, column 8). It needs exactly one.'],
    'legend-no-kind': [{ key: 'o' }, 'legend "o" doesn\'t say what it is. Give it exactly one of: tile, playerStart, goal, enemy, object, reward.'],
    'legend-many-kinds': [{ key: 'o', kinds: ['enemy', 'object'] }, 'legend "o" has more than one of enemy and object. A legend entry must be exactly one thing.'],
    'legend-stray-color': [{ key: 'o' },
      'legend "o" has a "color" directly inside it, which only goals use. For a tile or reward, put "color" inside "tile" or "reward".'],
    'goal-without-color': [{ key: 'G' }, 'legend "G" is a goal but has no "color". Add one, like "color": "#ff3030".'],
    'missing-enemy': [{ key: 'e', name: 'snake' }, 'legend "e" is the enemy "snake", but there is no file data/characters/snake.json.'],
    'enemy-is-player': [{ key: 'e', name: 'player' }, 'legend "e" uses "player" as an enemy, but that character is the player.'],
    'missing-object': [{ key: 'o', name: 'barrel' }, 'legend "o" is the object "barrel", but there is no file data/objects/barrel.json.'],
    'unused-legend': [{ key: 'z' }, 'legend "z" is not used anywhere in the grid.'],
    'missing-cutscene': [{ name: 'ending' }, '"cutscene" is "ending", but there is no file data/cutscenes/ending.json.'],
    'missing-layer-image': [{ layer: 2, image: 'images/mid.png' },
      'background layer 2 uses the image "images/mid.png", but there is no file data/images/mid.png.'],
    'level-list-self': [{ item: 2 }, 'levels, item 2: "levels" is the level list itself, not a level.'],
    'missing-level': [{ item: 2, name: 'level3' }, 'levels, item 2 is "level3", but there is no file data/levels/level3.json.'],
    'missing-sprite': [{ name: 'monkey' }, '"sprite" is "monkey", but there is no file data/sprites/monkey.json.'],
    'player-kind': [{ kind: 'enemy' }, '"kind" must be "player" in player.json, but it is "enemy".'],
    'enemy-kind': [{ kind: 'player' }, '"kind" is "player", but only data/characters/player.json can be the player. Use "enemy".'],
    'enemy-punch-damage': [{}, '"punchDamage" is only for the player. Remove it from this enemy.'],
    'missing-background-image': [{ image: 'images/camp.png' }, '"background" is "images/camp.png", but there is no file data/images/camp.png.'],
    'missing-character': [{ actor: 2, name: 'snake' }, 'actors, item 2: "character" is "snake", but there is no file data/characters/snake.json.'],
    'keyframe-order': [{ actor: 1, keyframe: 3, time: 2, previous: 3 },
      'actors, item 1, keyframe 3: "time" is 2, but it must be later than the keyframe before it (3). Keyframes must be in time order.'],
    'unknown-animation': [{ actor: 1, animation: 'dance', sprite: 'hero' },
      'actors, item 1: the animation "dance" is not in the sprite sheet "hero", so "idle" will be shown instead.'],
    'narration-end': [{ line: 1, start: 0.5, end: 0.5 }, 'narration, item 1: "end" (0.5) must be later than "start" (0.5).'],
    'narration-order': [{ line: 2, start: 0.2, previous: 0.5 },
      'narration, item 2: "start" is 0.2, which is earlier than the line before it (0.5). Narration lines must be listed in time order.'],
    'missing-sprite-image': [{ image: 'sprites/hero.png' }, '"image" is "sprites/hero.png", but there is no file data/sprites/hero.png.'],
    'frame-too-big': [{ frameWidth: 32, frameHeight: 64, imageWidth: 64, imageHeight: 48 },
      'each frame is 32 × 64 pixels, which is bigger than the whole image (64 × 48).'],
    'frame-out-of-range': [{ animation: 'run', frame: 9, frames: 8 },
      'the animation "run" uses frame 9, but the image only has 8 frames (numbered 0 to 7).'],
  };

  for (const [code, [details, expected]] of Object.entries(cases)) {
    test(code, () => assert.equal(describeProblem(code, details), expected));
  }

  test('unknown-character mentions repeats', () => {
    assert.equal(describeProblem('unknown-character', { character: 'x', row: 1, column: 1, count: 3 }),
      'the character "x" (at row 1, column 1, and 2 more times) is not in the legend. Add it to "legend", or replace it with "." for empty space.');
  });

  test('formatProblem puts the file name first', () => {
    assert.equal(formatProblem({ file: 'a/b.json', message: 'something is wrong.' }), 'a/b.json: something is wrong.');
  });
});

// ---------------------------------------------------------------------------

describe('tools/validate-data.js', () => {
  const run = (dir) => {
    try {
      return { code: 0, output: execFileSync(process.execPath, ['tools/validate-data.js', dir], { encoding: 'utf8', stdio: 'pipe' }) };
    } catch (err) {
      return { code: err.status, output: err.stdout + err.stderr };
    }
  };

  test('passes a valid data folder', () => {
    const { code, output } = run(VALID_DIR);
    assert.equal(code, 0);
    assert.match(output, /Data validation passed \(12 data file\(s\) checked\)/);
  });

  test('fails a broken data folder, printing every problem with its file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmw-data-'));
    try {
      fs.cpSync(VALID_DIR, dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'objects', 'crate.json'), '{ "formatVersion": 1 }');
      fs.rmSync(path.join(dir, 'images', 'far.png'));
      const { code, output } = run(dir);
      assert.equal(code, 1);
      // crate.json is missing name, size, and color; level1 loses a layer image.
      assert.match(output, /found 4 problem\(s\)/);
      assert.equal(output.match(/objects\/crate\.json: /g).length, 3);
      assert.equal(output.match(/levels\/level1\.json: /g).length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('allows an empty data folder until content exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmw-empty-'));
    try {
      const { code, output } = run(dir);
      assert.equal(code, 0);
      assert.match(output, /no data files/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
