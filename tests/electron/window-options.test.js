// Tests for the Electron window and how it loads the game (task 8.3; PRD reqs 1-2, Technical Considerations).
//
// windowOptions(preloadPath) are the BrowserWindow options: contextIsolation
// on, nodeIntegration off, the sandbox on, and the preload script.
// Decided:
//  - the game is loaded from a custom app:// scheme rather than file://,
//    because the game fetches its data files, which Chromium doesn't allow
//    from file:// pages; appFileFor maps an app:// address to a file using
//    the same rules as the browser-mode server (tools/serve.js: only
//    index.html, src/, and data/), so nothing else on disk can be read;
//  - the window starts at 1280 × 720 with a black background and the game's
//    title, and can be resized and made fullscreen.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { windowOptions, START_URL, APP_SCHEME, appFileFor } from '../../electron/window-options.js';

describe('the window (req 2, Technical Considerations)', () => {
  const PRELOAD = path.resolve('electron/preload.cjs');

  test('security: context isolation on, Node integration off, the sandbox on, and the preload script', () => {
    const { webPreferences } = windowOptions(PRELOAD);
    assert.equal(webPreferences.contextIsolation, true);
    assert.equal(webPreferences.nodeIntegration, false);
    assert.equal(webPreferences.sandbox, true);
    assert.equal(webPreferences.preload, PRELOAD);
  });

  test('a 1280 × 720 window titled Great Monkey War, on black, that can go fullscreen', () => {
    const options = windowOptions(PRELOAD);
    assert.equal(options.width, 1280);
    assert.equal(options.height, 720);
    assert.equal(options.title, 'Great Monkey War');
    assert.equal(options.backgroundColor, '#000000');
    assert.equal(options.fullscreenable, true);
  });
});

describe('loading the game from app:// (Technical Considerations)', () => {
  const ROOT = path.resolve('.');

  test('the window opens index.html on the app scheme', () => {
    assert.equal(APP_SCHEME, 'app');
    assert.equal(START_URL, 'app://game/index.html');
  });

  test('game files map to the same files the browser-mode server would serve', () => {
    assert.equal(appFileFor('app://game/index.html', ROOT), path.join(ROOT, 'index.html'));
    assert.equal(appFileFor('app://game/src/presentation/main.js', ROOT), path.join(ROOT, 'src', 'presentation', 'main.js'));
    assert.equal(appFileFor('app://game/data/config/tuning.json', ROOT), path.join(ROOT, 'data', 'config', 'tuning.json'));
  });

  test('anything else is refused (null): other folders, and climbing out with ..', () => {
    assert.equal(appFileFor('app://game/package.json', ROOT), null);
    assert.equal(appFileFor('app://game/electron/main.js', ROOT), null);
    assert.equal(appFileFor('app://game/data/../../secret.txt', ROOT), null);
    assert.equal(appFileFor('app://game/%2e%2e/secret.txt', ROOT), null);
  });
});
