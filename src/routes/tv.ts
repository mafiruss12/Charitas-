import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { Router } from 'express';
import { recordAuditLog } from '../db/audit.ts';
import { db, withTenantContext } from '../db/index.ts';
import {
  churches,
  tvBroadcasts,
  tvChannels,
  tvFavorites,
  tvWatchHistory,
} from '../db/schema.ts';
import { ensureStarterChurches } from '../db/seed.ts';
import {
  IPTV_ORG_RELIGIOUS_PLAYLIST_URL,
  assertSafeHttpUrl,
  detectStreamFormat,
  fetchAndParseM3uUrl,
  isValidTvCategory,
  normalizeTvCategory,
  parseM3uPlaylistText,
  probeStreamUrl,
  runChurchChannelsHealthCheck,
} from '../lib/iptv.ts';
import { TV_BROADCAST_TYPES, TV_CATEGORIES } from '../lib/tvConstants.ts';
import {
  getClientIp,
  requireAuth,
  requireChurchPermission,
  type AuthRequest,
} from '../middleware/auth.ts';
import { broadcastToChurch } from '../realtime/ws.ts';

export const tvRouter = Router({ mergeParams: true });

const ALLOWED_BROADCAST_TYPES = new Set<string>(TV_BROADCAST_TYPES.map((t) => t.value));
const ALLOWED_INGEST_PROVIDERS = new Set([
  'hls_custom',
  'youtube_live',
  'vimeo',
  'mux_rtmp',
  'replay_mp4',
]);
const ALLOWED_BROADCAST_STATUSES = new Set(['scheduled', 'live', 'replay', 'archived']);

function cleanOptionalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return assertSafeHttpUrl(raw.trim()).toString();
}

function cleanOptionalText(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLen);
  return cleaned || null;
}

// ==================== PUBLIC VISITOR ROUTES (NO SIGN-UP REQUIRED) ====================

tvRouter.get('/public/tv/catalog', async (req, res) => {
  try {
    await ensureStarterChurches();
    const requestedChurchId = req.query.churchId ? Number(req.query.churchId) : null;
    const categoryFilter =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const searchFilter =
      typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const publicChurches = await db
      .select({ id: churches.id, name: churches.name })
      .from(churches)
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')))
      .orderBy(asc(churches.id));

    const targetChurch =
      (requestedChurchId ? publicChurches.find((c) => c.id === requestedChurchId) : undefined) ||
      publicChurches[0];

    if (!targetChurch) {
      return res.json({
        churchId: 0,
        churchName: 'CHARITAS — Église Saint Louis Roi d’Ebimpé',
        categories: [...TV_CATEGORIES],
        channels: [],
        recommendedChannels: [],
        broadcasts: [],
      });
    }

    const data = await withTenantContext(
      { churchId: targetChurch.id, isSuperAdmin: true },
      async (tx) => {
        // Strictly return ONLY validated, active, AND operational channels to visitors
        const validChannels = await tx
          .select()
          .from(tvChannels)
          .where(
            and(
              eq(tvChannels.churchId, targetChurch.id),
              eq(tvChannels.isValidated, true),
              eq(tvChannels.isActive, true),
              eq(tvChannels.streamStatus, 'operational')
            )
          )
          .orderBy(desc(tvChannels.isRecommended), asc(tvChannels.name));

        const normalizedCategoryFilter =
          categoryFilter && categoryFilter !== 'all' ? normalizeTvCategory(categoryFilter) : '';
        const filteredChannels = validChannels.filter((ch) => {
          if (normalizedCategoryFilter && normalizeTvCategory(ch.category) !== normalizedCategoryFilter) {
            return false;
          }
          if (searchFilter) {
            const hay = `${ch.name} ${ch.category} ${ch.language} ${ch.country || ''} ${ch.description || ''} ${ch.currentProgram || ''}`.toLowerCase();
            if (!hay.includes(searchFilter)) return false;
          }
          return true;
        });

        const recommendedChannels = validChannels.filter((c) => c.isRecommended).slice(0, 6);

        const broadcasts = await tx
          .select()
          .from(tvBroadcasts)
          .where(
            and(
              eq(tvBroadcasts.churchId, targetChurch.id),
              inArray(tvBroadcasts.status, ['live', 'replay', 'scheduled'])
            )
          )
          .orderBy(desc(tvBroadcasts.createdAt));

        // Sort live broadcasts first
        broadcasts.sort((a, b) => {
          const rank = (s: string) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2);
          return rank(a.status) - rank(b.status);
        });

        return {
          channels: filteredChannels,
          recommendedChannels:
            recommendedChannels.length > 0 ? recommendedChannels : validChannels.slice(0, 4),
          broadcasts,
        };
      }
    );

    return res.json({
      churchId: targetChurch.id,
      churchName: targetChurch.name,
      categories: [...TV_CATEGORIES],
      ...data,
    });
  } catch (error) {
    console.error('Public CHARITAS TV catalog error:', error);
    return res.status(500).json({ error: 'Impossible de charger le catalogue CHARITAS TV.' });
  }
});

