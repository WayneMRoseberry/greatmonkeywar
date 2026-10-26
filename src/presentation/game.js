// The game controller (PRD reqs 2, 10, 60): ties input, the game flow, and
// drawing together. The loop (loop.js) calls update(dt) for each fixed step
// and draw() once a frame. Everything it uses is passed in, so tests use fakes.

import { createGame, stepGame, Screen } from '../simulation/flow.js';
import { cutsceneAt } from '../simulation/cutscene.js';
import { heldObject } from '../simulation/objects.js';
import { visibleArea } from '../simulation/camera.js';
import { levelView, drawLevel } from './renderer.js';
import { drawHud } from './hud.js';
import { drawStartScreen, drawLevelComplete, drawThanks } from './screens.js';
import { drawCutscene } from './cutscene-view.js';
import { debugLines, drawDebugOverlay } from './debug-overlay.js';

// How strongly the fps reading follows the latest frame (an exponential average).
const FPS_SMOOTHING = 0.2;

/**
 * The game controller.
 *  - data, images: loaded game data and images (src/data/load.js);
 *  - platform: the platform (src/platform/platform.js);
 *  - canvas: the canvas, already sized in device pixels (canvas-size.js);
 *  - inputReader: read() gives { input, presentation, device } (input.js);
 *  - now(): the clock in milliseconds, for the fps reading;
 *  - log(message): for warnings (a missing sprite, req 79).
 * update(dt): reads input; a new press of the debug key shows or hides the
 * overlay and of the fullscreen key toggles fullscreen through the platform;
 * then steps the game flow. When the flow reaches the finished screen, the
 * platform's quit is called once, and its { showThanks } decides whether
 * "Thanks for playing" is drawn. draw(): draws the current screen, and the
 * debug overlay if shown. getGame(): the current game flow state.
 */
export function createGameController({ data, images, platform, canvas, inputReader, now, log }) {
  let game = createGame(data);
  let lastRead = inputReader.read();
  let held = { fullscreen: false, debug: false };
  let showDebug = false;
  let quitResult = null;
  let lastDraw = null;
  let fps = 0;
  const assets = { images, warn: log };

  function update(dt) {
    lastRead = inputReader.read();
    const { presentation } = lastRead;
    if (presentation.debug && !held.debug) showDebug = !showDebug;
    if (presentation.fullscreen && !held.fullscreen) platform.toggleFullscreen();
    held = { ...presentation };

    if (game.screen === Screen.FINISHED) return;
    game = stepGame(game, lastRead.input, dt);
    if (game.screen === Screen.FINISHED) quitResult = platform.quit();
  }

  function drawScreen(ctx, viewport) {
    const level = game.level;
    switch (game.screen) {
      case Screen.START:
        drawStartScreen(ctx, game.menu, viewport);
        break;
      case Screen.PLAYING:
      case Screen.LEVEL_COMPLETE:
        drawLevel(ctx, level, levelView(level, viewport, data.display.visibleHeight), assets);
        drawHud(ctx, { health: level.player.health, rewardCount: level.rewardCount }, viewport);
        if (game.screen === Screen.LEVEL_COMPLETE) drawLevelComplete(ctx, game.menu, level.rewardCount, viewport);
        break;
      case Screen.CUTSCENE: {
        const scene = data.cutscenes[game.cutscene.name];
        drawCutscene(ctx, scene, cutsceneAt(scene, game.cutscene.time), { ...assets, sheets: data.sprites },
          data.characters, viewport, data.bindings);
        break;
      }
      case Screen.FINISHED:
        if (quitResult?.showThanks) drawThanks(ctx, viewport);
        break;
      default:
        break;
    }
  }

  function draw() {
    const time = now();
    if (lastDraw !== null && time > lastDraw) {
      const frameFps = 1000 / (time - lastDraw);
      fps = fps === 0 ? frameFps : fps + FPS_SMOOTHING * (frameFps - fps);
    }
    lastDraw = time;

    const ctx = canvas.getContext('2d');
    const viewport = { width: canvas.width, height: canvas.height };
    drawScreen(ctx, viewport);
    if (showDebug) {
      const playing = game.screen === Screen.PLAYING || game.screen === Screen.LEVEL_COMPLETE;
      const carried = playing ? heldObject(game.level) : null;
      drawDebugOverlay(ctx, debugLines({
        fps,
        player: playing ? game.level.player : null,
        held: carried ? carried.type : null,
        device: lastRead.device,
        viewport,
        area: visibleArea(viewport.width, viewport.height, data.display.visibleHeight),
        platform,
      }), viewport);
    }
  }

  return { update, draw, getGame: () => game };
}
