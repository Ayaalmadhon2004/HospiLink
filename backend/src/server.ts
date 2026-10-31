import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { errorEnvelope, fail } from './utils/apiResponse';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import prisma from './config/db';
import { Socket } from 'socket.io';
import { initIO } from './utils/socket';
import http from 'http';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users.routes';
import patientRoutes from './routes/patient.routes';
import bedRoutes from './routes/bed.routes';
import wardRoutes from './routes/ward.routes';
import vitalsRoutes from './routes/vitals.routes';
import devicesRoutes from './routes/devices.routes';
import auditLogRoutes from './routes/auditLog.routes';
import exportsRoutes from './routes/exports.routes';
import { pharmacyRouter, billingRouter } from './routes/pharmacyBilling.routes';
import { notesRouter, medicationsRouter, prescriptionsRouter, labOrdersRouter } from './routes/clinical.routes';
import staffRoutes from './routes/staff.routes';
import appointmentRoutes from './routes/appointments.routes';
import dispatchRoutes from './routes/dispatch.routes';
import incidentRoutes from './routes/incidents.routes';
import notificationRoutes from './routes/notifications.routes';
// Middlewares
import { protect } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { attachDispatchEvents } from './middlewares/dispatch.socket';
import { socketAuth, hasRole, joinUserRoom, joinClinicalRoom, socketHospitalId } from './middlewares/socket.auth';
import { departmentRoom } from './utils/tenant';
import settingsRoutes from './routes/settings.routes';
import internalRoutes from './routes/internal.routes';
import webVitalsRoutes from './routes/webVitals.routes';
import logger from './config/logger';
import { initSentry } from './config/sentry';
import { createShutdown } from './config/serverConfig';
import { loadEnv } from './config/env';
import { helmetMiddleware, permissionsPolicy, noStore } from './config/securityHeaders';

dotenv.config();
initSentry();

const app = express();
const { PORT, CORS_ORIGINS: allowedOrigins } = loadEnv();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';

// Render sits behind one reverse proxy. Without this, req.ip is the proxy's IP and every
// client shares a single rate-limit bucket.
app.set('trust proxy', 1);

// ✅ Security: Helmet (CSP, HSTS, X-Content-Type-Options...) + Permissions-Policy; see config/securityHeaders.ts
app.use(helmetMiddleware());
app.use(permissionsPolicy);

// ✅ Performance: Compression — gzip/brotli for JSON responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
}));

// Production limits are the defaults below. The real-backend E2E suite (frontend/playwright.real.config.ts) raises them through
// env because one browser session hits /api/auth/me on every page load; nothing else sets these.
const limitFromEnv = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// ✅ Rate limiting for auth routes — prevents brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: limitFromEnv('AUTH_RATE_LIMIT_MAX', 20), // 20 requests per window
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter. Device ingestion is exempt: it has its own failure + per-device-key limiters (routes/vitals.routes.ts),
// because one hospital gateway carries every bedside device and would exhaust a per-IP budget in seconds.
const apiLimiter = rateLimit({
  skip: (req) => req.originalUrl.startsWith('/api/vitals/ingest/'),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: limitFromEnv('API_RATE_LIMIT_MAX', 200), // 200 requests per minute
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const io = initIO(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// ✅ Socket auth: JWT from handshake.auth.token or `token` cookie
io.use(socketAuth);

// ← connection handler
io.on('connection', (socket: Socket) => {
  if (isDev) {
    logger.debug({ socketId: socket.id }, 'User connected to HospiLink stream');
  }

  // Personal room: target of createNotification() -> 'new-notification'
  joinUserRoom(socket);

  socket.on('join-room', async (patientId: unknown) => {
    if (!hasRole(socket, 'ADMIN', 'DOCTOR', 'NURSE')) return;
    if (typeof patientId !== 'string' || !patientId || patientId.length > 128) return;
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;
    try {
      // Only patients of the user's own hospital can be followed.
      const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId, deletedAt: null }, select: { id: true } });
      if (patient) socket.join(`patient-${patientId}`);
    } catch (error) {
      logger.error({ err: error }, 'join-room failed');
    }
  });

  joinClinicalRoom(socket);

  socket.on('join-department', (department: unknown) => {
    if (!hasRole(socket, 'ADMIN', 'DOCTOR', 'NURSE')) return;
    if (typeof department !== 'string' || !department || department.length > 64) return;
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;
    socket.join(departmentRoom(hospitalId, department));
    if (isDev) {
      logger.debug({ department }, 'Socket joined department');
    }
  });

  socket.on('leave-department', (department: unknown) => {
    if (typeof department !== 'string' || !department || department.length > 64) return;
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;
    socket.leave(departmentRoom(hospitalId, department));
    if (isDev) {
      logger.debug({ department }, 'Socket left department');
    }
  });

  attachDispatchEvents(socket);

  socket.on('disconnect', () => {
    if (isDev) {
      logger.debug({ socketId: socket.id }, 'User disconnected');
    }
  });
});

// ✅ CORS with allowedHeaders
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Unauthenticated Web Vitals beacon: own tiny body parser + limiter, so it is mounted before express.json()
app.use('/api/telemetry/web-vitals', webVitalsRoutes);

app.use(express.json());
app.use(cookieParser());
app.use(errorEnvelope);

// ✅ Apply rate limiting
// API responses are never cacheable (patient data); health/uploads/reports set their own headers.
app.use('/api', noStore);
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ✅ Cache headers for static uploads (1 hour)
// Uploaded files (PDFs/images) are viewed directly, so allow their own content under a tight CSP.
app.use('/uploads', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self'; object-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'"
  );
  next();
});
app.use('/uploads', protect, express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// app.ts أو server.ts
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/clinical-notes', notesRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/lab-orders', labOrdersRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/billing', billingRouter);
app.use('/api/staff', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal', internalRoutes);


app.get('/api/health', async (req, res) => {
  try {
    // Never hang: a sleeping/unreachable database must answer 500 quickly so the frontend warm-up can retry.
    const HEALTH_DB_TIMEOUT_MS = 6_000;
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('database health check timed out')), HEALTH_DB_TIMEOUT_MS).unref()),
    ]);
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    logger.error({ err: error }, 'health check: database unreachable');
    res.status(500).json({ status: 'DOWN', database: 'DISCONNECTED' }); // no driver/connection details to clients
  }
});

// Unknown API routes: JSON envelope instead of Express' default HTML page ("Cannot GET ...").
app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found'));

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'HospiLink Server running');
});

// Graceful shutdown (Render sends SIGTERM on deploy/restart)
const shutdown = createShutdown({
  server,
  disconnect: () => prisma.$disconnect(),
  log: logger,
  exit: (code) => process.exit(code),
});
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
