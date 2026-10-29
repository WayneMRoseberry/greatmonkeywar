// Builds the simulation state for a level from loaded game data.
//
// All positions and sizes are in tiles. A box is { x, y, width, height } where
// (x, y) is its top-left corner; y increases downwards (docs/data-formats.md).
//
// createLevelState is the gate between data and simulation. Data is validated
// when loaded (src/data/validate.js); this file then checks what building a
// level needs (the level exists, exactly one start and goal, a player
// definition, an enemy definition for each enemy, a definition for each
// object) and throws a LevelDataError if not. The rest of the simulation
// (step.js, player.js, collision.js, ...) relies on that and doesn't check again.

import { Player } from './player.js';
import { CarriableObject, settleResting } from './objects.js';
import { rewardInCell } from './rewards.js';
import { createEnemy } from './enemies.js';
import { overlapsSolid, overlapsBox } from './collision.js';
import { CharacterKind } from './constants.js';

const GRID_AND_LEGEND = "the level's grid and legend";

/**
 * Thrown when a level can't be built from the data given. The game validates
 * data before building levels, so this means validation was skipped or missed
 * something. Fields: levelName, task (what was being done), part (which part
 * of the data to check), cause (the original error, if there was one).
 */
export class LevelDataError extends Error {
  constructor({ levelName, task, part, reason, cause }) {
    super(
      `Can't build level "${levelName}" while ${task}: ${reason}. ` +
      `Check ${part}. (Game data should be validated before a level is built.)`,
      { cause },
    );
    this.name = 'LevelDataError';
    this.levelName = levelName;
    this.task = task;
    this.part = part;
  }
}

/**
 * Runs one step of building a level. A problem found by the step (`fail`) or
 * any unexpected error becomes a LevelDataError naming the step.
 */
function step(levelName, task, part, run) {
  const fail = (reason) => { throw new LevelDataError({ levelName, task, part, reason }); };
  try {
    return run(fail);
  } catch (err) {
    if (err instanceof LevelDataError) throw err;
    throw new LevelDataError({ levelName, task, part, reason: `unexpected error (${err.message})`, cause: err });
  }
}

/**
 * The box of an entity of the given size placed in grid cell (column, row):
 * its bottom-centre sits at the bottom-centre of the cell.
 */
export function placeInCell(column, row, width, height) {
  return { x: column + 0.5 - width / 2, y: row + 1 - height, width, height };
}

/**
 * Finds the cells whose legend entry matches `test`, in grid order (rows top
 * to bottom, then left to right), as [{ column, row, entry }].
 */
function findCells(grid, legend, test) {
  const cells = [];
  grid.forEach((line, row) => {
    [...line].forEach((ch, column) => {
      if (legend[ch] && test(legend[ch])) cells.push({ column, row, entry: legend[ch] });
    });
  });
  return cells;
}

/** The one cell matching `test`; fails if there are none or several. */
function findOneCell(source, test, what, fail) {
  const cells = findCells(source.grid, source.legend, test);
  if (cells.length === 0) fail(`the level has no ${what}`);
  if (cells.length > 1) fail(`the level has ${cells.length} ${what}s, but it must have exactly one`);
  return cells[0];
}

function buildLevel(source) {
  const tileTypes = {};
  for (const [ch, entry] of Object.entries(source.legend)) {
    if (entry.tile) tileTypes[ch] = { solid: entry.tile.solid, color: entry.tile.color };
  }
  return {
    name: source.name,
    width: source.grid[0].length,
    height: source.grid.length,
    // Only tiles stay in the grid; start, goal, and entity cells are empty space.
    grid: source.grid.map((line) => [...line].map((ch) => (ch in tileTypes ? ch : '.')).join('')),
    tileTypes,
  };
}

/**
 * The state at the start of level `levelName`. `data` is validated game data
 * (see src/data/validate.js); it is kept by reference and never changed.
 * `carry` ({ health, rewardCount }, optional) is what the player brings from
 * the level before (req 59): the player starts with that health and reward
 * count instead of the definition's health and 0, and so does the level-start
 * snapshot, so a restart goes back to them.
 * Throws a LevelDataError if the level can't be built.
 */
