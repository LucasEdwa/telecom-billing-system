import { Request, Response, NextFunction } from 'express';
import { authError } from '../errors/AppError';

export const requireRole = (role: string) => (req: Request, res: Response, next: NextFunction): void => {
  try {
    const user = (req as any).user;
    if (!user || user.accountType !== role) {
      throw authError(`Access denied. Required role: ${role}`, 'Role Verification');
    }
    next();
  } catch (error) {
    next(error);
  }
};
