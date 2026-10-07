// Checks every data file and reports problems in plain language (PRD requirements 82-84).
//
// Usage: npm run validate                     (checks data/)
//        node tools/validate-data.js <folder>  (checks another data folder, e.g. test fixtures)
// Exits with code 1 if there are errors, so commits and pull requests are blocked.
// Warnings are printed but don't block.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData, formatProblem } from '../src/data/validate.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** Reads a PNG's width and height from its header, or returns null if it isn't a PNG. */
export function pngSize(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Reads a data folder into the { files, images } form that validateData expects. */
export function readDataFolder(dataDir) {
  const files = {};
  const images = {};
  for (const full of listFiles(dataDir)) {
    const relative = path.relative(dataDir, full).split(path.sep).join('/');
    const ext = path.extname(full).toLowerCase();
    if (ext === '.json') {
      files[relative] = fs.readFileSync(full, 'utf8');
    } else if (IMAGE_EXTENSIONS.has(ext)) {
      images[relative] = ext === '.png' ? pngSize(fs.readFileSync(full)) : null;
    }
  }
  return { files, images };
}

function main() {
  const dataDir = path.resolve(process.argv[2] ?? path.join(REPO_ROOT, 'data'));
  const { files, images } = readDataFolder(dataDir);
  const count = Object.keys(files).length;

  if (count === 0) {
    // Until the prototype content exists (task 9.0), an empty data folder is allowed.
    console.log(`Data validation: no data files in ${path.relative(REPO_ROOT, dataDir) || dataDir} yet, nothing to check.`);
    return;
  }

  const { errors, warnings } = validateData({ files, images });

  if (warnings.length > 0) {
    console.log(`Data validation: ${warnings.length} warning(s) (these don't block):`);
    for (const w of warnings) console.log(`  - ${formatProblem(w)}`);
    console.log('');
  }
  if (errors.length > 0) {
    console.error(`Data validation found ${errors.length} problem(s) that must be fixed:`);
    for (const e of errors) console.error(`  - ${formatProblem(e)}`);
    process.exit(1);
  }
  console.log(`Data validation passed (${count} data file(s) checked).`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
