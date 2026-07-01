export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // ... check user ...
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    // ✅ خزن في cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.status(200).json({
      success: true,
      token, // ← ابعت في response كمان
      user: { ... }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};