// Tests for the UI test hook (task 7.16; PRD req 94).
//
// In browser mode the page offers window.gameTestHook.getState(), for the
// Playwright UI checks: a copy of the current screen and the player's
// position, velocity, and on-ground flag. Changing what it returns doesn't
// affect the game, and the hook itself can't be changed.
// Decided:
//  - gameTestState(game) is { screen, player }, player being { x, y, vx, vy,
//    onGround } while a level is showing, else null;
//  - when the data is invalid, main.js gives the hook { screen: 'dataError',
//    errors } instead (DATA_ERROR_SCREEN), so a UI check can see the error screen.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { gameTestState, createTestHook, installTestHook, DATA_ERROR_SCREEN } from '../../src/presentation/test-hook.js';
import { createGame, stepGame, Screen } from '../../src/simulation/flow.js';
import { buildData } from '../helpers/level-builder.js';
import { Input, holding } from '../../src/simulation/input.js';
import { FIXED_DT } from '../../src/simulation/constants.js';

const playing = () => stepGame(createGame(buildData(['P.G', '###'])), holding(Input.CONFIRM), FIXED_DT);

describe('the test state', () => {
  test('on the start screen: the screen, and no player', () => {
    assert.deepEqual(gameTestState(createGame(buildData(['P.G', '###']))), { screen: Screen.START, player: null });
  });

  test('while playing: the player\'s position, velocity, and on-ground flag', () => {
    const game = playing();
    const { player } = game.level;
    assert.deepEqual(gameTestState(game), {
      screen: Screen.PLAYING,
      player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, onGround: player.onGround },
    });
  });

  test('the data error screen has its own name', () => {
    assert.equal(DATA_ERROR_SCREEN, 'dataError');
    assert.ok(!Object.values(Screen).includes(DATA_ERROR_SCREEN));
  });
});

describe('the hook (req 94)', () => {
  test('getState gives the current state, read each time', () => {
    let game = createGame(buildData(['P.G', '###']));
    const hook = createTestHook(() => gameTestState(game));
    assert.equal(hook.getState().screen, Screen.START);
    game = playing();
    assert.equal(hook.getState().screen, Screen.PLAYING);
  });

  test('changing what getState returns doesn\'t affect the game or the next getState', () => {
    const game = playing();
    const hook = createTestHook(() => gameTestState(game));
    const state = hook.getState();
    const x = game.level.player.x;
    state.player.x = x + 100;
    state.screen = 'hacked';
    assert.equal(game.level.player.x, x);
    assert.equal(hook.getState().player.x, x);
    assert.equal(hook.getState().screen, Screen.PLAYING);
  });

  test('the hook can\'t be changed', () => {
    const hook = createTestHook(() => ({ screen: Screen.START, player: null }));
    assert.ok(Object.isFrozen(hook));
    assert.throws(() => { 'use strict'; hook.getState = () => null; }, TypeError);
  });

  test('installing it puts it on the window as gameTestHook, which can\'t be replaced', () => {
    const win = {};
    const hook = createTestHook(() => ({ screen: Screen.START, player: null }));
    installTestHook(win, hook);
    assert.equal(win.gameTestHook, hook);
    assert.throws(() => { 'use strict'; win.gameTestHook = null; }, TypeError);
  });
});
