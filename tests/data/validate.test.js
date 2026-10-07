// Tests for the data validator (PRD requirements 82-84, 87).
//
// Each test starts from the valid fixture set in tests/data/fixtures/valid/,
// breaks one thing, and checks the plain-language message the validator gives.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateData, formatProblem } from '../../src/data/validate.js';
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

function errorsFor(fileChanges, imageChanges) {
  return validateData(dataWith(fileChanges, imageChanges)).errors.map(formatProblem);
}

function assertOnlyError(fileChanges, expected, imageChanges) {
  assert.deepEqual(errorsFor(fileChanges, imageChanges), [expected]);
}

function assertHasError(fileChanges, expected, imageChanges) {
  const errors = errorsFor(fileChanges, imageChanges);
  assert.ok(errors.includes(expected), `expected error:\n  ${expected}\nactual errors:\n  ${errors.join('\n  ')}`);
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
    const { errors } = validateData(dataWith({ 'config/display.json': '﻿' + VALID.files['config/display.json'] }));
    assert.deepEqual(errors, []);
  });
});

describe('req 83: invalid JSON syntax', () => {
  test('reports the file, the line and column, and what to look for', () => {
    const broken = '{\n  "formatVersion": 1,\n  "visibleHeight": 12\n  "stickDeadZone": 0.3\n}\n';
    const errors = errorsFor({ 'config/display.json': broken });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^config\/display\.json: this file is not valid JSON near line 4, column 3\. Look for a missing or extra comma, quote mark, or bracket there\./);
  });

  test('an empty file is reported as invalid JSON', () => {
    assert.match(errorsFor({ 'config/display.json': '' })[0], /^config\/display\.json: this file is not valid JSON/);
  });
});

describe('req 83: missing required fields', () => {
  test('top-level field', () => {
    const level = fixture('levels/level2.json');
    delete level.name;
    assertOnlyError({ 'levels/level2.json': level }, 'levels/level2.json: "name" is missing.');
  });

  test('nested field', () => {
    const level = fixture('levels/level2.json');
    delete level.background.color;
    assertOnlyError({ 'levels/level2.json': level }, 'levels/level2.json: "color" is missing from background.');
  });

  test('a required data file is missing', () => {
    assertOnlyError({ 'config/tuning.json': undefined }, 'config/tuning.json: this file is missing. The game cannot start without it.');
  });
});

describe('req 83: wrong value types and values', () => {
  test('text where a whole number is needed', () => {
    const player = fixture('characters/player.json');
    player.health = 'three';
    assertOnlyError({ 'characters/player.json': player },
      'characters/player.json: "health" should be a whole number, but it is the text "three".');
  });

  test('a fraction where a whole number is needed', () => {
    const player = fixture('characters/player.json');
    player.health = 2.5;
    assertOnlyError({ 'characters/player.json': player },
      'characters/player.json: "health" should be a whole number, but it is 2.5.');
  });

  test('a number out of range, with its location', () => {
    const level = fixture('levels/level1.json');
    level.background.layers[1].scrollFactor = 1.5;
    assertOnlyError({ 'levels/level1.json': level },
      'levels/level1.json: in background → layers → item 2, "scrollFactor" must be at most 1, but it is 1.5.');
  });

  test('a value not in the allowed list', () => {
    const beetle = fixture('characters/beetle.json');
    beetle.kind = 'boss';
    assertOnlyError({ 'characters/beetle.json': beetle },
      'characters/beetle.json: "kind" must be one of "player", "enemy", but it is "boss".');
  });

  test('a badly written colour', () => {
    const crate = fixture('objects/crate.json');
    crate.color = 'brown';
    assertOnlyError({ 'objects/crate.json': crate },
      'objects/crate.json: "color" is "brown", which is not a colour written like "#7a5230".');
  });

  test('a misspelled field name', () => {
    const crate = fixture('objects/crate.json');
    crate.colour = crate.color;
    assertOnlyError({ 'objects/crate.json': crate },
      'objects/crate.json: "colour" is not a field that belongs here. Check its spelling. The fields allowed here are: "formatVersion", "name", "size", "stackable", "color", "sprite".');
  });

  test('the wrong format version', () => {
    const display = fixture('config/display.json');
    display.formatVersion = 2;
    assertOnlyError({ 'config/display.json': display },
      'config/display.json: "formatVersion" must be 1, but it is 2. This file may have been made for a different version of the game.');
  });

  test('an empty list', () => {
    assertOnlyError({ 'levels/levels.json': { formatVersion: 1, levels: [] } },
      'levels/levels.json: "levels" must have at least 1 entry.');
  });

  test('an unknown gamepad button', () => {
    const bindings = fixture('config/bindings.json');
    bindings.gamepad.jump = ['A'];
    assertHasError({ 'config/bindings.json': bindings },
      'config/bindings.json: in gamepad → jump, "item 1" must be one of "a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start", "ls", "rs", "dpadUp", "dpadDown", "dpadLeft", "dpadRight", "stickLeft", "stickRight", "stickUp", "stickDown", but it is "A".');
  });

  test('"." cannot be a legend key', () => {
    const level = fixture('levels/level2.json');
    level.legend['.'] = { tile: { solid: true, color: '#000000' } };
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: in legend, "." can\'t be used as a key: it must be a single character other than "." or a space.');
  });
});

