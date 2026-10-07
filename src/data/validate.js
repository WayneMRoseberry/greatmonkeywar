// Validates all game data and explains every problem in plain language
// (PRD requirements 82-85). Used by tools/validate-data.js (Node) and by the
// game when it loads data (browser), so this module never touches the file
// system itself: the caller passes in the files' text and the images found.
//
// validateData({ files, images }) where
//   files:  { 'levels/level1.json': '<file text>', ... }   paths relative to data/
//   images: { 'sprites/player.png': { width, height } | null, ... }   null = size unknown
// returns { errors, warnings, data }
//   errors/warnings: [{ file, code, details, message }]
//     code:    what kind of problem it is, e.g. 'row-length' (see MESSAGES below)
//     details: the facts about it, e.g. { row: 3, length: 11, expected: 12 }.
//              Schema problems include `path`, the location in the file's data
//              (array indexes from 0). Other positions (rows, columns, items,
//              layers, actors, keyframes, lines) count from 1, as people do.
//     message: describeProblem(code, details), the plain-language explanation
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
  const problem = (file, code, details = {}) => ({ file, code, details, message: describeProblem(code, details) });
  const error = (file, code, details) => errors.push(problem(file, code, details));
  const warn = (file, code, details) => warnings.push(problem(file, code, details));

  // Names of every file of each kind, valid or not, so a reference to a broken
  // file isn't also reported as a missing file.
  const names = { level: new Set(), character: new Set(), object: new Set(), cutscene: new Set(), sprite: new Set() };
  const parsed = [];

  for (const [path, text] of Object.entries(files)) {
    const kind = classifyFile(path);
    if (!kind) {
      warn(path, 'unrecognized-file');
      continue;
    }
    if (names[kind]) names[kind].add(baseName(path));

    const json = parseJson(text);
    if (json.error) {
      error(path, 'invalid-json', json.error);
      continue;
    }
    const problems = checkSchema(SCHEMAS[kind], json.value);
    for (const p of problems) {
      const [code, details] = fromSchemaProblem(p);
      error(path, code, details);
    }
    parsed.push({ path, kind, name: baseName(path), value: json.value, valid: problems.length === 0 });
  }

  for (const required of REQUIRED_FILES) {
    if (!(required in files)) error(required, 'missing-file');
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
    let line = null;
    let column = null;
    if (position) {
      const before = clean.slice(0, Number(position[1]));
      line = before.split('\n').length;
      column = before.length - before.lastIndexOf('\n');
    }
    const detail = err.message.replace(/ in JSON at position \d+.*$/, '');
    return { error: { line, column, detail } };
  }
}

// ---------------------------------------------------------------------------
// Schema problems → codes

// Names for the patterns used in the schemas.
const FORMAT_NAMES = new Map([
  [levelSchema.$defs.color.pattern, 'color'],
  [levelSchema.$defs.name.pattern, 'name'],
  [levelSchema.$defs.imagePath.pattern, 'image-path'],
  [spriteSchema.properties.image.pattern, 'png-path'],
  [bindingsSchema.$defs.keys.items.pattern, 'key-code'],
  [levelSchema.properties.legend.propertyNames.pattern, 'legend-key'],
]);

const formatName = (pattern) => FORMAT_NAMES.get(pattern) ?? 'other';

