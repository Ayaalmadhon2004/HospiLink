// src/middlewares/socket.auth.ts
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JWT_SECRET } from '../config/jwt';

export interface SocketUser {
  id: string;
  role: string;
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
    if (!decoded || typeof decoded.userId !== 'string') {
      return next(new Error('Unauthorized: invalid token'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });
    if (!user) return next(new Error('Unauthorized: user not found'));

    socket.data.user = { id: user.id, role: user.role } as SocketUser;
    next();
  } catch {
    next(new Error('Unauthorized: invalid or expired token'));
  }
};

export const hasRole = (socket: Socket, ...roles: string[]): boolean => {
  const role = socket.data?.user?.role;
  return typeof role === 'string' && roles.includes(role);
};
