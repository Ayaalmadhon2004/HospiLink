// backend/src/config/jwt.ts
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

export const JWT_SECRET: string = process.env.JWT_SECRET;
// Without "remember me": 24h JWT in a session cookie (dropped when the browser closes).
// With it: 7-day JWT and a persistent cookie of the same length, so the cookie never outlives the token.
export const SESSION_TTL = {
  default: { jwt: '24h', cookieMs: undefined },
  remember: { jwt: '7d', cookieMs: 7 * 24 * 60 * 60 * 1000 },
} as const;