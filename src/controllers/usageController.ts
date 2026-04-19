import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { dbError, validationError } from '../errors/AppError';
import { v4 as uuidv4 } from 'uuid';
import { DeadLetterService } from '../services/deadLetterService';

const dlq = new DeadLetterService();

/**
 * Validates CDR payload and sends malformed records to the Dead Letter Queue.
 * Returns null if valid, or the validation error message if invalid.
 */
function validateCDR(
  body: Record<string, any>,
  requiredField: string,
  sourceType: 'CALL' | 'SMS' | 'DATA'
): string | null {
  if (!body.userId) return 'userId is required';
  if (typeof body.userId !== 'number' || !Number.isInteger(body.userId) || body.userId <= 0) {
    return 'userId must be a positive integer';
  }
  if (!body[requiredField]) return `${requiredField} is required`;
  if (typeof body[requiredField] !== 'number' || body[requiredField] <= 0) {
    return `${requiredField} must be a positive number`;
  }
  if (body.timestamp && isNaN(Date.parse(body.timestamp))) {
    return 'timestamp is not a valid date';  
  }
  return null;
}

/**
 * Inserts a usage log with idempotency protection.
 * If an idempotency_key is provided and already exists, the insert is skipped (no duplicate charges).
 * Returns true if a new row was inserted, false if it was a duplicate.
 */
async function insertUsageLog(
  userId: number,
  type: 'CALL' | 'SMS' | 'DATA',
  quantity: number,
  timestamp: Date,
  idempotencyKey?: string
): Promise<{ inserted: boolean; idempotencyKey: string }> {
  const key = idempotencyKey || uuidv4();

  const [result]: any = await pool.query(
    `INSERT IGNORE INTO user_logs (user_id, type, quantity, timestamp, idempotency_key) 
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, quantity, timestamp, key]
  );

  return { inserted: result.affectedRows > 0, idempotencyKey: key };
}

export const logCall = async (req: Request, res: Response) => {
  try {
    const error = validateCDR(req.body, 'duration', 'CALL');
    if (error) {
      await dlq.enqueue('CALL', req.body, error, 'VALIDATION_ERROR');
      throw validationError(error, 'Log Call');
    }

    const { userId, duration, timestamp, idempotencyKey } = req.body;

    const result = await insertUsageLog(
      userId,
      'CALL',
      duration,
      timestamp ? new Date(timestamp) : new Date(),
      idempotencyKey
    );

    if (!result.inserted) {
      res.status(200).json({ message: 'Duplicate request ignored', idempotencyKey: result.idempotencyKey });
      return;
    }

    res.status(201).json({ message: 'Call log saved', idempotencyKey: result.idempotencyKey });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    await dlq.enqueue('CALL', req.body, error.message, 'PROCESSING_ERROR');
    throw dbError(`Failed to log call: ${error.message}`, 'Log Call');
  }
};

export const logSMS = async (req: Request, res: Response) => {
  try {
    const error = validateCDR(req.body, 'count', 'SMS');
    if (error) {
      await dlq.enqueue('SMS', req.body, error, 'VALIDATION_ERROR');
      throw validationError(error, 'Log SMS');
    }

    const { userId, count, timestamp, idempotencyKey } = req.body;

    const result = await insertUsageLog(
      userId,
      'SMS',
      count,
      timestamp ? new Date(timestamp) : new Date(),
      idempotencyKey
    );

    if (!result.inserted) {
      res.status(200).json({ message: 'Duplicate request ignored', idempotencyKey: result.idempotencyKey });
      return;
    }

    res.status(201).json({ message: 'SMS log saved', idempotencyKey: result.idempotencyKey });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    await dlq.enqueue('SMS', req.body, error.message, 'PROCESSING_ERROR');
    throw dbError(`Failed to log SMS: ${error.message}`, 'Log SMS');
  }
};

export const logData = async (req: Request, res: Response) => {
  try {
    const error = validateCDR(req.body, 'mb', 'DATA');
    if (error) {
      await dlq.enqueue('DATA', req.body, error, 'VALIDATION_ERROR');
      throw validationError(error, 'Log Data');
    }

    const { userId, mb, timestamp, idempotencyKey } = req.body;

    const result = await insertUsageLog(
      userId,
      'DATA',
      mb,
      timestamp ? new Date(timestamp) : new Date(),
      idempotencyKey
    );

    if (!result.inserted) {
      res.status(200).json({ message: 'Duplicate request ignored', idempotencyKey: result.idempotencyKey });
      return;
    }

    res.status(201).json({ message: 'Data log saved', idempotencyKey: result.idempotencyKey });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    await dlq.enqueue('DATA', req.body, error.message, 'PROCESSING_ERROR');
    throw dbError(`Failed to log data usage: ${error.message}`, 'Log Data');
  }
};
