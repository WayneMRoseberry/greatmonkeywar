// Checks source code against the project's architecture rules.
// Used by tests/architecture.test.js.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIMULATION_DIR = path.join(REPO_ROOT, 'src', 'simulation');

const BROWSER_GLOBALS = [
  'window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame',
  'Image', 'fetch', 'localStorage', 'sessionStorage',
];

const UNREPEATABLE = [
  { name: 'Math.random', fix: 'pass a seeded random number generator in through state' },
  { name: 'Date.now', fix: 'use the time step passed to step()' },
  { name: 'performance.now', fix: 'use the time step passed to step()' },
];

/**
 * Returns two copies of `source` with the same length and line breaks:
 *   code: comments blanked out (strings kept), for finding imports;
 *   bare: comments and string contents blanked out, for finding names.
 *
 * Known gaps (both let forbidden code go unnoticed):
 *   - code inside a template expression, `${window.x}`, is treated as text;
 *   - a quote inside a regular expression, /["]/, is taken as the start of a string.
 * Replacing this scanner with a JavaScript parser (e.g. acorn) is under consideration.
 */
function blankOut(source) {
  const code = source.split('');
  const bare = source.split('');
  const blank = (arr, i) => { if (arr[i] !== '\n') arr[i] = ' '; };
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      while (i < source.length && source[i] !== '\n') { blank(code, i); blank(bare, i); i++; }
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (; i < stop; i++) { blank(code, i); blank(bare, i); }
    } else if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
      const quote = source[i++];
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { blank(bare, i++); }
        blank(bare, i++);
      }
      i++; // closing quote
    } else {
      i++;
    }
  }
  return { code: code.join(''), bare: bare.join('') };
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'";]*?\bfrom\s+)?(['"])([^'"]+)\1/g, // import x from '...'; import '...'
  /\bexport\s+[^'";]*?\bfrom\s+(['"])([^'"]+)\1/g,       // export ... from '...'
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,              // import('...')
];

function findImports(code) {
  const found = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) found.push({ spec: match[2], index: match.index });
  }
  return found;
}

function isInside(dir, file) {
  const relative = path.relative(dir, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Returns the rule breaks in a simulation source file, in order, each as
 *   { line, rule, subject, message }
 * where rule is 'outside-import', 'browser-global', or 'unrepeatable', and
 * subject is the import, global, or call that broke it.
 */
export function checkSimulationSource(source, filePath) {
  const { code, bare } = blankOut(source);
  const violations = [];
  const add = (index, rule, subject, message) =>
    violations.push({ index, line: lineAt(source, index), rule, subject, message });

  for (const { spec, index } of findImports(code)) {
    const relative = spec.startsWith('./') || spec.startsWith('../');
    if (!relative || !isInside(SIMULATION_DIR, path.resolve(path.dirname(filePath), spec))) {
      add(index, 'outside-import', spec, `imports "${spec}", which is outside src/simulation/`);
    }
  }

  for (const name of BROWSER_GLOBALS) {
    // Not a property (obj.window) and not an object key ({ window: 1 }).
    const pattern = new RegExp(`(?<![.\\w$])${name}\\b(?!\\s*:)`, 'g');
    for (const match of bare.matchAll(pattern)) {
      add(match.index, 'browser-global', name, `uses the browser global "${name}"`);
    }
  }

  for (const { name, fix } of UNREPEATABLE) {
    const [object, method] = name.split('.');
    const pattern = new RegExp(`(?<![.\\w$])${object}\\s*\\.\\s*${method}\\b`, 'g');
    for (const match of bare.matchAll(pattern)) {
      add(match.index, 'unrepeatable', name, `uses "${name}", which makes the simulation unrepeatable; ${fix}`);
    }
  }

  return violations
    .sort((a, b) => a.index - b.index)
    .map(({ line, rule, subject, message }) => ({ line, rule, subject, message }));
}
