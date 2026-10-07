# Tasks: Engine Prototype

Source: [prd-engine-prototype.md](prd-engine-prototype.md). "Req N" refers to the PRD's numbered functional requirements.

## Relevant Files

**Project and tooling**
- `package.json` - npm scripts (`test`, `test:ui`, `validate`, `web`, `start`), dependencies, and the `prepare` script that installs the pre-commit hook.
- `.githooks/pre-commit` - Runs unit tests and data validation before each commit.
- `tools/install-hooks.js` - Run by `npm install` (the `prepare` script); points Git at `.githooks/`.
- `.gitattributes` - Keeps hook files with LF line endings so they run on every platform.
- `.github/workflows/ci.yml` - Runs unit tests and data validation on pull requests to `main`.
- `playwright.config.js` - Playwright settings; starts the browser-mode web server for UI checks.
- `tools/serve.js` - Small local web server for browser mode.
- `tools/validate-data.js` - Command-line data validator.
- `.gitignore` - Ignores `node_modules/`, Playwright reports, and build output.

**Simulation (pure game logic; runs in Node)**
- `src/simulation/constants.js` - Fixed time step and shared constants.
- `src/simulation/state.js` - Creates the initial game state from loaded data; resets a level.
- `src/simulation/step.js` - The single `step(state, input, dt)` update function.
- `src/simulation/collision.js` - AABB collision against tiles and resting stackable objects.
- `src/simulation/player.js` - Running, jumping, health, damage, knockback, invincibility, pits.
- `src/simulation/objects.js` - Pick up, drop, throw, stacking, objects falling when support is removed.
- `src/simulation/punch.js` - Punch area, damage, and rules.
- `src/simulation/enemies.js` - Patrol, turning at edges, stomp, being hit.
- `src/simulation/rewards.js` - Collecting reward items.
- `src/simulation/flow.js` - Screens and progression: start screen, playing, level complete, cut scene, exit.
- `src/simulation/cutscene.js` - Pure function that computes cut scene state from elapsed time.
- `src/simulation/camera.js` - Camera follow, level bounds, centring, visible area from window size.
- `src/simulation/parallax.js` - Parallax layer offsets.

**Data loading and validation**
- `src/data/load.js` - Loads all JSON data (browser: `fetch`; Node: file system) and runs validation.
- `src/data/validate.js` - Shared validation rules and plain-language error messages, used by the tool and the game.
- `src/data/schemas/` - JSON Schemas for each data file type.
- `docs/data-formats.md` - Developer specification of every data format; the source for the schemas and validator.

**Presentation (browser)**
- `index.html` - Page with the single `<canvas>`.
- `src/presentation/main.js` - Entry point: loads data, picks the platform implementation, starts the game loop.
- `src/presentation/loop.js` - Fixed-time-step loop with `requestAnimationFrame`.
- `src/presentation/input.js` - Keyboard and gamepad reading, translated into the input state.
- `src/presentation/input-map.js` - Pure function: raw device input + bindings → input state (unit-tested).
- `src/presentation/renderer.js` - Draws tiles, entities, parallax layers, and the punch flash.
- `src/presentation/sprites.js` - Sprite sheet loading, animation frames, and shape fallback.
- `src/presentation/hud.js` - Health and reward count.
- `src/presentation/screens.js` - Start screen, level-complete screen, "Thanks for playing", and data error screen.
- `src/presentation/cutscene-view.js` - Draws cut scene background, actors, and narration.
- `src/presentation/debug-overlay.js` - F3 debug overlay.
- `src/presentation/test-hook.js` - Read-only `window.gameTestHook` for UI checks (browser mode only).

**Platform layer and Electron**
- `src/platform/platform.js` - The platform interface and a description of each method.
- `src/platform/fake-platform.js` - Fake implementation for tests.
- `src/platform/browser-platform.js` - Browser-mode implementation.
- `src/platform/electron-platform.js` - Page-side implementation that calls the preload bridge.
- `electron/main.js` - Electron main process: window, Steam initialisation, overlay settings, quit.
- `electron/preload.js` - Exposes the platform bridge to the page safely.
- `steam_appid.txt` - Contains `480` for development.

**Data (content)**
- `data/levels/levels.json` - Level list (order).
- `data/levels/level1.json`, `data/levels/level2.json` - The two prototype levels.
- `data/characters/player.json`, `data/characters/<enemy>.json` - Character definitions.
- `data/objects/crate.json`, `data/objects/coconut.json` - Object definitions (crate is stackable).
- `data/cutscenes/after-level1.json` - The prototype cut scene.
- `data/sprites/player.png`, `data/sprites/player.json` - Placeholder player sprite sheet.
- `data/images/` - Background layer images and the cut scene background.
- `data/config/tuning.json`, `data/config/bindings.json`, `data/config/display.json` - Tuning, bindings, and display settings.