tvRouter.get('/public/tv/channels/:channelId', async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    if (!Number.isInteger(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Identifiant de chaîne invalide.' });
    }

    const found = await withTenantContext({ isSuperAdmin: true }, async (tx) => {
      const [ch] = await tx
        .select()
        .from(tvChannels)
        .where(
          and(
            eq(tvChannels.id, channelId),
            eq(tvChannels.isValidated, true),
            eq(tvChannels.isActive, true),
            eq(tvChannels.streamStatus, 'operational')
          )
        )
        .limit(1);
      if (!ch) return null;
      const [church] = await tx
        .select({ id: churches.id, name: churches.name, isPublic: churches.isPublic, status: churches.status })
        .from(churches)
        .where(eq(churches.id, ch.churchId))
        .limit(1);
      if (!church || !church.isPublic || church.status !== 'active') return null;
      return { channel: ch, churchName: church.name };
    });

    if (!found) {
      return res.status(404).json({ error: 'Chaîne introuvable ou actuellement indisponible.' });
    }

    return res.json(found);
  } catch (error) {
    console.error('Public single TV channel error:', error);
    return res.status(500).json({ error: 'Erreur lors du chargement de la chaîne.' });
  }
});

// ==================== MEMBER AUTHENTICATED ROUTES (FAVORITES & HISTORY) ====================

