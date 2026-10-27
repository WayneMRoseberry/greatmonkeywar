// Browser entry point: start-up glue only (task 7.17). Everything it wires
// together is unit-tested on its own; this file is checked by the UI checks
// in tests-ui/ (npm run test:ui).
//
// It loads and validates the data, shows the error screen if the data is
// invalid (req 85), picks the platform (Electron's, if the preload bridge is
// on the window, otherwise the browser's), creates the game, installs the
// test hook in browser mode (req 94), and starts the loop.

import { loadGameData } from '../data/load.js';
import { formatProblem } from '../data/validate.js';
import { createBrowserPlatform } from '../platform/browser-platform.js';
import { createElectronPlatform, ELECTRON_BRIDGE } from '../platform/electron-platform.js';
import { watchCanvasSize } from './canvas-size.js';
import { createInputReader } from './input.js';
import { createLoop } from './loop.js';
import { createGameController } from './game.js';
import { drawDataErrors } from './screens.js';
import { createTestHook, installTestHook, gameTestState, DATA_ERROR_SCREEN } from './test-hook.js';

const canvas = document.getElementById('game');
const bridge = window[ELECTRON_BRIDGE];   // only in the Electron app (electron/preload.cjs)
const log = (message) => console.warn(message);

const loaded = await loadGameData();

if (!loaded.ok) {
  const errors = loaded.errors.map(formatProblem);
  for (const error of errors) console.warn(error);
  const ctx = canvas.getContext('2d');
  watchCanvasSize(canvas, window, document, (size) => drawDataErrors(ctx, errors, size));
  if (!bridge) installTestHook(window, createTestHook(() => ({ screen: DATA_ERROR_SCREEN, errors })));
} else {
  const { data } = loaded;
  const images = Object.fromEntries(Object.entries(loaded.images).map(([path, image]) =>
    [path, { image, width: image.naturalWidth, height: image.naturalHeight }]));
  const platform = bridge ? await createElectronPlatform(bridge) : createBrowserPlatform({ document, log });
  watchCanvasSize(canvas, window, document, () => {});
  const inputReader = createInputReader({
    target: window, pointerTarget: canvas, getGamepads: () => navigator.getGamepads?.(),
    bindings: data.bindings, deadZone: data.display.stickDeadZone,
  });
  const controller = createGameController({
    data, images, platform, canvas, inputReader, now: () => performance.now(), log,
  });
  if (!bridge) installTestHook(window, createTestHook(() => gameTestState(controller.getGame())));
  createLoop({
    update: controller.update, draw: controller.draw, now: () => performance.now(), schedule: (fn) => requestAnimationFrame(fn),
  }).start();
}
