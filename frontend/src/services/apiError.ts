// frontend/src/services/apiError.ts
/**
 * The only error type the API layer rejects with. `message` is ready to show (translated when the server sent a
 * known `code`), `code` is the machine-readable reason, `status` the HTTP status (undefined without a response).
 */
export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
  }
}
