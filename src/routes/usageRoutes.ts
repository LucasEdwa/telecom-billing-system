import express from 'express';
import { logCall, logSMS, logData } from '../controllers/usageController';
import { authenticate } from '../middleware/auth';
const router = express.Router();

// All usage routes require authentication
router.use(authenticate);

router.post('/calls', logCall);
router.post('/sms', logSMS);
router.post('/data', logData);

export default router;