describe('req 83: level grid', () => {
  test('rows of different lengths (the PRD\'s example message)', () => {
    const level = fixture('levels/level1.json');
    level.grid[2] = level.grid[2].slice(0, -1);
    assertOnlyError({ 'levels/level1.json': level },
      'levels/level1.json: row 3 has 11 tiles but row 1 has 12. All rows must be the same length.');
  });

  test('unknown tile characters, reported once with where and how often', () => {
    const level = fixture('levels/level2.json');
    level.grid[0] = 'x..x....';
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: the character "x" (at row 1, column 1, and 1 more time) is not in the legend. Add it to "legend", or replace it with "." for empty space.');
  });

  test('entities can\'t be placed outside the level: a longer row is a row-length error', () => {
    // Entities are placed in the grid itself (docs/data-formats.md), so an entity
    // "outside" the level can only happen by making a row longer than the others.
    const level = fixture('levels/level2.json');
    level.grid[1] += 'e';
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: row 2 has 9 tiles but row 1 has 8. All rows must be the same length.');
  });
});

describe('req 83: exactly one player start and goal', () => {
  test('no player start', () => {
    const level = fixture('levels/level2.json');
    level.grid[1] = level.grid[1].replace('P', '.');
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: the level has no player start. It needs exactly one: a grid character whose legend entry is "playerStart": true.');
  });

  test('two goals', () => {
    const level = fixture('levels/level2.json');
    level.grid[0] = 'G.......';
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: the level has 2 goals (at row 1, column 1; row 2, column 8). It needs exactly one.');
  });
});

describe('req 83: legend entries', () => {
  test('an entry that is two things at once', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = { object: 'coconut', enemy: 'beetle' };
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "o" has more than one of enemy and object. A legend entry must be exactly one thing.');
  });

  test('an entry that is nothing', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = {};
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "o" doesn\'t say what it is. Give it exactly one of: tile, playerStart, goal, enemy, object, reward.');
  });

  test('a goal without a colour', () => {
    const level = fixture('levels/level2.json');
    delete level.legend.G.color;
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "G" is a goal but has no "color". Add one, like "color": "#ff3030".');
  });

  test('an unused legend entry is a warning, not an error', () => {
    const level = fixture('levels/level2.json');
    level.legend.z = { tile: { solid: false, color: '#000000' } };
    const { errors, warnings } = validateData(dataWith({ 'levels/level2.json': level }));
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings.map(formatProblem), ['levels/level2.json: legend "z" is not used anywhere in the grid.']);
  });
});

describe('req 83: references to files that don\'t exist', () => {
  test('a level list that names a missing level', () => {
    assertOnlyError({ 'levels/levels.json': { formatVersion: 1, levels: ['level1', 'level3'] } },
      'levels/levels.json: levels, item 2 is "level3", but there is no file data/levels/level3.json.');
  });

  test('a level that names a missing cut scene', () => {
    const level = fixture('levels/level1.json');
    level.cutscene = 'ending';
    assertOnlyError({ 'levels/level1.json': level },
      'levels/level1.json: "cutscene" is "ending", but there is no file data/cutscenes/ending.json.');
  });

  test('a level that places an enemy type with no definition', () => {
    const level = fixture('levels/level2.json');
    level.legend.e = { enemy: 'snake' };
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "e" is the enemy "snake", but there is no file data/characters/snake.json.');
  });

  test('a level that places an object type with no definition', () => {
    const level = fixture('levels/level2.json');
    level.legend.o = { object: 'barrel' };
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "o" is the object "barrel", but there is no file data/objects/barrel.json.');
  });

  test('a level that uses the player as an enemy', () => {
    const level = fixture('levels/level2.json');
    level.legend.e = { enemy: 'player' };
    assertOnlyError({ 'levels/level2.json': level },
      'levels/level2.json: legend "e" uses "player" as an enemy, but that character is the player.');
  });

  test('a missing background layer image', () => {
    assertOnlyError({}, 'levels/level1.json: background layer 2 uses the image "images/mid.png", but there is no file data/images/mid.png.',
      { 'images/mid.png': undefined });
  });

  test('a missing cut scene background image', () => {
    assertOnlyError({}, 'cutscenes/after-level1.json: "background" is "images/camp.png", but there is no file data/images/camp.png.',
      { 'images/camp.png': undefined });
  });

  test('a missing sprite sheet image', () => {
    assertOnlyError({}, 'sprites/hero.json: "image" is "sprites/hero.png", but there is no file data/sprites/hero.png.',
      { 'sprites/hero.png': undefined });
  });

  test('a character that names a missing sprite sheet', () => {
    const player = fixture('characters/player.json');
    player.sprite = 'monkey';
    assertOnlyError({ 'characters/player.json': player },
      'characters/player.json: "sprite" is "monkey", but there is no file data/sprites/monkey.json.');
  });

  test('a cut scene actor that names a missing character', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[1].character = 'snake';
    assertOnlyError({ 'cutscenes/after-level1.json': scene },
      'cutscenes/after-level1.json: actors, item 2: "character" is "snake", but there is no file data/characters/snake.json.');
  });

  test('a broken referenced file is reported once, not also as missing', () => {
    const errors = errorsFor({ 'objects/crate.json': '{ not json' });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^objects\/crate\.json: this file is not valid JSON/);
  });
});

