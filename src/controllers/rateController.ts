import { Request, Response } from 'express';
import { pool } from '../database/connection';

export const updateRate = async (req: Request, res: Response) => {
  const { service } = req.params;
  const { rate } = req.body;
  await pool.query(
    "INSERT INTO service_rates (service, rate) VALUES (?, ?) ON DUPLICATE KEY UPDATE rate = ?",
    [service, rate, rate]
  );
  res.json({ message: 'Rate updated' });
};

export const getRates = async (req: Request, res: Response) => {
  const [rows]: any = await pool.query("SELECT service, rate FROM service_rates");
  res.json(rows);
};