function fromSchemaProblem(p) {
  const { path, value } = p;
  switch (p.keyword) {
    case 'required': return ['missing-field', { path, field: p.field }];
    case 'additionalProperties':
      return ['unknown-field', { path: path.slice(0, -1), field: path[path.length - 1], allowed: p.allowed.filter((f) => f !== '$schema') }];
    case 'propertyNames': return ['bad-key', { path, key: p.key, format: formatName(p.pattern) }];
    case 'type': return ['wrong-type', { path, expected: p.expected, value }];
    case 'const':
      return path.length === 1 && path[0] === 'formatVersion'
        ? ['wrong-format-version', { expected: p.expected, value }]
        : ['wrong-value', { path, expected: p.expected, value }];
    case 'enum': return ['not-allowed', { path, allowed: p.allowed, value }];
    case 'minimum': return ['too-small', { path, limit: p.limit, inclusive: true, value }];
    case 'exclusiveMinimum': return ['too-small', { path, limit: p.limit, inclusive: false, value }];
    case 'maximum': return ['too-large', { path, limit: p.limit, inclusive: true, value }];
    case 'exclusiveMaximum': return ['too-large', { path, limit: p.limit, inclusive: false, value }];
    case 'minLength': return ['too-short', { path, limit: p.limit }];
    case 'maxLength': return ['too-long', { path, limit: p.limit }];
    case 'pattern': return ['bad-format', { path, format: formatName(p.pattern), value }];
    case 'minItems': return ['too-few-items', { path, limit: p.limit }];
    case 'uniqueItems': return ['duplicate-item', { path, value: p.duplicate }];
    default: return ['invalid-value', { path, keyword: p.keyword }];
  }
}

// ---------------------------------------------------------------------------
// Messages: the plain-language wording for every problem code (req 84).

const TYPE_WORDS = {
  integer: 'a whole number',
  number: 'a number',
  string: 'text in quotes',
  boolean: 'true or false',
  object: 'a group of fields in { }',
  array: 'a list in [ ]',
};

const FORMAT_WORDS = {
  color: 'a colour written like "#7a5230"',
  name: 'a name made only of letters, numbers, "-" and "_" (no spaces, folder, or ".json")',
  'image-path': 'an image path inside the data folder, like "images/sky.png"',
  'png-path': 'a PNG image path inside the data folder, like "sprites/player.png"',
  'key-code': 'a key code like "KeyA", "ArrowLeft", or "Space"',
  'legend-key': 'a single character other than "." or a space',
  other: 'in the expected form',
};

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

function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

function segmentLabel(segment, parentSegment) {
  if (typeof segment === 'number') return parentSegment === 'grid' ? `row ${segment + 1}` : `item ${segment + 1}`;
  return segment;
}

function pathText(path) {
  return path.map((seg, i) => segmentLabel(seg, path[i - 1])).join(' → ');
}

/** "in <parent>, " for a location's parent, or '' at the top of the file. */
function inPrefix(parentPath) {
  return parentPath.length ? `in ${pathText(parentPath)}, ` : '';
}

/** For a schema problem at `path`: the "in ..., " prefix and the quoted name of the last part. */
function subject(path) {
  if (path.length === 0) return { prefix: '', label: 'the file' };
  const parent = path.slice(0, -1);
  return { prefix: inPrefix(parent), label: `"${segmentLabel(path[path.length - 1], parent[parent.length - 1])}"` };
}

const at = ({ row, column }) => `row ${row}, column ${column}`;

function countMessage(what, how, { count, positions }) {
  return count === 0
    ? `the level has no ${what}. It needs exactly one: a grid character whose legend entry is ${how}.`
    : `the level has ${count} ${what}s (at ${positions.map(at).join('; ')}). It needs exactly one.`;
}

