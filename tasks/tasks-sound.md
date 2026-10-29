# Tasks: Sound

Source: [prd-sound.md](prd-sound.md). "Req N" refers to that PRD's numbered functional requirements; "engine req N" refers to [prd-engine-prototype.md](prd-engine-prototype.md).

## Relevant Files

**Data formats, loading, and validation**
- `src/data/schemas/audio.schema.json` - New. Schema for `data/config/audio.json`: `formatVersion`, `startMusic`, `sounds`.
- `src/data/schemas/level.schema.json` - Adds optional `music` and `completeJingle`.
- `src/data/schemas/cutscene.schema.json` - Adds optional `music` and `sounds` (`[{ time, sound }]`).
- `src/data/schemas/bindings.schema.json` - Adds the `mute` input (keyboard required, gamepad optional, like `fullscreen`).
- `src/data/validate.js` - `audio.json` becomes a required file and a new kind; new checks and messages: missing sound files, unknown sound event names, cut scene sound order.
- `tests/data/validate.test.js` - Tests for the new checks and their messages.
- `tests/data/schemas.test.js` - Schema tests for the new and changed formats.
- `src/data/load.js` - Follows references to sound files and loads them.
- `tests/data/load.test.js` - Tests for following and loading sound files.
- `tools/validate-data.js` - Collects `.ogg` and `.opus` files from the data folder so missing-file checks work.
- `tests/data/fixtures/valid/` - The valid fixture set gains `config/audio.json`, music and sound fields, a `mute` binding, and small `.ogg` files.

**Simulation (pure; runs in Node)**
- `src/simulation/constants.js` - New shared constant `SoundEvent` (every sound event name, req 14).
- `tests/simulation/constants.test.js` - Tests that `SoundEvent` is frozen and lists exactly the PRD's events.
- `src/simulation/state.js` - The level state gains `events` (the sound events of the latest step).
- `src/simulation/step.js` - Empties `events` at the start of each step; records `playerDefeated`.
- `src/simulation/player.js` - Records `jump`, `land`, and `playerHurt`.
- `src/simulation/objects.js` - Records `pickUp`, `drop`, and `throw`.
- `src/simulation/punch.js` - Records `punch`.
- `src/simulation/enemies.js` - Records `stomp` and `enemyDefeated`.
- `src/simulation/rewards.js` - Records `collectReward`.
- `src/simulation/flow.js` - The game state gains `events`: the level's events, plus `reachGoal`, `menuMove`, and `menuChoose`.
- `tests/simulation/*.test.js` - The matching test files for each of the above.

**Presentation**
- `src/presentation/audio.js` - New. The audio player: decides what music and sounds should play from the game state and its events, and handles mute and the browser lock. Talks to the sound system only through a backend passed in.
- `tests/presentation/audio.test.js` - Tests for the audio player, using the fake backend.
- `tests/helpers/fake-audio.js` - New. A recording fake audio backend (like `fake-canvas.js`).
- `tests/helpers/fake-audio.test.js` - Tests for the fake.
- `src/presentation/web-audio.js` - New. The real backend, using the Web Audio API (`AudioContext`).
- `tests/presentation/web-audio.test.js` - Tests for the real backend, using a fake `AudioContext`.
- `src/presentation/game.js` - The controller collects events from each update and hands them to the audio player once per frame; handles the mute key; draws the "Sound off" label.
- `tests/presentation/game.test.js` - Tests for the above.
- `src/presentation/input-map.js` - `presentationKeys` gains `mute`.
- `src/presentation/input.js` - Reports the first key press or click, for unlocking sound in browser mode.
- `tests/presentation/input-map.test.js`, `tests/presentation/input.test.js` - Tests for the above.
- `src/presentation/hud.js` - The "Sound off" label (req 19).
- `tests/presentation/hud.test.js` - Tests for the label.
- `src/presentation/debug-overlay.js` - Two more lines: current music, and sound state (on, muted, locked).
- `tests/presentation/debug-overlay.test.js` - Tests for the new lines.
- `src/presentation/test-hook.js` - The test hook's state gains the current music and sound state, for UI checks.
- `tests/presentation/test-hook.test.js` - Tests for the above.
- `src/presentation/main.js` - Start-up glue: creates the Web Audio backend and the audio player, and passes the loaded sound files in.
- `tests-ui/sound.spec.js` - New. Playwright check: the start screen's music is chosen, sound is locked until a key press, then unlocked.

**Electron**
- `electron/window-options.js` - Sets `autoplayPolicy: 'no-user-gesture-required'` (req 22).
- `tests/electron/window-options.test.js` - Tests for the above.

