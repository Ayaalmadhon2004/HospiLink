import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { runReminders } from '../services/reminders.service';

const router = Router();

// Constant-time comparison (hash both sides so lengths are equal).
export const secretMatches = (provided: string, expected: string): boolean => {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

// POST /api/internal/run-reminders  (header: x-reminders-secret). Disabled (404) when
// REMINDERS_CRON_SECRET is unset, so it is never open by default.
router.post('/run-reminders', async (req: Request, res: Response) => {
  const expected = process.env.REMINDERS_CRON_SECRET;
  if (!expected) return res.status(404).json({ success: false, message: 'Not found' });
  const header = req.headers['x-reminders-secret'];
  const provided = typeof header === 'string' ? header : '';
  if (!provided || !secretMatches(provided, expected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const data = await runReminders();
  return res.status(200).json({ success: true, data });
});

export default router;
