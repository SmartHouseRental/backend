import { Request, Response } from 'express';
import * as supportService from './service';
import { createTicketSchema } from './schema';

export async function createTicket(req: Request, res: Response) {
  const userId = (req as any).userId;

  const parsed = createTicketSchema.safeParse({
    body: req.body,
  });

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
    });
  }

  const ticket = await supportService.createTicket(
    userId,
    parsed.data.body
  );

  res.status(201).json({
    status: 'success',
    data: ticket,
  });
}

export async function getMyTickets(req: Request, res: Response) {
  const userId = (req as any).userId;

  const tickets = await supportService.getMyTickets(userId);

  res.status(200).json({
    status: 'success',
    data: tickets,
  });
}

export async function getFaq(req: Request, res: Response) {
  const faq = await supportService.getFaq();

  res.status(200).json({
    status: 'success',
    data: faq,
  });
}