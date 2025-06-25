import express from 'express';
import { updateRate } from '../controllers/rateController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { getRates } from '../controllers/rateController';

const router = express.Router();

// Fix: Only use updateRate for PUT, and add a proper GET handler if needed
router.put('/:service', authenticate, requireRole('admin'), (req, res, next) => {
  Promise.resolve(updateRate(req, res)).catch(next);
});

// Optionally, implement a GET handler for fetching a rate
router.get('/:service', authenticate, requireRole('admin'), (req, res, next) => {
  Promise.resolve(getRates(req, res)).catch(next);
});

export default router;
