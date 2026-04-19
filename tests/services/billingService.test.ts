import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Decimal from 'decimal.js';

// Mock the database pool before importing the service
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockBeginTransaction = jest.fn();
const mockCommit = jest.fn();
const mockRollback = jest.fn();

const mockConnection = {
  query: mockQuery,
  release: mockRelease,
  beginTransaction: mockBeginTransaction,
  commit: mockCommit,
  rollback: mockRollback,
};

jest.mock('../../src/database/connection', () => ({
  pool: {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    query: mockQuery,
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { BillingService } from '../../src/services/billingService';

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService();
    jest.clearAllMocks();
  });

  describe('calculateBill', () => {
    it('should calculate bill with correct decimal precision', async () => {
      // Simulate usage: 333 minutes of calls, 1000 SMS, 2048 MB data
      mockQuery
        .mockResolvedValueOnce([ // logs query
          [
            { type: 'CALL', total: '333.0000' },
            { type: 'SMS', total: '1000.0000' },
            { type: 'DATA', total: '2048.0000' },
          ],
        ])
        .mockResolvedValueOnce([ // rates query
          [
            { service: 'CALL', rate: '0.05' },
            { service: 'SMS', rate: '0.01' },
            { service: 'DATA', rate: '0.10' },
          ],
        ]);

      const result = await service.calculateBill('1');

      // Verify decimal precision: 333*0.05=16.65, 1000*0.01=10.00, 2048*0.10=204.80
      expect(result.total).toBe(231.45);
      expect(result.details).toHaveLength(3);

      const callDetail = result.details.find(d => d.type === 'CALL')!;
      expect(callDetail.cost).toBe(16.65);
      expect(callDetail.rate).toBe(0.05);
      expect(callDetail.total).toBe(333);

      const smsDetail = result.details.find(d => d.type === 'SMS')!;
      expect(smsDetail.cost).toBe(10.00);

      const dataDetail = result.details.find(d => d.type === 'DATA')!;
      expect(dataDetail.cost).toBe(204.80);
    });

    it('should handle the classic 0.1 + 0.2 floating-point trap', async () => {
      // This is the key test: ensure we DON'T get 0.30000000000000004
      mockQuery
        .mockResolvedValueOnce([ // logs
          [
            { type: 'CALL', total: '1.0000' },
            { type: 'SMS', total: '1.0000' },
          ],
        ])
        .mockResolvedValueOnce([ // rates
          [
            { service: 'CALL', rate: '0.10' },
            { service: 'SMS', rate: '0.20' },
          ],
        ]);

      const result = await service.calculateBill('1');

      // With floating-point: 0.1 + 0.2 = 0.30000000000000004
      // With Decimal.js: 0.1 + 0.2 = 0.30
      expect(result.total).toBe(0.30);
      expect(result.total).not.toBe(0.30000000000000004);
    });

    it('should handle zero usage (no logs)', async () => {
      mockQuery
        .mockResolvedValueOnce([[]])   // no usage logs
        .mockResolvedValueOnce([       // rates still exist
          [
            { service: 'CALL', rate: '0.05' },
          ],
        ]);

      const result = await service.calculateBill('1');

      expect(result.total).toBe(0);
      expect(result.details).toHaveLength(0);
      expect(result.userId).toBe('1');
    });

    it('should handle missing rate for a service type gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ type: 'CALL', total: '100.0000' }],
        ])
        .mockResolvedValueOnce([ // no rates configured at all
          [],
        ]);

      const result = await service.calculateBill('1');

      // No rate found, cost should be 0
      expect(result.details[0].cost).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle large quantities without precision loss', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ type: 'DATA', total: '999999.9999' }],
        ])
        .mockResolvedValueOnce([
          [{ service: 'DATA', rate: '0.10' }],
        ]);

      const result = await service.calculateBill('1');

      // 999999.9999 * 0.10 = 100000.00 (rounded to 2dp)
      expect(result.total).toBe(100000.00);
    });

    it('should rollback transaction on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(service.calculateBill('1')).rejects.toThrow('Bill calculation failed');
      expect(mockRollback).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should always release connection even on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));

      await expect(service.calculateBill('1')).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe('createBill', () => {
    it('should create a bill and return the bill ID', async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 42 }]);

      const billId = await service.createBill({
        userId: '1',
        total: 25.50,
        details: [],
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
      });

      expect(billId).toBe(42);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('should return 0 for zero-amount bills (no charges)', async () => {
      const billId = await service.createBill({
        userId: '1',
        total: 0,
        details: [],
        period: { start: new Date(), end: new Date() },
      });

      expect(billId).toBe(0);
    });

    it('should return 0 for negative total (guard against bad data)', async () => {
      const billId = await service.createBill({
        userId: '1',
        total: -5.00,
        details: [],
        period: { start: new Date(), end: new Date() },
      });

      expect(billId).toBe(0);
    });

    it('should store amount with 2 decimal places', async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);

      await service.createBill({
        userId: '1',
        total: 25.505, // should be stored as "25.51" or "25.50" depending on rounding
        details: [],
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
      });

      // Verify the amount parameter passed to the query
      const queryCall = mockQuery.mock.calls[0];
      const params = queryCall[1];
      expect(params[1]).toBe('25.50'); // toFixed(2) rounds
    });
  });

  describe('payBill', () => {
    it('should mark an unpaid bill as paid', async () => {
      mockQuery
        .mockResolvedValueOnce([ // SELECT bill
          [{ id: 1, amount: '25.50', status: 'UNPAID' }],
        ])
        .mockResolvedValueOnce([ // UPDATE
          { affectedRows: 1 },
        ]);

      const result = await service.payBill('1');

      expect(result).toBe(true);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('should throw if bill is already paid or not found', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      await expect(service.payBill('999')).rejects.toThrow('not found');
    });

    it('should rollback on payment error', async () => {
      mockQuery
        .mockResolvedValueOnce([ // SELECT bill OK
          [{ id: 1, amount: '25.50', status: 'UNPAID' }],
        ])
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.payBill('1')).rejects.toThrow();
      expect(mockRollback).toHaveBeenCalled();
    });
  });

  describe('getBillsByUserId', () => {
    it('should return paginated bills', async () => {
      mockQuery
        .mockResolvedValueOnce([ // COUNT query
          [{ total: 25 }],
        ])
        .mockResolvedValueOnce([ // SELECT query
          [
            { id: 1, amount: '10.00', status: 'UNPAID' },
            { id: 2, amount: '20.00', status: 'PAID' },
          ],
        ]);

      const result = await service.getBillsByUserId('1', 1, 10);

      expect(result.total).toBe(25);
      expect(result.bills).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by status when provided', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 5 }]])
        .mockResolvedValueOnce([
          [{ id: 1, amount: '10.00', status: 'UNPAID' }],
        ]);

      const result = await service.getBillsByUserId('1', 1, 10, 'UNPAID');

      // Verify the WHERE clause includes status
      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain('status');
      expect(result.bills).toHaveLength(1);
    });

    it('should indicate no more pages when all results are returned', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 2 }]])
        .mockResolvedValueOnce([
          [
            { id: 1, amount: '10.00' },
            { id: 2, amount: '20.00' },
          ],
        ]);

      const result = await service.getBillsByUserId('1', 1, 10);

      expect(result.hasMore).toBe(false);
    });
  });
});

describe('Decimal.js monetary precision', () => {
  it('should handle precise addition: 0.1 + 0.2 = 0.3', () => {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    expect(a.plus(b).toNumber()).toBe(0.3);
  });

  it('should handle precise multiplication of rates', () => {
    // 333 minutes * $0.05/min = $16.65 exactly
    const quantity = new Decimal('333');
    const rate = new Decimal('0.05');
    expect(quantity.mul(rate).toNumber()).toBe(16.65);
  });

  it('should round correctly to 2 decimal places', () => {
    const cost = new Decimal('10.555');
    expect(cost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()).toBe(10.56);
  });

  it('should handle very small amounts without underflow', () => {
    const rate = new Decimal('0.001');
    const qty = new Decimal('1');
    expect(rate.mul(qty).toDecimalPlaces(2).toNumber()).toBe(0.00);
  });
});
