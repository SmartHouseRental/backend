import { Router } from 'express';

const router = Router();
import { createPropertyController } from './controller';
import { createPropertySchema } from './schema';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth.middleware';
import { memoryUpload } from '../../middlewares/multer.middleware';
import { getPropertiesSchema, getNearbyPropertiesSchema, getSimilarPropertiesSchema } from './schema';
import { getPropertiesController, getNearbyPropertiesController, getSimilarPropertiesController } from './controller';
import { getPropertyByIdSchema } from './schema';
import { getPropertyByIdController } from './controller';
import { updatePropertySchema } from './schema';
import { updatePropertyController } from './controller';
import { deletePropertySchema } from './schema';
import { deletePropertyController } from './controller';
import { getMyPropertiesController, getSavedPropertiesController, savePropertyController, removeSavedPropertyController } from './controller';
import { updatePropertyStatusSchema } from './schema';
import { updatePropertyStatusController } from './controller';
import { addPropertyTranslationSchema } from './schema';
import { updatePropertyTranslationSchema } from './schema';
import { deletePropertyTranslationSchema } from './schema';
import { translationParamsSchema } from './schema';
import {
  addPropertyTranslationController,
  updatePropertyTranslationController,
  deletePropertyTranslationController,
  getOwnerPropertyAnalyticsController,
} from './controller';
import recommendationController from '../recommendation/controller';
/**
 * @openapi
 * tags:
 *   - name: Property
 *     description: Property listing and management endpoints
 */

/**
 * @openapi
 * /api/v1/properties:
 *   get:
 *     summary: Get all properties (listing)
 *     tags: [Property]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 12
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, PENDING, RENTED, UNAVAILABLE, MAINTENANCE, RESTRICTED]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [VILLA, APARTMENT, CONDO, STUDIO, HOUSE, SHARED_ROOM, SERVICED_APARTMENT, PENTHOUSE]
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         example: 10000
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         example: 50000
 *       - in: query
 *         name: bedrooms
 *         schema:
 *           type: integer
 *         example: 2
 *       - in: query
 *         name: bathrooms
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, price, viewCount]
 *         example: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         example: desc
 *     responses:
 *       200:
 *         description: Properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Properties fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', validate(getPropertiesSchema, 'query'), getPropertiesController);

/**
 * @openapi
 * /api/v1/properties/my:
 *   get:
 *     summary: Get properties created by logged-in owner
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Owner properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Owner properties fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 */
router.get('/my', requireAuth, getMyPropertiesController);

/**
 * @openapi
 * /api/v1/properties/saved:
 *   get:
 *     summary: Get saved/favorite properties for the logged-in user
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Saved properties fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 */
router.get('/saved', requireAuth, getSavedPropertiesController);

/**
 * @openapi
 * /api/v1/properties/nearby:
 *   get:
 *     summary: Get properties near a geographic location
 *     tags: [Property]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         example: 9.03
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         example: 38.74
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           description: Radius in kilometers
 *         example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 12
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, PENDING, RENTED, UNAVAILABLE, MAINTENANCE, RESTRICTED]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, am]
 *     responses:
 *       200:
 *         description: Nearby properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Nearby properties fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/nearby', validate(getNearbyPropertiesSchema, 'query'), getNearbyPropertiesController);

/**
 * @openapi
 * /api/v1/properties/recommendations:
 *   get:
 *     summary: Get recommended properties for logged-in user
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recommended properties fetched successfully
 */
router.get('/recommendations', requireAuth, recommendationController.getRecommendations);

/**
 * @openapi
 * /api/v1/properties/{propertyId}/similar:
 *   get:
 *     summary: Get similar properties to an existing property
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         example: "ckv1n1xyz"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 12
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, am]
 *     responses:
 *       200:
 *         description: Similar properties fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Similar properties fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *       404:
 *         description: Property not found
 */
router.get('/:propertyId/similar', validate(getPropertyByIdSchema, 'params'), validate(getSimilarPropertiesSchema, 'query'), getSimilarPropertiesController);

