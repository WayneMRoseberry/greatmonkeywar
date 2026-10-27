// Tests for input mapping (task 7.9; PRD reqs 14-18).
//
// inputFromDevices({ keys, gamepads, bindings, deadZone }) turns what is held
// on the keyboard and gamepads into the simulation's device-independent input
// state (input.js). `keys` is the set of KeyboardEvent.code values held;
// `gamepads` is what navigator.getGamepads() gives (null for empty slots).
// An input is on if any of its bound keys is held, or any of its bound
// gamepad buttons or stick directions on any gamepad (keyboard and gamepad
// work at the same time).
// Decided:
//  - gamepad buttons use the browser's "standard" mapping (Xbox layout); a
//    gamepad that doesn't report the standard mapping is ignored;
//  - the left stick counts as a direction only past the dead zone (strictly
//    more than deadZone from the centre, display.json);
//  - presentationKeys gives the keyboard-only fullscreen and debug keys.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inputFromDevices, presentationKeys, GAMEPAD_BUTTONS } from '../../src/presentation/input-map.js';
import { Input, NO_INPUT, createInput } from '../../src/simulation/input.js';

const BINDINGS = {
  keyboard: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'ArrowUp', 'KeyW'], action: ['KeyE', 'KeyX'], punch: ['KeyQ', 'KeyC'],
    confirm: ['Enter', 'Space'], fullscreen: ['F11'], debug: ['F3'],
  },
  gamepad: {
    left: ['dpadLeft', 'stickLeft'], right: ['dpadRight', 'stickRight'], up: ['dpadUp', 'stickUp'],
    down: ['dpadDown', 'stickDown'], jump: ['a'], action: ['x'], punch: ['b'], confirm: ['a'],
  },
};
const DEAD_ZONE = 0.3;

/** A standard-mapping gamepad with the named buttons held and the left stick at (x, y). */
function gamepad({ held = [], x = 0, y = 0, mapping = 'standard' } = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const name of held) buttons[GAMEPAD_BUTTONS[name]] = { pressed: true, value: 1 };
  return { mapping, buttons, axes: [x, y, 0, 0] };
}

const map = ({ keys = [], gamepads = [] } = {}) => inputFromDevices({ keys: new Set(keys), gamepads, bindings: BINDINGS, deadZone: DEAD_ZONE });

describe('keyboard (reqs 17-18)', () => {
  test('nothing held: no input', () => {
    assert.deepEqual(map(), NO_INPUT);
  });

  test('a bound key turns its input on; either of an input\'s keys does', () => {
    assert.deepEqual(map({ keys: ['ArrowLeft'] }), createInput({ [Input.LEFT]: true }));
    assert.deepEqual(map({ keys: ['KeyA'] }), createInput({ [Input.LEFT]: true }));
  });

  test('one key bound to two inputs turns both on (Space is jump and confirm)', () => {
    assert.deepEqual(map({ keys: ['Space'] }), createInput({ [Input.JUMP]: true, [Input.CONFIRM]: true }));
  });

  test('a key bound to nothing does nothing', () => {
    assert.deepEqual(map({ keys: ['KeyZ'] }), NO_INPUT);
  });

  test('the result is a proper input state (frozen)', () => {
    assert.ok(Object.isFrozen(map({ keys: ['KeyD'] })));
  });
});

describe('gamepad (reqs 15-16)', () => {
  test('the standard button numbers (Xbox layout)', () => {
    assert.deepEqual(GAMEPAD_BUTTONS, {
      a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11,
      dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15,
    });
  });

  test('a bound button turns its input on', () => {
    assert.deepEqual(map({ gamepads: [gamepad({ held: ['b'] })] }), createInput({ [Input.PUNCH]: true }));
    assert.deepEqual(map({ gamepads: [gamepad({ held: ['dpadRight'] })] }), createInput({ [Input.RIGHT]: true }));
  });

  test('the left stick past the dead zone counts as a direction, both ways on both axes', () => {
    const past = DEAD_ZONE + 0.1;
    assert.equal(map({ gamepads: [gamepad({ x: -past })] })[Input.LEFT], true);
    assert.equal(map({ gamepads: [gamepad({ x: past })] })[Input.RIGHT], true);
    assert.equal(map({ gamepads: [gamepad({ y: -past })] })[Input.UP], true);
    assert.equal(map({ gamepads: [gamepad({ y: past })] })[Input.DOWN], true);
  });

  test('the stick inside the dead zone, or exactly at its edge, counts as nothing', () => {
    assert.deepEqual(map({ gamepads: [gamepad({ x: DEAD_ZONE - 0.1, y: -(DEAD_ZONE - 0.1) })] }), NO_INPUT);
    assert.deepEqual(map({ gamepads: [gamepad({ x: DEAD_ZONE })] }), NO_INPUT);
  });

  test('the dead zone comes from the caller (display.json)', () => {
    const stick = 0.5;
    assert.equal(inputFromDevices({ keys: new Set(), gamepads: [gamepad({ x: stick })], bindings: BINDINGS, deadZone: 0.4 })[Input.RIGHT], true);
    assert.equal(inputFromDevices({ keys: new Set(), gamepads: [gamepad({ x: stick })], bindings: BINDINGS, deadZone: 0.6 })[Input.RIGHT], false);
  });

  test('empty gamepad slots (null) are skipped, and any connected gamepad counts', () => {
    assert.equal(map({ gamepads: [null, gamepad({ held: ['a'] })] })[Input.JUMP], true);
  });

  test('a gamepad without the standard mapping is ignored', () => {
    assert.deepEqual(map({ gamepads: [gamepad({ held: ['a'], mapping: '' })] }), NO_INPUT);
  });
});

describe('both at once (req 14)', () => {
  test('keyboard and gamepad inputs combine', () => {
    const input = map({ keys: ['KeyD'], gamepads: [gamepad({ held: ['a'] })] });
    assert.deepEqual(input, createInput({ [Input.RIGHT]: true, [Input.JUMP]: true, [Input.CONFIRM]: true }));
  });
});

describe('presentation keys', () => {
  test('fullscreen and debug come from their keyboard bindings', () => {
    assert.deepEqual(presentationKeys(new Set(['F11']), BINDINGS), { fullscreen: true, debug: false });
    assert.deepEqual(presentationKeys(new Set(['F3']), BINDINGS), { fullscreen: false, debug: true });
    assert.deepEqual(presentationKeys(new Set(), BINDINGS), { fullscreen: false, debug: false });
  });
});
