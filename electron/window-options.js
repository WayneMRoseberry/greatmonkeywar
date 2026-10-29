// The Electron window and how it loads the game (PRD reqs 1-2, Technical
// Considerations). Kept apart from main.js so it can be unit-tested.

import { resolveRequestPath } from '../tools/serve.js';

/**
 * The scheme the game is loaded from. Chromium doesn't let file:// pages fetch
 * files, and the game fetches its data, so main.js serves the game's files on
 * app://game/ instead (registered as a standard, secure scheme that supports fetch).
 */
export const APP_SCHEME = 'app';
export const START_URL = `${APP_SCHEME}://game/index.html`;

/**
 * The BrowserWindow options: secure web preferences and the preload script.
 * Unlike a browser, the game may start its music before the player presses a
 * key or clicks (sound PRD req 22).
 */
export function windowOptions(preloadPath) {
  return {
    width: 1280,
    height: 720,
    title: 'Great Monkey War',
    backgroundColor: '#000000',
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      autoplayPolicy: 'no-user-gesture-required',
    },
  };
}

/**
 * The file for an app:// address, under `root` (the repository), or null if
 * it isn't one of the game's files. Uses the browser-mode server's rules
 * (only index.html, src/, and data/; no climbing out with ..).
 */
export function appFileFor(requestUrl, root) {
  let pathname;
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    return null;
  }
  return resolveRequestPath(root, pathname);
}
