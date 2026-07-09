// src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import prisma from './config/db';
import { Server } from 'socket.io';
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

// Middlewares
import { errorHandler } from './middlewares/error.middleware';
import { setupDispatchSockets } from './middlewares/dispatch.socket'; // ← NEW
import settingsRoutes from './routes/settings.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "http://localhost:5173", credentials: true }
});

// 🔥 إعداد سوكيت الديسباتش
setupDispatchSockets(io);

// Socket الأساسية (الموجودة)
io.on('connection', (socket) => {
  console.log('User connected to HospiLink stream');

  socket.on('join-room', (patientId) => {
    socket.join(`patient-${patientId}`);
  });

  socket.on('join-department', (department) => {
    socket.join(`department-${department}`);
    console.log(`Socket joined department: ${department}`);
  });

  socket.on('leave-department', (department) => {
    socket.leave(`department-${department}`);
    console.log(`Socket left department: ${department}`);
  });
});

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/beds', bedRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/incidents', incidentRoutes); 

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