**Tests**
- `tests/simulation/*.test.js` - Unit tests for each simulation module.
- `tests/presentation/input-map.test.js` - Unit tests for input translation.
- `tests/data/validate.test.js` - Unit tests for every validation error type.
- `tests/data/schemas.test.js` - Checks each schema is valid JSON Schema (via Ajv, a test-only dependency), uses only supported keywords, and accepts every example in `docs/data-formats.md`.
- `tests/data/fixtures/` - Small valid and broken data files used by tests.
- `tests/helpers/` - Helpers for building small test levels and stepping the simulation.
- `tests-ui/smoke.spec.js` - Playwright UI check: the page loads without errors and the canvas fills the window.
- `tests-ui/movement.spec.js` - Playwright UI check: left, right, jump.
- `tests/tools/serve.test.js` - Unit tests for the browser-mode web server.

**Docs**
- `docs/guide-levels.md` - Level format guide for designers.
- `docs/guide-characters-objects.md` - Character and object definition guide.
- `docs/guide-cutscenes.md` - Cut scene format guide.
- `docs/guide-sprites.md` - Sprite sheet guide for artists.
- `docs/steam-overlay.md` - Overlay settings and why each is needed.
- `docs/manual-test-checklist.md` - Manual checks.
- `docs/developer-guide.md` - How to install, run, test, and use browser mode.

### Notes

- Unit tests live in `tests/`, mirroring the `src/` folder structure, as the PRD's suggested layout specifies. Playwright UI checks live in `tests-ui/`.
- Run all unit tests and data validation with `npm test`. Run one test file with `node --test tests/simulation/player.test.js`.
- Run UI checks with `npm run test:ui`. They are not part of `npm test` and do not run in the pre-commit hook.
- Simulation code must never import from `src/presentation/`, `src/platform/`, or `electron/`, and must not use `window`, `document`, or other browser APIs.
- Prefer writing the unit test first for each simulation behaviour. The `step` function makes this easy: build a small level, give inputs, step N times, check state.
- Task 10.5 (branch protection) changes GitHub repository settings and needs a repository admin.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and check out a new branch from `main`: `git checkout -b feature/engine-prototype`
- [x] 1.0 Set up the project, test tooling, and quality gates
  - [x] 1.1 Create `package.json` with `"type": "module"` and a Node version in `engines` (current LTS). Add `.gitignore`.
  - [x] 1.2 Create the folder structure from the PRD's Technical Considerations (`src/simulation`, `src/presentation`, `src/platform`, `src/data`, `electron`, `data/...`, `tools`, `tests`, `tests-ui`, `docs`).
  - [x] 1.3 Set up `npm test` to run Node's built-in test runner on `tests/` and then the data validator (req 88). Add a trivial passing test to prove it works.
  - [x] 1.4 Write `tools/serve.js`, a small dependency-free static web server, and add `npm run web` (browser mode, PRD Technical Considerations).
  - [x] 1.5 Add a minimal `index.html` and `src/presentation/main.js` that draw a coloured rectangle on a full-window canvas, to prove browser mode works through `npm run web`.
  - [x] 1.6 Install Playwright (`@playwright/test`) and a Chromium browser. Create `playwright.config.js` that starts `tools/serve.js` automatically. Add `npm run test:ui` (req 93).
  - [x] 1.7 Add a pre-commit hook (Husky, or a `.githooks/` folder plus `git config core.hooksPath` in the `prepare` script) that runs `npm test` and blocks the commit on failure (reqs 89–90). Confirm it does **not** run UI checks.
  - [x] 1.8 Confirm the hook installs automatically on a fresh clone after `npm install`.
  - [x] 1.9 Create `.github/workflows/ci.yml` that runs `npm ci` and `npm test` on every pull request to `main` (req 91).
  - [x] 1.10 Write the first version of `docs/developer-guide.md`: install, `npm test`, `npm run web`, `npm run test:ui`.
