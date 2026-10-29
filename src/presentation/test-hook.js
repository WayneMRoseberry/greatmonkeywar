// The UI test hook (PRD req 94): in browser mode, window.gameTestHook.getState()
// gives the Playwright UI checks a copy of the state they need. It is
// read-only: changing what it returns doesn't affect the game.

import { Screen } from '../simulation/flow.js';

/** The screen name the hook reports when the data is invalid and the error screen shows. */
export const DATA_ERROR_SCREEN = 'dataError';

/**
 * What the hook reports for `game` (flow.js): { screen, player }, where player
 * is { x, y, vx, vy, onGround } while a level is showing, else null.
 */
export function gameTestState(game) {
  const showingLevel = game.screen === Screen.PLAYING || game.screen === Screen.LEVEL_COMPLETE;
  const player = showingLevel ? game.level.player : null;
  return {
    screen: game.screen,
    player: player && { x: player.x, y: player.y, vx: player.vx, vy: player.vy, onGround: player.onGround },
  };
}

/**
 * What the hook reports about sound, from the audio player (audio.js):
 * { music (file or null), sound (SoundState) }, so a UI check can confirm
 * audio without hearing it.
 */
export function audioTestState(audio) {
  return { music: audio.currentMusic(), sound: audio.soundState() };
}

/** The hook: getState() gives a fresh copy of what `currentState()` returns. The hook itself is frozen. */
export function createTestHook(currentState) {
  return Object.freeze({ getState: () => structuredClone(currentState()) });
}

/** Puts `hook` on `win` as gameTestHook, where it can't be replaced. */
export function installTestHook(win, hook) {
  Object.defineProperty(win, 'gameTestHook', { value: hook, writable: false, configurable: false, enumerable: true });
}
