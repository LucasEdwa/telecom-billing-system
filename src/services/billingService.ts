import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { BillCalculation, Bill, UsageDetail } from '../types';
import { dbError, billingError, notFoundError } from '../errors/AppError';

export class BillingService {
  async calculateBill(userId: string): Promise<BillCalculation> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get usage data
      const [logs]: any = await connection.query(
        `SELECT type, SUM(quantity) as total 
         FROM user_logs 
         WHERE user_id = ? AND DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
         GROUP BY type`,
        [userId]
      );

      // Get current rates
      const [rates]: any = await connection.query(
        'SELECT service, rate FROM service_rates'
      );

      const rateMap: Record<string, number> = {};
      rates.forEach((r: any) => (rateMap[r.service] = Number(r.rate)));

      // Calculate detailed billing
      const details: UsageDetail[] = logs.map((log: any) => {
        const rate = rateMap[log.type] || 0;
        const cost = Number(log.total) * rate;
        return {
          type: log.type,
          total: Number(log.total),
          rate,
          cost
        };
      });

      const total = details.reduce((sum, detail) => sum + detail.cost, 0);
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      await connection.commit();
      
      logger.info('Bill calculated successfully', { userId, total, detailsCount: details.length });

      return {
        userId,
        total,
        details,
        period: { start: periodStart, end: periodEnd }
      };
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error calculating bill', { userId, error });
      throw dbError(`Bill calculation failed: ${error.message}`, 'Calculate Bill');
    } finally {
      connection.release();
    }
  }

  async createBill(calculation: BillCalculation): Promise<number> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      if (calculation.total <= 0) {
        logger.info('No bill created - total is zero', { userId: calculation.userId });
        await connection.commit();
        return 0;
      }

      const [result]: any = await connection.query(
        `INSERT INTO bills (user_id, amount, period_start, period_end, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          calculation.userId,
          calculation.total.toFixed(2),
          calculation.period.start,
          calculation.period.end
        ]
      );

      await connection.commit();
      
      const billId = result.insertId;
      logger.info('Bill created successfully', { 
        billId, 
        userId: calculation.userId, 
        amount: calculation.total 
      });

      return billId;
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error creating bill', { userId: calculation.userId, error });
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
      logger.error('Error retrieving bills', { userId, error });
      throw dbError(`Failed to retrieve bills: ${error.message}`, 'Get Bills');
    }
  }

  async payBill(billId: string, paymentMethodId?: string): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if bill exists and is unpaid
      const [bills]: any = await connection.query(
        'SELECT * FROM bills WHERE id = ? AND status = "UNPAID"',
        [billId]
      );

      if (bills.length === 0) {
        throw notFoundError('Bill or already paid bill', 'Pay Bill');
      }

      const bill = bills[0];

      // Here you would integrate with payment processor (Stripe, etc.)
      // For now, we'll just mark as paid
      const [result]: any = await connection.query(
        'UPDATE bills SET status = "PAID", updated_at = NOW() WHERE id = ?',
        [billId]
      );

      await connection.commit();
      
      logger.info('Bill paid successfully', { 
        billId, 
        amount: bill.amount, 
        paymentMethodId 
      });

      return result.affectedRows > 0;
    } catch (error: any) {
      await connection.rollback();
      logger.error('Error paying bill', { billId, error });
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
      logger.error('Error retrieving bill', { billId, error });
      throw dbError(`Failed to retrieve bill: ${error.message}`, 'Get Bill');
    }
  }
}