import express from 'express';
import { logCall, logSMS, logData } from '../controllers/usageController';
import { authenticate } from '../middleware/auth';
const router = express.Router();

// All usage routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /usage/calls:
 *   post:
 *     tags: [Usage]
 *     summary: Log call usage
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               duration:
 *                 type: number
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Call logged successfully
 */
router.post('/calls', logCall);

/**
 * @swagger
 * /usage/sms:
 *   post:
 *     tags: [Usage]
 *     summary: Log SMS usage
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               phoneNumber:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: SMS logged successfully
 */
router.post('/sms', logSMS);

/**
 * @swagger
 * /usage/data:
 *   post:
 *     tags: [Usage]
 *     summary: Log data usage
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               dataUsed:
 *                 type: number
 *               dataType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Data usage logged successfully
 */
router.post('/data', logData);

export default router;
