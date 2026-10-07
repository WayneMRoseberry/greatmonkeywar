// Points Git at the hooks in .githooks/ so the pre-commit hook runs for everyone.
// Runs automatically from the npm "prepare" script after `npm install`.

import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  console.log('install-hooks: not a Git repository, skipping.');
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
console.log('install-hooks: Git hooks installed from .githooks/');
