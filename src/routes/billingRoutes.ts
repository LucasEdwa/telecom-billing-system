import express from 'express';
import { generateBill, getBills, payBill, getBillDetails, getLedger, getDLQ, resolveDLQ, discardDLQ, reconcile, searchBills } from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
import { billingRateLimit } from '../middleware/security';
import { requireRole as authorizeRole } from '../middleware/role';
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
 *           example: 1
 *     responses:
 *       200:
 *         description: Bill generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Bill generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     billId:
 *                       type: integer
 *                       example: 123
 *                     amount:
 *                       type: number
 *                       example: 45.67
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
 *             required: [billId, amount]
 *             properties:
 *               billId:
 *                 type: integer
 *                 example: 123
 *               amount:
 *                 type: number
 *                 example: 45.67
 *     responses:
 *       200:
 *         description: Payment successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payment processed successfully
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

// ─── Ledger (Audit Trail) ──────────────────────────────────────────────────

/**
 * @swagger
 * /billing/ledger/{userId}:
 *   get:
 *     tags: [Billing]
 *     summary: Get full financial ledger (audit trail) for a user
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
 *         description: Ledger entries with running balance
 */
router.get('/ledger/:userId',
  validateUserId,
  validatePagination,
  handleValidationErrors,
  getLedger
);

// ─── Dead Letter Queue (Admin only) ────────────────────────────────────────

/**
 * @swagger
 * /billing/dlq:
 *   get:
 *     tags: [Admin]
 *     summary: View pending Dead Letter Queue items
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of failed CDRs pending review
 */
router.get('/dlq', authorizeRole('ADMIN'), getDLQ);

/**
 * @swagger
 * /billing/dlq/{dlqId}/resolve:
 *   put:
 *     tags: [Admin]
 *     summary: Mark a DLQ item as resolved
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dlqId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: DLQ item resolved
 */
router.put('/dlq/:dlqId/resolve', authorizeRole('ADMIN'), resolveDLQ);

/**
 * @swagger
 * /billing/dlq/{dlqId}/discard:
 *   put:
 *     tags: [Admin]
 *     summary: Discard a DLQ item (invalid data)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dlqId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: DLQ item discarded
 */
router.put('/dlq/:dlqId/discard', authorizeRole('ADMIN'), discardDLQ);

// ─── Reconciliation (Integrity Verification) ───────────────────────────────

/**
 * @swagger
 * /billing/reconcile/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Verify ledger integrity — proves every cent is accounted for
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
 *         description: Reconciliation passed — ledger is consistent
 *       409:
 *         description: Discrepancy detected — manual audit required
 */
router.get('/reconcile/:userId',
  authorizeRole('ADMIN'),
  validateUserId,
  handleValidationErrors,
  reconcile
);

// ─── Bill Search ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /billing/search:
 *   get:
 *     tags: [Billing]
 *     summary: Search bills with flexible filters (date range, amount range, status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PAID, UNPAID]
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Filtered list of bills with pagination
 */
router.get('/search',
  validatePagination,
  handleValidationErrors,
  searchBills
);

export default router;
