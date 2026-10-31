import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

// Neon suspends idle computes and drops idle connections. Without explicit timeouts, pg waits forever on a dead
// socket and every request (login, /api/health) hangs until the client gives up. Fail fast and recycle idle sockets.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 20_000,
  keepAlive: true,
});
const prisma = new PrismaClient({ adapter });

export default prisma;