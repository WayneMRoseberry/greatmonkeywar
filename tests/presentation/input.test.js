// Tests for reading input (task 7.10; PRD req 14), with fake events and gamepads.
//
// createInputReader({ target, getGamepads, bindings, deadZone }) tracks the
// keys held from keydown and keyup events on `target` (the window), and reads
// the gamepads each time read() is called (once a frame; the Gamepad API is
// polled, not event-driven). read() gives { input, presentation, device }:
// the input state (input-map.js), the fullscreen and debug keys, and which
// device was used last.
// Decided:
//  - a key that is bound to something has its browser default prevented (so
//    arrows and Space don't scroll the page, and F3 and F11 don't do the
//    browser's own thing); other keys are left alone;
//  - when the window loses focus, all keys count as released (their keyup
//    would never arrive);
//  - the device is the keyboard to begin with; it becomes the gamepad when
//    something is held on one (a button, or the stick past the dead zone),
//    and the keyboard again when a key is pressed.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createInputReader, InputDevice } from '../../src/presentation/input.js';
import { GAMEPAD_BUTTONS } from '../../src/presentation/input-map.js';
import { Input, NO_INPUT } from '../../src/simulation/input.js';

const BINDINGS = {
  keyboard: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Space'],
    action: ['KeyE'], punch: ['KeyQ'], confirm: ['Enter'], fullscreen: ['F11'], debug: ['F3'],
  },
  gamepad: {
    left: ['dpadLeft', 'stickLeft'], right: ['dpadRight', 'stickRight'], up: ['dpadUp'], down: ['dpadDown'],
    jump: ['a'], action: ['x'], punch: ['b'], confirm: ['a'],
  },
};
const DEAD_ZONE = 0.3;

/** A fake window: records listeners; key(type, code) fires a keyboard event and returns it. */
function fakeWindow() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn); },
    key(type, code) {
      const event = { type, code, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      for (const fn of listeners[type] ?? []) fn(event);
      return event;
    },
    fire(type) { for (const fn of listeners[type] ?? []) fn({ type }); },
  };
}

function gamepad({ held = [], x = 0 } = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const name of held) buttons[GAMEPAD_BUTTONS[name]] = { pressed: true, value: 1 };
  return { mapping: 'standard', buttons, axes: [x, 0, 0, 0] };
}

function setUp() {
  const win = fakeWindow();
  let pads = [];
  const reader = createInputReader({ target: win, getGamepads: () => pads, bindings: BINDINGS, deadZone: DEAD_ZONE });
  return { win, reader, setPads: (p) => { pads = p; } };
}

describe('keyboard', () => {
  test('a key held between keydown and keyup turns its input on', () => {
    const { win, reader } = setUp();
    win.key('keydown', 'ArrowRight');
    assert.equal(reader.read().input[Input.RIGHT], true);
    win.key('keyup', 'ArrowRight');
    assert.deepEqual(reader.read().input, NO_INPUT);
  });

  test('a key pressed and released between two reads still counts, for one read (a quick tap isn\'t lost)', () => {
    const { win, reader } = setUp();
    win.key('keydown', 'Enter');
    win.key('keyup', 'Enter');
    assert.equal(reader.read().input[Input.CONFIRM], true, 'the tap is seen');
    assert.equal(reader.read().input[Input.CONFIRM], false, 'and only once');
  });

  test('several keys can be held at once', () => {
    const { win, reader } = setUp();
    win.key('keydown', 'ArrowRight');
    win.key('keydown', 'Space');
    const { input } = reader.read();
    assert.equal(input[Input.RIGHT], true);
    assert.equal(input[Input.JUMP], true);
  });

  test('a bound key\'s browser default is prevented; an unbound key\'s isn\'t', () => {
    const { win } = setUp();
    assert.equal(win.key('keydown', 'Space').defaultPrevented, true);
    assert.equal(win.key('keydown', 'F11').defaultPrevented, true);
    assert.equal(win.key('keydown', 'KeyZ').defaultPrevented, false);
  });

  test('losing focus releases every key', () => {
    const { win, reader } = setUp();
    win.key('keydown', 'ArrowLeft');
    win.fire('blur');
    assert.deepEqual(reader.read().input, NO_INPUT);
  });

  test('the fullscreen and debug keys are reported separately', () => {
    const { win, reader } = setUp();
    win.key('keydown', 'F3');
    assert.deepEqual(reader.read().presentation, { fullscreen: false, debug: true });
  });
});

describe('gamepads, read each frame', () => {
  test('a gamepad button is read when read() is called', () => {
    const { reader, setPads } = setUp();
    setPads([gamepad({ held: ['a'] })]);
    assert.equal(reader.read().input[Input.JUMP], true);
    setPads([gamepad()]);
    assert.equal(reader.read().input[Input.JUMP], false);
  });

  test('keyboard and gamepad at the same time (req 14)', () => {
    const { win, reader, setPads } = setUp();
    win.key('keydown', 'ArrowRight');
    setPads([gamepad({ held: ['b'] })]);
    const { input } = reader.read();
    assert.equal(input[Input.RIGHT], true);
    assert.equal(input[Input.PUNCH], true);
  });

  test('no gamepad support (getGamepads gives nothing) still works', () => {
    const win = fakeWindow();
    const reader = createInputReader({ target: win, getGamepads: () => undefined, bindings: BINDINGS, deadZone: DEAD_ZONE });
    win.key('keydown', 'Enter');
    assert.equal(reader.read().input[Input.CONFIRM], true);
  });
});

describe('the device in use (debug overlay)', () => {
  test('the keyboard to begin with', () => {
    assert.equal(setUp().reader.read().device, InputDevice.KEYBOARD);
  });

  test('the gamepad once something is held on one, and the keyboard again after a key press', () => {
    const { win, reader, setPads } = setUp();
    setPads([gamepad({ x: DEAD_ZONE + 0.1 })]);
    assert.equal(reader.read().device, InputDevice.GAMEPAD);
    setPads([gamepad()]);
    assert.equal(reader.read().device, InputDevice.GAMEPAD, 'it stays the last one used');
    win.key('keydown', 'KeyE');
    assert.equal(reader.read().device, InputDevice.KEYBOARD);
  });

  test('a stick resting inside the dead zone doesn\'t count as using the gamepad', () => {
    const { reader, setPads } = setUp();
    setPads([gamepad({ x: DEAD_ZONE - 0.1 })]);
    assert.equal(reader.read().device, InputDevice.KEYBOARD);
  });
});

describe('cleaning up', () => {
  test('dispose removes the event listeners', () => {
    const { win, reader } = setUp();
    reader.dispose();
    for (const type of ['keydown', 'keyup', 'blur']) assert.deepEqual(win.listeners[type], []);
  });
});
