import { Pool } from 'pg';
import { DATABASE_URL, assertConfig } from './config';

assertConfig();
const globalForDb = globalThis;

function secureConnectionString(value) {
  const url = new URL(value);
  // O driver recebe a política TLS explicitamente abaixo. Remover sslmode da URL
  // evita semântica ambígua entre versões do pg/libpq e mantém verificação total.
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');
  return url.toString();
}

export const pool = globalForDb.__condoPool || new Pool({
  connectionString: secureConnectionString(DATABASE_URL),
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: true },
});
if (process.env.NODE_ENV !== 'production') globalForDb.__condoPool = pool;

export async function query(text, params = []) {
  return pool.query(text, params);
}
