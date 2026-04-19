import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { DeadLetterItem } from '../types';
import { dbError } from '../errors/AppError';

/**
 * Dead Letter Queue Service
 * 
 * When a CDR (Call Detail Record) fails validation or processing,
 * it is NOT silently dropped. Instead, it's persisted to the DLQ 
 * for manual review or automated retry.
 * 
 * This is how production billing systems (Amdocs, Ericsson) handle
 * the reality that raw telecom data is messy.
 */
export class DeadLetterService {

  /**
   * Sends a failed CDR to the Dead Letter Queue.
   */
  async enqueue(
    sourceType: 'CALL' | 'SMS' | 'DATA' | 'UNKNOWN',
    rawPayload: Record<string, any>,
    errorMessage: string,
    errorCode?: string
  ): Promise<number> {
    try {
      const [result]: any = await pool.query(
        `INSERT INTO dead_letter_queue (source_type, raw_payload, error_message, error_code)
         VALUES (?, ?, ?, ?)`,
        [sourceType, JSON.stringify(rawPayload), errorMessage, errorCode || null]
      );

      logger.warn('CDR sent to Dead Letter Queue', {
        dlqId: result.insertId,
        sourceType,
        errorMessage,
        errorCode
      });

      return result.insertId;
    } catch (error: any) {
      // DLQ write failure is critical — log but don't crash the request
      logger.error('CRITICAL: Failed to write to Dead Letter Queue', {
        sourceType,
        rawPayload,
        error: error.message
      });
      return -1;
    }
  }

  /**
   * Retrieves pending DLQ items for admin review.
   */
  async getPending(
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: DeadLetterItem[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      const [countResult]: any = await pool.query(
        `SELECT COUNT(*) as total FROM dead_letter_queue WHERE status = 'PENDING'`
      );

      const [items]: any = await pool.query(
        `SELECT * FROM dead_letter_queue WHERE status = 'PENDING'
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return { items, total: countResult[0].total };
    } catch (error: any) {
      throw dbError(`Failed to retrieve DLQ items: ${error.message}`, 'Get DLQ');
    }
  }

  /**
   * Marks a DLQ item as resolved (after manual review).
   */
  async resolve(dlqId: number, resolvedBy: number): Promise<boolean> {
    try {
      const [result]: any = await pool.query(
        `UPDATE dead_letter_queue 
         SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = ?
         WHERE id = ? AND status = 'PENDING'`,
        [resolvedBy, dlqId]
      );
      return result.affectedRows > 0;
    } catch (error: any) {
      throw dbError(`Failed to resolve DLQ item: ${error.message}`, 'Resolve DLQ');
    }
  }

  /**
   * Discards a DLQ item (invalid data that should not be retried).
   */
  async discard(dlqId: number, resolvedBy: number): Promise<boolean> {
    try {
      const [result]: any = await pool.query(
        `UPDATE dead_letter_queue 
         SET status = 'DISCARDED', resolved_at = NOW(), resolved_by = ?
         WHERE id = ? AND status = 'PENDING'`,
        [resolvedBy, dlqId]
      );
      return result.affectedRows > 0;
    } catch (error: any) {
      throw dbError(`Failed to discard DLQ item: ${error.message}`, 'Discard DLQ');
    }
  }
}
