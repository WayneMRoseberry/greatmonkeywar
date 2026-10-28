// Decides whether a commit changes only documentation, so the pre-commit hook
// can skip npm test (.githooks/pre-commit).
//
// Usage: node tools/docs-only-commit.js
// Exits 0 if every staged file is on the documentation list, and 1 otherwise,
// so that any other failure (no Git, a crash) also means "run the tests".
//
// The list names files nothing in npm test reads. docs/data-formats.md and the
// guide-*.md files are not on it: tests/data/schemas.test.js checks their
// JSON examples. tests/tools/docs-only-commit.test.js fails if code or tests
// start referring to a file on the list.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DOCUMENTATION = Object.freeze({
  /** Folders (with a trailing /) whose files are all documentation. */
  folders: Object.freeze(['tasks/']),
  /** Single documentation files, as paths from the repository root. */
  files: Object.freeze([
    'README.md',
    'create-prd.md',
    'generate-tasks.md',
    'docs/requirements.md',
    'docs/developer-guide.md',
    'docs/manual-test-checklist.md',
    'docs/steam-overlay.md',
  ]),
});

const isDocumentation = (file) =>
  DOCUMENTATION.files.includes(file) || DOCUMENTATION.folders.some((folder) => file.startsWith(folder));

/** True if there are staged files (paths from the repository root, with /) and every one is documentation. */
export function isDocumentationOnly(files) {
  return files.length > 0 && files.every(isDocumentation);
}

/** The staged files: added, changed, and deleted, and both sides of a rename. */
function stagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter((file) => file !== '');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(isDocumentationOnly(stagedFiles()) ? 0 : 1);
}
