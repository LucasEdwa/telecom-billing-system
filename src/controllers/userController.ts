import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { validatePassword } from '../utils/validatePassword';
import { validationError, dbError, notFoundError } from '../errors/AppError';

export const signup = async (req: Request, res: Response) => {
  try {
    const { username, email, password, accountType } = req.body;
    if (!validatePassword(password)) {
      throw validationError('Password must be at least 8 characters long, contain uppercase, lowercase, a digit, and a special character', 'User Registration');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, email, password, account_type) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, accountType || 'user']
    );
    res.status(201).json({ message: 'User registered' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw validationError('Email already exists', 'User Registration');
    }
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to create user: ${error.message}`, 'User Registration');
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw validationError('Invalid email or password', 'User Login');
    }
    const token = jwt.sign({ id: user.id, accountType: user.account_type }, process.env.JWT_SECRET!);
    res.json({ token });
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Login failed: ${error.message}`, 'User Login');
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const [rows]: any = await pool.query('SELECT id, username, email, account_type FROM users WHERE id = ?', [userId]);
    if (!rows[0]) {
      throw notFoundError('User', 'Get Profile');
    }
    res.json(rows[0]);
  } catch (error: any) {
    if (error.name === 'AppError') throw error;
    throw dbError(`Failed to get profile: ${error.message}`, 'Get Profile');
  }
};