tvRouter.get(
  '/churches/:churchId/tv/member-state',
  requireAuth,
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const state = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const favRows = await tx
            .select({ channelId: tvFavorites.channelId })
            .from(tvFavorites)
            .where(and(eq(tvFavorites.churchId, churchId), eq(tvFavorites.userId, userId)));

          const historyRows = await tx
            .select()
            .from(tvWatchHistory)
            .where(and(eq(tvWatchHistory.churchId, churchId), eq(tvWatchHistory.userId, userId)))
            .orderBy(desc(tvWatchHistory.watchedAt))
            .limit(20);

          const channelIds = Array.from(
            new Set(historyRows.map((h) => h.channelId).filter((v): v is number => v !== null))
          );
          const broadcastIds = Array.from(
            new Set(historyRows.map((h) => h.broadcastId).filter((v): v is number => v !== null))
          );

          const channelsList =
            channelIds.length > 0
              ? await tx
                  .select()
                  .from(tvChannels)
                  .where(and(eq(tvChannels.churchId, churchId), inArray(tvChannels.id, channelIds)))
              : [];

          const broadcastsList =
            broadcastIds.length > 0
              ? await tx
                  .select()
                  .from(tvBroadcasts)
                  .where(
                    and(eq(tvBroadcasts.churchId, churchId), inArray(tvBroadcasts.id, broadcastIds))
                  )
              : [];

          const channelMap = new Map(channelsList.map((c) => [c.id, c]));
          const broadcastMap = new Map(broadcastsList.map((b) => [b.id, b]));

          const history = historyRows
            .map((h) => ({
              ...h,
              channel: h.channelId ? channelMap.get(h.channelId) || null : null,
              broadcast: h.broadcastId ? broadcastMap.get(h.broadcastId) || null : null,
            }))
            .filter(
              (h) =>
                (h.channel &&
                  h.channel.isValidated &&
                  h.channel.isActive &&
                  h.channel.streamStatus === 'operational') ||
                (h.broadcast && h.broadcast.status !== 'archived')
            );

          return {
            favoriteChannelIds: favRows.map((f) => f.channelId),
            history,
          };
        }
      );

      return res.json(state);
    } catch (error) {
      console.error('Member TV state error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des favoris et de l’historique.' });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/favorites/:channelId',
  requireAuth,
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const channelId = Number(req.params.channelId);

      if (!Number.isInteger(channelId) || channelId <= 0) {
        return res.status(400).json({ error: 'Identifiant de chaîne invalide.' });
      }

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ id: tvChannels.id })
            .from(tvChannels)
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .limit(1);

          if (!ch) return null;

          const [existing] = await tx
            .select({ id: tvFavorites.id })
            .from(tvFavorites)
            .where(
              and(
                eq(tvFavorites.churchId, churchId),
                eq(tvFavorites.channelId, channelId),
                eq(tvFavorites.userId, userId)
              )
            )
            .limit(1);

          if (existing) {
            await tx.delete(tvFavorites).where(eq(tvFavorites.id, existing.id));
            return { added: false };
          }

          await tx.insert(tvFavorites).values({ churchId, channelId, userId });
          return { added: true };
        }
      );

      if (!result) {
        return res.status(404).json({ error: 'Chaîne introuvable pour cette église.' });
      }

      return res.json(result);
    } catch (error) {
      console.error('Toggle TV favorite error:', error);
      return res.status(500).json({ error: 'Impossible de mettre à jour les favoris.' });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/history',
  requireAuth,
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { channelId, broadcastId, lastPositionSeconds, durationSeconds } = req.body ?? {};

      const parsedChannelId = channelId ? Number(channelId) : null;
      const parsedBroadcastId = broadcastId ? Number(broadcastId) : null;
      if (!parsedChannelId && !parsedBroadcastId) {
        return res.status(400).json({ error: 'channelId ou broadcastId requis.' });
      }

      const pos = Math.max(0, Math.floor(Number(lastPositionSeconds) || 0));
      const dur = Math.max(0, Math.floor(Number(durationSeconds) || 0));

      const saved = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          if (parsedChannelId) {
            const [ch] = await tx
              .select({ id: tvChannels.id })
              .from(tvChannels)
              .where(and(eq(tvChannels.id, parsedChannelId), eq(tvChannels.churchId, churchId)))
              .limit(1);
            if (!ch) return null;
          }
          if (parsedBroadcastId) {
            const [br] = await tx
              .select({ id: tvBroadcasts.id })
              .from(tvBroadcasts)
              .where(and(eq(tvBroadcasts.id, parsedBroadcastId), eq(tvBroadcasts.churchId, churchId)))
              .limit(1);
            if (!br) return null;
          }

          const condition = parsedChannelId
            ? and(
                eq(tvWatchHistory.churchId, churchId),
                eq(tvWatchHistory.userId, userId),
                eq(tvWatchHistory.channelId, parsedChannelId)
              )
            : and(
                eq(tvWatchHistory.churchId, churchId),
                eq(tvWatchHistory.userId, userId),
                eq(tvWatchHistory.broadcastId, parsedBroadcastId!)
              );

          const [existing] = await tx
            .select()
            .from(tvWatchHistory)
            .where(condition)
            .limit(1);

          if (existing) {
            const [updated] = await tx
              .update(tvWatchHistory)
              .set({
                lastPositionSeconds: pos,
                durationSeconds: dur,
                watchedAt: new Date(),
              })
              .where(eq(tvWatchHistory.id, existing.id))
              .returning();
            return updated;
          }

          const [inserted] = await tx
            .insert(tvWatchHistory)
            .values({
              churchId,
              channelId: parsedChannelId,
              broadcastId: parsedBroadcastId,
              userId,
              lastPositionSeconds: pos,
              durationSeconds: dur,
            })
            .returning();
          return inserted;
        }
      );

      if (!saved) {
        return res.status(404).json({ error: 'Contenu introuvable dans cette église.' });
      }

      return res.json({ entry: saved });
    } catch (error) {
      console.error('Save watch history error:', error);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde de l’historique.' });
    }
  }
);

// ==================== ADMIN MANAGEMENT ROUTES ====================

