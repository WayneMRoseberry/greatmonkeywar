// The Electron platform (tasks 8.4, 8.6; see platform.js): the page's side.
// It talks to the main process only through the preload bridge
// (electron/preload.cjs), which puts it on the window.

import { SteamStatus } from './platform.js';

/** The name the preload script gives the bridge on the window. */
export const ELECTRON_BRIDGE = 'greatMonkeyWarPlatform';

const UNAVAILABLE = { status: SteamStatus.UNAVAILABLE, userName: null };

/**
 * The platform for the bridge. It asks for Steam's status and user name once,
 * resolving when it has them (or treating Steam as unavailable if the asking
 * fails), so getSteamStatus and getSteamUserName answer at once every frame.
 * quit doesn't ask for the thanks screen: the app closes itself.
 */
export async function createElectronPlatform(bridge) {
  let steam;
  try {
    steam = (await bridge.getSteamInfo()) ?? UNAVAILABLE;
  } catch {
    steam = UNAVAILABLE;
  }
  return {
    getSteamStatus: () => steam.status,
    getSteamUserName: () => (steam.status === SteamStatus.CONNECTED ? steam.userName : null),
    toggleFullscreen() { bridge.toggleFullscreen(); },
    quit() {
      bridge.quit();
      return { showThanks: false };
    },
  };
}