- [ ] 2.0 Define the data formats and build the data validator
  - [x] 2.1 Design the level format: tile grid as an array of strings, a tile legend, player start, goal, entity placements (enemies, objects, rewards), background layers with scroll factors, background fill colour, and an optional cut scene name (reqs 57, 61, 68, 73, 75).
  - [x] 2.2 Design the level list format (req 55).
  - [x] 2.3 Design the character definition format: size, health, speed, colour, sprite, and punch damage for the player (reqs 24, 40, 73).
  - [x] 2.4 Design the object definition format: size, colour, sprite, and `stackable` (reqs 28, 35).
  - [x] 2.5 Design the cut scene format: background image, actors (sprite, animation, list of timed moves), and narration lines with start and end times (req 62).
  - [x] 2.6 Design the sprite sheet format: image file, frame width and height, named animations with frame lists and speed (req 77).
  - [x] 2.7 Design `tuning.json`, `bindings.json` (keyboard and gamepad, including punch and skip), and `display.json` (visible world height, stick dead zone) (reqs 16–17, 73).
  - [x] 2.8 Write a JSON Schema for each format in `src/data/schemas/`.
  - [ ] 2.9 Write `src/data/validate.js`: schema checks plus custom checks for every case in req 83. Rewrite every error into a plain-language message with file name and location (req 84). It must work in both Node and the browser, so it must not touch the file system itself.
  - [ ] 2.10 Write `tools/validate-data.js`, which reads all files under `data/`, runs `validate.js`, prints all errors, and exits non-zero on any error (req 82).
  - [ ] 2.11 Create test fixtures in `tests/data/fixtures/`: one valid set and one broken file for each error type in req 83.
  - [ ] 2.12 Write `tests/data/validate.test.js` covering every error type and checking the message wording (req 87).
  - [ ] 2.13 Write `src/data/load.js`, which loads all data in the browser with `fetch`, runs the same validation, and returns either the data or a list of errors (req 85).
  - [ ] 2.14 Write the designer and artist guides: `guide-levels.md`, `guide-characters-objects.md`, `guide-cutscenes.md`, and `guide-sprites.md`, each with an annotated example, for readers who have never seen JSON (reqs 74, 80).
- [ ] 3.0 Build the simulation core: time step, collision, player movement, and health
  - [ ] 3.1 Create `tests/helpers/` with a helper to build a tiny level from a few strings and a helper to step the simulation N times with given inputs.
  - [ ] 3.2 Write `src/simulation/state.js`: build the initial game state from loaded data, and keep a snapshot of the level's starting state for restarts (req 27).
  - [ ] 3.3 Write `src/simulation/step.js` with `step(state, input, dt)`, using the fixed time step from `constants.js` (reqs 5, 72).
  - [ ] 3.4 Write `src/simulation/collision.js`: AABB against the tile grid, resolving X then Y, returning whether the entity is on the ground. Design it so resting stackable objects can be added as extra solid boxes later (task 4.0).
  - [ ] 3.5 Implement running left and right with speed from data (req 20). Test it.
  - [ ] 3.6 Implement jumping with jump strength and gravity from data, and no double jump (reqs 21–22). Test it.
  - [ ] 3.7 Implement collision with walls, floors, and ceilings (req 23). Test landing, hitting a wall, and bumping a ceiling.
  - [ ] 3.8 Implement player health from the character definition, damage, knockback, and invincibility time (reqs 24–25). Test each.
  - [ ] 3.9 Implement falling into a pit: lose 1 health and respawn at the start point (req 26). Test it.
  - [ ] 3.10 Implement level restart when health reaches 0, restoring the level's starting state including health and reward count (req 27). Test it.
  - [ ] 3.11 Implement facing direction (left or right), needed for throwing and punching.
- [ ] 4.0 Build objects and stacking: pick up, drop, throw, stack, and rewards
  - [ ] 4.1 Load carriable objects from level placements and object definitions (req 28).
  - [ ] 4.2 Implement pick up with **action** when touching an object and empty-handed. The held object follows above the player's head. Only one object at a time (reqs 29–30). Test it.
  - [ ] 4.3 Implement throw with **action** while holding: an arc in the facing direction with throw speed from data (req 31). Test it.
  - [ ] 4.4 Implement drop with **down + action** at the player's feet (req 32). Test it.
  - [ ] 4.5 Implement object gravity and collision with tiles so objects come to rest (req 34). Test it.
  - [ ] 4.6 Implement stacking: stackable objects at rest become solid boxes in `collision.js` for objects, the player, and enemies (req 35). Test objects landing on a stack and the player standing and jumping on a stack.
  - [ ] 4.7 Implement objects falling when the object under them is picked up (req 36). Test it.
  - [ ] 4.8 Prevent picking up the object the player is standing on (req 37). Test it.
  - [ ] 4.9 Implement reward collection: the item disappears and the count increases by its value (reqs 42–43). Test it.
