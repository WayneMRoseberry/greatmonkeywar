// Input mapping (PRD reqs 14-18): what is held on the keyboard and gamepads,
// plus the bindings (bindings.json), becomes the simulation's
// device-independent input state (src/simulation/input.js).

import { Input, createInput } from '../simulation/input.js';

/** Button numbers in the browser's "standard" gamepad mapping (Xbox layout). */
export const GAMEPAD_BUTTONS = Object.freeze({
  a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11,
  dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15,
});

const STICK_X = 0;   // the left stick's axes
const STICK_Y = 1;

/** True if the named gamepad button or left-stick direction is held on `pad`, with the stick past `deadZone`. */
function gamepadHeld(pad, name, deadZone) {
  switch (name) {
    case 'stickLeft': return pad.axes[STICK_X] < -deadZone;
    case 'stickRight': return pad.axes[STICK_X] > deadZone;
    case 'stickUp': return pad.axes[STICK_Y] < -deadZone;
    case 'stickDown': return pad.axes[STICK_Y] > deadZone;
    default: return pad.buttons[GAMEPAD_BUTTONS[name]]?.pressed === true;
  }
}

/** The gamepads to read: connected ones that report the standard mapping (others are ignored). */
const standardPads = (gamepads) => gamepads.filter((pad) => pad && pad.mapping === 'standard');

/**
 * The input state for what is held: an input is on if any of its bound keys
 * is in `keys` (KeyboardEvent.code values), or any of its bound buttons or
 * stick directions is held on any standard gamepad in `gamepads`. Keyboard and
 * gamepad work at the same time (req 14).
 */
export function inputFromDevices({ keys, gamepads, bindings, deadZone }) {
  const pads = standardPads(gamepads);
  const held = {};
  for (const name of Object.values(Input)) {
    const byKey = bindings.keyboard[name].some((code) => keys.has(code));
    const byPad = pads.some((pad) => bindings.gamepad[name].some((button) => gamepadHeld(pad, button, deadZone)));
    held[name] = byKey || byPad;
  }
  return createInput(held);
}

/**
 * Whether the presentation keys are held: { fullscreen, debug, mute }.
 * Fullscreen and debug are keyboard only; mute can also have gamepad buttons
 * (sound PRD req 16), read like inputFromDevices's.
 */
export function presentationKeys({ keys, gamepads, bindings, deadZone }) {
  const byKey = (name) => bindings.keyboard[name].some((code) => keys.has(code));
  const muteButtons = bindings.gamepad.mute ?? [];
  const muteByPad = standardPads(gamepads).some((pad) => muteButtons.some((button) => gamepadHeld(pad, button, deadZone)));
  return {
    fullscreen: byKey('fullscreen'),
    debug: byKey('debug'),
    mute: byKey('mute') || muteByPad,
  };
}
