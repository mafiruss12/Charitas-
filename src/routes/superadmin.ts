import { desc, eq } from 'drizzle-orm';
import { Router, type NextFunction, type Response } from 'express';
import { recordAuditLog } from '../db/audit.ts';
import { withTenantContext } from '../db/index.ts';
import {
  auctions,
  churchMemberships,
  churches,
  contentReports,
  donations,
  saasSubscriptions,
  socialPosts,
  users,
  type EnabledModulesConfig,
} from '../db/schema.ts';
import { getClientIp, requireAuth, type AuthRequest } from '../middleware/auth.ts';

export const superadminRouter = Router();
superadminRouter.use(requireAuth);

function requirePlatformSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.authUser?.isPlatformSuperAdmin) {
    return res.status(403).json({
      error: 'Accès strictement réservé aux Super Administrateurs de la plateforme.',
    });
  }
  return next();
}

superadminRouter.use(requirePlatformSuperAdmin);

superadminRouter.get('/overview', async (req: AuthRequest, res) => {
  try {
    const data = await withTenantContext(
      { userId: req.authUser!.id, isSuperAdmin: true },
      async (tx) => {
        const allChurches = await tx.select().from(churches).orderBy(desc(churches.createdAt));
        const allUsers = await tx.select({ id: users.id, fullName: users.fullName }).from(users);
        const allMemberships = await tx
          .select({ churchId: churchMemberships.churchId, status: churchMemberships.status })
          .from(churchMemberships);
        const allDonations = await tx
          .select({
            churchId: donations.churchId,
            amount: donations.amount,
            status: donations.status,
          })
          .from(donations);
        const allReports = await tx
          .select()
          .from(contentReports)
          .orderBy(desc(contentReports.createdAt))
          .limit(50);
        const allAuctions = await tx
          .select({ id: auctions.id, status: auctions.status })
          .from(auctions);
        const allSubs = await tx.select().from(saasSubscriptions);

        const subMap = new Map(allSubs.map((s) => [s.churchId, s]));
        const churchNameMap = new Map(allChurches.map((c) => [c.id, c.name]));
        const userMap = new Map(allUsers.map((u) => [u.id, u.fullName]));

        const churchesSummary = allChurches.map((c) => {
          const membersCount = allMemberships.filter(
            (m) => m.churchId === c.id && m.status === 'active'
          ).length;
          const confirmedDonationsAmount = allDonations
            .filter((d) => d.churchId === c.id && d.status === 'confirmed')
            .reduce((s, d) => s + d.amount, 0);
          const pendingReports = allReports.filter(
            (r) => r.churchId === c.id && r.status === 'pending'
          ).length;
          const sub = subMap.get(c.id);

          return {
            id: c.id,
            slug: c.slug,
            name: c.name,
            city: c.city,
            country: c.country,
            currency: c.currency,
            status: c.status,
            enabledModules: c.enabledModules,
            membersCount,
            confirmedDonationsAmount,
            pendingReports,
            subscription: sub
              ? {
                  planName: sub.planName,
                  status: sub.status,
                  monthlyPriceXof: sub.monthlyPriceXof,
                  memberQuota: sub.memberQuota,
                }
              : {
                  planName: 'essential',
                  status: 'active',
                  monthlyPriceXof: 0,
                  memberQuota: 500,
                },
            createdAt: c.createdAt,
          };
        });

        const totalConfirmedDonationsAmount = allDonations
          .filter((d) => d.status === 'confirmed')
          .reduce((s, d) => s + d.amount, 0);

        return {
          stats: {
            totalChurches: allChurches.length,
            activeChurches: allChurches.filter((c) => c.status === 'active').length,
            suspendedChurches: allChurches.filter((c) => c.status !== 'active').length,
            totalUsers: allUsers.length,
            totalConfirmedDonationsAmount,
            pendingModerationReports: allReports.filter((r) => r.status === 'pending').length,
            activeAuctionsCount: allAuctions.filter((a) => a.status === 'active').length,
          },
          churches: churchesSummary,
          globalReports: allReports.map((r) => ({
            id: r.id,
            churchId: r.churchId,
            churchName: churchNameMap.get(r.churchId) || `Église #${r.churchId}`,
            targetType: r.targetType,
            targetId: r.targetId,
            reason: r.reason,
            status: r.status,
            reporterName: userMap.get(r.reporterUserId) || 'Membre',
            createdAt: r.createdAt,
          })),
        };
      }
    );

    return res.json(data);
  } catch (error) {
    console.error('Superadmin overview error:', error);
    return res.status(500).json({ error: 'Erreur lors du chargement de la console centrale.' });
  }
});

