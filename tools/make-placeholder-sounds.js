// Makes the placeholder music and sound effects (sound PRD req 27): simple
// generated tones, each clearly different, so a tester can hear which sound
// plays when. They are meant to be replaced by real audio.
//
// Usage: npm run sounds                                  (writes into data/)
//        node tools/make-placeholder-sounds.js <folder>  (writes into another data folder)
// Files go under <folder>/audio/, as Ogg Vorbis (engine PRD req 81), encoded
// with wasm-media-encoders (a dev dependency; the game itself never loads it).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOggEncoder } from 'wasm-media-encoders';
import { SoundEvent } from '../src/simulation/constants.js';
import { Waveform, tone, sweep, noise, envelope, sequence, mix, concat } from './sound-synth.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_RATE = 44100;
const VORBIS_QUALITY = 3;   // 0 (smallest) to 10 (best); plenty for placeholders

/** The placeholder music files, as paths inside the data folder. */
export const PlaceholderMusic = Object.freeze({
  START: 'audio/music/start.ogg',
  LEVEL1: 'audio/music/level1.ogg',
  LEVEL2: 'audio/music/level2.ogg',
  CUTSCENE: 'audio/music/cutscene.ogg',
  JINGLE: 'audio/music/jingle.ogg',   // played once when a level is completed; the only music that doesn't loop
});

/** The placeholder cut scene sound (a timed sound in the cut scene file). */
export const CUTSCENE_SOUND = 'audio/sounds/cutscene-crash.ogg';

/** The placeholder file for a sound event (SoundEvent), named after the event. */
export const soundFor = (event) => `audio/sounds/${event}.ogg`;

/** A note's frequency from its name, like "C4", "F#3", or "Bb5" (A4 is 440 Hz). */
function note(name) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(name);
  const semitone = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[letter] + ({ '#': 1, b: -1 }[accidental] ?? 0);
  return 440 * 2 ** (semitone / 12 + (Number(octave) - 4));
}

/** A melody from "name:seconds" notes; "-" is a rest. */
const melody = (notes, shape, volume) => sequence(notes.map((spec) => {
  const [name, seconds] = spec.split(':');
  return { frequency: name === '-' ? null : note(name), seconds: Number(seconds) };
}), { shape, volume, sampleRate: SAMPLE_RATE });

/** `times` copies of `samples` one after another. */
const repeat = (samples, times) => concat(...Array.from({ length: times }, () => samples));

const rate = { sampleRate: SAMPLE_RATE };
const fade = (samples, attack, release) => envelope(samples, { attack, release, ...rate });

// Music: short loops of a few notes, each in its own key and sound.
const MUSIC_MAKERS = {
  // Bright arpeggios over a soft bass: C major.
  [PlaceholderMusic.START]: () => mix(
    repeat(melody(['C5:0.25', 'E5:0.25', 'G5:0.25', 'E5:0.25', 'F5:0.25', 'A5:0.25', 'G5:0.5'], Waveform.TRIANGLE, 0.25), 2),
    repeat(melody(['C3:1', 'F3:0.5', 'G3:0.5'], Waveform.SINE, 0.3), 2),
  ),
  // Bouncy and buzzy: G major, faster notes.
  [PlaceholderMusic.LEVEL1]: () => mix(
    repeat(melody(['G4:0.2', 'B4:0.2', 'D5:0.2', 'B4:0.2', 'A4:0.2', 'C5:0.2', 'E5:0.2', 'C5:0.2', 'D5:0.4', 'B4:0.4'], Waveform.SQUARE, 0.12), 2),
    repeat(melody(['G2:0.4', 'G3:0.4', 'A2:0.4', 'A3:0.4', 'D3:0.4'], Waveform.TRIANGLE, 0.3), 2),
  ),
  // Darker: A minor, with a steady low pulse.
  [PlaceholderMusic.LEVEL2]: () => mix(
    repeat(melody(['A4:0.3', 'C5:0.3', 'E5:0.3', 'D5:0.3', 'C5:0.3', 'B4:0.3', 'G4:0.3', 'B4:0.3'], Waveform.TRIANGLE, 0.22), 2),
    repeat(melody(['A2:0.3', '-:0.3', 'A2:0.3', '-:0.3', 'E2:0.3', '-:0.3', 'G2:0.3', '-:0.3'], Waveform.SQUARE, 0.12), 2),
  ),
  // Slow and calm: long soft chords.
  [PlaceholderMusic.CUTSCENE]: () => mix(
    melody(['C4:1', 'A3:1', 'F3:1', 'G3:1'], Waveform.SINE, 0.25),
    melody(['E4:1', 'C4:1', 'A3:1', 'B3:1'], Waveform.SINE, 0.2),
    melody(['G4:1', 'E4:1', 'C4:1', 'D4:1'], Waveform.SINE, 0.15),
  ),
  // A rising fanfare that ends on a held note.
  [PlaceholderMusic.JINGLE]: () => melody(['C5:0.12', 'E5:0.12', 'G5:0.12', 'C6:0.7'], Waveform.SQUARE, 0.2),
};

