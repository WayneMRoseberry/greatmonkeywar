// Throwaway: checks that branch protection blocks a pull request whose test fails (task 10.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('deliberately failing test', () => assert.equal(1, 2));
