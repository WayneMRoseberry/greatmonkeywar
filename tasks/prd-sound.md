# PRD: Sound

Builds on [prd-engine-prototype.md](prd-engine-prototype.md). Numbers like "engine req 81" refer to that document's functional requirements; plain numbers refer to this one.

## 1. Introduction / Overview

The engine prototype is silent. The engine PRD deliberately left audio out ("Audio playback can wait"), and only fixed the file formats: Ogg Vorbis or Opus (engine req 81).

This feature adds sound to the game:

- **music** on the start screen, during each level, and during each cut scene;
- **sound effects** when things happen: the player jumps, punches, gets hurt, collects a reward, moves through a menu, and so on;
- **sounds placed at set times in a cut scene**, the way narration lines are;
- a **mute key**.

As with everything else in the engine, *which* sound plays is data, not code. Levels, cut scenes, and a new audio settings file name the sound files, so a designer can change the music or a sound effect by editing JSON. Until real audio exists, the project ships simple generated placeholder sounds (beeps and tones) so the system can be heard and tested.

## 2. Goals

1. The start screen, every level, and every cut scene can each have its own music, named in data.
2. Every event listed in requirement 14 plays its sound effect, named in data.
3. A cut scene can play sounds at set times.
4. Each level decides what happens to the music when it is completed: the music keeps playing, or it stops and a short "level complete" jingle plays.
5. The player can turn all sound off and on with one key.
6. Mistakes in audio data (a missing file, a misspelled event name, a wrong file type) are caught by `npm run validate` and the game's data error screen, like every other data mistake (engine reqs 82–85).
7. The decisions about *when* sounds happen are unit-tested in plain Node.js, with no browser and no audio device (engine goal 3).
8. The game has placeholder music and sound effects for everything above, so it is never silent where a sound is expected.

## 3. User Stories

**Player**
- As a player, I want music on the start screen, so that the game feels alive before I press Start.
- As a player, I want each level and cut scene to have music, so that each part of the game has its own mood.
- As a player, I want to hear my actions (jumping, landing, punching, throwing, picking things up), so that the controls feel responsive.
- As a player, I want to hear when I hurt an enemy, get hurt, or collect a reward, so that I notice what happened even when I'm looking elsewhere on screen.
- As a player, I want menu sounds when I move the selection and choose, so that I know my input registered.
- As a player, I want to mute the game with one key, so that I can play quietly or listen to something else.

**Level designer (non-programmer)**
- As a level designer, I want to choose each level's and cut scene's music in its JSON file, so that I can set the mood without code.
- As a level designer, I want to decide per level whether the music keeps playing when the level is completed or a jingle plays instead, so that important levels can end with a fanfare.
- As a level designer, I want to place sounds at set times in a cut scene, so that I can time a crash or a shout to the action.
- As a level designer, I want a clear error message when I name a sound file that doesn't exist, so that I can fix it myself.

**Sound designer / artist (non-programmer)**
- As a sound designer, I want to replace a placeholder sound by dropping in a new file (or changing one path in JSON), so that I don't need a programmer.
- As a sound designer, I want a guide that says which formats, lengths, and loudness to use, so that my files work the first time.

## 4. Functional Requirements

### Audio files

1. Sound files live under `data/audio/`. Music goes in `data/audio/music/` and sound effects in `data/audio/sounds/`. This is a convention for tidiness; the game accepts any path inside `data/`.
2. A sound file must be Ogg Vorbis (`.ogg`) or Opus in an Ogg container (`.opus`), per engine req 81. Any other extension is a data error.
3. Data files refer to sound files the same way they refer to images: a path relative to `data/`, with the extension, for example `"audio/music/level1.ogg"`. The path rules are the same as for images (letters, digits, `_` and `-` in each part, `/` between parts; no `..`).

### Where music and sounds are named

4. A new **audio settings** file, `data/config/audio.json`, is required (like `display.json`). It holds:
   - `formatVersion`: always `1`;
   - `startMusic` (optional): the start screen's music;
   - `sounds` (optional): an object mapping each **sound event name** (requirement 14) to a sound file, for example `{ "jump": "audio/sounds/jump.ogg" }`. Any event not listed is silent.
