import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/request';
import * as paymentService from './service';
import { listPaymentsQuerySchema, exportPaymentsQuerySchema } from './schema';
import * as stripeUtils from './stripe';

export const listPayments = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = listPaymentsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await paymentService.listPayments(userId, parsed.data);
  return res.status(200).json({ status: 'success', data: result });
};

export const getPaymentSummary = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const stats = await paymentService.getPaymentSummary(userId);
  return res.status(200).json({ status: 'success', data: stats });
};

export const confirmPayment = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params;

  const payment = await paymentService.confirmPayment(id as string, userId);
  return res.status(200).json({ status: 'success', data: { payment } });
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params;

  const checkoutUrl = await paymentService.createStripeSession(id as string, userId);
  return res.status(200).json({ status: 'success', data: { checkoutUrl } });
};

export const uploadPaymentProof = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }

  const payment = await paymentService.uploadPaymentProof(id as string, userId, req.file.buffer);
  return res.status(200).json({ status: 'success', data: { payment } });
};

export const getPaymentProof = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { id } = req.params;

  const result = await paymentService.getPaymentProof(id as string, userId);
  return res.status(200).json({ status: 'success', data: result });
};

export const exportPayments = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = exportPaymentsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ status: 'error', message: 'Invalid query params' });
  }

  const payments = await paymentService.exportPayments(userId, parsed.data);

  // Simple CSV generation
  const headers = ['Payment ID', 'Property', 'Renter', 'Amount', 'Currency', 'Status', 'Date'];
  const rows = payments.map((p: any) => [
    p.id,
    typeof p.agreement.property.title === 'string' ? p.agreement.property.title : (p.agreement.property.title as any).en,
    `${p.agreement.renter.first_name} ${p.agreement.renter.last_name}`,
    p.amount,
    p.currency,
    p.status,
    p.createdAt.toISOString(),
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=payments-export-${Date.now()}.csv`);
  return res.status(200).send(csvContent);
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  try {
    const event = stripeUtils.verifyWebhookSignature((req as any).rawBody, sig, webhookSecret);
    await paymentService.handleStripeWebhook(event);
    return res.status(200).json({ received: true });
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
