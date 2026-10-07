# PRD: Engine Prototype

Source requirements: [docs/requirements.md](../docs/requirements.md). Requirement IDs such as `REQ-3.2` refer to that document.

## 1. Introduction / Overview

Great Monkey War is a 2D side-scrolling game that will be sold on Steam. It is written in HTML and JavaScript and runs inside Electron.

Before we design the actual game, we need a working **engine prototype**. It is a small playable demo with two levels. In it, a hero can run, jump, pick things up, drop and throw them, collect rewards, avoid obstacles, fight enemies, and reach a goal at the end of each level, in front of a scrolling background with parallax (layers that move at different speeds to suggest depth). It can be played with a keyboard or a gamepad.

The prototype is **not** the game. Its purpose is to:

1. prove the core engine works (rendering, physics, collision, input, camera, game loop);
2. prove the code/data split works, so artists and level designers can change content without touching code;
3. prove the testing and quality gates work: unit tests, pre-commit checks, and GitHub pull request checks;
4. prove the game runs as an Electron desktop app connected to Steam, including the Steam overlay;
5. give us something to play so we can make decisions about game design and architecture.

## 2. Goals

1. Two playable levels that together demonstrate every behaviour listed in Section 4, including moving from one level to the next and exiting the game.
2. All level layout, entity placement, level order, tuning values, input bindings, and art references come from JSON data files. None of them are hard-coded.
3. Game logic runs and is unit-tested in plain Node.js, with no browser or display.
4. Unit tests and data validation run automatically before every commit and as required checks on every pull request to `main`.
5. The game launches as an Electron app, connects to Steam using Valve's public test app ID (480), and the Steam overlay works.
6. The game can be played with a keyboard or a gamepad.
7. The game scales to any window size without distortion.
8. The game runs at a steady 60 frames per second on a typical desktop PC.

## 3. User Stories

**Player**
- As a player, I want to run left and right and jump, so that I can move through the level.
- As a player, I want to pick up an object, carry it, and drop or throw it, so that I can use objects to solve problems and defeat enemies.
- As a player, I want to collect reward items and see my count go up, so that I feel rewarded for exploring.
- As a player, I want enemies that can hurt me and that I can defeat by jumping on them, punching them, or hitting them with a thrown object, so that the level has challenge.
- As a player, I want the background to scroll with depth as I move, so that the world feels alive.
- As a player, I want to reach a goal at the end of a level and then choose to continue to the next level or exit, so that I have a sense of progress.
- As a player, I want to play with a gamepad or a keyboard, so that I can use whichever I prefer, including on a Steam Deck.
- As a player, I want to open the Steam overlay while playing, so that I can chat with friends and take screenshots.

**Level designer (non-programmer)**
- As a level designer, I want to build and change a level by editing a documented JSON file, so that I don't need to write code.
- As a level designer, I want a clear error message when my level file has a mistake, so that I can fix it myself.

**Artist (non-programmer)**
- As an artist, I want to add a sprite sheet and describe its animations in a JSON file, so that my art appears in the game without code changes.

**Developer**
- As a developer, I want game logic to be testable without a browser, so that tests are fast and reliable.
- As a developer, I want to run the game in a normal browser, so that I can test and debug it quickly without building the desktop app.
- As a developer, I want broken code or data to be blocked before commit and before merge, so that `main` always works.
- As a developer, I want the ability to create and execute automated checks that run against the UI. Playwright is an acceptable framework for accessing the web-based interface.

## 4. Functional Requirements

### 4.1 Application and host

1. The game must run as an Electron desktop application (REQ-2.3).
2. The game must open in a window and support switching to fullscreen.
3. The game must render to a single HTML `<canvas>` element using the Canvas 2D API. No game framework (such as Phaser) may be used (answer 1A).
4. The game must run at a target of 60 frames per second.
5. Game logic must update on a **fixed time step** (for example 1/60 of a second per update), separate from drawing. Then the game behaves the same on fast and slow machines, and tests can step the simulation exactly.
6. The game must scale freely to the window:
   - the canvas always fills the window and resizes when the window is resized or switched to fullscreen;
   - the game is never stretched or squashed (one world unit is always square on screen);
   - the amount of the world visible vertically is fixed and comes from data (for example "12 tiles high"), so a wider window shows more of the level horizontally.
