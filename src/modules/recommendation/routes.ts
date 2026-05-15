import { Router } from 'express';
import controller from './controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { preferenceSchema, searchSchema, interactionSchema } from './schema';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Recommendation
 *     description: User preferences, search history, interactions, and recommendations
 */

/**
 * @openapi
 * /api/v1/recommendations/preferences:
 *   post:
 *     summary: Save user preferences
 *     description: |
 *       Store or update the renter's search preferences including budget, location, and property type.
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               budget:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 15000
 *                   max:
 *                     type: number
 *                     example: 80000
 *                   currency:
 *                     type: string
 *                     example: "ETB"
 *               bedrooms:
 *                 type: integer
 *                 example: 2
 *               preferredLocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                       example: "Bole, Addis Ababa"
 *                     lat:
 *                       type: number
 *                       example: 9.0044
 *                     lng:
 *                       type: number
 *                       example: 38.7758
 *               preferredType:
 *                 type: string
 *                 enum: [VILLA, APARTMENT, CONDO, STUDIO, HOUSE, PENTHOUSE]
 *                 example: APARTMENT
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Parking", "Security", "WiFi / Broadband"]
 *               furnishStatus:
 *                 type: string
 *                 enum: [furnished, semi-furnished, unfurnished]
 *                 example: furnished
 *     responses:
 *       200:
 *         description: Preferences saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *   get:
 *     summary: Get user preferences
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences fetched successfully
 */
router.post(
  '/preferences',
  requireAuth,
  validate(preferenceSchema),
  controller.savePreferences
);

router.get('/preferences', requireAuth, controller.getPreferences);

/**
 * @openapi
 * /api/v1/search/history:
 *   post:
 *     summary: Save search history
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "2 bedroom apartment"
 *               filters:
 *                 type: object
 *                 example: { "minPrice": 10000, "maxPrice": 30000 }
 *     responses:
 *       200:
 *         description: Search saved successfully
 */
router.post('/search/history', requireAuth, validate(searchSchema), controller.saveSearch);

/**
 * @openapi
 * /api/v1/search/history:
 *   get:
 *     summary: Get search history
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search history fetched successfully
 */
router.get('/search/history', requireAuth, controller.getSearchHistory);

/**
 * @openapi
 * /api/v1/interactions:
 *   post:
 *     summary: Track user interaction (view, like, save)
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *               - type
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "ck123property"
 *               type:
 *                 type: string
 *                 enum: [VIEW, LIKE, SAVE]
 *                 example: VIEW
 *     responses:
 *       200:
 *         description: Interaction recorded successfully
 */
router.post('/interactions', requireAuth, validate(interactionSchema), controller.trackInteraction);

/**
 * @openapi
 * /api/v1/properties/recommendations:
 *   get:
 *     summary: Get recommended properties for logged-in user
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recommended properties fetched successfully
 */
router.get('/properties/recommendations', requireAuth, controller.getRecommendations);

/**
 * @openapi
 * /api/v1/properties/{id}/similar:
 *   get:
 *     summary: Get similar properties
 *     tags: [Recommendation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "ck123property"
 *     responses:
 *       200:
 *         description: Similar properties fetched successfully
 */
router.get('/properties/:id/similar', requireAuth, controller.getSimilarProperties);

export default router;
