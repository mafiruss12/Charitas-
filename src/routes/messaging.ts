import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { Router } from 'express';
import { withTenantContext } from '../db/index.ts';
import {
  chatMessages,
  churchMemberships,
  conversationParticipants,
  conversations,
  notifications,
  userBlocks,
  users,
} from '../db/schema.ts';
import { requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';
import {
  broadcastToChurch,
  getOnlineUserIdsForChurch,
  sendToUserInChurch,
} from '../realtime/ws.ts';

export const messagingRouter = Router({ mergeParams: true });
messagingRouter.use(requireAuth);

messagingRouter.get(
  '/:churchId/messaging/presence',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    const churchId = req.tenant!.churchId;
    return res.json({ onlineUserIds: getOnlineUserIdsForChurch(churchId) });
  }
);

messagingRouter.get(
  '/:churchId/messaging/conversations',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const list = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          // Ensure a default public room exists for this church
          const publicRooms = await tx
            .select()
            .from(conversations)
            .where(and(eq(conversations.churchId, churchId), eq(conversations.type, 'public_room')));

          if (publicRooms.length === 0) {
            const [room] = await tx
              .insert(conversations)
              .values({
                churchId,
                type: 'public_room',
                title: 'Salon Général de la Communauté',
                createdByUserId: userId,
              })
              .returning();
            await tx.insert(conversationParticipants).values({
              churchId,
              conversationId: room.id,
              userId,
            });
          }

          const allConvs = await tx
            .select()
            .from(conversations)
            .where(eq(conversations.churchId, churchId))
            .orderBy(desc(conversations.updatedAt));

          const myParticipations = await tx
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.churchId, churchId),
                eq(conversationParticipants.userId, userId)
              )
            );
          const myConvIds = new Set(myParticipations.map((p) => p.conversationId));

          const visibleConvs = allConvs.filter(
            (c) => c.type === 'public_room' || myConvIds.has(c.id)
          );
          if (visibleConvs.length === 0) return [];

          const convIds = visibleConvs.map((c) => c.id);
          const allParticipants = await tx
            .select({
              conversationId: conversationParticipants.conversationId,
              userId: users.id,
              fullName: users.fullName,
              lastReadAt: conversationParticipants.lastReadAt,
            })
            .from(conversationParticipants)
            .innerJoin(users, eq(conversationParticipants.userId, users.id))
            .where(inArray(conversationParticipants.conversationId, convIds));

          return visibleConvs.map((c) => {
            const parts = allParticipants.filter((p) => p.conversationId === c.id);
            const other = parts.find((p) => p.userId !== userId);
            return {
              ...c,
              displayTitle:
                c.type === 'direct' ? other?.fullName || c.title || 'Discussion privée' : c.title,
              participants: parts,
            };
          });
        }
      );

      return res.json({ conversations: list });
    } catch (error) {
      console.error('List conversations error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des conversations.' });
    }
  }
);

messagingRouter.post(
  '/:churchId/messaging/conversations',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { type, title, participantUserIds } = req.body ?? {};
      const convType = ['direct', 'group', 'public_room'].includes(type) ? type : 'direct';

      const targetIds: number[] = Array.isArray(participantUserIds)
        ? Array.from(new Set(participantUserIds.map(Number).filter((id) => id > 0 && id !== userId)))
        : [];

      if (convType === 'direct' && targetIds.length !== 1) {
        return res.status(400).json({ error: 'Sélectionnez un destinataire.' });
      }

      const conv = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          // Verify all target participants belong to the same church
          if (targetIds.length > 0) {
            const members = await tx
              .select({ userId: churchMemberships.userId })
              .from(churchMemberships)
              .where(
                and(
                  eq(churchMemberships.churchId, churchId),
                  inArray(churchMemberships.userId, targetIds)
                )
              );
            if (members.length !== targetIds.length) {
              throw new Error('INVALID_PARTICIPANT');
            }
          }

          // Check blocks for direct conversations
          if (convType === 'direct') {
            const targetId = targetIds[0];
            const blocks = await tx
              .select()
              .from(userBlocks)
              .where(
                and(
                  eq(userBlocks.churchId, churchId),
                  or(
                    and(
                      eq(userBlocks.blockerUserId, userId),
                      eq(userBlocks.blockedUserId, targetId)
                    ),
                    and(
                      eq(userBlocks.blockerUserId, targetId),
                      eq(userBlocks.blockedUserId, userId)
                    )
                  )
                )
              );
            if (blocks.length > 0) {
              throw new Error('USER_BLOCKED');
            }
          }

          const [created] = await tx
            .insert(conversations)
            .values({
              churchId,
              type: convType,
              title: typeof title === 'string' && title.trim() ? title.trim() : null,
              createdByUserId: userId,
            })
            .returning();

          for (const pid of [userId, ...targetIds]) {
            await tx.insert(conversationParticipants).values({
              churchId,
              conversationId: created.id,
              userId: pid,
            });
          }

          return created;
        }
      );

      return res.status(201).json({ conversation: conv });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'USER_BLOCKED') {
        return res.status(403).json({ error: 'Conversation bloquée entre ces utilisateurs.' });
      }
      if (error instanceof Error && error.message === 'INVALID_PARTICIPANT') {
        return res.status(400).json({ error: "Ce destinataire n'est pas membre de cette église." });
      }
      console.error('Create conversation error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la conversation.' });
    }
  }
);

