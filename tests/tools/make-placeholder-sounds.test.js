// Tests for the placeholder sound generator (sound task 5.3; sound PRD req 27).
//
// PLACEHOLDERS lists every placeholder file as { path, loops }, path being
// relative to the data folder; writePlaceholders(dataDir) makes them all and
// writes them as Ogg Vorbis files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLACEHOLDERS, PlaceholderMusic, CUTSCENE_SOUND, soundFor, writePlaceholders } from '../../tools/make-placeholder-sounds.js';
import { SoundEvent } from '../../src/simulation/constants.js';
import audioSchema from '../../src/data/schemas/audio.schema.json' with { type: 'json' };

const SOUND_PATH = new RegExp(audioSchema.$defs.soundPath.pattern);
const paths = PLACEHOLDERS.map((placeholder) => placeholder.path);

test('there is a placeholder for every sound event, every piece of music, and the cut scene sound', () => {
  for (const event of Object.values(SoundEvent)) assert.ok(paths.includes(soundFor(event)), event);
  for (const music of Object.values(PlaceholderMusic)) assert.ok(paths.includes(music), music);
  assert.ok(paths.includes(CUTSCENE_SOUND));
});

test('each has its own file, a sound path under audio/', () => {
  assert.equal(new Set(paths).size, paths.length);
  for (const file of paths) {
    assert.match(file, SOUND_PATH);
    assert.ok(file.startsWith('audio/'), file);
  }
});

test('music loops, except the jingle; sound effects don\'t', () => {
  const loops = Object.fromEntries(PLACEHOLDERS.map((placeholder) => [placeholder.path, placeholder.loops]));
  const { JINGLE, ...looping } = PlaceholderMusic;
  for (const music of Object.values(looping)) assert.equal(loops[music], true, music);
  assert.equal(loops[JINGLE], false);
  assert.equal(loops[soundFor(SoundEvent.JUMP)], false);
});

test('writes every placeholder as an Ogg file, each different from the others', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmw-placeholders-'));
  try {
    const written = await writePlaceholders(dir);
    assert.deepEqual(written, paths);
    const contents = paths.map((file) => fs.readFileSync(path.join(dir, file)));
    for (const [i, bytes] of contents.entries()) assert.equal(bytes.subarray(0, 4).toString(), 'OggS', paths[i]);
    assert.equal(new Set(contents.map((bytes) => bytes.toString('base64'))).size, contents.length, 'all different');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
