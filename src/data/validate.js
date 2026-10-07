// Validates all game data and explains every problem in plain language
// (PRD requirements 82-85). Used by tools/validate-data.js (Node) and by the
// game when it loads data (browser), so this module never touches the file
// system itself: the caller passes in the files' text and the images found.
//
// validateData({ files, images }) where
//   files:  { 'levels/level1.json': '<file text>', ... }   paths relative to data/
//   images: { 'sprites/player.png': { width, height } | null, ... }   null = size unknown
// returns { errors, warnings, data }
//   errors/warnings: [{ file, message }]  (see formatProblem)
//   data: the parsed files, grouped by kind (only files that parsed)
//
// The formats are specified in docs/data-formats.md.

import { checkSchema, typeOf } from './schema-check.js';
import levelSchema from './schemas/level.schema.json' with { type: 'json' };
import levelListSchema from './schemas/level-list.schema.json' with { type: 'json' };
import characterSchema from './schemas/character.schema.json' with { type: 'json' };
import objectSchema from './schemas/object.schema.json' with { type: 'json' };
import cutsceneSchema from './schemas/cutscene.schema.json' with { type: 'json' };
import spriteSchema from './schemas/sprite.schema.json' with { type: 'json' };
import tuningSchema from './schemas/tuning.schema.json' with { type: 'json' };
import bindingsSchema from './schemas/bindings.schema.json' with { type: 'json' };
import displaySchema from './schemas/display.schema.json' with { type: 'json' };

export const SCHEMAS = {
  level: levelSchema,
  'level-list': levelListSchema,
  character: characterSchema,
  object: objectSchema,
  cutscene: cutsceneSchema,
  sprite: spriteSchema,
  tuning: tuningSchema,
  bindings: bindingsSchema,
  display: displaySchema,
};

export const REQUIRED_FILES = [
  'levels/levels.json',
  'characters/player.json',
  'config/tuning.json',
  'config/bindings.json',
  'config/display.json',
];

const LEGEND_KINDS = ['tile', 'playerStart', 'goal', 'enemy', 'object', 'reward'];

export function formatProblem({ file, message }) {
  return `${file}: ${message}`;
}

/** Which format a data file uses, from its path; null if the game doesn't use it. */
export function classifyFile(path) {
  if (path === 'levels/levels.json') return 'level-list';
  const match = /^(levels|characters|objects|cutscenes|sprites)\/[A-Za-z0-9_-]+\.json$/.exec(path);
  if (match) {
    return { levels: 'level', characters: 'character', objects: 'object', cutscenes: 'cutscene', sprites: 'sprite' }[match[1]];
  }
  const config = /^config\/(tuning|bindings|display)\.json$/.exec(path);
  return config ? config[1] : null;
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
}

export function validateData({ files, images = {} }) {
  const errors = [];
  const warnings = [];
  const error = (file, message) => errors.push({ file, message });
  const warn = (file, message) => warnings.push({ file, message });

  // Names of every file of each kind, valid or not, so a reference to a broken
  // file isn't also reported as a missing file.
  const names = { level: new Set(), character: new Set(), object: new Set(), cutscene: new Set(), sprite: new Set() };
  const parsed = [];

  for (const [path, text] of Object.entries(files)) {
    const kind = classifyFile(path);
    if (!kind) {
      warn(path, 'this is not a file the game uses, so it was not checked. Check its name and folder (see docs/data-formats.md).');
      continue;
    }
    if (names[kind]) names[kind].add(baseName(path));

    const json = parseJson(text);
    if (json.error) {
      error(path, json.error);
      continue;
    }
    const problems = checkSchema(SCHEMAS[kind], json.value);
    for (const problem of problems) error(path, describeSchemaProblem(problem));
    parsed.push({ path, kind, name: baseName(path), value: json.value, valid: problems.length === 0 });
  }

  for (const required of REQUIRED_FILES) {
    if (!(required in files)) error(required, 'this file is missing. The game cannot start without it.');
  }

  const data = groupByKind(parsed);
  const context = { names, images, data, error, warn };
  for (const file of parsed.filter((f) => f.valid)) {
    CUSTOM_CHECKS[file.kind]?.(file, context);
  }

  return { errors, warnings, data };
}

function groupByKind(parsed) {
  const data = { levelList: null, levels: {}, characters: {}, objects: {}, cutscenes: {}, sprites: {}, tuning: null, bindings: null, display: null };
  for (const { kind, name, value } of parsed) {
    if (kind === 'level-list') data.levelList = value;
    else if (kind === 'level') data.levels[name] = value;
    else if (kind === 'character') data.characters[name] = value;
    else if (kind === 'object') data.objects[name] = value;
    else if (kind === 'cutscene') data.cutscenes[name] = value;
    else if (kind === 'sprite') data.sprites[name] = value;
    else data[kind] = value;
  }
  return data;
}

