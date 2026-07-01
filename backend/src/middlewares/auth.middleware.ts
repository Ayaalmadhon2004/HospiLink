import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) { //  وشو البرير اصلا بشو بفرق عن العادي ليش يعني الهيدر يبدا ب البرير ؟ 
    token = req.headers.authorization.split(' ')[1];
  }
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req.user as any)?.role; 

    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا المسار' });
    }
    next();
  };
};