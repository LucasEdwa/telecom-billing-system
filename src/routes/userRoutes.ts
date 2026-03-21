import express from 'express';
import { signup, login, getProfile } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { authRateLimit, validateApiKey } from '../middleware/security';
import { pool } from '../database/connection';
const router = express.Router();

function asyncHandler(fn: any) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * @swagger
 * /users/signup:
 *   post:
 *     tags: [Users]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: MyStr0ng!K3y#2026
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: user
 *               username:
 *                 type: string
 *                 example: johndoe
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: john@example.com
 */
// Auth endpoints with rate limiting
router.post('/signup', authRateLimit, asyncHandler(signup));

/**
 * @swagger
 * /users/login:
 *   post:
 *     tags: [Users]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: MyStr0ng!K3y#2026
 *     responses:
 *       200:
 *         description: Login successful - Returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         email:
 *                           type: string
 *                           example: john@example.com
 */
router.post('/login', authRateLimit, asyncHandler(login));

/**
 * @swagger
 * /users/profile/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get('/profile/:id', authenticate, asyncHandler(getProfile));

/**
 * @swagger
 * /users/db/tables:
 *   get:
 *     tags: [Users]
 *     summary: Get database tables (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of database tables
 */
// Admin endpoints with API key validation
router.get('/db/tables', authenticate, requireRole('admin'), validateApiKey, async (req, res, next) => {
  try {
    const [rows]: any = await pool.query('SHOW TABLES');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