tvRouter.get(
  '/churches/:churchId/tv/admin/channels',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const channels = await tx
            .select()
            .from(tvChannels)
            .where(eq(tvChannels.churchId, churchId))
            .orderBy(desc(tvChannels.isValidated), desc(tvChannels.updatedAt));

          const broadcasts = await tx
            .select()
            .from(tvBroadcasts)
            .where(eq(tvBroadcasts.churchId, churchId))
            .orderBy(desc(tvBroadcasts.createdAt));

          return { channels, broadcasts };
        }
      );

      return res.json({
        categories: [...TV_CATEGORIES],
        defaultIptvUrl: IPTV_ORG_RELIGIOUS_PLAYLIST_URL,
        ...result,
      });
    } catch (error) {
      console.error('Admin list TV channels error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement de la régie CHARITAS TV.' });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/admin/iptv-discover',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { playlistUrl, m3uText, onlyLikelyChristian } = req.body ?? {};

      let parsedEntries;
      let usedSource = 'M3U manuel';

      if (typeof m3uText === 'string' && m3uText.trim()) {
        parsedEntries = parseM3uPlaylistText(m3uText);
        usedSource = 'Import texte/fichier M3U';
      } else {
        const targetUrl =
          typeof playlistUrl === 'string' && playlistUrl.trim()
            ? playlistUrl.trim()
            : IPTV_ORG_RELIGIOUS_PLAYLIST_URL;
        usedSource = targetUrl;
        parsedEntries = await fetchAndParseM3uUrl(targetUrl);
      }

      const existingUrls = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({ streamUrl: tvChannels.streamUrl })
            .from(tvChannels)
            .where(eq(tvChannels.churchId, churchId))
      );

      const urlSet = new Set(existingUrls.map((u) => u.streamUrl.trim().toLowerCase()));
      const filtered = onlyLikelyChristian
        ? parsedEntries.filter((e) => e.isLikelyChristian)
        : parsedEntries;

      const sorted = [...filtered].sort((a, b) => {
        const rank = (e: (typeof filtered)[number]) => {
          let r = e.christianRelevanceScore * 10;
          if (e.httpProtocol === 'https') r += 25;
          if (/français/i.test(e.language)) r += 30;
          if (e.suggestedCategory === 'Chaînes chrétiennes africaines') r += 20;
          if (e.suggestedCategory === 'Gospel et louange') r += 10;
          return r;
        };
        return rank(b) - rank(a);
      });

      const entries = sorted.map((e, idx) => ({
        ...e,
        index: idx + 1,
        alreadyAdded: urlSet.has(e.streamUrl.trim().toLowerCase()),
      }));

      return res.json({
        sourceUrl: usedSource,
        totalParsed: parsedEntries.length,
        entries,
      });
    } catch (error: unknown) {
      console.error('IPTV discovery error:', error);
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’analyser la playlist IPTV M3U.',
      });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/admin/channels',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const body = req.body ?? {};
      const testImmediately = body.testImmediately !== false;

      const rawItems: Array<Record<string, unknown>> = Array.isArray(body.channels)
        ? body.channels
        : [body];

      if (rawItems.length === 0 || rawItems.length > 25) {
        return res
          .status(400)
          .json({ error: 'Sélectionnez entre 1 et 25 chaînes à la fois pour validation.' });
      }

      const existingRows = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({ streamUrl: tvChannels.streamUrl })
            .from(tvChannels)
            .where(eq(tvChannels.churchId, churchId))
      );
      const seenStreamUrls = new Set(existingRows.map((r) => r.streamUrl.trim().toLowerCase()));

      const validatedInputs: Array<{
        name: string;
        safeStreamUrl: string;
        safeLogoUrl: string | null;
        category: string;
        language: string;
        country: string | null;
        sourceOrigin: string;
        rightsVerified: boolean;
        isValidated: boolean;
        isActive: boolean;
        isRecommended: boolean;
        tvgId: string | null;
        description: string | null;
        currentProgram: string | null;
        rightsHolder: string | null;
        rightsNotes: string | null;
      }> = [];

      for (const item of rawItems) {
        const name = cleanOptionalText(item.name, 140);
        const rawStreamUrl = typeof item.streamUrl === 'string' ? item.streamUrl.trim() : '';
        if (!name || !rawStreamUrl) {
          return res.status(400).json({ error: 'Nom et URL de flux (M3U8/MP4) requis.' });
        }

        let safeStreamUrl: string;
        let safeLogoUrl: string | null = null;
        try {
          safeStreamUrl = assertSafeHttpUrl(rawStreamUrl).toString();
          safeLogoUrl = cleanOptionalUrl(item.logoUrl);
        } catch (urlErr: unknown) {
          return res.status(400).json({
            error: urlErr instanceof Error ? urlErr.message : 'URL de flux ou logo invalide.',
          });
        }

        const dedupeKey = safeStreamUrl.trim().toLowerCase();
        if (seenStreamUrls.has(dedupeKey)) {
          if (rawItems.length === 1) {
            return res.status(409).json({ error: 'Cette URL de flux est déjà enregistrée dans votre catalogue.' });
          }
          continue;
        }
        seenStreamUrls.add(dedupeKey);

        const category =
          typeof item.category === 'string' && isValidTvCategory(item.category)
            ? normalizeTvCategory(item.category)
            : 'Chaînes chrétiennes francophones';
        const language = cleanOptionalText(item.language, 60) || 'Français';
        const country = cleanOptionalText(item.country, 80);
        const sourceOrigin =
          item.sourceOrigin === 'iptv_org' || item.sourceOrigin === 'm3u_import'
            ? item.sourceOrigin
            : 'manual';
        const rightsVerified = Boolean(item.rightsVerified);
        const isValidated = Boolean(item.isValidated) && rightsVerified;
        const isActive = item.isActive !== false;
        const isRecommended = Boolean(item.isRecommended);

        validatedInputs.push({
          name,
          safeStreamUrl,
          safeLogoUrl,
          category,
          language,
          country,
          sourceOrigin,
          rightsVerified,
          isValidated,
          isActive,
          isRecommended,
          tvgId: cleanOptionalText(item.tvgId, 120),
          description: cleanOptionalText(item.description, 600),
          currentProgram: cleanOptionalText(item.currentProgram, 200),
          rightsHolder: cleanOptionalText(item.rightsHolder, 180),
          rightsNotes: cleanOptionalText(item.rightsNotes, 500),
        });
      }

      if (validatedInputs.length === 0) {
        return res.status(409).json({ error: 'Toutes les chaînes sélectionnées existent déjà dans le catalogue.' });
      }

      const probesByUrl = new Map<string, Awaited<ReturnType<typeof probeStreamUrl>>>();
      if (testImmediately) {
        const chunkSize = 5;
        for (let i = 0; i < validatedInputs.length; i += chunkSize) {
          const slice = validatedInputs.slice(i, i + chunkSize);
          const probes = await Promise.all(slice.map((s) => probeStreamUrl(s.safeStreamUrl)));
          slice.forEach((s, idx) => probesByUrl.set(s.safeStreamUrl, probes[idx]));
        }
      }

      const createdChannels = [];
      for (const item of validatedInputs) {
        const probe = probesByUrl.get(item.safeStreamUrl);
        const streamStatus = probe ? probe.status : 'pending_check';
        const httpStatus = probe ? probe.httpStatus : null;
        const lastCheckError = probe ? probe.error : null;
        const lastCheckedAt = probe ? new Date(probe.checkedAt) : null;

        const [inserted] = await withTenantContext(
          { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
          async (tx) =>
            tx
              .insert(tvChannels)
              .values({
                churchId,
                name: item.name,
                category: item.category,
                language: item.language,
                country: item.country,
                logoUrl: item.safeLogoUrl,
                streamUrl: item.safeStreamUrl,
                streamFormat: detectStreamFormat(item.safeStreamUrl),
                sourceOrigin: item.sourceOrigin,
                tvgId: item.tvgId,
                description: item.description,
                currentProgram: item.currentProgram,
                isRecommended: item.isRecommended,
                isValidated: item.isValidated,
                isActive: item.isActive,
                rightsVerified: item.rightsVerified,
                rightsHolder: item.rightsHolder,
                rightsNotes: item.rightsNotes,
                streamStatus,
                httpStatus,
                lastCheckError,
                lastCheckedAt,
                createdByUserId: userId,
              })
              .returning()
        );

        createdChannels.push(inserted);
      }

      await recordAuditLog({
        churchId,
        actorUserId: userId,
        action: 'tv.channel.create',
        entityType: 'tv_channel',
        entityId: String(createdChannels[0]?.id || ''),
        details: { count: createdChannels.length, names: createdChannels.map((c) => c.name) },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({
        channel: createdChannels[0],
        channels: createdChannels,
      });
    } catch (error) {
      console.error('Admin create TV channel error:', error);
      return res.status(500).json({ error: 'Impossible d’enregistrer la chaîne.' });
    }
  }
);

