// The platform layer's interface (PRD reqs 9-13, 71): everything the game
// needs from where it runs, so game code never calls Electron, Steam, or the
// browser's fullscreen and window features directly.
//
// A platform is an object with these methods:
//  - getSteamStatus(): SteamStatus.CONNECTED or SteamStatus.UNAVAILABLE;
//  - getSteamUserName(): the Steam user's display name when connected, else null;
//  - toggleFullscreen(): switches fullscreen on or off; returns nothing, never throws;
//  - quit(): ends the game; returns { showThanks }, true if the game can't
//    close itself (browser mode) and should show "Thanks for playing" (req 7).
// Implementations: fake-platform.js (tests), browser-platform.js, and
// electron-platform.js. tests/platform/contract.js checks each of them.

/** Whether Steam is connected. */
export const SteamStatus = Object.freeze({
  CONNECTED: 'connected',
  UNAVAILABLE: 'unavailable',
});

/** The methods every platform has. */
export const PLATFORM_METHODS = Object.freeze(['getSteamStatus', 'getSteamUserName', 'toggleFullscreen', 'quit']);