/**
 * @openapi
 * /api/v1/properties/{propertyId}/save:
 *   post:
 *     summary: Save a property to the logged-in user's favorites
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         example: "ckv1n1xyz"
 *     responses:
 *       200:
 *         description: Property saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property saved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     property:
 *                       $ref: '#/components/schemas/Property'
 *                     savedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.post('/:propertyId/save', requireAuth, validate(getPropertyByIdSchema, 'params'), savePropertyController);

/**
 * @openapi
 * /api/v1/properties/{propertyId}/save:
 *   delete:
 *     summary: Remove a saved property from the logged-in user's favorites
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         example: "ckv1n1xyz"
 *     responses:
 *       200:
 *         description: Saved property removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property removed from saved list successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Saved property not found
 */
router.delete('/:propertyId/save', requireAuth, validate(getPropertyByIdSchema, 'params'), removeSavedPropertyController);

/**
 * @openapi
 * /api/v1/properties/analytics:
 *   get:
 *     summary: Get property analytics for the authenticated owner
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property analytics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property analytics fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProperties:
 *                       type: integer
 *                       example: 6
 *                     available:
 *                       type: integer
 *                       example: 3
 *                     rented:
 *                       type: integer
 *                       example: 2
 *                     pending:
 *                       type: integer
 *                       example: 1
 *                     totalViews:
 *                       type: integer
 *                       example: 5171
 *       401:
 *         description: Unauthorized
 */
router.get('/analytics', requireAuth, getOwnerPropertyAnalyticsController);

/**
 * @openapi
 * /api/v1/properties/{propertyId}:
 *   get:
 *     summary: Get property details by ID
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         example: "ckv1n1xyz"
 *     responses:
 *       200:
 *         description: Property fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     category:
 *                       type: object
 *                       properties:
 *                         en:
 *                           type: string
 *                         am:
 *                           type: string
 *                     title:
 *                       type: object
 *                     description:
 *                       type: object
 *                     address:
 *                       type: object
 *                       properties:
 *                         en:
 *                           type: string
 *                         am:
 *                           type: string
 *                     price:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         currency:
 *                           type: string
 *                     area:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         unit:
 *                           type: string
 *                     amenities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           en:
 *                             type: string
 *                           am:
 *                             type: string
 *                       example: [{ "en": "WiFi", "am": "ዋይፋይ" }]
 *                     leaseTerms:
 *                       type: object
 *                       properties:
 *                         minDuration:
 *                           type: string
 *                         secureDeposit:
 *                           type: object
 *                           properties:
 *                             value:
 *                               type: number
 *                             currency:
 *                               type: string
 *                         conditions:
 *                           type: object
 *                           properties:
 *                             en:
 *                               type: string
 *                             am:
 *                               type: string
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                     video:
 *                       type: string
 *                     availableFrom:
 *                       type: string
 *                       format: date
 *                     status:
 *                       type: string
 *                     owner:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Property not found
 */
router.get('/:propertyId', validate(getPropertyByIdSchema, 'params'), getPropertyByIdController);

