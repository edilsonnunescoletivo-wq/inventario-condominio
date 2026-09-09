export const DATABASE_URL = process.env.DATABASE_URL;
export const JWT_SECRET = process.env.JWT_SECRET;

export function assertConfig() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');
}
