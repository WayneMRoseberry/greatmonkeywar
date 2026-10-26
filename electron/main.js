// The Electron main process: start-up glue only (tasks 8.3-8.7). Everything it
// wires together is unit-tested on its own (tests/electron/); this file is
// checked by launching the app (docs/manual-test-checklist.md).
//
// Before the app is ready: the Steam overlay settings (they must come first),
// the app:// scheme, and Steam itself. Then the window, loading the game from
// app://, with the preload bridge answered by ipc.js.

import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { windowOptions, START_URL, APP_SCHEME, appFileFor } from './window-options.js';
import { registerPlatformHandlers } from './ipc.js';
import { startSteam } from './steam.js';
import { applyOverlaySettings } from './overlay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (message) => console.log(message);

let steamworks = null;
try {
  steamworks = createRequire(import.meta.url)('steamworks.js');
} catch (error) {
  log(`steamworks.js could not be loaded: ${error.message}`);
}

applyOverlaySettings({ app, steamworks, log });
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const steamInfo = startSteam(steamworks, log);

let window = null;
registerPlatformHandlers({ ipcMain, getWindow: () => window, app, steamInfo });

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME, (request) => {
    const file = appFileFor(request.url, ROOT);
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response('Not found', { status: 404 });
  });
  window = new BrowserWindow(windowOptions(path.join(ROOT, 'electron', 'preload.cjs')));
  window.removeMenu();
  window.on('closed', () => { window = null; });
  window.loadURL(START_URL);
});

app.on('window-all-closed', () => app.quit());
