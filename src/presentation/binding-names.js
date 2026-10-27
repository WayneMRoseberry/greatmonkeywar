// Bindings as a player would name them, for on-screen hints (the cut scene's
// skip hint and the menu hint).

/** A key code as a player would name it: KeyE → E, Digit1 → 1, Enter → Enter. */
const keyName = (code) => code.replace(/^(Key|Digit)/, '');

/** A gamepad button as a player would name it: a → A. */
const buttonName = (button) => button.toUpperCase();

/** The first keyboard key and gamepad button bound to confirm, e.g. "Enter / A". */
export const confirmNames = (bindings) =>
  `${keyName(bindings.keyboard.confirm[0])} / ${buttonName(bindings.gamepad.confirm[0])}`;
