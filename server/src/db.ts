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
});

export async function query<T = unknown>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = []
): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}
