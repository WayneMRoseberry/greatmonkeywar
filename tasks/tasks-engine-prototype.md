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
- `tools/architecture.js` - Checks source files against the architecture rules; used by `tests/architecture.test.js`.
- `.gitignore` - Ignores `node_modules/`, Playwright reports, and build output.

**Simulation (pure game logic; runs in Node)**
- `src/simulation/constants.js` - Fixed time step and shared constants (`Facing`, `LegendKind`, `LegendField`, `CharacterKind`).
- `src/simulation/numbers.js` - Small number helpers shared by simulation modules (`withoutNegativeZero`).
- `src/simulation/input.js` - The input state: `Input` names, `NO_INPUT`, `createInput()`, `holding()`. The one definition used by the simulation, the input translation (task 7.9), and tests.
- `src/simulation/state.js` - Creates the initial game state from loaded data; resets a level.
- `src/simulation/step.js` - The single `step(state, input, dt)` update function.
- `src/simulation/collision.js` - AABB collision against tiles and resting stackable objects.
- `src/simulation/player.js` - The `Player` class (the one declaration of the player's properties, sealed so unknown properties throw), and running, jumping, health, damage, knockback, invincibility, pits.
- `src/simulation/objects.js` - The `CarriableObject` class (sealed, like `Player`), and pick up, drop, throw, stacking, objects falling when support is removed.
- `src/simulation/punch.js` - Punch area, damage, and rules.
- `src/simulation/enemies.js` - Patrol, turning at edges, stomp, being hit.
- `src/simulation/rewards.js` - Collecting reward items.
- `src/simulation/flow.js` - Screens and progression: start screen, playing, level complete, cut scene, exit.
- `src/simulation/cutscene.js` - Pure function that computes cut scene state from elapsed time.
- `src/simulation/camera.js` - Camera follow, level bounds, centring, visible area from window size.
- `src/simulation/parallax.js` - Parallax layer offsets.

**Data loading and validation**
- `src/data/load.js` - Loads all JSON data (browser: `fetch`; Node: file system) and runs validation.
- `src/data/validate.js` - Shared validation rules, used by the tool and the game. Each problem has a `code` and `details`; `describeProblem(code, details)` holds all the plain-language wording in one table.
- `src/data/schema-check.js` - Small JSON Schema checker (supported keywords only) so validation runs in the browser without npm packages.
- `src/data/schemas/` - JSON Schemas for each data file type.
- `docs/data-formats.md` - Developer specification of every data format; the source for the schemas and validator.

**Presentation (browser)**
- `index.html` - Page with the single `<canvas>`.
- `src/presentation/main.js` - Start-up glue only: loads data, picks the platform implementation, creates the game, starts the loop.
- `src/presentation/game.js` - Game controller: input → simulation step → draw; presentation-only keys (F3, F11); quit through the platform.
- `src/presentation/loop.js` - Fixed-time-step loop, with the clock and frame scheduler passed in.
- `src/presentation/canvas-size.js` - Sizes the canvas to the window in device pixels.
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
- `electron/main.js` - Electron main process start-up glue: applies overlay settings, starts Steam, opens the window.
- `electron/window-options.js` - The game window's settings (security options, preload, page).
- `electron/steam.js` - Steam start-up and user name, with the steamworks.js module passed in.
- `electron/overlay.js` - Steam overlay settings, with Electron's `app` passed in.
- `electron/preload.js` - Preload glue: exposes the bridge built by `preload-api.js`.
- `electron/preload-api.js` - Builds the bridge object exposing only the platform methods.
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
- `tests/architecture.test.js` - Guard: simulation code stays pure; only `electron/` and `src/platform/` touch Electron or Steam.
- `tests/simulation/*.test.js` - Unit tests for each simulation module.
- `tests/presentation/*.test.js` - Unit tests for each presentation module, using the fake canvas and fake input.
- `tests/platform/*.test.js` - Platform contract test and tests for each platform implementation.
- `tests/electron/*.test.js` - Unit tests for the Electron and Steam modules, with fake `electron` and steamworks.js.
- `tests/helpers/fake-canvas.js` - Recording fake canvas context for testing drawing code.
- `tests/helpers/random.js` - Seeded random numbers, so randomised tests are repeatable.
- `tests/simulation/collision-properties.test.js` - Randomised check: thousands of random boxes and moves must all obey the collision rules (seed overridable with `COLLISION_SEED`).
- `tests/data/validate.test.js` - Unit tests for every validation error type.
- `tests/data/load.test.js` - Unit tests for the data loader, with file and image loading replaced by fixture readers.
- `tests/data/schemas.test.js` - Checks each schema is valid JSON Schema (via Ajv, a test-only dependency), uses only supported keywords, and accepts every example in `docs/data-formats.md`.
- `tests/data/fixtures/valid/` - A small, complete, valid data set (including tiny PNGs). Validator tests break one thing in it at a time, in memory, rather than keeping a separate broken file per case.
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
- All code is written test-first. See [Development approach: TDD](#development-approach-tdd-redgreen).
- Task 10.5 (branch protection) changes GitHub repository settings and needs a repository admin.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Development approach: TDD (red/green)

Every sub-task that creates or changes code is done test-first, in a red/green/refactor cycle. This applies to all code: `src/`, `electron/`, and `tools/`, including test helpers.

Each code sub-task below names:
- **Test:** the test file the cycle starts in, and what the tests check;
- **Code:** the file or files the cycle creates or changes.

### The cycle, for each sub-task

1. **Red.** Write the tests named under **Test** for the behaviour the sub-task adds. Run them (`node --test <test file>`) and confirm they **fail, and fail for the expected reason**: an assertion about the missing behaviour, not a typo or import error. If a module doesn't exist yet, first create it with empty exports so the failure is a real assertion failure.
2. **Green.** Write the **least** code that makes those tests pass. Run the test file, then `npm test`, and confirm everything passes.
3. **Refactor.** Tidy the code and tests while keeping everything green. Run `npm test` again.
4. **Report.** When the sub-task is done, show its tests and the code they cover **together**, with the red result (the failing run) and the green result (the passing run). Then check the sub-task off.

### Code that touches the browser, Electron, or Steam

Canvas drawing, keyboard and gamepad events, `requestAnimationFrame`, `window`, Electron, and steamworks.js aren't available in Node's test runner. Write that code so those things are **passed in as parameters**, then test it with fakes:
- drawing code takes a canvas context, so tests use a recording fake context (`tests/helpers/fake-canvas.js`) and check what was drawn;
- input code takes an event target and a `getGamepads` function, so tests use fake events and fake gamepads;
- the game loop takes a clock and a frame scheduler, so tests control time;
- Electron and Steam code takes the `electron` and `steamworks.js` modules (or the parts it uses), so tests use fakes.

This leaves only thin start-up **glue** that can't run in Node: `src/presentation/main.js`, `electron/main.js`, and `electron/preload.js`. Keep it to a few lines of wiring with no logic. For `main.js`, the red step is a Playwright UI check (`tests-ui/`), run with `npm run test:ui`. For the Electron glue, it's a launch check recorded in the manual test checklist.

### Sub-tasks with no code

Sub-tasks that only produce documents, data content, measurements, manual checks, or repository settings are marked **(no code)** and don't use the cycle. Data content is still checked by `npm test`, through data validation.

### Tasks 1.0 and 2.0

These were completed before this approach was adopted: their tests were written alongside the code rather than first. They are not being redone.

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
- [x] 2.0 Define the data formats and build the data validator
  - [x] 2.1 Design the level format: tile grid as an array of strings, a tile legend, player start, goal, entity placements (enemies, objects, rewards), background layers with scroll factors, background fill colour, and an optional cut scene name (reqs 57, 61, 68, 73, 75).
  - [x] 2.2 Design the level list format (req 55).
  - [x] 2.3 Design the character definition format: size, health, speed, colour, sprite, and punch damage for the player (reqs 24, 40, 73).
  - [x] 2.4 Design the object definition format: size, colour, sprite, and `stackable` (reqs 28, 35).
  - [x] 2.5 Design the cut scene format: background image, actors (sprite, animation, list of timed moves), and narration lines with start and end times (req 62).
  - [x] 2.6 Design the sprite sheet format: image file, frame width and height, named animations with frame lists and speed (req 77).
  - [x] 2.7 Design `tuning.json`, `bindings.json` (keyboard and gamepad, including punch and skip), and `display.json` (visible world height, stick dead zone) (reqs 16–17, 73).
  - [x] 2.8 Write a JSON Schema for each format in `src/data/schemas/`.
  - [x] 2.9 Write `src/data/validate.js`: schema checks plus custom checks for every case in req 83. Rewrite every error into a plain-language message with file name and location (req 84). It must work in both Node and the browser, so it must not touch the file system itself.
  - [x] 2.10 Write `tools/validate-data.js`, which reads all files under `data/`, runs `validate.js`, prints all errors, and exits non-zero on any error (req 82).
  - [x] 2.11 Create test fixtures in `tests/data/fixtures/`: one valid set and one broken file for each error type in req 83.
  - [x] 2.12 Write `tests/data/validate.test.js` covering every error type and checking the message wording (req 87).
  - [x] 2.13 Write `src/data/load.js`, which loads all data in the browser with `fetch`, runs the same validation, and returns either the data or a list of errors (req 85).
  - [x] 2.14 Write the designer and artist guides: `guide-levels.md`, `guide-characters-objects.md`, `guide-cutscenes.md`, and `guide-sprites.md`, each with an annotated example, for readers who have never seen JSON (reqs 74, 80).
  - [x] 2.15 Validator check that the player fits at each level's start, so designers see the problem when running `npm run validate` instead of only when the game builds the level. `createLevelState` already refuses to build such a level (`LevelDataError`, "fitting the player at the start"); this reports the same problem earlier, in plain language.
    - Test: `tests/data/validate.test.js`: a player too tall for the space at the start (head inside a ceiling), too wide (inside walls beside it), and one that exactly fits (no error). The error names the level, the player's size, and the overlapping tile's row and column. Plus a wording test for the new problem code.
    - Code: `src/data/validate.js`. Reuse the simulation's placement rule (bottom-centre on the start cell) and `overlapsSolid` (`src/simulation/collision.js`) rather than writing them a second time, so the validator and the game can't disagree. Data code may import from the simulation (the architecture guard only restricts the other direction).
- [x] 3.0 Build the simulation core: time step, collision, player movement, and health
  - [x] 3.1 Architecture guard: simulation code must not import presentation, platform, or Electron code, or use browser globals (`window`, `document`, `requestAnimationFrame`, `Image`, `fetch`) (req 71).
    - Test: `tests/architecture.test.js`. For the red step, temporarily add a forbidden import to a stub simulation file and confirm the test fails; then remove it.
    - Code: `tools/architecture.js` (the checker, unit-tested with source samples). Simulation files may only import other simulation files, and may not use `Math.random`, `Date.now`, or `performance.now` (determinism).
  - [x] 3.2 Test helpers: build a tiny level from a few grid strings (with default definitions and tuning), and step the simulation N times with given inputs.
    - Test: `tests/helpers/helpers.test.js`: a level built from `["P.G", "###"]` has the right size, start, and goal; the runner calls `step` exactly N times with the given input.
    - Code: `tests/helpers/level-builder.js`, `tests/helpers/run.js`
  - [x] 3.3 Initial state from loaded data: level size, tiles, player at the start cell (bottom-centre placement), health from the player definition, and a separate snapshot of the level's starting state (req 27).
    - Test: `tests/simulation/state.test.js`
    - Code: `src/simulation/state.js`
  - [x] 3.4 `step(state, input, dt)` with the fixed time step: returns the next state, doesn't change the state passed in, advances time, and gives identical results for identical inputs (reqs 5, 72).
    - Test: `tests/simulation/step.test.js`
    - Code: `src/simulation/step.js`, `src/simulation/constants.js`
  - [x] 3.5 Tile collision: moving a box into a wall stops it flush, landing sets on-ground, hitting a ceiling stops upward movement, X is resolved before Y, the level's side edges act as walls, the top is open, and extra solid boxes can be passed in (for stacking later).
    - Test: `tests/simulation/collision.test.js`
    - Code: `src/simulation/collision.js`
  - [x] 3.6 Running left and right at the speed from the player definition, stopping when no direction is held (req 20).
    - Test: `tests/simulation/player.test.js` ("running")
    - Code: `src/simulation/player.js`, `src/simulation/step.js`
  - [x] 3.7 Facing direction: the player faces the direction they're trying to run (the held input, not the actual movement), and keeps facing that way when neither or both directions are held (needed for throwing and punching).
    - Test: `tests/simulation/player.test.js` ("facing")
    - Code: `src/simulation/player.js`
  - [x] 3.8 Sideways collision for the player: running moves the player through `moveBox` (collision.js), so walls and the level's left and right edges stop them (req 23). This comes before jumping because jumping needs the player to stand on something.
    - Test: `tests/simulation/player.test.js` ("walls and edges"). The player-level tests show the player *uses* `moveBox` correctly; the collision details themselves are already covered by `collision.test.js`. Cases, comparing the distance to a wall *d* with one step's move *m = speed × dt*:
      - *m < d*: moves the full amount; no hit;
      - *m = d*: arrives exactly touching the wall; not a hit;
      - *m > d*: stops flush against the wall, never past it;
      - *m* several tiles larger than *d* (a large `dt` passed to `step`): still stops at the first wall, with no passing through;
      - *d = 0* (already touching) while pushing into the wall: doesn't move;
      - the same cases at the level's left and right edges;
      - running into a wall to the left and to the right;
      - pushing into a wall keeps the player facing the wall, though they don't move (facing follows the held input, task 3.7).
    - Rule to decide and test: when a wall stops the player, `vx` becomes 0 for that step (pushing but not moving), so later animation shows idle rather than running.
    - Code: `src/simulation/player.js`
  - [x] 3.9 Gravity, jumping, and vertical collision (decided: a jump needs a new press; holding jump through a landing doesn't jump again, matching the PRD's punch rule): gravity, jump speed, and maximum fall speed from tuning; landing on the ground sets `onGround`; jumping only from the ground (no double jump); hitting a ceiling stops upward movement (reqs 21–23).
    - Test: `tests/simulation/player.test.js` ("gravity and jumping"). The same distance-versus-move cases as 3.8, vertically:
      - a fall whose step is smaller than, equal to, larger than, and many tiles larger than the distance to the ground: lands on top, never inside or through it;
      - a jump whose step is smaller than, equal to, and larger than the distance to a ceiling: stops just below it;
      - falling until `maxFallSpeed` is reached, then no faster;
      - running and jumping together (both inputs held).
    - Rules to decide and test: `vy` becomes 0 on landing and on hitting a ceiling; arriving exactly on the ground isn't `onGround` until the next step pulls the player down (the existing collision rule), and must not stop the player from jumping on that next step.
    - Code: `src/simulation/player.js`
  - [x] 3.10 Taking damage (decided: `damagePlayer(state, source)` for enemies to call; knockback takes control away until the player lands; hit dead-centre pushes backwards): lose 1 health, knockback away from the source (from tuning), and invincibility for the time in tuning, with a flag the renderer can use to flash (reqs 24–25).
    - Test: `tests/simulation/player.test.js` ("damage")
    - Code: `src/simulation/player.js`
  - [x] 3.11 Falling into a pit (decided: "below the bottom" means entirely below it; invincibility doesn't protect against pits; respawning resets speed and ends knockback): below the bottom of the level, lose 1 health and respawn at the start point (req 26).
    - Test: `tests/simulation/player.test.js` ("pits")
    - Code: `src/simulation/player.js`, `src/simulation/step.js`
  - [x] 3.12 Restart at 0 health: the level returns to its starting snapshot, including health and reward count (req 27).
    - Test: `tests/simulation/step.test.js` ("restart")
    - Code: `src/simulation/step.js`, `src/simulation/state.js`
- [ ] 4.0 Build objects and stacking: pick up, drop, throw, stack, and rewards
  - [x] 4.1 Objects in the initial state, from level placements and object definitions; objects placed one above another start stacked (req 28).
    - Decided: objects are placed in their cells by the usual bottom-centre rule and start `resting` if a solid tile, or a stackable object that is itself resting, is directly under them; otherwise they start not resting and fall once object gravity exists (4.5). Non-stackable objects are never a support. Objects are part of the level-start snapshot and are restored on restart (req 27).
    - Test: `tests/simulation/state.test.js` ("objects", "objects that start at rest", snapshot), `tests/simulation/step.test.js` ("objects across steps"), `tests/simulation/collision.test.js` ("isSupported")
    - Code: `src/simulation/objects.js` (`CarriableObject`), `src/simulation/state.js`, `src/simulation/step.js`, `src/simulation/collision.js` (`isSupported`, now also used by the player's standing check)
  - [x] 4.2 Pick up with **action** when touching an object and empty-handed. The held object follows above the player's head. One object at a time (reqs 29–30).
    - Decided: "touching" means the boxes overlap or share an edge (a corner alone doesn't count); of several touched objects, those on the side the player faces come first, then the nearest by centre, then the first in grid order; only a new press of action picks up (`Player.actionHeld`, like `jumpHeld`). A held object (`CarriableObject.held`) sits with its bottom-centre at the player's top-centre, still and not resting, and is placed after the player moves each step.
    - Test: `tests/simulation/objects.test.js` ("pick up", "the CarriableObject structure"), `tests/simulation/collision.test.js` ("touches"), `tests/simulation/player.test.js` ("the Player structure")
    - Code: `src/simulation/objects.js` (`updateObjects`), `src/simulation/collision.js` (`touches`), `src/simulation/player.js` (`actionHeld`), `src/simulation/step.js`
  - [x] 4.2a Amendment to 4.2: the held object collides. Found after 4.2: only the player's box collided, so a held object passed through low overhangs, ceilings, and walls, and a later throw or drop could start inside a solid. Decided: the player and the held object move together as two boxes. On each axis both move by the shorter of their two allowed moves, so a barrier either one meets stops both (not one merged rectangle, which would stop a narrow player early at walls the object doesn't reach). Hitting something sideways, landing, and hitting a ceiling apply to the player whichever box was stopped, and a held object caught on a ledge holds the player up (standing). Picking up fails when the object, placed above the head, would overlap a solid tile or stick out past the level's sides. Rule: a held object is never inside a solid.
    - Test: `tests/simulation/collision.test.js` ("moveBoxes", "fitsIn"), `tests/simulation/objects.test.js` ("carrying under barriers", "no room to pick up")
    - Code: `src/simulation/collision.js` (`moveBoxes`, `fitsIn`), `src/simulation/player.js`, `src/simulation/objects.js` (`heldObject`)
    - Docs (no code): `docs/guide-levels.md`, a note that carrying needs headroom of the player's height plus the object's.
  - [x] 4.3 Throw with **action** while holding: an arc in the facing direction, with throw speed from tuning (req 31).
    - Decided: 4.3 is the launch only. A new press of action while holding lets go of the object from above the head, with speed (`throwSpeed.x` forward in the facing direction after this step's move, `throwSpeed.y` upward), whatever the player's own speed. The object becomes `thrown` and can't be picked up until it lands. Objects don't move on their own until 4.5, which tests the arc.
    - Test: `tests/simulation/objects.test.js` ("throw", "the CarriableObject structure")
    - Code: `src/simulation/objects.js`
  - [x] 4.4 Drop with **down + action** at the player's feet, using drop speed from tuning (req 32).
    - Decided: the object goes down beside the player's feet, flush against the side they face, with its bottom level with their feet. If it doesn't fit there (tiles or the level's edge), it goes on the other side. If neither fits, the player keeps holding it. `dropSpeed` follows `throwSpeed`'s convention: x away from the player (toward the side the object went down on), y upward. A dropped object isn't `thrown`, so it can be picked up again at once. Down + action with empty hands picks up as usual. Throw and drop speeds of 0 come out as exactly 0, never -0, so equal states compare as equal.
    - Test: `tests/simulation/objects.test.js` ("drop", plus a zero-speed case in "throw")
    - Code: `src/simulation/objects.js`
  - [x] 4.5 Object gravity and tile collision, so thrown and dropped objects come to rest (req 34).
    - Decided: objects that aren't held or at rest fall under `gravity` and `maxFallSpeed` (tuning, as for the player) and collide with solid tiles, the level's sides, and resting stackable objects. Hitting a wall or the side of a stack makes the sideways speed 0, so the object falls straight down, still thrown until it lands. Landing stops it dead (both speeds 0), puts it at rest, and clears `thrown`. An object entirely below the level returns to where it was when the level started, still and not thrown, and falls or comes to rest from there. Falling runs after pick-up, throw, and drop in each step, so a released object starts moving at once, and a crate dropped on the ground is at rest (and solid) before the player's next move. Objects move lowest first, so a falling stack settles in one piece. The 4.3 and 4.4 launch tests now set gravity (and, for drops, the drop speed) to 0, so they still read the launch exactly.
    - Carried over from 4.3: test the thrown object's arc (forward and up, then falling under gravity), and clear `thrown` when it lands so it can be picked up again. Decide what a wall hit does to a thrown object's sideways speed.
    - Carried over from 4.4: dropped objects stay where they were put down until this task. Test that a dropped object falls and comes to rest in each case: dropped on the ground (at rest at once, with a drop speed of 0), dropped in mid-air (falls from beside the player's feet), and dropped with a non-zero `dropSpeed` (moves away from the player and upward, then falls). A dropped object is never `thrown`, so it can be picked up while still falling.
    - Test: `tests/simulation/objects.test.js` ("falling and resting")
    - Code: `src/simulation/objects.js`
  - [x] 4.6 Stacking: stackable objects at rest are solid surfaces that objects land on and the player stands, walks, and jumps on (req 35).
    - Decided: `solidObjects(state)` (objects.js) is the resting stackable objects. Objects land on them. The player stands, walks, and jumps on them, and is stopped by their sides, except one the player or the held object already overlaps (for example a crate that fell through the player and came to rest where they stand), which the player can walk out of. Objects that are still moving, non-stackable objects, and the player are never solid to falling objects. The drop placement, the room-above-the-head check, and the player-and-held-object move all count solid objects.
    - Carried over from 4.2a and 4.4: the "does it fit" checks only look at tiles and the level's edges, so an object can be dropped overlapping a crate, or picked up into a crate above the player's head. Once resting stackable objects are solid, include them in every such check, but never the held object itself:
      - the drop's placement beside the feet (front, then the other side, else keep holding);
      - the pick-up's room-above-the-head check;
      - the player and held object moving together (`moveBoxes` gets the resting stackable objects as `solidBoxes`), so a carried crate stops at a stack just as it stops at a wall.
    - Test: `tests/simulation/objects.test.js` ("stacking"), `tests/simulation/collision.test.js` ("stackable boxes": `overlapsBox`, `fitsIn` with solid boxes)
    - Code: `src/simulation/objects.js` (`solidObjects`, `updateFalling`), `src/simulation/collision.js` (`overlapsBox`), `src/simulation/player.js`, `src/simulation/step.js`
  - [x] 4.7 Picking up an object that others rest on makes them fall (req 36).
    - Decided: every step, before objects move, each resting object checks (lowest first) for a solid tile or a resting stackable object directly under it. One with nothing under it stops resting and falls that same step, and so do any resting on it, so a stack above a removed crate falls together and settles again. An object still partly supported stays at rest. The check is `settleResting` (objects.js), which also decides which objects start at rest when a level is built (task 4.1).
    - Test: `tests/simulation/objects.test.js` ("support removed")
    - Code: `src/simulation/objects.js` (`settleResting`), `src/simulation/state.js`
  - [x] 4.8 The player can't pick up the object they're standing on (req 37).
    - Decided: objects the player stands on (their feet on its top, overlapping sideways: `isOnTopOf` in collision.js) are left out when choosing what to pick up. Another object they touch, such as a crate beside them on the stack, is still picked up by the usual ranking.
    - Test: `tests/simulation/objects.test.js` ("standing on"), `tests/simulation/collision.test.js` ("isOnTopOf")
    - Code: `src/simulation/objects.js`, `src/simulation/collision.js` (`isOnTopOf`)
  - [x] 4.9 Rewards: touching one removes it and adds its value to the reward count (reqs 42–43).
    - Decided: a reward is a plain box filling its grid cell (1 × 1), with `value` (default 1) and `color` from its legend entry. The player collects it by overlapping it (sharing an edge isn't enough). Only the player collects rewards; objects pass through them. Rewards are part of the level-start snapshot and come back on restart (req 27).
    - Test: `tests/simulation/rewards.test.js`, `tests/simulation/state.test.js` (snapshot)
    - Code: `src/simulation/rewards.js`, `src/simulation/state.js`, `src/simulation/step.js`
  - [x] 4.10 Amendment to 4.2a and 4.5: pit respawns never put an object inside something solid. Found after 4.9, two gaps:
    - Respawning while carrying (from 4.2a): a player who falls into a pit while holding an object respawns at the start with it still above their head, where nothing checks there is headroom, so it can end up inside a ceiling. Decided: falling into a pit makes the player let go of the held object. It is released where it is, still and not thrown, falls into the pit, and goes back to its own start place under the 4.5 rule.
    - Start place taken (from 4.5): an object that falls into a pit goes back to its start place even when another crate now rests there, and ends up inside it. Decided: it goes to the lowest free spot straight above its start place, clear of solid tiles and solid objects (resting stackable ones), and falls or comes to rest from there. Non-stackable objects such as coconuts aren't solid, so they don't count as taking the spot.
    - Test: `tests/simulation/objects.test.js` ("pit respawns"), `tests/simulation/collision.test.js` ("freeYAbove")
    - Code: `src/simulation/player.js`, `src/simulation/objects.js` (`letGo`), `src/simulation/collision.js` (`freeYAbove`)
  - [ ] 4.11 Amendment to 4.1: objects that start inside a solid tile. Found during 5.1: nothing checks that an object doesn't start overlapping a solid tile. The player has this check in both `createLevelState` (a `LevelDataError`) and the validator (`player-does-not-fit`); objects have neither. Bottom-centre placement makes it impossible for an object no bigger than a tile, but an object wider or taller than its cell (a wide plank, say), placed beside a wall or under a ceiling, would start inside the tile. A resting object there would be a solid surface inside the wall, and a falling one could pass through it, since collision only stops boxes moving *into* solids. Decide whether to add the same check for objects in both places, test-first, with a plain-language validator message naming the legend character and the cell. Enemies got this check in 5.2 (`enemy-does-not-fit`, and `overlappedTile` in validate.js, which objects could share).
    - Test: `tests/simulation/state.test.js` (invalid levels), `tests/data/validate.test.js`
    - Code: `src/simulation/state.js`, `src/data/validate.js`
- [ ] 5.0 Build enemies and punching
  - [x] 5.1 Enemies in the initial state, from level placements and character definitions, with health and patrol speed (reqs 40, 48).
    - Decided: the starting direction is set per placement. An enemy legend entry takes an optional `"facing": "left"` or `"right"` (default `"left"`), added to the level schema, the validator (a `facing` on a non-enemy entry is an error), `docs/data-formats.md`, and `docs/guide-levels.md`; a test keeps the schema's values in sync with `Facing`. An enemy (`Enemy`, enemies.js, sealed like `Player`) is placed bottom-centre in its cell, with health from its definition and `vx` set to the patrol speed in its facing direction. Building a level fails with a `LevelDataError` if an enemy's definition is missing or is the player's. Enemies are part of the level-start snapshot and are restored on restart (req 27).
    - Test: `tests/simulation/state.test.js` ("enemies", snapshot, invalid levels), `tests/simulation/step.test.js` ("enemies across steps"), `tests/data/validate.test.js` (enemy `facing`), `tests/simulation/constants.test.js` (`Facing` and the level schema)
    - Code: `src/simulation/enemies.js` (`Enemy`, `createEnemy`), `src/simulation/state.js`, `src/simulation/step.js`, `src/data/schemas/level.schema.json`, `src/data/validate.js`
  - [x] 5.1a Amendment to 5.1 (and 2.9, 3.3): shared constants for legend kinds, legend fields, and character kinds. Found after 5.1: the names of legend entry kinds (`tile`, `playerStart`, `goal`, `enemy`, `object`, `reward`), the other legend fields (`color`, `facing`), and the character kinds (`player`, `enemy`) are written as string literals in several places. They appear in `LEGEND_KINDS` and the `in` checks in `src/data/validate.js` (for example `'facing' in entry && !('enemy' in entry)`), and the character `kind` comparisons in `validate.js` and `state.js` (`'player'`, `'enemy'`). This goes against the shared-constants rule already used for `Facing`.
    - Decided: add frozen constants `LegendKind`, `LegendField`, and `CharacterKind` to `src/simulation/constants.js`. They go there because simulation code may only import simulation files, while `validate.js` may import from the simulation. Use them for the kind list (`LEGEND_KINDS` becomes `Object.values(LegendKind)`), for every `in` check, and for every comparison of a kind value. Reading a field's value stays as plain dot access (`entry.enemy`), since the schema defines those names and `entry[LegendKind.ENEMY]` reads worse.
    - A constant alone doesn't catch typos: reading a misspelled key of a frozen object gives `undefined` silently. So, as for `Facing`, add tests tying each constant to its schema: `LegendKind` and `LegendField` together are exactly the level schema's legend entry properties, and `CharacterKind`'s values are exactly the character schema's `kind` values.
    - This is a refactor with no change in behaviour: test-first only for the new sync tests; all existing tests must stay green.
    - Test: `tests/simulation/constants.test.js`
    - Code: `src/simulation/constants.js`, `src/data/validate.js`, `src/simulation/state.js`
  - [x] 5.2 Patrol with gravity and collision: turning at walls and at the edges of platforms and stacks, and walking on stacks (reqs 49–50).
    - Decided: on the ground an enemy walks at its patrol speed in the direction it faces. It turns around at a wall (a solid tile, the level's side edge, or a solid object), stopping flush against it. It also turns at the edge of a platform or stack: a step that would take its front edge past the end of the ground under it isn't taken, so it never hangs over the edge and turns within one step of it. In the air it doesn't move sideways (`vx` 0): it falls straight down under `gravity` and `maxFallSpeed` (tuning) and patrols again once it lands. An enemy entirely below the level is removed. Enemies pass through each other and the player, and a resting crate they already overlap isn't solid to them. `updateEnemies` runs after objects fall in each step.
    - Decided for the carried-over fit check: added in both places, as for the player. `createLevelState` fails with a `LevelDataError` ("fitting the enemies"), and the validator reports `enemy-does-not-fit` for every placement that would overlap a solid tile, naming the legend character, the enemy's cell, and the tile. Documented in `docs/data-formats.md` and `docs/guide-levels.md`.
    - Carried over from 5.1: nothing checks that an enemy doesn't start overlapping a solid tile. The player has this check in both `createLevelState` (a `LevelDataError`) and the validator (`player-does-not-fit`); enemies and objects have neither. Bottom-centre placement makes it impossible for an enemy no bigger than a tile, but an enemy wider or taller than its cell, placed beside a wall or under a ceiling, would start inside the tile, and collision only stops boxes moving *into* solids, so it could pass through. Decide whether to add the same check for enemies in both places, test-first, with a plain-language validator message naming the legend character and the cell. (Objects have the same gap; see 4.11.)
    - Test: `tests/simulation/enemies.test.js` ("patrol"), `tests/simulation/state.test.js` (invalid levels), `tests/data/validate.test.js` (enemy fit)
    - Code: `src/simulation/enemies.js` (`updateEnemies`), `src/simulation/step.js`, `src/simulation/state.js`, `src/data/validate.js` (`checkEnemyFits`, `overlappedTile`)
  - [x] 5.3 Contact damage when the player touches an enemy from the side or below (req 51).
    - Decided: the player touches an enemy when their boxes overlap (sharing an edge isn't enough). A touch is "from above" when the player moved down this step and their feet were at or above the enemy's top before the move. That is a stomp (5.4) and does no damage; 5.4 adds the defeat and the bounce. Any other touch calls `damagePlayer` with the enemy as the source: 1 health, knockback away from it, and invincibility, so several enemies at once cost 1 health. Only the player's own box counts, not a held object's. `hurtPlayerOnContact` (enemies.js) runs once everything has moved in each step, with the player as they were at the start of the step, and before the health-0 restart check.
    - Done for the carry-over: `withoutNegativeZero` moved to `src/simulation/numbers.js`, used by objects.js and `damagePlayer`.
    - The 5.2 test "an enemy walks through the player without turning" now makes the player invincible, so contact damage doesn't knock them out of the enemy's way; it still checks that the enemy passes through without turning.
    - Carried over from 4.4: `damagePlayer` (player.js, task 3.10), which this task is the first to call in play, gives a speed of -0 when the knockback in tuning is 0 (`-knockback.y`, and `away * knockback.x` when knocked to the left). -0 makes equal states compare as different (`deepEqual` tells 0 and -0 apart). Test-first: knockback of 0 gives exactly 0 in both directions, then fix it the way throw and drop do (`withoutNegativeZero` in objects.js; move it somewhere both files can share).
    - Test: `tests/simulation/enemies.test.js` ("contact"), `tests/simulation/player.test.js` ("damage", the zero-knockback case)
    - Code: `src/simulation/enemies.js` (`hurtPlayerOnContact`), `src/simulation/player.js`, `src/simulation/numbers.js`, `src/simulation/objects.js`, `src/simulation/step.js`
  - [x] 5.4 Stomping: landing on an enemy while falling defeats it regardless of health and bounces the player (req 52).
    - Decided: a touch from above (as defined in 5.3) is a stomp. The enemy is defeated whatever its health, and the player bounces upward at `stompBounceSpeed` (tuning), whether or not jump is held. For now a defeated enemy is removed at once, through one function, `defeatEnemy`, which 5.5 and 5.7 reuse and 5.10 changes to add the defeat state. Stomps are resolved before side contacts in the same step. Several enemies stomped at once are all defeated, with one bounce. Stomping works while invincible. `resolveEnemyContact` (enemies.js) replaces 5.3's `hurtPlayerOnContact`.
    - Same -0 rule as 5.3: the bounce speed (`-stompBounceSpeed`) must come out as exactly 0, not -0, when `stompBounceSpeed` is 0. Include that case in the tests. (Done. The schema requires `stompBounceSpeed` > 0, so validated data never has 0.)
    - The 5.3 test "falling onto an enemy from above does no damage" now runs until the stomp defeats the enemy, and checks the player's health then.
    - Test: `tests/simulation/enemies.test.js` ("stomp", and the 5.3 test above)
    - Code: `src/simulation/enemies.js` (`defeatEnemy`, `resolveEnemyContact`), `src/simulation/step.js`
  - [x] 5.5 A thrown object defeats the enemy it hits, then falls so it can be picked up again (req 33).
    - Decided: a thrown object (still `thrown`, in flight) hits an enemy when their boxes overlap. This is checked each step once objects and enemies have moved, and before the player's contact with enemies, so an enemy hit that step can't hurt the player. Every enemy it overlaps in that step is defeated (`defeatEnemy`), whatever its health. The object then drops straight down: both speeds 0 and no longer `thrown`, so it can be picked up again at once and can't defeat another enemy as it falls. Only thrown objects defeat enemies: dropped, falling, resting, and held ones don't.
    - Test: `tests/simulation/enemies.test.js` ("thrown objects")
    - Code: `src/simulation/enemies.js` (`hitEnemiesWithThrownObjects`), `src/simulation/step.js`
  - [x] 5.6 Punch reach: one punch per press, in the facing direction, reaching from the player's body to the outer edge of the sprite frame, or of the shape when there's no sprite. Enemies just inside and just outside the reach (reqs 38–39).
    - Decided: the punch area (`punchArea`, punch.js) runs sideways from the player's front edge (the side they face, after this step's move) out to the edge of their sprite frame on that side. The frame is `frameWidth / pixelsPerTile` tiles wide, centred on the collision box. The area is as tall as the collision box. With no sprite, a sprite missing from the data, or a frame no wider than the body, it has no width: it is just the front edge. An enemy is in reach (`enemiesInReach`) if it overlaps or touches the area (`touches` in collision.js), so with no sprite exactly the enemies touching or overlapping the front edge are; enemies behind the player aren't. Only a new press punches (`Player.punchHeld`). A punch starts `Player.punchTime` at `punchSeconds` (tuning), which counts down each step for the renderer's flash. Punching in the air or while knocked back is allowed. `updatePunch` runs once everything has moved and before the player's contact with enemies. The hit itself (damage) is 5.7.
    - Test: `tests/simulation/punch.test.js` ("reach", "one punch per press"), `tests/simulation/player.test.js` ("the Player structure")
    - Code: `src/simulation/punch.js` (`punchArea`, `enemiesInReach`, `updatePunch`), `src/simulation/player.js` (`punchHeld`, `punchTime`), `src/simulation/step.js`
  - [x] 5.7 Punch damage from the player definition reduces enemy health; the enemy is defeated at 0. Cases: damage 1 against health 1, and health greater than damage (req 40).
    - Done as carried over: on the press step only, every enemy in reach loses health equal to `punchDamage` (1 if the definition has none; health never goes below 0), and `defeatEnemy` is called for any at 0. Cases tested: damage 1 against health 1, health greater than damage, damage from the definition, damage greater than health, no `punchDamage`, no press, holding (once only), a new press (again), and several enemies in and out of reach.
    - Found while testing: enemies move before the punch is resolved in each step. With no sprite (a reach of no width), an enemy flush against the player's front that walks away by any amount that step is out of reach. That follows from the 5.6 rules, so the damage tests give the player a sprite wide enough to reach past the front edge.
    - Carried over from 5.6: `updatePunch` (punch.js) already detects a new press and starts the flash, and `enemiesInReach` gives the enemies a punch would hit. On the press step only, reduce each one's health by the player definition's `punchDamage` (default 1, docs/data-formats.md), and call `defeatEnemy` (enemies.js) for any that reach 0, so 5.10's defeat state applies to punches too. Holding the button must not damage again on later steps.
    - Test: `tests/simulation/punch.test.js` ("damage")
    - Code: `src/simulation/punch.js`
  - [x] 5.8 No punching while carrying an object (req 41).
    - Decided: carrying is judged once this step's pick-up, throw, or drop has happened. Throw (or drop) and punch pressed together throw (or drop) and punch; pick-up and punch pressed together pick up and don't punch. A press made while carrying does nothing (no flash, no damage) and is used up: the button still counts as held, so letting go of the object while holding punch doesn't punch, and only a new press does.
    - Carried over from 5.6: stop the press in `updatePunch` while the player holds an object (`heldObject`, objects.js): no punch flash and no damage. Decide whether a press made while carrying still counts as "held" afterwards, so that letting go of the object while still holding punch doesn't punch.
    - Test: `tests/simulation/punch.test.js` ("carrying")
    - Code: `src/simulation/punch.js`
  - [ ] 5.9 A punch is resolved before contact damage in the same update (req 51).
    - Carried over from 5.6: the order is already in place: `step()` calls `updatePunch` before `resolveEnemyContact`. This task's test checks it: an enemy that a punch defeats in the same step it would touch the player can't hurt them, and one the punch doesn't defeat still can.
    - Carried over from 5.7: `updatePunch` runs after `updateEnemies`, so the punch is checked against where enemies are after this step's move. With no sprite, the reach is only the player's front edge (no width), so an enemy exactly flush against the player that walks away by any amount in the press step is out of reach and can't be punched. An enemy walking toward the player overlaps the edge and is hit, so this mostly affects one that has just turned away. Decide whether to resolve the punch against where enemies were before they moved this step: either call `updatePunch` before `updateEnemies`, or check reach against the enemies' start-of-step boxes. Keep the punch before contact damage either way (req 51), and test the flush, walking-away case.
    - Test: `tests/simulation/punch.test.js` ("order")
    - Code: `src/simulation/step.js`
  - [ ] 5.10 Defeated enemies are removed, after a short defeat state the renderer can flash (req 53).
    - Test: `tests/simulation/enemies.test.js` ("defeat")
    - Code: `src/simulation/enemies.js`
- [ ] 6.0 Build game flow: start screen, level completion, progression, and cut scenes (simulation side)
  - [ ] 6.1 Screens as states: start, playing, level complete, cut scene, and finished. The game begins on the start screen.
    - Test: `tests/simulation/flow.test.js` ("screens")
    - Code: `src/simulation/flow.js`
  - [ ] 6.2 Start screen: confirm on Start begins the first level in the level list (req 56).
    - Test: `tests/simulation/flow.test.js` ("start")
    - Code: `src/simulation/flow.js`
  - [ ] 6.3 Reaching the goal stops gameplay and opens level complete, offering Next level and Exit game, or only Exit game on the last level (req 58).
    - Test: `tests/simulation/flow.test.js` ("level complete")
    - Code: `src/simulation/flow.js`, `src/simulation/step.js`
  - [ ] 6.4 Menu selection with up, down, and confirm (req 19).
    - Test: `tests/simulation/flow.test.js` ("menus")
    - Code: `src/simulation/flow.js`
  - [ ] 6.5 Next level plays the completed level's cut scene if it has one, then loads the next level, carrying over health and reward count (req 59). With and without a cut scene.
    - Test: `tests/simulation/flow.test.js` ("next level")
    - Code: `src/simulation/flow.js`, `src/simulation/state.js`
  - [ ] 6.6 Exit game moves to the finished state, which the presentation hands to the platform's quit (req 60).
    - Test: `tests/simulation/flow.test.js` ("exit")
    - Code: `src/simulation/flow.js`
  - [ ] 6.7 Cut scene timing: for a given elapsed time, each actor's position (straight-line movement between keyframes), animation, and visibility, the narration lines showing, and whether the scene has ended (reqs 62–63).
    - Test: `tests/simulation/cutscene.test.js`
    - Code: `src/simulation/cutscene.js`
  - [ ] 6.8 Skipping a cut scene with confirm (req 63).
    - Test: `tests/simulation/flow.test.js` ("skip")
    - Code: `src/simulation/flow.js`
- [ ] 7.0 Build the presentation layer
  - [ ] 7.1 Test helper: a recording fake canvas context that records draw calls (`fillRect`, `drawImage`, `fillText`, and the like) and the style in use for each.
    - Test: `tests/helpers/fake-canvas.test.js`
    - Code: `tests/helpers/fake-canvas.js`
  - [ ] 7.2 Game loop with an injected clock and frame scheduler: runs as many fixed steps as have elapsed, carries over leftover time, caps catch-up after a long pause, then draws once per frame (reqs 4–5).
    - Test: `tests/presentation/loop.test.js`
    - Code: `src/presentation/loop.js`
  - [ ] 7.3 Visible area: from the window size and visible world height, the scale and visible world width, for several window sizes and aspect ratios (req 6).
    - Test: `tests/simulation/camera.test.js` ("visible area")
    - Code: `src/simulation/camera.js`
  - [ ] 7.4 Canvas sizing: the canvas's pixel size from the window size and device pixel ratio, applied to a canvas on resize and fullscreen changes (req 6).
    - Test: `tests/presentation/canvas-size.test.js` (fake canvas and fake window)
    - Code: `src/presentation/canvas-size.js`
  - [ ] 7.5 Camera follow, level bounds, and centring a level smaller than the visible area (reqs 66–67).
    - Test: `tests/simulation/camera.test.js` ("follow")
    - Code: `src/simulation/camera.js`
  - [ ] 7.6 Parallax: layer offsets from camera position and scroll factor, and which repeated copies cover the screen (reqs 68, 70).
    - Test: `tests/simulation/parallax.test.js`
    - Code: `src/simulation/parallax.js`
  - [ ] 7.7 Renderer: draws parallax layers, tiles, the player, enemies, objects, rewards, and the goal as coloured shapes from data, plus the punch flash, the invincibility flash, and the defeat flash (req 76).
    - Test: `tests/presentation/renderer.test.js` (fake canvas)
    - Code: `src/presentation/renderer.js`
  - [ ] 7.8 Sprites: choosing the animation frame for a state and time (falling back to `idle`), drawing the frame bottom-centred and flipped when facing left, and falling back to the shape with a logged warning when a sprite is missing. The player uses idle and run (reqs 77–79).
    - Test: `tests/presentation/sprites.test.js` (fake canvas)
    - Code: `src/presentation/sprites.js`, `src/presentation/renderer.js`
  - [ ] 7.9 Input mapping: raw keys held, gamepad buttons, and stick position, plus bindings, become the input state, using the stick dead zone (reqs 14–18).
    - Test: `tests/presentation/input-map.test.js`
    - Code: `src/presentation/input-map.js`
  - [ ] 7.10 Input reading with an injected event target and `getGamepads`: tracks keys held, reads standard-mapping gamepads each frame, and works with keyboard and gamepad at the same time (req 14).
    - Test: `tests/presentation/input.test.js` (fake events and fake gamepads)
    - Code: `src/presentation/input.js`
  - [ ] 7.11 HUD: health and reward count anchored to a corner, at a size that stays readable at any window size (req 44).
    - Test: `tests/presentation/hud.test.js` (fake canvas)
    - Code: `src/presentation/hud.js`
  - [ ] 7.12 Screens: start screen, level-complete panel with the selected option highlighted, "Thanks for playing", and the data error screen listing every error (reqs 7, 56, 58, 85).
    - Test: `tests/presentation/screens.test.js` (fake canvas)
    - Code: `src/presentation/screens.js`
  - [ ] 7.13 Cut scene view: background scaled to fit and centred, side fill colour, actors with their animations, the narration text box, and the skip hint (reqs 62, 65).
    - Test: `tests/presentation/cutscene-view.test.js` (fake canvas)
    - Code: `src/presentation/cutscene-view.js`
  - [ ] 7.14 Debug overlay: shows everything in the PRD's Design Considerations, including Steam status from the platform (req 10).
    - Test: `tests/presentation/debug-overlay.test.js` (fake canvas, fake platform)
    - Code: `src/presentation/debug-overlay.js`
  - [ ] 7.15 Game controller: each frame, reads input, steps the simulation, and draws the current screen. It also handles the presentation-only keys (F3 debug overlay, F11 fullscreen through the platform) and calls the platform's quit when the flow reaches finished (reqs 2, 60).
    - Test: `tests/presentation/game.test.js` (fake platform, fake canvas, fake input)
    - Code: `src/presentation/game.js`
  - [ ] 7.16 Test hook: in browser mode only, a read-only `gameTestHook.getState()` returning a copy of the current screen, player position, velocity, and on-ground flag. Changing the returned object doesn't affect the game (req 94).
    - Test: `tests/presentation/test-hook.test.js`
    - Code: `src/presentation/test-hook.js`
  - [ ] 7.17 Start-up glue in `main.js`: load data, show the error screen if it's invalid, pick the platform, create the game, install the test hook in browser mode, and start the loop.
    - Test (red first): extend `tests-ui/smoke.spec.js` so it checks that the page opens on the start screen (through the test hook), and that broken data shows the error screen. Run with `npm run test:ui`.
    - Code: `src/presentation/main.js`
- [ ] 8.0 Build the platform layer and the Electron host with Steam
  - [ ] 8.1 Platform interface (`getSteamStatus()`, `getSteamUserName()`, `toggleFullscreen()`, `quit()`) and a fake implementation. A shared contract test checks every implementation (req 71).
    - Test: `tests/platform/platform-contract.test.js`, `tests/platform/fake-platform.test.js`
    - Code: `src/platform/platform.js`, `src/platform/fake-platform.js`
  - [ ] 8.2 Browser platform with an injected `document`: Steam unavailable, fullscreen using the browser's fullscreen feature, and quit reporting that "Thanks for playing" should be shown (req 7).
    - Test: `tests/platform/browser-platform.test.js`, added to the contract test
    - Code: `src/platform/browser-platform.js`
  - [ ] 8.3 Install Electron. Window options: `contextIsolation` on, `nodeIntegration` off, the preload script, and loading `index.html`. Add `npm start`.
    - Test: `tests/electron/window-options.test.js`
    - Code: `electron/window-options.js`, `electron/main.js` (glue), `package.json`
  - [ ] 8.4 The preload bridge exposes only the platform methods, and the page-side Electron platform calls them.
    - Test: `tests/electron/preload-api.test.js` (fake `ipcRenderer`), `tests/platform/electron-platform.test.js` (fake bridge), added to the contract test
    - Code: `electron/preload-api.js`, `electron/preload.js` (glue), `src/platform/electron-platform.js`
  - [ ] 8.5 Install steamworks.js and add `steam_appid.txt` containing `480`. Steam start-up with the steamworks module passed in: on success it reports connected; on failure it logs a clear message, reports unavailable, and doesn't throw (reqs 8–9).
    - Test: `tests/electron/steam.test.js` (fake steamworks module)
    - Code: `electron/steam.js`, `electron/main.js` (glue)
  - [ ] 8.6 The Steam user's display name flows from `electron/steam.js` through the bridge to the platform, and appears in the debug overlay (req 10).
    - Test: `tests/electron/steam.test.js` ("user name"), `tests/platform/electron-platform.test.js` ("user name")
    - Code: `electron/steam.js`, `electron/preload-api.js`, `src/platform/electron-platform.js`
  - [ ] 8.7 Steam overlay settings applied before the app starts, using the steamworks.js Electron helper and the required Chromium flags, with `app` passed in (req 11).
    - Test: `tests/electron/overlay.test.js` (fake `app.commandLine`)
    - Code: `electron/overlay.js`, `electron/main.js` (glue)
  - [ ] 8.8 (no code) Launch with Steam running. Confirm the Steam user name shows in the debug overlay, Shift+Tab opens the overlay, and F12 takes a screenshot (reqs 10–11).
  - [ ] 8.9 (no code) Measure FPS with the overlay settings on, using the debug overlay (req 12).
  - [ ] 8.10 (no code) Write `docs/steam-overlay.md`: each setting and why it's needed, plus the FPS results (req 12).
  - [ ] 8.11 (no code) Launch with Steam closed and confirm the game runs (req 9).
  - [ ] 8.12 Extend the architecture guard: only `electron/` and `src/platform/` may reference `electron` or `steamworks.js` (req 13). For the red step, temporarily add a forbidden reference and confirm the test fails.
    - Test: `tests/architecture.test.js`
    - Code: none beyond the guard.
- [ ] 9.0 Create the prototype content (no code; checked by data validation in `npm test`)
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
  - [ ] 10.1 Movement UI check: start the game with Enter, then hold Right, Left, and Jump, and confirm through `gameTestHook` that the player moved right, moved left, and left the ground and landed (req 93). The behaviour already exists by this point, so this check confirms finished work rather than driving new code. If it fails, fix the code test-first.
    - Test: `tests-ui/movement.spec.js`
  - [ ] 10.2 (no code) Run `npm run test:ui` and confirm all UI checks pass.
  - [ ] 10.3 (no code) Write `docs/manual-test-checklist.md`: Electron launch, Steam overlay and F12, gamepad play, window resizing and fullscreen, browser mode, and cut scene playback (req 95).
  - [ ] 10.4 (no code) Run the manual test checklist and record the results.
  - [ ] 10.5 (no code) Ask a repository admin to turn on branch protection for `main`, requiring the CI workflow to pass (req 92). Confirm a pull request with a failing test can't be merged.
  - [ ] 10.6 (no code) Confirm a commit with a failing test or a broken data file is blocked by the pre-commit hook.
  - [ ] 10.7 (no code) Ask someone who doesn't write code to follow the guides to add an enemy, reward, stackable crate, and platform, and to change a cut scene narration line. Fix the guides wherever they get stuck (Success Metric 6).
  - [ ] 10.8 (no code) Walk through every success metric in PRD Section 8 and note any gaps.
  - [ ] 10.9 (no code) Update `docs/developer-guide.md` with anything learned, then open a pull request to `main`.
