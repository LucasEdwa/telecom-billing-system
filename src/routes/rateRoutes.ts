import express from 'express';
import { updateRate, getRates } from '../controllers/rateController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { validateApiKey } from '../middleware/security';

const router = express.Router();

// All rate operations require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));
router.use(validateApiKey);

/**
 * @swagger
 * /rates/{service}:
 *   put:
 *     tags: [Rates]
 *     summary: Update rate for service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *           enum: [call, sms, data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Rate updated successfully
 */
// Update rate (admin only with API key)
router.put('/:service', (req, res, next) => {
  Promise.resolve(updateRate(req, res)).catch(next);
});

/**
 * @swagger
 * /rates/{service}:
 *   get:
 *     tags: [Rates]
 *     summary: Get rates for service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: service
 *         required: true
 *         schema:
 *           type: string
 *           enum: [call, sms, data]
 *     responses:
 *       200:
 *         description: Service rates
 */
// Get rates (admin only with API key)
router.get('/:service', (req, res, next) => {
  Promise.resolve(getRates(req, res)).catch(next);
});

export default router;
