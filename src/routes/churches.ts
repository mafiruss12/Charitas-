import { and, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db, withTenantContext } from '../db/index.ts';
import { recordAuditLog } from '../db/audit.ts';
import { ROLE_LABELS, isValidChurchRole } from '../db/rbac.ts';
import { churchMemberships, churches, departments, invitations } from '../db/schema.ts';
import { ensureStarterChurches, initializeChurchRolePermissions } from '../db/seed.ts';
import { getClientIp, requireAuth, type AuthRequest } from '../middleware/auth.ts';

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
      .where(and(eq(churches.isPublic, true), eq(churches.status, 'active')));

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
