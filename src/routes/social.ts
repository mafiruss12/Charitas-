import { and, desc, eq, gt, ilike, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { withTenantContext } from '../db/index.ts';
import { recordAuditLog } from '../db/audit.ts';
import {
  churchMemberships,
  communityGroupMembers,
  communityGroups,
  contentReports,
  notifications,
  pollOptions,
  pollVotes,
  socialBookmarks,
  socialComments,
  socialPosts,
  socialReactions,
  socialStories,
  userFollows,
  users,
} from '../db/schema.ts';
import { getClientIp, requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';
import { sendToUserInChurch } from '../realtime/ws.ts';

export const socialRouter = Router({ mergeParams: true });
socialRouter.use(requireAuth);

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 10);
}

// Feed & Search
socialRouter.get(
  '/:churchId/social/posts',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const postType = typeof req.query.type === 'string' ? req.query.type : '';
      const hashtag = typeof req.query.hashtag === 'string' ? req.query.hashtag.trim().toLowerCase() : '';
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const groupId = req.query.groupId ? Number(req.query.groupId) : null;
      const bookmarkedOnly = req.query.bookmarked === 'true';

      const posts = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const conditions = [
            eq(socialPosts.churchId, churchId),
            eq(socialPosts.isModeratedHidden, false),
          ];
          if (postType && postType !== 'all') {
            conditions.push(eq(socialPosts.postType, postType));
          }
          if (groupId) {
            conditions.push(eq(socialPosts.groupId, groupId));
          }
          if (search) {
            conditions.push(ilike(socialPosts.content, `%${search}%`));
          }

          const rows = await tx
            .select({
              id: socialPosts.id,
              churchId: socialPosts.churchId,
              authorUserId: socialPosts.authorUserId,
              authorName: users.fullName,
              authorAvatar: users.avatarUrl,
              groupId: socialPosts.groupId,
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
            .limit(60);

          const filtered = hashtag
            ? rows.filter((r) => (r.hashtags || []).includes(hashtag))
            : rows;

          const postIds = filtered.map((p) => p.id);
          if (postIds.length === 0) return [];

          const [myReactions, myBookmarks, allPollOptions, myVotes, myFollows] = await Promise.all([
            tx
              .select()
              .from(socialReactions)
              .where(and(inArray(socialReactions.postId, postIds), eq(socialReactions.userId, userId))),
            tx
              .select()
              .from(socialBookmarks)
              .where(and(inArray(socialBookmarks.postId, postIds), eq(socialBookmarks.userId, userId))),
            tx.select().from(pollOptions).where(inArray(pollOptions.postId, postIds)),
            tx
              .select()
              .from(pollVotes)
              .where(and(inArray(pollVotes.postId, postIds), eq(pollVotes.userId, userId))),
            tx
              .select()
              .from(userFollows)
              .where(and(eq(userFollows.churchId, churchId), eq(userFollows.followerUserId, userId))),
          ]);

          const reactionMap = new Map(myReactions.map((r) => [r.postId, r.reactionType]));
          const bookmarkSet = new Set(myBookmarks.map((b) => b.postId));
          const voteMap = new Map(myVotes.map((v) => [v.postId, v.optionId]));
          const followSet = new Set(myFollows.map((f) => f.followingUserId));

          const enriched = filtered.map((p) => ({
            ...p,
            myReaction: reactionMap.get(p.id) || null,
            isBookmarked: bookmarkSet.has(p.id),
            isFollowingAuthor: followSet.has(p.authorUserId),
            pollOptions: allPollOptions.filter((o) => o.postId === p.id),
            myPollOptionId: voteMap.get(p.id) || null,
          }));

          return bookmarkedOnly ? enriched.filter((p) => p.isBookmarked) : enriched;
        }
      );

      return res.json({ posts });
    } catch (error) {
      console.error('Load posts error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du fil communautaire.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts',
  requireChurchPermission('social.post'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { postType, content, mediaUrl, groupId, pollOptionsList } = req.body ?? {};

      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Le contenu de la publication est requis.' });
      }

      const allowedTypes = ['text', 'photo', 'video', 'short_video', 'poll'];
      const safeType = allowedTypes.includes(postType) ? postType : 'text';
      const hashtags = extractHashtags(content);

      const created = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [post] = await tx
            .insert(socialPosts)
            .values({
              churchId,
              authorUserId: userId,
              groupId: groupId ? Number(groupId) : null,
              postType: safeType,
              content: content.trim(),
              mediaUrl: typeof mediaUrl === 'string' && mediaUrl.trim() ? mediaUrl.trim() : null,
              hashtags,
            })
            .returning();

          if (safeType === 'poll' && Array.isArray(pollOptionsList)) {
            const cleaned = pollOptionsList
              .map((o) => String(o).trim())
              .filter(Boolean)
              .slice(0, 6);
            for (const label of cleaned) {
              await tx.insert(pollOptions).values({
                churchId,
                postId: post.id,
                label,
              });
            }
          }
          return post;
        }
      );

      return res.status(201).json({ post: created });
    } catch (error) {
      console.error('Create post error:', error);
      return res.status(500).json({ error: 'Erreur lors de la publication.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts/:postId/react',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const postId = Number(req.params.postId);
      const reactionType =
        typeof req.body?.reactionType === 'string' ? req.body.reactionType : 'amen';

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(socialReactions)
            .where(and(eq(socialReactions.postId, postId), eq(socialReactions.userId, userId)))
            .limit(1);

          let activeReaction: string | null = reactionType;
          if (existing.length) {
            if (existing[0].reactionType === reactionType) {
              await tx.delete(socialReactions).where(eq(socialReactions.id, existing[0].id));
              activeReaction = null;
            } else {
              await tx
                .update(socialReactions)
                .set({ reactionType })
                .where(eq(socialReactions.id, existing[0].id));
            }
          } else {
            await tx.insert(socialReactions).values({
              churchId,
              postId,
              userId,
              reactionType,
            });
            const [post] = await tx
              .select()
              .from(socialPosts)
              .where(eq(socialPosts.id, postId))
              .limit(1);
            if (post && post.authorUserId !== userId) {
              const [notif] = await tx
                .insert(notifications)
                .values({
                  churchId,
                  userId: post.authorUserId,
                  type: 'social_reaction',
                  title: 'Nouvelle réaction',
                  body: `${req.authUser!.fullName} a réagi (${reactionType}) à votre publication.`,
                })
                .returning();
              sendToUserInChurch(churchId, post.authorUserId, 'notification:new', notif);
            }
          }

          const [countRow] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(socialReactions)
            .where(eq(socialReactions.postId, postId));

          await tx
            .update(socialPosts)
            .set({ likesCount: countRow?.count ?? 0 })
            .where(eq(socialPosts.id, postId));

          return { likesCount: countRow?.count ?? 0, myReaction: activeReaction };
        }
      );

      return res.json(result);
    } catch (error) {
      console.error('React error:', error);
      return res.status(500).json({ error: 'Erreur lors de la réaction.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts/:postId/bookmark',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const postId = Number(req.params.postId);

      const isBookmarked = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(socialBookmarks)
            .where(and(eq(socialBookmarks.postId, postId), eq(socialBookmarks.userId, userId)))
            .limit(1);

          if (existing.length) {
            await tx.delete(socialBookmarks).where(eq(socialBookmarks.id, existing[0].id));
            return false;
          }
          await tx.insert(socialBookmarks).values({ churchId, postId, userId });
          return true;
        }
      );

      return res.json({ isBookmarked });
    } catch (error) {
      console.error('Bookmark error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise en favori.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts/:postId/share',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const postId = Number(req.params.postId);

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(socialPosts)
            .set({ sharesCount: sql`${socialPosts.sharesCount} + 1` })
            .where(and(eq(socialPosts.id, postId), eq(socialPosts.churchId, churchId)))
            .returning({ sharesCount: socialPosts.sharesCount })
      );

      return res.json(updated || { sharesCount: 0 });
    } catch (error) {
      console.error('Share error:', error);
      return res.status(500).json({ error: 'Erreur lors du partage.' });
    }
  }
);

