import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(3),
    message: z.string().min(5),
  }),
});