7. For testing convenience, the game must also run in a normal web browser (Chrome or Edge) without Electron. In browser mode:
   - Steam is reported as unavailable (requirement 9) and the game is fully playable;
   - fullscreen uses the browser's fullscreen feature;
   - "Exit game" (requirement 52) shows a "Thanks for playing" screen, because a web page cannot close itself.

### 4.2 Steam integration

8. The app must initialise Steam with steamworks.js using Valve's public test app ID `480` (answer 5C).
9. If Steam is not running, initialisation fails, or the game is running in browser mode, the game must still start and be playable. It must log a clear message that Steam is unavailable.
10. When Steam is connected, the game must show the Steam user's display name in a debug overlay. This proves the connection works.
11. The Steam overlay must work in the Electron app on Windows: pressing Shift+Tab opens it over the game, and the Steam screenshot key (F12) captures the game screen.
12. With the settings needed for the overlay turned on, the game must still meet the 60 FPS target (requirement 4). The settings (for example Chromium startup flags) and the reason for each one must be documented in `docs/`.
13. All Steam calls must go through the platform layer (section 4.11). Game logic must never call steamworks.js directly.

### 4.3 Input and controls

14. The game must support keyboard and gamepad at the same time. The player can switch between them at any moment without changing a setting.
15. The game must support standard gamepads (Xbox-style layout) through the browser's Gamepad API. This includes a Steam Deck's built-in controls, which Steam presents to games as an Xbox-style controller.
16. Movement must work with both the left analog stick and the D-pad. The stick dead zone (how far the stick must move before it counts) comes from data.
17. All keyboard key and gamepad button bindings must come from a data file.
18. Keyboard and gamepad input must be translated into a single device-independent **input state** (left, right, up, down, jump, action, confirm) before it reaches the simulation. The simulation must not know which device is in use.
19. Menus (the level-complete screen, requirement 50) must be usable with the keyboard and with a gamepad.

Default bindings:

| Action | Keyboard | Gamepad |
|---|---|---|
| Move left / right | Left / Right arrows, or A / D | Left stick or D-pad |
| Down (for drop) | Down arrow or S | Left stick down or D-pad down |
| Jump | Space, Up arrow, or W | A |
| Action (pick up / throw) | E or X | X |
| Drop | Down + Action | Down + X |
| Menu: move selection | Up / Down arrows | Left stick or D-pad |
| Menu: confirm | Enter or Space | A |
| Toggle fullscreen | F11 | — |
| Toggle debug overlay | F3 | — |

### 4.4 Player (hero)

20. The player must move left and right.
21. The player must jump. Jump height and gravity come from data.
22. The player must not be able to jump again while in the air (no double jump).
23. The player must collide with solid tiles. They cannot pass through walls, floors, or ceilings.
24. The player must have health. Starting health comes from data (suggested default: 3).
25. When the player takes damage:
    - they lose 1 health;
    - they are briefly knocked back;
    - they cannot be damaged again for a short time (suggested default: 1 second), during which they visibly flash.
26. If the player falls below the bottom of the level, they lose 1 health and respawn at the level's start point.
27. When health reaches 0, the current level restarts. Everything returns to how it was when the level started: the level's enemies, objects, and rewards, and the player's health and reward count.

### 4.5 Pick up, drop, and throw

28. Each level must contain at least one kind of **carriable object** (for example a crate or coconut), placed via the level data.
29. When the player is not holding anything and is touching a carriable object, pressing **action** picks it up. The object is then drawn above the player's head and moves with the player.
30. The player can hold only one object at a time.
31. While holding an object, pressing **action** throws it forward in the direction the player is facing, in an arc. Throw speed comes from data.
32. While holding an object, pressing **down + action** drops it gently at the player's feet.
33. A thrown object that hits an enemy must defeat that enemy. The object then falls to the ground and can be picked up again.
34. Thrown and dropped objects must collide with solid tiles and come to rest on the ground. Some objects (e.g. boxes or crates) will have attributes that allow them to be dropped on top of each other - this allows players to do things like build stairs and platforms.

### 4.6 Reward items

35. Each level must contain reward items (for example bananas), placed via the level data.
36. When the player touches a reward item, it disappears and the player's reward count increases by the item's value (from data; default 1).
37. The current reward count and health must be shown in a simple on-screen display (HUD).

### 4.7 Obstacles

38. Levels must support solid tiles: ground, walls, and platforms.
39. Each level must contain gaps (pits) the player can fall into (see requirement 26).
40. Each level must contain at least one obstacle the player has to jump over or onto to make progress.

