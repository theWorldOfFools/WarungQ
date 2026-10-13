/* Runner migrasi SQL murni: baca db/migrations/*.sql berurutan.
 * Mendukung dijalankan dari container (./db) maupun lokal (../..db).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

function findMigrationsDir() {
  const candidates = [
    path.join(__dirname, '../../db/migrations'), // lokal: backend/db? tidak
    path.join('/app/db/migrations'),            // docker: ./db di-mount ke /app/db
    path.join(__dirname, '../../../db/migrations'),
    path.join(process.cwd(), 'db/migrations'),
    path.join(process.cwd(), '../db/migrations'),
  ];
  // root repo saat dijalankan dari backend/: backend/../db/migrations
  candidates.unshift(path.join(__dirname, '../../..', 'WarungQ', 'db', 'migrations'));
  const fromBackend = path.resolve(__dirname, '../../db/migrations');
  candidates.unshift(fromBackend);
  // paling andal: relatif terhadap backend root
  const backendRoot = path.resolve(__dirname, '../..');
  candidates.unshift(path.join(backendRoot, '..', 'db', 'migrations')); // /app/../db saat mount? fallback
  candidates.unshift(path.join('/app/db/migrations'));

  for (const d of candidates) {
    if (fs.existsSync(d)) return d;
  }
  // default: cari naik sampai ketemu folder db
  let cur = backendRoot;
  for (let i = 0; i < 4; i++) {
    const d = path.join(cur, 'db', 'migrations');
    if (fs.existsSync(d)) return d;
    cur = path.dirname(cur);
  }
  // terakhir: ./db dari repo root (saat npm run migrate di backend, cwd=backend)
  const local = path.resolve(process.cwd(), '../db/migrations');
  if (fs.existsSync(local)) return local;
  return path.resolve(process.cwd(), 'db/migrations');
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nama VARCHAR(255) PRIMARY KEY,
      dijalankan_pada TIMESTAMPTZ DEFAULT NOW()
    )`);
}

async function up() {
  const dir = findMigrationsDir();
  if (!fs.existsSync(dir)) {
    console.error('[migrate] folder tidak ketemu:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  await ensureTable();
  const { rows } = await pool.query('SELECT nama FROM _migrations');
  const done = new Set(rows.map((r) => r.nama));
  for (const f of files) {
    if (done.has(f)) {
      console.log('[migrate] lewati', f);
      continue;
    }
    console.log('[migrate] jalankan', f);
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations(nama) VALUES($1)', [f]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error('[migrate] GAGAL', f, e.message);
      process.exitCode = 1;
      break;
    }
  }
  await pool.end();
}

if (require.main === module) {
  up().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { up };