const MESSAGES = {
  // File-level
  'invalid-json': ({ line, column, detail }) =>
    `this file is not valid JSON${line ? ` near line ${line}, column ${column}` : ''}. Look for a missing or extra comma, quote mark, or bracket there. (Details: ${detail}.)`,
  'missing-file': () => 'this file is missing. The game cannot start without it.',
  'unrecognized-file': () => 'this is not a file the game uses, so it was not checked. Check its name and folder (see docs/data-formats.md).',

  // Structure (from the schemas)
  'missing-field': ({ path, field }) => `"${field}" is missing${path.length ? ` from ${pathText(path)}` : ''}.`,
  'unknown-field': ({ path, field, allowed }) =>
    `${inPrefix(path)}"${field}" is not a field that belongs here. Check its spelling. The fields allowed here are: ${allowed.map((f) => `"${f}"`).join(', ')}.`,
  'bad-key': ({ path, key, format }) => `${inPrefix(path)}"${key}" can't be used as a key: it must be ${FORMAT_WORDS[format]}.`,
  'wrong-type': ({ path, expected, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} should be ${TYPE_WORDS[expected]}, but it is ${describeValue(value)}.`;
  },
  'wrong-value': ({ path, expected, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must be ${show(expected)}, but it is ${show(value)}.`;
  },
  'wrong-format-version': ({ expected, value }) =>
    `"formatVersion" must be ${expected}, but it is ${show(value)}. This file may have been made for a different version of the game.`,
  'not-allowed': ({ path, allowed, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must be one of ${allowed.map(show).join(', ')}, but it is ${show(value)}.`;
  },
  'too-small': ({ path, limit, inclusive, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must be ${inclusive ? 'at least' : 'more than'} ${limit}, but it is ${value}.`;
  },
  'too-large': ({ path, limit, inclusive, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must be ${inclusive ? 'at most' : 'less than'} ${limit}, but it is ${value}.`;
  },
  'too-short': ({ path, limit }) => {
    const { prefix, label } = subject(path);
    return limit === 1
      ? `${prefix}${label} must not be empty.`
      : `${prefix}${label} must be at least ${plural(limit, 'character')} long.`;
  },
  'too-long': ({ path, limit }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must be at most ${plural(limit, 'character')} long.`;
  },
  'bad-format': ({ path, format, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} is ${show(value)}, which is not ${FORMAT_WORDS[format]}.`;
  },
  'too-few-items': ({ path, limit }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} must have at least ${plural(limit, 'entry', 'entries')}.`;
  },
  'duplicate-item': ({ path, value }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} lists ${show(value)} more than once.`;
  },
  'invalid-value': ({ path, keyword }) => {
    const { prefix, label } = subject(path);
    return `${prefix}${label} is not valid (${keyword}).`;
  },

  // Levels
  'row-length': ({ row, length, expected }) =>
    `row ${row} has ${length} tiles but row 1 has ${expected}. All rows must be the same length.`,
  'unknown-character': ({ character, row, column, count }) => {
    const more = count > 1 ? `, and ${plural(count - 1, 'more time')}` : '';
    return `the character "${character}" (at row ${row}, column ${column}${more}) is not in the legend. Add it to "legend", or replace it with "." for empty space.`;
  },
  'player-start-count': (d) => countMessage('player start', '"playerStart": true', d),
  'goal-count': (d) => countMessage('goal', '"goal": true', d),
  'legend-no-kind': ({ key }) => `legend "${key}" doesn't say what it is. Give it exactly one of: ${LEGEND_KINDS.join(', ')}.`,
  'legend-many-kinds': ({ key, kinds }) => `legend "${key}" has more than one of ${kinds.join(' and ')}. A legend entry must be exactly one thing.`,
  'legend-stray-color': ({ key }) =>
    `legend "${key}" has a "color" directly inside it, which only goals use. For a tile or reward, put "color" inside "tile" or "reward".`,
  'goal-without-color': ({ key }) => `legend "${key}" is a goal but has no "color". Add one, like "color": "#ff3030".`,
  'missing-enemy': ({ key, name }) => `legend "${key}" is the enemy "${name}", but there is no file data/characters/${name}.json.`,
  'enemy-is-player': ({ key, name }) => `legend "${key}" uses "${name}" as an enemy, but that character is the player.`,
  'missing-object': ({ key, name }) => `legend "${key}" is the object "${name}", but there is no file data/objects/${name}.json.`,
  'unused-legend': ({ key }) => `legend "${key}" is not used anywhere in the grid.`,
  'missing-cutscene': ({ name }) => `"cutscene" is "${name}", but there is no file data/cutscenes/${name}.json.`,
  'missing-layer-image': ({ layer, image }) => `background layer ${layer} uses the image "${image}", but there is no file data/${image}.`,

  // Level list
  'level-list-self': ({ item }) => `levels, item ${item}: "levels" is the level list itself, not a level.`,
  'missing-level': ({ item, name }) => `levels, item ${item} is "${name}", but there is no file data/levels/${name}.json.`,

  // Characters and objects
  'missing-sprite': ({ name }) => `"sprite" is "${name}", but there is no file data/sprites/${name}.json.`,
  'player-kind': ({ kind }) => `"kind" must be "player" in player.json, but it is "${kind}".`,
  'enemy-kind': ({ kind }) => `"kind" is "${kind}", but only data/characters/player.json can be the player. Use "enemy".`,
  'enemy-punch-damage': () => '"punchDamage" is only for the player. Remove it from this enemy.',

  // Cut scenes
  'missing-background-image': ({ image }) => `"background" is "${image}", but there is no file data/${image}.`,
  'missing-character': ({ actor, name }) => `actors, item ${actor}: "character" is "${name}", but there is no file data/characters/${name}.json.`,
  'keyframe-order': ({ actor, keyframe, time, previous }) =>
    `actors, item ${actor}, keyframe ${keyframe}: "time" is ${time}, but it must be later than the keyframe before it (${previous}). Keyframes must be in time order.`,
  'unknown-animation': ({ actor, animation, sprite }) =>
    `actors, item ${actor}: the animation "${animation}" is not in the sprite sheet "${sprite}", so "idle" will be shown instead.`,
  'narration-end': ({ line, start, end }) => `narration, item ${line}: "end" (${end}) must be later than "start" (${start}).`,
  'narration-order': ({ line, start, previous }) =>
    `narration, item ${line}: "start" is ${start}, which is earlier than the line before it (${previous}). Narration lines must be listed in time order.`,

  // Sprite sheets
  'missing-sprite-image': ({ image }) => `"image" is "${image}", but there is no file data/${image}.`,
  'frame-too-big': ({ frameWidth, frameHeight, imageWidth, imageHeight }) =>
    `each frame is ${frameWidth} × ${frameHeight} pixels, which is bigger than the whole image (${imageWidth} × ${imageHeight}).`,
  'frame-out-of-range': ({ animation, frame, frames }) =>
    `the animation "${animation}" uses frame ${frame}, but the image only has ${plural(frames, 'frame')} (numbered 0 to ${frames - 1}).`,
};

/** The plain-language message for a problem code and its details. */
export function describeProblem(code, details = {}) {
  const describe = MESSAGES[code];
  if (!describe) throw new Error(`No message for problem code "${code}"`);
  return describe(details);
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

function checkLevel({ path, value: level }, { names, images, error, warn }) {
  const { grid, legend } = level;

  // Row lengths
  const width = grid[0].length;
  grid.forEach((row, i) => {
    if (row.length !== width) error(path, 'row-length', { row: i + 1, length: row.length, expected: width });
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
        const seen = unknown.get(ch) ?? { character: ch, row: r + 1, column: c + 1, count: 0 };
        seen.count++;
        unknown.set(ch, seen);
        return;
      }
      used.add(ch);
      if (entry.playerStart) starts.push({ row: r + 1, column: c + 1 });
      if (entry.goal) goals.push({ row: r + 1, column: c + 1 });
    });
  });
  for (const details of unknown.values()) error(path, 'unknown-character', details);
  if (starts.length !== 1) error(path, 'player-start-count', { count: starts.length, positions: starts });
  if (goals.length !== 1) error(path, 'goal-count', { count: goals.length, positions: goals });

  // Legend entries
  for (const [key, entry] of Object.entries(legend)) {
    const kinds = LEGEND_KINDS.filter((k) => k in entry);
    if (kinds.length === 0) error(path, 'legend-no-kind', { key });
    else if (kinds.length > 1) error(path, 'legend-many-kinds', { key, kinds });
    if ('color' in entry && !('goal' in entry)) error(path, 'legend-stray-color', { key });
    if ('goal' in entry && !('color' in entry)) error(path, 'goal-without-color', { key });
    if ('enemy' in entry) {
      if (!names.character.has(entry.enemy)) error(path, 'missing-enemy', { key, name: entry.enemy });
      // A wrong "kind" in another character file is reported on that file, not on every level using it.
      else if (entry.enemy === 'player') error(path, 'enemy-is-player', { key, name: entry.enemy });
    }
    if ('object' in entry && !names.object.has(entry.object)) error(path, 'missing-object', { key, name: entry.object });
    if (!used.has(key)) warn(path, 'unused-legend', { key });
  }

  if (level.cutscene !== undefined && !names.cutscene.has(level.cutscene)) {
    error(path, 'missing-cutscene', { name: level.cutscene });
  }
  level.background.layers.forEach((layer, i) => {
    if (!(layer.image in images)) error(path, 'missing-layer-image', { layer: i + 1, image: layer.image });
  });
}

