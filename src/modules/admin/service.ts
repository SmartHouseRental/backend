import prisma from '../../config/database';
import type { Prisma } from '@prisma/client';
import type {
  AdminUpdatePropertyBodyInput,
  ApprovePropertyInput,
  GetAdminPropertiesQueryInput,
  GetAuditLogsQueryInput,
  GetOverviewQueryInput,
  GetPendingVerificationsQueryInput,
  RejectPropertyInput,
} from './schema';

function mapVerificationDocumentStatusToUserUpdate(
  status: 'approved' | 'rejected' | 'resubmit' | 'pending'
) {
  if (status === 'approved') {
    return {
      status: 'active' as const,
      verificationState: 'verified' as const,
      isVerified: true,
    };
  }

  if (status === 'rejected') {
    return {
      status: 'suspended' as const,
      verificationState: 'rejected' as const,
      isVerified: false,
    };
  }

  if (status === 'resubmit') {
    return {
      status: 'pending' as const,
      verificationState: 'resubmit' as const,
      isVerified: false,
    };
  }

  return {
    status: 'pending' as const,
    verificationState: 'pending' as const,
    isVerified: false,
  };
}

function getRangeStart(range?: '7d' | '30d' | '90d') {
  const now = new Date();

  if (!range) {
    return new Date(0);
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const msInDay = 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - days * msInDay);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function calcTrend(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return roundPercent(((current - previous) / previous) * 100);
}

function relativeTime(from: Date, to: Date) {
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.floor(diffMs / (60 * 1000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function statusLabelAndStyle(status: string) {
  if (status === 'PENDING') {
    return { statusLabel: 'Pending', statusStyle: 'bg-amber-100 text-amber-700' };
  }

  if (status === 'UNAVAILABLE') {
    return { statusLabel: 'Needs Review', statusStyle: 'bg-rose-100 text-rose-700' };
  }

  if (status === 'AVAILABLE') {
    return { statusLabel: 'Approved', statusStyle: 'bg-emerald-100 text-emerald-700' };
  }

  return { statusLabel: status, statusStyle: 'bg-slate-100 text-slate-700' };
}

export async function getPlatformAnalytics(range?: '7d' | '30d' | '90d') {
  const since = getRangeStart(range);

  const [
    totalUsers,
    totalOwners,
    totalRenters,
    verifiedOwners,
    totalProperties,
    activeProperties,
    pendingProperties,
    rentedProperties,
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    totalConversations,
    totalMessages,
    totalNotifications,
    unreadNotifications,
    totalAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'owner' } }),
    prisma.user.count({ where: { role: 'renter' } }),
    prisma.user.count({ where: { role: 'owner', isVerified: true } }),
    prisma.property.count({ where: { isDeleted: false } }),
    prisma.property.count({ where: { isDeleted: false, status: 'AVAILABLE' } }),
    prisma.property.count({ where: { isDeleted: false, status: 'PENDING' } }),
    prisma.property.count({ where: { isDeleted: false, status: 'RENTED' } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    prisma.appointment.count({ where: { status: 'ACCEPTED' } }),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.notification.count(),
    prisma.notification.count({ where: { readAt: null } }),
    prisma.auditLog.count(),
  ]);

  const [newUsersInRange, newPropertiesInRange, newMessagesInRange, newAuditLogsInRange] =
    await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.property.count({ where: { createdAt: { gte: since } } }),
      prisma.message.count({ where: { createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);

  return {
    range: range ?? 'all',
    users: {
      total: totalUsers,
      owners: totalOwners,
      renters: totalRenters,
      verifiedOwners,
      newlyCreated: newUsersInRange,
    },
    properties: {
      total: totalProperties,
      available: activeProperties,
      pending: pendingProperties,
      rented: rentedProperties,
      newlyCreated: newPropertiesInRange,
    },
    appointments: {
      total: totalAppointments,
      pending: pendingAppointments,
      accepted: confirmedAppointments,
    },
    engagement: {
      conversations: totalConversations,
      messages: totalMessages,
      newMessagesInRange,
    },
    notifications: {
      total: totalNotifications,
      unread: unreadNotifications,
    },
    audit: {
      total: totalAuditLogs,
      newInRange: newAuditLogsInRange,
    },
  };
}

export async function getAdminOverview(query: GetOverviewQueryInput) {
  const now = new Date();
  const windowDays = query.range === 'weekly' ? 7 : 30;
  const currentStart = startOfDay(shiftDays(now, -(windowDays - 1)));
  const previousStart = startOfDay(shiftDays(currentStart, -windowDays));
  const previousEnd = endOfDay(shiftDays(currentStart, -1));

  const [
    totalUsers,
    activeListings,
    pendingVerifications,
    activeAgreements,
    totalReport,
    currentUsers,
    previousUsers,
    currentListings,
    previousListings,
    currentAgreements,
    previousAgreements,
    currentReports,
    previousReports,
    recentAudit,
    pendingProperties,
    totalPayments,
    confirmedPayments,
    confirmedCollection,
    areaGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.property.count({ where: { isDeleted: false, status: 'AVAILABLE' } }),
    prisma.verificationDocument.count({ where: { status: 'pending' } }),
    prisma.agreement.count({ where: { status: 'active' } }),
    prisma.report.count(),
    prisma.user.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.user.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
    prisma.property.count({ where: { createdAt: { gte: currentStart }, isDeleted: false } }),
    prisma.property.count({
      where: { createdAt: { gte: previousStart, lte: previousEnd }, isDeleted: false },
    }),
    prisma.agreement.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.agreement.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
    prisma.report.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.report.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
    prisma.property.findMany({
      where: { isDeleted: false, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        owner: {
          select: {
            first_name: true,
            last_name: true,
            image: true,
          },
        },
      },
    }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'confirmed' } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'confirmed' },
    }),
    prisma.property.groupBy({
      by: ['address'],
      _count: { _all: true },
      where: { isDeleted: false },
      orderBy: { _count: { address: 'desc' } },
      take: 4,
    }),
  ]);

  const trendTotalUsers = calcTrend(currentUsers, previousUsers);
  const trendActiveListings = calcTrend(currentListings, previousListings);
  const trendActiveAgreements = calcTrend(currentAgreements, previousAgreements);
  const trendTotalReports = calcTrend(currentReports, previousReports);

  const userGrowthLabels: string[] = [];
  const userGrowthCurrent: number[] = [];
  const userGrowthPrevious: number[] = [];

  if (query.range === 'weekly') {
    const weekdayFmt = new Intl.DateTimeFormat('en', { weekday: 'short' });

    const weeklyBuckets = await Promise.all(
      Array.from({ length: 7 }).map(async (_, index) => {
        const currentDay = startOfDay(shiftDays(now, -(6 - index)));
        const currentDayEnd = endOfDay(currentDay);
        const previousDay = startOfDay(shiftDays(currentDay, -7));
        const previousDayEnd = endOfDay(previousDay);

        const [currentCount, previousCount] = await Promise.all([
          prisma.user.count({ where: { createdAt: { gte: currentDay, lte: currentDayEnd } } }),
          prisma.user.count({ where: { createdAt: { gte: previousDay, lte: previousDayEnd } } }),
        ]);

        return {
          label: weekdayFmt.format(currentDay),
          currentCount,
          previousCount,
        };
      })
    );

    weeklyBuckets.forEach((bucket) => {
      userGrowthLabels.push(bucket.label);
      userGrowthCurrent.push(bucket.currentCount);
      userGrowthPrevious.push(bucket.previousCount);
    });
  } else {
    const monthFmt = new Intl.DateTimeFormat('en', { month: 'short' });

    const monthlyBuckets = await Promise.all(
      Array.from({ length: 6 }).map(async (_, index) => {
        const offset = 5 - index;
        const monthRef = shiftMonths(now, -offset);
        const currentMonthStart = startOfMonth(monthRef);
        const currentMonthEnd = endOfMonth(monthRef);

        const previousMonthRef = shiftMonths(monthRef, -6);
        const previousMonthStart = startOfMonth(previousMonthRef);
        const previousMonthEnd = endOfMonth(previousMonthRef);

        const [currentCount, previousCount] = await Promise.all([
          prisma.user.count({
            where: {
              createdAt: {
                gte: currentMonthStart,
                lte: currentMonthEnd,
              },
            },
          }),
          prisma.user.count({
            where: {
              createdAt: {
                gte: previousMonthStart,
                lte: previousMonthEnd,
              },
            },
          }),
        ]);

        return {
          label: monthFmt.format(monthRef),
          currentCount,
          previousCount,
        };
      })
    );

    monthlyBuckets.forEach((bucket) => {
      userGrowthLabels.push(bucket.label);
      userGrowthCurrent.push(bucket.currentCount);
      userGrowthPrevious.push(bucket.previousCount);
    });
  }

  const recentActivity = recentAudit.map((item) => ({
    id: item.id,
    type: item.eventType,
    text: item.eventType
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    detail: item.entityId
      ? `${item.entityType} (${item.entityId}) updated`
      : `${item.entityType} updated`,
    time: relativeTime(item.createdAt, now),
    createdAt: item.createdAt,
  }));

  const recentProperties = pendingProperties.map((property) => {
    const owner = `${property.owner.first_name ?? ''} ${property.owner.last_name ?? ''}`.trim() || 'Unknown';
    const [firstImage] = property.images ?? [];
    const statusMeta = statusLabelAndStyle(property.status);

    return {
      id: property.id,
      name:
        (property.title as { en?: string; am?: string } | null)?.en ??
        (property.title as { en?: string; am?: string } | null)?.am ??
        'Untitled Property',
      owner,
      ownerAvatar: property.owner.image,
      location: property.address ?? property.location,
      status: property.status,
      statusLabel: statusMeta.statusLabel,
      statusStyle: statusMeta.statusStyle,
      dateSubmitted: property.createdAt,
      image: firstImage ?? null,
    };
  });

  const totalListingsCount = areaGroups.reduce((sum, item) => sum + item._count._all, 0);
  const listingsByArea = areaGroups.map((item) => {
    const rawAddress = (item.address ?? '').trim();
    const area = rawAddress ? rawAddress.split(',')[0].trim() : 'Unknown';
    const percentage = totalListingsCount
      ? Math.round((item._count._all / totalListingsCount) * 100)
      : 0;

    return {
      area,
      count: item._count._all,
      percentage,
    };
  });

  const successRate = totalPayments > 0 ? Math.round((confirmedPayments / totalPayments) * 100) : 0;

  return {
    lastUpdated: now.toISOString(),
    stats: {
      totalUsers: {
        value: totalUsers,
        trendPercent: trendTotalUsers,
      },
      activeListings: {
        value: activeListings,
        trendPercent: trendActiveListings,
      },
      pendingVerifications: {
        value: pendingVerifications,
        actionNeeded: pendingVerifications > 0,
      },
      activeAgreements: {
        value: activeAgreements,
        trendPercent: trendActiveAgreements,
      },
      totalReport: {
        value: totalReport,
        trendPercent: trendTotalReports,
      },
    },
    userGrowth: {
      range: query.range,
      labels: userGrowthLabels,
      currentPeriod: userGrowthCurrent,
      previousPeriod: userGrowthPrevious,
    },
    recentActivity,
    listingsByArea,
    paymentPerformance: {
      successRate,
      totalCollectionAmount: confirmedCollection._sum.amount ?? 0,
      currency: 'ETB',
      label: successRate >= 90 ? 'On Time Collection' : 'Needs Attention',
    },
    recentProperties,
  };
}

