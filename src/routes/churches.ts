import { and, asc, desc, eq, gt, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db, withTenantContext } from '../db/index.ts';
import { recordAuditLog } from '../db/audit.ts';
import { ROLE_LABELS, isValidChurchRole } from '../db/rbac.ts';
import {
  churchEvents,
  churchMemberships,
  churches,
  departments,
  donationCampaigns,
  eventRegistrations,
  interventionReports,
  invitations,
  mediaLibrary,
  notifications,
  pollOptions,
  readingPlans,
  socialPosts,
  socialStories,
  spiritualContents,
  testimonies,
  users,
  visitors,
  volunteerAssignments,
} from '../db/schema.ts';
import { ensureStarterChurches, initializeChurchRolePermissions } from '../db/seed.ts';
import { getClientIp, requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { broadcastToChurch } from '../realtime/ws.ts';

export const churchesRouter = Router();

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

churchesRouter.get('/public/churches', async (_req, res) => {
  try {
    await ensureStarterChurches();
    const list = await db
      .select({
        id: churches.id,
        slug: churches.slug,
        name: churches.name,
        tagline: churches.tagline,
        description: churches.description,
        denomination: churches.denomination,
        address: churches.address,
        city: churches.city,
        country: churches.country,
        logoUrl: churches.logoUrl,
        bannerUrl: churches.bannerUrl,
        primaryColor: churches.primaryColor,
        accentColor: churches.accentColor,
        currency: churches.currency,
        serviceSchedule: churches.serviceSchedule,
        createdAt: churches.createdAt,
      })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const enriched = await Promise.all(
      list.map(async (church) => {
        const stats = await withTenantContext({ churchId: church.id, isSuperAdmin: true }, async (tx) => {
          const [membersCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(churchMemberships)
            .where(and(eq(churchMemberships.churchId, church.id), eq(churchMemberships.status, 'active')));
          const [deptsCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(departments)
            .where(eq(departments.churchId, church.id));
          return {
            membersCount: membersCount?.count ?? 0,
            departmentsCount: deptsCount?.count ?? 0,
          };
        });
        return { ...church, ...stats };
      })
    );

    return res.json({ churches: enriched });
  } catch (error) {
    console.error('Public churches error:', error);
    return res.status(500).json({ error: 'Impossible de charger les églises publiques.' });
  }
});

churchesRouter.get('/public/showcase', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;

    const publicChurches = await db
      .select({
        id: churches.id,
        slug: churches.slug,
        name: churches.name,
        tagline: churches.tagline,
        description: churches.description,
        denomination: churches.denomination,
        address: churches.address,
        city: churches.city,
        country: churches.country,
        phone: churches.phone,
        email: churches.email,
        website: churches.website,
        logoUrl: churches.logoUrl,
        bannerUrl: churches.bannerUrl,
        primaryColor: churches.primaryColor,
        accentColor: churches.accentColor,
        currency: churches.currency,
        serviceSchedule: churches.serviceSchedule,
        createdAt: churches.createdAt,
      })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const enrichedChurches = await Promise.all(
      publicChurches.map(async (church) => {
        const stats = await withTenantContext({ churchId: church.id, isSuperAdmin: true }, async (tx) => {
          const [membersCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(churchMemberships)
            .where(and(eq(churchMemberships.churchId, church.id), eq(churchMemberships.status, 'active')));
          const [deptsCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(departments)
            .where(eq(departments.churchId, church.id));
          return {
            membersCount: membersCount?.count ?? 0,
            departmentsCount: deptsCount?.count ?? 0,
          };
        });
        return { ...church, ...stats };
      })
    );

    const featuredChurch =
      (requestedChurchId
        ? enrichedChurches.find((c) => c.id === requestedChurchId)
        : undefined) ||
      enrichedChurches[0] ||
      null;

    if (!featuredChurch) {
      return res.json({
        featuredChurch: null,
        churches: [],
        latestPosts: [],
        upcomingEvents: [],
        activeCampaigns: [],
        humanitarianActions: [],
        openVolunteerMissionsCount: 0,
        testimonies: [],
      });
    }

    const churchId = featuredChurch.id;
    const showcase = await withTenantContext({ churchId, isSuperAdmin: true }, async (tx) => {
      const [latestPosts, rawEvents, activeCampaigns, humanitarianActions, volunteerCountRow, testimoniesRows] =
        await Promise.all([
          tx
            .select({
              id: socialPosts.id,
              churchId: socialPosts.churchId,
              authorName: users.fullName,
              authorAvatar: users.avatarUrl,
              postType: socialPosts.postType,
              content: socialPosts.content,
              mediaUrl: socialPosts.mediaUrl,
              likesCount: socialPosts.likesCount,
              commentsCount: socialPosts.commentsCount,
              createdAt: socialPosts.createdAt,
            })
            .from(socialPosts)
            .innerJoin(users, eq(socialPosts.authorUserId, users.id))
            .where(
              and(
                eq(socialPosts.churchId, churchId),
                eq(socialPosts.isModeratedHidden, false),
                isNull(socialPosts.groupId)
              )
            )
            .orderBy(desc(socialPosts.createdAt))
            .limit(4),
          tx
            .select({
              id: churchEvents.id,
              churchId: churchEvents.churchId,
              title: churchEvents.title,
              description: churchEvents.description,
              eventType: churchEvents.eventType,
              location: churchEvents.location,
              startsAt: churchEvents.startsAt,
              isLive: churchEvents.isLive,
            })
            .from(churchEvents)
            .where(eq(churchEvents.churchId, churchId))
            .orderBy(desc(churchEvents.startsAt))
            .limit(4),
          tx
            .select({
              id: donationCampaigns.id,
              churchId: donationCampaigns.churchId,
              title: donationCampaigns.title,
              description: donationCampaigns.description,
              fundCategory: donationCampaigns.fundCategory,
              goalAmount: donationCampaigns.goalAmount,
              collectedAmount: donationCampaigns.collectedAmount,
              currency: donationCampaigns.currency,
            })
            .from(donationCampaigns)
            .where(and(eq(donationCampaigns.churchId, churchId), eq(donationCampaigns.status, 'active')))
            .orderBy(desc(donationCampaigns.createdAt))
            .limit(3),
          tx
            .select({
              id: interventionReports.id,
              churchId: interventionReports.churchId,
              title: interventionReports.title,
              summary: interventionReports.summary,
              beneficiariesHelped: interventionReports.beneficiariesHelpedCount,
              photoUrl: interventionReports.proofImageUrl,
              publishedAt: interventionReports.publishedDate,
            })
            .from(interventionReports)
            .where(eq(interventionReports.churchId, churchId))
            .orderBy(desc(interventionReports.publishedDate))
            .limit(3),
          tx
            .select({ count: sql<number>`count(*)::int` })
            .from(volunteerAssignments)
            .where(and(eq(volunteerAssignments.churchId, churchId), eq(volunteerAssignments.status, 'assigned'))),
          tx
            .select({
              id: testimonies.id,
              churchId: testimonies.churchId,
              authorName: users.fullName,
              title: testimonies.title,
              content: testimonies.content,
              createdAt: testimonies.createdAt,
            })
            .from(testimonies)
            .innerJoin(users, eq(testimonies.authorUserId, users.id))
            .where(eq(testimonies.churchId, churchId))
            .orderBy(desc(testimonies.createdAt))
            .limit(3),
        ]);

      const regCounts = await tx
        .select({
          eventId: eventRegistrations.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.churchId, churchId))
        .groupBy(eventRegistrations.eventId);

      const regMap = new Map(regCounts.map((r) => [r.eventId, r.count]));
      const upcomingEvents = rawEvents.map((ev) => ({
        ...ev,
        registrationsCount: regMap.get(ev.id) ?? 0,
      }));

      return {
        latestPosts,
        upcomingEvents,
        activeCampaigns,
        humanitarianActions,
        openVolunteerMissionsCount: volunteerCountRow[0]?.count ?? 0,
        testimonies: testimoniesRows,
      };
    });

    return res.json({
      featuredChurch,
      churches: enrichedChurches,
      ...showcase,
    });
  } catch (error) {
    console.error('Public showcase error:', error);
    return res.status(500).json({ error: 'Impossible de charger les données publiques.' });
  }
});

churchesRouter.get('/public/feed', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;
    const postType = typeof req.query.type === 'string' ? req.query.type : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const hashtag = typeof req.query.hashtag === 'string' ? req.query.hashtag.trim().toLowerCase() : '';

    const activeChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.json({ churchId: 0, churchName: '', posts: [], stories: [], availableHashtags: [] });
    }

    const data = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) => {
      const conditions = [
        eq(socialPosts.churchId, targetChurch.id),
        eq(socialPosts.isModeratedHidden, false),
        isNull(socialPosts.groupId),
      ];
      if (postType && postType !== 'all') {
        conditions.push(eq(socialPosts.postType, postType));
      }
      if (search) {
        conditions.push(ilike(socialPosts.content, `%${search}%`));
      }

      const rows = await tx
        .select({
          id: socialPosts.id,
          churchId: socialPosts.churchId,
          authorName: users.fullName,
          authorAvatar: users.avatarUrl,
          postType: socialPosts.postType,
          content: socialPosts.content,
          mediaUrl: socialPosts.mediaUrl,
          hashtags: socialPosts.hashtags,
          likesCount: socialPosts.likesCount,
          commentsCount: socialPosts.commentsCount,
          sharesCount: socialPosts.sharesCount,
          createdAt: socialPosts.createdAt,
        })
        .from(socialPosts)
        .innerJoin(users, eq(socialPosts.authorUserId, users.id))
        .where(and(...conditions))
        .orderBy(desc(socialPosts.createdAt))
        .limit(40);

      const availableHashtags = Array.from(
        new Set(rows.flatMap((r) => r.hashtags || []))
      ).slice(0, 14);

      const filtered = hashtag
        ? rows.filter((r) => (r.hashtags || []).includes(hashtag))
        : rows;

      const postIds = filtered.map((p) => p.id);
      const pollRows = postIds.length
        ? await tx
            .select({
              id: pollOptions.id,
              postId: pollOptions.postId,
              label: pollOptions.label,
              votesCount: pollOptions.votesCount,
            })
            .from(pollOptions)
            .where(inArray(pollOptions.postId, postIds))
        : [];

      const stories = await tx
        .select({
          id: socialStories.id,
          authorName: users.fullName,
          caption: socialStories.caption,
          mediaUrl: socialStories.mediaUrl,
          backgroundColor: socialStories.backgroundColor,
          expiresAt: socialStories.expiresAt,
          createdAt: socialStories.createdAt,
        })
        .from(socialStories)
        .innerJoin(users, eq(socialStories.authorUserId, users.id))
        .where(and(eq(socialStories.churchId, targetChurch.id), gt(socialStories.expiresAt, new Date())))
        .orderBy(desc(socialStories.createdAt))
        .limit(15);

      return {
        posts: filtered.map((p) => ({
          ...p,
          pollOptions: pollRows.filter((o) => o.postId === p.id),
        })),
        stories,
        availableHashtags,
      };
    });

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      ...data,
    });
  } catch (error) {
    console.error('Public feed error:', error);
    return res.status(500).json({ error: 'Impossible de charger le fil public.' });
  }
});