- [ ] 5.0 Build enemies and punching
  - [ ] 5.1 Load enemies from level placements and character definitions, including health (reqs 40, 48).
  - [ ] 5.2 Implement patrol with gravity and collision, turning at walls and at the edges of platforms and stacks (reqs 49–50). Test turning at a wall, a platform edge, and a stack edge, and walking on a stack.
  - [ ] 5.3 Implement contact damage when the player touches an enemy from the side or below (req 51). Test it.
  - [ ] 5.4 Implement stomping: landing on an enemy while falling defeats it regardless of health and bounces the player (req 52). Test it.
  - [ ] 5.5 Implement a thrown object defeating an enemy, then falling so it can be picked up again (req 33). Test it.
  - [ ] 5.6 Write `src/simulation/punch.js`: one punch per press, in the facing direction. The punch area runs from the player's body to the outer edge of the player's sprite frame (or shape when there is no sprite) (reqs 38–39). Test reach, including an enemy just inside and just outside it.
  - [ ] 5.7 Apply punch damage from the player's definition to enemy health; defeat at 0 (req 40). Test with damage 1 and health 1, and with health greater than damage.
  - [ ] 5.8 Block punching while carrying an object (req 41). Test it.
  - [ ] 5.9 Resolve a punch before contact damage in the same update (req 51). Test it.
  - [ ] 5.10 Remove defeated enemies, with an optional short defeat state for a flash (req 53).
- [ ] 6.0 Build game flow: start screen, level completion, progression, and cut scenes (simulation side)
  - [ ] 6.1 Write `src/simulation/flow.js` with screens as states: start, playing, level complete, cut scene, finished (exit).
  - [ ] 6.2 Implement the start screen: confirm on Start begins the first level in the level list (req 56). Test it.
  - [ ] 6.3 Implement reaching the goal: gameplay stops and the level-complete state offers Next level and Exit game, or only Exit game on the last level (req 58). Test both cases.
  - [ ] 6.4 Implement menu selection with up, down, and confirm in the input state (req 19).
  - [ ] 6.5 Implement Next level: play the completed level's cut scene if it has one, then load the next level, carrying over health and reward count (req 59). Test with and without a cut scene.
  - [ ] 6.6 Implement Exit game as a "finished" state that the presentation hands to the platform layer's quit (req 60).
  - [ ] 6.7 Write `src/simulation/cutscene.js`: given a cut scene and elapsed time, return each actor's position and animation, the narration lines to show, and whether it has ended (reqs 62–63). Test positions part way through a move, narration timing, and the end.
  - [ ] 6.8 Implement skipping a cut scene with confirm (req 63). Test it.
- [ ] 7.0 Build the presentation layer
  - [ ] 7.1 Write `src/presentation/loop.js`: a `requestAnimationFrame` loop that runs as many fixed time steps as have elapsed, then draws once (reqs 4–5).
  - [ ] 7.2 Write the visible-area function in `src/simulation/camera.js`: from window size and the visible world height, compute scale and visible world width (req 6). Test several window sizes and aspect ratios.
  - [ ] 7.3 Size the canvas to the window in device pixels and redraw on resize and fullscreen changes (req 6).
  - [ ] 7.4 Implement camera follow, level bounds, and centring of small levels in `camera.js` (reqs 66–67). Test it.
  - [ ] 7.5 Write `src/simulation/parallax.js` for layer offsets from camera position and scroll factor, with horizontal repeating (reqs 68, 70). Test it. Draw the layers in the renderer.
  - [ ] 7.6 Write `renderer.js` to draw tiles, the player, enemies, objects, rewards, and the goal as coloured shapes from data (req 76). Add the punch flash and the invincibility flash.
  - [ ] 7.7 Write `sprites.js`: load sprite sheets, pick animation frames, and fall back to shapes with a logged warning when a sprite is missing (reqs 77, 79). Use it for the player's idle and run animations (req 78).
  - [ ] 7.8 Write `input-map.js` as a pure function from raw keyboard and gamepad input plus bindings to the input state, including the stick dead zone (reqs 14–18). Write `tests/presentation/input-map.test.js`.
  - [ ] 7.9 Write `input.js`: track keyboard keys and poll the Gamepad API each frame using the standard mapping, then call `input-map.js`.
  - [ ] 7.10 Write `hud.js` for health and reward count, anchored to a corner and readable at any size (req 44).
  - [ ] 7.11 Write `screens.js` for the start screen, the level-complete panel, "Thanks for playing", and the data error screen (reqs 7, 56, 58, 85).
  - [ ] 7.12 Write `cutscene-view.js` to draw the background, actors (sprite animations), the narration text box, and the skip hint, scaled like the game (reqs 62, 65).
  - [ ] 7.13 Write `debug-overlay.js` (F3), showing everything listed in the PRD's Design Considerations, including Steam status from the platform layer (req 10).
  - [ ] 7.14 Add F11 fullscreen through the platform layer (req 2).
  - [ ] 7.15 Write `test-hook.js`: in browser mode only, expose read-only `window.gameTestHook.getState()` returning a copy of the current screen, player position, velocity, and on-ground flag (req 94).
  - [ ] 7.16 Wire it all together in `main.js`: load and validate data, show errors on screen if invalid, pick the platform implementation, and start the loop.
