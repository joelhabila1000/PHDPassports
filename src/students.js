import { all, get, run } from './db.js';

export const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.'];

export const MAX_PASSPORT_BYTES = 4 * 1024 * 1024;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MATRIC_PATTERN = /^[A-Z0-9][A-Z0-9/\-]{2,24}$/;

const LIST_COLUMNS = `id, matric_number, title, full_name, passport_mime, passport_size, created_at, updated_at,
  CASE WHEN passport_data IS NULL THEN 0 ELSE 1 END AS has_passport`;

export function passportFileName(matricNumber, mimeType) {
  const safe = String(matricNumber)
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const ext = EXTENSIONS[mimeType] || 'jpg';
  return `${safe || 'passport'}.${ext}`;
}

export function validateStudent({ title, fullName, matricNumber }) {
  const errors = {};
  const cleanTitle = String(title || '').trim();
  const cleanName = String(fullName || '').trim().replace(/\s+/g, ' ');
  const cleanMatric = String(matricNumber || '').trim().toUpperCase();

  if (!cleanTitle) {
    errors.title = 'Select a title.';
  } else if (!TITLES.includes(cleanTitle)) {
    errors.title = 'Select one of the listed titles.';
  }

  if (cleanName.length < 3) {
    errors.fullName = 'Enter your full name as it appears on your admission letter.';
  } else if (cleanName.length > 120) {
    errors.fullName = 'Full name must be 120 characters or fewer.';
  } else if (!/[A-Za-z]/.test(cleanName)) {
    errors.fullName = 'Full name must contain letters.';
  }

  if (!cleanMatric) {
    errors.matricNumber = 'Enter your matric number.';
  } else if (!MATRIC_PATTERN.test(cleanMatric)) {
    errors.matricNumber = 'Use letters, numbers, "/" or "-" only (4 to 25 characters).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { title: cleanTitle, fullName: cleanName, matricNumber: cleanMatric },
  };
}

export function validatePassport(file) {
  if (!file) return null;
  if (!EXTENSIONS[file.mimetype]) return 'Passport must be a JPG, PNG or WEBP image.';
  if (file.size > MAX_PASSPORT_BYTES) return 'Passport image must be 4 MB or smaller.';
  return null;
}

export async function findByMatric(matricNumber) {
  return get(
    `SELECT ${LIST_COLUMNS} FROM students WHERE matric_number = $1`,
    [matricNumber],
  );
}

export async function saveStudent({ title, fullName, matricNumber, file }) {
  const now = new Date().toISOString();
  const existing = await findByMatric(matricNumber);

  await run(
    `INSERT INTO students
       (matric_number, title, full_name, passport_data, passport_mime, passport_size, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (matric_number) DO UPDATE SET
       title = excluded.title,
       full_name = excluded.full_name,
       passport_data = COALESCE(excluded.passport_data, students.passport_data),
       passport_mime = COALESCE(excluded.passport_mime, students.passport_mime),
       passport_size = COALESCE(excluded.passport_size, students.passport_size),
       updated_at = excluded.updated_at`,
    [
      matricNumber,
      title,
      fullName,
      file ? file.buffer : null,
      file ? file.mimetype : null,
      file ? file.size : null,
      now,
      now,
    ],
  );

  const student = await findByMatric(matricNumber);
  return { student, created: !existing };
}

export async function listStudents({ query = '', limit = 500 } = {}) {
  const sql = [`SELECT ${LIST_COLUMNS} FROM students`];
  const params = [];

  if (query) {
    sql.push('WHERE LOWER(full_name) LIKE $1 OR LOWER(matric_number) LIKE $1');
    params.push(`%${query.toLowerCase()}%`);
  }

  sql.push('ORDER BY full_name ASC LIMIT $' + (params.length + 1));
  params.push(limit);

  return all(sql.join(' '), params);
}

export async function getStudentWithPassport(id) {
  return get('SELECT * FROM students WHERE id = $1', [id]);
}

export async function getStats() {
  const row = await get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN passport_data IS NULL THEN 0 ELSE 1 END) AS photos,
            MAX(created_at) AS latest
     FROM students`,
  );
  return {
    total: Number(row?.total || 0),
    photos: Number(row?.photos || 0),
    latest: row?.latest || null,
  };
}

export async function deleteStudent(id) {
  const result = await run('DELETE FROM students WHERE id = $1', [id]);
  return result.changes > 0;
}
