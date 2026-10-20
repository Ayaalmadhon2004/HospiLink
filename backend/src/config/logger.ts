import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Never log secrets: redact common sensitive fields if they ever end up in a log object.
const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

export default logger;
export { logger };