- [ ] 8.0 Build the platform layer and the Electron host with Steam
  - [ ] 8.1 Write `src/platform/platform.js` describing the interface: `getSteamStatus()`, `getSteamUserName()`, `toggleFullscreen()`, `quit()` (req 71).
  - [ ] 8.2 Write `fake-platform.js` for tests and `browser-platform.js` for browser mode. In browser mode, Steam is unavailable, fullscreen uses the browser's fullscreen feature, and quit shows "Thanks for playing" (req 7).
  - [ ] 8.3 Install Electron. Write `electron/main.js` to open a window that loads `index.html`, with `contextIsolation` on and `nodeIntegration` off. Add `npm start`.
  - [ ] 8.4 Write `electron/preload.js` to expose only the platform methods to the page, and `electron-platform.js` to call them.
  - [ ] 8.5 Install steamworks.js and add `steam_appid.txt` containing `480`. Initialise Steam in the main process. If it fails, log a clear message and continue (reqs 8–9).
  - [ ] 8.6 Return the Steam user's display name through the platform layer and show it in the debug overlay (req 10).
  - [ ] 8.7 Enable the Steam overlay using the steamworks.js Electron helper and required Chromium flags. Confirm Shift+Tab opens it and F12 takes a screenshot (req 11).
  - [ ] 8.8 Measure FPS with the overlay settings on, using the debug overlay (req 12).
  - [ ] 8.9 Write `docs/steam-overlay.md`: each setting and why it is needed, plus the FPS results (req 12).
  - [ ] 8.10 Confirm the game still runs when Steam is closed (req 9).
  - [ ] 8.11 Search the code to confirm that only `electron/` and `src/platform/` reference steamworks.js or Electron (req 13).
- [ ] 9.0 Create the prototype content
  - [ ] 9.1 Create `tuning.json`, `bindings.json` (defaults from the PRD's bindings table), and `display.json`.
  - [ ] 9.2 Create `player.json` (health 3, punch damage 1) and one enemy definition (health 1).
  - [ ] 9.3 Create object definitions: a stackable crate and a non-stackable throwable (for example a coconut).
  - [ ] 9.4 Create a simple placeholder player sprite sheet (`player.png` and `player.json`) with idle and run animations (req 78).
  - [ ] 9.5 Create at least three background layer images per level (simple placeholders are fine) (req 69).
  - [ ] 9.6 Build `level1.json`: pits, a jump obstacle, enemies, crates to stack to reach something, rewards, a goal, and the cut scene name (reqs 45–47, 61).
  - [ ] 9.7 Build `level2.json` with the same elements in a different layout (req 54).
  - [ ] 9.8 Create `levels.json` listing level 1 then level 2 (req 55).
  - [ ] 9.9 Create `after-level1.json`: a background image, at least one animated actor, and several narration lines (reqs 62, 64).
  - [ ] 9.10 Run `npm test` to confirm all content passes validation.
- [ ] 10.0 Verify, automate the UI check, and finish documentation
  - [ ] 10.1 Write `tests-ui/movement.spec.js`: start the game with Enter, then hold Right, Left, and Jump, and confirm through `gameTestHook` that the player moved right, moved left, and left the ground and landed (req 93).
  - [ ] 10.2 Run `npm run test:ui` and confirm it passes.
  - [ ] 10.3 Write `docs/manual-test-checklist.md`: Steam overlay and F12, gamepad play, window resizing and fullscreen, browser mode, and cut scene playback (req 95).
  - [ ] 10.4 Run the manual test checklist and record the results.
  - [ ] 10.5 Ask a repository admin to turn on branch protection for `main`, requiring the CI workflow to pass (req 92). Confirm a pull request with a failing test cannot be merged.
  - [ ] 10.6 Confirm a commit with a failing test or a broken data file is blocked by the pre-commit hook.
  - [ ] 10.7 Ask someone who does not write code to follow the guides to add an enemy, reward, stackable crate, and platform, and to change a cut scene narration line. Fix the guides wherever they get stuck (Success Metric 6).
  - [ ] 10.8 Walk through every success metric in PRD Section 8 and note any gaps.
  - [ ] 10.9 Update `docs/developer-guide.md` with anything learned, then open a pull request to `main`.
