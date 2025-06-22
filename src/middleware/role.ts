import { Request, Response, NextFunction } from 'express';

export const requireRole = (role: string) => (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  if (!user || user.accountType !== role) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
};
