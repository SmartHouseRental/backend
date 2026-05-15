import { Router } from 'express';
import { requireAuth, restrictTo } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import {
  adminUpdatePropertyBodySchema,
  adminUpdatePropertyParamsSchema,
  getAdminPropertiesQuerySchema,
  getAnalyticsQuerySchema,
  getAuditLogsQuerySchema,
  getOverviewQuerySchema,
  getPendingVerificationsQuerySchema,
} from './schema';
import {
  analytics,
  auditLogs,
  overview,
  overrideProperty,
  pendingVerifications,
} from './controller';
import * as controller from './controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin-only operations and platform oversight endpoints
 */

// All routes below are protected and can only be accessed by admins.
router.use(requireAuth, restrictTo('admin'));

/**
 * @swagger
 * /api/v1/admin/analytics:
 *   get:
 *     summary: Get platform-wide analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Optional timeframe filter for trend counters
 *     responses:
 *       200:
 *         description: Analytics fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
/**
 * @swagger
 * /api/v1/admin/overview:
 *   get:
 *     summary: Get admin dashboard overview with stats, charts, and recent activity
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [weekly, monthly]
 *           default: monthly
 *         description: Optional timeframe for user growth chart
 *       - in: query
 *         name: timezone
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional IANA timezone string for date calculations
 *     responses:
 *       200:
 *         description: Overview loaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Overview loaded
 *                 data:
 *                   type: object
 *                   properties:
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-05-14T13:40:00.000Z"
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: integer
 *                               example: 12450
 *                             trendPercent:
 *                               type: number
 *                               example: 12
 *                         activeListings:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: integer
 *                               example: 3820
 *                             trendPercent:
 *                               type: number
 *                               example: 8
 *                         pendingVerifications:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: integer
 *                               example: 24
 *                             actionNeeded:
 *                               type: boolean
 *                               example: true
 *                         activeAgreements:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: integer
 *                               example: 890
 *                             trendPercent:
 *                               type: number
 *                               example: 15
 *                         totalReport:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: integer
 *                               example: 890
 *                             trendPercent:
 *                               type: number
 *                               example: 15
 *                     userGrowth:
 *                       type: object
 *                       properties:
 *                         range:
 *                           type: string
 *                           enum: [weekly, monthly]
 *                           example: monthly
 *                         labels:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
 *                         currentPeriod:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           example: [220, 210, 240, 180, 120, 90]
 *                         previousPeriod:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           example: [250, 240, 270, 230, 190, 160]
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "ACT-001"
 *                           type:
 *                             type: string
 *                             example: "OWNER_REGISTRATION"
 *                           text:
 *                             type: string
 *                             example: "New owner registration"
 *                           detail:
 *                             type: string
 *                             example: "Hana Bekele signed up and submitted verification documents."
 *                           time:
 *                             type: string
 *                             example: "12 min ago"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-05-14T13:28:00.000Z"
 *                     listingsByArea:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           area:
 *                             type: string
 *                             example: "Bole"
 *                           count:
 *                             type: integer
 *                             example: 245
 *                           percentage:
 *                             type: number
 *                             example: 35
 *                       description: Top property listings grouped by area with percentage distribution
 *                     paymentPerformance:
 *                       type: object
 *                       properties:
 *                         successRate:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                           example: 95
 *                           description: Payment success rate percentage
 *                         totalCollectionAmount:
 *                           type: number
 *                           example: 450000
 *                           description: Total confirmed collection amount
 *                         currency:
 *                           type: string
 *                           example: "ETB"
 *                         label:
 *                           type: string
 *                           example: "On Time Collection"
 *                           description: Dynamic label based on success rate
 *                     recentProperties:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "PRP-9402"
 *                           name:
 *                             type: string
 *                             example: "Horizon Peak Villa"
 *                           owner:
 *                             type: string
 *                             example: "Michael Chen"
 *                           ownerAvatar:
 *                             type: string
 *                             format: uri
 *                             example: "https://cdn.example.com/avatars/michael.jpg"
 *                           location:
 *                             type: string
 *                             example: "Bole, Addis Ababa"
 *                           status:
 *                             type: string
 *                             enum: [PENDING, NEEDS_REVIEW, APPROVED, REJECTED]
 *                             example: "PENDING"
 *                           statusLabel:
 *                             type: string
 *                             example: "Pending"
 *                           statusStyle:
 *                             type: string
 *                             example: "bg-amber-100 text-amber-700"
 *                           dateSubmitted:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-03-22T10:00:00.000Z"
 *                           image:
 *                             type: string
 *                             format: uri
 *                             nullable: true
 *                             example: "https://cdn.example.com/properties/prp-9402-cover.jpg"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/analytics', validate(getAnalyticsQuerySchema, 'query'), analytics);
router.get('/overview', validate(getOverviewQuerySchema, 'query'), overview);

/**
 * @swagger
 * /api/v1/admin/pending-verifications:
 *   get:
 *     summary: List owners waiting for verification
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by first name, last name, email, or phone
 *       - in: query
 *         name: emailVerified
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filter by whether owner's email is verified
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, first_name, last_name]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: Pending verifications fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get(
  '/pending-verifications',
  validate(getPendingVerificationsQuerySchema, 'query'),
  pendingVerifications
);

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: List audit logs with optional filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by event type, entity type, or entity id
 *       - in: query
 *         name: eventType
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityType
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: actorId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Audit logs fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/audit-logs', validate(getAuditLogsQuerySchema, 'query'), auditLogs);

/**
 * @swagger
 * /api/v1/admin/properties/{id}:
 *   patch:
 *     summary: Admin override update for a property
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any allowed property fields to override
 *     responses:
 *       200:
 *         description: Property updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Property not found
 */
