import prisma from '../../config/database';
import { AppError } from '../../core/AppError';
import { createAuditLog, createNotification } from '../notifications/service';
import type {
  CreateConversationInput,
  CreateMessageInput,
  ListMessagesQuery,
  MessageReactionInput,
  SendAttachmentInput,
  UpdateMessageStatusInput,
} from './schema';

const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
];

function getMessageTypeByMime(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  content: true,
  status: true,
  createdAt: true,
  replyTo: {
    select: {
      id: true,
      senderId: true,
      type: true,
      content: true,
      createdAt: true,
      attachments: {
        select: {
          id: true,
          url: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
        },
      },
    },
  },
  attachments: {
    select: {
      id: true,
      url: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
    },
  },
  reactions: {
    select: {
      id: true,
      emoji: true,
      userId: true,
      createdAt: true,
    },
  },
} as const;

function ensureParticipant(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ renterId: userId }, { ownerId: userId }],
    },
  });
}

async function validateReplyTarget(replyToId: string | undefined, conversationId: string) {
  if (!replyToId) return;

  const replyTarget = await prisma.message.findUnique({
    where: { id: replyToId },
    select: { id: true, conversationId: true },
  });

  if (!replyTarget) {
    throw new AppError('Reply target message not found', 404);
  }

  if (replyTarget.conversationId !== conversationId) {
    throw new AppError('Reply target must belong to the same conversation', 400);
  }
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ renterId: userId }, { ownerId: userId }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          location: true,
          images: true,
        },
      },
      renter: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: messageSelect,
      },
    },
  });

  // Calculate unread counts
  return Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          status: { not: 'READ' },
        },
      });

      // Determine who the "other" person is
      const participant = conv.renterId === userId ? conv.owner : conv.renter;

      return {
        ...conv,
        participant,
        lastMessage: conv.messages[0] || null,
        unreadCount,
      };
    })
  );
}

export async function createConversation(userId: string, input: CreateConversationInput) {
  const { ownerId, renterId, propertyId } = input;

  if (ownerId === renterId) {
    throw new AppError('Owner and renter must be different users', 400);
  }

  if (userId !== ownerId && userId !== renterId) {
    throw new AppError('You can only create conversations for yourself', 403);
  }

  if (propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (property.ownerId !== ownerId) {
      throw new AppError('Owner does not match property owner', 400);
    }
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      ownerId,
      renterId,
      propertyId: propertyId ?? null,
    },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      ownerId,
      renterId,
      propertyId: propertyId ?? null,
    },
    include: {
      property: { select: { id: true, title: true, location: true } },
      renter: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
    },
  });
}

export async function listMessages(
  conversationId: string,
  userId: string,
  query: ListMessagesQuery
) {
  const conversation = await ensureParticipant(conversationId, userId);
  if (!conversation) throw new AppError('Conversation not found', 404);

  const limit = query.limit ?? 30;
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: messageSelect,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  return {
    messages: messages.slice().reverse(),
    nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
  };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: CreateMessageInput
) {
  const conversation = await ensureParticipant(conversationId, senderId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  await validateReplyTarget(input.replyToId, conversationId);

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: 'TEXT',
        content: input.content,
        replyToId: input.replyToId ?? null,
      },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  const recipientId =
    conversation.renterId === senderId ? conversation.ownerId : conversation.renterId;
  await createNotification({
    userId: recipientId,
    type: 'MESSAGE_NEW',
    title: 'New message',
    body: input.content.slice(0, 120),
    payload: { conversationId, messageId: message.id },
  });

  await createAuditLog({
    actorId: senderId,
    eventType: 'MESSAGE_SENT',
    entityType: 'Message',
    entityId: message.id,
    metadata: { conversationId, type: 'TEXT' },
  });

  return { message, conversation };
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  const conversation = await ensureParticipant(conversationId, userId);
  if (!conversation) throw new AppError('Conversation not found', 404);

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      status: { not: 'READ' },
    },
    data: { status: 'READ' },
  });

  return { success: true };
}

export async function getConversationMetadata(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          location: true,
          images: true,
        },
      },
      renter: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
      owner: { select: { id: true, first_name: true, last_name: true, email: true, image: true } },
    },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);

  const isParticipant = conversation.renterId === userId || conversation.ownerId === userId;
  if (!isParticipant) throw new AppError('Access denied', 403);

  const participant = conversation.renterId === userId ? conversation.owner : conversation.renter;

  return {
    ...conversation,
    participant,
  };
}