churchesRouter.get('/public/events', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;

    const activeChurches = await db
      .select({
        id: churches.id,
        name: churches.name,
        serviceSchedule: churches.serviceSchedule,
      })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.json({ churchId: 0, churchName: '', serviceSchedule: [], events: [] });
    }

    const events = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) => {
      const rows = await tx
        .select({
          id: churchEvents.id,
          churchId: churchEvents.churchId,
          title: churchEvents.title,
          description: churchEvents.description,
          eventType: churchEvents.eventType,
          location: churchEvents.location,
          startsAt: churchEvents.startsAt,
          endsAt: churchEvents.endsAt,
          streamUrl: churchEvents.streamUrl,
          isLive: churchEvents.isLive,
        })
        .from(churchEvents)
        .where(eq(churchEvents.churchId, targetChurch.id))
        .orderBy(desc(churchEvents.startsAt))
        .limit(20);

      const regCounts = await tx
        .select({
          eventId: eventRegistrations.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.churchId, targetChurch.id))
        .groupBy(eventRegistrations.eventId);

      const regMap = new Map(regCounts.map((r) => [r.eventId, r.count]));
      return rows.map((ev) => ({
        ...ev,
        registrationsCount: regMap.get(ev.id) ?? 0,
      }));
    });

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      serviceSchedule: targetChurch.serviceSchedule || [],
      events,
    });
  } catch (error) {
    console.error('Public events error:', error);
    return res.status(500).json({ error: 'Impossible de charger le calendrier public.' });
  }
});

