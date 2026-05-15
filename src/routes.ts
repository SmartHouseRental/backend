import { Router } from 'express';
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import profileRoutes from './modules/profile/routes';
import propertyRoutes from './modules/properties/routes';
import messagingRoutes from './modules/messaging/routes';
import appointmentRoutes from './modules/appointments/routes';
import notificationRoutes from './modules/notifications/routes';
import adminRoutes from './modules/admin/routes';
import reviewRoutes from './modules/review-rate/routes';
import paymentRoutes from './modules/payments/routes';
import agreementRoutes from './modules/agreements/routes';
import recommendationRoutes from './modules/recommendation/routes';
import recommendationController from './modules/recommendation/controller';
import { requireAuth } from './middlewares/auth.middleware';
import { validate } from './middlewares/validate';
import { searchSchema, interactionSchema } from './modules/recommendation/schema';
import reportRoutes from './modules/reports/routes';
const router = Router();

// Auth Routes
router.use('/auth', authRoutes);

// User Routes
router.use('/users', userRoutes);

// Profile Routes
router.use('/profile', profileRoutes);

// Property Routes
router.use('/properties', propertyRoutes);

// Messaging Routes
router.use('/messaging', messagingRoutes);

// Appointment Routes
router.use('/appointments', appointmentRoutes);

// Notification Routes
router.use('/notifications', notificationRoutes);

// Admin Routes
router.use('/admin', adminRoutes);

//Review Routes
router.use('/reviews', reviewRoutes);

//Recommendation Routes
router.use('/recommendation', recommendationRoutes);

// Expose user preferences at /user/preferences for backward-compatible client paths
router.post('/user/preferences', requireAuth, recommendationController.savePreferences as any);
router.get('/user/preferences', requireAuth, recommendationController.getPreferences as any);

// Backwards-compatible search history endpoints at /search/history
router.post(
  '/search/history',
  requireAuth,
  validate(searchSchema),
  recommendationController.saveSearch as any
);
router.get('/search/history', requireAuth, recommendationController.getSearchHistory as any);

// Backwards-compatible interactions endpoint at /interactions
router.post(
  '/interactions',
  requireAuth,
  validate(interactionSchema),
  recommendationController.trackInteraction as any
);

// Backwards-compatible similar properties endpoint at /properties/:id/similar
router.get(
  '/properties/:id/similar',
  requireAuth,
  recommendationController.getSimilarProperties as any
);
//Reports Routes
router.use('/reports', reportRoutes);

// Payment Routes
router.use('/payments', paymentRoutes);

// Agreements
router.use('/', agreementRoutes);

export default router;
