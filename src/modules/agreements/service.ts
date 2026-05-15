import prisma from '../../config/database';
import { AppError } from '../../core/AppError';

type ListQuery = { page: number; limit: number; search?: string; status?: string };

export async function listOwnerAgreements(ownerId: string, query: ListQuery) {
  const where: any = { ownerId };

  if (query.search) {
    where.OR = [
      { id: { contains: query.search } },
      { property: { title: { contains: query.search } } },
      { renter: { first_name: { contains: query.search } } },
    ];
  }

  if (query.status) {
    where.status = query.status;
  }

  const items = await prisma.agreement.findMany({
    where,
    include: {
      property: { select: { id: true, title: true, address: true } },
      renter: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  const total = await prisma.agreement.count({ where });

  return { items, meta: { page: query.page, limit: query.limit, total } };
}

export async function exportOwnerAgreements(ownerId: string, _query: any) {
  const agreements = await prisma.agreement.findMany({
    where: { ownerId },
    include: { property: true, renter: true },
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['Agreement ID', 'Property', 'Renter', 'Monthly Rent', 'Status', 'Start Date'];
  const rows = agreements.map((a) => [
    a.id,
    typeof a.property.title === 'string' ? a.property.title : (a.property.title as any).en,
    `${a.renter.first_name} ${a.renter.last_name}`,
    String(a.monthlyRent),
    a.status,
    a.startDate?.toISOString() ?? '',
  ]);

  return [headers, ...rows].map((r) => r.join(',')).join('\n');
}

export async function getAgreementDetail(agreementId: string, requesterId?: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: {
      property: true,
      renter: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
      payments: true,
    },
  });

  if (!agreement) throw new AppError('Agreement not found', 404);

  // Optionally hide sensitive data if requester is neither owner nor renter
  if (requesterId && requesterId !== agreement.ownerId && requesterId !== agreement.renterId) {
    // remove contact details
    if (agreement.renter) {
      (agreement.renter as any).email = undefined;
      (agreement.renter as any).phone = undefined;
    }
    if (agreement.owner) {
      (agreement.owner as any).email = undefined;
      (agreement.owner as any).phone = undefined;
    }
  }

  return agreement;
}

export async function listAgreementPayments(agreementId: string) {
  const payments = await prisma.payment.findMany({
    where: { agreementId },
    orderBy: { paidAt: 'desc' },
  });
  return payments;
}

export async function createAgreementPayment(
  agreementId: string,
  actorId: string,
  data: { amount?: number; currency?: string; filePath?: string }
) {
  // verify agreement exists
  const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
  if (!agreement) throw new AppError('Agreement not found', 404);

  // create payment record
  const payment = await prisma.payment.create({
    data: {
      agreementId,
      amount: data.amount ?? agreement.monthlyRent,
      currency: data.currency ?? 'ETB',
      proofUrl: data.filePath,
      status: data.filePath ? 'proof_uploaded' : 'pending',
    },
  });

  // update agreement paymentStatus if necessary
  if (payment.status === 'proof_uploaded') {
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { paymentStatus: 'proof_uploaded' },
    });
  }

  return payment;
}

export async function updateAgreement(
  agreementId: string,
  requesterId: string,
  data: { status?: string; paymentStatus?: string }
) {
  const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
  if (!agreement) throw new AppError('Agreement not found', 404);

  if (agreement.ownerId !== requesterId) {
    throw new AppError('Forbidden', 403);
  }

  const updated = await prisma.agreement.update({
    where: { id: agreementId },
    data: { status: data.status as any, paymentStatus: data.paymentStatus as any },
  });
  return updated;
}

export async function terminateAgreement(
  agreementId: string,
  requesterId: string,
  reason?: string
) {
  const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
  if (!agreement) throw new AppError('Agreement not found', 404);
  if (agreement.ownerId !== requesterId) throw new AppError('Forbidden', 403);

  const updated = await prisma.agreement.update({
    where: { id: agreementId },
    data: { status: 'terminated' },
  });

  // create audit log
  await prisma.auditLog.create({
    data: {
      actorId: requesterId,
      eventType: 'AGREEMENT_TERMINATED',
      entityType: 'Agreement',
      entityId: agreementId,
      metadata: { reason },
    },
  });

  return updated;
}