tvRouter.patch(
  '/churches/:churchId/tv/admin/channels/:channelId',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const channelId = Number(req.params.channelId);

      if (!Number.isInteger(channelId) || channelId <= 0) {
        return res.status(400).json({ error: 'Identifiant de chaîne invalide.' });
      }

      const [existing] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(tvChannels)
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .limit(1)
      );

      if (!existing) {
        return res.status(404).json({ error: 'Chaîne introuvable.' });
      }

      const b = req.body ?? {};
      const nextStreamUrl =
        typeof b.streamUrl === 'string' && b.streamUrl.trim()
          ? assertSafeHttpUrl(b.streamUrl.trim()).toString()
          : existing.streamUrl;

      const nextLogoUrl =
        b.logoUrl !== undefined ? cleanOptionalUrl(b.logoUrl) : existing.logoUrl;

      const nextRightsVerified =
        b.rightsVerified !== undefined ? Boolean(b.rightsVerified) : existing.rightsVerified;

      // Require rightsVerified before public validation
      let nextIsValidated =
        b.isValidated !== undefined ? Boolean(b.isValidated) : existing.isValidated;
      if (nextIsValidated && !nextRightsVerified) {
        return res.status(400).json({
          error:
            'Veuillez confirmer la vérification des droits de diffusion avant de valider publiquement cette chaîne.',
        });
      }

      const urlChanged = nextStreamUrl !== existing.streamUrl;
      let nextStatus = existing.streamStatus;
      let nextHttpStatus = existing.httpStatus;
      let nextError = existing.lastCheckError;
      let nextCheckedAt = existing.lastCheckedAt;

      if (urlChanged) {
        if (b.testImmediately !== false) {
          const probe = await probeStreamUrl(nextStreamUrl);
          nextStatus = probe.status;
          nextHttpStatus = probe.httpStatus;
          nextError = probe.error;
          nextCheckedAt = new Date(probe.checkedAt);
        } else {
          nextStatus = 'pending_check';
          nextError = null;
        }
      }

      const [updated] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(tvChannels)
            .set({
              name: cleanOptionalText(b.name, 140) || existing.name,
              category:
                typeof b.category === 'string' && isValidTvCategory(b.category)
                  ? normalizeTvCategory(b.category)
                  : existing.category,
              language: cleanOptionalText(b.language, 60) || existing.language,
              country: b.country !== undefined ? cleanOptionalText(b.country, 80) : existing.country,
              logoUrl: nextLogoUrl,
              streamUrl: nextStreamUrl,
              streamFormat: detectStreamFormat(nextStreamUrl),
              description:
                b.description !== undefined
                  ? cleanOptionalText(b.description, 600)
                  : existing.description,
              currentProgram:
                b.currentProgram !== undefined
                  ? cleanOptionalText(b.currentProgram, 200)
                  : existing.currentProgram,
              isRecommended:
                b.isRecommended !== undefined ? Boolean(b.isRecommended) : existing.isRecommended,
              isValidated: nextIsValidated,
              isActive: b.isActive !== undefined ? Boolean(b.isActive) : existing.isActive,
              rightsVerified: nextRightsVerified,
              rightsHolder:
                b.rightsHolder !== undefined
                  ? cleanOptionalText(b.rightsHolder, 180)
                  : existing.rightsHolder,
              rightsNotes:
                b.rightsNotes !== undefined
                  ? cleanOptionalText(b.rightsNotes, 500)
                  : existing.rightsNotes,
              streamStatus: nextStatus,
              httpStatus: nextHttpStatus,
              lastCheckError: nextError,
              lastCheckedAt: nextCheckedAt,
              updatedAt: new Date(),
            })
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: userId,
        action: 'tv.channel.update',
        entityType: 'tv_channel',
        entityId: String(channelId),
        details: { name: updated.name, isValidated: updated.isValidated, isActive: updated.isActive },
        ipAddress: getClientIp(req),
      });

      return res.json({ channel: updated });
    } catch (error: unknown) {
      console.error('Admin update TV channel error:', error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour.',
      });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/admin/channels/:channelId/test',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const channelId = Number(req.params.channelId);

      if (!Number.isInteger(channelId) || channelId <= 0) {
        return res.status(400).json({ error: 'Identifiant de chaîne invalide.' });
      }

      const [existing] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(tvChannels)
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .limit(1)
      );

      if (!existing) {
        return res.status(404).json({ error: 'Chaîne introuvable.' });
      }

      const probe = await probeStreamUrl(existing.streamUrl);
      const [updated] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(tvChannels)
            .set({
              streamStatus: probe.status,
              httpStatus: probe.httpStatus,
              lastCheckError: probe.error,
              lastCheckedAt: new Date(probe.checkedAt),
              streamFormat: probe.detectedFormat,
              updatedAt: new Date(),
            })
            .where(eq(tvChannels.id, channelId))
            .returning()
      );

      return res.json({ channel: updated, probe });
    } catch (error) {
      console.error('Test TV stream error:', error);
      return res.status(500).json({ error: 'Erreur lors du test du flux vidéo.' });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/admin/check-all',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const results = await runChurchChannelsHealthCheck(churchId, userId);

      return res.json({
        checkedCount: results.length,
        operationalCount: results.filter((r) => r.status === 'operational').length,
        incompatibleCount: results.filter((r) => r.status === 'incompatible').length,
        unavailableCount: results.filter((r) => r.status === 'unavailable').length,
        results,
      });
    } catch (error) {
      console.error('Batch check TV streams error:', error);
      return res.status(500).json({ error: 'Erreur lors de la vérification globale des flux.' });
    }
  }
);

