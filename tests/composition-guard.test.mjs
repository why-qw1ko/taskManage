import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { shouldBlockImeEnter } from '../hooks/use-composition-guard.ts';

test('Enter is blocked during composition and for 500ms afterwards', () => {
  assert.equal(shouldBlockImeEnter('Enter', true, 13, -Infinity, 1000), true);
  assert.equal(shouldBlockImeEnter('Enter', false, 229, -Infinity, 1000), true);
  assert.equal(shouldBlockImeEnter('Enter', false, 13, 1000, 1499), true);
  assert.equal(shouldBlockImeEnter('Enter', false, 13, 1000, 1500), false);
  assert.equal(shouldBlockImeEnter('a', true, 229, 1000, 1001), false);
});