churchesRouter.post('/public/visitor-contact', async (req, res) => {
  try {
    await ensureStarterChurches();
    const { churchId: rawChurchId, fullName, email, phone, interestType, message } = req.body ?? {};

    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Votre nom complet est requis.' });
    }
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    if (!cleanPhone && !cleanEmail) {
      return res.status(400).json({ error: 'Indiquez un numéro de téléphone ou une adresse email.' });
    }

    const activeChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const requestedChurchId = rawChurchId ? Number(rawChurchId) : null;
    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.status(404).json({ error: 'Paroisse introuvable.' });
    }

    const allowedInterest = ['visite', 'priere', 'benevolat', 'renseignement'];
    const safeInterest = allowedInterest.includes(String(interestType))
      ? String(interestType)
      : 'visite';
    const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 1200) : '';
    const today = new Date().toISOString().slice(0, 10);

    const created = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) => {
      const [visitorRow] = await tx
        .insert(visitors)
        .values({
          churchId: targetChurch.id,
          fullName: fullName.trim().slice(0, 120),
          email: cleanEmail || null,
          phone: cleanPhone || null,
          visitDate: today,
          source: `public_web:${safeInterest}`,
          prayerOrNeed: cleanMsg || null,
          followUpStatus: 'pending',
          notes: `Demande envoyée depuis le portail public (${safeInterest}).`,
        })
        .returning({
          id: visitors.id,
          churchId: visitors.churchId,
          fullName: visitors.fullName,
          followUpStatus: visitors.followUpStatus,
          visitDate: visitors.visitDate,
        });

      const leaders = await tx
        .select({ userId: churchMemberships.userId })
        .from(churchMemberships)
        .where(
          and(
            eq(churchMemberships.churchId, targetChurch.id),
            eq(churchMemberships.status, 'active'),
            inArray(churchMemberships.role, ['admin', 'pastor', 'assistant_pastor', 'dept_leader'])
          )
        )
        .limit(10);

      for (const leader of leaders) {
        await tx.insert(notifications).values({
          churchId: targetChurch.id,
          userId: leader.userId,
          type: 'visitor_inquiry',
          title: 'Nouveau message visiteur (portail public)',
          body: `${fullName.trim()} (${safeInterest}) souhaite être contacté.`,
        });
      }

      return visitorRow;
    });

    broadcastToChurch(targetChurch.id, 'visitor:created', {
      id: created.id,
      fullName: created.fullName,
    });

    return res.status(201).json({
      message: `Votre demande a bien été transmise à l’équipe de ${targetChurch.name}.`,
      visitor: created,
    });
  } catch (error) {
    console.error('Public visitor contact error:', error);
    return res.status(500).json({ error: 'Impossible d’enregistrer votre demande pour le moment.' });
  }
});

