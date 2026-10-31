// src/middlewares/socket.auth.ts
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JWT_SECRET } from '../config/jwt';
import { isTokenRevoked } from '../services/revokedTokens';
import { clinicalRoom } from '../utils/tenant';

export interface SocketUser {
  id: string;
  role: string;
  hospitalId: string;
}

// يقرأ كوكي `token` من هيدر الـ handshake
const parseCookieToken = (cookieHeader?: string): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === 'token') {
      const value = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return undefined;
};

export const extractSocketToken = (socket: Socket): string | undefined => {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;
  return parseCookieToken(socket.handshake?.headers?.cookie);
};

export const socketAuth = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  const token = extractSocketToken(socket);
  if (!token) return next(new Error('Unauthorized: no token provided'));

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; iat?: number; jti?: string; purpose?: string };
    if (!decoded || typeof decoded.userId !== 'string') {
      return next(new Error('Unauthorized: invalid token'));
    }

    if (decoded.purpose) return next(new Error('Unauthorized: invalid token'));
    if (await isTokenRevoked(decoded.jti)) return next(new Error('Unauthorized: session expired'));

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, hospitalId: true, accountStatus: true, passwordChangedAt: true },
    });
    if (!user) return next(new Error('Unauthorized: user not found'));
    // Same rule as `protect`: PENDING / DISABLED accounts get no realtime data either.
    if (user.accountStatus !== 'ACTIVE') return next(new Error('Forbidden: account not active'));

    if (user.passwordChangedAt && (decoded.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return next(new Error('Unauthorized: session expired'));
    }

    socket.data.user = { id: user.id, role: user.role, hospitalId: user.hospitalId } as SocketUser;
    next();
  } catch {
    next(new Error('Unauthorized: invalid or expired token'));
  }
};

export const hasRole = (socket: Socket, ...roles: string[]): boolean => {
  const role = socket.data?.user?.role;
  return typeof role === 'string' && roles.includes(role);
};

// يضم السوكيت تلقائياً لغرفة المستخدم الخاصة (user-<id>) لاستقبال الإشعارات الفورية
export const joinUserRoom = (socket: Socket): string | null => {
  const id = socket.data?.user?.id;
  if (typeof id !== 'string' || !id) return null;
  const room = `user-${id}`;
  socket.join(room);
  return room;
};

// غرفة الطاقم السريري (لكل مستشفى): نفس الأدوار المسموح لها بالـ REST لمواعيد وحوادث المرضى
export const joinClinicalRoom = (socket: Socket): boolean => {
  const hospitalId = socket.data?.user?.hospitalId;
  if (typeof hospitalId !== 'string' || !hospitalId) return false;
  if (!hasRole(socket, 'ADMIN', 'DOCTOR', 'NURSE')) return false;
  socket.join(clinicalRoom(hospitalId));
  return true;
};

// Hospital of the connected user (set by socketAuth, loaded from the DB), or null.
export const socketHospitalId = (socket: Socket): string | null => {
  const id = socket.data?.user?.hospitalId;
  return typeof id === 'string' && id ? id : null;
};
