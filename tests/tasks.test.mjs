import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seed,
  validateData,
  mergeData,
  newTask,
  setStatus,
  dateKey,
  offsetDate,
  uid,
} from '../lib/tasks.ts';

test('UUID generation and task initialization work without crypto.randomUUID on HTTP', () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const ids = Array.from({ length: 100 }, () => uid());
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    assert.equal(newTask('HTTP task').title, 'HTTP task');
    const data = seed();
    assert.deepEqual(validateData(data), data);
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'randomUUID', descriptor);
    else delete crypto.randomUUID;
  }
});

test('backup round trip preserves tasks and subtasks', () => {
  const original = seed();
  assert.deepEqual(
    validateData(JSON.parse(JSON.stringify(original))),
    original,
  );
});
test('reject malformed, duplicate and impossible-date backups atomically', () => {
  for (const mutate of [
    (d) => d.tasks.push(d.tasks[0]),
    (d) => (d.tasks[0].date = '2026-02-30'),
    (d) => (d.tasks[0].status = 'unknown'),
    (d) => (d.tasks[0].subtasks = [{ id: 'x', title: 'x', done: 'yes' }]),
    (d) => (d.lists = ['工作']),
    (d) => (d.tasks[0].title = ' '),
  ]) {
    const d = seed();
    mutate(d);
    assert.throws(() => validateData(d));
  }
});
test('merging preserves current edits and imports only new IDs', () => {
  const current = seed();
  const imported = structuredClone(current);
  imported.tasks[0].title = 'Old edited version';
  imported.lists.push('旅行');
  imported.tasks.push(newTask('订酒店', '旅行'));
  const merged = mergeData(current, imported);
  assert.equal(merged.tasks.length, current.tasks.length + 1);
  assert.equal(merged.tasks[0].title, current.tasks[0].title);
  assert.ok(merged.lists.includes('旅行'));
  assert.deepEqual(mergeData(merged, imported), merged);
});
test('completion records time and reopening clears it', () => {
  const done = setStatus(newTask('test'), 'done');
  assert.ok(done.completed);
  assert.equal(setStatus(done, 'doing').completed, '');
  assert.equal(setStatus(done, 'done').completed, done.completed);
});
test('dates stay local and cross month/year boundaries', () => {
  assert.equal(dateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  assert.equal(offsetDate(1, new Date(2026, 11, 31, 12)), '2027-01-01');
  assert.equal(offsetDate(-1, new Date(2026, 2, 1, 12)), '2026-02-28');
});
test('HTML-like user input stays literal data and unknown properties are stripped', () => {
  const d = seed();
  d.tasks[0].title = '<img src=x onerror=alert(1)>';
  d.tasks[0].extra = 'untrusted';
  const valid = validateData(d);
  assert.equal(valid.tasks[0].title, d.tasks[0].title);
  assert.equal(valid.tasks[0].extra, undefined);
});