5. A **level** file may have:
   - `music` (optional): the level's music;
   - `completeJingle` (optional): a short piece played once when the level is completed (requirement 10).
6. A **cut scene** file may have:
   - `music` (optional): the cut scene's music;
   - `sounds` (optional): a list of `{ "time": <seconds>, "sound": "<path>" }`, played at those times after the cut scene starts (requirement 12). Times must be 0 or more, in time order, like narration.
7. Anything optional that is left out means silence there. A game with no audio data at all runs exactly as it does today.

### Music

8. All music loops: when a track reaches its end it starts again from the beginning, until something else replaces or stops it.
9. Each screen's music starts when that screen begins, from the beginning of the track:
   - **start screen**: `startMusic` from `audio.json`;
   - **playing a level**: that level's `music`;
   - **cut scene**: that cut scene's `music`.

   Changing music cuts straight from the old track to the new one, with no fade.

   *Exception:* if the next screen's track is the **same file** as the one already playing, it keeps playing without restarting (so two levels that share a track play it continuously).
10. When the player reaches the goal and the level-complete panel appears:
    - if the level has a `completeJingle`, the level's music stops and the jingle plays **once** (it does not loop). After it ends there is silence until the next screen;
    - if it has none, the level's music keeps playing under the panel.
11. Other moments:
    - **The level restarts** (the player's health reaches 0, engine req 27): the music keeps playing; it does not start over.
    - **A cut scene ends or is skipped**: its music stops, any of its timed sounds that haven't played yet don't play, and the next screen's music starts.
    - **The game finishes** (Exit game): all music and sounds stop. The "Thanks for playing" screen is silent.
    - **The data error screen** is silent.

### Cut scene sounds

12. Each entry in a cut scene's `sounds` list plays once, when the cut scene's clock reaches its `time`. The clock is the same one that drives actors and narration, so sounds stay in step with the action.

### Sound effects

13. A sound effect plays once, from the start, each time its event happens. Sound effects can overlap each other and play over the music. If the same event happens again while its sound is still playing, a new copy starts; the old one is not cut off.
14. These are the **sound event names**. Each is defined once in code as a shared constant (for example `SoundEvent.JUMP`), and each can be given a sound in `audio.json`:

    | Name | When it plays |
    |---|---|
    | **Player actions** | |
    | `jump` | The player leaves the ground by jumping (not by walking off a ledge). |
    | `land` | The player comes down onto something solid after being in the air (after a jump, a fall, or a stomp bounce). Not when the level starts or after a respawn. |
    | `punch` | The player starts a punch, whether or not it hits anything. |
    | `pickUp` | The player picks up an object. |
    | `drop` | The player puts down a held object (including onto a stack). |
    | `throw` | The player throws a held object. |
    | **Combat** | |
    | `stomp` | The player defeats an enemy by landing on it. |
    | `enemyDefeated` | An enemy is defeated by a punch or a thrown object. (A stomp plays `stomp` instead, not both.) |
    | `playerHurt` | The player loses health: touched by an enemy, or fell out of the level. |
    | `playerDefeated` | The player's health reaches 0 and the level restarts. (Plays instead of `playerHurt` for the hit that took the last health.) |
    | **Rewards and goal** | |
    | `collectReward` | The player collects a reward item. |
    | `reachGoal` | The player reaches the goal. (Plays at the same moment as the level-complete jingle, if any; keep it short or leave it out for levels with a jingle.) |
    | **Menus** | |
    | `menuMove` | The selected menu option changes, by keyboard or gamepad. (The mouse moving onto another option plays nothing; see Open Questions.) |
    | `menuChoose` | A menu option is chosen, by confirm or by a click. |
15. When the game runs several simulation steps in one frame (engine reqs 4–5), every event from every step plays. If the **same** event happens more than once in the same frame, its sound plays only once in that frame.

### Mute

16. A new input, `mute`, is added to `bindings.json`. Its default keyboard key is `M` (`KeyM`), and it has no gamepad button by default (like `fullscreen`). A designer can rebind it like any other input (engine req 73).
17. A new press of `mute` turns all sound off; the next press turns it back on. Mute works on every screen.
18. While muted, music keeps advancing silently, so unmuting picks up where the track has got to rather than restarting it. Sound effects and cut scene sounds that happen while muted are not played later.
19. While muted, a small "Sound off" label is shown in the top-right corner of the window, on every screen. It disappears when sound is turned back on.
20. Muting lasts until the game is closed. The game always starts with sound on.

### Browser mode and Electron

21. **Browser mode:** browsers don't let a page play sound until the player has pressed a key or clicked (the "autoplay policy"). Until then, the game runs normally but silently. On the first key press or click, sound is unlocked and the music for the current screen starts (from the beginning). Sound effects that happened before that are not played.
22. **Electron (Steam) mode:** sound may start immediately, so the start screen music starts as soon as the start screen appears.

### Loading, validation, and errors

23. The loader (engine req 85, `src/data/load.js`) follows references to sound files the same way it follows references to images, and loads every sound the game data names before the start screen appears. Files nothing refers to are not loaded.
24. `npm run validate` and the in-game data check report, in plain language like every other data problem (engine req 84):
    - a sound path that is not `.ogg` or `.opus`, or isn't a valid path;
    - a named sound file that doesn't exist (in `audio.json`, a level, or a cut scene), naming the field and the missing file;
    - a key in `audio.json`'s `sounds` that isn't a sound event name, listing the valid names (so a misspelling like `"jmup"` is caught);
    - a cut scene sound with a negative time, or sounds not in time order.
25. If a sound file exists but can't be played at run time (for example it's corrupt), the game logs a warning naming the file, stays silent for that sound, and carries on (like a missing sprite, engine req 79). It never shows an error to the player or stops.

