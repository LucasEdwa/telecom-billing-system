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
    it('should calculate bill with correct decimal precision and return logIds', async () => {
      mockQuery
        .mockResolvedValueOnce([ // unbilled logs query — now returns individual rows with ids
          [
            { id: 1, type: 'CALL', quantity: '333.0000' },
            { id: 2, type: 'SMS', quantity: '1000.0000' },
            { id: 3, type: 'DATA', quantity: '2048.0000' },
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
      // Verify logIds are collected for atomic marking
      expect(result.logIds).toEqual([1, 2, 3]);

      const callDetail = result.details.find(d => d.type === 'CALL')!;
      expect(callDetail.cost).toBe(16.65);
      expect(callDetail.rate).toBe(0.05);
      expect(callDetail.total).toBe(333);

      const smsDetail = result.details.find(d => d.type === 'SMS')!;
      expect(smsDetail.cost).toBe(10.00);

      const dataDetail = result.details.find(d => d.type === 'DATA')!;
      expect(dataDetail.cost).toBe(204.80);
    });

    it('should only query unbilled CDRs (billed = FALSE)', async () => {
      mockQuery
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await service.calculateBill('1');

      // First query should contain billed = FALSE filter
      const logQuery = mockQuery.mock.calls[0][0];
      expect(logQuery).toContain('billed = FALSE');
    });

    it('should handle the classic 0.1 + 0.2 floating-point trap', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [
            { id: 10, type: 'CALL', quantity: '1.0000' },
            { id: 11, type: 'SMS', quantity: '1.0000' },
          ],
        ])
        .mockResolvedValueOnce([
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

    it('should handle zero usage (no unbilled logs)', async () => {
      mockQuery
        .mockResolvedValueOnce([[]])   // no unbilled usage logs
        .mockResolvedValueOnce([
          [{ service: 'CALL', rate: '0.05' }],
        ]);

      const result = await service.calculateBill('1');

      expect(result.total).toBe(0);
      expect(result.details).toHaveLength(0);
      expect(result.logIds).toEqual([]);
      expect(result.userId).toBe('1');
    });

    it('should handle missing rate for a service type gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1, type: 'CALL', quantity: '100.0000' }],
        ])
        .mockResolvedValueOnce([[]]);

      const result = await service.calculateBill('1');

      expect(result.details[0].cost).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle large quantities without precision loss', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1, type: 'DATA', quantity: '999999.9999' }],
        ])
        .mockResolvedValueOnce([
          [{ service: 'DATA', rate: '0.10' }],
        ]);

      const result = await service.calculateBill('1');

      expect(result.total).toBe(100000.00);
    });

    it('should aggregate multiple CDRs of the same type', async () => {
      // Simulate 3 separate call CDRs for the same user
      mockQuery
        .mockResolvedValueOnce([
          [
            { id: 1, type: 'CALL', quantity: '10.0000' },
            { id: 2, type: 'CALL', quantity: '20.0000' },
            { id: 3, type: 'CALL', quantity: '30.0000' },
          ],
        ])
        .mockResolvedValueOnce([
          [{ service: 'CALL', rate: '0.05' }],
        ]);

      const result = await service.calculateBill('1');

      // 60 * 0.05 = 3.00
      expect(result.total).toBe(3.00);
      expect(result.logIds).toEqual([1, 2, 3]);
      expect(result.details[0].total).toBe(60);
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

  describe('createBill (atomic: bill + mark CDRs + ledger)', () => {
    it('should create bill, mark CDRs, and write ledger CHARGE entry in one transaction', async () => {
      mockQuery
        .mockResolvedValueOnce([{ insertId: 42 }])          // INSERT bill
        .mockResolvedValueOnce([{ affectedRows: 3 }])        // UPDATE user_logs SET billed=TRUE
        .mockResolvedValueOnce([[{ balance: '0.0000' }]])     // SELECT balance for ledger
        .mockResolvedValueOnce([{ insertId: 1 }]);            // INSERT ledger entry

      const billId = await service.createBill({
        userId: '1',
        total: 25.50,
        details: [{ type: 'CALL', total: 100, rate: 0.255, cost: 25.50 }],
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        logIds: [1, 2, 3]
      });

      expect(billId).toBe(42);
      expect(mockCommit).toHaveBeenCalled();
      
      // Verify CDR marking was called
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE user_logs SET billed = TRUE');
      expect(updateCall[1]).toContain(42); // bill_id

      // Verify ledger entry was inserted
      const ledgerCall = mockQuery.mock.calls[3];
      expect(ledgerCall[0]).toContain('INSERT INTO ledger');
      expect(ledgerCall[1]).toContain('BILL-42'); // reference_id
    });

    it('should compute correct running balance in ledger', async () => {
      // Simulate existing balance of 50.00
      mockQuery
        .mockResolvedValueOnce([{ insertId: 10 }])           // INSERT bill
        .mockResolvedValueOnce([{ affectedRows: 1 }])        // UPDATE user_logs
        .mockResolvedValueOnce([[{ balance: '50.0000' }]])    // existing balance
        .mockResolvedValueOnce([{ insertId: 1 }]);            // INSERT ledger

      await service.createBill({
        userId: '1',
        total: 25.00,
        details: [],
        period: { start: new Date(), end: new Date() },
        logIds: [5]
      });

      // Ledger entry should show balance_after = 50 + 25 = 75
      const ledgerCall = mockQuery.mock.calls[3];
      const params = ledgerCall[1];
      expect(params).toContain('75.0000'); // balance_after
    });

    it('should return 0 for zero-amount bills (no charges)', async () => {
      const billId = await service.createBill({
        userId: '1',
        total: 0,
        details: [],
        period: { start: new Date(), end: new Date() },
        logIds: []
      });

      expect(billId).toBe(0);
      // Should NOT attempt any DB writes
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return 0 for negative total (guard against bad data)', async () => {
      const billId = await service.createBill({
        userId: '1',
        total: -5.00,
        details: [],
        period: { start: new Date(), end: new Date() },
        logIds: []
      });

      expect(billId).toBe(0);
    });

    it('should rollback ALL changes if any step fails', async () => {
      mockQuery
        .mockResolvedValueOnce([{ insertId: 10 }])    // INSERT bill OK
        .mockRejectedValueOnce(new Error('deadlock')); // UPDATE CDRs FAILS

      await expect(service.createBill({
        userId: '1',
        total: 10.00,
        details: [],
        period: { start: new Date(), end: new Date() },
        logIds: [1]
      })).rejects.toThrow('Bill creation failed');

      expect(mockRollback).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should skip CDR marking when logIds is empty', async () => {
      mockQuery
        .mockResolvedValueOnce([{ insertId: 99 }])          // INSERT bill
        .mockResolvedValueOnce([[{ balance: '0.0000' }]])    // SELECT balance
        .mockResolvedValueOnce([{ insertId: 1 }]);            // INSERT ledger

      await service.createBill({
        userId: '1',
        total: 5.00,
        details: [],
        period: { start: new Date(), end: new Date() },
        logIds: []
      });

      // Should NOT have called UPDATE user_logs (only 3 calls: bill, balance, ledger)
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should store amount with 2 decimal places', async () => {
      mockQuery
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([[{ balance: '0.0000' }]])
        .mockResolvedValueOnce([{ insertId: 1 }]);

      await service.createBill({
        userId: '1',
        total: 25.505,
        details: [],
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        logIds: []
      });

      const queryCall = mockQuery.mock.calls[0];
      const params = queryCall[1];
      // Banker's Rounding: 25.505 → 25.50 (rounds to even)
      expect(params[1]).toBe('25.50');
    });
  });

  describe('payBill (with ledger PAYMENT entry)', () => {
    it('should mark bill as paid and write PAYMENT ledger entry', async () => {
      mockQuery
        .mockResolvedValueOnce([ // SELECT bill FOR UPDATE
          [{ id: 1, user_id: '1', amount: '25.50', status: 'UNPAID' }],
        ])
        .mockResolvedValueOnce([ // UPDATE bill status
          { affectedRows: 1 },
        ])
        .mockResolvedValueOnce([ // SELECT balance
          [{ balance: '25.5000' }]
        ])
        .mockResolvedValueOnce([ // INSERT ledger PAYMENT
          { insertId: 1 }
        ]);

      const result = await service.payBill('1');

      expect(result).toBe(true);
      expect(mockCommit).toHaveBeenCalled();

      // Ledger entry should be a PAYMENT
      const ledgerCall = mockQuery.mock.calls[3];
      expect(ledgerCall[0]).toContain('INSERT INTO ledger');
      expect(ledgerCall[1]).toContain('PAY-1');
    });

    it('should compute correct balance after payment (balance decreases)', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 5, user_id: '1', amount: '30.00', status: 'UNPAID' }],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ balance: '100.0000' }]])  // owes 100
        .mockResolvedValueOnce([{ insertId: 1 }]);

      await service.payBill('5');

      // balance_after = 100 - 30 = 70
      const ledgerParams = mockQuery.mock.calls[3][1];
      expect(ledgerParams).toContain('70.0000');
    });

    it('should use SELECT FOR UPDATE to prevent race conditions', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1, user_id: '1', amount: '10.00', status: 'UNPAID' }],
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ balance: '10.0000' }]])
        .mockResolvedValueOnce([{ insertId: 1 }]);

      await service.payBill('1');

      const selectCall = mockQuery.mock.calls[0][0];
      expect(selectCall).toContain('FOR UPDATE');
    });

    it('should throw if bill is already paid or not found', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      await expect(service.payBill('999')).rejects.toThrow('not found');
    });

    it('should rollback on payment error', async () => {
      mockQuery
        .mockResolvedValueOnce([
          [{ id: 1, user_id: '1', amount: '25.50', status: 'UNPAID' }],
        ])
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.payBill('1')).rejects.toThrow();
      expect(mockRollback).toHaveBeenCalled();
    });
  });

  describe('getBillsByUserId', () => {
    it('should return paginated bills', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 25 }]])
        .mockResolvedValueOnce([
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

  describe('getLedger (audit trail)', () => {
    it('should return paginated ledger entries with current balance', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 3 }]])              // COUNT
        .mockResolvedValueOnce([                               // SELECT entries
          [
            { id: 1, type: 'CHARGE', amount: '50.00', balance_after: '50.00' },
            { id: 2, type: 'PAYMENT', amount: '50.00', balance_after: '0.00' },
          ],
        ])
        .mockResolvedValueOnce([[{ balance: '0.0000' }]]);    // current balance

      const result = await service.getLedger('1', 1, 50);

      expect(result.total).toBe(3);
      expect(result.entries).toHaveLength(2);
      expect(result.currentBalance).toBe(0);
    });
  });
});

