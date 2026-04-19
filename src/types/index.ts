// Common types and interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface BillCalculation {
  userId: string;
  total: number;
  details: UsageDetail[];
  period: {
    start: Date;
    end: Date;
  };
  logIds: number[]; // IDs of CDRs included in this bill (for atomic marking)
}

export interface UsageDetail {
  type: 'CALL' | 'SMS' | 'DATA';
  total: number;
  rate: number;
  cost: number;
}

export interface Bill {
  id: number;
  userId: number;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  status: 'PAID' | 'UNPAID';
  createdAt: Date;
  updatedAt?: Date;
}

export interface LedgerEntry {
  id: number;
  userId: number;
  billId?: number;
  type: 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: Date;
}

export interface DeadLetterItem {
  id: number;
  sourceType: 'CALL' | 'SMS' | 'DATA' | 'UNKNOWN';
  rawPayload: Record<string, any>;
  errorMessage: string;
  errorCode?: string;
  retryCount: number;
  status: 'PENDING' | 'RETRIED' | 'RESOLVED' | 'DISCARDED';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}