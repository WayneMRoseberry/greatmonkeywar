// The browser platform (PRD reqs 7, 9; see platform.js): used when the game
// runs in a normal web browser (npm run web). The document is passed in, so
// tests use a fake.

import { SteamStatus } from './platform.js';

/** Logged once when the browser platform is created (req 9). */
export const BROWSER_STEAM_UNAVAILABLE_MESSAGE = 'Steam is unavailable in browser mode; the game runs without it.';

/**
 * In the browser, Steam is unavailable (logged once, req 9), fullscreen uses
 * the Fullscreen API on the whole page, and quit asks for the "Thanks for
 * playing" screen, because a page can't close itself (req 7).
 */
export function createBrowserPlatform({ document, log }) {
  log(BROWSER_STEAM_UNAVAILABLE_MESSAGE);
  return {
    getSteamStatus: () => SteamStatus.UNAVAILABLE,
    getSteamUserName: () => null,
    toggleFullscreen() {
      const request = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      Promise.resolve(request).catch((error) => log(`Couldn't switch fullscreen: ${error.message}`));
    },
    quit: () => ({ showThanks: true }),
  };
}