socialRouter.get(
  '/:churchId/social/posts/:postId/comments',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const postId = Number(req.params.postId);

      const comments = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: socialComments.id,
              postId: socialComments.postId,
              authorUserId: socialComments.authorUserId,
              authorName: users.fullName,
              content: socialComments.content,
              createdAt: socialComments.createdAt,
            })
            .from(socialComments)
            .innerJoin(users, eq(socialComments.authorUserId, users.id))
            .where(and(eq(socialComments.churchId, churchId), eq(socialComments.postId, postId)))
            .orderBy(socialComments.createdAt)
      );

      return res.json({ comments });
    } catch (error) {
      console.error('List comments error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des commentaires.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts/:postId/comments',
  requireChurchPermission('social.post'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const postId = Number(req.params.postId);
      const { content } = req.body ?? {};
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Commentaire vide.' });
      }

      const comment = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [created] = await tx
            .insert(socialComments)
            .values({ churchId, postId, authorUserId: userId, content: content.trim() })
            .returning();

          await tx
            .update(socialPosts)
            .set({ commentsCount: sql`${socialPosts.commentsCount} + 1` })
            .where(eq(socialPosts.id, postId));

          return created;
        }
      );

      return res.status(201).json({
        comment: { ...comment, authorName: req.authUser!.fullName },
      });
    } catch (error) {
      console.error('Create comment error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’ajout du commentaire.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/posts/:postId/vote',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const postId = Number(req.params.postId);
      const optionId = Number(req.body?.optionId);

      const options = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(pollVotes)
            .where(and(eq(pollVotes.postId, postId), eq(pollVotes.userId, userId)))
            .limit(1);

          if (existing.length) {
            return null;
          }

          await tx.insert(pollVotes).values({ churchId, postId, optionId, userId });
          await tx
            .update(pollOptions)
            .set({ votesCount: sql`${pollOptions.votesCount} + 1` })
            .where(and(eq(pollOptions.id, optionId), eq(pollOptions.postId, postId)));

          return tx.select().from(pollOptions).where(eq(pollOptions.postId, postId));
        }
      );

      if (options === null) {
        return res.status(409).json({ error: 'Vous avez déjà voté à ce sondage.' });
      }

      return res.json({ pollOptions: options, myPollOptionId: optionId });
    } catch (error) {
      console.error('Poll vote error:', error);
      return res.status(500).json({ error: 'Erreur lors du vote.' });
    }
  }
);

