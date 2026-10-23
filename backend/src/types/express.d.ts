declare global {
  namespace Express {
    interface Request {
      // Set by `protect` (auth.middleware.ts) from the DB, not from the token body.
      user?: {
        id: string;
        email: string;
        role: string;
        // Tenant. Every Prisma query must be scoped by this (see utils/tenant.ts).
        hospitalId: string;
      };
    }
  }
}

export {};