messagingRouter.get(
  '/:churchId/messaging/conversations/:convId/messages',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const convId = Number(req.params.convId);

      const messages = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [conv] = await tx
            .select()
            .from(conversations)
            .where(and(eq(conversations.id, convId), eq(conversations.churchId, churchId)))
            .limit(1);

          if (!conv) return null;

          if (conv.type !== 'public_room') {
            const part = await tx
              .select()
              .from(conversationParticipants)
              .where(
                and(
                  eq(conversationParticipants.conversationId, convId),
                  eq(conversationParticipants.userId, userId)
                )
              )
              .limit(1);
            if (!part.length) return 'FORBIDDEN' as const;
          }

          const rows = await tx
            .select({
              id: chatMessages.id,
              conversationId: chatMessages.conversationId,
              senderUserId: chatMessages.senderUserId,
              senderName: users.fullName,
              messageType: chatMessages.messageType,
              content: chatMessages.content,
              attachmentUrl: chatMessages.attachmentUrl,
              attachmentName: chatMessages.attachmentName,
              createdAt: chatMessages.createdAt,
            })
            .from(chatMessages)
            .innerJoin(users, eq(chatMessages.senderUserId, users.id))
            .where(and(eq(chatMessages.churchId, churchId), eq(chatMessages.conversationId, convId)))
            .orderBy(chatMessages.createdAt)
            .limit(120);

          const participants = await tx
            .select({
              userId: conversationParticipants.userId,
              lastReadAt: conversationParticipants.lastReadAt,
            })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, convId));

          return { rows, participants };
        }
      );

      if (messages === null) return res.status(404).json({ error: 'Conversation introuvable.' });
      if (messages === 'FORBIDDEN') {
        return res.status(403).json({ error: 'Accès non autorisé à cette conversation.' });
      }
      return res.json({ messages: messages.rows, participants: messages.participants });
    } catch (error) {
      console.error('Get messages error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des messages.' });
    }
  }
);