churchesRouter.get('/public/spiritual/daily', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;

    const activeChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.json({
        churchId: 0,
        churchName: '',
        dailyVerse: null,
        meditations: [],
        readingPlans: [],
      });
    }

    const data = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) => {
      const [contents, plans] = await Promise.all([
        tx
          .select({
            id: spiritualContents.id,
            churchId: spiritualContents.churchId,
            kind: spiritualContents.kind,
            title: spiritualContents.title,
            scriptureRef: spiritualContents.scriptureRef,
            content: spiritualContents.content,
            mediaUrl: spiritualContents.mediaUrl,
            durationLabel: spiritualContents.durationLabel,
            publishedDate: spiritualContents.publishedDate,
          })
          .from(spiritualContents)
          .where(eq(spiritualContents.churchId, targetChurch.id))
          .orderBy(desc(spiritualContents.createdAt))
          .limit(30),
        tx
          .select({
            id: readingPlans.id,
            churchId: readingPlans.churchId,
            title: readingPlans.title,
            description: readingPlans.description,
            days: readingPlans.days,
            createdAt: readingPlans.createdAt,
          })
          .from(readingPlans)
          .where(eq(readingPlans.churchId, targetChurch.id))
          .orderBy(desc(readingPlans.createdAt))
          .limit(15),
      ]);

      return {
        dailyVerse: contents.find((c) => c.kind === 'daily_verse') || null,
        meditations: contents.filter((c) => c.kind === 'meditation'),
        sermons: contents.filter((c) => c.kind === 'sermon'),
        podcasts: contents.filter((c) => c.kind === 'podcast'),
        readingPlans: plans,
      };
    });

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      ...data,
    });
  } catch (error) {
    console.error('Public spiritual daily error:', error);
    return res.status(500).json({ error: 'Impossible de charger les ressources spirituelles publiques.' });
  }
});

