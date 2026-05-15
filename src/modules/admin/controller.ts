import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/request';
import {
  adminOverrideUpdateProperty,
  approveProperty,
  getAdminOverview,
  getAuditLogs,
  getPendingVerifications,
  getPlatformAnalytics,
  rejectProperty,
} from './service';
import {
  adminUpdatePropertyBodySchema,
  adminUpdatePropertyParamsSchema,
  approvePropertySchema,
  getAdminPropertiesQuerySchema,
  getAnalyticsQuerySchema,
  getAuditLogsQuerySchema,
  getOverviewQuerySchema,
  getPendingVerificationsQuerySchema,
  rejectPropertySchema,
} from './schema';
import type {
  AdminUpdatePropertyBodyInput,
  AdminUpdatePropertyParamsInput,
  GetAnalyticsQueryInput,
  GetAuditLogsQueryInput,
  GetOverviewQueryInput,
  GetPendingVerificationsQueryInput,
} from './schema';

export async function analytics(req: Request, res: Response) {
  const query = getAnalyticsQuerySchema.parse(req.query) as GetAnalyticsQueryInput;
  const data = await getPlatformAnalytics(query.range);
  return res.status(200).json({ status: 'success', data });
}

export async function overview(req: Request, res: Response) {
  const query = getOverviewQuerySchema.parse(req.query) as GetOverviewQueryInput;
  const data = await getAdminOverview(query);
  return res.status(200).json({ status: 'success', message: 'Overview loaded', data });
}

export async function pendingVerifications(req: Request, res: Response) {
  const query = getPendingVerificationsQuerySchema.parse(
    req.query
  ) as GetPendingVerificationsQueryInput;
  const data = await getPendingVerifications(query);
  return res.status(200).json({ status: 'success', data });
}

export async function auditLogs(req: Request, res: Response) {
  const query = getAuditLogsQuerySchema.parse(req.query) as GetAuditLogsQueryInput;
  const data = await getAuditLogs(query);
  return res.status(200).json({ status: 'success', data });
}

export async function overrideProperty(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = adminUpdatePropertyParamsSchema.parse(
    req.params
  ) as AdminUpdatePropertyParamsInput;
  const body = adminUpdatePropertyBodySchema.parse(req.body) as AdminUpdatePropertyBodyInput;

  const updated = await adminOverrideUpdateProperty(auth.userId, params.id, body);

  if (!updated) {
    return res.status(404).json({
      status: 'error',
      message: 'Property not found',
    });
  }

  return res.status(200).json({
    status: 'success',
    data: updated,
  });
}

// -------------------------------------------------------------------------------- //
// NEW ADMIN CONTROLLERS
// -------------------------------------------------------------------------------- //

import * as adminService from './service';
import {
  getUsersQuerySchema,
  paramIdSchema,
  updateUserStatusSchema,
  updateUserVerificationSchema,
  createAgreementSchema,
  updateAgreementStatusSchema,
  updateReportStatusSchema,
  resolveVerificationSchema,
  broadcastNotificationSchema,
  updateReviewStatusSchema,
} from './schema';
import { paginationQuerySchema } from './schema';

export async function usersList(req: Request, res: Response) {
  const query = getUsersQuerySchema.parse(req.query);
  const data = await adminService.getUsers(query);
  return res.status(200).json({ status: 'success', data });
}

export async function userGet(req: Request, res: Response) {
  const params = paramIdSchema.parse(req.params);
  const data = await adminService.getUserById(params.id);
  if (!data) return res.status(404).json({ status: 'error', message: 'Not found' });
  return res.status(200).json({ status: 'success', data });
}

export async function userUpdateStatus(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = updateUserStatusSchema.parse(req.body);
  const data = await adminService.updateUserStatus(auth.userId, params.id, body.status);
  return res.status(200).json({ status: 'success', data });
}

export async function userUpdateVerification(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = updateUserVerificationSchema.parse(req.body);
  const data = await adminService.updateUserVerificationState(
    auth.userId,
    params.id,
    body.verificationState,
    // pass optional comment through to service
    (body as any).comment
  );
  return res.status(200).json({ status: 'success', data });
}

