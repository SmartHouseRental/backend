import { Router } from 'express';
import * as controller from './controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/support/faq:
 *   get:
 *     summary: Get FAQ list
 *     tags: [Support]
 *     responses:
 *       200:
 *         description: FAQ list
 */
router.get('/faq', controller.getFaq);

router.use(requireAuth);

/**
 * @swagger
 * /api/v1/support/tickets:
 *   post:
 *     summary: Create support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket created
 */
router.post('/tickets', controller.createTicket);

/**
 * @swagger
 * /api/v1/support/my-tickets:
 *   get:
 *     summary: Get my support tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket list
 */
router.get('/my-tickets', controller.getMyTickets);

export default router;