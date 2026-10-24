// backend/src/services/securityNotices.ts
import logger from '../config/logger';
import { sendMail } from './mailer';

/**
 * Tells a user about a security-relevant change on their account (2FA turned on/off or reset,
 * recovery codes regenerated or used). Fire-and-forget: it must never fail or slow the request.
 * Messages contain no secrets, codes or links.
 */
export const sendSecurityNotice = (email: string, subject: string, text: string): void => {
  void sendMail(email, subject, `${text}\n\nIf this was not you, change your password and contact your administrator.`).catch(
    (err: unknown) => logger.error({ err }, 'Security notice mail failed'),
  );
};
