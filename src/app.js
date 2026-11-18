import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asBuffer, driverName } from './db.js';
import {
  MAX_PASSPORT_BYTES,
  TITLES,
  deleteStudent,
  findByMatric,
  getStats,
  getStudentWithPassport,
  listStudents,
  passportFileName,
  saveStudent,
  validatePassport,
  validateStudent,
} from './students.js';
import { buildCsv, buildPassportArchive, buildXlsx } from './exports.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const privateDir = path.join(rootDir, 'private');

const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
const ADMIN_COOKIE = 'acu_registry';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PASSPORT_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new HttpError(400, 'Passport must be a JPG, PNG or WEBP image.'));
      return;
    }
    callback(null, true);
  },
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function publicStudent(student) {
  return {
    id: student.id,
    title: student.title,
    fullName: student.full_name,
    matricNumber: student.matric_number,
    hasPassport: Boolean(student.has_passport),
    passportFile: passportFileName(student.matric_number, student.passport_mime),
    passportUrl: `/api/students/${student.id}/passport?t=${passportToken(student.id)}`,
    createdAt: student.created_at,
    updatedAt: student.updated_at,
  };
}

function readCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const pair of header.split(';')) {
    const split = pair.indexOf('=');
    if (split === -1) continue;
    jar[pair.slice(0, split).trim()] = decodeURIComponent(pair.slice(split + 1).trim());
  }
  return jar;
}

function keyMatches(value) {
  if (!ADMIN_KEY || !value) return false;
  const given = Buffer.from(String(value));
  const expected = Buffer.from(ADMIN_KEY);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function isAdmin(req) {
  return (
    keyMatches(req.query.key) ||
    keyMatches(readCookies(req.headers.cookie)[ADMIN_COOKIE]) ||
    keyMatches(req.get('x-admin-key'))
  );
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) {
    next();
    return;
  }
  res.status(401).json({ ok: false, message: 'Open the register with your access link first.' });
}

function passportToken(id) {
  return crypto
    .createHmac('sha256', ADMIN_KEY || 'unconfigured')
    .update(`student:${id}`)
    .digest('base64url')
    .slice(0, 22);
}

function passportTokenMatches(id, token) {
  if (!token) return false;
  const given = Buffer.from(String(token));
  const expected = Buffer.from(passportToken(id));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function registryCookie(req) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function sendNotFound(res) {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.get('/api/config', (req, res) => {
    res.json({
      titles: TITLES,
      maxPassportBytes: MAX_PASSPORT_BYTES,
      database: driverName(),
    });
  });

  app.post('/api/students', upload.single('passport'), async (req, res) => {
    const validation = validateStudent(req.body || {});
    const errors = { ...validation.errors };

    const passportError = validatePassport(req.file);
    if (passportError) {
      errors.passport = passportError;
    } else if (!req.file && !errors.matricNumber) {
      const existing = await findByMatric(validation.value.matricNumber);
      if (!existing) {
        errors.passport = 'Attach your passport photograph.';
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ ok: false, errors });
      return;
    }

    const { student, created } = await saveStudent({ ...validation.value, file: req.file });
    res.status(created ? 201 : 200).json({
      ok: true,
      created,
      message: created
        ? 'Your details have been submitted.'
        : 'Your record already existed, so it has been updated.',
      student: publicStudent(student),
    });
  });

  app.get('/api/students', requireAdmin, async (req, res) => {
    const query = String(req.query.q || '').trim();
    const students = await listStudents({ query });
    res.json({ students: students.map(publicStudent) });
  });

  app.get('/api/students/:id/passport', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid student id.');

    if (!isAdmin(req) && !passportTokenMatches(id, req.query.t)) {
      throw new HttpError(401, 'Open the register with your access link first.');
    }

    const student = await getStudentWithPassport(id);
    const data = asBuffer(student?.passport_data);
    if (!student || !data) throw new HttpError(404, 'Passport not found.');

    const fileName = passportFileName(student.matric_number, student.passport_mime);
    const inline = req.query.inline === '1';

    res.set({
      'Content-Type': student.passport_mime || 'image/jpeg',
      'Content-Length': data.length,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
      'Cache-Control': inline ? 'private, max-age=300' : 'no-store',
    });
    res.send(data);
  });

  app.delete('/api/students/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid student id.');

    const removed = await deleteStudent(id);
    if (!removed) throw new HttpError(404, 'Student not found.');
    res.json({ ok: true });
  });

  app.get('/api/stats', requireAdmin, async (req, res) => {
    res.json(await getStats());
  });

  app.get('/api/export.csv', requireAdmin, async (req, res) => {
    const students = await listStudents({ limit: 100000 });
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ACU-PhD-students-${today()}.csv"`,
      'Cache-Control': 'no-store',
    });
    res.send(buildCsv(students));
  });

  app.get('/api/export.xlsx', requireAdmin, async (req, res) => {
    const students = await listStudents({ limit: 100000 });
    const workbook = await buildXlsx(students);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ACU-PhD-students-${today()}.xlsx"`,
      'Content-Length': workbook.length,
      'Cache-Control': 'no-store',
    });
    res.send(workbook);
  });

  app.get('/api/passports.zip', requireAdmin, async (req, res) => {
    const students = await listStudents({ limit: 100000 });
    const archive = buildPassportArchive(students, getStudentWithPassport);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="ACU-PhD-passports-${today()}.zip"`,
      'Cache-Control': 'no-store',
    });

    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') console.error('Archive warning:', error);
    });
    archive.on('error', (error) => {
      console.error('Archive failed:', error);
      res.destroy(error);
    });

    archive.pipe(res);
  });

  app.get('/registry', (req, res) => {
    if (!isAdmin(req)) {
      sendNotFound(res);
      return;
    }
    res.cookie(ADMIN_COOKIE, ADMIN_KEY, registryCookie(req));
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(privateDir, 'admin.html'));
  });

  app.get('/registry/app.js', (req, res) => {
    if (!isAdmin(req)) {
      sendNotFound(res);
      return;
    }
    res.type('application/javascript');
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(privateDir, 'admin.js'));
  });

  app.post('/registry/logout', (req, res) => {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.use(express.static(publicDir, { extensions: ['html'] }));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.status(404).sendFile(path.join(publicDir, '404.html'));
      return;
    }
    next();
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Passport image must be 4 MB or smaller.'
          : 'The upload could not be processed. Attach one passport image and try again.';
      res.status(400).json({ ok: false, errors: { passport: message } });
      return;
    }

    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);

    if (req.path.startsWith('/api/')) {
      res.status(status).json({ ok: false, message: error.message || 'Something went wrong.' });
      return;
    }

    res.status(status).sendFile(path.join(publicDir, status === 404 ? '404.html' : '500.html'));
  });

  return app;
}
