import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';

export const signup = async (req: Request, res: Response) => {
  const { username, email, password, accountType } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (username, email, password, account_type) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, accountType || 'user']
  );
  res.status(201).json({ message: 'User registered' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, accountType: user.account_type }, process.env.JWT_SECRET!);
  res.json({ token });
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const [rows]: any = await pool.query('SELECT id, username, email, account_type FROM users WHERE id = ?', [userId]);
  res.json(rows[0]);
};
