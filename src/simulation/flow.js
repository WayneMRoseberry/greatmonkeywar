// The game flow (PRD reqs 19, 56-60, 63): the screens, their menus, playing
// the levels in the level list's order, and the cut scenes between them.
//
// createGame(data) is the whole game's state, starting on the start screen;
// stepGame(game, input, dt) returns the next one and never changes the one
// passed in. During play the current level is stepped with step() (step.js).

import { step } from './step.js';
import { createLevelState } from './state.js';
import { cutsceneAt } from './cutscene.js';
import { overlapsBox } from './collision.js';
import { Input } from './input.js';

/** The screens the game can be on. */
export const Screen = Object.freeze({
  START: 'start',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'levelComplete',
  CUTSCENE: 'cutscene',
  FINISHED: 'finished',
});

/** The options a menu can offer. */
export const MenuOption = Object.freeze({
  START: 'start',
  NEXT_LEVEL: 'nextLevel',
  EXIT: 'exit',
});

// The inputs whose presses the menus and cut scenes use; the game remembers
// whether each was held last step, so only a new press counts.
const MENU_INPUTS = [Input.CONFIRM, Input.UP, Input.DOWN];

const menu = (options) => ({ options, selected: 0 });

/**
 * The game at the start: on the start screen, with Start selected and no level
 * yet. `data` is validated game data; it is kept by reference.
 */
export function createGame(data) {
  return {
    data,
    screen: Screen.START,
    menu: menu([MenuOption.START]),
    levelIndex: -1,   // the current level's place in the level list
    level: null,      // the current level's state (state.js), or null
    cutscene: null,   // { name, time } while a cut scene plays
    held: Object.fromEntries(MENU_INPUTS.map((name) => [name, false])),
  };
}

/** A copy of `game` that shares nothing changeable with it (the level state is replaced, never changed, by step()). */
function copyGame(game) {
  return {
    ...game,
    menu: game.menu && { options: [...game.menu.options], selected: game.menu.selected },
    cutscene: game.cutscene && { ...game.cutscene },
    held: { ...game.held },
  };
}

/** Starts the level at `index` in the level list, with `carry` from the level before (state.js). */
function startLevel(game, index, carry) {
  game.screen = Screen.PLAYING;
  game.menu = null;
  game.cutscene = null;
  game.levelIndex = index;
  game.level = createLevelState(game.data, game.data.levelList.levels[index], carry);
}

/** Starts the level after the current one, carrying over health and reward count (req 59). */
function startNextLevel(game) {
  const { player, rewardCount } = game.level;
  startLevel(game, game.levelIndex + 1, { health: player.health, rewardCount });
}

/** True if the player's box overlaps the level's goal (req 58). */
const reachedGoal = (level) => overlapsBox(level.player, level.goal);

/** Choosing a menu option. */
function choose(game, option) {
  if (option === MenuOption.START) startLevel(game, 0);
  else if (option === MenuOption.EXIT) {
    game.screen = Screen.FINISHED;
    game.menu = null;
  } else if (option === MenuOption.NEXT_LEVEL) {
    // Next level plays the completed level's cut scene first, if it has one (req 59).
    const cutsceneName = game.data.levels[game.level.levelName].cutscene;
    if (cutsceneName !== undefined) {
      game.screen = Screen.CUTSCENE;
      game.menu = null;
      game.cutscene = { name: cutsceneName, time: 0 };
    } else {
      startNextLevel(game);
    }
  }
}

/** Up and down move the selection one place, stopping at the ends; confirm chooses (req 19). */
function updateMenu(game, pressed) {
  const { menu: current } = game;
  if (pressed[Input.DOWN]) current.selected = Math.min(current.selected + 1, current.options.length - 1);
  if (pressed[Input.UP]) current.selected = Math.max(current.selected - 1, 0);
  if (pressed[Input.CONFIRM]) choose(game, current.options[current.selected]);
}

/**
 * One step of the game:
 *  - start screen and level complete: the menu (updateMenu);
 *  - playing: the level is stepped; when the player reaches the goal the level
 *    is complete, and is then no longer stepped (frozen under the panel). The
 *    panel offers Next level and Exit game, or only Exit game on the last level;
 *  - cut scene: its time advances by dt; when it has ended, or confirm is
 *    pressed, the next level starts (req 63);
 *  - finished: nothing more happens (the presentation quits through the platform).
 */
export function stepGame(game, input, dt) {
  const next = copyGame(game);
  const pressed = Object.fromEntries(MENU_INPUTS.map((name) => [name, input[name] && !game.held[name]]));
  for (const name of MENU_INPUTS) next.held[name] = input[name];

  switch (game.screen) {
    case Screen.START:
    case Screen.LEVEL_COMPLETE:
      updateMenu(next, pressed);
      break;
    case Screen.PLAYING:
      next.level = step(game.level, input, dt);
      if (reachedGoal(next.level)) {
        const isLast = next.levelIndex === next.data.levelList.levels.length - 1;
        next.screen = Screen.LEVEL_COMPLETE;
        next.menu = menu(isLast ? [MenuOption.EXIT] : [MenuOption.NEXT_LEVEL, MenuOption.EXIT]);
      }
      break;
    case Screen.CUTSCENE: {
      next.cutscene.time += dt;
      const scene = next.data.cutscenes[next.cutscene.name];
      if (pressed[Input.CONFIRM] || cutsceneAt(scene, next.cutscene.time).ended) startNextLevel(next);
      break;
    }
    default:
      break;
  }
  return next;
}
