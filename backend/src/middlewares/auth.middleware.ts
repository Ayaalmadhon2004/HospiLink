// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JWT_SECRET } from '../config/jwt';  // ← ✅ Unified secret
import { isTokenRevoked } from '../services/revokedTokens';
import { fail } from '../utils/apiResponse';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        hospitalId: string;
      };
    }
  }
}

// ============================================
// protect — يتحقق من التوكن ويجيب role من DB
// ============================================

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // 1. جرب JWT من Header أولاً (للـ Production)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. لو ما في → جرب الكوكيز (للـ Development)
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return fail(res, 401, 'UNAUTHORIZED', 'Unauthorized — no token provided');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { userId?: string; purpose?: string };

    // 2FA challenge tokens (and anything else without a userId) are not sessions.
    if (typeof decoded.userId !== 'string' || decoded.purpose) {
      return fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    }

    if (await isTokenRevoked(decoded.jti)) {
      return fail(res, 401, 'UNAUTHORIZED', 'Session expired, please sign in again');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, hospitalId: true, accountStatus: true, passwordChangedAt: true },
    });

    if (!user) {
      return fail(res, 401, 'UNAUTHORIZED', 'User not found');
    }

    // Self-registered accounts stay locked out of every protected route until an ADMIN approves them.
    if (user.accountStatus !== 'ACTIVE') {
      const pending = user.accountStatus === 'PENDING';
      const message = pending ? 'Account pending admin approval' : 'Account is disabled';
      return fail(res, 403, pending ? 'ACCOUNT_PENDING' : 'ACCOUNT_DISABLED', message);
    }

    // Tokens issued before the last password change/reset are dead.
    if (user.passwordChangedAt && (decoded.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return fail(res, 401, 'UNAUTHORIZED', 'Session expired, please sign in again');
    }

    // hospitalId comes from the DB row, never from the token or the request: it is the tenant for every query.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };

    next();
  } catch (error) {
    return fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
};

// ============================================
// authorize — يتحقق من صلاحية الـ Role
// ============================================

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return fail(res, 403, 'FORBIDDEN', 'You do not have permission to perform this action.', { required: roles, current: userRole || 'none' });
    }
    next();
  };
};