churchesRouter.get('/public/media', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;

    const activeChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.json({ churchId: 0, churchName: '', media: [] });
    }

    const media = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) =>
      tx
        .select({
          id: mediaLibrary.id,
          churchId: mediaLibrary.churchId,
          title: mediaLibrary.title,
          description: mediaLibrary.description,
          mediaType: mediaLibrary.mediaType,
          mediaUrl: mediaLibrary.mediaUrl,
          thumbnailUrl: mediaLibrary.thumbnailUrl,
          speakerName: mediaLibrary.speakerName,
          durationLabel: mediaLibrary.durationLabel,
          publishedDate: mediaLibrary.publishedDate,
        })
        .from(mediaLibrary)
        .where(eq(mediaLibrary.churchId, targetChurch.id))
        .orderBy(desc(mediaLibrary.createdAt))
        .limit(40)
    );

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      media,
    });
  } catch (error) {
    console.error('Public media error:', error);
    return res.status(500).json({ error: 'Impossible de charger la médiathèque publique.' });
  }
});

churchesRouter.get('/public/solidarity', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;

    const activeChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? activeChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      activeChurches[0];

    if (!targetChurch) {
      return res.json({
        churchId: 0,
        churchName: '',
        campaigns: [],
        reports: [],
        volunteerMissions: [],
      });
    }

    const data = await withTenantContext({ churchId: targetChurch.id, isSuperAdmin: true }, async (tx) => {
      const [campaigns, reports, missions] = await Promise.all([
        tx
          .select({
            id: donationCampaigns.id,
            churchId: donationCampaigns.churchId,
            title: donationCampaigns.title,
            description: donationCampaigns.description,
            fundCategory: donationCampaigns.fundCategory,
            goalAmount: donationCampaigns.goalAmount,
            collectedAmount: donationCampaigns.collectedAmount,
            currency: donationCampaigns.currency,
          })
          .from(donationCampaigns)
          .where(and(eq(donationCampaigns.churchId, targetChurch.id), eq(donationCampaigns.status, 'active')))
          .orderBy(desc(donationCampaigns.createdAt))
          .limit(12),
        tx
          .select({
            id: interventionReports.id,
            churchId: interventionReports.churchId,
            title: interventionReports.title,
            summary: interventionReports.summary,
            beneficiariesHelpedCount: interventionReports.beneficiariesHelpedCount,
            totalAmountSpent: interventionReports.totalAmountSpent,
            proofImageUrl: interventionReports.proofImageUrl,
            publishedDate: interventionReports.publishedDate,
          })
          .from(interventionReports)
          .where(eq(interventionReports.churchId, targetChurch.id))
          .orderBy(desc(interventionReports.publishedDate))
          .limit(15),
        tx
          .select({
            id: volunteerAssignments.id,
            missionTitle: volunteerAssignments.missionTitle,
            roleDescription: volunteerAssignments.roleDescription,
            scheduledDate: volunteerAssignments.scheduledDate,
            status: volunteerAssignments.status,
          })
          .from(volunteerAssignments)
          .where(eq(volunteerAssignments.churchId, targetChurch.id))
          .orderBy(desc(volunteerAssignments.createdAt))
          .limit(20),
      ]);

      return { campaigns, reports, volunteerMissions: missions };
    });

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      ...data,
    });
  } catch (error) {
    console.error('Public solidarity error:', error);
    return res.status(500).json({ error: 'Impossible de charger les actions de solidarité publiques.' });
  }
});