### 4.8 Enemies

41. Each level must contain enemies placed via the level data. There must be at least one enemy type.
42. Enemies must walk back and forth (patrol). They turn around when they hit a wall or reach the edge of a platform.
43. Enemies must be affected by gravity and collide with solid tiles.
44. When the player touches an enemy from the side or below, the player takes damage (requirement 25).
45. When the player lands on top of an enemy while falling, the enemy is defeated and the player bounces upward (answer 3B).
46. A defeated enemy is removed from the level, after an optional short defeat animation or flash.

### 4.9 Levels and level completion

47. The prototype must include **two levels**.
48. The order of levels must come from a data file (a level list), not code. Levels my indicate a cut scene that displays when the user selects to go to the next level. The game must open with a start screen and button to begin.
49. Each level must have exactly one player start point and exactly one **goal** (for example a flag), both placed via the level data.
50. When the player touches the goal, the level is complete:
    - gameplay stops (the player can no longer move, and enemies stop);
    - a level-complete screen appears, showing the reward count;
    - the screen offers **Next level** and **Exit game**. On the last level in the list, only **Exit game** is offered.
51. Choosing **Next level** loads the next level in the list. The player's health and reward count carry over into it (see Open Questions).
52. Choosing **Exit game** closes the application through the platform layer. In browser mode, see requirement 7.

### 4.10 Camera and parallax background

53. The camera must follow the player horizontally, and vertically if the level is taller than the visible area.
54. The camera must not show areas outside the level boundaries. If the window shows more than the level's full width or height, the level must be centred and the extra space filled with a background colour from data.
55. Levels must support multiple background layers, defined in data. Each layer has a **scroll factor**: 0 means it never moves, 1 means it moves with the level, and values in between create depth.
56. Each prototype level must use at least three background layers with different scroll factors.
57. Background layers must be able to repeat horizontally so they cover a level of any width.

### 4.11 Architecture: code/data separation and testability

58. The code must be split into three clearly separated parts:
    - **Simulation (game logic):** physics, collision, player, enemies, objects, rewards, health, level completion, and game state. It must not use the DOM, canvas, browser APIs, Electron, or Steam. It must run in plain Node.js (REQ-4.2).
    - **Presentation:** rendering, input reading (keyboard and gamepad), the HUD, menus, and audio. It reads simulation state and draws it, and turns device input into the input state (requirement 18) that it passes to the simulation.
    - **Platform layer:** a small interface for host and Steam features: Steam user, Steam overlay, fullscreen, quit, and later achievements and saving. It has three implementations: Electron+Steam, browser (requirement 7), and a fake for tests.
59. Each simulation update must take the current state, the input state, and the time step, and produce the next state. A test must be able to say "with these inputs, step 60 times, then check where the player is" without a browser.
60. All of the following must come from JSON data files, not code (REQ-3.2):
    - level layout (tile grid);
    - player start position and goal position;
    - placement of enemies, carriable objects, and reward items;
    - background layers, their scroll factors, and the background fill colour;
    - the level list (level order);
    - physics and gameplay tuning values (gravity, run speed, jump strength, throw speed, starting health, invincibility time, etc.);
    - visible world height and gamepad stick dead zone;
    - sprite sheets and animations;
    - keyboard and gamepad bindings.
61. Levels must use a **custom JSON format** that is edited by hand (answer 4A). The format must be documented in `docs/` with an annotated example, written for non-programmers (REQ-3.4).
62. The level format must represent the tile grid in a way that is readable when edited by hand. For example, an array of strings where each character is a tile type, with a legend that maps characters to tile types.

### 4.12 Art pipeline

63. By default, every entity must be drawn as a simple coloured shape: the player, enemies, objects, rewards, the goal, and tiles (answer 2D). Colours come from data.
64. The engine must support **sprite sheets**: an image plus a JSON file that describes the frame size and named animations (frame list and speed).
65. The player must use a sprite-sheet animation for at least idle and run, to prove the pipeline works. A simple placeholder sprite sheet is fine.
66. If an entity's data references a sprite that is missing, the game must fall back to the coloured shape and log a warning. It must not crash.
67. The sprite sheet JSON format must be documented in `docs/` for artists (REQ-3.4).
68. Any audio or video assets must use open formats: Ogg Vorbis or Opus for audio, WebM for video.

### 4.13 Data validation

