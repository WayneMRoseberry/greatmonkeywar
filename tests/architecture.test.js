// Architecture guard (PRD requirement 71, technical considerations).
//
// Simulation code must run unchanged in Node (for tests) and in the browser,
// and must be deterministic. So it may only import other simulation modules,
// and must not use browser globals, Node built-ins, or hidden sources of
// randomness or time.
//
// All Steam and Electron calls go through the platform layer (req 13). So
// only electron/ and src/platform/ may reference the electron or steamworks.js
// packages; everything in src/ and tools/ is checked.
//
// Detection tests check what was found ({ line, rule, subject }); the wording
// of messages is checked separately, once per rule.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkSimulationSource, checkHostReferences } from '../tools/architecture.js';

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

// Host references (task 8.12; PRD reqs 13, 71): only electron/ and
// src/platform/ may reference the electron or steamworks.js packages, so all
// Steam and Electron calls go through the platform layer. Any way of naming
// the package counts (import, export from, import(), require, createRequire).

const PRESENTATION_FILE = path.resolve('src/presentation/example.js');
const hostFound = (source, file = PRESENTATION_FILE) =>
  checkHostReferences(source, file).map(({ line, rule, subject }) => ({ line, rule, subject }));
const hostReference = (line, subject) => ({ line, rule: 'host-reference', subject });

describe('checkHostReferences: detection', () => {
  test('rejects every way of naming electron or steamworks.js outside the platform layer', () => {
    assert.deepEqual(hostFound(
      "import { app } from 'electron';\n" +
      "export * from 'steamworks.js';\n" +
      "const e = await import('electron');\n" +
      "const s = require('steamworks.js');\n" +
      "const t = createRequire(import.meta.url)('steamworks.js');\n" +
      'import { x } from "electron/main";\n' +
      "import 'electron';\n"), [
      hostReference(1, 'electron'),
      hostReference(2, 'steamworks.js'),
      hostReference(3, 'electron'),
      hostReference(4, 'steamworks.js'),
      hostReference(5, 'steamworks.js'),
      hostReference(6, 'electron/main'),
      hostReference(7, 'electron'),
    ]);
  });

  test('allows them in electron/ and src/platform/', () => {
    const source = "import { app } from 'electron';\nconst s = require('steamworks.js');\n";
    assert.deepEqual(hostFound(source, path.resolve('electron/main.js')), []);
    assert.deepEqual(hostFound(source, path.resolve('src/platform/electron-platform.js')), []);
  });

  test('ignores comments, other packages, names that only start the same way, and strings that load nothing', () => {
    assert.deepEqual(hostFound(
      "// import { app } from 'electron';\n" +
      "/* require('steamworks.js') */\n" +
      "import { test } from 'node:test';\n" +
      "const label = 'electronic';\n" +
      "const file = '../platform/electron-platform.js';\n" +
      "const dir = path.join(root, 'electron');\n"), []);
  });
});

describe('checkHostReferences: messages', () => {
  test('host-reference names the package and where it may be used', () => {
    assert.equal(checkHostReferences("import { app } from 'electron';", PRESENTATION_FILE)[0].message,
      'references "electron", which only electron/ and src/platform/ may use');
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

  const hostDirs = ['src', 'tools'];
  const hostFiles = hostDirs.flatMap((dir) => fs.readdirSync(path.resolve(dir), { recursive: true })
    .filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
    .map((f) => path.join(dir, f)));

  for (const file of hostFiles) {
    test(`${file.split(path.sep).join('/')} references electron and steamworks.js only through the platform layer`, () => {
      const full = path.resolve(file);
      const violations = checkHostReferences(fs.readFileSync(full, 'utf8'), full);
      assert.deepEqual(violations.map((v) => `line ${v.line}: ${v.message}`), []);
    });
  }
});
