# Manual Test Checklist

Checks that the automated tests can't do (PRD requirement 95). Run the whole list:

- before the prototype is considered done;
- again whenever Electron or steamworks.js is upgraded.

For each run, copy the results table at the bottom, fill it in, and add it under [Results](#results).

## Before you start

- `npm install` has been run, and `npm test` passes.
- You have a Windows PC with Steam installed and logged in.
- You have a standard gamepad (for example an Xbox controller) for section 4.
- You have speakers or headphones for section 7.

Keys used below: arrows or A/D to move, Space, W or Up to jump, E or X for action (pick up, drop, throw), Q or C to punch, Enter to choose, F3 for the debug overlay, F11 for fullscreen, M to mute. On a gamepad: d-pad or left stick to move, A to jump and choose, X for action, B to punch. Menu options (Start, Next level, Exit game) can also be clicked with the mouse.

## 1. Electron app, with Steam running

1. Start Steam and log in.
2. Run `npm start`.
3. **Check:** the game window opens on the start screen, with no error screen, and shows the hint "Enter / A or click: choose" under Start.
4. Click Start with the mouse. **Check:** level 1 starts. (Close and run `npm start` again to carry on from the start screen.)
5. Press F3. **Check:** the debug overlay shows Steam as connected, with your Steam display name (requirement 10).
6. Press Shift+Tab. **Check:** the Steam overlay opens over the game. Press Shift+Tab again to close it (requirement 11).
7. While playing a level, press F12. **Check:** Steam shows that a screenshot was taken, and it shows the game screen (View > Screenshots in Steam) (requirement 11).
8. With the debug overlay on, play each level for a minute. **Check:** FPS stays at 60. Record it in the frame rate table in [steam-overlay.md](steam-overlay.md) (requirement 12).

## 2. Electron app, without Steam

1. Quit Steam completely (Steam > Exit).
2. Run `npm start`.
3. **Check:** the game starts and is playable (requirement 9).
4. **Check:** the terminal shows a message saying Steam is unavailable and the game runs without it.
5. Press F3. **Check:** the debug overlay shows Steam as unavailable.

## 3. Window size and fullscreen

In the Electron app:

1. Drag the window to be very wide and short, then tall and narrow, then small. **Check:** the game is never stretched or squashed, and the health and reward count stay readable (Success Metric 9).
2. Press F11. **Check:** the game goes fullscreen, still undistorted. Press F11 again. **Check:** it goes back to a window.
3. Maximise the window, then restore it. **Check:** the game redraws at the new size each time.

## 4. Gamepad play

1. Connect the gamepad, then start the game (either mode).
2. **Check:** you can choose Start with A, then move, jump, pick up and throw a coconut, stack the crates, and punch an enemy, all with the gamepad.
3. Press F3. **Check:** the debug overlay shows the gamepad as the input device while you use it, and the keyboard again after you press a key.
4. **Check:** with the left stick resting at the centre, the player doesn't drift.

## 5. Browser mode

1. Run `npm run web` and open <http://localhost:8765> in Chrome, then in Edge.
2. **Check:** the game loads on the start screen and is playable with the keyboard (Success Metric 10).
3. Press F3. **Check:** Steam is shown as unavailable.
4. Press F11. **Check:** the page goes fullscreen. Press F11 again to leave.
5. Finish level 2 and choose Exit. **Check:** the "Thanks for playing" screen shows, because a web page can't close itself (requirement 7).

## 6. Cut scene playback

1. Play level 1 to the goal and choose Next level.
2. **Check:** the cut scene plays: the camp background, the hero running in and stopping, a beetle following, and the three narration lines, each shown in turn.
3. **Check:** the background keeps its proportions in a wide or tall window, with the side colour filling the rest.
4. Restart the game, play level 1 again, and this time press Enter (or A on a gamepad) partway through the cut scene. **Check:** it skips straight to level 2.

## 7. Sound

The game uses placeholder sounds: simple tones, each clearly different. These checks are about the right sound playing at the right time, not about how it sounds. In each step, F3's `Music:` line shows which music file should be playing.

In the Electron app (`npm start`):

1. **Check:** the start screen's music starts as soon as the window opens, with no key press needed (sound PRD req 22). Press Down or Up. **Check:** nothing (the start menu has one option). Choose Start. **Check:** the choose sound, then level 1's music, which is different from the start music (req 9).
2. In level 1, do each of these and **check** each has its own short sound: jump, land, punch the air, pick up a crate, put it down (down + action), pick it up and throw it, stomp the beetle, collect a reward, and get hurt by an enemy (reqs 13–14). Walk off a ledge. **Check:** a landing sound, but no jump sound.
3. Fall into a pit until your health runs out. **Check:** the last fall has a different sound from the earlier ones, and the music keeps playing through the restart without starting over (req 11).
4. Reach level 1's goal. **Check:** the music stops and a short jingle plays once, then silence under the level-complete panel (level 1 has a `completeJingle`, req 10). Move between Next level and Exit game. **Check:** a menu sound for each move.
5. Choose Next level. **Check:** the cut scene has its own calm music, and a crash plays when the beetle comes in, at about 4 seconds (req 12).
6. Let the cut scene finish. **Check:** level 2's music starts. Reach level 2's goal. **Check:** level 2's music keeps playing under the panel (level 2 has no jingle).
7. Restart the game, play level 1 again, and skip the cut scene before the crash. **Check:** the crash never plays, and level 2's music starts at once.
8. Press M. **Check:** all sound stops and "Sound off" shows in the top-right corner, on the start screen, in a level, and in the cut scene. Wait a few seconds, then press M again. **Check:** the music comes back where it had got to, not from the start, and the sounds made while muted aren't played late (reqs 17–19).
9. With the debug overlay on, play a level for a minute with lots of jumping, punching, and collecting. **Check:** FPS stays at about 60 (sound PRD success metric 8).

In browser mode (`npm run web`, in Chrome and in Edge):

10. Load the game and don't touch anything. **Check:** silence, and F3 shows `Sound: locked` (browsers block sound until a key press or click). Press any key. **Check:** the start music starts from the beginning, and F3 shows `Sound: on` (req 21).
11. Reload, and click the canvas instead of pressing a key. **Check:** the same.
12. **Check:** the browser's developer console (F12) shows no warnings or errors about sound files.

## Results

Copy this table for each run.

| Section | Pass / Fail | Notes |
|---|---|---|
| 1. Electron app, with Steam running | | |
| 2. Electron app, without Steam | | |
| 3. Window size and fullscreen | | |
| 4. Gamepad play | | |
| 5. Browser mode | | |
| 6. Cut scene playback | | |
| 7. Sound | | |

Run by: ______  Date: ______  Electron version: ______  steamworks.js version: ______

### 2026-10-27

| Section | Pass / Fail | Notes |
|---|---|---|
| 1. Electron app, with Steam running | Pass, with a workaround | Steam name shown in the debug overlay. Shift+Tab and F12 worked only when started with `npx electron --ignore-gpu-blocklist .`; with `npm start`, Chromium blocklists this PC's graphics driver and the overlay can't hook in (see the KNOWN ISSUE in `electron/overlay.js` and [steam-overlay.md](steam-overlay.md)). |
| 2. Electron app, without Steam | Pass | |
| 3. Window size and fullscreen | Pass | |
| 4. Gamepad play | Pass | |
| 5. Browser mode | Pass | |
| 6. Cut scene playback | Pass | |

Run by: Wayne  Date: 2026-10-27  PC: AMD A8-8650 with Radeon R7 graphics (driver 8.17.10.1404)  Electron version: 45.0.0  steamworks.js version: 0.4.0
