// Tests for building the simulation state from loaded data (task 3.3; PRD req 27).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLevelState, LevelDataError } from '../../src/simulation/state.js';
import { buildData, TEST_LEVEL } from '../helpers/level-builder.js';

const GRID = [
  '........',
  '.P....G.',
  '####..##',
];

function stateFor(grid = GRID, overrides) {
  return createLevelState(buildData(grid, overrides), TEST_LEVEL);
}

describe('level', () => {
  test('size comes from the grid, in tiles', () => {
    const { level } = stateFor();
    assert.equal(level.width, 8);    // GRID rows are 8 characters long
    assert.equal(level.height, 3);   // GRID has 3 rows
  });

  test('the name comes from the level data', () => {
    const { level } = stateFor(GRID, { level: { name: 'Jungle Edge' } });
    assert.equal(level.name, 'Jungle Edge');
  });

  test('the tile grid keeps tiles and turns everything else into empty space', () => {
    const { level } = stateFor(['P.e.c.b.G', '#########']);
    assert.deepEqual(level.grid, ['.........', '#########']);
  });

  test('tile types come from the legend', () => {
    const { level } = stateFor(GRID, {
      legend: {
        '#': { tile: { solid: true, color: '#111111' } },
        '~': { tile: { solid: false, color: '#0000ff' } },
      },
    });
    assert.deepEqual(level.tileTypes, {
      '#': { solid: true, color: '#111111' },
      '~': { solid: false, color: '#0000ff' },
    });
  });

  test('the state keeps the level name it was built from', () => {
    assert.equal(stateFor().levelName, TEST_LEVEL);
  });
});

describe('player', () => {
  test('is placed with the bottom-centre of its box at the bottom-centre of the start cell', () => {
    const size = { width: 0.8, height: 1.4 };
    const startColumn = 1;   // 'P' in GRID is in column 1...
    const startRow = 1;      // ...of row 1
    const { player } = stateFor(GRID, { player: { size } });

    assert.equal(player.width, size.width);
    assert.equal(player.height, size.height);
    const expectedX = startColumn + 0.5 - size.width / 2;   // horizontally centred in the cell
    const expectedY = startRow + 1 - size.height;           // bottom edge on the cell's bottom edge
    assert.ok(Math.abs(player.x - expectedX) < 1e-9, `x was ${player.x}, expected ${expectedX}`);
    assert.ok(Math.abs(player.y - expectedY) < 1e-9, `y was ${player.y}, expected ${expectedY}`);
  });

  test('starts still, facing right, with health from the player definition', () => {
    const { player } = stateFor(GRID, { player: { health: 5 } });
    assert.equal(player.vx, 0);
    assert.equal(player.vy, 0);
    assert.equal(player.facing, 'right');
    assert.equal(player.health, 5);
  });

  test('the start point is remembered for respawning', () => {
    const { player, start } = stateFor();
    assert.deepEqual(start, { x: player.x, y: player.y });
  });
});

describe('goal, rewards, and time', () => {
  test('the goal is the box of its grid cell', () => {
    // 'G' in GRID is in column 6 of row 1; a cell is 1 × 1 tile.
    assert.deepEqual(stateFor().goal, { x: 6, y: 1, width: 1, height: 1 });
  });

  test('the reward count and time start at zero', () => {
    const state = stateFor();
    assert.equal(state.rewardCount, 0);
    assert.equal(state.time, 0);
  });
});

describe('level-start snapshot (req 27)', () => {
  test('records the player and reward count as they were when the level started', () => {
    const state = stateFor();
    assert.deepEqual(state.levelStart, { player: state.player, rewardCount: 0 });
  });

  test('is a separate copy: changing the live state does not change it', () => {
    const startingHealth = 4;
    const state = stateFor(GRID, { player: { health: startingHealth } });
    const startingX = state.player.x;

    state.player.health = 1;
    state.player.x = startingX + 10;

    assert.equal(state.levelStart.player.health, startingHealth);
    assert.equal(state.levelStart.player.x, startingX);
  });
});

describe('data', () => {
  test('the loaded data is kept by reference, not copied', () => {
    const data = buildData(GRID);
    assert.equal(createLevelState(data, TEST_LEVEL).data, data);
  });

  test('the loaded data is not changed', () => {
    const data = buildData(['P.e.c.o.b.G', '###########']);
    const before = structuredClone(data);
    createLevelState(data, TEST_LEVEL);
    assert.deepEqual(data, before);
  });
});

// ---------------------------------------------------------------------------
// Variations in the input data. The data has already been validated, so it
// always has exactly one start and goal and rows of equal length; these tests
// vary what validation still allows.

/** Placement rule from docs/data-formats.md: box bottom-centre at cell bottom-centre. */
function expectedBox(column, row, size) {
  return { x: column + 0.5 - size.width / 2, y: row + 1 - size.height, width: size.width, height: size.height };
}

