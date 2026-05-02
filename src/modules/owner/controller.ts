import { Request, Response } from 'express';
import * as ownerService from './service';

export async function analytics(req: Request, res: Response) {
  const ownerId = (req as any).userId;

  const data = await ownerService.getOwnerAnalytics(ownerId);

  return res.status(200).json({
    status: 'success',
    data,
  });
}