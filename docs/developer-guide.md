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

**Sound in browser mode** is silent until you press a key or click: browsers don't let a page play sound before that. The current screen's music then starts. The F3 overlay's `Sound:` line shows `locked` until then. The Electron app plays sound straight away.

## Running the game as a desktop app (Electron)

```
npm start
```

This opens the game in an Electron window. Electron serves the game's files itself (on an `app://game/` address, with the same rules as `npm run web`), so no web server is needed.

- **Steam:** if Steam is running and logged in, the game connects using Valve's public test app ID, 480 (in `steam_appid.txt`). Press F3 to see the Steam status and your Steam name in the debug overlay. If Steam isn't running, the game still starts, and the terminal says Steam is unavailable.
- **Steam overlay:** Shift+Tab opens it and F12 takes a Steam screenshot. The settings this needs are explained in [steam-overlay.md](steam-overlay.md).
- **steamworks.js** is a native module. If it can't load on your machine, the game runs without Steam and logs why.
- If `npm start` fails with "The requested module 'electron' does not provide an export named 'BrowserWindow'", the environment variable `ELECTRON_RUN_AS_NODE` is set, so Electron is running as plain Node. Tools built on Electron (such as VS Code) can pass it on to programs they start. Clear it (`Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell, `unset ELECTRON_RUN_AS_NODE` in bash) and run `npm start` again.

Things only a person can check (the Steam overlay, gamepads, resizing, cut scenes, sound) are in the [manual test checklist](manual-test-checklist.md).

## Sound

- **How it fits together.** The simulation never plays sound: each step records what happened as `SoundEvent` values (`src/simulation/constants.js`) in the level's and the game flow's `events`. Each frame, the game controller hands that frame's events and the current screen to the audio player (`src/presentation/audio.js`), which decides what music and sounds should play and asks a backend to play them. The real backend (`src/presentation/web-audio.js`) uses the Web Audio API; tests use a recording fake (`tests/helpers/fake-audio.js`), the way drawing tests use the fake canvas.
- **Which sounds play where** is data: `data/config/audio.json`, and the `music`, `completeJingle`, and cut scene `sounds` fields. See [data-formats.md](data-formats.md#audio) and the [sound guide](guide-sound.md).
- **Placeholder sounds.** The files in `data/audio/` are generated tones. To make them again (after changing `tools/make-placeholder-sounds.js`, for example):

  ```
  npm run sounds
  ```

  This overwrites every placeholder file in `data/audio/` (it lists them as it goes). It never deletes other files, but a real sound saved under a placeholder's name would be replaced, so real sounds should have their own names. `node tools/make-placeholder-sounds.js <folder>` writes into another data folder instead. The sounds are built by `tools/sound-synth.js` and encoded as Ogg Vorbis with `wasm-media-encoders`, a dev dependency that only this tool uses.
- **UI checks can't hear.** They read the music file and sound state (`on`, `muted`, or `locked`) from the test hook. Playwright's Chromium never starts sound locked, so the browser lock is covered by unit tests and the manual checklist.

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

UI checks read the game's state through `window.gameTestHook.getState()` (browser mode only) instead of comparing pixels. To wait for something that happens quickly, such as the player leaving the ground, wait inside the page with `page.waitForFunction(...)`, which checks every frame. `expect.poll` asks from outside the page, and on a busy machine the gap between its checks can be longer than a whole jump.

## Quality gates

- **Pre-commit hook:** `.githooks/pre-commit` runs `npm test`. If any test or data check fails, the commit is blocked and the errors are printed. `npm install` installs the hook by setting `git config core.hooksPath .githooks`. UI checks are not run by the hook.
  - **Documentation-only commits skip the tests.** If every staged file is on the documentation list in `tools/docs-only-commit.js` (the `tasks/` folder, `README.md`, and the docs no test reads), the hook says so and lets the commit through without running `npm test`. Any other file, even one, runs the tests as usual. `docs/data-formats.md` and the `guide-*.md` files are not on the list, because `tests/data/schemas.test.js` checks their JSON examples.
  - To add a document to the list, add it to `DOCUMENTATION` in `tools/docs-only-commit.js`. A test (`tests/tools/docs-only-commit.test.js`) fails if any code or test refers to a listed document outside a comment; if you need a test to read one, take it off the list.
  - The pull request check still runs `npm test` on every pull request, documentation-only or not.
- **Pull request check:** `.github/workflows/ci.yml` runs `npm test` on every pull request to `main`. Branch protection on `main` requires it to pass before merging.

## Project layout

| Folder | Contents |
|---|---|
| `src/simulation/` | Game logic. Must run in plain Node: no `window`, `document`, canvas, Electron, or Steam. |
| `src/presentation/` | Rendering, input, HUD, screens, and sound (browser code). |
| `src/platform/` | The platform layer: Electron+Steam, browser, and fake implementations. |
| `src/data/` | Loading and validating data files. |
| `electron/` | Electron main process and preload script. |
| `data/` | Game content: levels, characters, objects, cut scenes, sprites, images, sounds (`data/audio/`), and config. |
| `tools/` | Developer tools: local web server, data validator, hook installer, documentation-only commit check, placeholder sound generator. |
| `tests/` | Unit tests. |
| `tests-ui/` | Playwright UI checks. |
| `docs/` | Requirements and guides. |

`tests/architecture.test.js` enforces two rules on every run of `npm test`:

- code in `src/simulation/` imports only other simulation code, and uses no browser globals, `Math.random`, or clock reads;
- only `electron/` and `src/platform/` may load the `electron` or `steamworks.js` packages, so all Steam and Electron calls go through the platform layer.