tvRouter.post(
  '/churches/:churchId/tv/admin/channels/:channelId/playback-report',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const channelId = Number(req.params.channelId);

      if (!Number.isInteger(channelId) || channelId <= 0) {
        return res.status(400).json({ error: 'Identifiant de chaîne invalide.' });
      }

      const b = req.body ?? {};
      const allowedStatuses = new Set(['operational', 'incompatible', 'unavailable']);
      if (typeof b.status !== 'string' || !allowedStatuses.has(b.status)) {
        return res.status(400).json({ error: 'Statut de lecture invalide.' });
      }

      const reportStatus = b.status as 'operational' | 'incompatible' | 'unavailable';
      const detail =
        reportStatus === 'operational'
          ? null
          : cleanOptionalText(b.error, 400) ||
            (reportStatus === 'incompatible'
              ? 'Échec de décodage ou blocage CORS côté lecteur web.'
              : 'Flux inaccessible depuis le lecteur navigateur.');

      const [updated] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(tvChannels)
            .set({
              streamStatus: reportStatus,
              lastCheckError: detail,
              lastCheckedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .returning()
      );

      if (!updated) {
        return res.status(404).json({ error: 'Chaîne introuvable.' });
      }

      return res.json({ channel: updated });
    } catch (error) {
      console.error('Playback report TV error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’enregistrement du diagnostic lecteur.' });
    }
  }
);