churchesRouter.get('/public/invitations/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Code d'invitation manquant." });
    }

    const found = await withTenantContext({ isSuperAdmin: true }, async (tx) =>
      tx
        .select({
          id: invitations.id,
          code: invitations.code,
          churchId: invitations.churchId,
          targetRole: invitations.targetRole,
          invitedEmail: invitations.invitedEmail,
          maxUses: invitations.maxUses,
          usesCount: invitations.usesCount,
          expiresAt: invitations.expiresAt,
          revokedAt: invitations.revokedAt,
          churchName: churches.name,
          churchCity: churches.city,
          churchLogoUrl: churches.logoUrl,
          churchPrimaryColor: churches.primaryColor,
        })
        .from(invitations)
        .innerJoin(churches, eq(invitations.churchId, churches.id))
        .where(eq(invitations.code, code))
        .limit(1)
    );

    if (!found.length) {
      return res.status(404).json({ error: "Invitation introuvable." });
    }

    const inv = found[0];
    const isExpired = inv.expiresAt <= new Date();
    const isExhausted = inv.usesCount >= inv.maxUses;
    const isRevoked = inv.revokedAt !== null;
    const roleLabel = isValidChurchRole(inv.targetRole)
      ? ROLE_LABELS[inv.targetRole]
      : inv.targetRole;

    return res.json({
      invitation: {
        code: inv.code,
        churchId: inv.churchId,
        churchName: inv.churchName,
        churchCity: inv.churchCity,
        churchLogoUrl: inv.churchLogoUrl,
        churchPrimaryColor: inv.churchPrimaryColor,
        targetRole: inv.targetRole,
        roleLabel,
        requiresEmail: Boolean(inv.invitedEmail),
        isValid: !isExpired && !isExhausted && !isRevoked,
        reason: isRevoked
          ? 'Invitation révoquée'
          : isExpired
            ? 'Invitation expirée'
            : isExhausted
              ? 'Nombre maximum d’utilisations atteint'
              : null,
      },
    });
  } catch (error) {
    console.error('Lookup invitation error:', error);
    return res.status(500).json({ error: "Erreur lors de la vérification de l'invitation." });
  }
});

