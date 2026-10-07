// Helpers for driving the simulation in tests.

/** The input state with every input off (PRD requirement 18). */
export const NO_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false,
  jump: false, action: false, punch: false, confirm: false,
});

/** An input state with only the named inputs on, e.g. input({ right: true, jump: true }). */
export function input(on = {}) {
  for (const name of Object.keys(on)) {
    if (!(name in NO_INPUT)) throw new Error(`Unknown input "${name}"`);
  }
  return { ...NO_INPUT, ...on };
}

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