### Debug overlay

26. The debug overlay (F3, engine req 10) shows two more lines: the music file currently playing (or "none"), and whether sound is muted or locked (browser mode, before the first key press or click).

### Placeholder audio

27. The project includes generated placeholder audio, made by a script in `tools/` and committed to `data/audio/`, so that it can be regenerated. It includes:
    - one music track for the start screen, one for each level, and one for the cut scene. Each is a short simple loop (a few notes) and each sounds clearly different, so a tester can tell which is playing;
    - a level-complete jingle used by one of the two levels (so both behaviours in requirement 10 can be heard);
    - a sound effect for every event in requirement 14, each clearly different;
    - at least one timed sound in the cut scene.
28. The real game data (`data/`) is updated to use all of the placeholder audio.

### Documentation

29. `docs/data-formats.md` documents `audio.json`, the new level and cut scene fields, the sound path rules, and the `mute` binding.
30. A new guide for sound designers and level designers, `docs/guide-sound.md`, in the same style as the other guides, explains: where to put files; formats (Ogg Vorbis or Opus) and how to export them from common tools; that music loops, so its end should join its start smoothly; keeping sound effects short; keeping loudness consistent between files; how to name music and sounds in each file; and the list of sound events. The "Sound and video" section of `docs/guide-sprites.md` points to it.
31. `docs/manual-test-checklist.md` gets listening checks: each screen's music, a sample of sound effects, the jingle, a cut scene sound, mute, and the browser-mode unlock.

## 5. Non-Goals (Out of Scope)

- A volume slider, an options menu, or separate music and effects volumes (players get mute only; designers get no volume settings).
- Remembering mute between sessions.
- Fading or crossfading between tracks (music changes cut straight, requirement 9).
- Stereo panning or sounds that get quieter with distance.
- Music that changes with the action (for example faster when enemies are near).
- Ambient loops (wind, jungle), enemy footsteps, or any other sound not tied to an event in requirement 14.
- Voice-over and video in cut scenes.
- Final, real audio. Placeholders only.
- A sound for the mouse moving onto a menu option.

## 6. Design Considerations

- **Placeholder sound character:** the placeholders exist so a tester can hear that the right sound plays at the right time. They should be short, simple, and easy to tell apart (different pitches and shapes), not pleasant. A rising tone for `jump`, a low thud for `land`, a short high "ding" for `collectReward`, and so on.
- **The "Sound off" label** uses the HUD's font and size, so it matches the rest of the on-screen text.
- **Levels with a jingle:** because `reachGoal` and the jingle start together, the guide should suggest leaving `reachGoal` silent or very short when most levels use jingles.

