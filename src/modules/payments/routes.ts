import { Router } from 'express';
import express from 'express';
import * as paymentController from './controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { memoryUpload } from '../../middlewares/multer.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/payments/webhook:
 *   post:
 *     summary: Stripe webhook endpoint for processing payment events
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Webhook Error
 */
router.post('/webhook', paymentController.stripeWebhook);

// Protected routes
router.use(requireAuth);

/**
 * @swagger
 * /api/v1/payments:
 *   get:
 *     summary: Get user payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/', paymentController.listPayments);

/**
 * @swagger
 * /api/v1/payments/summary:
 *   get:
 *     summary: Get user payment summary statistics
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment summary
 */
router.get('/summary', paymentController.getPaymentSummary);

/**
 * @swagger
 * /api/v1/payments/export:
 *   get:
 *     summary: Export payments as CSV
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', paymentController.exportPayments);

/**
 * @swagger
 * /api/v1/payments/{id}/proof:
 *   get:
 *     summary: Get payment proof URL
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proof URL
 *   post:
 *     summary: Upload payment proof (renter)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Proof uploaded
 */
router.get('/:id/proof', paymentController.getPaymentProof);
router.post('/:id/proof', memoryUpload.single('file'), paymentController.uploadPaymentProof);

/**
 * @swagger
 * /api/v1/payments/{id}/confirm:
 *   patch:
 *     summary: Confirm manual payment or verify status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       404:
 *         description: Payment not found
 */
router.patch('/:id/confirm', paymentController.confirmPayment);

/**
 * @swagger
 * /api/v1/payments/{id}/checkout:
 *   post:
 *     summary: Create Stripe checkout session
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       404:
 *         description: Payment not found
 */
router.post('/:id/checkout', paymentController.createCheckoutSession);

export default router;
