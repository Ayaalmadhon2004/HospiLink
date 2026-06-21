import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ربط مسارات المصادقة
app.use('/api/auth', authRoutes);

// فحص سلامة السيرفر
app.get('/health', (req, res) => {
  res.json({ status: 'UP', message: 'HospiLink Server is running smoothly' });
});

app.listen(PORT, () => {
  console.log(`🚀 HospiLink Server running on http://localhost:${PORT}`);
});