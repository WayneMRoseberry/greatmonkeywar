// Smoke checks (task 7.17; PRD reqs 7, 85, 93-94): the game page loads in
// browser mode without errors, the canvas fills the window, the game opens on
// the start screen, and broken data shows the data error screen instead.
// The state is read through the read-only test hook, window.gameTestHook.

import { test, expect } from '@playwright/test';

/** Waits for the test hook to appear, then returns its state. */
async function hookState(page) {
  await page.waitForFunction(() => window.gameTestHook !== undefined);
  return page.evaluate(() => window.gameTestHook.getState());
}

test('game page loads and the canvas fills the window', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/');

  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible();

  const viewport = page.viewportSize();
  const box = await canvas.boundingBox();
  expect(box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);

  await hookState(page);
  expect(errors).toEqual([]);
});

test('the game opens on the start screen', async ({ page }) => {
  await page.goto('/');
  const state = await hookState(page);
  expect(state.screen).toBe('start');
  expect(state.player).toBeNull();
});

test('broken data shows the data error screen, listing the problem', async ({ page }) => {
  await page.route('**/data/config/tuning.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{ "formatVersion": 1, ' }));
  await page.goto('/');
  const state = await hookState(page);
  expect(state.screen).toBe('dataError');
  expect(state.errors.some((message) => message.startsWith('config/tuning.json:'))).toBe(true);
});
