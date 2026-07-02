import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'; // ← ضروري!
import prisma from './config/db';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patient.routes'; 
import { errorHandler } from './middlewares/error.middleware'; 
import path from 'path';
import bedRoutes from './routes/bed.routes';
import wardRoutes from './routes/ward.routes';
import vitalsRoutes from './routes/vitals.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true          // ← وحدة بس!
}));

app.use(express.json());
app.use(cookieParser());     // ← ضروري عشان تقرأ الكوكيز!

// المسارات
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/beds', bedRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/vitals', vitalsRoutes);


// مسار فحص حالة الاتصال
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: (error as Error).message });
  }
});

app.use(errorHandler); 

app.listen(PORT, () => {
  console.log(`🚀 HospiLink Server running on http://localhost:${PORT}`);
});