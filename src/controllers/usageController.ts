import { Request, Response } from 'express';
import { pool } from '../database/connection';

export const logCall = async (req: Request, res: Response) => {
  const { userId, duration, timestamp } = req.body;
  await pool.query(
    "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'CALL', ?, ?)",
    [userId, duration, timestamp ? new Date(timestamp) : new Date()]
  );
  res.status(201).json({ message: 'Call log saved' });
};

export const logSMS = async (req: Request, res: Response) => {
  const { userId, count, timestamp } = req.body;
  await pool.query(
    "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'SMS', ?, ?)",
    [userId, count, timestamp ? new Date(timestamp) : new Date()]
  );
  res.status(201).json({ message: 'SMS log saved' });
};

export const logData = async (req: Request, res: Response) => {
  const { userId, mb, timestamp } = req.body;
  await pool.query(
    "INSERT INTO user_logs (user_id, type, quantity, timestamp) VALUES (?, 'DATA', ?, ?)",
    [userId, mb, timestamp ? new Date(timestamp) : new Date()]
  );
  res.status(201).json({ message: 'Data log saved' });
};
