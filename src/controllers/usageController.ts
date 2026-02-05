import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { dbError, validationError } from '../errors/AppError';

export const logCall = async (req: Request, res: Response) => {
  try {
    const { userId, duration, timestamp } = req.body;
    if (!userId || !duration) {
      throw validationError('userId and duration are required', 'Log Call');
    }
    await pool.query(
      "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'CALL', ?, ?)",
      [userId, duration, timestamp ? new Date(timestamp) : new Date()]
    );
    res.status(201).json({ message: 'Call log saved' });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to log call: ${error.message}`, 'Log Call');
  }
};

export const logSMS = async (req: Request, res: Response) => {
  try {
    const { userId, count, timestamp } = req.body;
    if (!userId || !count) {
      throw validationError('userId and count are required', 'Log SMS');
    }
    await pool.query(
      "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'SMS', ?, ?)",
      [userId, count, timestamp ? new Date(timestamp) : new Date()]
    );
    res.status(201).json({ message: 'SMS log saved' });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to log SMS: ${error.message}`, 'Log SMS');
  }
};

export const logData = async (req: Request, res: Response) => {
  try {
    const { userId, mb, timestamp } = req.body;
    if (!userId || !mb) {
      throw validationError('userId and mb are required', 'Log Data');
    }
    await pool.query(
      "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'DATA', ?, ?)",
      [userId, mb, timestamp ? new Date(timestamp) : new Date()]
    );
    res.status(201).json({ message: 'Data log saved' });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to log data usage: ${error.message}`, 'Log Data');
  }
};
