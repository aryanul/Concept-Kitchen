import './env';
import mysql, { type PoolOptions, type RowDataPacket } from 'mysql2/promise';

function buildConfig(): PoolOptions {
  const ssl =
    process.env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2' as const, rejectUnauthorized: true }
      : undefined;
  if (process.env.DATABASE_URL) {
    return { uri: process.env.DATABASE_URL, ssl };
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
  };
}

export const pool = mysql.createPool({
  ...buildConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // TiDB (serverless) drops idle connections; keepalive pings hold them open.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
});

// Don't let a fatal error on an idle pooled connection crash the process.
pool.on('connection', (conn) => {
  conn.on('error', (err) => {
    console.error('[db] pool connection error (will be recycled):', err.code ?? err);
  });
});

// Transient errors that mean "the connection died" — safe to retry on a fresh one.
const RETRYABLE = new Set([
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'EPIPE',
  'ETIMEDOUT',
]);

export async function query<T = unknown>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = []
): Promise<T[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && RETRYABLE.has(code)) {
      // The pool has already discarded the dead connection; retry once on a fresh one.
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows as unknown as T[];
    }
    throw err;
  }
}
