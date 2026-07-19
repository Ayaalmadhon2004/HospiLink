// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Generate Token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' });
};

// GET /api/auth/me
router.get('/me', protect, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, department: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('❌ GetMe Error:', error);
    res.status(500).json({ error: 'Failed to get user', details: error.message });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, role, department, shift, hospitalId } = req.body;

    if (!name || !email || !password || !role || !hospitalId) {
      return res.status(400).json({ error: 'الرجاء ملء الحقول الأساسية' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        department: department || 'General',
        shift: shift || 'Day',
        status: 'Active',
        hospitalId,
      },
    });

    const token = generateToken(newUser.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      token,  // ← ✅ أرجع token
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      }
    });

  } catch (error: any) {
    console.error('❌ Signup Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر', details: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log('📥 Login request:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد وكلمة المرور' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
    }

    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,  // ← ✅ أرجع token
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });

  } catch (error: any) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر', details: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.json({ success: true, message: 'تم تسجيل الخروج' });
});

export default router;