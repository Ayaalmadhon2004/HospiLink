// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt';
import { registerSchema, loginSchema, formatZodError } from '../validators/auth.validator';
import logger from '../config/logger';

// Public signup creates a PENDING account with the lowest-privilege role as a placeholder
// (the Prisma Role enum has no STAFF value). The account cannot log in or call any protected
// route until an ADMIN approves it and assigns the real role (users.controller).
const PUBLIC_SIGNUP_ROLE = 'NURSE' as const;

// ============================================
// Generate JWT Token
// ============================================
const generateToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// ============================================
// REGISTER
// ============================================
export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: formatZodError(parsed.error) });
      return;
    }
    // role / hospitalId from the body are intentionally ignored.
    const { email, password, name, department, shift, hospitalCode } = parsed.data;

    // The hospital comes from its signup code, never from a client-supplied id.
    const hospital = await prisma.hospital.findUnique({ where: { code: hospitalCode }, select: { id: true } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Invalid hospital code' });
      return;
    }
    const hospitalId = hospital.id;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: PUBLIC_SIGNUP_ROLE,
        accountStatus: 'PENDING',
        department,
        shift,
        hospitalId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        shift: true,
        status: true,
        accountStatus: true,
        hospitalId: true,
        createdAt: true,
      },
    });

    // No token/cookie: the user is not signed in until an admin approves the account.
    res.status(201).json({
      success: true,
      message: 'Registration received. Your account is pending admin approval.',
      user,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Register error:');
    res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
};

// ============================================
// LOGIN
// ============================================
export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required: ' + formatZodError(parsed.error),
      });
      return;
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Checked after the password so the status of an account is not revealed without credentials.
    if (user.accountStatus !== 'ACTIVE') {
      const pending = user.accountStatus === 'PENDING';
      const message = pending ? 'Account pending admin approval' : 'Account is disabled';
      res.status(403).json({
        success: false,
        message,
        code: pending ? 'ACCOUNT_PENDING' : 'ACCOUNT_DISABLED',
      });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Login error:');
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// ============================================
// LOGOUT
// ============================================
export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Logout error:');
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

// ============================================
// GET CURRENT USER (ME)
// ============================================
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        shift: true,
        status: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'GetMe error:');
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
    });
  }
};

// ============================================
// UPDATE PASSWORD
// ============================================
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'UpdatePassword error:');
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
    });
  }
};