// Tests for the data loader (PRD requirement 85), run in Node with the file
// reading and image loading replaced by versions that read the test fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGameData, referencesOf } from '../../src/data/load.js';
import { formatProblem } from '../../src/data/validate.js';
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

test('a missing referenced file is reported, not thrown', async () => {
  const { options } = fixtureLoader({ 'objects/coconut.json': null });
  const result = await loadGameData(options);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(formatProblem), [
    'levels/level2.json: legend "o" is the object "coconut", but there is no file data/objects/coconut.json.',
  ]);
});

test('a missing required file is reported', async () => {
  const { options } = fixtureLoader({ 'config/tuning.json': null });
  const result = await loadGameData(options);
  assert.deepEqual(result.errors.map(formatProblem), [
    'config/tuning.json: this file is missing. The game cannot start without it.',
  ]);
});

test('an image that fails to load is reported as missing', async () => {
  const { options } = fixtureLoader({ 'sprites/hero.png': null });
  const result = await loadGameData(options);
  assert.deepEqual(result.errors.map(formatProblem), [
    'sprites/hero.json: "image" is "sprites/hero.png", but there is no file data/sprites/hero.png.',
  ]);
});

test('invalid JSON is reported, and loading continues for everything else', async () => {
  const { options } = fixtureLoader({ 'levels/level2.json': '{ broken' });
  const result = await loadGameData(options);
  assert.equal(result.errors.length, 1);
  assert.match(formatProblem(result.errors[0]), /^levels\/level2\.json: this file is not valid JSON/);
  assert.ok(result.data.levels.level1);
});

test('references with unsafe names are not fetched', () => {
  const refs = referencesOf('level', {
    legend: { e: { enemy: '../../secret' }, o: { object: 'crate' } },
    background: { layers: [{ image: '../outside.png' }, { image: 'images/far.png' }] },
  });
  assert.deepEqual(refs, { json: ['objects/crate.json'], images: ['images/far.png'] });
});
