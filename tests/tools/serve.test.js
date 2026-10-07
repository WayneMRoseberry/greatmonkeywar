import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveRequestPath, contentTypeFor } from '../../tools/serve.js';

const root = path.resolve('/game');

test('serves index.html for the site root', () => {
  assert.equal(resolveRequestPath(root, '/'), path.join(root, 'index.html'));
});

test('serves files under src/ and data/', () => {
  assert.equal(resolveRequestPath(root, '/src/presentation/main.js'),
    path.join(root, 'src', 'presentation', 'main.js'));
  assert.equal(resolveRequestPath(root, '/data/levels/level1.json?x=1'),
    path.join(root, 'data', 'levels', 'level1.json'));
});

test('refuses files outside the allowed folders', () => {
  assert.equal(resolveRequestPath(root, '/package.json'), null);
  assert.equal(resolveRequestPath(root, '/node_modules/x/index.js'), null);
  assert.equal(resolveRequestPath(root, '/tools/serve.js'), null);
});

test('refuses path traversal, including encoded forms', () => {
  assert.equal(resolveRequestPath(root, '/src/../package.json'), null);
  assert.equal(resolveRequestPath(root, '/src/%2e%2e/package.json'), null);
  assert.equal(resolveRequestPath(root, '/data/..%2f..%2fsecret'), null);
});

test('refuses malformed URLs', () => {
  assert.equal(resolveRequestPath(root, '/src/%E0%A4%A'), null);
});

test('picks content types by extension', () => {
  assert.equal(contentTypeFor('a/b.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('a/b.JSON'), 'application/json; charset=utf-8');
  assert.equal(contentTypeFor('a/b.unknown'), 'application/octet-stream');
});
