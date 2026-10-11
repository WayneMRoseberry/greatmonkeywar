// Repeatable random numbers for randomised tests. Math.random can't be seeded,
// so a failing random case couldn't be reproduced; with a seed it always can.

/**
 * A random number generator: each call returns a number from 0 up to (not
 * including) 1. The same seed always gives the same sequence. Uses the small,
 * well-known "mulberry32" algorithm.
 * random.between(min, max) returns a number from min up to (not including) max.
 */
export function seededRandom(seed) {
  let s = seed >>> 0;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.between = (min, max) => min + random() * (max - min);
  return random;
}
