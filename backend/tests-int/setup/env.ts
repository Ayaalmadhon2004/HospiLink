// Per test file, before any module is imported: point the app at the throwaway database.
import { requireThrowawayDb } from './guard';

process.env.DATABASE_URL = requireThrowawayDb();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'int-test-jwt-secret';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:5173';
process.env.TWO_FACTOR_ENC_KEY = process.env.TWO_FACTOR_ENC_KEY || Buffer.alloc(32, 7).toString('base64');
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
