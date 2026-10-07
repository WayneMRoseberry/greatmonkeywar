// Checks every JSON file under data/ and reports problems in plain language.
//
// For now this only checks that each file is valid JSON. Task 2.10 replaces it
// with full validation of every data format (PRD requirements 82-84).
//
// Usage: npm run validate
// Exits with code 1 if any file has a problem, so commits and pull requests are blocked.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findJsonFiles(full);
    return entry.name.toLowerCase().endsWith('.json') ? [full] : [];
  });
}

const files = findJsonFiles(DATA_DIR);
const errors = [];

for (const file of files) {
  const name = path.relative(REPO_ROOT, file).split(path.sep).join('/');
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`${name}: this file is not valid JSON. ${err.message}`);
  }
}

if (errors.length > 0) {
  console.error(`Data validation found ${errors.length} problem(s):\n`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`Data validation passed (${files.length} file(s) checked).`);
