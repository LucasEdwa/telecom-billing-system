// ─── Branded Types ───────────────────────────────────────────────
// Nominal (branded) types prevent accidental mixing of plain numbers
// with monetary values at compile time. You cannot pass a raw `number`
// where a `Cents` or `Money` is expected without explicit conversion.
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Integer cents — the canonical representation for money in transit. */
export type Cents = Brand<number, 'Cents'>;

/** Decimal currency amount (e.g., 12.50). Only for display / API responses. */
export type Money = Brand<number, 'Money'>;

/** Strongly-typed user ID to prevent misuse of raw numbers. */
export type UserId = Brand<number, 'UserId'>;

/** Strongly-typed bill ID. */
export type BillId = Brand<number, 'BillId'>;

/** Service type union — exhaustive list of billable services. */
export type ServiceType = 'CALL' | 'SMS' | 'DATA';

/** Ledger entry type — exhaustive list of financial event types. */
export type LedgerType = 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';

// ─── API Types ───────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
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
  type: ServiceType;
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
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: Date;
}

export interface DeadLetterItem {
  id: number;
  sourceType: ServiceType | 'UNKNOWN';
  rawPayload: Record<string, unknown>;
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

/** Result of a ledger reconciliation check. */
export interface ReconciliationResult {
  userId: number;
  ledgerBalance: number;
  recomputedBalance: number;
  totalCharges: number;
  totalPayments: number;
  unpaidBillsTotal: number;
  isConsistent: boolean;
  discrepancy: number;
  checkedAt: Date;
}

/** Search filters for bills. */
export interface BillSearchFilters {
  userId?: number;
  status?: 'PAID' | 'UNPAID';
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}