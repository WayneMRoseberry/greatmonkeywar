// Simulation timing. The game logic always advances in fixed steps of FIXED_DT
// seconds, whatever the frame rate, so it behaves the same on every machine
// and tests can step it exactly (PRD requirements 4-5).

export const STEPS_PER_SECOND = 60;
export const FIXED_DT = 1 / STEPS_PER_SECOND;

/**
 * The directions a character can face. Use these names, never the raw strings.
 * The values match the "facing" values in cut scene data files
 * (src/data/schemas/cutscene.schema.json); a test keeps the two in sync.
 */
export const Facing = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
});
