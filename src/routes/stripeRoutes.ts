import express from 'express';
import { createPaymentIntent, confirmBillPayment } from '../controllers/stripeController';
import { authenticate } from '../middleware/auth';
import { billingRateLimit } from '../middleware/security';
const router = express.Router();

// All payment routes require authentication and rate limiting
router.use(authenticate);
router.use(billingRateLimit);

router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm-bill-payment', confirmBillPayment);

export default router;
