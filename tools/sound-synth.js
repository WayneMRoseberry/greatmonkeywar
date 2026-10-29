// Small sound synthesis for the placeholder audio (sound PRD req 27; used by
// tools/make-placeholder-sounds.js). Every function returns a new
// Float32Array of samples between -1 and 1, and never changes the arrays
// passed in. Times are in seconds, frequencies in cycles per second (Hz).

/** The shapes a tone can have. */
export const Waveform = Object.freeze({
  SINE: 'sine',           // smooth and soft
  SQUARE: 'square',       // buzzy, like an old game console
  TRIANGLE: 'triangle',   // between the two
});

/** The value of `shape` at `phase` cycles (only the fraction matters), between -1 and 1. */
function wave(shape, phase) {
  const cycle = phase - Math.floor(phase);
  switch (shape) {
    case Waveform.SQUARE: return cycle < 0.5 ? 1 : -1;
    case Waveform.TRIANGLE: return cycle < 0.5 ? 4 * cycle - 1 : 3 - 4 * cycle;
    default: return Math.sin(2 * Math.PI * cycle);
  }
}

const lengthOf = (seconds, sampleRate) => Math.round(seconds * sampleRate);

/** A tone whose frequency moves in a straight line from `from` to `to` over `seconds`. */
export function sweep({ from, to, seconds, shape = Waveform.SINE, volume, sampleRate }) {
  const samples = new Float32Array(lengthOf(seconds, sampleRate));
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = volume * wave(shape, phase);
    phase += (from + (to - from) * (i / samples.length)) / sampleRate;
  }
  return samples;
}

/** A steady tone. */
export function tone({ frequency, seconds, shape = Waveform.SINE, volume, sampleRate }) {
  return sweep({ from: frequency, to: frequency, seconds, shape, volume, sampleRate });
}

/** Hiss, for hits and thuds. The same `seed` always gives the same noise, so the files don't change when remade. */
export function noise({ seconds, volume, seed, sampleRate }) {
  const samples = new Float32Array(lengthOf(seconds, sampleRate));
  let state = seed >>> 0;
  for (let i = 0; i < samples.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;   // a simple repeatable random number generator
    samples[i] = volume * (state / 2 ** 32 * 2 - 1);
  }
  return samples;
}

/** `samples` faded in from silence over `attack` seconds and out to silence over `release`. */
export function envelope(samples, { attack, release, sampleRate }) {
  const shaped = Float32Array.from(samples);
  const attackLength = Math.min(lengthOf(attack, sampleRate), shaped.length);
  const releaseLength = Math.min(lengthOf(release, sampleRate), shaped.length);
  // `|| 0` turns -0 (a negative sample faded right out) into 0.
  for (let i = 0; i < attackLength; i++) shaped[i] = shaped[i] * (i / attackLength) || 0;
  for (let i = 0; i < releaseLength; i++) {
    const at = shaped.length - 1 - i;
    shaped[at] = shaped[at] * (i / releaseLength) || 0;
  }
  return shaped;
}

/** How long each note fades in and out, so notes don't click. */
const NOTE_FADE = 0.005;

/**
 * A melody: `notes` is a list of { frequency, seconds }, one after another; a
 * note whose frequency is null is a rest (silence). Each note fades in and out
 * briefly, so the whole starts and ends at 0 and a loop of it joins up smoothly.
 */
export function sequence(notes, { shape = Waveform.SINE, volume, sampleRate }) {
  return concat(...notes.map(({ frequency, seconds }) => (frequency === null
    ? new Float32Array(lengthOf(seconds, sampleRate))
    : envelope(tone({ frequency, seconds, shape, volume, sampleRate }), { attack: NOTE_FADE, release: NOTE_FADE, sampleRate }))));
}

/** The samples played together: added up, as long as the longest, and kept between -1 and 1. */
export function mix(...parts) {
  const mixed = new Float32Array(Math.max(...parts.map((part) => part.length)));
  for (const part of parts) part.forEach((v, i) => { mixed[i] += v; });
  return mixed.map((v) => Math.max(-1, Math.min(1, v)));
}

/** The samples one after another. */
export function concat(...parts) {
  const joined = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}