// ---------------------------------------------------------------------------
// JSON syntax

function parseJson(text) {
  // Some Windows editors add an invisible "byte order mark" at the start of the file.
  const clean = text.replace(/^﻿/, '');
  try {
    return { value: JSON.parse(clean) };
  } catch (err) {
    const position = /position (\d+)/.exec(err.message);
    let where = '';
    if (position) {
      const before = clean.slice(0, Number(position[1]));
      const line = before.split('\n').length;
      const column = before.length - before.lastIndexOf('\n');
      where = ` near line ${line}, column ${column}`;
    }
    const detail = err.message.replace(/ in JSON at position \d+.*$/, '');
    return {
      error: `this file is not valid JSON${where}. Look for a missing or extra comma, quote mark, or bracket there. (Details: ${detail}.)`,
    };
  }
}

// ---------------------------------------------------------------------------
// Schema problems in plain language

const TYPE_WORDS = {
  integer: 'a whole number',
  number: 'a number',
  string: 'text in quotes',
  boolean: 'true or false',
  object: 'a group of fields in { }',
  array: 'a list in [ ]',
};

// Plain-language descriptions of the patterns used in the schemas.
const PATTERN_WORDS = new Map([
  [levelSchema.$defs.color.pattern, 'a colour written like "#7a5230"'],
  [levelSchema.$defs.name.pattern, 'a name made only of letters, numbers, "-" and "_" (no spaces, folder, or ".json")'],
  [levelSchema.$defs.imagePath.pattern, 'an image path inside the data folder, like "images/sky.png"'],
  [spriteSchema.properties.image.pattern, 'a PNG image path inside the data folder, like "sprites/player.png"'],
  [bindingsSchema.$defs.keys.items.pattern, 'a key code like "KeyA", "ArrowLeft", or "Space"'],
  [levelSchema.properties.legend.propertyNames.pattern, 'a single character other than "." or a space'],
]);

