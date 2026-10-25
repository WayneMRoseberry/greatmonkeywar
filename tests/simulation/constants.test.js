// Tests for shared simulation constants.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Facing } from '../../src/simulation/constants.js';
import cutsceneSchema from '../../src/data/schemas/cutscene.schema.json' with { type: 'json' };
import levelSchema from '../../src/data/schemas/level.schema.json' with { type: 'json' };

describe('Facing', () => {
  test('has exactly the two directions a character can face', () => {
    assert.deepEqual(Object.keys(Facing).sort(), ['LEFT', 'RIGHT']);
    assert.notEqual(Facing.LEFT, Facing.RIGHT);
  });

  test('can\'t be changed', () => {
    assert.ok(Object.isFrozen(Facing));
    assert.throws(() => { Facing.UP = 'up'; }, TypeError);
  });

  test('its values are the ones cut scene files use for "facing", so the two stay in sync', () => {
    const allowedInData = cutsceneSchema.properties.actors.items.properties.facing.enum;
    assert.deepEqual([...Object.values(Facing)].sort(), [...allowedInData].sort());
  });

  test('its values are the ones level files use for an enemy\'s "facing", so the two stay in sync', () => {
    const allowedInData = levelSchema.$defs.legendEntry.properties.facing.enum;
    assert.deepEqual([...Object.values(Facing)].sort(), [...allowedInData].sort());
  });
});
