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

// Update rate (admin only with API key)
router.put('/:service', (req, res, next) => {
  Promise.resolve(updateRate(req, res)).catch(next);
});

// Get rates (admin only with API key)
router.get('/:service', (req, res, next) => {
  Promise.resolve(getRates(req, res)).catch(next);
});

export default router;