tvRouter.delete(
  '/churches/:churchId/tv/admin/channels/:channelId',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const channelId = Number(req.params.channelId);

      if (!Number.isInteger(channelId) || channelId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide.' });
      }

      const [deleted] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .delete(tvChannels)
            .where(and(eq(tvChannels.id, channelId), eq(tvChannels.churchId, churchId)))
            .returning()
      );

      if (!deleted) {
        return res.status(404).json({ error: 'Chaîne introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: userId,
        action: 'tv.channel.delete',
        entityType: 'tv_channel',
        entityId: String(channelId),
        details: { name: deleted.name },
        ipAddress: getClientIp(req),
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Delete TV channel error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression de la chaîne.' });
    }
  }
);

// ==================== CHARITAS LIVE (CHURCH-OWNED BROADCASTS) ====================

tvRouter.post(
  '/churches/:churchId/tv/admin/broadcasts',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const b = req.body ?? {};

      const title = cleanOptionalText(b.title, 180);
      const rawUrl = typeof b.streamUrl === 'string' ? b.streamUrl.trim() : '';
      if (!title || !rawUrl) {
        return res.status(400).json({ error: 'Titre et URL de diffusion requis.' });
      }

      const safeStreamUrl = assertSafeHttpUrl(rawUrl).toString();
      const safeThumb = cleanOptionalUrl(b.thumbnailUrl);
      const broadcastType = ALLOWED_BROADCAST_TYPES.has(b.broadcastType)
        ? b.broadcastType
        : 'culte';
      const ingestProvider = ALLOWED_INGEST_PROVIDERS.has(b.ingestProvider)
        ? b.ingestProvider
        : 'hls_custom';
      const status = ALLOWED_BROADCAST_STATUSES.has(b.status) ? b.status : 'scheduled';
      const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;

      const [created] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(tvBroadcasts)
            .values({
              churchId,
              title,
              broadcastType,
              description: cleanOptionalText(b.description, 800),
              speakerName: cleanOptionalText(b.speakerName, 140),
              thumbnailUrl: safeThumb,
              streamUrl: safeStreamUrl,
              ingestProvider,
              status,
              scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
              startedAt: status === 'live' ? new Date() : null,
              createdByUserId: userId,
            })
            .returning()
      );

      broadcastToChurch(churchId, 'tv:live_update', { broadcast: created });

      await recordAuditLog({
        churchId,
        actorUserId: userId,
        action: 'tv.broadcast.create',
        entityType: 'tv_broadcast',
        entityId: String(created.id),
        details: { title: created.title, status: created.status },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ broadcast: created });
    } catch (error: unknown) {
      console.error('Create CHARITAS Live broadcast error:', error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Erreur création diffusion CHARITAS Live.',
      });
    }
  }
);

