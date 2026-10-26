// The Steam overlay settings (task 8.7; PRD reqs 11-12; docs/steam-overlay.md).
// Electron's `app` and the steamworks.js module are passed in, so tests use fakes.

/**
 * The Chromium switches the Steam overlay needs in Electron: the overlay hooks
 * the game's drawing, so the GPU work must run in the main process
 * (in-process-gpu), and on Windows DirectComposition must be off so the
 * overlay can draw over the window (disable-direct-composition).
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
