import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { database, openDatabase } from '../lib/database.mjs';
import { seed } from '../lib/tasks.ts';
import { GET, PUT } from '../app/api/data/route.ts';

const testRoot = resolve('work');
mkdirSync(testRoot, { recursive: true });
const directory = mkdtempSync(join(testRoot, 'db-tests-'));
process.env.DAYFLOW_DB_PATH = join(directory, 'api.sqlite');
after(() => {
  database().close();
  assert.equal(dirname(directory), testRoot);
  rmSync(directory, { recursive: true, force: true });
});

function request(body, headers = {}, url = 'http://localhost:3000/api/data') {
  return new Request(url, {
    method: 'PUT',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('API persists data and rejects stale revisions without overwriting newer edits', async () => {
  const empty = await GET(new Request('http://localhost:3000/api/data'));
  assert.equal(empty.status, 200);
  assert.equal(empty.headers.get('cache-control'), 'no-store');
  assert.equal(await empty.json(), null);
  const data = seed();
  assert.equal((await PUT(request({ revision: null, data }))).status, 200);
  assert.equal((await PUT(request({ revision: null, data }))).status, 409);
  data.tasks[0].title = "持久化测试 ' 中文";
  const attempts = await Promise.all([
    PUT(request({ revision: 1, data })),
    PUT(request({ revision: 1, data: seed() })),
  ]);
  assert.deepEqual(attempts.map((response) => response.status), [200, 409]);
  const saved = await (await GET(new Request('http://localhost:3000/api/data'))).json();
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.tasks[0].title, data.tasks[0].title);

  const reopened = openDatabase(process.env.DAYFLOW_DB_PATH);
  try {
    const row = reopened.prepare('SELECT revision, payload FROM dayflow_state WHERE id = 1').get();
    assert.equal(row.revision, 2);
    assert.deepEqual(JSON.parse(row.payload), data);
  } finally {
    reopened.close();
  }
  assert.deepEqual(readdirSync(directory), ['api.sqlite']);
});

test('API keeps local access, origin, body size and data validation protections', async () => {
  assert.equal((await GET(new Request('http://example.com/api/data'))).status, 403);
  assert.equal((await PUT(request({ revision: 2, data: seed() }, { origin: 'https://example.com' }))).status, 403);
  assert.equal((await PUT(request({}, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await PUT(request({ revision: -1, data: seed() }))).status, 400);
  assert.equal((await PUT(request({ revision: 2, data: {} }))).status, 400);
  assert.equal((await PUT(request('x'.repeat(5 * 1024 * 1024)))).status, 413);
  const invalidJSON = new Request('http://localhost:3000/api/data', {
    method: 'PUT', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{',
  });
  assert.equal((await PUT(invalidJSON)).status, 400);
});

test('migration reads WAL data, preserves revision and refuses to replace existing data', () => {
  const sourcePath = join(directory, 'legacy.sqlite');
  const targetPath = join(directory, 'migrated.sqlite');
  const source = openDatabase(sourcePath);
  try {
    source.exec('PRAGMA journal_mode = WAL;');
    const payload = JSON.stringify(seed());
    source.prepare('INSERT INTO dayflow_state VALUES (1, 7, ?)').run(payload);
    const migrate = () => spawnSync(process.execPath, [
      '--experimental-sqlite', 'scripts/migrate-local-db.mjs', sourcePath,
    ], { encoding: 'utf8', env: { ...process.env, DAYFLOW_DB_PATH: targetPath } });
    const first = migrate();
    assert.equal(first.status, 0, first.stderr);
    const second = migrate();
    assert.equal(second.status, 1);
    assert.match(second.stderr, /目标数据库已有数据/);
    const target = openDatabase(targetPath);
    try {
      const row = target.prepare('SELECT revision, payload FROM dayflow_state WHERE id = 1').get();
      assert.equal(row.revision, 7);
      assert.equal(row.payload, payload);
      assert.deepEqual(row, source.prepare('SELECT revision, payload FROM dayflow_state WHERE id = 1').get());
    } finally {
      target.close();
    }
  } finally {
    source.close();
  }
});