// 24h Stories
socialRouter.get(
  '/:churchId/social/stories',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const stories = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: socialStories.id,
              authorUserId: socialStories.authorUserId,
              authorName: users.fullName,
              caption: socialStories.caption,
              mediaUrl: socialStories.mediaUrl,
              backgroundColor: socialStories.backgroundColor,
              expiresAt: socialStories.expiresAt,
              createdAt: socialStories.createdAt,
            })
            .from(socialStories)
            .innerJoin(users, eq(socialStories.authorUserId, users.id))
            .where(and(eq(socialStories.churchId, churchId), gt(socialStories.expiresAt, new Date())))
            .orderBy(desc(socialStories.createdAt))
      );
      return res.json({ stories });
    } catch (error) {
      console.error('Stories error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des stories.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/stories',
  requireChurchPermission('social.post'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { caption, mediaUrl, backgroundColor } = req.body ?? {};
      if (typeof caption !== 'string' || !caption.trim()) {
        return res.status(400).json({ error: 'Texte de la story requis.' });
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [story] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(socialStories)
            .values({
              churchId,
              authorUserId: req.authUser!.id,
              caption: caption.trim(),
              mediaUrl: typeof mediaUrl === 'string' && mediaUrl.trim() ? mediaUrl.trim() : null,
              backgroundColor:
                typeof backgroundColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(backgroundColor)
                  ? backgroundColor
                  : '#1E3A5F',
              expiresAt,
            })
            .returning()
      );
      return res.status(201).json({ story });
    } catch (error) {
      console.error('Create story error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la story.' });
    }
  }
);

