import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const connectionString = (process.env.DATABASE_URL || '').trim();
const usePostgres = connectionString.length > 0;
const serverless = Boolean(process.env.VERCEL);

const dataDir = path.resolve(process.env.DATA_DIR || 'data');

let sqlite = null;
let pool = null;
let ready = null;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matric_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  full_name TEXT NOT NULL,
  passport_data BLOB,
  passport_mime TEXT,
  passport_size INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS students_full_name_idx ON students (full_name);
`;

const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  matric_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  full_name TEXT NOT NULL,
  passport_data BYTEA,
  passport_mime TEXT,
  passport_size INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS students_full_name_idx ON students (full_name);
`;

export async function init() {
  if (ready) return ready;
  ready = connect().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function connect() {
  if (usePostgres) {
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new pg.Pool({
      connectionString,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: serverless ? 1 : 5,
      idleTimeoutMillis: serverless ? 1000 : 10000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: serverless,
    });
    await pool.query(POSTGRES_SCHEMA);
    return;
  }

  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(dataDir, { recursive: true });
  sqlite = new DatabaseSync(path.join(dataDir, 'portal.db'));
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec(SQLITE_SCHEMA);
}

export function driverName() {
  return usePostgres ? 'PostgreSQL' : 'SQLite';
}

function toSql(sql) {
  return sql.replace(/\$(\d+)/g, (_, n) => `?${n}`);
}

export async function all(sql, params = []) {
  if (usePostgres) {
    const result = await pool.query(sql, params);
    return result.rows;
  }
  const statement = sqlite.prepare(toSql(sql));
  return statement.all(...params);
}

export async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  if (usePostgres) {
    const result = await pool.query(sql, params);
    return { changes: result.rowCount };
  }
  const result = sqlite.prepare(toSql(sql)).run(...params);
  return { changes: Number(result.changes) };
}

export function asBuffer(value) {
  if (!value) return null;
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}