churchesRouter.post('/churches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const {
      name,
      slug,
      tagline,
      description,
      denomination,
      address,
      city,
      country,
      phone,
      email,
      logoUrl,
      bannerUrl,
      primaryColor,
      accentColor,
      currency,
      isPublic,
    } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: "Le nom de l'église doit contenir au moins 3 caractères." });
    }

    const baseSlug = slugify(typeof slug === 'string' && slug.trim() ? slug : name);
    if (!baseSlug) {
      return res.status(400).json({ error: "Identifiant URL (slug) invalide." });
    }

    const existingSlug = await db
      .select({ id: churches.id })
      .from(churches)
      .where(eq(churches.slug, baseSlug))
      .limit(1);

    const finalSlug =
      existingSlug.length > 0 ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const safePrimary =
      typeof primaryColor === 'string' && hexRegex.test(primaryColor) ? primaryColor : '#1B365D';
    const safeAccent =
      typeof accentColor === 'string' && hexRegex.test(accentColor) ? accentColor : '#881337';

    const [createdChurch] = await db
      .insert(churches)
      .values({
        slug: finalSlug,
        name: name.trim(),
        tagline: typeof tagline === 'string' ? tagline.trim() || null : null,
        description: typeof description === 'string' ? description.trim() || null : null,
        denomination: typeof denomination === 'string' ? denomination.trim() || null : null,
        address: typeof address === 'string' ? address.trim() || null : null,
        city: typeof city === 'string' ? city.trim() || null : null,
        country: typeof country === 'string' && country.trim() ? country.trim() : "Côte d'Ivoire",
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        email: typeof email === 'string' ? email.trim() || null : null,
        logoUrl:
          typeof logoUrl === 'string' && logoUrl.trim()
            ? logoUrl.trim()
            : '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
        bannerUrl:
          typeof bannerUrl === 'string' && bannerUrl.trim()
            ? bannerUrl.trim()
            : '/src/assets/images/charitas_parish_hero_1794525618732.jpg',
        primaryColor: safePrimary,
        accentColor: safeAccent,
        currency: typeof currency === 'string' && currency.trim() ? currency.trim() : 'XOF',
        isPublic: typeof isPublic === 'boolean' ? isPublic : true,
        serviceSchedule: [
          { day: 'Dimanche', time: '08:30', title: 'Messe Dominicale', location: 'Sanctuaire Paroissial' },
        ],
        createdByUserId: user.id,
      })
      .returning();

    await initializeChurchRolePermissions(createdChurch.id);

    await withTenantContext({ churchId: createdChurch.id, isSuperAdmin: true }, async (tx) => {
      await tx.insert(churchMemberships).values({
        churchId: createdChurch.id,
        userId: user.id,
        role: 'church_admin',
        leadershipTitle: "Fondateur / Administrateur d'église",
        status: 'active',
      });

      await tx.insert(departments).values([
        {
          churchId: createdChurch.id,
          name: 'Administration & Pastorale',
          description: 'Direction spirituelle et coordination générale.',
          leaderUserId: user.id,
        },
        {
          churchId: createdChurch.id,
          name: 'Accueil & Diaconie',
          description: 'Accueil des nouveaux venus et entraide fraternelle.',
        },
      ]);
    });

    await recordAuditLog({
      churchId: createdChurch.id,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'CHURCH_CREATED',
      entityType: 'church',
      entityId: createdChurch.id,
      details: { name: createdChurch.name, slug: createdChurch.slug },
      ipAddress: getClientIp(req),
    });

    return res.status(201).json({ church: createdChurch });
  } catch (error) {
    console.error('Create church error:', error);
    return res.status(500).json({ error: "Erreur lors de la création de l'église." });
  }
});

