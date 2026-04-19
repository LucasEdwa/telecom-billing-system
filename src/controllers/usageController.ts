import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { dbError, validationError } from '../errors/AppError';
import { v4 as uuidv4 } from 'uuid';

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
    const { userId, duration, timestamp, idempotencyKey } = req.body;
    if (!userId || !duration) {
      throw validationError('userId and duration are required', 'Log Call');
    }
    if (typeof duration !== 'number' || duration <= 0) {
      throw validationError('duration must be a positive number', 'Log Call');
    }

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
    throw dbError(`Failed to log call: ${error.message}`, 'Log Call');
  }
};

export const logSMS = async (req: Request, res: Response) => {
  try {
    const { userId, count, timestamp, idempotencyKey } = req.body;
    if (!userId || !count) {
      throw validationError('userId and count are required', 'Log SMS');
    }
    if (typeof count !== 'number' || count <= 0) {
      throw validationError('count must be a positive number', 'Log SMS');
    }

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
    throw dbError(`Failed to log SMS: ${error.message}`, 'Log SMS');
  }
};

export const logData = async (req: Request, res: Response) => {
  try {
    const { userId, mb, timestamp, idempotencyKey } = req.body;
    if (!userId || !mb) {
      throw validationError('userId and mb are required', 'Log Data');
    }
    if (typeof mb !== 'number' || mb <= 0) {
      throw validationError('mb must be a positive number', 'Log Data');
    }

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
    throw dbError(`Failed to log data usage: ${error.message}`, 'Log Data');
  }
};