69. There must be a validation script that checks every JSON data file (levels, level list, sprite sheets, tuning, bindings) against its expected format (REQ-3.5).
70. Validation must catch at least:
    - invalid JSON syntax;
    - missing required fields;
    - wrong value types;
    - level rows of different lengths;
    - unknown tile characters;
    - entities placed outside the level;
    - a level without exactly one player start and exactly one goal;
    - a level list that names a level file that doesn't exist;
    - references to sprite or image files that don't exist.
71. Every validation error must name the file, say where in the file the problem is, and explain what is wrong in plain language. For example: `levels/level1.json: row 7 has 58 tiles but row 1 has 60. All rows must be the same length.`
72. The game must run the same validation when loading data. If the data is invalid, it must show the error on screen instead of crashing silently.

### 4.14 Testing and quality gates

73. There must be automated unit tests for the simulation. At minimum they must cover:
    - running;
    - jumping, including the no-double-jump rule;
    - landing and tile collision;
    - pick up, drop, and throw;
    - collecting rewards;
    - enemy patrol and turning;
    - stomping an enemy;
    - a thrown object defeating an enemy;
    - player damage, invincibility, and knockback;
    - falling into a pit;
    - level restart at 0 health, restoring the state from the start of the level;
    - reaching the goal completes the level;
    - moving to the next level carries over health and reward count;
    - the last level offers only "Exit game";
    - translating keyboard and gamepad input into the input state, including the stick dead zone;
    - the camera staying within the level boundaries, and centring a level smaller than the visible area;
    - visible area calculation for different window sizes and aspect ratios;
    - parallax offset calculation.
74. There must be tests for the data validator, including that each error type in requirement 70 is detected and produces a readable message.
75. A single command (for example `npm test`) must run all tests and data validation.
76. Tests and data validation must run automatically before each commit using a Git pre-commit hook. The commit must be blocked if they fail (REQ-4.3, REQ-4.5).
77. The pre-commit hook must install automatically when a developer runs `npm install`, so there is no manual setup step.
78. A GitHub Actions workflow must run tests and data validation on every pull request to `main` (REQ-4.4).
79. The `main` branch must be configured in GitHub (branch protection) to require that workflow to pass before merging.
80. Behaviour that unit tests cannot check must be covered by a written **manual test checklist** in `docs/`. At minimum it covers the Steam overlay and screenshot key, gamepad play, window resizing and fullscreen, and browser mode. The checklist must be run before the prototype is considered done, and again whenever Electron or steamworks.js is upgraded.

## 5. Non-Goals (Out of Scope)

- Real game design: story, characters, the meaning of "monkey war," or final art and audio.
- More than two levels, a level select screen, a title screen, a settings screen, or a pause menu. The level-complete screen is the only menu.
- Saving progress or Steam Cloud saves.
- Steam achievements, stats, leaderboards, or a real Steam app ID.
- Rebinding controls in game. Bindings are changed by editing the data file.
- A visual level editor, whether in-game or external such as Tiled.
- Automatically reloading the game when a data file changes (live reload).
- Sound effects and music. Audio playback can wait, but the asset format rules in requirement 68 still apply.
- Packaging into an installer or uploading builds to Steam.
- macOS, Linux, and Steam Deck builds. Development and testing target Windows for the prototype. Gamepad support is built with the Steam Deck in mind but does not have to be tested on one.
- A fixed pixel-art resolution. The game scales freely (requirement 6).
- WebGL rendering.
- Performance optimisation beyond meeting 60 FPS on the prototype levels.

## 6. Design Considerations

- Shapes-first art keeps the focus on engine behaviour. Use clearly different colours for each kind of thing (player, enemy, carriable object, reward, goal, solid tile) so the demo is easy to read.
- The debug overlay (F3) should show:
  - frames per second;
  - player position and velocity;
  - whether the player is on the ground;
  - the held object;
  - the current input device (keyboard or gamepad);
  - window size and visible world area;
  - Steam connection status and user name.

  Optionally it can also outline collision boxes.
- The HUD is simple text or icons in a corner: health and reward count. It must stay readable and in the corner at any window size.
- The level-complete screen is a simple panel over the frozen game: a "Level complete" title, the reward count, and the available options, with the selected option clearly highlighted.
- Because the game scales freely, shapes and sprites will be drawn at many sizes. Art should not depend on being shown at an exact pixel size.
- Documentation for designers and artists (requirements 61 and 67) is part of the deliverable, not an afterthought. Write it for someone who has never seen JSON before.

