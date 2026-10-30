import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { databasePath, openDatabase } from '../lib/database.mjs';

// Run with the old application stopped. The source is always read-only.
const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('用法：npm run db:migrate -- <旧 D1 SQLite 文件路径>');
  process.exit(1);
}
if (resolve(sourcePath) === databasePath()) {
  console.error('源数据库和目标数据库不能是同一个文件。');
  process.exit(1);
}

const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
try {
  const row = source.prepare('SELECT revision, payload FROM dayflow_state WHERE id = 1').get();
  if (!row) throw new Error('源数据库中没有可迁移的数据。');
  // Preserve the complete payload and revision; never overwrite existing data.
  const target = openDatabase(databasePath());
  try {
    const result = target.prepare(
      'INSERT INTO dayflow_state (id, revision, payload) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING',
    ).run(row.revision, row.payload);
    if (!result.changes) throw new Error('目标数据库已有数据，迁移已取消。');
    console.log('迁移完成，旧数据库保留不变。');
  } finally {
    target.close();
  }
} finally {
  source.close();
}
