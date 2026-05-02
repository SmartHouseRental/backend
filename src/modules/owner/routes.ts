import { Router } from 'express';
import * as ownerController from './controller';
import {
  requireAuth,
  restrictTo,
} from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/owner/analytics:
 *   get:
 *     summary: Owner analytics dashboard
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics loaded
 */
router.get(
  '/analytics',
  requireAuth,
  restrictTo('owner'),
  ownerController.analytics
);

export default router;