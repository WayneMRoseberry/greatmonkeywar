// Helpers for driving the simulation in tests.
// Input states come from the game's own definition: src/simulation/input.js.

/**
 * Calls step(state, input, dt) `count` times, feeding each result into the next
 * call, and returns the final state. `inputOrFn` is either one input state used
 * for every step, or a function (stepNumber) => input state, counting from 0.
 */
export function runSteps(step, state, inputOrFn, count, dt) {
  const inputFor = typeof inputOrFn === 'function' ? inputOrFn : () => inputOrFn;
  let current = state;
  for (let i = 0; i < count; i++) current = step(current, inputFor(i), dt);
  return current;
}
