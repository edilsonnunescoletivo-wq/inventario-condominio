import { Pool } from 'pg';
import { DATABASE_URL, assertConfig } from './config';

assertConfig();
const globalForDb = globalThis;
export const pool = globalForDb.__condoPool || new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});
if (process.env.NODE_ENV !== 'production') globalForDb.__condoPool = pool;

export async function query(text, params = []) {
  return pool.query(text, params);
}
