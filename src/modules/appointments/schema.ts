import { z } from 'zod';

export const createAppointmentSchema = z
  .object({
    propertyId: z.string().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    note: z.string().max(500).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const listAppointmentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']).optional(),
  propertyId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
});

export const updateAppointmentNoteSchema = z.object({
  note: z.string().max(500),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type UpdateAppointmentNoteInput = z.infer<typeof updateAppointmentNoteSchema>;