router.patch(
  '/properties/:id',
  validate(adminUpdatePropertyParamsSchema, 'params'),
  validate(adminUpdatePropertyBodySchema),
  overrideProperty
);

// Users
/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List all users globally
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [renter, owner, admin]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, banned]
 *     responses:
 *       200:
 *         description: Paginated list of users fetched successfully
 */
router.get('/users', controller.usersList);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get specific user details
 *     tags: [Admin]
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
 *         description: User found
 *       404:
 *         description: User not found
 */
router.get('/users/:id', controller.userGet);

/**
 * @swagger
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     summary: Update an existing user's status
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, suspended, banned]
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch(
  '/users/:id/status',
  validate(adminUpdatePropertyParamsSchema, 'params'),
  controller.userUpdateStatus
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/verification:
 *   patch:
 *     summary: Update an existing user's verification state
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verificationState:
 *                 type: string
 *                 enum: [verified, pending, rejected, resubmit]
 *               comment:
 *                 type: string
 *                 description: Optional comment about the verification change
 *     responses:
 *       200:
 *         description: Verification state updated successfully
 */
router.patch(
  '/users/:id/verification',
  validate(adminUpdatePropertyParamsSchema, 'params'),
  controller.userUpdateVerification
);

// Properties
/**
 * @swagger
 * /api/v1/admin/properties:
 *   get:
 *     summary: Get all properties platform-wide
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Properties fetched successfully
 */
router.get(
  '/properties',
  validate(getAdminPropertiesQuerySchema, 'query'),
  controller.propertiesList
);

// Agreements
/**
 * @swagger
 * /api/v1/admin/agreements:
 *   get:
 *     summary: List platform agreements
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Agreements list fetched
 *   post:
 *     summary: Manually create a rental agreement (Admin Override)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyId:
 *                 type: string
 *               renterId:
 *                 type: string
 *               ownerId:
 *                 type: string
 *               monthlyRent:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 default: draft
 *     responses:
 *       201:
 *         description: Agreement created successfully
 */
router.get('/agreements', controller.agreementsList);
router.post('/agreements', controller.agreementCreate);

/**
 * @swagger
 * /api/v1/admin/agreements/{id}:
 *   get:
 *     summary: Get details of an agreement
 *     tags: [Admin]
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
 *         description: Agreement details
 */
router.get('/agreements/:id', controller.agreementGet);

/**
 * @swagger
 * /api/v1/admin/agreements/{id}/status:
 *   patch:
 *     summary: Update lifecycle status of an agreement
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, pending_renter, pending_owner, draft, terminated, expired]
 *     responses:
 *       200:
 *         description: Agreement status updated
 */
router.patch('/agreements/:id/status', controller.agreementUpdateStatus);

// Reports
/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: See all platform violations and reports
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Reports fetched successfully
 */
router.get('/reports', controller.reportsList);

/**
 * @swagger
 * /api/v1/admin/reports/{id}/status:
 *   patch:
 *     summary: Resolve or manage a report's status
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_review, resolved, dismissed]
 *     responses:
 *       200:
 *         description: Report updated successfully
 */
router.patch('/reports/:id/status', controller.reportUpdateStatus);

// Verifications
/**
 * @swagger
 * /api/v1/admin/verifications/{id}/resolve:
 *   patch:
 *     summary: Approve or reject an uploaded document
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *     responses:
 *       200:
 *         description: Verification request completed
 */
router.patch('/verifications/:id/resolve', controller.verificationResolve);

// Properties (Detail)
/**
 * @swagger
 * /api/v1/admin/properties/{id}:
 *   get:
 *     summary: Get details of a property
 *     tags: [Admin]
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
 *         description: Property details
 */
router.get('/properties/:id', controller.propertyGet);
router.patch('/properties/:id/approve', controller.propertyApprove);
router.patch('/properties/:id/reject', controller.propertyReject);

// Reports (Detail)
/**
 * @swagger
 * /api/v1/admin/reports/{id}:
 *   get:
 *     summary: Get details of a report
 *     tags: [Admin]
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
 *         description: Report details
 */
router.get('/reports/:id', controller.reportGet);

// Notifications & Broadcasts
/**
 * @swagger
 * /api/v1/admin/notifications:
 *   get:
 *     summary: List platform notifications
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/notifications', controller.notificationsList);

/**
 * @swagger
 * /api/v1/admin/notifications/broadcast:
 *   post:
 *     summary: Broadcast a notification to users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               audience:
 *                 type: string
 *                 enum: [all, renters, owners, verified_owners]
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 */
router.post('/notifications/broadcast', controller.notificationBroadcast);

// Reviews Moderation
/**
 * @swagger
 * /api/v1/admin/reviews:
 *   get:
 *     summary: List reviews for moderation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reviews list
 */
router.get('/reviews', controller.reviewsList);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/status:
 *   patch:
 *     summary: Manage review status
 *     tags: [Admin]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [published, flagged, removed]
 *     responses:
 *       200:
 *         description: Review status updated
 */
router.patch('/reviews/:id/status', controller.reviewUpdateStatus);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Admin]
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
 *         description: Review deleted
 */
router.delete('/reviews/:id', controller.reviewDelete);

export default router;
