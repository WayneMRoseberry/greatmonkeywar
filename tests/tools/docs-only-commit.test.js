// Tests for the pre-commit hook's check for documentation-only commits.
// Decided:
//  - a commit skips npm test only if every staged file is on the
//    documentation list (DOCUMENTATION); anything else, a mix, or nothing
//    staged runs the tests;
//  - the list names what is safe, not what isn't, so a new file runs the tests
//    until someone adds it;
//  - docs/data-formats.md and the guides are not on the list: schemas.test.js
//    checks their JSON examples;
//  - a file on the list must not be read by anything npm test runs; a test
//    below fails if code or tests start referring to one (outside comments,
//    which may mention documents without reading them);
//  - the command exits 0 for documentation only and 1 otherwise, so if it
//    fails for any other reason the hook runs the tests.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { DOCUMENTATION, isDocumentationOnly } from '../../tools/docs-only-commit.js';

const TOOL = path.resolve('tools/docs-only-commit.js');
const THIS_TEST = path.resolve('tests/tools/docs-only-commit.test.js');

describe('which commits are documentation only', () => {
  test('files in a documentation folder', () => {
    const [folder] = DOCUMENTATION.folders;
    assert.equal(isDocumentationOnly([`${folder}prd-sound.md`, `${folder}tasks-sound.md`]), true);
  });

  test('every listed documentation file', () => {
    assert.equal(isDocumentationOnly(DOCUMENTATION.files), true);
  });

  test('docs whose JSON examples are tested are not documentation only', () => {
    assert.equal(isDocumentationOnly(['docs/data-formats.md']), false);
    assert.equal(isDocumentationOnly(['docs/guide-levels.md']), false);
  });

  test('code, data, and tests are not', () => {
    for (const file of ['src/simulation/step.js', 'data/levels/level1.json', 'tests/simulation/step.test.js', 'package.json']) {
      assert.equal(isDocumentationOnly([file]), false, file);
    }
  });

  test('documentation mixed with anything else is not', () => {
    const [folder] = DOCUMENTATION.folders;
    assert.equal(isDocumentationOnly([`${folder}tasks-sound.md`, 'src/simulation/step.js']), false);
  });

  test('a folder only counts at the start of the path, and as a whole name', () => {
    const [folder] = DOCUMENTATION.folders;
    assert.equal(isDocumentationOnly([`src/${folder}notes.md`]), false, 'inside another folder');
    assert.equal(isDocumentationOnly([`${folder.slice(0, -1)}-old/notes.md`]), false, 'a longer folder name');
  });

  test('nothing staged is not', () => {
    assert.equal(isDocumentationOnly([]), false);
  });
});

/** Every .js file under `dir`. */
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** `source` without its comments (a // comment starts the line or follows a space, so "https://" stays). */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

test('comments are ignored when looking for references', () => {
  assert.equal(withoutComments('a(); // see docs/x.md\n/* docs/y.md */b();'), 'a(); \nb();');
  assert.equal(withoutComments("fetch('https://example.com');"), "fetch('https://example.com');");
});

test('nothing npm test runs refers to a file on the documentation list (comments may mention them)', () => {
  const sources = ['src', 'tools', 'tests', 'electron'].flatMap((dir) => jsFiles(path.resolve(dir)))
    .filter((file) => file !== TOOL && file !== THIS_TEST);
  const names = [...DOCUMENTATION.folders, ...DOCUMENTATION.files.map((file) => path.posix.basename(file))];
  const references = sources.flatMap((file) => {
    const text = withoutComments(fs.readFileSync(file, 'utf8'));
    return names.filter((name) => text.includes(name)).map((name) => `${path.relative('.', file)} refers to ${name}`);
  });
  assert.deepEqual(references, [], 'take these off the documentation list, or stop referring to them');
});

describe('the command, in a Git repository', () => {
  /** A new repository in a temporary folder, with `files` staged. */
  function repoWith(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-only-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    for (const file of files) {
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), 'x');
    }
    if (files.length > 0) execFileSync('git', ['add', ...files], { cwd: dir });
    return dir;
  }

  const run = (dir) => spawnSync(process.execPath, [TOOL], { cwd: dir, encoding: 'utf8' }).status;

  test('exits 0 when only documentation is staged', () => {
    const [folder] = DOCUMENTATION.folders;
    assert.equal(run(repoWith([`${folder}notes with spaces.md`])), 0);
  });

  test('exits 1 when anything else is staged', () => {
    const [folder] = DOCUMENTATION.folders;
    assert.equal(run(repoWith([`${folder}notes.md`, 'src/game.js'])), 1);
  });

  test('exits 1 when nothing is staged', () => {
    assert.equal(run(repoWith([])), 1);
  });
});
