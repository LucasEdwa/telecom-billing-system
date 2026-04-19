import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { BillCalculation, Bill, UsageDetail, LedgerEntry } from '../types';
import { dbError, billingError, notFoundError } from '../errors/AppError';
import Decimal from 'decimal.js';

// Banker's Rounding (ROUND_HALF_EVEN) — the financial industry standard.
// In standard rounding, 0.5 always rounds up, which introduces a systematic bias.
// Banker's Rounding rounds 0.5 to the nearest EVEN digit, eliminating aggregate bias.
// e.g., 2.5 → 2, 3.5 → 4, 4.5 → 4, 5.5 → 6
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export class BillingService {

  /**
   * Calculates a bill for a user based on UNBILLED CDRs only.
   * 
   * Key design decisions:
   * - Uses `billed = FALSE` filter to prevent double-billing on re-runs (idempotent billing)
   * - Collects individual log IDs for atomic marking in createBill()
   * - Handles cross-month calls: a CDR is billed based on its timestamp, regardless of
   *   whether the call started in a previous month. The full CDR is attributed to
   *   the month in which it was recorded.
   * - Uses Banker's Rounding (ROUND_HALF_EVEN) for financial precision.
   */
  async calculateBill(userId: string): Promise<BillCalculation> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Only bill CDRs that haven't been billed yet — prevents double-billing
      // on crash/retry. Cross-month CDRs are included if they fall in-range.
      const [logs]: any = await connection.query(
        `SELECT id, type, quantity
         FROM user_logs 
         WHERE user_id = ? 
           AND billed = FALSE
           AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`,
        [userId, periodStart, periodEnd]
      );

      // Get current rates
      const [rates]: any = await connection.query(
        'SELECT service, rate FROM service_rates'
      );

      const rateMap: Record<string, Decimal> = {};
      rates.forEach((r: any) => (rateMap[r.service] = new Decimal(r.rate)));

      // Collect log IDs for atomic marking
      const logIds: number[] = logs.map((l: any) => l.id);

      // Aggregate quantities per type
      const aggregation: Record<string, Decimal> = {};
      for (const log of logs) {
        const type = log.type as string;
        const qty = new Decimal(log.quantity);
        aggregation[type] = (aggregation[type] || new Decimal(0)).plus(qty);
      }

      // Calculate detailed billing using Banker's Rounding
      const details: UsageDetail[] = Object.entries(aggregation).map(([type, totalQty]) => {
        const rate = rateMap[type] || new Decimal(0);
        const cost = totalQty.mul(rate).toDecimalPlaces(2);
        return {
          type: type as UsageDetail['type'],
          total: totalQty.toNumber(),
          rate: rate.toNumber(),
          cost: cost.toNumber()
        };
      });

      const total = details.reduce(
        (sum, detail) => sum.plus(new Decimal(detail.cost)),
        new Decimal(0)
      ).toDecimalPlaces(2).toNumber();

      await connection.commit();
      
      logger.info('Bill calculated successfully', { userId, total, detailsCount: details.length, cdrCount: logIds.length });

      return {
        userId,
        total,
        details,
        period: { start: periodStart, end: periodEnd },
        logIds
      };
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error calculating bill', { userId, error: error.message });
      throw dbError(`Bill calculation failed: ${error.message}`, 'Calculate Bill');
    } finally {
      connection.release();
    }
  }

  /**
   * Creates a bill, marks all included CDRs as billed, and writes a ledger entry.
   * 
   * This is ATOMIC: if any step fails, the entire operation rolls back.
   * - Bill INSERT
   * - CDR mark as billed (UPDATE user_logs SET billed = TRUE, bill_id = ?)
   * - Ledger CHARGE entry
   * 
   * If the system crashes after calculateBill() but before createBill() commits,
   * the CDRs remain unbilled and will be picked up on the next run.
   */
  async createBill(calculation: BillCalculation): Promise<number> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      if (calculation.total <= 0) {
        logger.info('No bill created - total is zero', { userId: calculation.userId });
        await connection.commit();
        return 0;
      }

      // 1. Create the bill
      const amount = new Decimal(calculation.total).toDecimalPlaces(2).toFixed(2);
      const [result]: any = await connection.query(
        `INSERT INTO bills (user_id, amount, period_start, period_end, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [calculation.userId, amount, calculation.period.start, calculation.period.end]
      );
      const billId = result.insertId;

      // 2. Atomically mark all CDRs as billed — prevents double-billing on re-runs
      if (calculation.logIds.length > 0) {
        await connection.query(
          `UPDATE user_logs SET billed = TRUE, bill_id = ? WHERE id IN (?)`,
          [billId, calculation.logIds]
        );
      }

      // 3. Write immutable ledger entry — audit trail for every cent
      const [balanceResult]: any = await connection.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'CHARGE' THEN amount WHEN type IN ('PAYMENT','REFUND') THEN -amount ELSE 0 END), 0) as balance
         FROM ledger WHERE user_id = ?`,
        [calculation.userId]
      );
      const previousBalance = new Decimal(balanceResult[0].balance);
      const newBalance = previousBalance.plus(new Decimal(amount));

      await connection.query(
        `INSERT INTO ledger (user_id, bill_id, type, amount, balance_after, description, reference_id)
         VALUES (?, ?, 'CHARGE', ?, ?, ?, ?)`,
        [
          calculation.userId,
          billId,
          amount,
          newBalance.toDecimalPlaces(4).toFixed(4),
          `Bill #${billId}: ${calculation.details.map(d => `${d.type}=$${d.cost.toFixed(2)}`).join(', ')}`,
          `BILL-${billId}`
        ]
      );

      await connection.commit();
      
      logger.info('Bill created with ledger entry', { 
        billId, 
        userId: calculation.userId, 
        amount,
        cdrsMarked: calculation.logIds.length,
        balanceAfter: newBalance.toNumber()
      });

      return billId;
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error creating bill', { userId: calculation.userId, error: error.message });
      throw dbError(`Bill creation failed: ${error.message}`, 'Create Bill');
    } finally {
      connection.release();
    }
  }

  async getBillsByUserId(
    userId: string, 
    page: number = 1, 
    limit: number = 10,
    status?: 'PAID' | 'UNPAID'
  ): Promise<{ bills: Bill[], total: number, hasMore: boolean }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE user_id = ?';
      let params: any[] = [userId];

      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      // Get total count
      const [countResult]: any = await pool.query(
        `SELECT COUNT(*) as total FROM bills ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // Get bills
      const [bills]: any = await pool.query(
        `SELECT * FROM bills ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const hasMore = offset + bills.length < total;

      logger.info('Bills retrieved successfully', { 
        userId, page, limit, status, count: bills.length, total 
      });

      return { bills, total, hasMore };
    } catch (error: any) {
      logger.error('Error retrieving bills', { userId, error: error.message });
      throw dbError(`Failed to retrieve bills: ${error.message}`, 'Get Bills');
    }
  }

  /**
   * Pays a bill and writes a PAYMENT ledger entry.
   * Atomic: both the status update and ledger write succeed or both fail.
   */
  async payBill(billId: string, paymentMethodId?: string): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Lock the row with FOR UPDATE to prevent race conditions
      const [bills]: any = await connection.query(
        'SELECT * FROM bills WHERE id = ? AND status = "UNPAID" FOR UPDATE',
        [billId]
      );

      if (bills.length === 0) {
        throw notFoundError('Bill or already paid bill', 'Pay Bill');
      }

      const bill = bills[0];
      const amount = new Decimal(bill.amount);

      // Mark as paid
      const [result]: any = await connection.query(
        'UPDATE bills SET status = "PAID", updated_at = NOW() WHERE id = ?',
        [billId]
      );

      // Write PAYMENT ledger entry
      const [balanceResult]: any = await connection.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'CHARGE' THEN amount WHEN type IN ('PAYMENT','REFUND') THEN -amount ELSE 0 END), 0) as balance
         FROM ledger WHERE user_id = ?`,
        [bill.user_id]
      );
      const previousBalance = new Decimal(balanceResult[0].balance);
      const newBalance = previousBalance.minus(amount);

      await connection.query(
        `INSERT INTO ledger (user_id, bill_id, type, amount, balance_after, description, reference_id)
         VALUES (?, ?, 'PAYMENT', ?, ?, ?, ?)`,
        [
          bill.user_id,
          billId,
          amount.toDecimalPlaces(4).toFixed(4),
          newBalance.toDecimalPlaces(4).toFixed(4),
          `Payment for Bill #${billId}${paymentMethodId ? ` via ${paymentMethodId}` : ''}`,
          `PAY-${billId}`
        ]
      );

      await connection.commit();
      
      logger.info('Bill paid with ledger entry', { 
        billId, 
        amount: bill.amount, 
        paymentMethodId,
        balanceAfter: newBalance.toNumber()
      });

      return result.affectedRows > 0;
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error paying bill', { billId, error: error.message });
      if (error.name === 'AppError') throw error;
      throw dbError(`Payment processing failed: ${error.message}`, 'Pay Bill');
    } finally {
      connection.release();
    }
  }

  async getBillById(billId: string): Promise<Bill | null> {
    try {
      const [bills]: any = await pool.query(
        'SELECT * FROM bills WHERE id = ?',
        [billId]
      );

      if (bills.length === 0) {
        return null;
      }

      logger.info('Bill retrieved successfully', { billId });
      return bills[0];
    } catch (error: any) {
      logger.error('Error retrieving bill', { billId, error: error.message });
      throw dbError(`Failed to retrieve bill: ${error.message}`, 'Get Bill');
    }
  }

  /**
   * Returns the full immutable ledger for a user.
   * Every charge, payment, adjustment, and refund is recorded here.
   */
  async getLedger(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ entries: LedgerEntry[], total: number, currentBalance: number }> {
    try {
      const offset = (page - 1) * limit;

      const [countResult]: any = await pool.query(
        'SELECT COUNT(*) as total FROM ledger WHERE user_id = ?',
        [userId]
      );
      const total = countResult[0].total;

      const [entries]: any = await pool.query(
        `SELECT * FROM ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      const [balanceResult]: any = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'CHARGE' THEN amount WHEN type IN ('PAYMENT','REFUND') THEN -amount ELSE 0 END), 0) as balance
         FROM ledger WHERE user_id = ?`,
        [userId]
      );

      return {
        entries,
        total,
        currentBalance: new Decimal(balanceResult[0].balance).toDecimalPlaces(2).toNumber()
      };
    } catch (error: any) {
      logger.error('Error retrieving ledger', { userId, error: error.message });
      throw dbError(`Failed to retrieve ledger: ${error.message}`, 'Get Ledger');
    }
  }
}