import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { AppError } from '../errors/AppError';

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const source = isAppError ? error.source : 'SYSTEM';
  const operation = isAppError ? error.operation : 'Unknown';

  logger.error(`Error in ${source}/${operation}`, {
    message: error.message,
    source,
    operation,
    url: req.url,
    method: req.method,
    userId: (req as any).user?.id,
    stack: error.stack
  });

  const response: ApiResponse = {
    success: false,
    message: process.env.NODE_ENV === 'production' && !isAppError
      ? 'Internal server error' 
      : error.message,
    errors: isAppError ? [`${source}/${operation}`] : undefined
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFound = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`
  };
  
  res.status(404).json(response);
};