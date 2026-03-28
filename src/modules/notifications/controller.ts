import { Request, Response } from 'express';
import * as notificationService from './service';

export async function getMyNotifications(req: Request, res: Response) {
  const userId = (req as any).userId;

  const notifications = await notificationService.getUserNotifications(userId);

  res.json({ status: 'success', data: notifications });
}

export async function markNotificationRead(req: Request, res: Response) {
  const userId = (req as any).userId;
   const id = req.params.id as string;

  await notificationService.markAsRead(userId, id);

  res.json({ status: 'success', message: 'Notification marked as read' });
}
export async function broadcast(req: Request, res: Response) {
  const { message } = req.body;

  const result = await notificationService.broadcast(message);

  res.json({ status: 'success', data: result });
}