import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret } from 'jsonwebtoken';
import { pool } from '../database/connection';
import { validatePassword } from '../utils/validatePassword';
import { validationError, dbError, notFoundError, authError } from '../errors/AppError';

export const signup = async (req: Request, res: Response) => {
  try {
    const { username, email, password, accountType } = req.body;
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      throw validationError(`Password validation failed: ${passwordCheck.errors.join(', ')}`, 'User Registration');
    }
    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds for security
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
    
    // Input validation
    if (!email || !password) {
      throw validationError('Email and password are required', 'User Login');
    }
    
    // Check for account lockout (basic implementation)
    const clientIp = req.ip;
    const [attemptRows]: any = await pool.query(
      'SELECT COUNT(*) as attempts FROM login_attempts WHERE ip = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
      [clientIp]
    );
    
    if (attemptRows[0]?.attempts >= 5) {
      throw authError('Account temporarily locked due to too many failed attempts', 'User Login');
    }
    
    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failed attempt
      await pool.query(
        'INSERT INTO login_attempts (ip, email, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE attempts = attempts + 1, created_at = NOW()',
        [clientIp, email]
      );
      throw authError('Invalid email or password', 'User Login');
    }
    
    // Clear failed attempts on successful login
    await pool.query('DELETE FROM login_attempts WHERE ip = ? OR email = ?', [clientIp, email]);
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw dbError('JWT_SECRET is not configured', 'User Login');
    }
    
    const token = jwt.sign(
      { id: user.id, accountType: user.account_type }, 
      jwtSecret as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
    );
    
    res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        accountType: user.account_type
      }
    });
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
