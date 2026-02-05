export class AppError extends Error {
  public statusCode: number;
  public source: string;
  public operation: string;

  constructor(message: string, statusCode: number, source: string, operation: string) {
    super(`[${source}] ${operation}: ${message}`);
    this.statusCode = statusCode;
    this.source = source;
    this.operation = operation;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number, source: string, operation: string) => {
  return new AppError(message, statusCode, source, operation);
};

// Quick error creators
export const authError = (message: string, operation: string) => 
  createError(message, 401, 'AUTH', operation);

export const validationError = (message: string, operation: string) => 
  createError(message, 400, 'VALIDATION', operation);

export const notFoundError = (resource: string, operation: string) => 
  createError(`${resource} not found`, 404, 'RESOURCE', operation);

export const dbError = (message: string, operation: string) => 
  createError(message, 500, 'DATABASE', operation);

export const paymentError = (message: string, operation: string) => 
  createError(message, 402, 'PAYMENT', operation);

export const billingError = (message: string, operation: string) => 
  createError(message, 400, 'BILLING', operation);