export async function propertiesList(req: Request, res: Response) {
  const query = getAdminPropertiesQuerySchema.parse(req.query);
  const data = await adminService.getProperties(query);
  return res.status(200).json({ status: 'success', data });
}

export async function agreementsList(req: Request, res: Response) {
  const query = paginationQuerySchema.parse(req.query);
  const data = await adminService.getAgreements(query);
  return res.status(200).json({ status: 'success', data });
}

export async function agreementGet(req: Request, res: Response) {
  const params = paramIdSchema.parse(req.params);
  const data = await adminService.getAgreementById(params.id);
  if (!data) return res.status(404).json({ status: 'error', message: 'Not found' });
  return res.status(200).json({ status: 'success', data });
}

export async function agreementCreate(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const body = createAgreementSchema.parse(req.body);
  const data = await adminService.createAgreement(auth.userId, body);
  return res.status(201).json({ status: 'success', data });
}

export async function agreementUpdateStatus(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = updateAgreementStatusSchema.parse(req.body);
  const data = await adminService.updateAgreementStatus(auth.userId, params.id, body.status);
  return res.status(200).json({ status: 'success', data });
}

export async function reportsList(req: Request, res: Response) {
  const query = paginationQuerySchema.parse(req.query);
  const data = await adminService.getReports(query);
  return res.status(200).json({ status: 'success', data });
}

export async function reportUpdateStatus(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = updateReportStatusSchema.parse(req.body);
  const data = await adminService.updateReportStatus(auth.userId, params.id, body.status);
  return res.status(200).json({ status: 'success', data });
}

export async function verificationResolve(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = resolveVerificationSchema.parse(req.body);
  const data = await adminService.resolveVerification(auth.userId, params.id, body.status);
  return res.status(200).json({ status: 'success', data });
}

export async function propertyGet(req: Request, res: Response) {
  const params = paramIdSchema.parse(req.params);
  const data = await adminService.getPropertyById(params.id);
  if (!data) return res.status(404).json({ status: 'error', message: 'Not found' });
  return res.status(200).json({ status: 'success', data });
}

export async function propertyApprove(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = approvePropertySchema.parse(req.body);

  const data = await approveProperty(auth.userId, params.id, body);
  if (!data) return res.status(404).json({ status: 'error', message: 'Property not found' });

  return res.status(200).json({ status: 'success', data });
}

export async function propertyReject(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = rejectPropertySchema.parse(req.body);

  const data = await rejectProperty(auth.userId, params.id, body);
  if (!data) return res.status(404).json({ status: 'error', message: 'Property not found' });

  return res.status(200).json({ status: 'success', data });
}

export async function reportGet(req: Request, res: Response) {
  const params = paramIdSchema.parse(req.params);
  const data = await adminService.getReportById(params.id);
  if (!data) return res.status(404).json({ status: 'error', message: 'Not found' });
  return res.status(200).json({ status: 'success', data });
}

export async function notificationsList(req: Request, res: Response) {
  const query = paginationQuerySchema.parse(req.query);
  const data = await adminService.getNotifications(query);
  return res.status(200).json({ status: 'success', data });
}

export async function notificationBroadcast(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const body = broadcastNotificationSchema.parse(req.body);
  const data = await adminService.broadcastNotification(auth.userId, body);
  return res.status(200).json({ status: 'success', data });
}

export async function reviewsList(req: Request, res: Response) {
  const query = paginationQuerySchema.parse(req.query);
  const data = await adminService.getReviews(query);
  return res.status(200).json({ status: 'success', data });
}

export async function reviewUpdateStatus(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const body = updateReviewStatusSchema.parse(req.body);
  const data = await adminService.updateReviewStatus(auth.userId, params.id, body.status);
  return res.status(200).json({ status: 'success', data });
}

export async function reviewDelete(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const params = paramIdSchema.parse(req.params);
  const data = await adminService.deleteReview(auth.userId, params.id);
  return res.status(200).json({ status: 'success', data });
}
