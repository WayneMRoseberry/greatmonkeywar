// Builds the simulation state for a level from loaded game data.
//
// All positions and sizes are in tiles. A box is { x, y, width, height } where
// (x, y) is its top-left corner; y increases downwards (docs/data-formats.md).

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
function placeInCell(column, row, width, height) {
  return { x: column + 0.5 - width / 2, y: row + 1 - height, width, height };
}

/** Finds the cells whose legend entry matches `test`, as [{ column, row }]. */
function findCells(grid, legend, test) {
  const cells = [];
  grid.forEach((line, row) => {
    [...line].forEach((ch, column) => {
      if (legend[ch] && test(legend[ch])) cells.push({ column, row });
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
 * Throws a LevelDataError if the level can't be built.
 */
export function createLevelState(data, levelName) {
  const source = step(levelName, 'finding the level', 'the level list and level files', (fail) =>
    data.levels[levelName] ?? fail(`there is no level named "${levelName}" in the data`));

  const level = step(levelName, 'building the tile grid', GRID_AND_LEGEND, () => buildLevel(source));

  const startCell = step(levelName, 'placing the player start', GRID_AND_LEGEND, (fail) =>
    findOneCell(source, (e) => e.playerStart, 'player start', fail));

  const player = step(levelName, 'creating the player', 'the player definition (characters/player.json)', (fail) => {
    const definition = data.characters.player ?? fail('there is no player definition');
    const box = placeInCell(startCell.column, startCell.row, definition.size.width, definition.size.height);
    return { ...box, vx: 0, vy: 0, onGround: false, facing: 'right', health: definition.health };
  });

  const goalCell = step(levelName, 'placing the goal', GRID_AND_LEGEND, (fail) =>
    findOneCell(source, (e) => e.goal, 'goal', fail));

  const state = {
    data,
    levelName,
    level,
    start: { x: player.x, y: player.y },
    goal: { x: goalCell.column, y: goalCell.row, width: 1, height: 1 },
    player,
    rewardCount: 0,
    time: 0,
  };
  state.levelStart = structuredClone({ player: state.player, rewardCount: state.rewardCount });
  return state;
}
