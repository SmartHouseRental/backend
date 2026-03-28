import { sendEmail } from '../../utils/email';
import prisma from '../../config/database';

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markAsRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function createNotification(data: {
  userId?: string;
  title: string;
  message: string;
  type: string;
}) {
  return prisma.notification.create({
    data,
  });
}
export async function broadcast(message: string) {
  
  const users = await prisma.user.findMany({
    select: { id: true,email:true },
  });

  const notifications = users.map((user) => ({
    userId: user.id,
    title:'System Announcement',
    message,
    type:'SYSTEM',
  }));

  await prisma.notification.createMany({
    data: notifications,
  });
 for (const user of users) {
    if(user.email){
      await sendEmail(user.email, 'System Announcement', message)
    }
  }
  return { count: notifications.length };
}