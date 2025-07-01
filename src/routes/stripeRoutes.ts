import express from 'express';
import { createPaymentIntent, confirmBillPayment } from '../controllers/stripeController';
const router = express.Router();

router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm-bill-payment', confirmBillPayment);

export default router;
