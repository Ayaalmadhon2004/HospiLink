// backend/src/services/scheduler.ts
// Dependency-free minute tick for reminders. Not started when NODE_ENV=test.
import logger from '../config/logger';
import { runReminders } from './reminders.service';

const TICK_MS = 60 * 1000;

export const startScheduler = (): NodeJS.Timeout | null => {
  if (process.env.NODE_ENV === 'test') return null;
  let running = false;
  const timer = setInterval(() => {
    if (running) return; // never overlap runs
    running = true;
    runReminders()
      .catch((err) => logger.error({ err }, '[Scheduler] tick failed'))
      .finally(() => { running = false; });
  }, TICK_MS);
  timer.unref?.();
  return timer;
};
