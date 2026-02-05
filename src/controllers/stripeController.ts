import { Request, Response } from 'express';
import Stripe from 'stripe';
import { payBill } from './billingController';
import { paymentError, validationError } from '../errors/AppError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    if (!amount || amount <= 0) {
      throw validationError('Amount must be greater than 0', 'Create Payment Intent');
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw paymentError(`Stripe payment intent creation failed: ${error.message}`, 'Create Payment Intent');
  }
};

export const confirmBillPayment = async (req: Request, res: Response) => {
  try {
    const { billId, paymentIntentId } = req.body;
    if (!billId || !paymentIntentId) {
      throw validationError('billId and paymentIntentId are required', 'Confirm Payment');
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      req.body.billId = billId;
      await payBill(req, res);
    } else {
      throw paymentError('Payment not successful', 'Confirm Payment');
    }
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw paymentError(`Payment confirmation failed: ${error.message}`, 'Confirm Payment');
  }
};