/**
 * @openapi
 * /api/v1/properties:
 *   post:
 *     summary: Create a new property (Owner only)
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - title
 *               - description
 *               - location
 *               - price
 *               - amenities
 *               - images
 *             properties:
 *               category:
 *                 type: object
 *                 example: { "en": "Apartment", "am": "አፓርታማ" }
 *               title:
 *                 type: object
 *                 example: { "en": "Modern Apartment", "am": "ዘመናዊ አፓርታማ" }
 *               description:
 *                 type: object
 *                 example: { "en": "Nice house", "am": "ጥሩ ቤት" }
 *               location:
 *                 type: object
 *                 example: { "lat": 9.03, "lng": 38.74 }
 *               address:
 *                 type: object
 *                 example: { "en": "Bole, Addis Ababa", "am": "ቦሌ፣ አዲስ አበባ" }
 *               price:
 *                 type: object
 *                 example: { "value": 35000, "currency": "ETB" }
 *               bedrooms:
 *                 type: integer
 *                 example: 2
 *               bathrooms:
 *                 type: integer
 *                 example: 1
 *               area:
 *                 type: object
 *                 example: { "value": 120, "unit": "sqm" }
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     en:
 *                       type: string
 *                     am:
 *                       type: string
 *                 example: [{ "en": "WiFi", "am": "ዋይፋይ" }, { "en": "Parking", "am": "መኪና ማቆሚያ" }]
 *               furnishingStatus:
 *                 type: string
 *                 example: "furnished"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://img.com/1.jpg"]
 *     responses:
 *       201:
 *         description: Property created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  requireAuth,
  memoryUpload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
  ]),
  validate(createPropertySchema, 'body'),
  createPropertyController
);

/**
 * @openapi
 * /api/v1/properties/{propertyId}:
 *   patch:
 *     summary: Update property (Owner only)
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Property updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.patch(
  '/:propertyId',
  requireAuth,
  memoryUpload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
  ]),
  validate(updatePropertySchema, 'body'),
  updatePropertyController
);

/**
 * @openapi
 * /api/v1/properties/{propertyId}:
 *   delete:
 *     summary: Soft delete property (Owner only)
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property soft deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property soft deleted successfully"
 *                 data:
 *                   type: null
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.delete(
  '/:propertyId',
  requireAuth,
  validate(deletePropertySchema, 'params'),
  deletePropertyController
);

/**
 * @openapi
 * /api/v1/properties/{propertyId}/status:
 *   patch:
 *     summary: Update property status (Owner only)
 *     tags: [Property]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, PENDING, RENTED, UNAVAILABLE, MAINTENANCE, RESTRICTED]
 *                 example: "RENTED"
 *     responses:
 *       200:
 *         description: Property status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Property status updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.patch(
  '/:propertyId/status',
  requireAuth,
  validate(updatePropertyStatusSchema, 'body'),
  updatePropertyStatusController
);

// /**
//  * @openapi
//  * /api/v1/properties/{propertyId}/translations:
//  *   post:
//  *     summary: Add a new translation for a property
//  *     tags: [Property]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: propertyId
//  *         required: true
//  *         schema:
//  *           type: string
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [language, title, description]
//  *             properties:
//  *               language:
//  *                 type: string
//  *                 enum: [en, am]
//  *                 example: "am"
//  *               title:
//  *                 type: string
//  *                 example: "ዘመናዊ አፓርታማ"
//  *               description:
//  *                 type: string
//  *                 example: "ጥሩ ቤት"
//  *     responses:
//  *       201:
//  *         description: Translation saved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Translation saved successfully"
//  *                 data:
//  *                   type: object
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Property not found
//  */
// // router.post(
// //   '/:propertyId/translations',
// //   requireAuth,
// //   validate(addPropertyTranslationSchema, 'body'),
// //   addPropertyTranslationController
// // );

// /**
//  * @openapi
//  * /api/v1/properties/{propertyId}/translations/{lang}:
//  *   put:
//  *     summary: Update an existing translation for a property
//  *     tags: [Property]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: propertyId
//  *         required: true
//  *         schema:
//  *           type: string
//  *       - in: path
//  *         name: lang
//  *         required: true
//  *         schema:
//  *           type: string
//  *           enum: [en, am]
//  *         example: "am"
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [title, description]
//  *             properties:
//  *               title:
//  *                 type: string
//  *                 example: "ዘመናዊ አፓርታማ"
//  *               description:
//  *                 type: string
//  *                 example: "ጥሩ ቤት"
//  *     responses:
//  *       200:
//  *         description: Translation updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Translation updated successfully"
//  *                 data:
//  *                   type: object
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Translation not found
//  */
// // router.put(
// //   '/:propertyId/translations/:lang',
// //   requireAuth,
// //   validate(translationParamsSchema, 'params'),
// //   validate(updatePropertyTranslationSchema, 'body'),
// //   updatePropertyTranslationController
// // );

// /**
//  * @openapi
//  * /api/v1/properties/{propertyId}/translations/{lang}:
//  *   delete:
//  *     summary: Delete a translation for a property
//  *     tags: [Property]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: propertyId
//  *         required: true
//  *         schema:
//  *           type: string
//  *       - in: path
//  *         name: lang
//  *         required: true
//  *         schema:
//  *           type: string
//  *           enum: [en, am]
//  *         example: "am"
//  *     responses:
//  *       200:
//  *         description: Translation deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *                   example: "Translation deleted successfully"
//  *                 data:
//  *                   type: null
//  *       401:
//  *         description: Unauthorized
//  *       404:
//  *         description: Translation not found
//  */
// // router.delete(
// //   '/:propertyId/translations/:lang',
// //   requireAuth,
// //   validate(deletePropertyTranslationSchema, 'params'),
// //   deletePropertyTranslationController
// // );

export default router;
