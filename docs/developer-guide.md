# Developer Guide

How to set up, run, and test Great Monkey War. For what the game must do, see [requirements.md](requirements.md) and the [engine prototype PRD](../tasks/prd-engine-prototype.md).

## Setup

1. Install [Node.js](https://nodejs.org/) 22 or later. npm comes with it.
2. Clone the repository and open a terminal in its folder.
3. Install dependencies:

   ```
   npm install
   ```

   This also turns on the project's Git pre-commit hook (see [Quality gates](#quality-gates)). There is no separate setup step.

4. To run UI checks, also install the browser Playwright uses (one time only):

   ```
   npx playwright install chromium
   ```

## Running the game in a browser (browser mode)

```
npm run web
```

Then open <http://localhost:8765> in Chrome or Edge. Use `PORT=9000 npm run web` (or `$env:PORT=9000; npm run web` in PowerShell) to pick another port.

The game can't be opened by double-clicking `index.html`. Browsers block JavaScript modules and JSON data files on pages opened straight from disk, so a local web server is needed. The server only serves `index.html`, `src/`, and `data/`.

Running the game as an Electron desktop app is added in task 8.0.

## Tests

| Command | What it runs | When it runs automatically |
|---|---|---|
| `npm test` | All unit tests in `tests/`, then data validation | Before every commit, and on every pull request to `main` |
| `npm run validate` | Data validation only (checks every file in `data/`) | As part of `npm test` |
| `npm run test:ui` | Playwright UI checks in `tests-ui/`, against the game in a browser | Never; run it yourself when you need it |

To run a single unit test file:

```
node --test tests/tools/serve.test.js
```

Unit tests use Node's built-in test runner (`node:test`) and `node:assert`. Name test files `*.test.js` and put them in `tests/`, mirroring the `src/` folder they test.

UI checks use [Playwright](https://playwright.dev/). `npm run test:ui` starts its own web server on port 8766, so `npm run web` doesn't need to be running. After a failure, `npx playwright show-report` shows details.

## Quality gates

- **Pre-commit hook:** `.githooks/pre-commit` runs `npm test`. If any test or data check fails, the commit is blocked and the errors are printed. `npm install` installs the hook by setting `git config core.hooksPath .githooks`. UI checks are not run by the hook.
- **Pull request check:** `.github/workflows/ci.yml` runs `npm test` on every pull request to `main`. Branch protection on `main` requires it to pass before merging.

## Project layout

| Folder | Contents |
|---|---|
| `src/simulation/` | Game logic. Must run in plain Node: no `window`, `document`, canvas, Electron, or Steam. |
| `src/presentation/` | Rendering, input, HUD, and screens (browser code). |
| `src/platform/` | The platform layer: Electron+Steam, browser, and fake implementations. |
| `src/data/` | Loading and validating data files. |
| `electron/` | Electron main process and preload script. |
| `data/` | Game content: levels, characters, objects, cut scenes, sprites, images, and config. |
| `tools/` | Developer tools: local web server, data validator, hook installer. |
| `tests/` | Unit tests. |
| `tests-ui/` | Playwright UI checks. |
| `docs/` | Requirements and guides. |
