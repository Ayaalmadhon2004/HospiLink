import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// ==========================================
// 1️⃣ مسار إنشاء حساب جديد (Sign Up)
// ==========================================
router.post('/signup', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, role, department, shift, hospitalId } = req.body;

    // التحقق من المدخلات الأساسية الإلزامية
    if (!name || !email || !password || !role || !hospitalId) {
      return res.status(400).json({ error: 'الرجاء ملء الحقول الأساسية: الاسم، البريد، كلمة المرور، الدور، والمستشفى' });
    }

    // التأكد من أن البريد الإلكتروني غير مسجل مسبقاً
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل في النظام' });
    }

    // تشفير كلمة المرور لحماية الحساب
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // إنشاء المستخدم الجديد في قاعدة البيانات عبر Prisma
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role, // DOCTOR, NURSE, ADMIN
        department: department || 'General',
        shift: shift || 'Day',
        status: 'Active',
        hospitalId, // يربط المستخدم بالمستشفى الصحيحة
      },
    });

    // توليد JWT Token للمستخدم الجديد مباشرة ليتمكن من الدخول فوراً
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1d' }
    );

    // إرجاع بيانات النجاح والتوكن (باستثناء الباسورد للأمان)
    return res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      }
    });

  } catch (error) {
    console.error('❌ Signup Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر أثناء إنشاء الحساب' });
  }
});

// ==========================================
// 2️⃣ مسار تسجيل الدخول (Login)
// ==========================================
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // التحقق من إدخال البيانات الأساسية
    if (!email || !password) {
      return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' });
    }

    // البحث عن المستخدم في قاعدة البيانات
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // إذا لم يتم العثور على المستخدم
    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // مقارنة كلمة المرور الممررة مع المشفرة في قاعدة البيانات
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // توليد الـ JWT Token في حال نجاح المطابقة
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1d' }
    );

    // إرجاع بيانات نجاح العملية مع الـ Token
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر أثناء عملية تسجيل الدخول' });
  }
});

export default router;