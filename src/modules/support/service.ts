import prisma from '../../config/database';

export async function createTicket(userId: string, data: any) {
  return prisma.auditLog.create({
    data: {
      actorId: userId,
      eventType: 'SUPPORT_TICKET',
      entityType: 'SUPPORT',
      metadata: data,
    },
  });
}

export async function getMyTickets(userId: string) {
  return prisma.auditLog.findMany({
    where: {
      actorId: userId,
      eventType: 'SUPPORT_TICKET',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getFaq() {
  return [
    {
      question: 'How do I add a property?',
      answer: 'Go to Properties page and click Add Property.',
    },
    {
      question: 'Why is my property pending?',
      answer: 'Admin approval may be required.',
    },
    {
      question: 'How do payments work?',
      answer: 'Payments are confirmed through agreements.',
    },
  ];
}