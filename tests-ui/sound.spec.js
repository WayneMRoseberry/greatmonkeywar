// Sound in browser mode (sound task 4.10; sound PRD reqs 9, 17, 21), read
// through the test hook (window.gameTestHook) rather than heard:
//  - after a key press, sound is on and the start screen's music is the one
//    audio.json names;
//  - the mute key mutes it, and pressing it again turns sound back on;
//  - none of this logs errors.
// Playwright's Chromium starts every AudioContext running, whatever its
// autoplay settings, so the lock before the first key press can't be seen
// here: it is unit-tested (tests/presentation/audio.test.js, game.test.js)
// and checked by hand (docs/manual-test-checklist.md).

import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const audio = JSON.parse(fs.readFileSync('data/config/audio.json', 'utf8'));
const bindings = JSON.parse(fs.readFileSync('data/config/bindings.json', 'utf8'));
const START_MUSIC = audio.startMusic ?? null;
const [MUTE_KEY] = bindings.keyboard.mute;
// A key that does nothing in the game, so pressing it only unlocks sound (if locked).
const UNBOUND_KEY = 'KeyZ';

/** Waits for the test hook to appear, then returns its state. */
async function hookState(page) {
  await page.waitForFunction(() => window.gameTestHook !== undefined);
  return page.evaluate(() => window.gameTestHook.getState());
}

/** Waits until the hook's sound state is `sound`. */
async function waitForSound(page, sound) {
  await page.waitForFunction((s) => window.gameTestHook.getState().sound === s, sound);
}

test('after a key press the start music is chosen and sound is on; the mute key mutes and unmutes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/');
  expect((await hookState(page)).screen).toBe('start');

  await page.keyboard.press(UNBOUND_KEY);
  await waitForSound(page, 'on');
  expect((await hookState(page)).music).toBe(START_MUSIC);

  await page.keyboard.press(MUTE_KEY);
  await waitForSound(page, 'muted');
  await page.keyboard.press(MUTE_KEY);
  await waitForSound(page, 'on');

  expect(errors).toEqual([]);
});