churchesRouter.post('/churches/:churchId/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const churchId = Number(req.params.churchId);
    if (!Number.isInteger(churchId) || churchId <= 0) {
      return res.status(400).json({ error: 'Identifiant d’église invalide.' });
    }

    const churchRows = await db
      .select()
      .from(churches)
      .where(and(eq(churches.id, churchId), eq(churches.status, 'active')))
      .limit(1);

    if (!churchRows.length || !churchRows[0].isPublic) {
      return res.status(403).json({
        error: "Cette église est privée : une invitation est requise pour la rejoindre.",
      });
    }

    const requestedRole = req.body?.asVisitor ? 'visitor' : 'member';

    const membership = await withTenantContext(
      { churchId, userId: user.id, isSuperAdmin: true },
      async (tx) => {
        const existing = await tx
          .select()
          .from(churchMemberships)
          .where(
            and(eq(churchMemberships.churchId, churchId), eq(churchMemberships.userId, user.id))
          )
          .limit(1);

        if (existing.length > 0) {
          return existing[0];
        }

        const [created] = await tx
          .insert(churchMemberships)
          .values({
            churchId,
            userId: user.id,
            role: requestedRole,
            status: 'active',
          })
          .returning();
        return created;
      }
    );

    await recordAuditLog({
      churchId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'CHURCH_JOINED_PUBLIC',
      entityType: 'membership',
      entityId: membership.id,
      details: { role: membership.role },
      ipAddress: getClientIp(req),
    });

    return res.status(201).json({ membership });
  } catch (error) {
    console.error('Join church error:', error);
    return res.status(500).json({ error: "Erreur lors de l'adhésion à l'église." });
  }
});

churchesRouter.post('/invitations/accept', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Code d'invitation requis." });
    }

    const inviteRows = await withTenantContext({ isSuperAdmin: true }, async (tx) =>
      tx.select().from(invitations).where(eq(invitations.code, code)).limit(1)
    );

    if (!inviteRows.length) {
      return res.status(404).json({ error: "Code d'invitation introuvable." });
    }

    const inv = inviteRows[0];
    if (inv.revokedAt) {
      return res.status(400).json({ error: 'Cette invitation a été révoquée.' });
    }
    if (inv.expiresAt <= new Date()) {
      return res.status(400).json({ error: 'Cette invitation a expiré.' });
    }
    if (inv.usesCount >= inv.maxUses) {
      return res.status(400).json({ error: "Cette invitation a atteint sa limite d'utilisations." });
    }
    if (inv.invitedEmail && inv.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({
        error: `Cette invitation est réservée à l'adresse ${inv.invitedEmail}.`,
      });
    }

    const safeRole = inv.targetRole === 'super_admin' ? 'church_admin' : inv.targetRole;

    const membership = await withTenantContext(
      { churchId: inv.churchId, userId: user.id, isSuperAdmin: true },
      async (tx) => {
        const existing = await tx
          .select()
          .from(churchMemberships)
          .where(
            and(
              eq(churchMemberships.churchId, inv.churchId),
              eq(churchMemberships.userId, user.id)
            )
          )
          .limit(1);

        let result;
        if (existing.length) {
          const [updated] = await tx
            .update(churchMemberships)
            .set({
              role: safeRole,
              departmentId: inv.departmentId ?? existing[0].departmentId,
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eq(churchMemberships.id, existing[0].id))
            .returning();
          result = updated;
        } else {
          const [inserted] = await tx
            .insert(churchMemberships)
            .values({
              churchId: inv.churchId,
              userId: user.id,
              role: safeRole,
              departmentId: inv.departmentId,
              status: 'active',
            })
            .returning();
          result = inserted;
        }

        await tx
          .update(invitations)
          .set({ usesCount: inv.usesCount + 1 })
          .where(eq(invitations.id, inv.id));

        return result;
      }
    );

    await recordAuditLog({
      churchId: inv.churchId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'INVITATION_ACCEPTED',
      entityType: 'invitation',
      entityId: inv.id,
      details: { code: inv.code, assignedRole: membership.role },
      ipAddress: getClientIp(req),
    });

    return res.json({ membership, churchId: inv.churchId });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return res.status(500).json({ error: "Erreur lors de l'acceptation de l'invitation." });
  }
});
