// Tests for the page-side Electron platform (tasks 8.4, 8.6; PRD reqs 10, 71),
// with a fake preload bridge.
//
// createElectronPlatform(bridge) asks the bridge for Steam's status and user
// name once, at start-up (it resolves when it has them), so getSteamStatus and
// getSteamUserName can answer every frame. toggleFullscreen and quit go
// through the bridge; quit doesn't ask for the thanks screen, because the app
// closes itself.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createElectronPlatform, ELECTRON_BRIDGE } from '../../src/platform/electron-platform.js';
import { SteamStatus } from '../../src/platform/platform.js';
import { platformContract } from './contract.js';
import { createRequire } from 'node:module';

/** A fake bridge answering getSteamInfo with `info`, and counting the other calls. */
function fakeBridge(info) {
  return {
    toggles: 0,
    quits: 0,
    getSteamInfo: () => Promise.resolve(info),
    toggleFullscreen() { this.toggles++; },
    quit() { this.quits++; },
  };
}

const CONNECTED = { status: SteamStatus.CONNECTED, userName: 'Wayne' };
const UNAVAILABLE = { status: SteamStatus.UNAVAILABLE, userName: null };

// The contract is synchronous, so the platform is made from an already-answered bridge.
const ready = new Map();
for (const info of [CONNECTED, UNAVAILABLE]) ready.set(info.status, await createElectronPlatform(fakeBridge(info)));
platformContract('Electron', ({ steam }) => ready.get(steam));

describe('the Electron platform', () => {
  test('the bridge is found on the window under the name the preload script gives it', () => {
    const { BRIDGE_NAME } = createRequire(import.meta.url)('../../electron/preload.cjs');
    assert.equal(ELECTRON_BRIDGE, BRIDGE_NAME);
  });

  test('it reports the Steam status and user name the main process gave (8.6)', async () => {
    const platform = await createElectronPlatform(fakeBridge(CONNECTED));
    assert.equal(platform.getSteamStatus(), SteamStatus.CONNECTED);
    assert.equal(platform.getSteamUserName(), 'Wayne');
  });

  test('it asks the bridge only once, however often it is asked', async () => {
    let asked = 0;
    const bridge = { ...fakeBridge(CONNECTED), getSteamInfo: () => { asked++; return Promise.resolve(CONNECTED); } };
    const platform = await createElectronPlatform(bridge);
    for (let i = 0; i < 5; i++) platform.getSteamStatus();
    assert.equal(asked, 1);
  });

  test('toggleFullscreen and quit go through the bridge; quit doesn\'t ask for the thanks screen', async () => {
    const bridge = fakeBridge(UNAVAILABLE);
    const platform = await createElectronPlatform(bridge);
    platform.toggleFullscreen();
    assert.deepEqual(platform.quit(), { showThanks: false });
    assert.equal(bridge.toggles, 1);
    assert.equal(bridge.quits, 1);
  });

  test('if asking the bridge fails, Steam counts as unavailable', async () => {
    const bridge = { ...fakeBridge(CONNECTED), getSteamInfo: () => Promise.reject(new Error('no main process')) };
    const platform = await createElectronPlatform(bridge);
    assert.equal(platform.getSteamStatus(), SteamStatus.UNAVAILABLE);
    assert.equal(platform.getSteamUserName(), null);
  });
});