messagingRouter.post(
  '/:churchId/messaging/conversations/:convId/messages',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const convId = Number(req.params.convId);
      const { messageType, content, attachmentUrl, attachmentName } = req.body ?? {};

      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Le message ne peut pas être vide.' });
      }

      const safeType = ['text', 'voice', 'image', 'file'].includes(messageType)
        ? messageType
        : 'text';

      const created = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [conv] = await tx
            .select()
            .from(conversations)
            .where(and(eq(conversations.id, convId), eq(conversations.churchId, churchId)))
            .limit(1);

          if (!conv) return null;

          // Auto-join public room on send
          if (conv.type === 'public_room') {
            await tx
              .insert(conversationParticipants)
              .values({ churchId, conversationId: convId, userId, lastReadAt: new Date() })
              .onConflictDoNothing();
          } else {
            const part = await tx
              .select()
              .from(conversationParticipants)
              .where(
                and(
                  eq(conversationParticipants.conversationId, convId),
                  eq(conversationParticipants.userId, userId)
                )
              )
              .limit(1);
            if (!part.length) return 'FORBIDDEN' as const;
          }

          const [msg] = await tx
            .insert(chatMessages)
            .values({
              churchId,
              conversationId: convId,
              senderUserId: userId,
              messageType: safeType,
              content: content.trim(),
              attachmentUrl:
                typeof attachmentUrl === 'string' && attachmentUrl.trim()
                  ? attachmentUrl.trim()
                  : null,
              attachmentName:
                typeof attachmentName === 'string' && attachmentName.trim()
                  ? attachmentName.trim()
                  : null,
            })
            .returning();

          await tx
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, convId));

          const fullMsg = {
            ...msg,
            senderName: req.authUser!.fullName,
          };

          const participants = await tx
            .select()
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, convId));

          if (conv.type === 'public_room') {
            broadcastToChurch(churchId, 'chat:message', fullMsg);
          } else {
            for (const p of participants) {
              sendToUserInChurch(churchId, p.userId, 'chat:message', fullMsg);
              if (p.userId !== userId) {
                const [notif] = await tx
                  .insert(notifications)
                  .values({
                    churchId,
                    userId: p.userId,
                    type: 'chat_message',
                    title: `Message de ${req.authUser!.fullName}`,
                    body: safeType === 'voice' ? 'Message vocal reçu' : content.trim().slice(0, 120),
                  })
                  .returning();
                sendToUserInChurch(churchId, p.userId, 'notification:new', notif);
              }
            }
          }

          return fullMsg;
        }
      );

      if (created === null) return res.status(404).json({ error: 'Conversation introuvable.' });
      if (created === 'FORBIDDEN') return res.status(403).json({ error: 'Accès refusé.' });

      return res.status(201).json({ message: created });
    } catch (error) {
      console.error('Send message error:', error);
      return res.status(500).json({ error: "Erreur lors de l'envoi du message." });
    }
  }
);

messagingRouter.post(
  '/:churchId/messaging/conversations/:convId/read',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const convId = Number(req.params.convId);

      const now = new Date();
      await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          await tx
            .update(conversationParticipants)
            .set({ lastReadAt: now })
            .where(
              and(
                eq(conversationParticipants.churchId, churchId),
                eq(conversationParticipants.conversationId, convId),
                eq(conversationParticipants.userId, userId)
              )
            );
        }
      );

      broadcastToChurch(churchId, 'chat:read', {
        conversationId: convId,
        userId,
        lastReadAt: now.toISOString(),
      });

      return res.json({ readAt: now });
    } catch (error) {
      console.error('Mark read error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    }
  }
);

messagingRouter.post(
  '/:churchId/messaging/users/:targetUserId/block',
  requireChurchPermission('messaging.access'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const targetUserId = Number(req.params.targetUserId);

      const blocked = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(userBlocks)
            .where(
              and(
                eq(userBlocks.churchId, churchId),
                eq(userBlocks.blockerUserId, userId),
                eq(userBlocks.blockedUserId, targetUserId)
              )
            )
            .limit(1);

          if (existing.length) {
            await tx.delete(userBlocks).where(eq(userBlocks.id, existing[0].id));
            return false;
          }
          await tx.insert(userBlocks).values({
            churchId,
            blockerUserId: userId,
            blockedUserId: targetUserId,
          });
          return true;
        }
      );

      return res.json({ blocked });
    } catch (error) {
      console.error('Block user error:', error);
      return res.status(500).json({ error: 'Erreur lors du blocage.' });
    }
  }
);

messagingRouter.get(
  '/:churchId/notifications',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const rows = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(notifications)
            .where(and(eq(notifications.churchId, churchId), eq(notifications.userId, userId)))
            .orderBy(desc(notifications.createdAt))
            .limit(30)
      );
      return res.json({ notifications: rows });
    } catch (error) {
      console.error('Notifications error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des notifications.' });
    }
  }
);

messagingRouter.post(
  '/:churchId/notifications/read-all',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(notifications)
            .set({ isRead: true })
            .where(and(eq(notifications.churchId, churchId), eq(notifications.userId, userId)))
      );
      return res.json({ updated: true });
    } catch (error) {
      console.error('Read all notifications error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    }
  }
);
