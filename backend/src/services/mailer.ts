// backend/src/services/mailer.ts
import nodemailer from 'nodemailer';
import logger from '../config/logger';

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

export const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
  if (!transport) {
    // Never log the body in production: it contains a live token.
    if (process.env.NODE_ENV === 'production') logger.warn({ subject }, 'SMTP_URL not set; mail not sent');
    else logger.debug({ to, subject, text }, 'SMTP_URL not set; mail not sent');
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
};

// The fragment (#token=) is not sent to servers, proxies or in the Referer header.
export const appLink = (path: string, token: string): string =>
  `${(process.env.APP_URL ?? '').replace(/\/+$/, '')}${path}#token=${token}`;
