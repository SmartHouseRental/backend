import { Router } from 'express';
import * as authController from './controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new account. If the role is 'owner', the account will require manual admin verification (isVerified) before the user can list properties.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               phone:
 *                 type: string
 *                 example: "+251911000000"
 *               role:
 *                 type: string
 *                 enum: [owner, renter]
 *                 default: renter
 *                 example: owner
 *                 description: Select account role. Owners must be verified by an admin.
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserEnvelope'
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already registered
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserEnvelope'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid email or password
 *       423:
 *         description: Account locked
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserEnvelope'
 *             example:
 *               status: success
 *               data:
 *                 user:
 *                   id: "cmor19t1w0000a3jsf53p3zy0"
 *                   email: "user@example.com"
 *                   role: "owner"
 *                   isVerified: false
 *                 accessToken: "new_access_token_here"
 *                 refreshToken: "new_refresh_token_here"
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and invalidate refresh token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: Logged out successfully
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email using code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailInput'
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: Email verified successfully
 *       400:
 *         description: Invalid or expired code
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-code:
 *   post:
 *     summary: Resend 6-digit email verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: A new verification code has been sent.
 *       400:
 *         description: Validation failed or email already verified
 *       404:
 *         description: Email not found
 */
router.post('/resend-code', authController.resendVerificationCode);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: Email sent if account exists
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: A password reset code has been sent.
 *       400:
 *         description: Validation failed
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: Password has been reset successfully.
 *       400:
 *         description: Invalid or expired code
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user (requires JWT)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserEnvelope'
 *             example:
 *               status: success
 *               data:
 *                 user:
 *                   id: "cmor19t1w0000a3jsf53p3zy0"
 *                   email: "user@example.com"
 *                   first_name: "string"
 *                   last_name: "string"
 *                   role: "owner"
 *                   isVerified: false
 *       401:
 *         description: Missing or invalid token
 */
router.get('/me', requireAuth, authController.getMe);

/**
 * @swagger
 * /api/v1/auth/health:
 *   get:
 *     summary: Auth module health check
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Auth module is healthy
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               module: auth
 */
router.get('/health', (_, res) => res.json({ status: 'ok', module: 'auth' }));

export default router;
