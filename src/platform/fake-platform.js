// A fake platform for tests (see platform.js): reports the Steam status and
// user name it is given, and counts fullscreen toggles and quits.

import { SteamStatus } from './platform.js';

export function createFakePlatform({ steam = SteamStatus.UNAVAILABLE, userName = 'Player', showThanks = false } = {}) {
  return {
    fullscreenToggles: 0,
    quits: 0,
    getSteamStatus: () => steam,
    getSteamUserName: () => (steam === SteamStatus.CONNECTED ? userName : null),
    toggleFullscreen() { this.fullscreenToggles++; },
    quit() {
      this.quits++;
      return { showThanks };
    },
  };
}
