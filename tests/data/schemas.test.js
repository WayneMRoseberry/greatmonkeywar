// Checks the JSON Schemas in src/data/schemas/:
//  - each is a valid JSON Schema (using Ajv, a test-only dependency);
//  - each uses only the keywords the game's own schema checker supports;
//  - every example in docs/data-formats.md passes its schema, so the docs and
//    schemas can't drift apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMA_DIR = path.resolve('src/data/schemas');
const DOC = path.resolve('docs/data-formats.md');

const SCHEMA_NAMES = [
  'level', 'level-list', 'character', 'object', 'cutscene',
  'sprite', 'tuning', 'bindings', 'display',
];

// Must match the list in docs/data-formats.md ("Schemas and the validator").
const ALLOWED_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description', 'type', 'properties',
  'required', 'additionalProperties', 'propertyNames', 'items', 'minItems', 'uniqueItems',
  'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern', 'default',
]);

// Doc headings whose ```json examples belong to each schema.
const DOC_SECTIONS = {
  '## Level format': 'level',
  '## Level list format': 'level-list',
  '## Character definition format': 'character',
  '## Object definition format': 'object',
  '## Cut scene format': 'cutscene',
  '## Sprite sheet format': 'sprite',
  '### Tuning': 'tuning',
  '### Bindings': 'bindings',
  '### Display': 'display',
};

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
}

// Yields every keyword used anywhere in a schema, with its location.
function* keywordsIn(schema, where = '') {
  if (typeof schema !== 'object' || schema === null) return;
  for (const [key, value] of Object.entries(schema)) {
    yield { key, where: `${where}/${key}`, value };
    if (key === 'properties' || key === '$defs') {
      for (const [name, sub] of Object.entries(value)) yield* keywordsIn(sub, `${where}/${key}/${name}`);
    } else if (['items', 'additionalProperties', 'propertyNames'].includes(key)) {
      yield* keywordsIn(value, `${where}/${key}`);
    }
  }
}

function docExamples() {
  const examples = [];
  let section = null;
  const lines = fs.readFileSync(DOC, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) section = DOC_SECTIONS[line.trim()] ?? (line.startsWith('### ') ? section : null);
    if (line.trim() === '```json' && section) {
      const end = lines.indexOf('```', i + 1);
      examples.push({ schema: section, line: i + 1, json: lines.slice(i + 1, end).join('\n') });
      i = end;
    }
  }
  return examples;
}

test('the schema folder contains exactly the expected schemas', () => {
  const files = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.schema.json')).sort();
  assert.deepEqual(files, SCHEMA_NAMES.map((n) => `${n}.schema.json`).sort());
});

for (const name of SCHEMA_NAMES) {
  test(`${name} schema is valid JSON Schema`, () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    assert.doesNotThrow(() => ajv.compile(loadSchema(name)));
  });

  test(`${name} schema uses only supported keywords`, () => {
    for (const { key, where, value } of keywordsIn(loadSchema(name))) {
      assert.ok(ALLOWED_KEYWORDS.has(key), `unsupported keyword "${key}" at ${where}`);
      if (key === '$ref') assert.match(value, /^#\/\$defs\/[A-Za-z0-9_-]+$/, `$ref must point to #/$defs/... at ${where}`);
    }
  });

  test(`${name} schema rejects unknown top-level fields and wrong versions`, () => {
    const schema = loadSchema(name);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.formatVersion, { const: 1 });
    assert.ok(schema.required.includes('formatVersion'));
  });
}

test('every format in docs/data-formats.md has at least one example', () => {
  const covered = new Set(docExamples().map((e) => e.schema));
  assert.deepEqual([...covered].sort(), [...SCHEMA_NAMES].sort());
});

// Complete data-file examples in the designer and artist guides: any ```json
// block containing "formatVersion". Its format is worked out from its fields.
function guideExamples() {
  const guides = ['guide-levels.md', 'guide-characters-objects.md', 'guide-cutscenes.md', 'guide-sprites.md'];
  const kindOf = (v) =>
    'grid' in v ? 'level' : 'levels' in v ? 'level-list' : 'kind' in v ? 'character'
      : 'stage' in v ? 'cutscene' : 'frameWidth' in v ? 'sprite' : 'object';
  return guides.flatMap((guide) => {
    const lines = fs.readFileSync(path.resolve('docs', guide), 'utf8').split(/\r?\n/);
    const found = [];
    lines.forEach((line, i) => {
      if (line.trim() !== '```json') return;
      const end = lines.findIndex((l, j) => j > i && l.trim() === '```');
      const json = lines.slice(i + 1, end).join('\n');
      if (json.includes('"formatVersion"')) found.push({ guide, line: i + 1, json });
    });
    return found.map((e) => ({ ...e, schema: kindOf(JSON.parse(e.json)) }));
  });
}

for (const example of guideExamples()) {
  test(`${example.guide} example at line ${example.line} passes the ${example.schema} schema`, () => {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(loadSchema(example.schema));
    assert.ok(validate(JSON.parse(example.json)), JSON.stringify(validate.errors, null, 2));
  });
}

for (const example of docExamples()) {
  test(`docs example at data-formats.md line ${example.line} passes the ${example.schema} schema`, () => {
    const ajv = new Ajv2020({ allErrors: true });
    const validate = ajv.compile(loadSchema(example.schema));
    const ok = validate(JSON.parse(example.json));
    assert.ok(ok, JSON.stringify(validate.errors, null, 2));
  });
}
