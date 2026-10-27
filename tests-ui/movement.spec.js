// Movement UI check (task 10.1; PRD reqs 93-94): starts the game with Enter,
// then holds Right, Left, and Jump, and confirms through the read-only test
// hook (window.gameTestHook) that the player moved right, moved left, and
// left the ground and landed.
//
// Level 1 starts the player on flat ground with room on both sides
// (data/levels/level1.json), so a short run either way stays on the ground.
// Keys are the default bindings (data/config/bindings.json).

import { test, expect } from '@playwright/test';

const ENTER = 'Enter';
const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const JUMP = 'Space';
const HOLD_MS = 300;
// Several waits for the game to settle: alone it takes a few seconds, but
// alongside the other checks it took up to 25 s on a developer PC, close to
// Playwright's default 30 s.
const CHECK_TIMEOUT_MS = 60_000;

/** Waits for the test hook to appear, then returns its state. */
async function hookState(page) {
  await page.waitForFunction(() => window.gameTestHook !== undefined);
  return page.evaluate(() => window.gameTestHook.getState());
}

/** Holds `key` down for `ms` milliseconds. */
async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Waits, checking every animation frame inside the page, until the player's
 * onGround is `onGround`. (Polling from the test can miss a whole jump.)
 */
async function waitForOnGround(page, onGround) {
  await page.waitForFunction((want) => window.gameTestHook.getState().player?.onGround === want, onGround);
}

/** Waits until the player is standing still on the ground, then returns the player. */
async function settledPlayer(page) {
  await page.waitForFunction(() => {
    const { player } = window.gameTestHook.getState();
    return player?.onGround && player.vx === 0;
  });
  return (await hookState(page)).player;
}

test('the player moves right, moves left, and jumps', async ({ page }) => {
  test.setTimeout(CHECK_TIMEOUT_MS);
  await page.goto('/');
  expect((await hookState(page)).screen).toBe('start');

  await page.keyboard.press(ENTER);
  await expect.poll(async () => (await hookState(page)).screen).toBe('playing');
  const start = await settledPlayer(page);

  await hold(page, RIGHT, HOLD_MS);
  const afterRight = await settledPlayer(page);
  expect(afterRight.x).toBeGreaterThan(start.x);

  await hold(page, LEFT, HOLD_MS);
  const afterLeft = await settledPlayer(page);
  expect(afterLeft.x).toBeLessThan(afterRight.x);

  await page.keyboard.down(JUMP);
  await waitForOnGround(page, false);
  await page.keyboard.up(JUMP);
  await waitForOnGround(page, true);
  expect((await hookState(page)).player.y).toBeCloseTo(afterLeft.y);
});
