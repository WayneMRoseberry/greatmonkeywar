// Tests for the input state: the device-independent controls passed to step() (PRD req 18).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Input, NO_INPUT, createInput, holding } from '../../src/simulation/input.js';
import bindingsSchema from '../../src/data/schemas/bindings.schema.json' with { type: 'json' };

const ALL_INPUTS = ['left', 'right', 'up', 'down', 'jump', 'action', 'punch', 'confirm'];   // PRD req 18

describe('Input', () => {
  test('names the eight inputs from the PRD', () => {
    assert.deepEqual([...Object.values(Input)].sort(), [...ALL_INPUTS].sort());
  });

  test('can\'t be changed', () => {
    assert.ok(Object.isFrozen(Input));
    assert.throws(() => { Input.DASH = 'dash'; }, TypeError);
  });

  test('matches the inputs every gamepad binding must cover, so code and data stay in sync', () => {
    const gamepadInputs = bindingsSchema.properties.gamepad.required;
    assert.deepEqual([...Object.values(Input)].sort(), [...gamepadInputs].sort());
  });

  test('every input must also have a keyboard binding', () => {
    const keyboardInputs = bindingsSchema.properties.keyboard.required;
    for (const name of Object.values(Input)) assert.ok(keyboardInputs.includes(name), `no keyboard binding required for "${name}"`);
  });
});

describe('NO_INPUT', () => {
  test('has every input, all off', () => {
    assert.deepEqual(NO_INPUT, Object.fromEntries(Object.values(Input).map((name) => [name, false])));
  });

  test('can\'t be changed', () => {
    assert.ok(Object.isFrozen(NO_INPUT));
    assert.throws(() => { NO_INPUT[Input.JUMP] = true; }, TypeError);
  });
});

describe('createInput', () => {
  test('turns on the inputs given as true, and leaves every other input off', () => {
    const state = createInput({ [Input.RIGHT]: true, [Input.JUMP]: true });
    assert.deepEqual(state, { ...NO_INPUT, [Input.RIGHT]: true, [Input.JUMP]: true });
  });

  test('inputs given as false are off', () => {
    assert.deepEqual(createInput({ [Input.LEFT]: false }), NO_INPUT);
  });

  test('with nothing given, every input is off', () => {
    assert.deepEqual(createInput(), NO_INPUT);
  });

  test('rejects a name that isn\'t an input, such as a typo', () => {
    assert.throws(() => createInput({ rigth: true }), /"rigth" is not an input/);
  });

  test('rejects a value that isn\'t true or false', () => {
    assert.throws(() => createInput({ [Input.JUMP]: 1 }), /"jump" must be true or false/);
  });

  test('returns a new state that can\'t be changed, without changing what was passed in', () => {
    const held = { [Input.ACTION]: true };
    const state = createInput(held);
    assert.ok(Object.isFrozen(state));
    assert.notEqual(state, held);
    assert.deepEqual(held, { [Input.ACTION]: true });
  });
});

describe('holding', () => {
  test('is the input state with exactly the named inputs held', () => {
    assert.deepEqual(holding(Input.LEFT, Input.PUNCH), createInput({ [Input.LEFT]: true, [Input.PUNCH]: true }));
  });

  test('with no names, nothing is held', () => {
    assert.deepEqual(holding(), NO_INPUT);
  });

  test('rejects a name that isn\'t an input', () => {
    assert.throws(() => holding('rigth'), /"rigth" is not an input/);
  });
});
