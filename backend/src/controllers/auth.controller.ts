// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// ============================================
// Generate JWT Token — FIXED ✅ (مع role و email)
// ============================================
const generateToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,        // ← أضفنا role
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
    const { email, password, name, role, department, shift, hospitalId } = req.body;

    // Check if user exists
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'STAFF',
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
        hospitalId: true,
        createdAt: true,
      },
    });

    // ✅ Generate token with role
    const token = generateToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

// ============================================
// LOGIN
// ============================================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    // Find user
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

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // ✅ Generate token with role
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
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
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Logout failed',
    });
  }
};

// ============================================
// GET CURRENT USER (ME)
// ============================================
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

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
  } catch (error: any) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user',
    });
  }
};

// ============================================
// UPDATE PASSWORD
// ============================================
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
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
  } catch (error: any) {
    console.error('UpdatePassword error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update password',
    });
  }
};