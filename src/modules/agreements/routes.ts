import { Router } from 'express';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware';
import { diskUpload } from '../../middlewares/multer.middleware';
import * as agreementController from './controller';

const router = Router();

// Owner-specific listing
/**
 * @swagger
 * /api/v1/owner/agreements:
 *   get:
 *     summary: List agreements for the authenticated owner
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paged list of agreements
 */
router.get(
  '/owner/agreements',
  requireAuth,
  restrictTo('owner', 'admin'),
  agreementController.listOwnerAgreements
);

/**
 * @swagger
 * /api/v1/owner/agreements/export:
 *   get:
 *     summary: Export owner agreements as CSV
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv]
 *     responses:
 *       200:
 *         description: CSV attachment
 */
router.get(
  '/owner/agreements/export',
  requireAuth,
  restrictTo('owner', 'admin'),
  agreementController.exportOwnerAgreements
);

// Public agreement detail (requires auth to identify requester)
/**
 * @swagger
 * /api/v1/agreements/{id}:
 *   get:
 *     summary: Get agreement detail
 *     tags: [Agreements]
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
 *         description: Agreement detail object
 *       404:
 *         description: Agreement not found
 */
router.get('/agreements/:id', requireAuth, agreementController.getAgreementDetail);

// Agreement payments
/**
 * @swagger
 * /api/v1/agreements/{id}/payments:
 *   get:
 *     summary: List payments for an agreement
 *     tags: [Agreements]
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
 *         description: List of payments
 */
router.get('/agreements/:id/payments', requireAuth, agreementController.listAgreementPayments);

/**
 * @swagger
 * /api/v1/agreements/{id}/payments:
 *   post:
 *     summary: Create a payment record (upload proof)
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: formData
 *         name: amount
 *         schema:
 *           type: number
 *       - in: formData
 *         name: currency
 *         schema:
 *           type: string
 *       - in: formData
 *         name: proof
 *         type: file
 *     responses:
 *       201:
 *         description: Payment created
 */
router.post(
  '/agreements/:id/payments',
  requireAuth,
  diskUpload.single('proof'),
  agreementController.createAgreementPayment
);

// Update / terminate
/**
 * @swagger
 * /api/v1/agreements/{id}:
 *   patch:
 *     summary: Update agreement (status/paymentStatus)
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               paymentStatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated agreement
 */
router.patch(
  '/agreements/:id',
  requireAuth,
  restrictTo('owner', 'admin'),
  agreementController.updateAgreement
);

/**
 * @swagger
 * /api/v1/agreements/{id}/terminate:
 *   post:
 *     summary: Terminate an agreement
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agreement terminated
 */
router.post(
  '/agreements/:id/terminate',
  requireAuth,
  restrictTo('owner', 'admin'),
  agreementController.terminateAgreement
);

export default router;
