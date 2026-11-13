import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import QRCode from 'qrcode';
import { recordAuditLog } from '../db/audit.ts';
import { withTenantContext } from '../db/index.ts';
import { churchEvents, eventRegistrations, notifications, users } from '../db/schema.ts';
import { getClientIp, requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';
import { broadcastToChurch } from '../realtime/ws.ts';

export const eventsRouter = Router({ mergeParams: true });
eventsRouter.use(requireAuth);

function buildQrPayload(eventId: number, userId: number, qrSecret: string): string {
  const sig = crypto
    .createHmac('sha256', qrSecret)
    .update(`${eventId}:${userId}`)
    .digest('hex')
    .slice(0, 16);
  return `SANCTUAIRE:EVENT:${eventId}:USER:${userId}:${sig}`;
}

eventsRouter.get(
  '/:churchId/events',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const list = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const rows = await tx
            .select()
            .from(churchEvents)
            .where(eq(churchEvents.churchId, churchId))
            .orderBy(desc(churchEvents.startsAt));

          const regs = await tx
            .select()
            .from(eventRegistrations)
            .where(eq(eventRegistrations.churchId, churchId));

          return rows.map((ev) => {
            const evRegs = regs.filter((r) => r.eventId === ev.id);
            const myReg = evRegs.find((r) => r.userId === userId) || null;
            return {
              id: ev.id,
              churchId: ev.churchId,
              title: ev.title,
              description: ev.description,
              eventType: ev.eventType,
              location: ev.location,
              startsAt: ev.startsAt,
              endsAt: ev.endsAt,
              streamUrl: ev.streamUrl,
              isLive: ev.isLive,
              createdAt: ev.createdAt,
              registrationsCount: evRegs.length,
              checkedInCount: evRegs.filter((r) => r.status === 'checked_in').length,
              myRegistration: myReg
                ? {
                    id: myReg.id,
                    status: myReg.status,
                    checkedInAt: myReg.checkedInAt,
                    qrPayload: buildQrPayload(ev.id, userId, ev.qrSecret),
                  }
                : null,
            };
          });
        }
      );

      return res.json({ events: list });
    } catch (error) {
      console.error('List events error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des événements.' });
    }
  }
);

eventsRouter.post(
  '/:churchId/events',
  requireChurchPermission('events.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { title, description, eventType, location, startsAt, endsAt, streamUrl, isLive } =
        req.body ?? {};

      if (typeof title !== 'string' || !title.trim() || !startsAt) {
        return res.status(400).json({ error: 'Titre et date de début requis.' });
      }

      const startDate = new Date(startsAt);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Date de début invalide.' });
      }

      const qrSecret = crypto.randomBytes(16).toString('hex');
      const allowedTypes = ['culte', 'conference', 'reunion', 'direct'];

      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(churchEvents)
            .values({
              churchId,
              title: title.trim(),
              description: typeof description === 'string' ? description.trim() || null : null,
              eventType: allowedTypes.includes(eventType) ? eventType : 'culte',
              location: typeof location === 'string' ? location.trim() || null : null,
              startsAt: startDate,
              endsAt: endsAt ? new Date(endsAt) : null,
              streamUrl: typeof streamUrl === 'string' ? streamUrl.trim() || null : null,
              isLive: Boolean(isLive),
              qrSecret,
              createdByUserId: req.authUser!.id,
            })
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'EVENT_CREATED',
        entityType: 'church_event',
        entityId: created.id,
        details: { title: created.title, eventType: created.eventType },
        ipAddress: getClientIp(req),
      });

      broadcastToChurch(churchId, 'event:created', {
        id: created.id,
        title: created.title,
        isLive: created.isLive,
      });

      return res.status(201).json({ event: created });
    } catch (error) {
      console.error('Create event error:', error);
      return res.status(500).json({ error: "Erreur lors de la création de l'événement." });
    }
  }
);

eventsRouter.patch(
  '/:churchId/events/:eventId',
  requireChurchPermission('events.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const eventId = Number(req.params.eventId);
      const { isLive, streamUrl } = req.body ?? {};

      const updates: Partial<typeof churchEvents.$inferInsert> = {};
      if (typeof isLive === 'boolean') updates.isLive = isLive;
      if (typeof streamUrl === 'string') updates.streamUrl = streamUrl.trim() || null;

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(churchEvents)
            .set(updates)
            .where(and(eq(churchEvents.id, eventId), eq(churchEvents.churchId, churchId)))
            .returning()
      );

      if (!updated) return res.status(404).json({ error: 'Événement introuvable.' });

      if (updated.isLive) {
        broadcastToChurch(churchId, 'event:live', {
          eventId: updated.id,
          title: updated.title,
          streamUrl: updated.streamUrl,
        });
      }

      return res.json({ event: updated });
    } catch (error) {
      console.error('Update event error:', error);
      return res.status(500).json({ error: "Erreur lors de la mise à jour de l'événement." });
    }
  }
);