// Community Groups
socialRouter.get(
  '/:churchId/social/groups',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const groups = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const rows = await tx
            .select()
            .from(communityGroups)
            .where(eq(communityGroups.churchId, churchId))
            .orderBy(communityGroups.name);

          const memberships = await tx
            .select()
            .from(communityGroupMembers)
            .where(eq(communityGroupMembers.churchId, churchId));

          return rows.map((g) => {
            const members = memberships.filter((m) => m.groupId === g.id);
            return {
              ...g,
              membersCount: members.length,
              isMember: members.some((m) => m.userId === userId),
            };
          });
        }
      );
      return res.json({ groups });
    } catch (error) {
      console.error('List groups error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des groupes.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/groups',
  requireChurchPermission('social.post'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { name, description, category } = req.body ?? {};
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Nom du groupe requis.' });
      }
      const group = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [created] = await tx
            .insert(communityGroups)
            .values({
              churchId,
              name: name.trim(),
              description: typeof description === 'string' ? description.trim() || null : null,
              category: typeof category === 'string' && category.trim() ? category.trim() : 'Général',
              createdByUserId: userId,
            })
            .returning();
          await tx.insert(communityGroupMembers).values({
            churchId,
            groupId: created.id,
            userId,
          });
          return created;
        }
      );
      return res.status(201).json({ group });
    } catch (error) {
      console.error('Create group error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du groupe.' });
    }
  }
);

socialRouter.post(
  '/:churchId/social/groups/:groupId/join',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const groupId = Number(req.params.groupId);

      const isMember = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(communityGroupMembers)
            .where(
              and(eq(communityGroupMembers.groupId, groupId), eq(communityGroupMembers.userId, userId))
            )
            .limit(1);

          if (existing.length) {
            await tx.delete(communityGroupMembers).where(eq(communityGroupMembers.id, existing[0].id));
            return false;
          }
          await tx.insert(communityGroupMembers).values({ churchId, groupId, userId });
          return true;
        }
      );
      return res.json({ isMember });
    } catch (error) {
      console.error('Join group error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du groupe.' });
    }
  }
);

// Follow & Public Profiles
socialRouter.post(
  '/:churchId/social/users/:targetUserId/follow',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const targetUserId = Number(req.params.targetUserId);
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Action impossible sur vous-même.' });
      }

      const following = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(userFollows)
            .where(
              and(
                eq(userFollows.churchId, churchId),
                eq(userFollows.followerUserId, userId),
                eq(userFollows.followingUserId, targetUserId)
              )
            )
            .limit(1);

          if (existing.length) {
            await tx.delete(userFollows).where(eq(userFollows.id, existing[0].id));
            return false;
          }
          await tx.insert(userFollows).values({
            churchId,
            followerUserId: userId,
            followingUserId: targetUserId,
          });
          return true;
        }
      );

      return res.json({ following });
    } catch (error) {
      console.error('Follow error:', error);
      return res.status(500).json({ error: 'Erreur lors du suivi.' });
    }
  }
);

