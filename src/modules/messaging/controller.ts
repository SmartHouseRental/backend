import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/request';
import * as messagingService from './service';
import {
  createConversationSchema,
  createMessageSchema,
  listMessagesQuerySchema,
  messageReactionSchema,
  sendAttachmentSchema,
  updateMessageStatusSchema,
} from './schema';

export async function listConversations(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversations = await messagingService.listConversations(userId);
  return res.status(200).json({ status: 'success', data: { conversations } });
}

export async function createConversation(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const conversation = await messagingService.createConversation(userId, parsed.data);
  return res.status(201).json({ status: 'success', data: { conversation } });
}

export async function listMessages(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = String(req.params.id);
  const parsed = listMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await messagingService.listMessages(conversationId, userId, parsed.data);
  return res.status(200).json({ status: 'success', data: result });
}

export async function sendMessage(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = String(req.params.id);
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await messagingService.sendMessage(conversationId, userId, parsed.data);
  return res.status(201).json({ status: 'success', data: { message: result.message } });
}

export async function updateMessageStatus(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = String(req.params.id);
  const parsed = updateMessageStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await messagingService.updateMessageStatus(messageId, userId, parsed.data);
  return res.status(200).json({ status: 'success', data: { message: result.message } });
}

export async function sendAttachment(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = String(req.params.id);
  const file = (req as Request & { file?: Express.Multer.File }).file;

  if (!file) {
    return res.status(400).json({ status: 'error', message: 'File is required' });
  }

  const parsed = sendAttachmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const result = await messagingService.sendAttachment(conversationId, userId, file, parsed.data);
  return res.status(201).json({ status: 'success', data: { message: result.message } });
}

export async function addReaction(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = String(req.params.id);
  const parsed = messageReactionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const message = await messagingService.addReaction(messageId, userId, parsed.data);
  return res.status(200).json({ status: 'success', data: { message } });
}

export async function removeReaction(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = String(req.params.id);
  const parsed = messageReactionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const message = await messagingService.removeReaction(messageId, userId, parsed.data);
  return res.status(200).json({ status: 'success', data: { message } });
}

export async function deleteMessage(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const messageId = String(req.params.id);

  const result = await messagingService.deleteMessage(messageId, userId);
  return res.status(200).json({ status: 'success', data: result });
}

export async function markRead(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = String(req.params.id);

  const result = await messagingService.markConversationAsRead(conversationId, userId);
  return res.status(200).json({ status: 'success', data: result });
}

export async function getMetadata(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = String(req.params.id);

  const conversation = await messagingService.getConversationMetadata(conversationId, userId);
  return res.status(200).json({ status: 'success', data: { conversation } });
}
