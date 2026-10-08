// Simulation timing. The game logic always advances in fixed steps of FIXED_DT
// seconds, whatever the frame rate, so it behaves the same on every machine
// and tests can step it exactly (PRD requirements 4-5).

export const STEPS_PER_SECOND = 60;
export const FIXED_DT = 1 / STEPS_PER_SECOND;
