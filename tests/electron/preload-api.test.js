// Tests for the preload bridge and the main process's side of it (tasks 8.4,
// 8.6; PRD reqs 10, 71, Technical Considerations), with fake ipcRenderer and ipcMain.
//
// The page can't use Node or Electron (contextIsolation on, nodeIntegration
// off); the preload script gives it one object, the bridge, with only the
// platform's calls, which it forwards over IPC to the main process.
// Decided:
//  - the bridge is { getSteamInfo, toggleFullscreen, quit }: getSteamInfo()
//    resolves to { status, userName } from the main process (asked once, at
//    start-up, so the page's getSteamStatus can answer every frame without
//    waiting); toggleFullscreen and quit just send a message;
//  - the main process (registerPlatformHandlers) answers getSteamInfo with
//    Steam's start-up result, toggles the window's fullscreen, and quits the app.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { registerPlatformHandlers } from '../../electron/ipc.js';

const require = createRequire(import.meta.url);
const { createPlatformBridge, CHANNELS } = require('../../electron/preload.cjs');

/** A fake ipcRenderer that records what is sent and answers invoke from `answers`. */
function fakeIpcRenderer(answers = {}) {
  return {
    sent: [],
    invoked: [],
    send(channel, ...args) { this.sent.push([channel, ...args]); },
    invoke(channel, ...args) { this.invoked.push([channel, ...args]); return Promise.resolve(answers[channel]); },
  };
}

describe('the preload bridge (task 8.4)', () => {
  test('it has exactly the platform\'s calls, all functions, and nothing else', () => {
    const bridge = createPlatformBridge(fakeIpcRenderer());
    assert.deepEqual(Object.keys(bridge).sort(), ['getSteamInfo', 'quit', 'toggleFullscreen']);
    for (const value of Object.values(bridge)) assert.equal(typeof value, 'function');
  });

  test('it doesn\'t hand the page ipcRenderer itself', () => {
    const ipc = fakeIpcRenderer();
    const bridge = createPlatformBridge(ipc);
    assert.ok(!Object.values(bridge).includes(ipc));
    assert.ok(Object.isFrozen(bridge));
  });

  test('getSteamInfo asks the main process and gives its answer', async () => {
    const info = { status: 'connected', userName: 'Wayne' };
    const ipc = fakeIpcRenderer({ [CHANNELS.STEAM_INFO]: info });
    assert.deepEqual(await createPlatformBridge(ipc).getSteamInfo(), info);
    assert.deepEqual(ipc.invoked, [[CHANNELS.STEAM_INFO]]);
  });

  test('toggleFullscreen and quit send their messages', () => {
    const ipc = fakeIpcRenderer();
    const bridge = createPlatformBridge(ipc);
    bridge.toggleFullscreen();
    bridge.quit();
    assert.deepEqual(ipc.sent, [[CHANNELS.TOGGLE_FULLSCREEN], [CHANNELS.QUIT]]);
  });

  test('the bridge passes on nothing the page gives it', () => {
    const ipc = fakeIpcRenderer();
    const bridge = createPlatformBridge(ipc);
    bridge.toggleFullscreen('anything', { at: 'all' });
    bridge.quit(42);
    assert.deepEqual(ipc.sent, [[CHANNELS.TOGGLE_FULLSCREEN], [CHANNELS.QUIT]]);
  });
});

describe('the main process\'s side (tasks 8.4, 8.6)', () => {
  /** A fake ipcMain recording its handlers and listeners. */
  function fakeIpcMain() {
    return {
      handlers: {},
      listeners: {},
      handle(channel, fn) { this.handlers[channel] = fn; },
      on(channel, fn) { this.listeners[channel] = fn; },
    };
  }

  function setUp(steamInfo = { status: 'unavailable', userName: null }) {
    const ipcMain = fakeIpcMain();
    const window = { fullScreen: false, isFullScreen() { return this.fullScreen; }, setFullScreen(on) { this.fullScreen = on; } };
    const app = { quits: 0, quit() { this.quits++; } };
    registerPlatformHandlers({ ipcMain, getWindow: () => window, app, steamInfo });
    return { ipcMain, window, app };
  }

  test('getSteamInfo is answered with Steam\'s start-up result, including the user\'s name (8.6)', async () => {
    const info = { status: 'connected', userName: 'Wayne' };
    const { ipcMain } = setUp(info);
    assert.deepEqual(await ipcMain.handlers[CHANNELS.STEAM_INFO](), info);
  });

  test('toggleFullscreen switches the window\'s fullscreen on, then off', () => {
    const { ipcMain, window } = setUp();
    ipcMain.listeners[CHANNELS.TOGGLE_FULLSCREEN]();
    assert.equal(window.fullScreen, true);
    ipcMain.listeners[CHANNELS.TOGGLE_FULLSCREEN]();
    assert.equal(window.fullScreen, false);
  });

  test('quit quits the app', () => {
    const { ipcMain, app } = setUp();
    ipcMain.listeners[CHANNELS.QUIT]();
    assert.equal(app.quits, 1);
  });

  test('with no window (closing), toggleFullscreen does nothing', () => {
    const ipcMain = fakeIpcMain();
    registerPlatformHandlers({ ipcMain, getWindow: () => null, app: { quit() {} }, steamInfo: { status: 'unavailable', userName: null } });
    assert.doesNotThrow(() => ipcMain.listeners[CHANNELS.TOGGLE_FULLSCREEN]());
  });
});