describe('Banker\'s Rounding (ROUND_HALF_EVEN)', () => {
  beforeEach(() => {
    // Ensure Banker's Rounding is configured
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });
  });

  it('should round 2.5 to 2 (rounds to even)', () => {
    expect(new Decimal('2.5').toDecimalPlaces(0).toNumber()).toBe(2);
  });

  it('should round 3.5 to 4 (rounds to even)', () => {
    expect(new Decimal('3.5').toDecimalPlaces(0).toNumber()).toBe(4);
  });

  it('should round 2.25 to 2.2 (rounds to even)', () => {
    expect(new Decimal('2.25').toDecimalPlaces(1).toNumber()).toBe(2.2);
  });

  it('should round 2.35 to 2.4 (rounds to even)', () => {
    expect(new Decimal('2.35').toDecimalPlaces(1).toNumber()).toBe(2.4);
  });

  it('should round 10.555 to 10.56 (Banker\'s: 5 rounds to even 6)', () => {
    expect(new Decimal('10.555').toDecimalPlaces(2).toNumber()).toBe(10.56);
  });

  it('should round 10.545 to 10.54 (Banker\'s: 5 rounds to even 4)', () => {
    expect(new Decimal('10.545').toDecimalPlaces(2).toNumber()).toBe(10.54);
  });

  it('should eliminate systematic rounding bias over many operations', () => {
    // Sum items that would systematically round UP with ROUND_HALF_UP
    // but cancel out with Banker's Rounding
    const values = ['0.005', '0.015', '0.025', '0.035', '0.045', '0.055', '0.065', '0.075', '0.085', '0.095'];
    const sum = values.reduce(
      (acc, v) => acc.plus(new Decimal(v).toDecimalPlaces(2)),
      new Decimal(0)
    );
    // With ROUND_HALF_UP: all .5 round up → 0.01+0.02+0.03+0.04+0.05+0.06+0.07+0.08+0.09+0.10 = 0.55
    // With Banker's:       even rounds down → 0.00+0.02+0.02+0.04+0.04+0.06+0.06+0.08+0.08+0.10 = 0.50
    expect(sum.toNumber()).toBe(0.50);
  });

  it('should handle precise addition: 0.1 + 0.2 = 0.3', () => {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    expect(a.plus(b).toNumber()).toBe(0.3);
  });

  it('should handle precise multiplication of rates', () => {
    const quantity = new Decimal('333');
    const rate = new Decimal('0.05');
    expect(quantity.mul(rate).toNumber()).toBe(16.65);
  });

  it('should handle very small amounts without underflow', () => {
    const rate = new Decimal('0.001');
    const qty = new Decimal('1');
    expect(rate.mul(qty).toDecimalPlaces(2).toNumber()).toBe(0.00);
  });
});