function checkLevelList({ path, value }, { names, error }) {
  value.levels.forEach((name, i) => {
    if (name === 'levels') error(path, 'level-list-self', { item: i + 1 });
    else if (!names.level.has(name)) error(path, 'missing-level', { item: i + 1, name });
  });
}

function checkSpriteReference(path, owner, names, error) {
  if (owner.sprite !== undefined && !names.sprite.has(owner.sprite)) error(path, 'missing-sprite', { name: owner.sprite });
}

function checkCharacter({ path, name, value }, { names, error }) {
  if (name === 'player' && value.kind !== 'player') error(path, 'player-kind', { kind: value.kind });
  if (name !== 'player' && value.kind !== 'enemy') error(path, 'enemy-kind', { kind: value.kind });
  if (value.kind === 'enemy' && 'punchDamage' in value) error(path, 'enemy-punch-damage');
  checkSpriteReference(path, value, names, error);
}

function checkObject({ path, value }, { names, error }) {
  checkSpriteReference(path, value, names, error);
}

function checkCutscene({ path, value }, { names, images, data, error, warn }) {
  if (!(value.background in images)) error(path, 'missing-background-image', { image: value.background });
  value.actors.forEach((actor, a) => {
    if (!names.character.has(actor.character)) error(path, 'missing-character', { actor: a + 1, name: actor.character });
    actor.keyframes.forEach((frame, k) => {
      const previous = actor.keyframes[k - 1];
      if (previous && frame.time <= previous.time) {
        error(path, 'keyframe-order', { actor: a + 1, keyframe: k + 1, time: frame.time, previous: previous.time });
      }
    });
    const spriteName = data.characters[actor.character]?.sprite;
    const sprite = data.sprites[spriteName];
    if (sprite) {
      for (const frame of actor.keyframes) {
        if (frame.animation && !(frame.animation in sprite.animations)) {
          warn(path, 'unknown-animation', { actor: a + 1, animation: frame.animation, sprite: spriteName });
        }
      }
    }
  });
  value.narration.forEach((line, n) => {
    if (line.end <= line.start) error(path, 'narration-end', { line: n + 1, start: line.start, end: line.end });
    const previous = value.narration[n - 1];
    if (previous && line.start < previous.start) {
      error(path, 'narration-order', { line: n + 1, start: line.start, previous: previous.start });
    }
  });
}

function checkSprite({ path, value }, { images, error }) {
  if (!(value.image in images)) {
    error(path, 'missing-sprite-image', { image: value.image });
    return;
  }
  const size = images[value.image];
  if (!size) return; // Size unknown; frames can't be checked.
  const total = Math.floor(size.width / value.frameWidth) * Math.floor(size.height / value.frameHeight);
  if (total === 0) {
    error(path, 'frame-too-big', {
      frameWidth: value.frameWidth, frameHeight: value.frameHeight, imageWidth: size.width, imageHeight: size.height,
    });
    return;
  }
  for (const [name, animation] of Object.entries(value.animations)) {
    for (const frame of animation.frames) {
      if (frame >= total) error(path, 'frame-out-of-range', { animation: name, frame, frames: total });
    }
  }
}
