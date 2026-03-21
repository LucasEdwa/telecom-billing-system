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

/**
 * @swagger
 * /billing/generate/{userId}:
 *   post:
 *     tags: [Billing]
 *     summary: Generate bill for user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bill generated successfully
 */
// Generate bill for user
router.post('/generate/:userId', 
  validateUserId, 
  handleValidationErrors, 
  generateBill
);

/**
 * @swagger
 * /billing/user/{userId}:
 *   get:
 *     tags: [Billing]
 *     summary: Get bills for user with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of bills
 */
// Get bills for user with pagination
router.get('/user/:userId', 
  validateUserId, 
  validatePagination, 
  handleValidationErrors, 
  getBills
);

/**
 * @swagger
 * /billing/pay:
 *   post:
 *     tags: [Billing]
 *     summary: Pay a bill
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billId:
 *                 type: integer
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment successful
 */
// Pay a bill
router.post('/pay', 
  validatePayBill, 
  handleValidationErrors, 
  payBill
);

/**
 * @swagger
 * /billing/{billId}:
 *   get:
 *     tags: [Billing]
 *     summary: Get bill details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bill details
 */
// Get bill details
router.get('/:billId', 
  validateBillId, 
  handleValidationErrors, 
  getBillDetails
);

export default router;