function assertBoxNear(actual, expected) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${key} was ${actual[key]}, expected ${expected[key]}`);
  }
}

describe('grid shapes', () => {
  test('the smallest level: one row with only a start and a goal', () => {
    const state = stateFor(['PG']);
    assert.equal(state.level.width, 2);
    assert.equal(state.level.height, 1);
    assert.deepEqual(state.level.grid, ['..']);
    assert.deepEqual(state.goal, { x: 1, y: 0, width: 1, height: 1 });
  });

  test('a single column', () => {
    const state = stateFor(['P', '.', 'G', '#']);
    assert.equal(state.level.width, 1);
    assert.equal(state.level.height, 4);
    assert.deepEqual(state.level.grid, ['.', '.', '.', '#']);
    assert.deepEqual(state.goal, { x: 0, y: 2, width: 1, height: 1 });
  });

  test('a large level', () => {
    const width = 300;
    const height = 40;
    const grid = Array.from({ length: height }, () => '.'.repeat(width));
    grid[height - 2] = 'P' + '.'.repeat(width - 2) + 'G';
    grid[height - 1] = '#'.repeat(width);

    const state = stateFor(grid);
    assert.equal(state.level.width, width);
    assert.equal(state.level.height, height);
    assert.deepEqual(state.goal, { x: width - 1, y: height - 2, width: 1, height: 1 });
    assert.equal(state.level.grid[height - 1], '#'.repeat(width));
  });

  test('a level with no tiles at all', () => {
    const state = stateFor(['P..G']);
    assert.deepEqual(state.level.grid, ['....']);
  });
});

describe('start and goal positions', () => {
  const size = { width: 0.8, height: 1.4 };

  test('start in the top-left corner: the player extends above the level, which is allowed (the top is open)', () => {
    const { player } = stateFor(['P..', '..G', '###'], { player: { size } });
    assertBoxNear(player, expectedBox(0, 0, size));
    assert.ok(player.y < 0);
  });

  test('start in the last column, goal in the first', () => {
    const lastColumn = 4;
    const { player, goal } = stateFor(['G...P', '#####'], { player: { size } });
    assertBoxNear(player, expectedBox(lastColumn, 0, size));
    assert.deepEqual(goal, { x: 0, y: 0, width: 1, height: 1 });
  });

  test('start in the bottom row (over a pit)', () => {
    const bottomRow = 1;
    const { player } = stateFor(['..G', 'P##'], { player: { size } });
    assertBoxNear(player, expectedBox(0, bottomRow, size));
  });

  test('start and goal next to each other', () => {
    const { player, goal } = stateFor(['.PG.', '####'], { player: { size } });
    assertBoxNear(player, expectedBox(1, 0, size));
    assert.deepEqual(goal, { x: 2, y: 0, width: 1, height: 1 });
  });
});

describe('legend characters', () => {
  test('the start and goal are found by their legend entries, not by the letters P and G', () => {
    const size = { width: 1, height: 1 };
    const state = stateFor(['@.P.*', '#####'], {
      player: { size },
      legend: {
        '@': { playerStart: true },
        '*': { goal: true, color: '#00ff00' },
        P: { tile: { solid: true, color: '#999999' } },   // here 'P' is a tile, not the start
      },
    });
    assertBoxNear(state.player, expectedBox(0, 0, size));
    assert.deepEqual(state.goal, { x: 4, y: 0, width: 1, height: 1 });
    assert.deepEqual(state.level.grid, ['..P..', '#####']);
  });

  test('every kind of non-tile cell becomes empty space', () => {
    // P start, e enemy, c crate, o coconut, b reward, G goal (standard legend in level-builder.js)
    const { level } = stateFor(['PecobG', '######']);
    assert.deepEqual(level.grid, ['......', '######']);
  });

  test('non-solid tiles stay in the grid, with solid: false', () => {
    const { level } = stateFor(['P~~G', '####'], {
      legend: { '~': { tile: { solid: false, color: '#3399ff' } } },
    });
    assert.deepEqual(level.grid, ['.~~.', '####']);
    assert.equal(level.tileTypes['~'].solid, false);
  });

  test('several tile types in one level keep their own characters and types', () => {
    const legend = {
      '#': { tile: { solid: true, color: '#111111' } },
      '=': { tile: { solid: true, color: '#222222' } },
      '~': { tile: { solid: false, color: '#333333' } },
    };
    const { level } = stateFor(['P.==.G', '#~~###'], { legend });
    assert.deepEqual(level.grid, ['..==..', '#~~###']);
    for (const ch of ['#', '=', '~']) assert.deepEqual(level.tileTypes[ch], legend[ch].tile);
  });

  test('tile types that the grid doesn\'t use are still listed', () => {
    const { level } = stateFor(['PG', '##'], { legend: { '=': { tile: { solid: true, color: '#222222' } } } });
    assert.ok('=' in level.tileTypes);
  });

  test('legend characters can be any single visible character, including non-ASCII', () => {
    const block = '█';
    const { level } = stateFor(['P..G', block.repeat(4)], {
      legend: { [block]: { tile: { solid: true, color: '#444444' } } },
    });
    assert.equal(level.width, 4);
    assert.deepEqual(level.grid, ['....', block.repeat(4)]);
  });
});

describe('player size compared with a tile', () => {
  const cases = [
    { name: 'exactly one tile', size: { width: 1, height: 1 } },
    { name: 'smaller than a tile', size: { width: 0.25, height: 0.5 } },
    { name: 'wider than a tile (overlaps the cells beside it)', size: { width: 2.5, height: 1 } },
    { name: 'taller than a tile (reaches into the rows above)', size: { width: 0.8, height: 3 } },
  ];
  const startColumn = 2;
  const startRow = 3;
  const grid = ['......', '......', '......', '..P..G', '######'];

  for (const { name, size } of cases) {
    test(`${name}: ${size.width} × ${size.height}`, () => {
      const { player, start } = stateFor(grid, { player: { size } });
      assertBoxNear(player, expectedBox(startColumn, startRow, size));
      assert.deepEqual(start, { x: player.x, y: player.y });
    });
  }
});

// ---------------------------------------------------------------------------
// Invalid levels. The game validates data before building state, so these
// can only happen if validation is skipped. createLevelState must then fail
// with an error saying what it was doing and which part of the level to check,
// rather than crashing with an unrelated TypeError.

/** Runs createLevelState and returns the LevelDataError it throws. */
function levelErrorFor(data, levelName = TEST_LEVEL) {
  try {
    createLevelState(data, levelName);
  } catch (err) {
    assert.ok(err instanceof LevelDataError, `expected a LevelDataError, got ${err.name}: ${err.message}`);
    return err;
  }
  assert.fail('expected createLevelState to throw');
}

/** The parts of a LevelDataError that say what failed, without the wording. */
const what = ({ levelName, task, part }) => ({ levelName, task, part });

describe('invalid levels fail with an explanation', () => {
  const GRID_AND_LEGEND = "the level's grid and legend";

  test('a grid of only a space: no player start', () => {
    assert.deepEqual(what(levelErrorFor(buildData([' ']))),
      { levelName: TEST_LEVEL, task: 'placing the player start', part: GRID_AND_LEGEND });
  });

  test('a grid of only a player: no goal', () => {
    assert.deepEqual(what(levelErrorFor(buildData(['P']))),
      { levelName: TEST_LEVEL, task: 'placing the goal', part: GRID_AND_LEGEND });
  });

  test('a grid of only a goal: no player start', () => {
    assert.deepEqual(what(levelErrorFor(buildData(['G']))),
      { levelName: TEST_LEVEL, task: 'placing the player start', part: GRID_AND_LEGEND });
  });

  test('two player starts', () => {
    const err = levelErrorFor(buildData(['P.P.G', '#####']));
    assert.deepEqual(what(err), { levelName: TEST_LEVEL, task: 'placing the player start', part: GRID_AND_LEGEND });
    assert.match(err.message, /2 player starts/);
  });

  test('two goals', () => {
    const err = levelErrorFor(buildData(['P.G.G', '#####']));
    assert.deepEqual(what(err), { levelName: TEST_LEVEL, task: 'placing the goal', part: GRID_AND_LEGEND });
    assert.match(err.message, /2 goals/);
  });

  test('a level name that isn\'t in the data', () => {
    assert.deepEqual(what(levelErrorFor(buildData(['PG']), 'missing')),
      { levelName: 'missing', task: 'finding the level', part: 'the level list and level files' });
  });

  test('no player definition', () => {
    const data = buildData(['PG']);
    delete data.characters.player;
    assert.deepEqual(what(levelErrorFor(data)),
      { levelName: TEST_LEVEL, task: 'creating the player', part: 'the player definition (characters/player.json)' });
  });

  test('an unexpected failure inside a step is reported with that step, and keeps the original error', () => {
    const data = buildData(['PG']);
    data.levels[TEST_LEVEL].grid = null;   // not a list of rows
    const err = levelErrorFor(data);
    assert.deepEqual(what(err), { levelName: TEST_LEVEL, task: 'building the tile grid', part: GRID_AND_LEGEND });
    assert.ok(err.cause instanceof TypeError);
  });

  test('the message says which level, what was being done, why, and what to check', () => {
    assert.equal(levelErrorFor(buildData(['G'])).message,
      'Can\'t build level "test" while placing the player start: the level has no player start. ' +
      'Check the level\'s grid and legend. (Game data should be validated before a level is built.)');
  });
});

describe('choosing a level', () => {
  test('builds the named level, not the first one in the data', () => {
    const data = buildData(['PG', '##']);
    data.levels.second = { ...data.levels[TEST_LEVEL], name: 'Second', grid: ['G..P', '####'] };
    data.levelList.levels.push('second');

    const state = createLevelState(data, 'second');
    assert.equal(state.levelName, 'second');
    assert.equal(state.level.name, 'Second');
    assert.equal(state.level.width, 4);
    assert.deepEqual(state.goal, { x: 0, y: 0, width: 1, height: 1 });
  });
});
