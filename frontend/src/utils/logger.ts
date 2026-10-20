// Dev-only logger: silent in production builds.
const enabled = !import.meta.env.PROD;

export const logger = {
  log: (...args: unknown[]): void => {
    if (enabled) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (enabled) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    if (enabled) console.error(...args);
  },
};
