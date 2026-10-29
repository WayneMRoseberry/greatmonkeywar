// Tests for the game flow: screens, menus, levels in order, and cut scenes
// between them (tasks 6.1-6.6 and 6.8; PRD reqs 19, 56-60, 63).
//
// createGame(data) makes the whole game's state, starting on the start
// screen; stepGame(game, input, dt) returns the next one. During play the
// current level is stepped with step() (step.js).
//
// Decided:
//  - the screens are Screen.START, PLAYING, LEVEL_COMPLETE, CUTSCENE, FINISHED;
//  - menus are lists of MenuOption values with a selected index; up and down
//    move the selection one place, stopping at the ends (no wrap-around);
//    confirm chooses the selected option; chooseMenuOption(game, index)
//    chooses any option directly (the presentation uses it for mouse clicks);
//  - only a new press of confirm, up, or down counts, and the game remembers
//    what was held across screens, so the press that chooses a menu option
//    doesn't also skip the cut scene that follows;
//  - the level is complete when the player's box overlaps the goal's; the
//    level is then no longer stepped (frozen under the level-complete panel),
//    and Next level is selected first;
//  - the next level starts with the completed level's health and reward
//    count, and those carried values are also its start snapshot (a restart
//    at 0 health goes back to them);
//  - a cut scene runs from time 0, advancing by dt, until it has ended
//    (cutscene.js) or confirm is pressed; then the next level starts.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, chooseMenuOption, Screen, MenuOption } from '../../src/simulation/flow.js';
import { FIXED_DT, STEPS_PER_SECOND, SoundEvent } from '../../src/simulation/constants.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';
import { Input, NO_INPUT, holding } from '../../src/simulation/input.js';

const SECOND_LEVEL = 'second';
const CUTSCENE = 'between';
const CONFIRM = holding(Input.CONFIRM);
const DOWN = holding(Input.DOWN);
const UP = holding(Input.UP);

/**
 * Game data with two levels in the list: TEST_LEVEL, where the goal is just
 * right of the player, then SECOND_LEVEL. With `cutscene`, TEST_LEVEL names
 * the cut scene CUTSCENE, `cutscene` seconds long.
 */
function twoLevels({ cutscene } = {}) {
  const data = buildData(['P.G', '###'], cutscene ? { level: { cutscene: CUTSCENE } } : {});
  data.levels[SECOND_LEVEL] = { ...data.levels[TEST_LEVEL], name: 'Second', grid: ['G..P', '####'] };
  delete data.levels[SECOND_LEVEL].cutscene;
  data.levelList.levels.push(SECOND_LEVEL);
  if (cutscene) {
    data.cutscenes[CUTSCENE] = {
      formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/cutscene.png', backgroundColor: '#000000',
      actors: [], narration: [{ start: 0, end: cutscene, text: 'Meanwhile...' }],
    };
  }
  return data;
}

/** Steps with `input` until `done(game)`, and returns that game; fails after `maxSteps`. */
function stepUntil(game, input, done, maxSteps = 10 * STEPS_PER_SECOND) {
  let current = game;
  for (let i = 0; i < maxSteps; i++) {
    current = stepGame(current, input, FIXED_DT);
    if (done(current)) return current;
  }
  assert.fail(`not done after ${maxSteps} steps`);
}

/** Presses `input` for one step, then releases it for one, so a later press is new. */
const press = (game, input) => stepGame(stepGame(game, input, FIXED_DT), NO_INPUT, FIXED_DT);

/** From the start screen, starts the first level. */
const started = (data) => press(createGame(data), CONFIRM);

/** From the start screen, plays the first level to its goal (walking right). */
const completed = (data) =>
  stepGame(stepUntil(started(data), holding(Input.RIGHT), (g) => g.screen === Screen.LEVEL_COMPLETE), NO_INPUT, FIXED_DT);

