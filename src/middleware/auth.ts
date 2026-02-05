import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authError } from '../errors/AppError';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw authError('Authorization header missing', 'Token Validation');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw authError('Token missing in authorization header', 'Token Validation');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      next(authError('Invalid token format', 'Token Validation'));
    } else if (error.name === 'TokenExpiredError') {
      next(authError('Token has expired', 'Token Validation'));
    } else if (error.name === 'AppError') {
      next(error);
    } else {
      next(authError('Token validation failed', 'Token Validation'));
    }
  }
};
