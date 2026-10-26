// The preload script and its bridge (task 8.4; PRD reqs 10, 71, Technical
// Considerations). CommonJS, because Electron runs sandboxed preload scripts
// as CommonJS; and one file, because a sandboxed preload script can't require
// other files of ours.
//
// The page can't use Node or Electron; this gives it only the bridge, which
// forwards the platform's calls to the main process over IPC (electron/ipc.js
// answers them). Nothing the page passes is forwarded. The bridge is tested on
// its own (tests/electron/preload-api.test.js); the glue at the bottom only
// runs inside Electron's renderer.
'use strict';

/** The IPC channels between the bridge and the main process. */
const CHANNELS = Object.freeze({
  STEAM_INFO: 'platform:steam-info',
  TOGGLE_FULLSCREEN: 'platform:toggle-fullscreen',
  QUIT: 'platform:quit',
});

/** The name the bridge has on the page's window (src/platform/electron-platform.js ELECTRON_BRIDGE). */
const BRIDGE_NAME = 'greatMonkeyWarPlatform';

/**
 * The bridge for `ipcRenderer`: { getSteamInfo, toggleFullscreen, quit }.
 * getSteamInfo() resolves to { status, userName } from the main process;
 * toggleFullscreen() and quit() send their messages.
 */
function createPlatformBridge(ipcRenderer) {
  return Object.freeze({
    getSteamInfo: () => ipcRenderer.invoke(CHANNELS.STEAM_INFO),
    toggleFullscreen: () => { ipcRenderer.send(CHANNELS.TOGGLE_FULLSCREEN); },
    quit: () => { ipcRenderer.send(CHANNELS.QUIT); },
  });
}

module.exports = { CHANNELS, BRIDGE_NAME, createPlatformBridge };

// Glue: in Electron's renderer, put the bridge on the page's window. Elsewhere
// (tests, the main process) contextBridge doesn't exist and this does nothing.
const { contextBridge, ipcRenderer } = require('electron');
if (contextBridge) contextBridge.exposeInMainWorld(BRIDGE_NAME, createPlatformBridge(ipcRenderer));