export async function updateMessageStatus(
  messageId: string,
  userId: string,
  input: UpdateMessageStatusInput
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: {
        OR: [{ renterId: userId }, { ownerId: userId }],
      },
    },
    include: { conversation: true },
  });

  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId === userId)
    throw new AppError('Cannot update status for your own message', 400);

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { status: input.status },
    select: messageSelect,
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'MESSAGE_STATUS_UPDATED',
    entityType: 'Message',
    entityId: updated.id,
    metadata: { status: input.status, conversationId: updated.conversationId },
  });

  return { message: updated, conversation: message.conversation };
}

export async function sendAttachment(
  conversationId: string,
  senderId: string,
  file: Express.Multer.File,
  input: SendAttachmentInput
) {
  const conversation = await ensureParticipant(conversationId, senderId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  await validateReplyTarget(input.replyToId, conversationId);

  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
    throw new AppError('Unsupported file type', 400);
  }

  const messageType = getMessageTypeByMime(file.mimetype);
  const publicUrl = `/uploads/${file.filename}`;

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: messageType,
        content: input.caption ?? '',
        replyToId: input.replyToId ?? null,
        attachments: {
          create: {
            url: publicUrl,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
          },
        },
      },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  const recipientId =
    conversation.renterId === senderId ? conversation.ownerId : conversation.renterId;
  await createNotification({
    userId: recipientId,
    type: 'MESSAGE_NEW',
    title: 'New attachment',
    body: file.originalname,
    payload: {
      conversationId,
      messageId: message.id,
      attachmentType: messageType,
    },
  });

  await createAuditLog({
    actorId: senderId,
    eventType: 'MESSAGE_ATTACHMENT_SENT',
    entityType: 'Message',
    entityId: message.id,
    metadata: {
      conversationId,
      mimeType: file.mimetype,
      fileSize: file.size,
      messageType,
    },
  });

  return { message, conversation };
}

export async function addReaction(messageId: string, userId: string, input: MessageReactionInput) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: {
        OR: [{ renterId: userId }, { ownerId: userId }],
      },
    },
  });

  if (!message) throw new AppError('Message not found', 404);

  await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji: input.emoji,
      },
    },
    update: {},
    create: {
      messageId,
      userId,
      emoji: input.emoji,
    },
  });

  const updatedMessage = await prisma.message.findUnique({
    where: { id: messageId },
    select: messageSelect,
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'MESSAGE_REACTION_ADDED',
    entityType: 'Message',
    entityId: messageId,
    metadata: { emoji: input.emoji },
  });

  return updatedMessage;
}

export async function removeReaction(
  messageId: string,
  userId: string,
  input: MessageReactionInput
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: {
        OR: [{ renterId: userId }, { ownerId: userId }],
      },
    },
  });

  if (!message) throw new AppError('Message not found', 404);

  await prisma.messageReaction.deleteMany({
    where: {
      messageId,
      userId,
      emoji: input.emoji,
    },
  });

  const updatedMessage = await prisma.message.findUnique({
    where: { id: messageId },
    select: messageSelect,
  });

  await createAuditLog({
    actorId: userId,
    eventType: 'MESSAGE_REACTION_REMOVED',
    entityType: 'Message',
    entityId: messageId,
    metadata: { emoji: input.emoji },
  });

  return updatedMessage;
}

export async function assertParticipant(conversationId: string, userId: string) {
  const conversation = await ensureParticipant(conversationId, userId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  return conversation;
}

export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: {
        OR: [{ renterId: userId }, { ownerId: userId }],
      },
    },
    include: { conversation: true },
  });

  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId !== userId) {
    throw new AppError('You can only delete your own message', 403);
  }

  await prisma.$transaction([
    prisma.message.delete({ where: { id: messageId } }),
    prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  await createAuditLog({
    actorId: userId,
    eventType: 'MESSAGE_DELETED',
    entityType: 'Message',
    entityId: messageId,
    metadata: { conversationId: message.conversationId },
  });

  return {
    messageId,
    conversationId: message.conversationId,
  };
}
