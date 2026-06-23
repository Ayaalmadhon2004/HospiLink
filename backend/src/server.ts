import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/db';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patient.routes'; 
import { errorHandler } from './middlewares/error.middleware'; 
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// المسارات
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes); // ربط مسارات المرضى
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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