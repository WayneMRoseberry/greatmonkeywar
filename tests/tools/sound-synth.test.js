// Tests for the sound synthesis used to make placeholder audio (sound task
// 5.2). Every function returns new sample arrays (Float32Array, values -1..1)
// and never changes the arrays passed in.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Waveform, tone, sweep, noise, envelope, sequence, mix, concat } from '../../tools/sound-synth.js';

// A low sample rate keeps the arrays small; the maths doesn't depend on it.
const RATE = 8000;
const VOLUME = 0.5;

/** How many times the samples cross zero going upward: one per cycle. */
function upwardCrossings(samples) {
  let count = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) count++;
  return count;
}

const peak = (samples) => samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

describe('tone', () => {
  test('lasts `seconds`, at `frequency` cycles per second, within ±volume', () => {
    const seconds = 0.5;
    const frequency = 200;
    const samples = tone({ frequency, seconds, volume: VOLUME, sampleRate: RATE });
    assert.ok(samples instanceof Float32Array);
    assert.equal(samples.length, seconds * RATE);
    assert.ok(Math.abs(upwardCrossings(samples) - frequency * seconds) <= 1, `${upwardCrossings(samples)} cycles`);
    assert.ok(peak(samples) <= VOLUME + 1e-6);
  });

  test('every waveform stays within ±volume; a square wave is only ever ±volume', () => {
    for (const shape of Object.values(Waveform)) {
      const samples = tone({ frequency: 100, seconds: 0.1, shape, volume: VOLUME, sampleRate: RATE });
      assert.ok(peak(samples) <= VOLUME + 1e-6, shape);
    }
    const square = tone({ frequency: 100, seconds: 0.1, shape: Waveform.SQUARE, volume: VOLUME, sampleRate: RATE });
    assert.ok(square.every((v) => Math.abs(Math.abs(v) - VOLUME) < 1e-6));
  });

  test('Waveform can\'t be changed', () => {
    assert.ok(Object.isFrozen(Waveform));
  });
});

describe('sweep', () => {
  test('a rising sweep has more cycles in its second half than its first', () => {
    const samples = sweep({ from: 100, to: 400, seconds: 1, volume: VOLUME, sampleRate: RATE });
    assert.equal(samples.length, RATE);
    const half = samples.length / 2;
    assert.ok(upwardCrossings(samples.subarray(half)) > upwardCrossings(samples.subarray(0, half)));
  });
});

describe('noise', () => {
  test('within ±volume, the same for the same seed, different for another', () => {
    const make = (seed) => noise({ seconds: 0.1, volume: VOLUME, seed, sampleRate: RATE });
    assert.ok(peak(make(1)) <= VOLUME);
    assert.deepEqual(make(1), make(1));
    assert.notDeepEqual(make(1), make(2));
  });
});

describe('envelope', () => {
  const flat = () => new Float32Array(RATE).fill(VOLUME);   // one second at VOLUME

  test('fades in from 0 over `attack` and out to 0 over `release`; the middle is unchanged', () => {
    const shaped = envelope(flat(), { attack: 0.1, release: 0.2, sampleRate: RATE });
    assert.equal(shaped[0], 0);
    assert.equal(shaped[shaped.length - 1], 0);
    assert.equal(shaped[RATE / 2], VOLUME);
    assert.ok(shaped[0.05 * RATE] > 0 && shaped[0.05 * RATE] < VOLUME, 'part way through the fade in');
  });

  test('doesn\'t change the samples passed in', () => {
    const samples = flat();
    envelope(samples, { attack: 0.1, release: 0.1, sampleRate: RATE });
    assert.ok(samples.every((v) => v === VOLUME));
  });
});

describe('sequence', () => {
  const NOTES = [{ frequency: 200, seconds: 0.25 }, { frequency: null, seconds: 0.25 }, { frequency: 300, seconds: 0.5 }];

  test('lasts as long as its notes together, and starts and ends at 0 (so a loop of it joins up)', () => {
    const samples = sequence(NOTES, { volume: VOLUME, sampleRate: RATE });
    const total = NOTES.reduce((sum, note) => sum + note.seconds, 0);
    assert.equal(samples.length, total * RATE);
    assert.equal(samples[0], 0);
    assert.equal(samples[samples.length - 1], 0);
  });

  test('a note with no frequency is a rest: silence', () => {
    const samples = sequence(NOTES, { volume: VOLUME, sampleRate: RATE });
    const rest = samples.subarray(0.25 * RATE, 0.5 * RATE);
    assert.ok(rest.every((v) => v === 0));
  });
});

describe('mix and concat', () => {
  test('mix adds samples together, as long as the longest, kept within ±1', () => {
    const loud = new Float32Array([0.8, 0.8, 0.8]);
    const short = new Float32Array([0.5]);
    assert.deepEqual([...mix(loud, short)].map((v) => Math.round(v * 10) / 10), [1, 0.8, 0.8]);
  });

  test('concat joins them end to end', () => {
    assert.deepEqual([...concat(new Float32Array([1, 2]), new Float32Array([3]))], [1, 2, 3]);
  });
});
