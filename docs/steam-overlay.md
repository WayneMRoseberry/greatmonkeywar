# Steam Overlay Settings

The Steam overlay (Shift+Tab) and the Steam screenshot key (F12) need some extra settings to work in an Electron app on Windows (PRD requirements 11–12). This page lists each setting, why it's needed, and how it affects the frame rate.

All of them are applied in [electron/overlay.js](../electron/overlay.js), which [electron/main.js](../electron/main.js) calls **before the app is ready**. Chromium reads its start-up switches only once, when it starts, so a setting applied later does nothing. If that ever happens, `applyOverlaySettings` logs a warning instead of failing quietly.

## The settings

| Setting | What it does | Why the overlay needs it |
|---|---|---|
| `steamworks.electronEnableSteamOverlay()` | The steamworks.js helper for Electron. It makes every window repaint each frame, and sets the two switches below. | Steam draws the overlay when the game draws a frame. Chromium normally only repaints when something on the page changes, so without this the overlay can freeze or not appear. The game's canvas changes every frame anyway, so this costs little. |
| `in-process-gpu` (Chromium switch) | Runs Chromium's GPU work in the app's main process instead of a separate GPU process. | Steam hooks into the process that draws the game. With a separate GPU process, the drawing happens somewhere Steam isn't hooked into, and the overlay never shows. |
| `disable-direct-composition` (Chromium switch) | Turns off DirectComposition, the Windows feature Chromium normally uses to put the window's contents on screen. | With DirectComposition, Windows puts the window's pixels on screen directly, past the drawing calls Steam hooks. Turning it off lets the overlay draw on top of the game. |

`overlay.js` sets the two switches itself as well, if they aren't already set. That keeps them on even if a future steamworks.js version stops setting them, or if steamworks.js fails to load. The game still starts without Steam in that case (requirement 9).

## Frame rate (requirement 12)

The game must hold 60 FPS (requirement 4) with these settings on. To measure it: run `npm start` with Steam running, press F3 to show the debug overlay, and read the FPS line while playing each level.

| Date | PC (CPU, GPU, screen refresh rate) | Level 1 FPS | Level 2 FPS | Cut scene FPS | Notes |
|---|---|---|---|---|---|
| 2026-10-26 | AMD A8-8650 with Radeon R7 graphics, 60 Hz, window 1264 × 681 | 45 (settings on), 48 (settings off) | not measured | not measured | Steam running and connected. Frames counted for 10 s on the level 1 start, standing still, by a script driving the app through Playwright. **Below the 60 FPS target**: Chromium was drawing in software (see [GPU blocklist](#known-issue-the-gpu-blocklist)). |
| 2026-10-27 | Same PC, started with `--ignore-gpu-blocklist` | 60 | not measured | not measured | Drawn on the GPU (Direct3D 11). Measured the same way. |

## Known issue: the GPU blocklist

Chromium refuses to use graphics drivers it knows to be buggy, and draws in software instead. Then the overlay has no GPU drawing to hook (no notice appears, and Shift+Tab and F12 do nothing), and the frame rate drops.

Found on an AMD A8-8650 with driver 8.17.10.1404 (about ten years old). With `npx electron --ignore-gpu-blocklist .`, Chromium used the GPU, the overlay and F12 worked, and the game ran at 60 FPS. Not fixed yet. The options are adding `ignore-gpu-blocklist` to the settings in `overlay.js` (which risks the driver bugs the blocklist exists for; others report random crashes) and/or telling players to update their graphics driver. To see what Chromium is doing, check `app.getGPUFeatureStatus()` in the main process: `gpu_compositing: "disabled_software"` means it is drawing in software.

## When to check again

Check the overlay and the frame rate again whenever Electron or steamworks.js is upgraded. A new Chromium can change how the window is drawn. Use the Steam section of the [manual test checklist](manual-test-checklist.md).