export function createLevelState(data, levelName, carry) {
  const source = step(levelName, 'finding the level', 'the level list and level files', (fail) =>
    data.levels[levelName] ?? fail(`there is no level named "${levelName}" in the data`));

  const level = step(levelName, 'building the tile grid', GRID_AND_LEGEND, () => buildLevel(source));

  const startCell = step(levelName, 'placing the player start', GRID_AND_LEGEND, (fail) =>
    findOneCell(source, (e) => e.playerStart, 'player start', fail));

  const player = step(levelName, 'creating the player', 'the player definition (characters/player.json)', (fail) => {
    const definition = data.characters.player ?? fail('there is no player definition');
    const box = placeInCell(startCell.column, startCell.row, definition.size.width, definition.size.height);
    return new Player({ ...box, health: carry?.health ?? definition.health });   // everything else starts at Player's defaults
  });

  // The player must not start inside something solid: collision only stops boxes
  // moving into solids, so one placed inside a floor or ceiling could pass through
  // it. Respawning uses the same start point, so this covers that too.
  step(levelName, 'fitting the player at the start', "the level's grid and legend, or the player's size in characters/player.json", (fail) => {
    const tile = overlapsSolid(level, player);
    if (tile) {
      fail(`the player (${player.width} × ${player.height} tiles) would overlap ` +
        `the solid tile at row ${tile.row + 1}, column ${tile.column + 1}`);
    }
  });

  const goalCell = step(levelName, 'placing the goal', GRID_AND_LEGEND, (fail) =>
    findOneCell(source, (e) => e.goal, 'goal', fail));

  const enemyCells = findCells(source.grid, source.legend, (e) => e.enemy);
  const enemies = step(levelName, 'placing the enemies', "the level's legend and the character definitions (data/characters/)", (fail) =>
    enemyCells.map(({ column, row, entry }) => {
      const definition = data.characters[entry.enemy] ?? fail(`there is no character definition named "${entry.enemy}"`);
      if (definition.kind !== CharacterKind.ENEMY) fail(`"${entry.enemy}" is the player, not an enemy`);
      return createEnemy(placeInCell(column, row, definition.size.width, definition.size.height), entry, definition);
    }));

  // As for the player: an enemy placed inside something solid could pass through it.
  step(levelName, 'fitting the enemies', "the level's grid and legend, or the enemy's size in its character definition (data/characters/)", (fail) => {
    enemies.forEach((enemy, i) => {
      const tile = overlapsSolid(level, enemy);
      const { row, column } = enemyCells[i];
      if (tile) {
        fail(`the enemy "${enemy.type}" at row ${row + 1}, column ${column + 1} (${enemy.width} × ${enemy.height} tiles) ` +
          `would overlap the solid tile at row ${tile.row + 1}, column ${tile.column + 1}`);
      }
    });
  });

  // Objects placed one above another start stacked (req 28): placement puts
  // each on its cell's bottom edge, so a 1-tile crate rests on the one below.
  const objectCells = findCells(source.grid, source.legend, (e) => e.object);
  const objects = step(levelName, 'placing the objects', "the level's legend and the object definitions (data/objects/)", (fail) => {
    const placed = objectCells.map(({ column, row, entry }) => {
      const definition = data.objects[entry.object] ?? fail(`there is no object definition named "${entry.object}"`);
      return new CarriableObject({
        type: entry.object,
        ...placeInCell(column, row, definition.size.width, definition.size.height),
      });
    });
    settleResting(level, placed, data.objects);   // which start at rest
    return placed;
  });

  // As for the player and enemies (task 4.11): an object placed inside something solid
  // would rest inside a wall, as a solid surface there, or could fall through it. Nor may
  // two objects start overlapping each other (touching is fine): one could get stuck inside the other.
  step(levelName, 'fitting the objects', "the level's grid and legend, or the object's size in its definition (data/objects/)", (fail) => {
    const where = (i) => `the object "${objects[i].type}" at row ${objectCells[i].row + 1}, column ${objectCells[i].column + 1}`;
    objects.forEach((object, i) => {
      const tile = overlapsSolid(level, object);
      if (tile) {
        fail(`${where(i)} (${object.width} × ${object.height} tiles) ` +
          `would overlap the solid tile at row ${tile.row + 1}, column ${tile.column + 1}`);
      }
      for (let j = i + 1; j < objects.length; j++) {
        if (overlapsBox(object, objects[j])) fail(`${where(i)} and ${where(j)} would overlap each other`);
      }
    });
  });

  const rewards = step(levelName, 'placing the rewards', GRID_AND_LEGEND, () =>
    findCells(source.grid, source.legend, (e) => e.reward).map(({ column, row, entry }) => rewardInCell(column, row, entry.reward)));

  const state = {
    data,
    levelName,
    level,
    start: { x: player.x, y: player.y },
    goal: { x: goalCell.column, y: goalCell.row, width: 1, height: 1 },
    player,
    enemies,
    objects,
    rewards,
    rewardCount: carry?.rewardCount ?? 0,
    time: 0,
    events: [],   // the SoundEvents of the latest step (constants.js); step() starts each one empty
  };
  state.levelStart = {
    player: player.copy(),
    enemies: enemies.map((e) => e.copy()),
    objects: objects.map((o) => o.copy()),
    rewards: structuredClone(rewards),
    rewardCount: state.rewardCount,
  };
  return state;
}
