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

/** The main mouse button (event.button). */
const MAIN_BUTTON = 0;

/**
 * Reads input from `target`'s keyboard events, clicks on `pointerTarget` (the
 * canvas), and `getGamepads()`.
 * read() gives { input, presentation, device, click, activated }: the input
 * state, the fullscreen, debug, and mute keys, the device used last
 * (InputDevice), the last main-button click since the previous read, as
 * { x, y } in canvas pixels (or null), and whether any key was pressed or the
 * canvas clicked since then (a browser lets sound play only after that). A bound key's browser default is prevented; losing focus releases
 * every key. dispose() removes the event listeners.
 */
export function createInputReader({ target, pointerTarget, getGamepads, bindings, deadZone }) {
  const keys = new Set();
  // Keys pressed since the last read: they count as held for that read even if
  // already released, so a tap between two frames isn't lost.
  const tapped = new Set();
  const bound = boundKeys(bindings);
  let device = InputDevice.KEYBOARD;
  let click = null;
  let activated = false;   // a key pressed or the canvas clicked since the last read

  const onKeyDown = (event) => {
    activated = true;
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
  // The canvas is drawn in device pixels but shown at its CSS size, so the
  // click is scaled from where it is on the page to the canvas's own pixels.
  const onClick = (event) => {
    activated = true;
    if (event.button !== MAIN_BUTTON) return;
    const rect = pointerTarget.getBoundingClientRect();
    click = {
      x: (event.clientX - rect.left) * (pointerTarget.width / rect.width),
      y: (event.clientY - rect.top) * (pointerTarget.height / rect.height),
    };
  };
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  pointerTarget.addEventListener('click', onClick);

  return {
    read() {
      const gamepads = Array.from(getGamepads() ?? []);
      if (anyGamepadUse(gamepads, deadZone)) device = InputDevice.GAMEPAD;
      const held = new Set([...keys, ...tapped]);
      tapped.clear();
      const clicked = click;
      click = null;
      const wasActivated = activated;
      activated = false;
      return {
        input: inputFromDevices({ keys: held, gamepads, bindings, deadZone }),
        presentation: presentationKeys({ keys: held, gamepads, bindings, deadZone }),
        device,
        click: clicked,
        activated: wasActivated,
      };
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      pointerTarget.removeEventListener('click', onClick);
    },
  };
}
