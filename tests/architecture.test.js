// Architecture guard (PRD requirement 71, technical considerations).
//
// Simulation code must run unchanged in Node (for tests) and in the browser,
// and must be deterministic. So it may only import other simulation modules,
// and must not use browser globals, Node built-ins, or hidden sources of
// randomness or time.
//
// Detection tests check what was found ({ line, rule, subject }); the wording
// of messages is checked separately, once per rule.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkSimulationSource } from '../tools/architecture.js';

const SIMULATION_DIR = path.resolve('src/simulation');
const FILE = path.join(SIMULATION_DIR, 'example.js');

/** What the checker found, without the wording. */
function found(source) {
  return checkSimulationSource(source, FILE).map(({ line, rule, subject }) => ({ line, rule, subject }));
}

const outside = (line, subject) => ({ line, rule: 'outside-import', subject });
const browserGlobal = (line, subject) => ({ line, rule: 'browser-global', subject });
const unrepeatable = (line, subject) => ({ line, rule: 'unrepeatable', subject });

describe('checkSimulationSource: detection', () => {
  test('allows imports of other simulation modules', () => {
    assert.deepEqual(found(
      "import { step } from './step.js';\n" +
      "export { collide } from './collision.js';\n" +
      "import * as c from './sub/constants.js';\n"), []);
  });

  test('rejects imports of presentation, platform, data, and Electron code', () => {
    assert.deepEqual(found(
      "import { draw } from '../presentation/renderer.js';\n" +
      "import { quit } from '../platform/platform.js';\n" +
      "import { loadGameData } from '../data/load.js';\n" +
      "import x from '../../electron/steam.js';\n"), [
      outside(1, '../presentation/renderer.js'),
      outside(2, '../platform/platform.js'),
      outside(3, '../data/load.js'),
      outside(4, '../../electron/steam.js'),
    ]);
  });

  test('rejects packages and Node built-ins', () => {
    assert.deepEqual(found(
      "import { app } from 'electron';\n" +
      "import fs from 'node:fs';\n" +
      "export * from 'steamworks.js';\n"), [
      outside(1, 'electron'),
      outside(2, 'node:fs'),
      outside(3, 'steamworks.js'),
    ]);
  });

  test('rejects dynamic imports from outside', () => {
    assert.deepEqual(found("const m = await import('../presentation/main.js');\n"), [
      outside(1, '../presentation/main.js'),
    ]);
  });

  test('rejects browser globals', () => {
    assert.deepEqual(found(
      'const w = window.innerWidth;\n' +
      'document.title = "x";\n' +
      'requestAnimationFrame(tick);\n' +
      'const img = new Image();\n' +
      'fetch(url);\n'), [
      browserGlobal(1, 'window'),
      browserGlobal(2, 'document'),
      browserGlobal(3, 'requestAnimationFrame'),
      browserGlobal(4, 'Image'),
      browserGlobal(5, 'fetch'),
    ]);
  });

  test('rejects hidden randomness and clock reads, which break determinism', () => {
    assert.deepEqual(found(
      'const r = Math.random();\n' +
      'const t = Date.now();\n' +
      'const p = performance.now();\n'), [
      unrepeatable(1, 'Math.random'),
      unrepeatable(2, 'Date.now'),
      unrepeatable(3, 'performance.now'),
    ]);
  });

  test('ignores names in comments, strings, and property names', () => {
    assert.deepEqual(found(
      '// window and document are not used here\n' +
      '/* import x from "../presentation/x.js"; */\n' +
      'const label = "window";\n' +
      'const s = `fetch Image`;\n' +
      'const box = { window: 1 };\n' +
      'const w = state.window;\n'), []);
  });
});

describe('checkSimulationSource: messages', () => {
  const messageFor = (source) => checkSimulationSource(source, FILE)[0].message;

  test('outside-import names the import and the rule', () => {
    assert.equal(messageFor("import x from '../presentation/a.js';"),
      'imports "../presentation/a.js", which is outside src/simulation/');
  });

  test('browser-global names the global', () => {
    assert.equal(messageFor('window.x = 1;'), 'uses the browser global "window"');
  });

  test('unrepeatable names the call and says what to use instead', () => {
    assert.equal(messageFor('Math.random();'),
      'uses "Math.random", which makes the simulation unrepeatable; pass a seeded random number generator in through state');
    assert.equal(messageFor('Date.now();'),
      'uses "Date.now", which makes the simulation unrepeatable; use the time step passed to step()');
  });
});

describe('architecture guard', () => {
  const files = fs.existsSync(SIMULATION_DIR)
    ? fs.readdirSync(SIMULATION_DIR, { recursive: true }).filter((f) => f.endsWith('.js'))
    : [];

  for (const file of files) {
    test(`src/simulation/${file.split(path.sep).join('/')} follows the simulation rules`, () => {
      const full = path.join(SIMULATION_DIR, file);
      const violations = checkSimulationSource(fs.readFileSync(full, 'utf8'), full);
      // Messages, so a failure explains itself.
      assert.deepEqual(violations.map((v) => `line ${v.line}: ${v.message}`), []);
    });
  }
});
