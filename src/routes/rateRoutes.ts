import express from 'express';
import { updateRate } from '../controllers/rateController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
const router = express.Router();

// Only pass req and res if your controller expects 2 arguments
router.put('/:service', authenticate, requireRole('admin'), (req, res) => {
  Promise.resolve(updateRate(req, res)).catch(res.status(500).json);
});

export default router;
