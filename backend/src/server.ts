import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import prisma from './config/db';
import { Server, Socket } from 'socket.io';
import http from 'http';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import patientRoutes from './routes/patient.routes';
import bedRoutes from './routes/bed.routes';
import wardRoutes from './routes/ward.routes';
import vitalsRoutes from './routes/vitals.routes';
import staffRoutes from './routes/staff.routes';
import appointmentRoutes from './routes/appointments.routes';
import dispatchRoutes from './routes/dispatch.routes';
import incidentRoutes from './routes/incidents.routes';
import notificationRoutes from './routes/notifications.routes';
// Middlewares
import { errorHandler } from './middlewares/error.middleware';
import { attachDispatchEvents } from './middlewares/dispatch.socket';
import settingsRoutes from './routes/settings.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';

// ✅ Security: Helmet — sets security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:", "https://hospi-link-two.vercel.app"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for socket.io
}));

// ✅ Performance: Compression — gzip/brotli for JSON responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
}));

// ✅ CORS origins — production + development
const allowedOrigins = [
  "http://localhost:5173",
  "https://hospi-link-liart.vercel.app",
  "https://hospi-link-two.vercel.app"
];

// ✅ Rate limiting for auth routes — prevents brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// ← connection handler
io.on('connection', (socket: Socket) => {
  if (isDev) {
    console.log('User connected to HospiLink stream:', socket.id);
  }

  socket.on('join-room', (patientId: string) => {
    socket.join(`patient-${patientId}`);
  });

  socket.on('join-department', (department: string) => {
    socket.join(`department-${department}`);
    if (isDev) {
      console.log(`Socket joined department: ${department}`);
    }
  });

  socket.on('leave-department', (department: string) => {
    socket.leave(`department-${department}`);
    if (isDev) {
      console.log(`Socket left department: ${department}`);
    }
  });

  attachDispatchEvents(socket);

  socket.on('disconnect', () => {
    if (isDev) {
      console.log('User disconnected:', socket.id);
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

app.use(express.json());
app.use(cookieParser());

// ✅ Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ✅ Cache headers for static uploads (1 hour)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// app.ts أو server.ts
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);


app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: (error as Error).message });
  }
});

app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`🚀 HospiLink Server running on http://localhost:${PORT}`);
});

export { io };