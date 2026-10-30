import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function databasePath() {
  return resolve(process.env.DAYFLOW_DB_PATH || '.dayflow-data/dayflow.sqlite');
}

/** @param {string} filename */
export function openDatabase(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    // DELETE mode leaves one persistent file once transactions finish.
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE;');
    db.exec(readFileSync(resolve('migrations/0001_dayflow.sql'), 'utf8'));
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/** @type {DatabaseSync | undefined} */
let connection;

export function database() {
  connection ??= openDatabase(databasePath());
  return connection;
}