superadminRouter.patch('/churches/:churchId', async (req: AuthRequest, res) => {
  try {
    const churchId = Number(req.params.churchId);
    const { status, enabledModules, planName, subscriptionStatus, monthlyPriceXof, memberQuota } =
      req.body ?? {};

    const result = await withTenantContext(
      { churchId, userId: req.authUser!.id, isSuperAdmin: true },
      async (tx) => {
        const [existing] = await tx
          .select()
          .from(churches)
          .where(eq(churches.id, churchId))
          .limit(1);
        if (!existing) return null;

        const nextStatus =
          status === 'active' || status === 'suspended' ? status : existing.status;

        const nextModules: EnabledModulesConfig = {
          ...existing.enabledModules,
          ...(enabledModules && typeof enabledModules === 'object' ? enabledModules : {}),
        };

        const [updatedChurch] = await tx
          .update(churches)
          .set({
            status: nextStatus,
            enabledModules: nextModules,
            updatedAt: new Date(),
          })
          .where(eq(churches.id, churchId))
          .returning();

        const validPlan = ['essential', 'growth', 'network'].includes(planName)
          ? planName
          : undefined;
        const validSubStatus = ['active', 'trial', 'past_due', 'suspended'].includes(
          subscriptionStatus
        )
          ? subscriptionStatus
          : undefined;

        if (validPlan || validSubStatus || monthlyPriceXof !== undefined || memberQuota !== undefined) {
          const [sub] = await tx
            .select()
            .from(saasSubscriptions)
            .where(eq(saasSubscriptions.churchId, churchId))
            .limit(1);

          if (sub) {
            await tx
              .update(saasSubscriptions)
              .set({
                planName: validPlan ?? sub.planName,
                status: validSubStatus ?? sub.status,
                monthlyPriceXof:
                  monthlyPriceXof !== undefined ? Math.max(0, Number(monthlyPriceXof)) : sub.monthlyPriceXof,
                memberQuota:
                  memberQuota !== undefined ? Math.max(50, Number(memberQuota)) : sub.memberQuota,
                updatedByUserId: req.authUser!.id,
                updatedAt: new Date(),
              })
              .where(eq(saasSubscriptions.id, sub.id));
          } else {
            await tx.insert(saasSubscriptions).values({
              churchId,
              planName: validPlan ?? 'essential',
              status: validSubStatus ?? 'active',
              monthlyPriceXof: monthlyPriceXof !== undefined ? Math.max(0, Number(monthlyPriceXof)) : 0,
              memberQuota: memberQuota !== undefined ? Math.max(50, Number(memberQuota)) : 500,
              updatedByUserId: req.authUser!.id,
            });
          }
        }

        return updatedChurch;
      }
    );

    if (!result) {
      return res.status(404).json({ error: 'Église introuvable.' });
    }

    await recordAuditLog({
      churchId,
      actorUserId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'PLATFORM_CHURCH_GOVERNANCE_UPDATED',
      entityType: 'church',
      entityId: churchId,
      details: { status: result.status, enabledModules: result.enabledModules },
      ipAddress: getClientIp(req),
    });

    return res.json({ church: result });
  } catch (error) {
    console.error('Superadmin church update error:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de gouvernance.' });
  }
});

superadminRouter.patch('/reports/:reportId', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.reportId);
    const { decision } = req.body ?? {};
    if (!['dismissed', 'action_taken'].includes(decision)) {
      return res.status(400).json({ error: 'Décision invalide (dismissed ou action_taken).' });
    }

    const updated = await withTenantContext(
      { userId: req.authUser!.id, isSuperAdmin: true },
      async (tx) => {
        const [rep] = await tx
          .update(contentReports)
          .set({ status: decision, reviewedByUserId: req.authUser!.id })
          .where(eq(contentReports.id, reportId))
          .returning();

        if (!rep) return null;
        if (decision === 'action_taken' && rep.targetType === 'post') {
          await tx
            .update(socialPosts)
            .set({ isModeratedHidden: true })
            .where(eq(socialPosts.id, rep.targetId));
        }
        return rep;
      }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Signalement introuvable.' });
    }
    return res.json({ report: updated });
  } catch (error) {
    console.error('Superadmin report action error:', error);
    return res.status(500).json({ error: 'Erreur lors de la modération globale.' });
  }
});
