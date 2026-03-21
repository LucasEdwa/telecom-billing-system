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
 *             required: [userId, duration, phoneNumber]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               duration:
 *                 type: number
 *                 example: 300
 *                 description: Call duration in seconds
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Call logged successfully
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
 *                   example: Call usage logged successfully
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
 *             required: [userId, dataUsed]
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               dataUsed:
 *                 type: number
 *                 example: 1024
 *                 description: Data used in MB
 *               dataType:
 *                 type: string
 *                 example: mobile
 *                 enum: [mobile, wifi]
 *     responses:
 *       200:
 *         description: Data usage logged successfully
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
 *                   example: Data usage logged successfully
 */
router.post('/data', logData);

export default router;
