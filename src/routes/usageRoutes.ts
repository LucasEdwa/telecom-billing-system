import express from 'express';
import { logCall, logSMS, logData } from '../controllers/usageController';
import { authenticate } from '../middleware/auth';
const router = express.Router();

router.post('/calls', authenticate, logCall);
router.post('/sms', authenticate, logSMS);
router.post('/data', authenticate, logData);

export default router;