**Architecture**
- `tools/architecture.js` - Keeps audio APIs (`AudioContext`, `Audio`) out of `src/simulation/`.
- `tests/architecture.test.js` - Tests for the new rule.

**Placeholder audio and game data**
- `tools/make-placeholder-sounds.js` - New. Generates the placeholder music and sound effects and writes them as Ogg files.
- `tools/sound-synth.js` - New. Pure functions that make sample data: tones, note sequences, envelopes.
- `tests/tools/sound-synth.test.js` - Tests for the synthesis functions.
- `tests/tools/make-placeholder-sounds.test.js` - Tests that the tool writes one valid Ogg file for every sound it lists.
- `package.json` - Adds the Ogg encoder as a dev dependency, and a `sounds` script.
- `data/audio/music/`, `data/audio/sounds/` - New. The generated placeholder files.
- `data/config/audio.json` - New. Start music and every event's sound.
- `data/config/bindings.json` - Adds `"mute": ["KeyM"]`.
- `data/levels/level1.json`, `data/levels/level2.json` - Add `music`; one also gets a `completeJingle`.
- `data/cutscenes/after-level1.json` - Adds `music` and at least one timed sound.

**Documentation**
- `docs/data-formats.md` - Documents `audio.json`, the new level and cut scene fields, sound paths, and the `mute` binding.
- `docs/guide-sound.md` - New. Guide for sound designers and level designers.
- `docs/guide-sprites.md` - The "Sound and video" section points to the new guide.
- `docs/guide-levels.md`, `docs/guide-cutscenes.md` - Short notes on choosing music and placing cut scene sounds.
- `docs/manual-test-checklist.md` - Listening checks.
- `docs/developer-guide.md` - How to regenerate the placeholder sounds.

### Notes

- Unit tests live in `tests/`, mirroring `src/`. Playwright UI checks live in `tests-ui/`.
- Run all unit tests and data validation with `npm test`. Run one test file with `node --test tests/presentation/audio.test.js`. Run UI checks with `npm run test:ui`.
- Simulation code must never import from `src/presentation/`, play sound, or name sound files. It only records **which events happened**; the presentation decides what they sound like.
- Use shared constants, not repeated string literals: `SoundEvent.JUMP`, not `'jump'`, everywhere except the JSON data files.
- In tests, every expected value must have a visible source in the test itself (a constant defined in the test, or a value read from the fixture the test uses), not a hidden default in a helper.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task. When you finish a code sub-task, add a **Decided:** line under it recording the choices you made (names, rules, edge cases), as in [tasks-engine-prototype.md](tasks-engine-prototype.md).

## Development approach: TDD (red/green)

