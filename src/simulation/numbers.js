// Small number helpers shared by simulation modules.

/**
 * `speed`, with -0 (from negating or flipping a speed of 0) turned into 0, so
 * states that are equal also compare as equal (deepEqual tells 0 and -0 apart).
 */
export const withoutNegativeZero = (speed) => speed + 0;