socialRouter.get(
  '/:churchId/social/users/:targetUserId/profile',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const targetUserId = Number(req.params.targetUserId);

      const profile = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [member] = await tx
            .select({
              userId: users.id,
              fullName: users.fullName,
              city: users.city,
              bio: users.bio,
              avatarUrl: users.avatarUrl,
              role: churchMemberships.role,
              leadershipTitle: churchMemberships.leadershipTitle,
              joinedAt: churchMemberships.joinedAt,
            })
            .from(churchMemberships)
            .innerJoin(users, eq(churchMemberships.userId, users.id))
            .where(
              and(
                eq(churchMemberships.churchId, churchId),
                eq(churchMemberships.userId, targetUserId)
              )
            )
            .limit(1);

          if (!member) return null;

          const [followersCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(userFollows)
            .where(
              and(eq(userFollows.churchId, churchId), eq(userFollows.followingUserId, targetUserId))
            );
          const [postsCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(socialPosts)
            .where(
              and(eq(socialPosts.churchId, churchId), eq(socialPosts.authorUserId, targetUserId))
            );

          return {
            ...member,
            followersCount: followersCount?.count ?? 0,
            postsCount: postsCount?.count ?? 0,
          };
        }
      );

      if (!profile) {
        return res.status(404).json({ error: 'Profil membre introuvable dans cette église.' });
      }
      return res.json({ profile });
    } catch (error) {
      console.error('Public profile error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du profil.' });
    }
  }
);

// Reports & Moderation
socialRouter.post(
  '/:churchId/social/reports',
  requireChurchPermission('social.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { targetType, targetId, reason } = req.body ?? {};
      if (typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'Motif du signalement requis.' });
      }

      const [report] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(contentReports)
            .values({
              churchId,
              reporterUserId: req.authUser!.id,
              targetType: ['post', 'comment', 'user'].includes(targetType) ? targetType : 'post',
              targetId: Number(targetId) || 0,
              reason: reason.trim(),
            })
            .returning()
      );
      return res.status(201).json({ report });
    } catch (error) {
      console.error('Report error:', error);
      return res.status(500).json({ error: 'Erreur lors du signalement.' });
    }
  }
);

socialRouter.get(
  '/:churchId/social/reports',
  requireChurchPermission('social.moderate'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const reports = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: contentReports.id,
              targetType: contentReports.targetType,
              targetId: contentReports.targetId,
              reason: contentReports.reason,
              status: contentReports.status,
              reporterName: users.fullName,
              createdAt: contentReports.createdAt,
            })
            .from(contentReports)
            .innerJoin(users, eq(contentReports.reporterUserId, users.id))
            .where(eq(contentReports.churchId, churchId))
            .orderBy(desc(contentReports.createdAt))
      );
      return res.json({ reports });
    } catch (error) {
      console.error('List reports error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des signalements.' });
    }
  }
);

socialRouter.patch(
  '/:churchId/social/reports/:reportId',
  requireChurchPermission('social.moderate'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const reportId = Number(req.params.reportId);
      const { status, hidePost } = req.body ?? {};

      const updated = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [rep] = await tx
            .update(contentReports)
            .set({
              status: ['reviewed', 'dismissed', 'action_taken'].includes(status)
                ? status
                : 'reviewed',
              reviewedByUserId: req.authUser!.id,
            })
            .where(and(eq(contentReports.id, reportId), eq(contentReports.churchId, churchId)))
            .returning();

          if (rep && hidePost && rep.targetType === 'post') {
            await tx
              .update(socialPosts)
              .set({ isModeratedHidden: true })
              .where(and(eq(socialPosts.id, rep.targetId), eq(socialPosts.churchId, churchId)));
          }
          return rep;
        }
      );

      if (updated) {
        await recordAuditLog({
          churchId,
          actorUserId: req.authUser!.id,
          actorEmail: req.authUser!.email,
          action: 'CONTENT_MODERATED',
          entityType: 'content_report',
          entityId: reportId,
          details: { status: updated.status, hidePost: Boolean(hidePost) },
          ipAddress: getClientIp(req),
        });
      }

      return res.json({ report: updated });
    } catch (error) {
      console.error('Moderate report error:', error);
      return res.status(500).json({ error: 'Erreur lors de la modération.' });
    }
  }
);
