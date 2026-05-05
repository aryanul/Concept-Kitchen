import './env';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './db';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB
  `);
}

async function getApplied(): Promise<Set<string>> {
  const [rows] = await pool.query('SELECT name FROM migrations');
  return new Set((rows as { name: string }[]).map((r) => r.name));
}

function splitSql(sql: string): string[] {
  // Strip line comments (`-- ...` to end of line), then split on `;`.
  // Naive: doesn't handle `--` inside string literals — fine for our DDL files.
  const stripped = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main(): Promise<void> {
  await ensureTable();
  const applied = await getApplied();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const statements = splitSql(sql);
    console.log(`[migrate] applying ${file} (${statements.length} statement${statements.length === 1 ? '' : 's'})`);
    const conn = await pool.getConnection();
    try {
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`[migrate] ok ${file}`);
      appliedCount++;
    } catch (err) {
      console.error(`[migrate] FAILED ${file}`);
      throw err;
    } finally {
      conn.release();
    }
  }

  if (appliedCount === 0) console.log('[migrate] nothing to do');
  else console.log(`[migrate] done — applied ${appliedCount} migration(s)`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