eventsRouter.post(
  '/:churchId/events/:eventId/register',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const eventId = Number(req.params.eventId);

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ev] = await tx
            .select()
            .from(churchEvents)
            .where(and(eq(churchEvents.id, eventId), eq(churchEvents.churchId, churchId)))
            .limit(1);
          if (!ev) return null;

          const existing = await tx
            .select()
            .from(eventRegistrations)
            .where(
              and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId))
            )
            .limit(1);

          let reg = existing[0];
          if (!reg) {
            const [created] = await tx
              .insert(eventRegistrations)
              .values({ churchId, eventId, userId, status: 'registered' })
              .returning();
            reg = created;
          }

          const qrPayload = buildQrPayload(eventId, userId, ev.qrSecret);
          const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            width: 240,
            margin: 2,
          });

          await tx.insert(notifications).values({
            churchId,
            userId,
            type: 'event_registration',
            title: 'Inscription confirmée',
            body: `Votre billet QR pour « ${ev.title} » est prêt.`,
          });

          return { registration: reg, qrPayload, qrDataUrl };
        }
      );

      if (!result) return res.status(404).json({ error: 'Événement introuvable.' });
      return res.status(201).json(result);
    } catch (error) {
      console.error('Register event error:', error);
      return res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
  }
);

eventsRouter.get(
  '/:churchId/events/:eventId/ticket',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const eventId = Number(req.params.eventId);

      const ticket = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ev] = await tx
            .select()
            .from(churchEvents)
            .where(and(eq(churchEvents.id, eventId), eq(churchEvents.churchId, churchId)))
            .limit(1);
          if (!ev) return null;

          const [reg] = await tx
            .select()
            .from(eventRegistrations)
            .where(
              and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId))
            )
            .limit(1);
          if (!reg) return 'NOT_REGISTERED' as const;

          const qrPayload = buildQrPayload(eventId, userId, ev.qrSecret);
          const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 240, margin: 2 });
          return { registration: reg, qrPayload, qrDataUrl };
        }
      );

      if (ticket === null) return res.status(404).json({ error: 'Événement introuvable.' });
      if (ticket === 'NOT_REGISTERED') {
        return res.status(404).json({ error: 'Vous n’êtes pas encore inscrit à cet événement.' });
      }
      return res.json(ticket);
    } catch (error) {
      console.error('Get ticket error:', error);
      return res.status(500).json({ error: 'Erreur lors de la génération du QR code.' });
    }
  }
);

eventsRouter.post(
  '/:churchId/events/:eventId/checkin',
  requireChurchPermission('events.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const eventId = Number(req.params.eventId);
      const { qrPayload, targetUserId } = req.body ?? {};

      const outcome = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ev] = await tx
            .select()
            .from(churchEvents)
            .where(and(eq(churchEvents.id, eventId), eq(churchEvents.churchId, churchId)))
            .limit(1);
          if (!ev) return { status: 404, error: 'Événement introuvable.' };

          let userIdToCheck = Number(targetUserId) || 0;
          if (typeof qrPayload === 'string' && qrPayload.trim()) {
            const parts = qrPayload.trim().split(':');
            if (parts.length !== 6 || parts[0] !== 'SANCTUAIRE' || parts[1] !== 'EVENT') {
              return { status: 400, error: 'Format de QR code invalide.' };
            }
            const parsedEventId = Number(parts[2]);
            const parsedUserId = Number(parts[4]);
            if (parsedEventId !== eventId) {
              return { status: 400, error: 'Ce QR code correspond à un autre événement.' };
            }
            const expected = buildQrPayload(eventId, parsedUserId, ev.qrSecret);
            if (expected !== qrPayload.trim()) {
              return { status: 403, error: 'Signature QR invalide ou falsifiée.' };
            }
            userIdToCheck = parsedUserId;
          }

          if (!userIdToCheck) {
            return { status: 400, error: 'QR code ou membre requis.' };
          }

          const [existing] = await tx
            .select()
            .from(eventRegistrations)
            .where(
              and(
                eq(eventRegistrations.churchId, churchId),
                eq(eventRegistrations.eventId, eventId),
                eq(eventRegistrations.userId, userIdToCheck)
              )
            )
            .limit(1);

          const now = new Date();
          if (existing) {
            const [updated] = await tx
              .update(eventRegistrations)
              .set({ status: 'checked_in', checkedInAt: now })
              .where(eq(eventRegistrations.id, existing.id))
              .returning();
            return { status: 200, registration: updated };
          }

          const [created] = await tx
            .insert(eventRegistrations)
            .values({
              churchId,
              eventId,
              userId: userIdToCheck,
              status: 'checked_in',
              checkedInAt: now,
            })
            .returning();
          return { status: 200, registration: created };
        }
      );

      if (outcome.status !== 200) {
        return res.status(outcome.status).json({ error: outcome.error });
      }
      return res.json({ registration: outcome.registration });
    } catch (error) {
      console.error('QR checkin error:', error);
      return res.status(500).json({ error: 'Erreur lors de la validation de présence.' });
    }
  }
);

eventsRouter.get(
  '/:churchId/events/:eventId/attendees',
  requireChurchPermission('events.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const eventId = Number(req.params.eventId);

      const attendees = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: eventRegistrations.id,
              userId: eventRegistrations.userId,
              fullName: users.fullName,
              email: users.email,
              status: eventRegistrations.status,
              checkedInAt: eventRegistrations.checkedInAt,
              createdAt: eventRegistrations.createdAt,
            })
            .from(eventRegistrations)
            .innerJoin(users, eq(eventRegistrations.userId, users.id))
            .where(
              and(eq(eventRegistrations.churchId, churchId), eq(eventRegistrations.eventId, eventId))
            )
            .orderBy(desc(eventRegistrations.createdAt))
      );

      return res.json({ attendees });
    } catch (error) {
      console.error('List attendees error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des participants.' });
    }
  }
);
