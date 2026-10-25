import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger';
import { webVitalSchema, WebVitalReport } from '../validators/webVitals.validator';

// POST /api/telemetry/web-vitals
// Unauthenticated by nature (navigator.sendBeacon cannot carry credentials), so it is locked down:
// tiny body, its own per-IP limit, strict schema, no PII stored, always 204 or a small error.
// Mounted BEFORE the global express.json() so the tiny limit is the one that applies.
const MAX_BODY = '1kb';
const WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 60;
const MAX_BUCKETS = 500; // name|path|rating combinations kept in memory

export const webVitalsLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.VITALS_REPORT_RATE_LIMIT_MAX) || DEFAULT_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  },
});

// Tiny in-memory aggregate (count / sum / max per metric+route+rating), exposed only through logs.
interface Bucket { count: number; sum: number; max: number }
const buckets = new Map<string, Bucket>();

export const recordVital = (report: WebVitalReport): void => {
  const key = `${report.name}|${report.path}|${report.rating}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) return; // bounded memory, extra combinations are only logged
    bucket = { count: 0, sum: 0, max: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  bucket.sum += report.value;
  bucket.max = Math.max(bucket.max, report.value);
};

export const getVitalsAggregate = (): Record<string, Bucket> => Object.fromEntries(buckets);
export const resetVitalsAggregate = (): void => buckets.clear();

const router = Router();

// Accept text/plain (sendBeacon default, a CORS "simple" request without preflight) and application/json.
const bodyParser = express.text({ type: ['text/plain', 'application/json'], limit: MAX_BODY });

router.post('/', webVitalsLimiter, bodyParser, (req: Request, res: Response) => {
  let parsed: unknown;
  try {
    parsed = typeof req.body === 'string' ? JSON.parse(req.body) : undefined;
  } catch {
    parsed = undefined;
  }
  const result = webVitalSchema.safeParse(parsed);
  if (!result.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid web vital payload' } });
    return;
  }
  try {
    recordVital(result.data);
    // No IP, user agent, cookies or headers are logged.
    logger.info({ webVital: result.data }, 'web-vital');
  } catch {
    // Telemetry must never crash the API.
  }
  res.status(204).end();
});

// Oversized / malformed bodies end here instead of the generic handler (which would log a stack for telemetry).
router.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status === 413 ? 413 : 400;
  res.status(status).json({
    success: false,
    error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR', message: 'Invalid web vital payload' },
  });
});

export default router;