## 7. Technical Considerations

- **Keep the simulation pure.** Sound playback belongs to the presentation layer (engine PRD Section 7: "Presentation: rendering, input reading, … and audio"). The simulation must not play sounds or know about audio files. Instead, each step records the **events** that happened in that step (for example, a list of `SoundEvent` values on the level state, emptied at the start of each step), and the game flow records menu and screen events the same way. The presentation layer reads those events after each update and plays the matching sounds. This keeps "did a jump happen?" testable in plain Node.js (goal 7), where the existing simulation tests already run.
- **One audio module with a fake.** An audio player in `src/presentation/` decides what should be playing (current track, sounds to start, muted, locked). It talks to the actual audio through a small backend object that is passed in, like the canvas is. Tests pass a recording fake backend (like `tests/helpers/fake-canvas.js`) and check which tracks and sounds were requested. The real backend uses the Web Audio API (`AudioContext`), which plays short overlapping effects with low delay and loops music cleanly.
- **Shared constants.** Sound event names are a frozen enum-style object (`SoundEvent.JUMP`, …), used by the simulation, the audio player, the validator, and the tests, never repeated as string literals.
- **Electron autoplay.** Set `autoplayPolicy: 'no-user-gesture-required'` in the window's `webPreferences` (`electron/window-options.js`) so requirement 22 holds.
- **Browser unlock.** Resume the `AudioContext` on the first `keydown` or `pointerdown`. Gamepad button presses don't count as user activation in browsers, so a gamepad-only player in browser mode hears nothing until they press a key or click. This is acceptable for browser mode, which is a development and testing mode.
- **Validation tool.** `tools/validate-data.js` currently collects image files from the data folder; it must also collect `.ogg` and `.opus` files so missing-file checks work. File sizes or lengths don't need checking.
- **Architecture test.** `tests/architecture.test.js` should keep audio code out of `src/simulation/` (no `AudioContext`, no audio file paths).
- **Making placeholder Ogg files.** There is no Ogg encoder in the project and `ffmpeg` isn't installed on the main development machine. Options: (a) a dev dependency that encodes Ogg Vorbis in Node (for example a WebAssembly encoder); (b) generate the sounds in Playwright's Chromium with the Web Audio API and record them with `MediaRecorder` as Opus; (c) require `ffmpeg` for whoever regenerates placeholders. (a) is preferred: it runs in plain Node with `npm install` and nothing else. Decide during task planning.
- **Loading time.** All sounds are loaded and decoded before the start screen. For the prototype's handful of short placeholder files this is quick; streaming long music files can wait until real music exists.

## 8. Success Metrics

1. Playing through the whole game (start screen → level 1 → cut scene → level 2 → exit) in Electron, a tester hears the right music on every screen, the jingle on the level that has one, the music continuing on the level that doesn't, and the cut scene's timed sound at the right moment.
2. Every event in requirement 14 plays its sound, confirmed by unit tests (event recorded → sound requested) and by the manual checklist.
3. The mute key silences everything and shows "Sound off"; pressing it again brings the music back where it had got to.
4. In browser mode, the game runs silently until the first key press or click, then plays the current screen's music, with no errors in the console.
5. Each audio data mistake in requirement 24 produces a plain-language error from `npm run validate` and on the data error screen.
6. A non-programmer can replace a placeholder sound with a new Ogg file by following `docs/guide-sound.md`, without help.
7. All unit tests and data validation pass before commit and on pull requests; the simulation's tests still run in plain Node.js with no audio device.
8. The game still runs at a steady 60 frames per second with music and frequent sound effects playing.

## 9. Open Questions

1. Should sound pause when the window loses focus or the Steam overlay opens? (Proposed: no, for this version.)
2. Should the mouse moving onto a different menu option play `menuMove`? (Proposed: no; it's listed as a non-goal.)
3. Should there be a default gamepad button for `mute`? (Proposed: none; the gamepad's buttons are all in use and players rarely mute mid-game.)
4. Should `land` play after very small drops, for example stepping off a single crate? (Proposed: yes, any landing after being in the air; revisit if it's too noisy.)
5. Which way to make the placeholder Ogg files (Section 7)?
