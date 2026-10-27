// The main process's side of the preload bridge (tasks 8.4, 8.6). The Electron
// parts it uses are passed in, so tests use fakes.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CHANNELS } = require('./preload.cjs');

/**
 * Answers the bridge's calls: getSteamInfo with `steamInfo` ({ status,
 * userName }, from Steam's start-up, electron/steam.js); toggleFullscreen
 * switches the current window's fullscreen; quit quits the app.
 */
export function registerPlatformHandlers({ ipcMain, getWindow, app, steamInfo }) {
  ipcMain.handle(CHANNELS.STEAM_INFO, () => steamInfo);
  ipcMain.on(CHANNELS.TOGGLE_FULLSCREEN, () => {
    const window = getWindow();
    if (window) window.setFullScreen(!window.isFullScreen());
  });
  ipcMain.on(CHANNELS.QUIT, () => app.quit());
}
