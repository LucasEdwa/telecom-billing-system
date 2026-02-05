import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateUserId = [
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer')
];

export const validateBillId = [
  param('billId').isInt({ min: 1 }).withMessage('Bill ID must be a positive integer')
];

export const validatePayBill = [
  body('billId').isInt({ min: 1 }).withMessage('Bill ID must be a positive integer'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string')
];

export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['PAID', 'UNPAID']).withMessage('Status must be PAID or UNPAID')
];

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => err.msg)
    });
  }
  next();
};