export async function getPendingVerifications(query: GetPendingVerificationsQueryInput) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.UserWhereInput = {
    role: 'owner' as const,
    isVerified: false,
    ...(query.emailVerified !== undefined ? { emailVerified: query.emailVerified } : {}),
    ...(query.search
      ? {
          OR: [
            { first_name: { contains: query.search, mode: 'insensitive' } },
            { last_name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { [query.sortBy]: query.order },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        verificationDocs: {
          select: {
            id: true,
            submittedAt: true,
            frontUrl: true,
            backUrl: true,
            livePhotoUrl: true,
            status: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const now = new Date();
  const items = users.map((user) => {
    const doc = user.verificationDocs[0] ?? null;
    const submittedDate = doc?.submittedAt ?? null;
    const daysWaiting = submittedDate
      ? Math.max(0, Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Report which of the three files have been uploaded
    const documents: string[] = [];
    if (doc?.frontUrl) documents.push('NATIONAL_ID_FRONT');
    if (doc?.backUrl) documents.push('NATIONAL_ID_BACK');
    if (doc?.livePhotoUrl) documents.push('OWNER_PHOTO');

    return {
      id: user.id,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      email: user.email,
      phone: user.phone,
      submittedDate,
      daysWaiting,
      documents,
      docStatus: doc?.status ?? null,
    };
  });

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getAuditLogs(query: GetAuditLogsQueryInput) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.AuditLogWhereInput = {
    ...(query.search
      ? {
          OR: [
            { eventType: { contains: query.search, mode: 'insensitive' } },
            { entityType: { contains: query.search, mode: 'insensitive' } },
            { entityId: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { [query.sortBy]: query.order },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function adminOverrideUpdateProperty(
  adminId: string,
  propertyId: string,
  payload: AdminUpdatePropertyBodyInput
) {
  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: payload,
  });

  const changedFields = Object.keys(payload);

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'ADMIN_PROPERTY_OVERRIDE_UPDATE',
      entityType: 'Property',
      entityId: propertyId,
      metadata: {
        changedFields,
      } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function approveProperty(adminId: string, propertyId: string, payload: ApprovePropertyInput) {
  const existing = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!existing) return null;

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { status: 'AVAILABLE' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'ADMIN_PROPERTY_APPROVED',
      entityType: 'Property',
      entityId: propertyId,
      metadata: {
        note: payload.note ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function rejectProperty(adminId: string, propertyId: string, payload: RejectPropertyInput) {
  const existing = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!existing) return null;

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { status: 'UNAVAILABLE' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'ADMIN_PROPERTY_REJECTED',
      entityType: 'Property',
      entityId: propertyId,
      metadata: {
        reason: payload.reason,
        note: payload.note ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

// -------------------------------------------------------------------------------- //
// NEW ADMIN SERVICES FOR FULL MODULE SUPPORT (Users, Properties, Agreements, etc.) //
// -------------------------------------------------------------------------------- //

export async function getUsers(query: import('./schema').GetUsersQueryInput) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { first_name: { contains: query.search, mode: 'insensitive' } },
            { last_name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        status: true,
        verificationState: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, meta: { total, page: query.page, limit: query.limit } };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserStatus(adminId: string, id: string, status: any) {
  const user = await prisma.user.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'USER_STATUS_UPDATE',
      entityType: 'User',
      entityId: id,
      metadata: { status },
    },
  });

  return user;
}

export async function updateUserVerificationState(
  adminId: string,
  id: string,
  verificationState: any,
  comment?: string
) {
  // Set isVerified and status appropriately when marking verified
  const dataToUpdate: any = { verificationState };
  if (verificationState === 'verified') {
    dataToUpdate.isVerified = true;
    dataToUpdate.status = 'active';
  } else {
    dataToUpdate.isVerified = false;
  }

  const user = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'USER_VERIFICATION_UPDATE',
      entityType: 'User',
      entityId: id,
      metadata: { verificationState, comment } as Prisma.InputJsonValue,
    },
  });

  return user;
}

export async function getProperties(query: GetAdminPropertiesQueryInput) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.PropertyWhereInput = {
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { address: { contains: query.search, mode: 'insensitive' } },
            { owner: { first_name: { contains: query.search, mode: 'insensitive' } } },
            { owner: { last_name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            image: true,
          },
        },
      },
    }),
    prisma.property.count({ where }),
  ]);
  return {
    items,
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getAgreements(query: any) {
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.agreement.findMany({ skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
    prisma.agreement.count(),
  ]);
  return { items, meta: { total, page: query.page, limit: query.limit } };
}

export async function getAgreementById(id: string) {
  return prisma.agreement.findUnique({ where: { id } });
}

export async function createAgreement(adminId: string, data: any) {
  const agreement = await prisma.agreement.create({ data });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'AGREEMENT_CREATED',
      entityType: 'Agreement',
      entityId: agreement.id,
    },
  });
  return agreement;
}

export async function updateAgreementStatus(adminId: string, id: string, status: any) {
  const agreement = await prisma.agreement.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'AGREEMENT_STATUS_UPDATE',
      entityType: 'Agreement',
      entityId: id,
      metadata: { status },
    },
  });
  return agreement;
}

export async function getReports(query: any) {
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: { reportedBy: true },
    }),
    prisma.report.count(),
  ]);
  return { items, meta: { total, page: query.page, limit: query.limit } };
}

