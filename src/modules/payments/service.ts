import prisma from '../../config/database';
import { AppError } from '../../core/AppError';
import { ListPaymentsQuery, ExportPaymentsQuery } from './schema';
import * as stripeUtils from './stripe';
import { uploadToCloudinary } from '../../utils/uploadToCloudinary';

export const listPayments = async (userId: string, query: ListPaymentsQuery) => {
  const { page, limit, status, search } = query;
  const skip = (page - 1) * limit;

  const where = {
    agreement: {
      OR: [
        { ownerId: userId },
        { renterId: userId },
      ],
    },
    ...(status && { status }),
    ...(search && {
      OR: [
        { id: { contains: search, mode: 'insensitive' as const } },
        { agreement: { property: { title: { path: ['en'], string_contains: search } } } },
        { agreement: { property: { title: { path: ['am'], string_contains: search } } } },
        { agreement: { renter: { first_name: { contains: search, mode: 'insensitive' as const } } } },
        { agreement: { renter: { last_name: { contains: search, mode: 'insensitive' as const } } } },
      ],
    }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        agreement: {
          select: {
            property: { select: { title: true } },
            renter: { select: { first_name: true, last_name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPaymentSummary = async (userId: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalReceived, pendingAmount, thisMonth] = await Promise.all([
    // Total Received
    prisma.payment.aggregate({
      where: {
        agreement: { ownerId: userId },
        status: 'confirmed',
      },
      _sum: { amount: true },
    }),
    // Pending Amount
    prisma.payment.aggregate({
      where: {
        agreement: { ownerId: userId },
        status: { in: ['pending', 'proof_uploaded'] },
      },
      _sum: { amount: true },
    }),
    // This Month
    prisma.payment.aggregate({
      where: {
        agreement: { ownerId: userId },
        status: 'confirmed',
        confirmedAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalReceived: totalReceived._sum.amount || 0,
    pendingAmount: pendingAmount._sum.amount || 0,
    thisMonth: thisMonth._sum.amount || 0,
  };
};

export const confirmPayment = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { 
      agreement: {
        include: {
          renter: true,
          property: true
        }
      } 
    },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.agreement.ownerId !== userId) throw new AppError('Unauthorized', 403);
  if (payment.status === 'confirmed') throw new AppError('Payment already confirmed', 400);

  const updatedPayment = await prisma.$transaction(async (tx) => {
    // 1. Update Payment Status
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    // 2. Update Agreement Status
    await tx.agreement.update({
      where: { id: payment.agreementId },
      data: { paymentStatus: 'confirmed' }
    });

    // 3. Create Notification for Renter
    await tx.notification.create({
      data: {
        userId: payment.agreement.renterId,
        type: 'PAYMENT_CONFIRMED',
        title: 'Payment Confirmed',
        body: `Your payment for ${typeof payment.agreement.property.title === 'string' ? payment.agreement.property.title : (payment.agreement.property.title as any).en} has been confirmed.`,
      }
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        eventType: 'payment.confirmed',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { amount: payment.amount, agreementId: payment.agreementId }
      }
    });

    return p;
  });

  return updatedPayment;
};

export const uploadPaymentProof = async (paymentId: string, userId: string, fileBuffer: Buffer) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { agreement: true },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.agreement.renterId !== userId) throw new AppError('Only the renter can upload proof', 403);

  const proofUrl = await uploadToCloudinary(fileBuffer, 'payment_proofs', 'image');

  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        proofUrl,
        status: 'proof_uploaded',
      },
    });

    await tx.agreement.update({
      where: { id: payment.agreementId },
      data: { paymentStatus: 'proof_uploaded' }
    });

    return p;
  });
};

export const getPaymentProof = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { agreement: true },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.agreement.ownerId !== userId && payment.agreement.renterId !== userId) {
    throw new AppError('Unauthorized', 403);
  }

  return { proofUrl: payment.proofUrl };
};

export const exportPayments = async (userId: string, query: ExportPaymentsQuery) => {
  const { status, search } = query;

  const where = {
    agreement: { ownerId: userId },
    ...(status && { status }),
    ...(search && {
      OR: [
        { id: { contains: search, mode: 'insensitive' as const } },
        { agreement: { property: { title: { path: ['en'], string_contains: search } } } },
        { agreement: { property: { title: { path: ['am'], string_contains: search } } } },
        { agreement: { renter: { first_name: { contains: search, mode: 'insensitive' as const } } } },
        { agreement: { renter: { last_name: { contains: search, mode: 'insensitive' as const } } } },
      ],
    }),
  };

  return prisma.payment.findMany({
    where,
    include: {
      agreement: {
        select: {
          property: { select: { title: true } },
          renter: { select: { first_name: true, last_name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const createStripeSession = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { agreement: { include: { property: true } } },
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.agreement.renterId !== userId) throw new AppError('Only the renter can pay for this agreement', 403);
  if (payment.status === 'confirmed') throw new AppError('Payment already confirmed', 400);

  const titleJson = payment.agreement.property.title as any;
  const propertyTitle = typeof titleJson === 'string' 
    ? titleJson 
    : (titleJson?.en || titleJson?.am || 'Property Rent');

  const session = await stripeUtils.createCheckoutSession({
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    propertyTitle,
    successUrl: `${process.env.APP_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.APP_BASE_URL}/payment/cancel`,
  });

  await prisma.payment.update({
    where: { id: paymentId },
    data: { stripeId: session.id },
  });

  return session.url;
};

export const handleStripeWebhook = async (event: any) => {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const paymentId = session.metadata.paymentId;

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });
  }
};
