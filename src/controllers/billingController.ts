import { Request, Response } from 'express';
import { BillingService } from '../services/billingService';
import { DeadLetterService } from '../services/deadLetterService';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const billingService = new BillingService();
const dlqService = new DeadLetterService();

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

// ─── Ledger (Audit Trail) ──────────────────────────────────────────────────

export const getLedger = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const result = await billingService.getLedger(userId, page, limit);

  const response: ApiResponse = {
    success: true,
    data: {
      entries: result.entries,
      currentBalance: result.currentBalance,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    }
  };

  res.json(response);
});

// ─── Dead Letter Queue (Admin) ─────────────────────────────────────────────

export const getDLQ = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const result = await dlqService.getPending(page, limit);

  const response: ApiResponse = {
    success: true,
    data: {
      items: result.items,
      pagination: { page, limit, total: result.total }
    }
  };

  res.json(response);
});

export const resolveDLQ = asyncHandler(async (req: Request, res: Response) => {
  const dlqId = parseInt(req.params.dlqId);
  const adminId = (req as any).user?.id;

  const resolved = await dlqService.resolve(dlqId, adminId);

  res.json({
    success: resolved,
    message: resolved ? 'DLQ item resolved' : 'DLQ item not found or already resolved'
  });
});

export const discardDLQ = asyncHandler(async (req: Request, res: Response) => {
  const dlqId = parseInt(req.params.dlqId);
  const adminId = (req as any).user?.id;

  const discarded = await dlqService.discard(dlqId, adminId);

  res.json({
    success: discarded,
    message: discarded ? 'DLQ item discarded' : 'DLQ item not found or already handled'
  });
});

// ─── Reconciliation (Integrity Verification) ───────────────────────────────

export const reconcile = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);

  const result = await billingService.reconcileLedger(userId);

  const response: ApiResponse = {
    success: true,
    data: result,
    message: result.isConsistent
      ? 'Ledger is consistent — every cent accounted for'
      : 'DISCREPANCY DETECTED — manual audit required'
  };

  res.status(result.isConsistent ? 200 : 409).json(response);
});

// ─── Bill Search ────────────────────────────────────────────────────────────

export const searchBills = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const filters = {
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    status: req.query.status as 'PAID' | 'UNPAID' | undefined,
    minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
    maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const result = await billingService.searchBills(filters, page, limit);

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
