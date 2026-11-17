import { init } from '../src/db.js';
import { createApp } from '../src/app.js';

let booted = null;

export default async function handler(req, res) {
  if (!booted) booted = init();
  try {
    await booted;
  } catch (error) {
    booted = null;
    console.error('Database connection failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, message: 'Database unavailable. Try again shortly.' }));
    return;
  }

  return createApp()(req, res);
}
