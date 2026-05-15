import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/request';
import * as appointmentService from './service';
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentNoteSchema,
  updateAppointmentStatusSchema,
} from './schema';

export async function book(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const parsed = createAppointmentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const appointment = await appointmentService.bookAppointment(
    auth.userId,
    auth.userRole,
    parsed.data
  );
  return res.status(201).json({ status: 'success', data: { appointment } });
}

export async function list(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const parsed = listAppointmentsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const appointments = await appointmentService.listAppointments(
    auth.userId,
    auth.userRole,
    parsed.data
  );
  return res.status(200).json({ status: 'success', data: { appointments } });
}

export async function updateStatus(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const appointmentId = String(req.params.id);
  const parsed = updateAppointmentStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const appointment = await appointmentService.updateAppointmentStatus(
    auth.userId,
    auth.userRole,
    appointmentId,
    parsed.data
  );

  return res.status(200).json({ status: 'success', data: { appointment } });
}

export async function remove(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const appointmentId = String(req.params.id);

  const result = await appointmentService.deleteAppointment(
    auth.userId,
    auth.userRole,
    appointmentId
  );

  return res.status(200).json({ status: 'success', data: result });
}

export async function updateNote(req: Request, res: Response) {
  const auth = req as AuthenticatedRequest;
  const appointmentId = String(req.params.id);
  const parsed = updateAppointmentNoteSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const appointment = await appointmentService.updateAppointmentNote(
    auth.userId,
    auth.userRole,
    appointmentId,
    parsed.data
  );

  return res.status(200).json({ status: 'success', data: { appointment } });
}