export async function updateReportStatus(adminId: string, id: string, status: any) {
  const report = await prisma.report.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'REPORT_STATUS_UPDATE',
      entityType: 'Report',
      entityId: id,
      metadata: { status },
    },
  });
  return report;
}

export async function resolveVerification(
  adminId: string,
  id: string,
  status: 'approved' | 'rejected' | 'resubmit' | 'pending'
) {
  const doc = await prisma.verificationDocument.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedById: adminId },
  });

  const userUpdate = mapVerificationDocumentStatusToUserUpdate(status);

  await prisma.user.update({
    where: { id: doc.userId },
    data: userUpdate,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'VERIFICATION_RESOLVED',
      entityType: 'VerificationDocument',
      entityId: id,
      metadata: { status },
    },
  });

  return doc;
}

export async function getPropertyById(id: string) {
  return await prisma.property.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, image: true, phone: true } },
    },
  });
}

export async function getReportById(id: string) {
  return await prisma.report.findUnique({
    where: { id },
    include: { reportedBy: { select: { id: true, first_name: true, last_name: true } } },
  });
}

export async function getNotifications(query: any) {
  const { page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const data = await prisma.notification.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, first_name: true, last_name: true } } },
  });
  const total = await prisma.notification.count();

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function broadcastNotification(adminId: string, payload: any) {
  const { audience, title, message } = payload;

  let userFilter: any = {};
  if (audience === 'renters') userFilter = { role: 'renter' };
  else if (audience === 'owners') userFilter = { role: 'owner' };
  else if (audience === 'verified_owners') userFilter = { role: 'owner', isVerified: true };

  const users = await prisma.user.findMany({ where: userFilter, select: { id: true } });

  const notifications = users.map((u) => ({
    userId: u.id,
    type: 'MESSAGE_NEW' as const,
    title,
    body: message,
    payload: { broadcast: true },
  }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'BROADCAST_SENT',
      entityType: 'Notification',
      metadata: { audience, title, count: notifications.length },
    },
  });

  return { success: true, count: notifications.length };
}

export async function getReviews(query: any) {
  const { page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;
  // Use 'any' type temporarily to bypass strict Prisma type checking if the schema isn't generated yet
  const prismaAny = prisma as any;
  if (!prismaAny.review) return { data: [], meta: { total: 0 } };

  const data = await prismaAny.review.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { id: true, first_name: true, last_name: true } } },
  });
  const total = await prismaAny.review.count();

  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function updateReviewStatus(adminId: string, id: string, status: any) {
  const prismaAny = prisma as any;
  if (!prismaAny.review) throw new Error('Review model not generated');

  const updated = await prismaAny.review.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      eventType: 'REVIEW_STATUS_UPDATED',
      entityType: 'Review',
      entityId: id,
      metadata: { status },
    },
  });

  return updated;
}

export async function deleteReview(adminId: string, id: string) {
  const prismaAny = prisma as any;
  if (!prismaAny.review) throw new Error('Review model not generated');

  const deleted = await prismaAny.review.delete({
    where: { id },
  });

  await prisma.auditLog.create({
    data: { actorId: adminId, eventType: 'REVIEW_DELETED', entityType: 'Review', entityId: id },
  });

  return deleted;
}
