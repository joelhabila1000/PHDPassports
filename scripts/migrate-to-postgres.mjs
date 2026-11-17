import 'dotenv/config';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const connectionString = (process.env.DATABASE_URL || '').trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Nothing to migrate into.');
  process.exit(1);
}

const file = path.resolve(process.env.DATA_DIR || 'data', 'portal.db');
const sqlite = new DatabaseSync(file);
const rows = sqlite.prepare('SELECT * FROM students').all();
sqlite.close();

if (rows.length === 0) {
  console.log(`No rows in ${file}. Nothing to migrate.`);
  process.exit(0);
}

const local = /localhost|127\.0\.0\.1/.test(connectionString);
const pool = new pg.Pool({
  connectionString,
  ssl: local ? undefined : { rejectUnauthorized: false },
  max: 1,
});

let copied = 0;

for (const row of rows) {
  const result = await pool.query(
    `INSERT INTO students
       (matric_number, title, full_name, passport_data, passport_mime, passport_size, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (matric_number) DO NOTHING`,
    [
      row.matric_number,
      row.title,
      row.full_name,
      row.passport_data ? Buffer.from(row.passport_data) : null,
      row.passport_mime,
      row.passport_size,
      row.created_at,
      row.updated_at,
    ],
  );
  copied += result.rowCount;
  console.log(`${result.rowCount ? 'copied ' : 'skipped'} ${row.matric_number}`);
}

await pool.end();
console.log(`${copied} of ${rows.length} records copied to PostgreSQL.`);
