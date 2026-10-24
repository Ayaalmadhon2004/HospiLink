import type { Server as HttpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';

// Singleton Socket.io instance. server.ts creates it once with initIO(); controllers and services
// call getIO() instead of importing from server.ts (which was a circular import).
let io: Server | null = null;

export const initIO = (httpServer: HttpServer, options?: Partial<ServerOptions>): Server => {
  io = new Server(httpServer, options);
  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io is not initialized: call initIO() first');
  return io;
};
