import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/request';
import * as agreementService from './service';

export const listOwnerAgreements = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string;
  const { page = '1', limit = '20', search = '', status } = req.query as any;

  const result = await agreementService.listOwnerAgreements(userId, {
    page: Number(page),
    limit: Number(limit),
    search: String(search || ''),
    status: status ? String(status) : undefined,
  });

  return res.status(200).json({ status: 'success', data: result });
};

export const exportOwnerAgreements = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string;
  const csv = await agreementService.exportOwnerAgreements(userId, req.query as any);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=agreements-${Date.now()}.csv`);
  return res.status(200).send(csv);
};

export const getAgreementDetail = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string | undefined;
  const id = String(req.params.id);
  if (!id) return res.status(400).json({ status: 'error', message: 'Agreement id is required' });

  const agreement = await agreementService.getAgreementDetail(id, userId);
  return res.status(200).json({ status: 'success', data: { agreement } });
};

export const listAgreementPayments = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id) return res.status(400).json({ status: 'error', message: 'Agreement id is required' });

  const payments = await agreementService.listAgreementPayments(id);
  return res.status(200).json({ status: 'success', data: payments });
};

export const createAgreementPayment = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string;
  const id = String(req.params.id);
  if (!id) return res.status(400).json({ status: 'error', message: 'Agreement id is required' });
  const amount = req.body.amount ? Number(req.body.amount) : undefined;
  const currency = req.body.currency || 'ETB';

  const file = (req as any).file;

  const payment = await agreementService.createAgreementPayment(id, userId, {
    amount,
    currency,
    filePath: file ? `/uploads/${file.filename}` : undefined,
  });

  return res.status(201).json({ status: 'success', data: { payment } });
};

export const updateAgreement = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string;
  const id = String(req.params.id);
  if (!id) return res.status(400).json({ status: 'error', message: 'Agreement id is required' });
  const { status, paymentStatus } = req.body;

  const agreement = await agreementService.updateAgreement(id, userId, { status, paymentStatus });
  return res.status(200).json({ status: 'success', data: { agreement } });
};

export const terminateAgreement = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId as string;
  const id = String(req.params.id);
  if (!id) return res.status(400).json({ status: 'error', message: 'Agreement id is required' });
  const { reason } = req.body;

  const agreement = await agreementService.terminateAgreement(id, userId, reason);
  return res.status(200).json({ status: 'success', data: { agreement } });
};