This feature uses the same approach as the engine prototype; the full description is in [tasks-engine-prototype.md](tasks-engine-prototype.md#development-approach-tdd-redgreen). In short:

Every sub-task that creates or changes code is done test-first. Each code sub-task names:
- **Test:** the test file the cycle starts in, and what the tests check;
- **Code:** the file or files the cycle creates or changes.

1. **Red.** Write the tests. Run them (`node --test <test file>`) and confirm they **fail for the expected reason**: an assertion about the missing behaviour, not a typo or import error.
2. **Green.** Write the **least** code that makes them pass. Run the file, then `npm test`.
3. **Refactor.** Tidy while keeping everything green.
4. **Report.** Show the tests and the code they cover together, with the red and green runs. Then check the sub-task off.

**Sound in Node.** The Web Audio API doesn't exist in Node's test runner. As with the canvas, the audio player takes a **backend** object as a parameter, and tests pass a recording fake (`tests/helpers/fake-audio.js`) and check what was asked of it. Only `src/presentation/main.js` (thin glue, checked by a Playwright UI check) creates a real `AudioContext`.

**Sub-tasks with no code** (documents, data content, decisions, manual checks) are marked **(no code)** and don't use the cycle. Data content is still checked by `npm test` through data validation.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and check out a new branch from `main` (done: `sounds`, already pushed to `origin/sounds`)

- [x] 1.0 Define the audio data formats, and extend the validator and loader to check and load sound files (reqs 1–7, 16, 23–24)
  - Done in the order 1.2, 1.1, 1.3, 1.4, 1.5, 1.7, 1.6, 1.8: 1.1's tests need a schema that uses sound paths (audio.json, from 1.2), and 1.6's missing-file checks need the tool to find sound files (1.7) or the valid fixture set would report its own sounds as missing.
  - [x] 1.1 Sound file paths: a shared schema pattern for sound paths (`.ogg` or `.opus`, same path rules as images; reqs 2–3), given its own name in `FORMAT_NAMES` (for example `sound-path`) so a bad path gets a plain-language message.
    - Decided: the pattern is `audio.schema.json`'s `$defs.soundPath`. Schemas can only `$ref` their own `$defs`, so `level.schema.json` and `cutscene.schema.json` each repeat the identical pattern in their own `$defs.soundPath`; `FORMAT_NAMES` matches by pattern text, so all three get the `sound-path` wording, and the level and cut scene "must be sound paths" tests would catch a copy that drifted. Wording: "… which is not a sound file path inside the data folder, ending in .ogg or .opus, like "audio/sounds/jump.ogg"." A path with no extension is also rejected.
    - Test: `tests/data/validate.test.js` (a `.mp3` path and a `../` path are `bad-format` with the sound path format; message wording test for the new format name)
    - Code: `src/data/validate.js`, the schema that holds the shared pattern
  - [x] 1.2 The `audio.json` format: new schema; `config/audio.json` is a required file and classifies as kind `audio`; `data.audio` holds it. `startMusic` and `sounds` are optional; `sounds` keys must be `SoundEvent` values (req 24: an unknown key like `"jmup"` is an error that lists the valid names). Add a valid `config/audio.json` to the fixture set. (`SoundEvent` is created here, ahead of task 2.0, because the validator needs it.)
    - Test: `tests/simulation/constants.test.js` (`SoundEvent` is frozen and lists exactly the events in req 14); `tests/data/validate.test.js` (missing `audio.json` is `missing-file`; an unknown event name; the valid fixture still passes); `tests/data/schemas.test.js`
    - Code: `src/simulation/constants.js`, `src/data/schemas/audio.schema.json`, `src/data/validate.js`, `tests/data/fixtures/valid/config/audio.json`
    - Decided: `SoundEvent` keys are the PRD names in UPPER_SNAKE (`PICK_UP: 'pickUp'`), in the PRD's order. The schema lists each event under `sounds.properties` with `additionalProperties: false`, so a misspelt event is the existing `unknown-field` problem, whose message already lists the allowed names; a test keeps `SoundEvent` and the schema's list identical. Only `formatVersion` is required. Also needed to stay green: `data/config/audio.json` (just `{ "formatVersion": 1 }` until task 5.5); an `audio` default in `tests/helpers/level-builder.js` (no music, no sounds; `overrides.audio` merges in); and a `### Audio` section with an example in `docs/data-formats.md`, because `schemas.test.js` requires every format to have a passing example there. The tool test that expected exactly 12 fixture files now counts the fixture's files instead.
  - [x] 1.3 Level fields: optional `music` and `completeJingle` (req 5).
    - Test: `tests/data/validate.test.js` (a level with both is valid; a bad path is an error); `tests/data/schemas.test.js`
    - Code: `src/data/schemas/level.schema.json`
    - Decided: both fields are optional sound paths with schema descriptions saying what they do. The fixture's `level1.json` has both (`level2.json` has neither), so the loader and missing-file tests cover them.
  - [x] 1.4 Cut scene fields: optional `music` and `sounds` (`[{ time, sound }]`); `time` ≥ 0; entries in time order (req 6), checked like narration order, with its own message.
    - Test: `tests/data/validate.test.js` (negative time; out of order; message wording); `tests/data/schemas.test.js`
    - Code: `src/data/schemas/cutscene.schema.json`, `src/data/validate.js`
    - Decided: each entry is `{ time, sound }`, both required, `time` ≥ 0 (a negative time is the schema's `too-small`). Two sounds may share a time; only a time earlier than the entry before it is an error, `cutscene-sound-order` { item, time, previous } (items count from 1): "sounds, item 2: "time" is 1, which is earlier than the sound before it (2). Sounds must be listed in time order." The fixture's cut scene has `music` and one timed sound.
  - [x] 1.5 The `mute` binding: keyboard required, gamepad optional (req 16). Add `"mute": ["KeyM"]` to the fixture's `bindings.json`.
    - Test: `tests/data/validate.test.js` (bindings without a keyboard `mute` is `missing-field`); `tests/data/schemas.test.js`
    - Code: `src/data/schemas/bindings.schema.json`, `tests/data/fixtures/valid/config/bindings.json`
    - Decided: `"mute": ["KeyM"]` added to the fixture, to `data/config/bindings.json` (ahead of task 5.5, because the field is now required), to the test builder's bindings, and to the bindings example and notes in `docs/data-formats.md`. A gamepad `mute` is allowed but not required; the real data has none (PRD open question 3).
  - [x] 1.6 Missing sound files: `validateData` accepts `sounds` (the sound files found, like `images`) and reports each named sound that isn't there, naming the field and the file (req 24): `startMusic`, each event in `sounds`, a level's `music` and `completeJingle`, a cut scene's `music` and each timed sound.
    - Test: `tests/data/validate.test.js` (one test per field; message wording)
    - Code: `src/data/validate.js`
    - Decided: one problem code for every field, `missing-sound` { path, sound }, where `path` is the field's location in the file (as in schema problems), so the message reuses the schema messages' wording for locations: ""startMusic" is "audio/music/start.ogg", but there is no file data/audio/music/start.ogg." and "in sounds → item 1, "sound" is …". `validateData` takes `sounds` like `images` (only whether a path is there matters); a new `checkAudio` custom check, and `checkLevel` and `checkCutscene` call the shared `checkSound`. The test helper `dataWith` gained a third argument, the sound files to remove.
  - [x] 1.7 The validation tool collects `.ogg` and `.opus` files into `sounds`. Add small `.ogg` files to the fixture set for every sound the fixture names (any tiny valid Ogg file will do; they are only checked for existence).
    - Test: `tests/data/validate.test.js` (`readDataFolder` on the fixture set finds the sound files; the whole fixture set still has no errors)
    - Code: `tools/validate-data.js`, `tests/data/fixtures/valid/audio/`
    - Decided: `readDataFolder` returns `sounds: { path: true }` for `.ogg` and `.opus` files (extensions in any case), and the command passes them to `validateData`. The fixture's sound files are 4-byte placeholders (`OggS`), not playable audio: only their existence is checked here. Replace them with real tiny Ogg files once task 5.1 gives the project an encoder, if a later test needs to decode them.
  - [x] 1.8 The loader follows references to sound files (from `audio.json`, levels, and cut scenes, only with safe paths), loads each once with a `loadSound(url)` option (in the browser: `fetch` → `ArrayBuffer`; `null` if missing), passes what it found to `validateData`, and returns `sounds: { path: <ArrayBuffer> }`. Decoding happens later, in the presentation (task 4.2).
    - Test: `tests/data/load.test.js` (the fixture loads with every sound; `referencesOf` for audio, level, and cut scene sound fields; unsafe paths aren't fetched; a missing sound file is reported, not thrown)
    - Code: `src/data/load.js`
    - Decided: `referencesOf` now returns `{ json, images, sounds }` (existing tests updated for the extra list). Sound files are told apart from images by extension. A sound that is missing or fails to load (`loadSound` gives `null`) is left out of `sounds`, so validation reports it as `missing-sound`, the same as the tool does. The browser `loadSound` fetches with the normal HTTP cache (unlike JSON, which uses `no-store`), since sound files are large and rarely change. `main.js` doesn't use `sounds` yet (task 4.10).

- [x] 2.0 Record sound events in the simulation and the game flow (reqs 12, 14)
  - [x] 2.1 The level state's `events` list: starts empty (`createLevelState`), is emptied at the start of every `step`, and is part of the state's copy (`copyState`), so a step never changes the events of the state passed in.
    - Test: `tests/simulation/state.test.js`, `tests/simulation/step.test.js`
    - Code: `src/simulation/state.js`, `src/simulation/step.js`
    - Decided: `state.events` is a plain list of `SoundEvent` values, in the order things happened within the step; modules record with `state.events.push(SoundEvent.X)`. `copyState` already copied it (plain data), and `step` replaces it with a new empty list before updating. Also added a test helper, `runStepsWithEvents` (`tests/helpers/run.js`, tested in `helpers.test.js`): like `runSteps`, but also returns each step's events.
  - [x] 2.2 Player: `jump` when a jump starts (not when walking off a ledge); `land` when `onGround` turns from false to true, but not on the level's first step or after a respawn; `playerHurt` when the player loses health from an enemy or a pit.
    - Test: `tests/simulation/player.test.js` (each event, and each "not" case in req 14)
    - Code: `src/simulation/player.js`
    - Decided: `land` is recorded when the step's move ends on the ground and the player was **falling** before it (not on the ground, and `vy` > 0). "Was standing at the start of the step" didn't work: a jump can come down exactly level with the ground (an existing test, "m = d"), so the player is already standing on the step that lands. At the level start and after a respawn the player is at rest (`vy` 0), so neither lands. (A level whose start is in mid-air would land after the first fall; no level does that.) `playerHurt` is recorded in `damagePlayer` (only when not invincible) and in `fallIntoPit`.
  - [x] 2.3 Objects: `pickUp`, `drop` (including onto a stack), and `throw`, each once, on the step it happens.
    - Test: `tests/simulation/objects.test.js`
    - Code: `src/simulation/objects.js`
    - Decided: recorded only when the action really happens: no `pickUp` when there's no room above the head, no `drop` when there's no room on either side. Letting go when falling into a pit (`letGo`) is not a drop and plays nothing.
  - [x] 2.4 Punch: `punch` when a punch starts, whether or not it hits anything.
    - Test: `tests/simulation/punch.test.js`
    - Code: `src/simulation/punch.js`
    - Decided: not recorded for a press while carrying (no punch happens), nor while punch is held.
  - [x] 2.5 Enemies: `stomp` for a stomp; `enemyDefeated` for a punch or a thrown object; never both for one enemy. One event per enemy defeated (two enemies in one step: two events).
    - Test: `tests/simulation/enemies.test.js`
    - Code: `src/simulation/enemies.js`
    - Decided: `defeatEnemy(state, enemy, event)` takes the event for how the enemy was defeated, and records it only if the enemy wasn't already defeated. Callers: stomps pass `STOMP`; thrown objects and punches (`punch.js`) pass `ENEMY_DEFEATED`. A punch that only lowers an enemy's health records just `punch`. Within a step, a punch's events come in order: `punch`, then `enemyDefeated`.
  - [x] 2.6 Rewards: `collectReward` for each reward collected.
    - Test: `tests/simulation/rewards.test.js`
    - Code: `src/simulation/rewards.js`
    - Decided: one event per reward, whatever its value.
  - [x] 2.7 Restart: when health reaches 0 and the level restarts, the step's events include `playerDefeated` and not `playerHurt` for the hit that took the last health (req 14). The events survive `restartLevel`.
    - Test: `tests/simulation/step.test.js` (by enemy contact and by a pit)
    - Code: `src/simulation/step.js`
    - Decided: on restart, `step` removes the step's `playerHurt` events and adds `playerDefeated` at the end; the step's other events are kept. `restartLevel` doesn't touch `events`.
  - [x] 2.8 Game flow events: the game state gains `events`, emptied at the start of each `stepGame` and `chooseMenuOption`. While playing, it holds the level step's events; `reachGoal` when the level is completed; `menuMove` when up or down actually changes the selection (not at the ends); `menuChoose` when an option is chosen, by confirm or by `chooseMenuOption` (a click). Cut scene timed sounds are **not** flow events; the audio player works them out from the cut scene clock (task 3.4).
    - Test: `tests/simulation/flow.test.js`
    - Code: `src/simulation/flow.js`
    - Decided: `copyGame` starts every new game state with an empty `events` list, so both `stepGame` and `chooseMenuOption` begin empty. `choose` records `menuChoose`, so confirm and clicks share it. While playing, the game's events are the level step's, then `reachGoal` if the goal was reached that step. Under the level-complete panel the level isn't stepped, so its old events aren't repeated. Cut scene steps have no events.

- [x] 3.0 Build the audio player: which music plays on each screen, jingles, cut scene sounds, sound effects, mute, and browser unlock (reqs 8–13, 15, 17–18, 20–22, 25)
  - [x] 3.1 Test helper: a recording fake audio backend. It has the operations the player needs (for example `playMusic(path, { loop })`, `stopMusic()`, `playSound(path)`, `setMuted(muted)`, `isLocked()`, `unlock()`), and it records each call in order. A test can set whether it starts locked and which paths fail to play.
    - Test: `tests/helpers/fake-audio.test.js`
    - Code: `tests/helpers/fake-audio.js`
    - Decided: `createFakeAudioBackend({ locked, failing })` records `{ op, args }` in `calls` (with `callsOf(op)`), like the fake canvas; `isLocked()` is answered, not recorded; `playMusic`/`playSound` return false for paths in `failing`. The backend's operations are documented once, at the top of `src/presentation/audio.js`.
  - [x] 3.2 Music by screen: `createAudioPlayer({ data, backend, log })` with `update(game, events)`, called once per frame. Start screen → `startMusic`; playing → the level's `music`; cut scene → its `music`; anything not named → no music. Music loops (req 8). Changing screens cuts straight to the new track; if it's the same file, it keeps playing without restarting (req 9). Finished and "Thanks for playing" → silence (req 11).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: `wantedMusic(data, game)` gives `{ path, loop }` or null for the screen; the player only calls the backend when the path changes (`stopMusic` when it becomes null), so nothing named and nothing playing makes no calls at all. `currentMusic()` is the path playing, or null.
  - [x] 3.3 Level complete and restart: with a `completeJingle`, the level music stops and the jingle plays once, not looping; without one, the level music keeps playing (req 10). A level restart doesn't restart the music (req 11).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: on the level-complete screen the wanted music is the jingle with `loop: false`; it replaces the level music (playMusic stops what was playing), and since its path stays the same under the panel it isn't restarted; after it ends there is silence until the next screen. A restart keeps the screen and level, so the music carries on.
  - [x] 3.4 Cut scene sounds: each timed sound plays once, on the first frame where the cut scene's time has reached its `time`, including several in one frame. When the cut scene ends or is skipped, sounds not yet reached never play (req 11–12).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: the player keeps `{ name, next }` for the cut scene showing (the index of its next sound, the list being in time order) and forgets it when the screen isn't a cut scene, so seeing the cut scene again starts its sounds over.
  - [x] 3.5 Sound effects: each event with a sound in `audio.json` plays it; events without one are silent. The same event several times in one frame plays once; different events in one frame all play (reqs 13, 15).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: events are played in the order they first happened in the frame (a `Set` of the frame's events).
  - [x] 3.6 Mute: `toggleMute()` mutes and unmutes the backend; music keeps its place (the player doesn't restart it); effects and cut scene sounds while muted are skipped, not played later (reqs 17–18). Starts unmuted (req 20). `isMuted()` for the label and overlay.
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: while muted the player still follows the screens' music (silently, through the backend's mute), so unmuting plays the right track at the point it has reached; effects aren't sent to the backend at all, and cut scene sounds reached while muted are passed over.
  - [x] 3.7 Browser lock: while the backend is locked, nothing is played and effects are dropped. `unlock()` unlocks the backend and starts the current screen's music from the beginning (req 21). A backend that starts unlocked (Electron) plays the start music at once (req 22).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: the player reads `backend.isLocked()` once, when created, and keeps its own `locked` flag: the real backend's context resumes asynchronously, but sources started right after `resume()` play once it has. `unlock()` does nothing when not locked. Added `soundState()` (`SoundState.ON`, `MUTED`, `LOCKED`; locked shows first) for the overlay and test hook (task 4.6).
  - [x] 3.8 A sound that fails to play: the backend reports the failure; the player logs one warning naming the file (not one per frame) and carries on (req 25).
    - Test: `tests/presentation/audio.test.js`
    - Code: `src/presentation/audio.js`
    - Decided: one warning per file: "Couldn't play the sound file data/<path>, so it will be silent. Check that it is a working Ogg Vorbis or Opus file." Music that fails still counts as playing, so it isn't retried every frame.

- [x] 4.0 Connect sound to the game: the controller, the Web Audio backend, the mute key and "Sound off" label, the debug overlay, and Electron's autoplay setting (reqs 16–19, 21–22, 26)
  - [x] 4.1 Controller: `createGameController` takes an `audio` player. After each `update`, it collects `game.events`; in `draw` (once per frame), it calls the audio player's `update` with the current game and the frame's collected events, then clears them.
    - Test: `tests/presentation/game.test.js` (events from several updates reach the audio player once, in the next draw)
    - Code: `src/presentation/game.js`
    - Decided: events are collected after a menu click (`chooseMenuOption`) as well as after `stepGame`, since the step that follows a click starts with no events. The game tests use a small recording stand-in for the audio player (`fakeAudioPlayer` in `game.test.js`).
  - [x] 4.2 Web Audio backend: `createWebAudioBackend({ context, sounds, log })`, where `context` is an `AudioContext` (a fake in tests). Decodes the loaded `ArrayBuffer`s once at start-up (a file that fails to decode is logged and silent, req 25); plays music looping through one gain node and effects through new buffer sources (so they overlap, req 13); mutes with a master gain of 0; `isLocked()` is the context's `state === 'suspended'`; `unlock()` calls `context.resume()`.
    - Test: `tests/presentation/web-audio.test.js` (with a fake `AudioContext` that records nodes and calls)
    - Code: `src/presentation/web-audio.js`
    - Decided: `createWebAudioBackend({ context, sounds })` (no `log`): a file that fails to decode is left out silently, and playing it returns false, so the audio player's single warning is the only one (otherwise one broken file gave two). It resolves once every file is decoded; `main.js` awaits it before starting the loop. Each effect's source disconnects itself when it ends.
  - [x] 4.3 Mute key: `presentationKeys` reports `mute`; a new press toggles the audio player's mute (like F3 and F11 in `update`).
    - Test: `tests/presentation/input-map.test.js`, `tests/presentation/game.test.js`
    - Code: `src/presentation/input-map.js`, `src/presentation/game.js`
    - Decided: `presentationKeys` now takes `{ keys, gamepads, bindings, deadZone }` (like `inputFromDevices`), because `mute` may also have gamepad buttons (the bindings schema allows it, sound PRD req 16); fullscreen and debug stay keyboard only. Existing tests updated for the new shape and the extra `mute` field.
  - [x] 4.4 Unlocking on the first key press or click: the input reader reports a new key press or click (`activated`), and the controller calls the audio player's `unlock()` on the first one.
    - Test: `tests/presentation/input.test.js`, `tests/presentation/game.test.js`
    - Code: `src/presentation/input.js`, `src/presentation/game.js`
    - Decided: any key counts, bound or not, and any mouse button on the canvas. The controller calls `unlock()` only while the player says it is locked. Chrome's user activation is sticky, so resuming from the next game frame (not inside the event handler) is allowed.
  - [x] 4.5 "Sound off" label: drawn in the top-right corner, in the HUD's font, on every screen while muted, and not otherwise (req 19).
    - Test: `tests/presentation/hud.test.js`, `tests/presentation/game.test.js` (on the start screen, while playing, in a cut scene)
    - Code: `src/presentation/hud.js`, `src/presentation/game.js`
    - Decided: `drawSoundOff(ctx, viewport)` and `SOUND_OFF_TEXT` in `hud.js`: right-aligned, set in by `HUD_MARGIN` font sizes, white over a dark outline like the HUD. Drawn after the screen and before the debug overlay (which covers it when shown).
  - [x] 4.6 Debug overlay: two more lines, the music playing (or "none") and the sound state (on, muted, or locked) (req 26).
    - Test: `tests/presentation/debug-overlay.test.js`
    - Code: `src/presentation/debug-overlay.js`, `src/presentation/game.js`
    - Decided: "Music: <path>" and "Sound: <state>", just before the Steam line (which stays last). The state comes from the audio player's `soundState()` (task 3.7).
  - [x] 4.7 Test hook: the state gains `music` and `sound` (on, muted, locked), so UI checks can confirm audio without hearing it.
    - Test: `tests/presentation/test-hook.test.js`
    - Code: `src/presentation/test-hook.js`
    - Decided: a separate `audioTestState(audio)` gives `{ music, sound }`, and `main.js` merges it into the hook's state, so `gameTestState(game)` and its tests are unchanged.
  - [x] 4.8 Electron autoplay: the window's `webPreferences` include `autoplayPolicy: 'no-user-gesture-required'` (req 22).
    - Test: `tests/electron/window-options.test.js`
    - Code: `electron/window-options.js`
  - [x] 4.9 Architecture rule: simulation files may not use `AudioContext`, `Audio`, or other audio APIs.
    - Test: `tests/architecture.test.js`
    - Code: `tools/architecture.js`
    - Decided: `AudioContext`, `webkitAudioContext`, and `Audio` join the browser globals the simulation may not use; names that only contain them (`playAudio`) are fine.
  - [x] 4.10 Start-up glue: `main.js` creates the `AudioContext`, the Web Audio backend (with `loaded.sounds`), and the audio player, and passes the player to the controller.
    - Test: `tests-ui/sound.spec.js` (red first): in browser mode the start screen's music is the one in `audio.json` and sound is locked; after a key press it is on; after pressing M it is muted. No console errors.
    - Code: `src/presentation/main.js`
    - Decided: the check reads the expected music and mute key from `data/config/audio.json` and `bindings.json`. Playwright's Chromium starts every `AudioContext` running, even with its default `--autoplay-policy` flag removed and `user-gesture-required` set (probed headless and headed), so the lock before the first key press can't be seen there: the check confirms that after a key press sound is on with the start music, and that the mute key mutes and unmutes. The lock is covered by unit tests and needs a manual check in a real browser (task 6.4).

- [ ] 5.0 Create the placeholder audio and add it to the game data (reqs 27–28)
  - [x] 5.1 **(no code)** Choose the Ogg encoder (PRD open question 5). Preferred: an npm dev dependency that encodes Ogg Vorbis in Node, with no native build step (for example a WebAssembly encoder). Check its licence is compatible, that it installs on Windows with plain `npm install`, and that a file it makes plays in Electron's Chromium. Record the choice under this sub-task.
    - Decided: `wasm-media-encoders` 0.7.0 (MIT; WebAssembly, no native build; one dependency, `@swc/helpers`), pinned exactly as a dev dependency. It installed on Windows with plain `npm install`, and a tone it encoded decoded in Playwright's Chromium (the engine Electron uses). Only `tools/make-placeholder-sounds.js` uses it; the game never loads it. (`npm audit` reports a moderate advisory for `fast-uri`, which comes from the existing `ajv` dev dependency, not from this package.)
  - [x] 5.2 Sound synthesis: pure functions that return sample arrays, for example `tone({ frequency, seconds, shape, sampleRate })`, `sweep(...)` (rising or falling pitch), `envelope(samples, { attack, release })`, `noise(...)`, and `sequence(notes)` for simple melodies. Loops must end where they began, so music joins up smoothly.
    - Test: `tests/tools/sound-synth.test.js` (length from duration and sample rate; values stay within -1..1; the envelope starts and ends at 0; a sequence is the sum of its notes' lengths)
    - Code: `tools/sound-synth.js`
    - Decided: `Waveform` (`SINE`, `SQUARE`, `TRIANGLE`), `tone`, `sweep`, `noise` (seeded, so remaking the files gives the same noise), `envelope`, `sequence` (each note fades in and out over 5 ms; `frequency: null` is a rest), `mix` (clipped to ±1), and `concat`. The envelope turns `-0` into `0`.
  - [x] 5.3 The generator: `tools/make-placeholder-sounds.js` lists every placeholder (start music, one track per level, cut scene music, a jingle, every `SoundEvent`, one cut scene sound), builds each with the synth, encodes it, and writes it under a folder it is given (default `data/audio/`). Add `"sounds": "node tools/make-placeholder-sounds.js"` to `package.json`.
    - Test: `tests/tools/make-placeholder-sounds.test.js` (into a temporary folder: one Ogg file per listed sound, each starting with the Ogg signature `OggS`; the list covers every `SoundEvent`)
    - Code: `tools/make-placeholder-sounds.js`, `package.json`
    - Decided: the folder argument is a data folder (default `data/`) and the files go under its `audio/`, so `PLACEHOLDERS` paths are the same paths the JSON files use. `PlaceholderMusic` names the music files; each event's file is `audio/sounds/<event>.ogg` (`soundFor(event)`); the cut scene sound is `audio/sounds/cutscene-crash.ogg`. Mono, 44.1 kHz, Vorbis quality 3. Music loops are 4–4.8 s, each in its own key and sound; effects are 0.05–1.1 s.
  - [ ] 5.4 **(no code)** Run `npm run sounds` and commit the files in `data/audio/`. Listen to each one: they should be short, clearly different from each other, and the music loops should join smoothly.
    - Done so far: generated the 20 files (about 247 KB). Decoded every one in Chromium: lengths as designed, no clipping (loudest peak 0.71), and the music loops start and end within 0.011 of silence. Still to do: listen to them, and commit.
  - [x] 5.5 **(no code)** Game data: create `data/config/audio.json` (start music and every event's sound); add `"mute": ["KeyM"]` to `bindings.json`; give both levels `music`, and give **one** a `completeJingle` so both behaviours of req 10 can be heard; give the cut scene `music` and at least one timed sound. `npm test` (data validation) passes.
    - Decided: level 1 has the jingle (it is followed by the cut scene), level 2 keeps its music playing under the panel. The cut scene's crash plays at 4 s, when the beetle comes in. (`"mute": ["KeyM"]` was added in task 1.5.)

- [ ] 6.0 Write the documentation and verify the whole feature (reqs 29–31; success metrics 1–8)
  - [ ] 6.1 **(no code)** `docs/data-formats.md`: the `audio.json` format, the new level and cut scene fields, sound path rules, the `mute` binding, and the list of sound event names.
  - [ ] 6.2 **(no code)** `docs/guide-sound.md`: where files go; Ogg Vorbis or Opus, and how to export them from common tools (for example Audacity); music loops, so the end must join the start; keep effects short; keep loudness consistent; how to name music and sounds in each file; the sound event list; the `reachGoal` and jingle advice (PRD Section 6); the common error messages and what they mean. Point to it from `docs/guide-sprites.md` ("Sound and video"), `docs/guide-levels.md`, and `docs/guide-cutscenes.md`.
  - [ ] 6.3 **(no code)** `docs/developer-guide.md`: how to regenerate placeholder sounds (`npm run sounds`), and that sound is silent in browser mode until a key press or click.
  - [ ] 6.4 **(no code)** `docs/manual-test-checklist.md`: listening checks for each screen's music, a sample of effects, the jingle on one level and continuing music on the other, the cut scene's timed sound, skipping a cut scene, mute and the "Sound off" label, and the browser-mode unlock.
  - [ ] 6.5 **(no code)** Run `npm test` and `npm run test:ui`; all pass.
  - [ ] 6.6 **(no code)** Manual play-through in Electron (`npm start`) following the new checklist (success metrics 1–3), and in browser mode (`npm run web`; success metric 4). Record any problems as new sub-tasks.
  - [ ] 6.7 **(no code)** Performance: play a level for a minute with music and frequent effects (punching, jumping, collecting) with the debug overlay on; fps stays at about 60 (success metric 8).
  - [ ] 6.8 **(no code)** Answer the PRD's remaining open questions (1–4) with the user and update `prd-sound.md`; add any resulting work as new sub-tasks.
