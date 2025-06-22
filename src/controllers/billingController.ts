import { Request, Response } from 'express';
import { pool } from '../database/connection';

export const generateBill = async (req: Request, res: Response) => {
  const userId = req.params.userId;
  // Get usage
  const [logs]: any = await pool.query(
    "SELECT type, SUM(quantity) as total FROM user_logs WHERE user_id = ? GROUP BY type",
    [userId]
  );
  // Get rates
  const [rates]: any = await pool.query("SELECT service, rate FROM service_rates");
  const rateMap: Record<string, number> = {};
  rates.forEach((r: any) => (rateMap[r.service] = Number(r.rate)));

  // Calculate total
  let total = 0;
  logs.forEach((log: any) => {
    total += Number(log.total) * (rateMap[log.type] || 0);
  });

  // Debug: Check if insert is being called
  console.log('Calculated total:', total);

  // Insert bill into bills table only if total > 0
  if (total > 0) {
    const periodStart = new Date(); // You may want to set real billing period logic
    const periodEnd = new Date();
    const [result]: any = await pool.query(
      "INSERT INTO bills (user_id, amount, period_start, period_end, created_at) VALUES (?, ?, ?, ?, NOW())",
      [userId, total, periodStart, periodEnd]
    );
    console.log('Insert result:', result);
  } else {
    console.log('No bill inserted, total is 0');
  }

  res.json({ userId, total, details: logs });
};
