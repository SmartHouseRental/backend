import { Router } from 'express';
import * as messagingController from './controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { diskUpload } from '../../middlewares/multer.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/v1/messaging/conversations:
 *   get:
 *     summary: List conversations for the current user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConversationResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', messagingController.listConversations);

/**
 * @swagger
 * /api/v1/messaging/conversations:
 *   post:
 *     summary: Create or return an existing conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConversationCreateInput'
 *     responses:
 *       201:
 *         description: Conversation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversation:
 *                       $ref: '#/components/schemas/ConversationResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */
router.post('/conversations', messagingController.createConversation);

/**
 * @swagger
 * /api/v1/messaging/conversations/{id}:
 *   get:
 *     summary: Get metadata for a specific conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation metadata
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:id', messagingController.getMetadata);


/**
 * @swagger
 * /api/v1/messaging/conversations/{id}/messages:
 *   get:
 *     summary: List messages for a conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of messages to fetch
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Message ID cursor for pagination
 *     responses:
 *       200:
 *         description: Messages for conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MessageResponse'
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:id/messages', messagingController.listMessages);

/**
 * @swagger
 * /api/v1/messaging/conversations/{id}/read:
 *   patch:
 *     summary: Mark all messages in a conversation as read by the current user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       404:
 *         description: Conversation not found
 */
router.patch('/conversations/:id/read', messagingController.markRead);


/**
 * @swagger
 * /api/v1/messaging/conversations/{id}/messages:
 *   post:
 *     summary: Send a message to a conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               replyToId:
 *                 type: string
 *                 description: Message ID being replied to
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.post('/conversations/:id/messages', messagingController.sendMessage);

/**
 * @swagger
 * /api/v1/messaging/conversations/{id}/attachments:
 *   post:
 *     summary: Send file attachment to a conversation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 *               replyToId:
 *                 type: string
 *                 description: Message ID being replied to
 *     responses:
 *       201:
 *         description: Attachment sent
 */
router.post(
  '/conversations/:id/attachments',
  diskUpload.single('file'),
  messagingController.sendAttachment
);

/**
 * @swagger
 * /api/v1/messaging/messages/{id}/status:
 *   patch:
 *     summary: Update message status
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DELIVERED, READ]
 *     responses:
 *       200:
 *         description: Message status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 */
router.patch('/messages/:id/status', messagingController.updateMessageStatus);

/**
 * @swagger
 * /api/v1/messaging/messages/{id}/reactions:
 *   post:
 *     summary: Add emoji reaction to a message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 */
router.post('/messages/:id/reactions', messagingController.addReaction);

/**
 * @swagger
 * /api/v1/messaging/messages/{id}/reactions:
 *   delete:
 *     summary: Remove emoji reaction from a message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/messages/:id/reactions', messagingController.removeReaction);

/**
 * @swagger
 * /api/v1/messaging/messages/{id}:
 *   delete:
 *     summary: Delete a message (sender only)
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted
 *       403:
 *         description: You can only delete your own message
 *       404:
 *         description: Message not found
 */
router.delete('/messages/:id', messagingController.deleteMessage);

export default router;
