import express from 'express';
import { generateBill, getBills, payBill, getBillDetails } from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
import {
  validateUserId,
  validateBillId,
  validatePayBill,
  validatePagination,
  handleValidationErrors
} from '../utils/validation';

const router = express.Router();

// Generate bill for user
router.post('/generate/:userId', 
  authenticate, 
  validateUserId, 
  handleValidationErrors, 
  generateBill
);

// Get bills for user with pagination
router.get('/user/:userId', 
  authenticate, 
  validateUserId, 
  validatePagination, 
  handleValidationErrors, 
  getBills
);

// Pay a bill
router.post('/pay', 
  authenticate, 
  validatePayBill, 
  handleValidationErrors, 
  payBill
);

// Get bill details
router.get('/:billId', 
  authenticate, 
  validateBillId, 
  handleValidationErrors, 
  getBillDetails
);

export default router;