function show(value) {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function describeValue(value) {
  switch (typeOf(value)) {
    case 'string': return `the text "${value}"`;
    case 'array': return 'a list';
    case 'object': return 'a group of fields';
    default: return String(value);
  }
}

function segmentLabel(segment, parentSegment) {
  if (typeof segment === 'number') return parentSegment === 'grid' ? `row ${segment + 1}` : `item ${segment + 1}`;
  return segment;
}

function pathText(path) {
  return path.map((seg, i) => segmentLabel(seg, path[i - 1])).join(' → ');
}

/** Splits a path into "in <parent>, " and the label of its last part. */
function subject(path) {
  if (path.length === 0) return { prefix: '', label: 'the file' };
  const parent = path.slice(0, -1);
  const label = `"${segmentLabel(path[path.length - 1], parent[parent.length - 1])}"`;
  return { prefix: parent.length ? `in ${pathText(parent)}, ` : '', label };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function describeSchemaProblem(problem) {
  const { path, keyword, value } = problem;
  const { prefix, label } = subject(path);
  const inside = path.length ? ` from ${pathText(path)}` : '';

  switch (keyword) {
    case 'required':
      return `"${problem.field}" is missing${inside}.`;
    case 'additionalProperties': {
      const allowed = problem.allowed.filter((f) => f !== '$schema').map((f) => `"${f}"`).join(', ');
      return `${prefix}${label} is not a field that belongs here. Check its spelling. The fields allowed here are: ${allowed}.`;
    }
    case 'propertyNames': {
      const rule = PATTERN_WORDS.get(problem.pattern) ?? 'in the expected form';
      return `${path.length ? `in ${pathText(path)}, ` : ''}"${problem.key}" can't be used as a key: it must be ${rule}.`;
    }
    case 'type':
      return `${prefix}${label} should be ${TYPE_WORDS[problem.expected]}, but it is ${describeValue(value)}.`;
    case 'const':
      if (path.length === 1 && path[0] === 'formatVersion') {
        return `"formatVersion" must be ${problem.expected}, but it is ${show(value)}. This file may have been made for a different version of the game.`;
      }
      return `${prefix}${label} must be ${show(problem.expected)}, but it is ${show(value)}.`;
    case 'enum':
      return `${prefix}${label} must be one of ${problem.allowed.map(show).join(', ')}, but it is ${show(value)}.`;
    case 'minimum':
      return `${prefix}${label} must be at least ${problem.limit}, but it is ${value}.`;
    case 'maximum':
      return `${prefix}${label} must be at most ${problem.limit}, but it is ${value}.`;
    case 'exclusiveMinimum':
      return `${prefix}${label} must be more than ${problem.limit}, but it is ${value}.`;
    case 'exclusiveMaximum':
      return `${prefix}${label} must be less than ${problem.limit}, but it is ${value}.`;
    case 'minLength':
      return problem.limit === 1
        ? `${prefix}${label} must not be empty.`
        : `${prefix}${label} must be at least ${plural(problem.limit, 'character')} long.`;
    case 'maxLength':
      return `${prefix}${label} must be at most ${plural(problem.limit, 'character')} long.`;
    case 'pattern':
      return `${prefix}${label} is ${show(value)}, which is not ${PATTERN_WORDS.get(problem.pattern) ?? 'in the expected form'}.`;
    case 'minItems':
      return `${prefix}${label} must have at least ${plural(problem.limit, 'entry').replace('entrys', 'entries')}.`;
    case 'uniqueItems':
      return `${prefix}${label} lists ${show(problem.duplicate)} more than once.`;
    default:
      return `${prefix}${label} is not valid (${keyword}).`;
  }
}

// ---------------------------------------------------------------------------
// Custom checks: rules that compare fields or refer to other files.
// These only run on files that passed their schema, so fields can be trusted.

const CUSTOM_CHECKS = {
  level: checkLevel,
  'level-list': checkLevelList,
  character: checkCharacter,
  object: checkObject,
  cutscene: checkCutscene,
  sprite: checkSprite,
};

function checkLevel({ path, value: level }, { names, images, data, error, warn }) {
  const { grid, legend } = level;

  // Row lengths
  const width = grid[0].length;
  grid.forEach((row, i) => {
    if (row.length !== width) {
      error(path, `row ${i + 1} has ${row.length} tiles but row 1 has ${width}. All rows must be the same length.`);
    }
  });

  // Grid characters: unknown characters, and where player starts and goals are
  const unknown = new Map();
  const used = new Set();
  const starts = [];
  const goals = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const entry = legend[ch];
      if (!entry) {
        const seen = unknown.get(ch) ?? { row: r + 1, column: c + 1, count: 0 };
        seen.count++;
        unknown.set(ch, seen);
        return;
      }
      used.add(ch);
      if (entry.playerStart) starts.push(`row ${r + 1}, column ${c + 1}`);
      if (entry.goal) goals.push(`row ${r + 1}, column ${c + 1}`);
    });
  });
  for (const [ch, { row, column, count }] of unknown) {
    const times = count > 1 ? `, and ${count - 1} more time${count === 2 ? '' : 's'}` : '';
    error(path, `the character "${ch}" (at row ${row}, column ${column}${times}) is not in the legend. Add it to "legend", or replace it with "." for empty space.`);
  }
  checkExactlyOne(path, error, starts, 'player start', '"playerStart": true');
  checkExactlyOne(path, error, goals, 'goal', '"goal": true');

  // Legend entries
  for (const [key, entry] of Object.entries(legend)) {
    const kinds = LEGEND_KINDS.filter((k) => k in entry);
    if (kinds.length === 0) {
      error(path, `legend "${key}" doesn't say what it is. Give it exactly one of: ${LEGEND_KINDS.join(', ')}.`);
    } else if (kinds.length > 1) {
      error(path, `legend "${key}" has more than one of ${kinds.join(' and ')}. A legend entry must be exactly one thing.`);
    }
    if ('color' in entry && !('goal' in entry)) {
      error(path, `legend "${key}" has a "color" directly inside it, which only goals use. For a tile or reward, put "color" inside "tile" or "reward".`);
    }
    if ('goal' in entry && !('color' in entry)) {
      error(path, `legend "${key}" is a goal but has no "color". Add one, like "color": "#ff3030".`);
    }
    if ('enemy' in entry) {
      if (!names.character.has(entry.enemy)) {
        error(path, `legend "${key}" is the enemy "${entry.enemy}", but there is no file data/characters/${entry.enemy}.json.`);
      } else if (data.characters[entry.enemy]?.kind === 'player') {
        error(path, `legend "${key}" uses "${entry.enemy}" as an enemy, but that character is the player.`);
      }
    }
    if ('object' in entry && !names.object.has(entry.object)) {
      error(path, `legend "${key}" is the object "${entry.object}", but there is no file data/objects/${entry.object}.json.`);
    }
    if (!used.has(key)) {
      warn(path, `legend "${key}" is not used anywhere in the grid.`);
    }
  }

  if (level.cutscene !== undefined && !names.cutscene.has(level.cutscene)) {
    error(path, `"cutscene" is "${level.cutscene}", but there is no file data/cutscenes/${level.cutscene}.json.`);
  }
  level.background.layers.forEach((layer, i) => {
    if (!(layer.image in images)) {
      error(path, `background layer ${i + 1} uses the image "${layer.image}", but there is no file data/${layer.image}.`);
    }
  });
}

