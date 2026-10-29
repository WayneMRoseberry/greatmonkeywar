// Simulation timing. The game logic always advances in fixed steps of FIXED_DT
// seconds, whatever the frame rate, so it behaves the same on every machine
// and tests can step it exactly (PRD requirements 4-5).

export const STEPS_PER_SECOND = 60;
export const FIXED_DT = 1 / STEPS_PER_SECOND;

/**
 * The directions a character can face. Use these names, never the raw strings.
 * The values match the "facing" values in cut scene data files
 * (src/data/schemas/cutscene.schema.json); a test keeps the two in sync.
 */
export const Facing = Object.freeze({
  LEFT: 'left',
  RIGHT: 'right',
});

/**
 * The kinds a level's legend entry can be: each entry has exactly one of these
 * fields (src/data/schemas/level.schema.json, checked by src/data/validate.js).
 * Listed in the order docs/data-formats.md and the validator's messages use.
 * Use these names in checks such as `LegendKind.GOAL in entry`; reading a
 * field's value stays plain (`entry.goal`). A test keeps them in sync with
 * the schema.
 */
export const LegendKind = Object.freeze({
  TILE: 'tile',
  PLAYER_START: 'playerStart',
  GOAL: 'goal',
  ENEMY: 'enemy',
  OBJECT: 'object',
  REWARD: 'reward',
});

/**
 * The other fields a legend entry may have, each belonging with one kind:
 * `color` with a goal, `facing` with an enemy. With LegendKind, these are all
 * the fields a legend entry may have; a test keeps them in sync with the schema.
 */
export const LegendField = Object.freeze({
  COLOR: 'color',
  FACING: 'facing',
});

/**
 * The kinds of character a character definition can be (its "kind" field,
 * src/data/schemas/character.schema.json). A test keeps them in sync with the
 * schema.
 */
export const CharacterKind = Object.freeze({
  PLAYER: 'player',
  ENEMY: 'enemy',
});

/**
 * The things that happen in the game that can have a sound (sound PRD req 14).
 * The simulation and the game flow record these; audio.json gives each one a
 * sound file (src/data/schemas/audio.schema.json). A test keeps the two in sync.
 */
export const SoundEvent = Object.freeze({
  JUMP: 'jump',
  LAND: 'land',
  PUNCH: 'punch',
  PICK_UP: 'pickUp',
  DROP: 'drop',
  THROW: 'throw',
  STOMP: 'stomp',
  ENEMY_DEFEATED: 'enemyDefeated',
  PLAYER_HURT: 'playerHurt',
  PLAYER_DEFEATED: 'playerDefeated',
  COLLECT_REWARD: 'collectReward',
  REACH_GOAL: 'reachGoal',
  MENU_MOVE: 'menuMove',
  MENU_CHOOSE: 'menuChoose',
});
