import { Request, Response } from 'express';
import { pool } from '../database/connection';
import { dbError, validationError } from '../errors/AppError';

export const updateRate = async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const { rate } = req.body;
    if (!rate || rate < 0) {
      throw validationError('Rate must be a positive number', 'Update Rate');
    }
    await pool.query(
      "INSERT INTO service_rates (service, rate) VALUES (?, ?) ON DUPLICATE KEY UPDATE rate = ?",
      [service, rate, rate]
    );
    res.json({ message: 'Rate updated' });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to update rate: ${error.message}`, 'Update Rate');
  }
};

export const getRates = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query("SELECT service, rate FROM service_rates");
    res.json(rows);
  } catch (error: any) {
    throw dbError(`Failed to get rates: ${error.message}`, 'Get Rates');
  }
};