describe('screens (6.1)', () => {
  test('the screens are start, playing, level complete, cut scene, and finished, and can\'t be changed', () => {
    assert.deepEqual(Object.keys(Screen).sort(), ['CUTSCENE', 'FINISHED', 'LEVEL_COMPLETE', 'PLAYING', 'START']);
    assert.equal(new Set(Object.values(Screen)).size, 5);
    assert.ok(Object.isFrozen(Screen));
    assert.ok(Object.isFrozen(MenuOption));
  });

  test('the game begins on the start screen, with Start selected and no level yet', () => {
    const game = createGame(twoLevels());
    assert.equal(game.screen, Screen.START);
    assert.deepEqual(game.menu, { options: [MenuOption.START], selected: 0 });
    assert.equal(game.level, null);
  });

  test('stepGame doesn\'t change the game passed in', () => {
    const game = createGame(twoLevels());
    const before = structuredClone({ ...game, data: undefined });
    stepGame(game, CONFIRM, FIXED_DT);
    assert.deepEqual(structuredClone({ ...game, data: undefined }), before);
  });

  test('with nothing pressed the start screen stays', () => {
    let game = createGame(twoLevels());
    for (let i = 0; i < STEPS_PER_SECOND; i++) game = stepGame(game, NO_INPUT, FIXED_DT);
    assert.equal(game.screen, Screen.START);
  });
});

describe('start (6.2, req 56)', () => {
  test('confirm on Start begins the first level in the level list', () => {
    const data = twoLevels();
    const game = stepGame(createGame(data), CONFIRM, FIXED_DT);
    assert.equal(game.screen, Screen.PLAYING);
    assert.equal(game.level.levelName, data.levelList.levels[0]);
    assert.equal(game.menu, null);
  });

  test('the first level is the first in the list, not the first in the data', () => {
    const data = twoLevels();
    data.levelList.levels.reverse();
    assert.equal(stepGame(createGame(data), CONFIRM, FIXED_DT).level.levelName, SECOND_LEVEL);
  });

  test('confirm held since before the start screen doesn\'t start (only a new press does)', () => {
    let game = createGame(twoLevels());
    game = { ...game, held: { ...game.held, [Input.CONFIRM]: true } };
    assert.equal(stepGame(game, CONFIRM, FIXED_DT).screen, Screen.START);
  });

  test('while playing, the level is stepped with the input', () => {
    const game = started(twoLevels());
    const after = stepGame(game, holding(Input.RIGHT), FIXED_DT);
    assert.ok(after.level.player.x > game.level.player.x);
  });
});

describe('choosing a menu option directly (a mouse click on it)', () => {
  test('choosing Start (index 0) on the start screen begins the first level, like confirm does', () => {
    const data = twoLevels();
    const game = chooseMenuOption(createGame(data), 0);
    assert.equal(game.screen, Screen.PLAYING);
    assert.equal(game.level.levelName, data.levelList.levels[0]);
  });

  test('choosing an option that isn\'t selected chooses it: Exit game on level complete finishes', () => {
    const game = completed(twoLevels());
    const exit = game.menu.options.indexOf(MenuOption.EXIT);
    assert.notEqual(game.menu.selected, exit, 'Next level is selected first');
    assert.equal(chooseMenuOption(game, exit).screen, Screen.FINISHED);
  });

  test('it doesn\'t change the game passed in', () => {
    const game = createGame(twoLevels());
    const before = structuredClone({ ...game, data: undefined });
    chooseMenuOption(game, 0);
    assert.deepEqual(structuredClone({ ...game, data: undefined }), before);
  });

  test('with no menu showing, or no option at that index, nothing happens', () => {
    const playing = started(twoLevels());
    assert.equal(chooseMenuOption(playing, 0), playing);
    const start = createGame(twoLevels());
    assert.equal(chooseMenuOption(start, -1), start);
    assert.equal(chooseMenuOption(start, start.menu.options.length), start);
  });
});

describe('level complete (6.3, req 58)', () => {
  test('touching the goal completes the level: the level-complete screen offers Next level and Exit game', () => {
    const game = completed(twoLevels());
    assert.equal(game.screen, Screen.LEVEL_COMPLETE);
    assert.deepEqual(game.menu, { options: [MenuOption.NEXT_LEVEL, MenuOption.EXIT], selected: 0 });
  });

  test('gameplay stops: stepping no longer moves the player', () => {
    const game = completed(twoLevels());
    const after = stepGame(game, holding(Input.RIGHT), FIXED_DT);
    assert.deepEqual({ ...after.level.player }, { ...game.level.player });
    assert.equal(after.level.time, game.level.time);
  });

  test('the completed level, with its reward count, is kept for the panel to show', () => {
    const data = twoLevels();
    data.levels[TEST_LEVEL].grid = ['Pb.G', '####'];   // a reward on the way to the goal
    const game = completed(data);
    assert.equal(game.level.levelName, TEST_LEVEL);
    assert.equal(game.level.rewardCount, data.levels[TEST_LEVEL].legend.b.reward.value);
  });

  test('on the last level in the list only Exit game is offered', () => {
    const data = twoLevels();
    data.levelList.levels = [TEST_LEVEL];
    assert.deepEqual(completed(data).menu, { options: [MenuOption.EXIT], selected: 0 });
  });
});

