import express from 'express';
import { signup, login, getProfile } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { pool } from '../database/connection';
import { requireRole } from '../middleware/role';
const router = express.Router();


function asyncHandler(fn: any) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));
router.get('/profile/:id', authenticate, asyncHandler(getProfile));

router.get('/db/tables', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const [rows]: any = await pool.query('SHOW TABLES');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
