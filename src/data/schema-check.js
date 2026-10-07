// A small JSON Schema checker supporting only the keywords listed in
// docs/data-formats.md ("Schemas and the validator"). It exists because the
// game validates data in the browser, where npm packages such as Ajv can't be
// loaded without a build step.
//
// checkSchema(schema, value) returns a list of problems, each:
//   { path: ['background', 'layers', 1, 'scrollFactor'], keyword, ...details }
// Turning problems into plain-language messages is done by validate.js.

export function checkSchema(rootSchema, value) {
  const problems = [];
  check(rootSchema, value, [], rootSchema, problems);
  return problems;
}

function resolveRef(rootSchema, ref) {
  const name = ref.replace(/^#\/\$defs\//, '');
  const target = rootSchema.$defs?.[name];
  if (!target) throw new Error(`Schema error: unknown $ref "${ref}"`);
  return { schema: target, defName: name };
}

export function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value; // 'string' | 'boolean' | 'object'
}

function matchesType(expected, value) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function check(schema, value, path, rootSchema, problems, defName) {
  if (schema.$ref) {
    const resolved = resolveRef(rootSchema, schema.$ref);
    check(resolved.schema, value, path, rootSchema, problems, resolved.defName);
  }

  const before = problems.length;
  const add = (keyword, details = {}) => problems.push({ path, keyword, value, defName, ...details });

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    add('type', { expected: schema.type });
    return; // Other checks would only repeat the same mistake.
  }
  if ('const' in schema && value !== schema.const) add('const', { expected: schema.const });
  if (schema.enum && !schema.enum.includes(value)) add('enum', { allowed: schema.enum });

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) add('minimum', { limit: schema.minimum });
    if (schema.maximum !== undefined && value > schema.maximum) add('maximum', { limit: schema.maximum });
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) add('exclusiveMinimum', { limit: schema.exclusiveMinimum });
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) add('exclusiveMaximum', { limit: schema.exclusiveMaximum });
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) add('minLength', { limit: schema.minLength });
    if (schema.maxLength !== undefined && value.length > schema.maxLength) add('maxLength', { limit: schema.maxLength });
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) add('pattern', { pattern: schema.pattern });
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) add('minItems', { limit: schema.minItems });
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) add('uniqueItems', { duplicate: item });
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, i) => check(schema.items, item, [...path, i], rootSchema, problems));
    }
  }

  if (typeOf(value) === 'object') {
    for (const field of schema.required ?? []) {
      if (!(field in value)) add('required', { field });
    }
    const known = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (schema.propertyNames) {
        const nameProblems = checkSchema({ ...schema.propertyNames, $defs: rootSchema.$defs }, key);
        if (nameProblems.length > 0) add('propertyNames', { key, pattern: schema.propertyNames.pattern });
      }
      if (key in known) {
        check(known[key], child, [...path, key], rootSchema, problems);
      } else if (schema.additionalProperties === false) {
        problems.push({ path: [...path, key], keyword: 'additionalProperties', value: child, allowed: Object.keys(known) });
      } else if (typeof schema.additionalProperties === 'object') {
        check(schema.additionalProperties, child, [...path, key], rootSchema, problems);
      }
    }
  }

  return problems.length === before;
}
