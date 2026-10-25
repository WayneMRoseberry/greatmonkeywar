// Tests for shared simulation constants.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Facing, LegendKind, LegendField, CharacterKind } from '../../src/simulation/constants.js';
import cutsceneSchema from '../../src/data/schemas/cutscene.schema.json' with { type: 'json' };
import levelSchema from '../../src/data/schemas/level.schema.json' with { type: 'json' };
import characterSchema from '../../src/data/schemas/character.schema.json' with { type: 'json' };

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

describe('LegendKind and LegendField', () => {
  const entryProperties = Object.keys(levelSchema.$defs.legendEntry.properties);

  test('LegendKind is exactly the kinds a legend entry can be, in the order the docs list them', () => {
    assert.deepEqual(Object.values(LegendKind), ['tile', 'playerStart', 'goal', 'enemy', 'object', 'reward']);
  });

  test('LegendKind and LegendField together are exactly the fields a legend entry may have in level files', () => {
    const fromConstants = [...Object.values(LegendKind), ...Object.values(LegendField)];
    assert.deepEqual([...fromConstants].sort(), [...entryProperties].sort());
  });

  test('no name is both a kind and another field', () => {
    const kinds = new Set(Object.values(LegendKind));
    assert.deepEqual(Object.values(LegendField).filter((field) => kinds.has(field)), []);
  });

  test('neither can be changed', () => {
    assert.ok(Object.isFrozen(LegendKind));
    assert.ok(Object.isFrozen(LegendField));
  });
});

describe('CharacterKind', () => {
  test('its values are exactly the "kind" values character files may use', () => {
    assert.deepEqual([...Object.values(CharacterKind)].sort(), [...characterSchema.properties.kind.enum].sort());
  });

  test('can not be changed', () => {
    assert.ok(Object.isFrozen(CharacterKind));
  });
});
