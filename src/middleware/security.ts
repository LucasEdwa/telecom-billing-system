import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { validationError } from '../errors/AppError';

// Resolve the real client IP from X-Forwarded-For (set by nginx ingress)
// Falls back to req.ip when not behind a proxy
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
};

// Rate limiting configurations
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    errors: ['SECURITY/Rate Limit']
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    errors: ['SECURITY/Auth Rate Limit']
  },
  skipSuccessfulRequests: true,
});

export const billingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many billing operations, please try again later.',
    errors: ['SECURITY/Billing Rate Limit']
  },
});

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Remove potential XSS and injection characters
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        // Only sanitize if the string contains actual malicious patterns
        if (obj.includes('<script') || obj.includes('javascript:') || /on\w+\s*=/i.test(obj)) {
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        }
        return obj; // Return unchanged if no malicious patterns
      }
      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }
      if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitize(obj[key]);
          }
        }
        return sanitized;
      }
      return obj;
    };

    // Only sanitize if data exists
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitize(req.body);
    }
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = sanitize(req.query);
    }
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = sanitize(req.params);
    }
    
    next();
  } catch (error) {
    // Log error but don't block request
    console.warn('Sanitization warning:', error);
    next(); // Continue instead of throwing error
  }
};

// Request size limiting
export const requestSizeLimit = (req: Request, _res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 1024 * 1024; // 1MB limit
  
  if (contentLength > maxSize) {
    throw validationError('Request body too large', 'Request Size Validation');
  }
  next();
};

// API key validation for admin endpoints
export const validateApiKey = (req: Request, _res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    return next(); // Skip if no API key configured
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    throw validationError('Invalid or missing API key', 'API Key Validation');
  }
  next();
};