// The platform contract (task 8.1; PRD req 71): what every platform
// implementation (fake, browser, Electron) must do, as a set of tests that
// each implementation's test file runs on itself.
//
// A platform is { getSteamStatus(), getSteamUserName(), toggleFullscreen(), quit() }:
//  - getSteamStatus() is SteamStatus.CONNECTED or SteamStatus.UNAVAILABLE;
//  - getSteamUserName() is the Steam user's display name, a non-empty string,
//    when connected, and null when not;
//  - toggleFullscreen() switches fullscreen on or off; it returns nothing and never throws;
//  - quit() ends the game and returns { showThanks }: true if the game can't
//    close itself (browser mode) and should show "Thanks for playing" (req 7).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SteamStatus, PLATFORM_METHODS } from '../../src/platform/platform.js';

/**
 * Runs the contract tests for one implementation. `make(options)` creates a
 * platform; options.steam is 'connected' or 'unavailable', for
 * implementations that can be either (others ignore it).
 */
export function platformContract(name, make, { canConnect = true } = {}) {
  describe(`platform contract: ${name}`, () => {
    test('it has exactly the platform methods, as functions', () => {
      const platform = make({ steam: SteamStatus.UNAVAILABLE });
      for (const method of PLATFORM_METHODS) assert.equal(typeof platform[method], 'function', method);
    });

    test('getSteamStatus is one of the Steam statuses', () => {
      const status = make({ steam: SteamStatus.UNAVAILABLE }).getSteamStatus();
      assert.ok(Object.values(SteamStatus).includes(status), `status was ${status}`);
    });

    test('without Steam, the user name is null', () => {
      const platform = make({ steam: SteamStatus.UNAVAILABLE });
      assert.equal(platform.getSteamStatus(), SteamStatus.UNAVAILABLE);
      assert.equal(platform.getSteamUserName(), null);
    });

    if (canConnect) {
      test('with Steam connected, the user name is a non-empty string', () => {
        const platform = make({ steam: SteamStatus.CONNECTED });
        assert.equal(platform.getSteamStatus(), SteamStatus.CONNECTED);
        const name = platform.getSteamUserName();
        assert.equal(typeof name, 'string');
        assert.ok(name.length > 0);
      });
    }

    test('toggleFullscreen returns nothing and doesn\'t throw', () => {
      assert.equal(make({ steam: SteamStatus.UNAVAILABLE }).toggleFullscreen(), undefined);
    });

    test('quit returns { showThanks } with a true or false', () => {
      const result = make({ steam: SteamStatus.UNAVAILABLE }).quit();
      assert.deepEqual(Object.keys(result), ['showThanks']);
      assert.equal(typeof result.showThanks, 'boolean');
    });
  });
}
