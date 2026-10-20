// backend/src/middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

type Part = 'params' | 'query' | 'body';
type ValidationIssue = { path: string; message: string };

const HTTP_BAD_REQUEST = 400;
const PARTS: readonly Part[] = ['params', 'query', 'body'];

export const formatValidationErrors = (error: ZodError): ValidationIssue[] =>
  error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

// Express 5 exposes req.query as a getter-only property, so replace it explicitly.
const assign = (req: Request, key: Part, value: unknown): void => {
  Object.defineProperty(req, key, { value, writable: true, configurable: true, enumerable: true });
};

/**
 * Validates req.params / req.query / req.body against zod schemas.
 * Unknown keys are stripped (zod object default). On failure responds
 * 400 { success:false, message, errors } and does not call next().
 * On success the parsed (stripped / normalised) values replace the originals.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, res: Response, next: NextFunction): void | Response => {
    const results = PARTS.filter((key) => schemas[key]).map((key) => ({
      key,
      result: (schemas[key] as ZodTypeAny).safeParse(req[key] ?? {}),
    }));

    const errors: ValidationIssue[] = results.flatMap(({ key, result }) =>
      result.success
        ? []
        : formatValidationErrors(result.error).map((e) => ({
            path: [key, e.path].filter(Boolean).join('.'),
            message: e.message,
          }))
    );

    if (errors.length > 0) {
      return res.status(HTTP_BAD_REQUEST).json({
        success: false,
        message: errors.map((e) => `${e.path}: ${e.message}`).join('; '),
        errors,
      });
    }

    results.forEach(({ key, result }) => result.success && assign(req, key, result.data));
    next();
  };
