// The input state: which controls are held during one simulation step
// (PRD requirement 18). It is device-independent: the presentation layer turns
// keyboard and gamepad input into it, and step() reads it.
//
// An input state is a frozen object with one true/false property per input:
//   { left: false, right: true, up: false, down: false,
//     jump: true, action: false, punch: false, confirm: false }
// Build one with createInput() or holding(); never write the object by hand.
// Read it with the Input names: input[Input.RIGHT].

/**
 * The names of the inputs. Their values match the input names in the bindings
 * data file (src/data/schemas/bindings.schema.json); a test keeps them in sync.
 */
export const Input = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
  JUMP: 'jump',
  ACTION: 'action',
  PUNCH: 'punch',
  CONFIRM: 'confirm',
});

const NAMES = new Set(Object.values(Input));

/** The input state with nothing held. */
export const NO_INPUT = Object.freeze(Object.fromEntries([...NAMES].map((name) => [name, false])));

/**
 * An input state from { [Input.X]: true/false, ... }. Inputs not mentioned are
 * off. Throws if a name isn't an input or a value isn't true or false.
 */
export function createInput(held = {}) {
  for (const [name, value] of Object.entries(held)) {
    if (!NAMES.has(name)) throw new Error(`"${name}" is not an input. Use one of the Input names.`);
    if (typeof value !== 'boolean') throw new Error(`"${name}" must be true or false, not ${value}.`);
  }
  return Object.freeze({ ...NO_INPUT, ...held });
}

/** The input state with exactly the named inputs held, e.g. holding(Input.RIGHT, Input.JUMP). */
export function holding(...names) {
  return createInput(Object.fromEntries(names.map((name) => [name, true])));
}