describe('menus (6.4, req 19)', () => {
  test('down moves the selection down one, up moves it back', () => {
    const game = completed(twoLevels());
    const down = press(game, DOWN);
    assert.equal(down.menu.selected, 1);
    assert.equal(press(down, UP).menu.selected, 0);
  });

  test('the selection stops at the ends: no wrap-around', () => {
    const game = completed(twoLevels());
    assert.equal(press(game, UP).menu.selected, 0);
    assert.equal(press(press(game, DOWN), DOWN).menu.selected, 1);
  });

  test('holding down moves the selection only once', () => {
    let game = completed(twoLevels());
    for (let i = 0; i < STEPS_PER_SECOND; i++) game = stepGame(game, DOWN, FIXED_DT);
    assert.equal(game.menu.selected, 1);
  });
});

describe('next level (6.5, req 59)', () => {
  test('with no cut scene, Next level starts the next level in the list', () => {
    const game = stepGame(completed(twoLevels()), CONFIRM, FIXED_DT);
    assert.equal(game.screen, Screen.PLAYING);
    assert.equal(game.level.levelName, SECOND_LEVEL);
  });

  test('the player\'s health and reward count carry over into the next level', () => {
    const health = 2;
    const rewardCount = 7;
    const done = completed(twoLevels());
    const changed = { ...done, level: { ...done.level, player: done.level.player.copy(), rewardCount } };
    changed.level.player.health = health;
    const next = stepGame(changed, CONFIRM, FIXED_DT);
    assert.equal(next.level.player.health, health);
    assert.equal(next.level.rewardCount, rewardCount);
  });

  test('the carried values are also the next level\'s start: a restart goes back to them', () => {
    const health = 2;
    const rewardCount = 7;
    const done = completed(twoLevels());
    const changed = { ...done, level: { ...done.level, player: done.level.player.copy(), rewardCount } };
    changed.level.player.health = health;
    const next = stepGame(changed, CONFIRM, FIXED_DT);
    assert.equal(next.level.levelStart.player.health, health);
    assert.equal(next.level.levelStart.rewardCount, rewardCount);
  });

  test('with a cut scene, Next level plays it first, from time 0', () => {
    const game = stepGame(completed(twoLevels({ cutscene: 2 })), CONFIRM, FIXED_DT);
    assert.equal(game.screen, Screen.CUTSCENE);
    assert.deepEqual(game.cutscene, { name: CUTSCENE, time: 0 });
  });

  test('the cut scene\'s time advances each step, and when it ends the next level starts', () => {
    const length = 2;
    let game = stepGame(completed(twoLevels({ cutscene: length })), CONFIRM, FIXED_DT);
    game = stepGame(game, NO_INPUT, FIXED_DT);
    assert.ok(Math.abs(game.cutscene.time - FIXED_DT) < 1e-9, `time was ${game.cutscene.time}`);
    const next = stepUntil(game, NO_INPUT, (g) => g.screen !== Screen.CUTSCENE);
    assert.equal(next.screen, Screen.PLAYING);
    assert.equal(next.level.levelName, SECOND_LEVEL);
    assert.equal(next.cutscene, null);
  });

  test('after a cut scene, health and reward count still carry over', () => {
    const rewardCount = 4;
    const done = completed(twoLevels({ cutscene: 1 }));
    const changed = { ...done, level: { ...done.level, rewardCount } };
    const next = stepUntil(stepGame(changed, CONFIRM, FIXED_DT), NO_INPUT, (g) => g.screen === Screen.PLAYING);
    assert.equal(next.level.rewardCount, rewardCount);
  });
});

