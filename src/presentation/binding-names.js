// Bindings as a player would name them, for on-screen hints (the cut scene's
// skip hint, the menu hint, and the carry hint).

import { Input } from '../simulation/input.js';

/** A key code as a player would name it: KeyE → E, Digit1 → 1, ArrowDown → Down, Enter → Enter. */
const keyName = (code) => code.replace(/^(Key|Digit|Arrow)/, '');

/** What a player calls each kind of gamepad direction binding, by its prefix in the bindings (dpadDown, stickDown). */
const DIRECTION_NAMES = Object.freeze({
  dpad: 'D-pad',
  stick: 'Stick',
});
const DIRECTION_BINDING = new RegExp(`^(${Object.keys(DIRECTION_NAMES).join('|')})(\\w+)$`);

/** A gamepad button as a player would name it: a → A, dpadDown → D-pad down, stickDown → Stick down. */
function buttonName(button) {
  const direction = button.match(DIRECTION_BINDING);
  if (!direction) return button.toUpperCase();
  const [, kind, way] = direction;
  return `${DIRECTION_NAMES[kind]} ${way.toLowerCase()}`;
}

/** The first keyboard key bound to `input`, e.g. "Enter". */
export const firstKeyName = (bindings, input) => keyName(bindings.keyboard[input][0]);

/** The first gamepad button bound to `input`, e.g. "A". */
export const firstButtonName = (bindings, input) => buttonName(bindings.gamepad[input][0]);

/** The first keyboard key bound to confirm, e.g. "Enter". */
export const confirmKeyName = (bindings) => firstKeyName(bindings, Input.CONFIRM);

/** The first gamepad button bound to confirm, e.g. "A". */
export const confirmButtonName = (bindings) => firstButtonName(bindings, Input.CONFIRM);

/** The first keyboard key and gamepad button bound to confirm, e.g. "Enter / A". */
export const confirmNames = (bindings) => `${confirmKeyName(bindings)} / ${confirmButtonName(bindings)}`;
