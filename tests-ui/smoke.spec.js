// Smoke check: the game page loads in browser mode without errors
// and the canvas fills the window.

import { test, expect } from '@playwright/test';

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

  expect(errors).toEqual([]);
});
