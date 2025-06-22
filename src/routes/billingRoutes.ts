import express from 'express';
import { generateBill } from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
const router = express.Router();

// Only pass req and res if your controller expects 2 arguments
router.get('/:userId', authenticate, (req, res, next) => {
  Promise.resolve(generateBill(req, res)).catch(next);
});

export default router;