## 7. Technical Considerations

- **Language and modules:** modern JavaScript with ES modules. TypeScript is not required.
- **Suggested folder layout:**
  ```
  src/
    simulation/    # pure game logic, runs in Node (no DOM)
    presentation/  # canvas rendering, input, HUD, menus
    platform/      # platform interface + electron/steam, browser, and fake implementations
  electron/        # Electron main process, preload, steamworks.js setup
  data/
    levels/        # level JSON files + level list
    sprites/       # sprite sheet images + JSON
    config/        # tuning values, bindings, display settings
  tools/           # data validation script, local web server for browser mode
  tests/           # unit tests
  docs/            # requirements, designer/artist guides, manual test checklist
  ```
- **Browser mode:** browsers block ES modules and loading JSON files from pages opened directly from disk (`file://` addresses). Browser mode therefore needs a small local web server, started with one command (for example `npm run web`), that serves the game at a `http://localhost` address. Keep the server dependency-free or very small.
- **Electron security:** keep `contextIsolation` on and `nodeIntegration` off in the game window. Steam and other Node features must be exposed to the page only through a preload script that implements the platform layer.
- **steamworks.js:** it is a native Node module and must load in Electron's main process. Using app ID 480 requires Steam to be running and a `steam_appid.txt` file containing `480` next to the executable during development.
- **Steam overlay:** the overlay hooks the game's graphics output, which Electron normally does in a separate GPU process and only when the page changes. steamworks.js provides a helper for Electron that applies the needed Chromium startup flags (such as running the GPU in the main process and, on Windows, disabling DirectComposition). The game loop already redraws continuously, which the overlay also needs. Check performance and stability with these flags on (requirement 12).
- **Gamepad:** the Gamepad API is polled once per frame rather than sending events. Use the browser's "standard" button mapping so Xbox-style controllers and Steam Input map the same way. Treat this as presentation code; only the resulting input state reaches the simulation.
- **Scaling:** size the canvas to the window in device pixels (taking `window.devicePixelRatio` into account) so it stays sharp. Compute the world-to-screen scale from the window height and the visible world height. Keep this calculation a pure function so it can be unit-tested.
- **Testing tools:** prefer Node's built-in test runner (`node:test`) to keep dependencies small. Use another runner only if there is a clear reason, and document it.
- **Pre-commit hook:** a small tool such as Husky, or a script run from npm `prepare`, can install the hook.
- **Validation:** a JSON Schema library (such as Ajv) can check structure, but checks like matching row lengths and missing files need custom code. Error messages must be rewritten into plain language either way (requirement 71).
- **Collision:** axis-aligned bounding boxes (AABB) against the tile grid, resolving the X and Y axes separately. This is sufficient and simple to test.
- **Determinism:** the fixed time step and the absence of hidden randomness in the simulation make tests repeatable. If randomness is needed, use a seeded random number generator passed in through state.
- **Licensing:** Electron and its bundled components require their license files to be kept in the distributed app.

## 8. Success Metrics

1. Every behaviour in requirements 14–57 can be shown by playing through both levels, using the keyboard and using a gamepad.
2. The prototype holds 60 FPS on both levels on a typical Windows desktop PC, with the Steam overlay settings on (checked with the debug overlay).
3. `npm test` passes, and every bullet in requirements 73–74 has at least one test.
4. A commit with a failing test or invalid data file is blocked locally, and a pull request with one cannot be merged into `main`.
5. A person who does not write code can follow the docs to add a new enemy, reward item, and platform to a level, and see them in game, without help.
6. When Steam is running, the Electron app shows the Steam user's name in the debug overlay, Shift+Tab opens the Steam overlay, and F12 takes a screenshot. When Steam is not running, the game still runs.
7. Changing a tuning value (for example jump strength) in the JSON file changes the game's behaviour with no code changes.
8. Resizing the window to any size or aspect ratio, or switching to fullscreen, keeps the game undistorted with the HUD readable.
9. The game is playable in Chrome or Edge in browser mode.
10. Every item on the manual test checklist (requirement 80) passes.

## 9. Open Questions

1. Should health and reward count carry over from one level to the next? This PRD assumes yes (requirement 51).
2. When should gamepad support be scheduled? It is a requirement now; its timing will be set when tasks are defined.
3. After the prototype, should levels move to Tiled or another visual editor? This decision is deferred until we see how hand-editing JSON works for designers.
