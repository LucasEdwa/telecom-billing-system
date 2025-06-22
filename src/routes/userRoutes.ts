import express from 'express';
import { signup, login, getProfile } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
const router = express.Router();

// Helper to wrap async route handlers and handle errors
function asyncHandler(fn: any) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));
router.get('/:id', authenticate, asyncHandler(getProfile));

export default router;
