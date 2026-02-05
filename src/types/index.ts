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

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}