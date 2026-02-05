import { Request, Response } from 'express';
import { BillingService } from '../services/billingService';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const billingService = new BillingService();

export const generateBill = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;

  const calculation = await billingService.calculateBill(userId);
  const billId = await billingService.createBill(calculation);

  const response: ApiResponse = {
    success: true,
    data: {
      billId: billId || null,
      calculation
    },
    message: billId > 0 ? 'Bill generated successfully' : 'No charges for this period'
  };

  res.status(201).json(response);
});
export const getBills = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as 'PAID' | 'UNPAID' | undefined;

  const result = await billingService.getBillsByUserId(userId, page, limit, status);

  const response: ApiResponse = {
    success: true,
    data: {
      bills: result.bills,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
        totalPages: Math.ceil(result.total / limit)
      }
    }
  };

  res.json(response);
});
export const payBill = asyncHandler(async (req: Request, res: Response) => {
  const { billId, paymentMethodId } = req.body;

  const success = await billingService.payBill(billId, paymentMethodId);

  if (!success) {
    const response: ApiResponse = {
      success: false,
      message: 'Bill not found or already paid'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    success: true,
    message: 'Bill paid successfully'
  };

  res.json(response);
});
export const getBillDetails = asyncHandler(async (req: Request, res: Response) => {
  const billId = req.params.billId;

  const bill = await billingService.getBillById(billId);

  if (!bill) {
    const response: ApiResponse = {
      success: false,
      message: 'Bill not found'
    };
    return res.status(404).json(response);
  }

  const response: ApiResponse = {
    success: true,
    data: bill
  };

  res.json(response);
});

