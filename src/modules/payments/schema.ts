import { z } from 'zod';

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(6),
  status: z.enum(['confirmed', 'proof_uploaded', 'pending']).optional(),
  search: z.string().optional(),
});

export const exportPaymentsQuerySchema = z.object({
  status: z.enum(['confirmed', 'proof_uploaded', 'pending']).optional(),
  search: z.string().optional(),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ExportPaymentsQuery = z.infer<typeof exportPaymentsQuerySchema>;
