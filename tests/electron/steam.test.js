// Tests for Steam start-up and the overlay settings (tasks 8.5-8.7; PRD reqs 8-12),
// with a fake steamworks module and a fake Electron app.
//
// startSteam(steamworks, log) starts Steam with Valve's test app ID 480 and
// gives { status, userName } for the platform (electron/ipc.js). If Steam
// isn't running or start-up fails, it logs a clear message and reports Steam
// as unavailable; it never throws, so the game always starts (req 9).
// applyOverlaySettings({ app, steamworks, log }) turns on what the Steam
// overlay needs in Electron, before the app is ready (req 11).
// Decided:
//  - the steamworks module itself may fail to load (no native build for this
//    machine); main.js then calls startSteam with null, which counts as unavailable;
//  - applying the overlay settings after the app is ready is too late:
//    nothing is changed and a warning is logged.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  startSteam, STEAM_APP_ID, STEAMWORKS_NOT_LOADED, steamConnectedMessage, steamUnavailableMessage,
} from '../../electron/steam.js';
import { applyOverlaySettings, OVERLAY_SWITCHES } from '../../electron/overlay.js';
import { SteamStatus } from '../../src/platform/platform.js';

/** A fake steamworks module: init succeeds with a client whose player is `name`, or throws `error`. */
function fakeSteamworks({ name = 'Wayne', error } = {}) {
  return {
    initCalls: [],
    overlayEnabled: 0,
    init(appId) {
      this.initCalls.push(appId);
      if (error) throw error;
      return { localplayer: { getName: () => name } };
    },
    electronEnableSteamOverlay() { this.overlayEnabled++; },
  };
}

describe('starting Steam (8.5, reqs 8-9)', () => {
  test('it starts with Valve\'s public test app ID, 480', () => {
    const steamworks = fakeSteamworks();
    startSteam(steamworks, () => {});
    assert.equal(STEAM_APP_ID, 480);
    assert.deepEqual(steamworks.initCalls, [480]);
  });

  test('on success it reports connected, and logs it', () => {
    const logs = [];
    const name = 'Wayne';
    const result = startSteam(fakeSteamworks({ name }), (m) => logs.push(m));
    assert.equal(result.status, SteamStatus.CONNECTED);
    assert.deepEqual(logs, [steamConnectedMessage(name)]);
  });

  test('on failure (Steam not running) it reports unavailable, logs the reason, and doesn\'t throw', () => {
    const logs = [];
    const reason = 'Steam is not running';
    const failing = fakeSteamworks({ error: new Error(reason) });
    let result;
    assert.doesNotThrow(() => { result = startSteam(failing, (m) => logs.push(m)); });
    assert.deepEqual(result, { status: SteamStatus.UNAVAILABLE, userName: null });
    assert.deepEqual(logs, [steamUnavailableMessage(reason)]);
  });

  test('with no steamworks module at all (it failed to load), Steam is unavailable', () => {
    const logs = [];
    assert.deepEqual(startSteam(null, (m) => logs.push(m)), { status: SteamStatus.UNAVAILABLE, userName: null });
    assert.deepEqual(logs, [steamUnavailableMessage(STEAMWORKS_NOT_LOADED)]);
  });
});

describe('the user name (8.6, req 10)', () => {
  test('when connected, the result carries the Steam user\'s display name', () => {
    assert.equal(startSteam(fakeSteamworks({ name: 'Wayne' }), () => {}).userName, 'Wayne');
  });

  test('if the name can\'t be read, Steam still counts as connected, with a placeholder name', () => {
    const steamworks = { init: () => ({ localplayer: { getName: () => { throw new Error('no name'); } } }) };
    const result = startSteam(steamworks, () => {});
    assert.equal(result.status, SteamStatus.CONNECTED);
    assert.equal(result.userName, '(unknown)');
  });
});

describe('the overlay settings (8.7, req 11)', () => {
  /** A fake Electron app: records command-line switches; ready or not. */
  function fakeApp({ ready = false } = {}) {
    const switches = new Set();
    return {
      switches,
      isReady: () => ready,
      commandLine: { appendSwitch: (name) => switches.add(name), hasSwitch: (name) => switches.has(name) },
    };
  }

  test('the switches are in-process-gpu and disable-direct-composition', () => {
    assert.deepEqual(OVERLAY_SWITCHES, ['in-process-gpu', 'disable-direct-composition']);
  });

  test('before the app is ready, it uses the steamworks.js Electron helper and makes sure both switches are set', () => {
    const app = fakeApp();
    const steamworks = fakeSteamworks();
    assert.equal(applyOverlaySettings({ app, steamworks, log: () => {} }), true);
    assert.equal(steamworks.overlayEnabled, 1);
    for (const name of OVERLAY_SWITCHES) assert.ok(app.switches.has(name), name);
  });

  test('without the steamworks module, the switches are still set (the overlay needs them)', () => {
    const app = fakeApp();
    assert.equal(applyOverlaySettings({ app, steamworks: null, log: () => {} }), true);
    for (const name of OVERLAY_SWITCHES) assert.ok(app.switches.has(name), name);
  });

  test('once the app is ready it is too late: nothing is changed, and a warning is logged', () => {
    const app = fakeApp({ ready: true });
    const steamworks = fakeSteamworks();
    const logs = [];
    assert.equal(applyOverlaySettings({ app, steamworks, log: (m) => logs.push(m) }), false);
    assert.equal(steamworks.overlayEnabled, 0);
    assert.equal(app.switches.size, 0);
    assert.match(logs[0], /before the app is ready/);
  });
});
