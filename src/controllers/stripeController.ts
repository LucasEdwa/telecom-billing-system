import { Request, Response } from 'express';
import Stripe from 'stripe';
import { payBill } from './billingController';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { amount, currency = 'usd' } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// This endpoint should be called by your frontend after payment confirmation
export const confirmBillPayment = async (req: Request, res: Response) => {
  const { billId, paymentIntentId } = req.body;
  try {
    // Verify payment status with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      req.body.billId = billId;
      await payBill(req, res);
    } else {
      res.status(400).json({ message: 'Payment not successful' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