function checkExactlyOne(path, error, found, what, how) {
  if (found.length === 0) {
    error(path, `the level has no ${what}. It needs exactly one: a grid character whose legend entry is ${how}.`);
  } else if (found.length > 1) {
    error(path, `the level has ${found.length} ${what}s (at ${found.join('; ')}). It needs exactly one.`);
  }
}

function checkLevelList({ path, value }, { names, error }) {
  value.levels.forEach((name, i) => {
    if (name === 'levels') {
      error(path, `levels, item ${i + 1}: "levels" is the level list itself, not a level.`);
    } else if (!names.level.has(name)) {
      error(path, `levels, item ${i + 1} is "${name}", but there is no file data/levels/${name}.json.`);
    }
  });
}

function checkSpriteReference(path, owner, names, error) {
  if (owner.sprite !== undefined && !names.sprite.has(owner.sprite)) {
    error(path, `"sprite" is "${owner.sprite}", but there is no file data/sprites/${owner.sprite}.json.`);
  }
}

function checkCharacter({ path, name, value }, { names, error }) {
  if (name === 'player' && value.kind !== 'player') {
    error(path, `"kind" must be "player" in player.json, but it is "${value.kind}".`);
  }
  if (name !== 'player' && value.kind !== 'enemy') {
    error(path, `"kind" is "player", but only data/characters/player.json can be the player. Use "enemy".`);
  }
  if (value.kind === 'enemy' && 'punchDamage' in value) {
    error(path, `"punchDamage" is only for the player. Remove it from this enemy.`);
  }
  checkSpriteReference(path, value, names, error);
}

function checkObject({ path, value }, { names, error }) {
  checkSpriteReference(path, value, names, error);
}

function checkCutscene({ path, value }, { names, images, data, error, warn }) {
  if (!(value.background in images)) {
    error(path, `"background" is "${value.background}", but there is no file data/${value.background}.`);
  }
  value.actors.forEach((actor, a) => {
    const where = `actors, item ${a + 1}`;
    if (!names.character.has(actor.character)) {
      error(path, `${where}: "character" is "${actor.character}", but there is no file data/characters/${actor.character}.json.`);
    }
    actor.keyframes.forEach((frame, k) => {
      const previous = actor.keyframes[k - 1];
      if (previous && frame.time <= previous.time) {
        error(path, `${where}, keyframe ${k + 1}: "time" is ${frame.time}, but it must be later than the keyframe before it (${previous.time}). Keyframes must be in time order.`);
      }
    });
    const sprite = data.sprites[data.characters[actor.character]?.sprite];
    if (sprite) {
      for (const frame of actor.keyframes) {
        if (frame.animation && !(frame.animation in sprite.animations)) {
          warn(path, `${where}: the animation "${frame.animation}" is not in the sprite sheet "${data.characters[actor.character].sprite}", so "idle" will be shown instead.`);
        }
      }
    }
  });
  value.narration.forEach((line, n) => {
    const where = `narration, item ${n + 1}`;
    if (line.end <= line.start) {
      error(path, `${where}: "end" (${line.end}) must be later than "start" (${line.start}).`);
    }
    const previous = value.narration[n - 1];
    if (previous && line.start < previous.start) {
      error(path, `${where}: "start" is ${line.start}, which is earlier than the line before it (${previous.start}). Narration lines must be listed in time order.`);
    }
  });
}

function checkSprite({ path, value }, { images, error }) {
  if (!(value.image in images)) {
    error(path, `"image" is "${value.image}", but there is no file data/${value.image}.`);
    return;
  }
  const size = images[value.image];
  if (!size) return; // Size unknown; frames can't be checked.
  const columns = Math.floor(size.width / value.frameWidth);
  const rows = Math.floor(size.height / value.frameHeight);
  const total = columns * rows;
  if (total === 0) {
    error(path, `each frame is ${value.frameWidth} × ${value.frameHeight} pixels, which is bigger than the whole image (${size.width} × ${size.height}).`);
    return;
  }
  for (const [name, animation] of Object.entries(value.animations)) {
    for (const frame of animation.frames) {
      if (frame >= total) {
        error(path, `the animation "${name}" uses frame ${frame}, but the image only has ${plural(total, 'frame')} (numbered 0 to ${total - 1}).`);
      }
    }
  }
}