describe('exit (6.6, req 60)', () => {
  test('Exit game moves to the finished screen', () => {
    const game = stepGame(press(completed(twoLevels()), DOWN), CONFIRM, FIXED_DT);
    assert.equal(game.screen, Screen.FINISHED);
  });

  test('on the last level, Exit game (the only option) finishes', () => {
    const data = twoLevels();
    data.levelList.levels = [TEST_LEVEL];
    assert.equal(stepGame(completed(data), CONFIRM, FIXED_DT).screen, Screen.FINISHED);
  });

  test('the finished screen stays finished', () => {
    let game = stepGame(press(completed(twoLevels()), DOWN), CONFIRM, FIXED_DT);
    for (const input of [CONFIRM, NO_INPUT, DOWN, CONFIRM]) game = stepGame(game, input, FIXED_DT);
    assert.equal(game.screen, Screen.FINISHED);
  });
});

describe('skip (6.8, req 63)', () => {
  test('a new press of confirm during the cut scene skips it: the next level starts at once', () => {
    const atCutscene = stepGame(completed(twoLevels({ cutscene: 5 })), CONFIRM, FIXED_DT);
    const released = stepGame(atCutscene, NO_INPUT, FIXED_DT);
    const skipped = stepGame(released, CONFIRM, FIXED_DT);
    assert.equal(skipped.screen, Screen.PLAYING);
    assert.equal(skipped.level.levelName, SECOND_LEVEL);
  });

  test('the confirm press that chose Next level doesn\'t also skip the cut scene', () => {
    let game = stepGame(completed(twoLevels({ cutscene: 5 })), CONFIRM, FIXED_DT);
    for (let i = 0; i < 10; i++) game = stepGame(game, CONFIRM, FIXED_DT);   // still holding confirm
    assert.equal(game.screen, Screen.CUTSCENE);
  });
});

describe('sound events (sound PRD req 14)', () => {
  test('a new game has no events', () => {
    assert.deepEqual(createGame(twoLevels()).events, []);
  });

  test('menuChoose: confirming a menu option; the next step starts with no events again', () => {
    const chosen = stepGame(createGame(twoLevels()), CONFIRM, FIXED_DT);
    assert.equal(chosen.screen, Screen.PLAYING);
    assert.deepEqual(chosen.events, [SoundEvent.MENU_CHOOSE]);
    assert.deepEqual(stepGame(chosen, NO_INPUT, FIXED_DT).events, []);
  });

  test('menuChoose: choosing an option directly (a click)', () => {
    assert.deepEqual(chooseMenuOption(createGame(twoLevels()), 0).events, [SoundEvent.MENU_CHOOSE]);
  });

  test('menuMove: only when up or down changes the selection, not at the ends', () => {
    const panel = completed(twoLevels());   // Next level (selected) and Exit game
    const down = stepGame(panel, DOWN, FIXED_DT);
    assert.deepEqual(down.events, [SoundEvent.MENU_MOVE], 'down to Exit game');
    const downAgain = stepGame(stepGame(down, NO_INPUT, FIXED_DT), DOWN, FIXED_DT);   // released, then pressed again
    assert.deepEqual(downAgain.events, [], 'already at the last option');
    const up = stepGame(stepGame(downAgain, NO_INPUT, FIXED_DT), UP, FIXED_DT);
    assert.deepEqual(up.events, [SoundEvent.MENU_MOVE], 'back up to Next level');
  });

  test('while playing, the game\'s events are the level step\'s events', () => {
    const jumped = stepGame(started(twoLevels()), holding(Input.JUMP), FIXED_DT);
    assert.deepEqual(jumped.events, jumped.level.events);
    assert.deepEqual(jumped.events, [SoundEvent.JUMP]);
  });

  test('reachGoal: on the step the level is completed, after that step\'s level events; not again under the panel', () => {
    const done = stepUntil(started(twoLevels()), holding(Input.RIGHT), (g) => g.screen === Screen.LEVEL_COMPLETE);
    assert.deepEqual(done.events, [...done.level.events, SoundEvent.REACH_GOAL]);
    assert.deepEqual(stepGame(done, NO_INPUT, FIXED_DT).events, []);
  });

  test('a cut scene step has no events of its own', () => {
    const cutsceneSeconds = 5;
    const inCutscene = press(completed(twoLevels({ cutscene: cutsceneSeconds })), CONFIRM);
    assert.equal(inCutscene.screen, Screen.CUTSCENE);
    assert.deepEqual(stepGame(inCutscene, NO_INPUT, FIXED_DT).events, []);
  });
});