// Sound effects: short, each with its own pitch and shape.
const SOUND_MAKERS = {
  [SoundEvent.JUMP]: () => fade(sweep({ from: 300, to: 700, seconds: 0.15, shape: Waveform.SQUARE, volume: 0.2, ...rate }), 0.005, 0.05),
  [SoundEvent.LAND]: () => fade(mix(sweep({ from: 140, to: 60, seconds: 0.1, volume: 0.5, ...rate }), noise({ seconds: 0.05, volume: 0.15, seed: 1, ...rate })), 0.002, 0.05),
  [SoundEvent.PUNCH]: () => fade(noise({ seconds: 0.08, volume: 0.4, seed: 2, ...rate }), 0.002, 0.06),
  [SoundEvent.PICK_UP]: () => fade(sweep({ from: 400, to: 800, seconds: 0.1, shape: Waveform.TRIANGLE, volume: 0.35, ...rate }), 0.005, 0.03),
  [SoundEvent.DROP]: () => fade(sweep({ from: 500, to: 250, seconds: 0.12, shape: Waveform.TRIANGLE, volume: 0.35, ...rate }), 0.005, 0.04),
  [SoundEvent.THROW]: () => fade(mix(sweep({ from: 900, to: 300, seconds: 0.18, shape: Waveform.TRIANGLE, volume: 0.25, ...rate }), noise({ seconds: 0.18, volume: 0.08, seed: 3, ...rate })), 0.005, 0.08),
  [SoundEvent.STOMP]: () => fade(sweep({ from: 600, to: 120, seconds: 0.15, shape: Waveform.SQUARE, volume: 0.2, ...rate }), 0.002, 0.05),
  [SoundEvent.ENEMY_DEFEATED]: () => melody(['E5:0.08', 'C5:0.08', 'G4:0.14'], Waveform.SQUARE, 0.18),
  [SoundEvent.PLAYER_HURT]: () => fade(sweep({ from: 220, to: 140, seconds: 0.25, shape: Waveform.SQUARE, volume: 0.2, ...rate }), 0.005, 0.1),
  [SoundEvent.PLAYER_DEFEATED]: () => melody(['G4:0.2', 'Eb4:0.2', 'C4:0.2', 'C3:0.5'], Waveform.TRIANGLE, 0.3),
  [SoundEvent.COLLECT_REWARD]: () => melody(['B5:0.07', 'E6:0.15'], Waveform.SQUARE, 0.15),
  [SoundEvent.REACH_GOAL]: () => melody(['C5:0.07', 'G5:0.07', 'C6:0.15'], Waveform.TRIANGLE, 0.3),
  [SoundEvent.MENU_MOVE]: () => fade(tone({ frequency: note('E5'), seconds: 0.05, shape: Waveform.SQUARE, volume: 0.12, ...rate }), 0.002, 0.02),
  [SoundEvent.MENU_CHOOSE]: () => melody(['E5:0.06', 'A5:0.1'], Waveform.SQUARE, 0.15),
};

// The cut scene's crash: a burst of noise over a low thud.
const makeCutsceneSound = () => fade(mix(noise({ seconds: 0.4, volume: 0.25, seed: 4, ...rate }), sweep({ from: 120, to: 40, seconds: 0.4, volume: 0.35, ...rate })), 0.002, 0.3);

/** Every placeholder: { path (inside the data folder), loops, make() → samples }. */
export const PLACEHOLDERS = Object.freeze([
  ...Object.values(PlaceholderMusic).map((file) => ({ path: file, loops: file !== PlaceholderMusic.JINGLE, make: MUSIC_MAKERS[file] })),
  ...Object.values(SoundEvent).map((event) => ({ path: soundFor(event), loops: false, make: SOUND_MAKERS[event] })),
  { path: CUTSCENE_SOUND, loops: false, make: makeCutsceneSound },
]);

/** `samples` (mono) as the bytes of an Ogg Vorbis file. */
async function encodeOgg(samples) {
  const encoder = await createOggEncoder();
  encoder.configure({ channels: 1, sampleRate: SAMPLE_RATE, vbrQuality: VORBIS_QUALITY });
  // The encoder reuses its output buffer, so each chunk is copied before the next call.
  const chunks = [Buffer.from(encoder.encode([samples])), Buffer.from(encoder.finalize())];
  return Buffer.concat(chunks);
}

/** Makes every placeholder and writes it under `dataDir`; returns the paths written, in PLACEHOLDERS order. */
export async function writePlaceholders(dataDir) {
  for (const placeholder of PLACEHOLDERS) {
    const file = path.join(dataDir, placeholder.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await encodeOgg(placeholder.make()));
  }
  return PLACEHOLDERS.map((placeholder) => placeholder.path);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataDir = path.resolve(process.argv[2] ?? path.join(REPO_ROOT, 'data'));
  const written = await writePlaceholders(dataDir);
  console.log(`Wrote ${written.length} placeholder sound file(s) under ${path.relative(REPO_ROOT, dataDir) || dataDir}:`);
  for (const file of written) console.log(`  ${file}`);
}
