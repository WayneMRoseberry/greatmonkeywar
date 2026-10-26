// Tests for the browser platform (task 8.2; PRD reqs 7, 9), with a fake document.
//
// In browser mode Steam is unavailable, fullscreen uses the browser's
// Fullscreen API, and the game can't close the page, so quit asks for the
// "Thanks for playing" screen.
// Decided:
//  - creating the platform logs a clear message that Steam is unavailable in
//    browser mode (req 9);
//  - toggleFullscreen asks the whole page (document.documentElement) to go
//    fullscreen, or leaves fullscreen if it is on; if the browser refuses
//    (its request fails), that is logged, not thrown.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserPlatform, BROWSER_STEAM_UNAVAILABLE_MESSAGE } from '../../src/platform/browser-platform.js';
import { SteamStatus } from '../../src/platform/platform.js';
import { platformContract } from './contract.js';

/** A fake document: requestFullscreen and exitFullscreen record calls and switch fullscreenElement. */
function fakeDocument({ refuse = false } = {}) {
  const doc = {
    fullscreenElement: null,
    requests: 0,
    exits: 0,
    documentElement: {
      requestFullscreen() {
        doc.requests++;
        if (refuse) return Promise.reject(new Error('not allowed'));
        doc.fullscreenElement = doc.documentElement;
        return Promise.resolve();
      },
    },
    exitFullscreen() {
      doc.exits++;
      doc.fullscreenElement = null;
      return Promise.resolve();
    },
  };
  return doc;
}

platformContract('browser', () => createBrowserPlatform({ document: fakeDocument(), log: () => {} }), { canConnect: false });

describe('the browser platform (req 7)', () => {
  test('Steam is unavailable, with no user name', () => {
    const platform = createBrowserPlatform({ document: fakeDocument(), log: () => {} });
    assert.equal(platform.getSteamStatus(), SteamStatus.UNAVAILABLE);
    assert.equal(platform.getSteamUserName(), null);
  });

  test('creating it logs that Steam is unavailable in browser mode (req 9)', () => {
    const messages = [];
    createBrowserPlatform({ document: fakeDocument(), log: (m) => messages.push(m) });
    assert.deepEqual(messages, [BROWSER_STEAM_UNAVAILABLE_MESSAGE]);
  });

  test('toggleFullscreen asks for fullscreen when it is off, and leaves it when it is on', () => {
    const doc = fakeDocument();
    const platform = createBrowserPlatform({ document: doc, log: () => {} });
    platform.toggleFullscreen();
    assert.equal(doc.requests, 1);
    platform.toggleFullscreen();
    assert.equal(doc.exits, 1);
  });

  test('a refused fullscreen request is logged, not thrown', async () => {
    const messages = [];
    const platform = createBrowserPlatform({ document: fakeDocument({ refuse: true }), log: (m) => messages.push(m) });
    messages.length = 0;
    assert.doesNotThrow(() => platform.toggleFullscreen());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(messages.length, 1);
    assert.match(messages[0], /fullscreen/i);
  });

  test('quit asks for the "Thanks for playing" screen, since a page can\'t close itself', () => {
    const platform = createBrowserPlatform({ document: fakeDocument(), log: () => {} });
    assert.deepEqual(platform.quit(), { showThanks: true });
  });
});
