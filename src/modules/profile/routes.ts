import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import multer from 'multer';
import * as profileController from './controller';

const router = Router();

// File upload middleware - match 5MB limit per profile.md
const storage = multer.memoryStorage();
const fileUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});

// All routes below are protected - require authentication
router.use(requireAuth);
/**
 * @swagger
 * /api/v1/profile:
 *   patch:
 *     summary: Update personal information and avatar
 *     description: |
 *       Update profile details like full name, phone, location, bio, and optionally upload a new avatar image.
 *       Accepts multipart/form-data.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               location:
 *                 type: string
 *               bio:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New profile avatar (jpg, jpeg, png, max 5MB)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: Get owner's full profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile loaded successfully
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
 *                   properties:
 *                     id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [active, suspended, pending]
 *                       example: active
 *                     role:
 *                       type: string
 *                       enum: [renter, owner, admin]
 *                       example: owner
 *                     preferedlanguage:
 *                       type: string
 *                       enum: [en, am, or, ti]
 *                       example: en
 *                     verification:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: pending
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                         documents:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               documentType:
 *                                 type: string
 *                               label:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                               file:
 *                                 type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 */
router.get('/', profileController.getProfile);
router.patch('/', fileUpload.single('image'), profileController.updatePersonalInfo);


/**
 * @swagger
 * /api/v1/profile/documents:
 *   get:
 *     summary: Get user's verification documents
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     overallStatus:
 *                       type: string
 *                     submittedAt:
 *                       type: string
 *                     uploadedFiles:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Upload all verification documents in a single request
 *     description: |
 *       Submit up to three verification files at once — National ID front, National ID back, and owner photo.
 *       Each field is optional individually, but at least one must be provided.
 *       Each file must be ≤ 5 MB and in pdf, jpg, jpeg, or png format.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nationalIdFront:
 *                 type: string
 *                 format: binary
 *                 description: National ID front image (pdf, jpg, jpeg, png — max 5 MB)
 *               nationalIdBack:
 *                 type: string
 *                 format: binary
 *                 description: National ID back image (pdf, jpg, jpeg, png — max 5 MB)
 *               ownerPhoto:
 *                 type: string
 *                 format: binary
 *                 description: Live owner photo (pdf, jpg, jpeg, png — max 5 MB)
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
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
 *                   example: Documents uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     overallStatus:
 *                       type: string
 *                       example: pending
 *                     submittedAt:
 *                       type: string
 *                       format: date-time
 *                     uploadedFiles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           documentType:
 *                             type: string
 *                             enum: [NATIONAL_ID_FRONT, NATIONAL_ID_BACK, OWNER_PHOTO]
 *                           label:
 *                           file:
 *                             type: string
 *       400:
 *         description: No files provided or validation failed
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File exceeds 5 MB limit
 */
router.get('/documents', profileController.getDocuments);
router.post(
  '/documents',
  fileUpload.fields([
    { name: 'nationalIdFront', maxCount: 1 },
    { name: 'nationalIdBack', maxCount: 1 },
    { name: 'ownerPhoto', maxCount: 1 },
  ]),
  profileController.uploadDocument
);

/**
 * @swagger
 * /api/v1/profile/bank:
 *   patch:
 *     summary: Update bank details
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankName
 *               - accountNumber
 *               - holderName
 *             properties:
 *               bankName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               holderName:
 *                 type: string
 *               branch:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank details updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.patch('/bank', profileController.updateBankDetails);

/**
 * @swagger
 * /api/v1/profile/notifications:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointments:
 *                 type: boolean
 *               agreements:
 *                 type: boolean
 *               payments:
 *                 type: boolean
 *               reviews:
 *                 type: boolean
 *               reports:
 *                 type: boolean
 *               system:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.patch('/notifications', profileController.updateNotificationPreferences);

/**
 * @swagger
 * /api/v1/profile/language:
 *   patch:
 *     summary: Update language preference
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - language
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, am, or, ti]
 *     responses:
 *       200:
 *         description: Language preference updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.patch('/language', profileController.updateLanguagePreference);

/**
 * @swagger
 * /api/v1/profile/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 description: New password (min 8 chars, uppercase, lowercase, number, special char)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation failed or current password incorrect
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', profileController.changePassword);

export default router;
