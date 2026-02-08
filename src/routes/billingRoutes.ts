import express from 'express';
import { generateBill, getBills, payBill, getBillDetails } from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
import { billingRateLimit } from '../middleware/security';
import {
  validateUserId,
  validateBillId,
  validatePayBill,
  validatePagination,
  handleValidationErrors
} from '../utils/validation';

const router = express.Router();

// All billing routes require authentication and rate limiting
router.use(authenticate);
router.use(billingRateLimit);

// Generate bill for user
router.post('/generate/:userId', 
  validateUserId, 
  handleValidationErrors, 
  generateBill
);

// Get bills for user with pagination
router.get('/user/:userId', 
  validateUserId, 
  validatePagination, 
  handleValidationErrors, 
  getBills
);

// Pay a bill
router.post('/pay', 
  validatePayBill, 
  handleValidationErrors, 
  payBill
);

// Get bill details
router.get('/:billId', 
  validateBillId, 
  handleValidationErrors, 
  getBillDetails
);

export default router;
