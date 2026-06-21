import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح لك بالوصول: لا يوجد توكن' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // التحقق من وجود المتغير
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (error) {
    res.status(403).json({ error: 'التوكن غير صالح أو منتهي الصلاحية' });
  }
};
// أضيفي هذا الكود في نهاية نفس ملف الميدل وير
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // نفترض أن الـ user تم وضعه في الـ req بواسطة الميدل وير السابق (protect)
    // تأكدي أن الـ role موجودة في الـ Token أو الـ user object
    const userRole = (req.user as any)?.role; 

    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا المسار' });
    }
    next();
  };
};