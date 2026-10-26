// Reading input (PRD req 14): keys held, tracked from keyboard events, and
// gamepads, polled each frame (the Gamepad API sends no events). The event
// target (the window) and getGamepads are passed in, so tests use fakes.

import { inputFromDevices, presentationKeys } from './input-map.js';

/** The kinds of input device, for the debug overlay. */
export const InputDevice = Object.freeze({
  KEYBOARD: 'keyboard',
  GAMEPAD: 'gamepad',
});

/** Every key code that the bindings use. */
function boundKeys(bindings) {
  return new Set(Object.values(bindings.keyboard).flat());
}

/** True if anything is held on a standard gamepad: a button, or the left stick past `deadZone`. */
function anyGamepadUse(gamepads, deadZone) {
  return gamepads.some((pad) => pad && pad.mapping === 'standard'
    && (pad.buttons.some((button) => button.pressed) || pad.axes.slice(0, 2).some((value) => Math.abs(value) > deadZone)));
}

/**
 * Reads input from `target`'s keyboard events and `getGamepads()`.
 * read() gives { input, presentation, device }: the input state, the
 * fullscreen and debug keys, and the device used last (InputDevice). A bound
 * key's browser default is prevented; losing focus releases every key.
 * dispose() removes the event listeners.
 */
export function createInputReader({ target, getGamepads, bindings, deadZone }) {
  const keys = new Set();
  // Keys pressed since the last read: they count as held for that read even if
  // already released, so a tap between two frames isn't lost.
  const tapped = new Set();
  const bound = boundKeys(bindings);
  let device = InputDevice.KEYBOARD;

  const onKeyDown = (event) => {
    keys.add(event.code);
    tapped.add(event.code);
    device = InputDevice.KEYBOARD;
    if (bound.has(event.code)) event.preventDefault();
  };
  const onKeyUp = (event) => {
    keys.delete(event.code);
    if (bound.has(event.code)) event.preventDefault();
  };
  const onBlur = () => {
    keys.clear();
    tapped.clear();
  };
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    read() {
      const gamepads = Array.from(getGamepads() ?? []);
      if (anyGamepadUse(gamepads, deadZone)) device = InputDevice.GAMEPAD;
      const held = new Set([...keys, ...tapped]);
      tapped.clear();
      return {
        input: inputFromDevices({ keys: held, gamepads, bindings, deadZone }),
        presentation: presentationKeys(held, bindings),
        device,
      };
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
