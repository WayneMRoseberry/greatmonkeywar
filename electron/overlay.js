// The Steam overlay settings (task 8.7; PRD reqs 11-12; docs/steam-overlay.md).
// Electron's `app` and the steamworks.js module are passed in, so tests use fakes.

/**
 * The Chromium switches the Steam overlay needs in Electron: the overlay hooks
 * the game's drawing, so the GPU work must run in the main process
 * (in-process-gpu), and on Windows DirectComposition must be off so the
 * overlay can draw over the window (disable-direct-composition).
 *
 * KNOWN ISSUE (to solve later): these aren't enough on a PC whose graphics
 * driver Chromium blocklists. Chromium then draws in software, and the
 * overlay has no GPU drawing to hook: no notice, and Shift+Tab does nothing.
 * The frame rate also drops below 60. Found on an AMD A8-8650 (Radeon R7)
 * with driver 8.17.10.1404: app.getGPUFeatureStatus() showed gpu_compositing
 * "disabled_software" and 45 FPS. With the ignore-gpu-blocklist switch,
 * Chromium used the GPU (Direct3D 11), ran at 60 FPS, and Shift+Tab and F12
 * worked (checked by hand, 2026-10-27). Options: add that switch here (it
 * risks the driver bugs the blocklist exists for; others report random
 * crashes), and/or tell players to update their graphics driver.
 */
export const OVERLAY_SWITCHES = ['in-process-gpu', 'disable-direct-composition'];

/**
 * Turns on what the overlay needs. It must run before the app is ready:
 * Chromium reads its switches at start-up. Uses the steamworks.js Electron
 * helper (which also keeps the window repainting every frame, as the overlay
 * needs) when the module is available, and makes sure the switches are set
 * either way. Returns true if applied; false, with a warning, if it was too late.
 */
export function applyOverlaySettings({ app, steamworks, log }) {
  if (app.isReady()) {
    log('The Steam overlay settings must be applied before the app is ready; they were not applied.');
    return false;
  }
  steamworks?.electronEnableSteamOverlay();
  for (const name of OVERLAY_SWITCHES) {
    if (!app.commandLine.hasSwitch(name)) app.commandLine.appendSwitch(name);
  }
  return true;
}
