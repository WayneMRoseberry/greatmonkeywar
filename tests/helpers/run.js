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

/**
 * Like runSteps, but also collects each step's sound events (state.events):
 * returns { state, events }, where events[i] is the list from step i.
 */
export function runStepsWithEvents(step, state, inputOrFn, count, dt) {
  const inputFor = typeof inputOrFn === 'function' ? inputOrFn : () => inputOrFn;
  const events = [];
  let current = state;
  for (let i = 0; i < count; i++) {
    current = step(current, inputFor(i), dt);
    events.push(current.events);
  }
  return { state: current, events };
}
