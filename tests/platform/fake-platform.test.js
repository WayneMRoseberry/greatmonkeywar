// Tests for the fake platform (task 8.1), used by tests of presentation code.
// createFakePlatform({ steam, userName, showThanks }) follows the platform
// contract and records what was asked of it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakePlatform } from '../../src/platform/fake-platform.js';
import { SteamStatus, PLATFORM_METHODS } from '../../src/platform/platform.js';
import { platformContract } from './contract.js';

platformContract('fake', ({ steam }) => createFakePlatform({ steam, userName: 'Tester' }));

describe('the platform interface', () => {
  test('the methods are getSteamStatus, getSteamUserName, toggleFullscreen, and quit', () => {
    assert.deepEqual([...PLATFORM_METHODS].sort(), ['getSteamStatus', 'getSteamUserName', 'quit', 'toggleFullscreen']);
  });

  test('the Steam statuses are connected and unavailable, and can\'t be changed', () => {
    assert.deepEqual(SteamStatus, { CONNECTED: 'connected', UNAVAILABLE: 'unavailable' });
    assert.ok(Object.isFrozen(SteamStatus));
  });
});

describe('the fake platform', () => {
  test('it reports the Steam status and user name it was given', () => {
    const platform = createFakePlatform({ steam: SteamStatus.CONNECTED, userName: 'Tester' });
    assert.equal(platform.getSteamStatus(), SteamStatus.CONNECTED);
    assert.equal(platform.getSteamUserName(), 'Tester');
  });

  test('by default Steam is unavailable', () => {
    assert.equal(createFakePlatform().getSteamStatus(), SteamStatus.UNAVAILABLE);
  });

  test('it counts fullscreen toggles and quits', () => {
    const platform = createFakePlatform();
    platform.toggleFullscreen();
    platform.toggleFullscreen();
    platform.quit();
    assert.equal(platform.fullscreenToggles, 2);
    assert.equal(platform.quits, 1);
  });

  test('quit returns the showThanks it was given (false by default)', () => {
    assert.deepEqual(createFakePlatform().quit(), { showThanks: false });
    assert.deepEqual(createFakePlatform({ showThanks: true }).quit(), { showThanks: true });
  });
});
