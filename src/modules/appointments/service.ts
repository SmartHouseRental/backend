import prisma from '../../config/database';
import { AppError } from '../../core/AppError';
import { logger } from '../../core/logger';
import { sendEmail } from '../../emails/emailService';
import { createAuditLog, createNotification } from '../notifications/service';
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentNoteInput,
  UpdateAppointmentStatusInput,
} from './schema';

const appointmentSelect = {
  id: true,
  propertyId: true,
  renterId: true,
  ownerId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  property: {
    select: {
      id: true,
      title: true,
      address: true,
    },
  },
  renter: {
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
    },
  },
  owner: {
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
    },
  },
} as const;

async function notifyOwnerOfNewBooking(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      property: { select: { title: true, address: true } },
      renter: { select: { email: true, first_name: true, last_name: true } },
      owner: { select: { email: true, first_name: true } },
    },
  });

  if (!appointment) return;

  logger.info('New appointment booking request created', {
    appointmentId: appointment.id,
    ownerEmail: appointment.owner.email,
  });

  if (!appointment.owner.email) return;

  try {
    await sendEmail(
      'appointmentRequest',
      appointment.owner.email,
      {
        ownerFirstName: appointment.owner.first_name ?? 'there',
        renterName:
          [appointment.renter.first_name, appointment.renter.last_name].filter(Boolean).join(' ') ||
          appointment.renter.email ||
          'Renter',
        propertyTitle: appointment.property.title,
        propertyAddress: appointment.property.address,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
      },
      'New property visit booking request'
    );
  } catch (error) {
    logger.warn('Could not send appointment request email', {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function bookAppointment(
  userId: string,
  userRole: string,
  input: CreateAppointmentInput
) {
  if (userRole !== 'renter') {
    throw new AppError('Only renters can book appointments', 403);
  }

  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true, ownerId: true },
  });

  if (!property) throw new AppError('Property not found', 404);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) throw new AppError('User account not found. Please log in again.', 404);

  if (property.ownerId === userId) {
    throw new AppError('You cannot book an appointment for your own property', 400);
  }

  const overlapping = await prisma.appointment.findFirst({
    where: {
      renterId: userId,
      status: { in: ['PENDING', 'ACCEPTED'] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
  });

  if (overlapping) {
    throw new AppError('You already have an overlapping appointment', 409);
  }

  const appointment = await prisma.appointment.create({
    data: {
      propertyId: property.id,
      renterId: userId,
      ownerId: property.ownerId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note ?? null,
    },
    select: appointmentSelect,
  });

  await notifyOwnerOfNewBooking(appointment.id);

  await createNotification({
    userId: appointment.ownerId,
    type: 'APPOINTMENT_BOOKED',
    title: 'New booking request',
    body: `A renter requested a visit for ${appointment.property.title}`,
    payload: {
      appointmentId: appointment.id,
      propertyId: appointment.propertyId,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
    },
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'APPOINTMENT_BOOKED',
    entityType: 'Appointment',
    entityId: appointment.id,
    metadata: {
      propertyId: appointment.propertyId,
      ownerId: appointment.ownerId,
      renterId: appointment.renterId,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
    },
  });

  return appointment;
}

export async function listAppointments(
  userId: string,
  userRole: string,
  query: ListAppointmentsQuery
) {
  const where: any = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.from || query.to
      ? {
          startsAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  if (userRole === 'renter') {
    where.renterId = userId;
  } else if (userRole === 'owner') {
    where.ownerId = userId;
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    select: appointmentSelect,
  });
}

export async function updateAppointmentStatus(
  userId: string,
  userRole: string,
  appointmentId: string,
  input: UpdateAppointmentStatusInput
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      ownerId: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });

  if (!appointment) throw new AppError('Appointment not found', 404);

  const canManage = userRole === 'admin' || appointment.ownerId === userId;
  if (!canManage) throw new AppError('Only owner/agent can update appointment status', 403);

  if (input.status === 'ACCEPTED') {
    const overlap = await prisma.appointment.findFirst({
      where: {
        ownerId: appointment.ownerId,
        id: { not: appointment.id },
        status: 'ACCEPTED',
        startsAt: { lt: appointment.endsAt },
        endsAt: { gt: appointment.startsAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new AppError('Time slot is no longer available for owner', 409);
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: input.status,
    },
    select: appointmentSelect,
  });

  await createNotification({
    userId: updated.renterId,
    type: 'APPOINTMENT_UPDATED',
    title: 'Appointment updated',
    body: `Your appointment status is now ${updated.status}`,
    payload: {
      appointmentId: updated.id,
      status: updated.status,
      propertyId: updated.propertyId,
    },
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'APPOINTMENT_STATUS_UPDATED',
    entityType: 'Appointment',
    entityId: updated.id,
    metadata: { previousStatus: appointment.status, status: updated.status },
  });

  return updated;
}

export async function deleteAppointment(userId: string, userRole: string, appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      renterId: true,
      ownerId: true,
    },
  });

  if (!appointment) throw new AppError('Appointment not found', 404);

  const canDelete =
    userRole === 'admin' || appointment.renterId === userId || appointment.ownerId === userId;

  if (!canDelete) {
    throw new AppError('You do not have permission to delete this appointment', 403);
  }

  await prisma.appointment.delete({ where: { id: appointmentId } });

  const notificationRecipientId =
    appointment.renterId === userId ? appointment.ownerId : appointment.renterId;

  await createNotification({
    userId: notificationRecipientId,
    type: 'APPOINTMENT_UPDATED',
    title: 'Appointment deleted',
    body: 'An appointment was deleted by one of the participants',
    payload: { appointmentId },
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'APPOINTMENT_DELETED',
    entityType: 'Appointment',
    entityId: appointmentId,
    metadata: {
      renterId: appointment.renterId,
      ownerId: appointment.ownerId,
    },
  });

  return { id: appointmentId };
}

export async function updateAppointmentNote(
  userId: string,
  userRole: string,
  appointmentId: string,
  input: UpdateAppointmentNoteInput
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      ownerId: true,
      note: true,
    },
  });

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  const canUpdateNote = userRole === 'admin' || appointment.ownerId === userId;
  if (!canUpdateNote) {
    throw new AppError('Only owner/agent can update appointment note', 403);
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { note: input.note },
    select: appointmentSelect,
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'APPOINTMENT_NOTE_UPDATED',
    entityType: 'Appointment',
    entityId: updated.id,
    metadata: {
      previousNote: appointment.note,
      note: updated.note,
    },
  });

  return updated;
}
