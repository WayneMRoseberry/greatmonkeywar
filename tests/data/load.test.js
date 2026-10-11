// Tests for the data loader (PRD requirement 85), run in Node with the file
// reading and image loading replaced by versions that read the test fixtures.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameData, referencesOf } from '../../src/data/load.js';
import { pngSize } from '../../tools/validate-data.js';

const VALID_DIR = path.resolve('tests/data/fixtures/valid');

/** Loader options that read from the fixture folder, with optional overrides by path. */
function fixtureLoader(overrides = {}) {
  const requested = [];
  return {
    requested,
    options: {
      baseUrl: 'data/',
      fetchText: async (url) => {
        const rel = url.replace(/^data\//, '');
        requested.push(rel);
        if (rel in overrides) return overrides[rel];
        const file = path.join(VALID_DIR, rel);
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      },
      loadImage: async (url) => {
        const rel = url.replace(/^data\//, '');
        requested.push(rel);
        if (rel in overrides) return overrides[rel];
        const file = path.join(VALID_DIR, rel);
        if (!fs.existsSync(file)) return null;
        const size = pngSize(fs.readFileSync(file));
        return { image: `<image ${rel}>`, ...size };
      },
    },
  };
}

test('loads and validates the whole valid data set by following references', async () => {
  const { options, requested } = fixtureLoader();
  const result = await loadGameData(options);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(Object.keys(result.data.levels).sort(), ['level1', 'level2']);
  assert.equal(result.data.characters.beetle.kind, 'enemy');
  assert.equal(result.data.sprites.hero.pixelsPerTile, 32);
  assert.equal(result.data.cutscenes['after-level1'].narration.length, 2);
  assert.deepEqual(Object.keys(result.images).sort(), [
    'images/camp.png', 'images/far.png', 'images/mid.png', 'images/near.png', 'sprites/hero.png',
  ]);
  assert.equal(result.images['sprites/hero.png'], '<image sprites/hero.png>');

  // Every file is requested exactly once, even when several files refer to it.
  assert.equal(requested.length, new Set(requested).size);
});

/** What was found, without the wording (wording is tested in validate.test.js). */
const found = (errors) => errors.map(({ file, code, details }) => ({ file, code, details }));

test('a missing referenced file is reported, not thrown', async () => {
  const { options } = fixtureLoader({ 'objects/coconut.json': null });
  const result = await loadGameData(options);
  assert.equal(result.ok, false);
  assert.deepEqual(found(result.errors), [
    { file: 'levels/level2.json', code: 'missing-object', details: { key: 'o', name: 'coconut' } },
  ]);
});

test('a missing required file is reported', async () => {
  const { options } = fixtureLoader({ 'config/tuning.json': null });
  const result = await loadGameData(options);
  assert.deepEqual(found(result.errors), [
    { file: 'config/tuning.json', code: 'missing-file', details: {} },
  ]);
});

test('an image that fails to load is reported as missing', async () => {
  const { options } = fixtureLoader({ 'sprites/hero.png': null });
  const result = await loadGameData(options);
  assert.deepEqual(found(result.errors), [
    { file: 'sprites/hero.json', code: 'missing-sprite-image', details: { image: 'sprites/hero.png' } },
  ]);
});

test('invalid JSON is reported, and loading continues for everything else', async () => {
  const { options } = fixtureLoader({ 'levels/level2.json': '{ broken' });
  const result = await loadGameData(options);
  assert.deepEqual(result.errors.map((e) => [e.file, e.code]), [['levels/level2.json', 'invalid-json']]);
  assert.ok(result.data.levels.level1);
});

describe('the loaded data is read-only (frozen)', () => {
  test('the data and everything inside it is frozen', async () => {
    const { options } = fixtureLoader();
    const { data } = await loadGameData(options);
    const level = data.levels.level1;
    for (const [label, value] of [
      ['data', data],
      ['a level', level],
      ['a level\'s grid', level.grid],
      ['a legend entry', level.legend.P],
      ['a background layer', level.background.layers[0]],
      ['the player definition', data.characters.player],
      ['the player\'s size', data.characters.player.size],
      ['tuning', data.tuning],
      ['a cut scene keyframe', data.cutscenes['after-level1'].actors[0].keyframes[0]],
    ]) {
      assert.ok(Object.isFrozen(value), `${label} is not frozen`);
    }
  });

  test('trying to change the data fails with an error instead of silently changing it', async () => {
    const { options } = fixtureLoader();
    const { data } = await loadGameData(options);
    // Modules run in strict mode, where writing to a frozen object throws a TypeError.
    assert.throws(() => { data.characters.player.speed = 99; }, TypeError);
    assert.throws(() => { data.levels.level1.grid.push('####'); }, TypeError);
    assert.throws(() => { delete data.tuning.gravity; }, TypeError);
  });

  test('freezing doesn\'t change the data\'s contents', async () => {
    const { options } = fixtureLoader();
    const { data } = await loadGameData(options);
    const player = JSON.parse(fs.readFileSync(path.join(VALID_DIR, 'characters', 'player.json'), 'utf8'));
    assert.deepEqual(data.characters.player, player);
  });
});

test('references with unsafe names are not fetched', () => {
  const refs = referencesOf('level', {
    legend: { e: { enemy: '../../secret' }, o: { object: 'crate' } },
    background: { layers: [{ image: '../outside.png' }, { image: 'images/far.png' }] },
  });
  assert.deepEqual(refs, { json: ['objects/crate.json'], images: ['images/far.png'] });
});
