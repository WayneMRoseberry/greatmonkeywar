// Tests for the test helpers used by the simulation tests.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildData, TEST_LEVEL } from './level-builder.js';
import { input, NO_INPUT, runSteps } from './run.js';
import { validateData } from '../../src/data/validate.js';

/** The data in the { files } form validateData expects. */
function asFiles(data) {
  const files = {
    'levels/levels.json': data.levelList,
    'config/tuning.json': data.tuning,
    'config/bindings.json': data.bindings,
    'config/display.json': data.display,
  };
  for (const [name, level] of Object.entries(data.levels)) files[`levels/${name}.json`] = level;
  for (const [name, c] of Object.entries(data.characters)) files[`characters/${name}.json`] = c;
  for (const [name, o] of Object.entries(data.objects)) files[`objects/${name}.json`] = o;
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v)]));
}

describe('buildData', () => {
  test('builds a one-level game from grid strings', () => {
    const data = buildData(['P.G', '###']);
    assert.deepEqual(data.levelList.levels, [TEST_LEVEL]);
    const level = data.levels[TEST_LEVEL];
    assert.deepEqual(level.grid, ['P.G', '###']);
    assert.equal(level.grid.length, 2);       // height in tiles
    assert.equal(level.grid[0].length, 3);    // width in tiles
    assert.deepEqual(level.legend.P, { playerStart: true });
    assert.equal(level.legend.G.goal, true);
    assert.deepEqual(level.legend['#'].tile.solid, true);
  });

  test('the data it builds passes validation, including enemies, objects, and rewards', () => {
    const data = buildData(['P.e.c.o.b.G', '###########']);
    const { errors } = validateData({ files: asFiles(data), images: {} });
    assert.deepEqual(errors, []);
  });

  test('default definitions are available for the standard legend characters', () => {
    const data = buildData(['P.G', '###']);
    assert.equal(data.characters.player.kind, 'player');
    assert.equal(data.characters[data.levels[TEST_LEVEL].legend.e.enemy].kind, 'enemy');
    assert.equal(data.objects[data.levels[TEST_LEVEL].legend.c.object].stackable, true);
    assert.equal(data.objects[data.levels[TEST_LEVEL].legend.o.object].stackable ?? false, false);
  });

  test('overrides replace only the parts they name', () => {
    const defaults = buildData(['P.G', '###']);
    const data = buildData(['P.G', '###'], {
      tuning: { gravity: 10 },
      player: { speed: 9 },
      legend: { x: { tile: { solid: false, color: '#000000' } } },
    });
    // Overridden
    assert.equal(data.tuning.gravity, 10);
    assert.equal(data.characters.player.speed, 9);
    assert.deepEqual(data.levels[TEST_LEVEL].legend.x, { tile: { solid: false, color: '#000000' } });
    // Not overridden: same as the defaults
    assert.equal(data.tuning.jumpSpeed, defaults.tuning.jumpSpeed);
    assert.equal(data.characters.player.health, defaults.characters.player.health);
    assert.deepEqual(data.levels[TEST_LEVEL].legend.P, defaults.levels[TEST_LEVEL].legend.P);
  });

  test('each call returns fresh data that tests can change safely', () => {
    const a = buildData(['P.G', '###']);
    a.tuning.gravity = 999;
    a.characters.player.speed = 999;
    const b = buildData(['P.G', '###']);
    assert.notEqual(b.tuning.gravity, 999);
    assert.notEqual(b.characters.player.speed, 999);
  });
});

describe('input', () => {
  test('NO_INPUT has every input off', () => {
    assert.deepEqual(NO_INPUT, {
      left: false, right: false, up: false, down: false,
      jump: false, action: false, punch: false, confirm: false,
    });
  });

  test('input() turns on only the named inputs', () => {
    assert.deepEqual(input({ right: true, jump: true }), { ...NO_INPUT, right: true, jump: true });
  });

  test('input() rejects names that are not inputs', () => {
    assert.throws(() => input({ rigth: true }), /Unknown input "rigth"/);
  });
});

describe('runSteps', () => {
  test('calls step exactly N times, passing each result to the next call', () => {
    const calls = [];
    const fakeStep = (state, inp, dt) => {
      calls.push({ state, inp, dt });
      return { count: state.count + 1 };
    };
    const held = input({ right: true });
    const result = runSteps(fakeStep, { count: 0 }, held, 5, 0.5);

    assert.deepEqual(result, { count: 5 });
    assert.equal(calls.length, 5);
    assert.deepEqual(calls.map((c) => c.state.count), [0, 1, 2, 3, 4]);
    assert.ok(calls.every((c) => c.inp === held && c.dt === 0.5));
  });

  test('input can be a function of the step number, to script presses', () => {
    const seen = [];
    const fakeStep = (state, inp) => { seen.push(inp.jump); return state; };
    runSteps(fakeStep, {}, (i) => input({ jump: i === 2 }), 4, 1 / 60);
    assert.deepEqual(seen, [false, false, true, false]);
  });

  test('zero steps returns the starting state', () => {
    const start = { count: 0 };
    assert.equal(runSteps(() => { throw new Error('should not be called'); }, start, NO_INPUT, 0, 1 / 60), start);
  });
});