tvRouter.patch(
  '/churches/:churchId/tv/admin/broadcasts/:broadcastId',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const broadcastId = Number(req.params.broadcastId);
      if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide.' });
      }

      const [existing] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(tvBroadcasts)
            .where(and(eq(tvBroadcasts.id, broadcastId), eq(tvBroadcasts.churchId, churchId)))
            .limit(1)
      );

      if (!existing) {
        return res.status(404).json({ error: 'Diffusion introuvable.' });
      }

      const b = req.body ?? {};
      const nextStatus =
        typeof b.status === 'string' && ALLOWED_BROADCAST_STATUSES.has(b.status)
          ? b.status
          : existing.status;

      const [updated] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(tvBroadcasts)
            .set({
              title: cleanOptionalText(b.title, 180) || existing.title,
              broadcastType:
                typeof b.broadcastType === 'string' && ALLOWED_BROADCAST_TYPES.has(b.broadcastType)
                  ? b.broadcastType
                  : existing.broadcastType,
              description:
                b.description !== undefined
                  ? cleanOptionalText(b.description, 800)
                  : existing.description,
              speakerName:
                b.speakerName !== undefined
                  ? cleanOptionalText(b.speakerName, 140)
                  : existing.speakerName,
              streamUrl:
                typeof b.streamUrl === 'string' && b.streamUrl.trim()
                  ? assertSafeHttpUrl(b.streamUrl.trim()).toString()
                  : existing.streamUrl,
              thumbnailUrl:
                b.thumbnailUrl !== undefined ? cleanOptionalUrl(b.thumbnailUrl) : existing.thumbnailUrl,
              ingestProvider:
                typeof b.ingestProvider === 'string' &&
                ALLOWED_INGEST_PROVIDERS.has(b.ingestProvider)
                  ? b.ingestProvider
                  : existing.ingestProvider,
              status: nextStatus,
              startedAt:
                nextStatus === 'live' && !existing.startedAt ? new Date() : existing.startedAt,
              endedAt:
                (nextStatus === 'replay' || nextStatus === 'archived') && !existing.endedAt
                  ? new Date()
                  : existing.endedAt,
            })
            .where(and(eq(tvBroadcasts.id, broadcastId), eq(tvBroadcasts.churchId, churchId)))
            .returning()
      );

      broadcastToChurch(churchId, 'tv:live_update', { broadcast: updated });
      return res.json({ broadcast: updated });
    } catch (error: unknown) {
      console.error('Update CHARITAS Live broadcast error:', error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Erreur mise à jour diffusion.',
      });
    }
  }
);

tvRouter.delete(
  '/churches/:churchId/tv/admin/broadcasts/:broadcastId',
  requireAuth,
  requireChurchPermission('streams.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const broadcastId = Number(req.params.broadcastId);
      if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide.' });
      }

      const [deleted] = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .delete(tvBroadcasts)
            .where(and(eq(tvBroadcasts.id, broadcastId), eq(tvBroadcasts.churchId, churchId)))
            .returning()
      );

      if (!deleted) {
        return res.status(404).json({ error: 'Diffusion introuvable.' });
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error('Delete broadcast error:', error);
      return res.status(500).json({ error: 'Erreur suppression diffusion.' });
    }
  }
);
