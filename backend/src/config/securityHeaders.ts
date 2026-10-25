import helmet from 'helmet';
import type { RequestHandler } from 'express';

/**
 * Response-header hardening for the JSON API (found by the ZAP baseline, see docs/SECURITY_SCANNING.md).
 * The API serves no HTML, so everything is locked down; the few endpoints that stream a file
 * (reports, /uploads) set their own, narrower CSP afterwards.
 */
export const helmetMiddleware = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        // Directives that do NOT fall back to default-src (ZAP: "CSP: Failure to Define Directive with No Fallback").
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // needed for socket.io
  });

const PERMISSIONS_POLICY = [
  'accelerometer=()', 'camera=()', 'geolocation=()', 'gyroscope=()', 'magnetometer=()',
  'microphone=()', 'payment=()', 'usb=()', 'interest-cohort=()',
].join(', ');

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
};

/**
 * API responses carry patient data and are user specific: never store them in a shared cache or the
 * browser history cache. Handlers that deliberately allow private caching (report files) override this.
 */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};