describe('req 83: cut scene timings', () => {
  test('a negative time', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[0].start = -1;
    assertOnlyError({ 'cutscenes/after-level1.json': scene },
      'cutscenes/after-level1.json: in narration → item 1, "start" must be at least 0, but it is -1.');
  });

  test('keyframes out of order', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[0].keyframes[2].time = 2;
    assertOnlyError({ 'cutscenes/after-level1.json': scene },
      'cutscenes/after-level1.json: actors, item 1, keyframe 3: "time" is 2, but it must be later than the keyframe before it (3). Keyframes must be in time order.');
  });

  test('narration lines out of order', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[1].start = 0.2;
    assertOnlyError({ 'cutscenes/after-level1.json': scene },
      'cutscenes/after-level1.json: narration, item 2: "start" is 0.2, which is earlier than the line before it (0.5). Narration lines must be listed in time order.');
  });

  test('a narration line that ends before it starts', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.narration[0].end = 0.5;
    assertOnlyError({ 'cutscenes/after-level1.json': scene },
      'cutscenes/after-level1.json: narration, item 1: "end" (0.5) must be later than "start" (0.5).');
  });

  test('an animation the sprite sheet lacks is a warning', () => {
    const scene = fixture('cutscenes/after-level1.json');
    scene.actors[0].keyframes[0].animation = 'dance';
    const { errors, warnings } = validateData(dataWith({ 'cutscenes/after-level1.json': scene }));
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings.map(formatProblem), [
      'cutscenes/after-level1.json: actors, item 1: the animation "dance" is not in the sprite sheet "hero", so "idle" will be shown instead.',
    ]);
  });
});

describe('characters and sprites', () => {
  test('punchDamage on an enemy', () => {
    const beetle = fixture('characters/beetle.json');
    beetle.punchDamage = 2;
    assertOnlyError({ 'characters/beetle.json': beetle },
      'characters/beetle.json: "punchDamage" is only for the player. Remove it from this enemy.');
  });

  test('player.json must be the player', () => {
    const player = fixture('characters/player.json');
    player.kind = 'enemy';
    delete player.punchDamage;
    assertOnlyError({ 'characters/player.json': player },
      'characters/player.json: "kind" must be "player" in player.json, but it is "enemy".');
  });

  test('an animation frame outside the image', () => {
    const sprite = fixture('sprites/hero.json');
    sprite.animations.run.frames = [0, 1, 2];
    assertOnlyError({ 'sprites/hero.json': sprite },
      'sprites/hero.json: the animation "run" uses frame 2, but the image only has 2 frames (numbered 0 to 1).');
  });

  test('a frame bigger than the image', () => {
    const sprite = fixture('sprites/hero.json');
    sprite.frameHeight = 64;
    assertOnlyError({ 'sprites/hero.json': sprite },
      'sprites/hero.json: each frame is 32 × 64 pixels, which is bigger than the whole image (64 × 48).');
  });

  test('a sprite sheet without an idle animation', () => {
    const sprite = fixture('sprites/hero.json');
    delete sprite.animations.idle;
    assertOnlyError({ 'sprites/hero.json': sprite }, 'sprites/hero.json: "idle" is missing from animations.');
  });
});

describe('files the game doesn\'t use', () => {
  test('are a warning', () => {
    const { errors, warnings } = validateData(dataWith({ 'config/sound.json': { volume: 1 } }));
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings.map(formatProblem), [
      'config/sound.json: this is not a file the game uses, so it was not checked. Check its name and folder (see docs/data-formats.md).',
    ]);
  });
});

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

  test('fails a broken data folder, printing every problem', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmw-data-'));
    try {
      fs.cpSync(VALID_DIR, dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'objects', 'crate.json'), '{ "formatVersion": 1 }');
      fs.rmSync(path.join(dir, 'images', 'far.png'));
      const { code, output } = run(dir);
      assert.equal(code, 1);
      // crate.json is missing name, size, and color; level1 loses a layer image.
      assert.match(output, /found 4 problem\(s\)/);
      assert.match(output, /objects\/crate\.json: "name" is missing\./);
      assert.match(output, /levels\/level1\.json: background layer 1 uses the image "images\/far\.png"/);
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
