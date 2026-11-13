import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db, withTenantContext } from '../db/index.ts';
import { recordAuditLog } from '../db/audit.ts';
import { DEFAULT_ROLE_PERMISSIONS, isValidChurchRole, type ChurchRole } from '../db/rbac.ts';
import {
  churchMemberships,
  churches,
  invitations,
  passwordResets,
  rolePermissions,
  users,
} from '../db/schema.ts';
import { ensureStarterChurches } from '../db/seed.ts';
import {
  generateResetToken,
  hashResetToken,
  signSessionToken,
} from '../lib/auth-tokens.ts';
import { getClientIp, requireAuth, type AuthRequest } from '../middleware/auth.ts';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    await ensureStarterChurches();
    const { email, password, fullName, phone, city, country, invitationCode, churchId } =
      req.body ?? {};

    if (typeof email !== 'string' || !email.includes('@') || email.length > 180) {
      return res.status(400).json({ error: 'Adresse email valide requise.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Le nom complet est requis (min. 2 caractères).' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    // Bootstrap check: if 0 users exist in platform, very first account is platform super_admin
    const userCountRows = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const isFirstPlatformUser = (userCountRows[0]?.count ?? 0) === 0;

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = `local_${crypto.randomUUID()}`;

    const [createdUser] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
        city: typeof city === 'string' && city.trim() ? city.trim() : null,
        country: typeof country === 'string' && country.trim() ? country.trim() : "Côte d'Ivoire",
        isPlatformSuperAdmin: isFirstPlatformUser,
        emailVerified: true,
        lastLoginAt: new Date(),
      })
      .returning();

    let joinedChurchId: number | null = null;

    if (typeof invitationCode === 'string' && invitationCode.trim()) {
      const code = invitationCode.trim().toUpperCase();
      const inviteRows = await withTenantContext({ isSuperAdmin: true }, async (tx) =>
        tx.select().from(invitations).where(eq(invitations.code, code)).limit(1)
      );

      if (inviteRows.length) {
        const inv = inviteRows[0];
        const valid =
          !inv.revokedAt &&
          inv.expiresAt > new Date() &&
          inv.usesCount < inv.maxUses &&
          (!inv.invitedEmail || inv.invitedEmail.toLowerCase() === normalizedEmail);

        if (valid) {
          await withTenantContext({ churchId: inv.churchId, isSuperAdmin: true }, async (tx) => {
            await tx.insert(churchMemberships).values({
              churchId: inv.churchId,
              userId: createdUser.id,
              role: inv.targetRole === 'super_admin' ? 'church_admin' : inv.targetRole,
              departmentId: inv.departmentId,
              status: 'active',
            });
            await tx
              .update(invitations)
              .set({ usesCount: inv.usesCount + 1 })
              .where(eq(invitations.id, inv.id));
          });
          joinedChurchId = inv.churchId;
        }
      }
    } else if (Number.isInteger(Number(churchId)) && Number(churchId) > 0) {
      const cid = Number(churchId);
      const churchRows = await db
        .select()
        .from(churches)
        .where(and(eq(churches.id, cid), eq(churches.isPublic, true)))
        .limit(1);

      if (churchRows.length) {
        await withTenantContext({ churchId: cid, isSuperAdmin: true }, async (tx) => {
          await tx
            .insert(churchMemberships)
            .values({
              churchId: cid,
              userId: createdUser.id,
              role: 'member',
              status: 'active',
            })
            .onConflictDoNothing();
        });
        joinedChurchId = cid;
      }
    }

    await recordAuditLog({
      churchId: joinedChurchId,
      actorUserId: createdUser.id,
      actorEmail: createdUser.email,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: createdUser.id,
      details: { fullName: createdUser.fullName, isFirstPlatformUser },
      ipAddress: getClientIp(req),
    });

    const token = signSessionToken({
      uid: createdUser.uid,
      userId: createdUser.id,
      email: createdUser.email,
    });

    return res.status(201).json({
      token,
      user: {
        id: createdUser.id,
        uid: createdUser.uid,
        email: createdUser.email,
        fullName: createdUser.fullName,
        phone: createdUser.phone,
        city: createdUser.city,
        country: createdUser.country,
        bio: createdUser.bio,
        avatarUrl: createdUser.avatarUrl,
        preferredTheme: createdUser.preferredTheme,
        isPlatformSuperAdmin: createdUser.isPlatformSuperAdmin,
        emailVerified: createdUser.emailVerified,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: "Erreur lors de l'inscription." });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    await ensureStarterChurches();
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = found[0];
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Identifiants invalides ou compte connecté via Google.' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await recordAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: getClientIp(req),
    });

    const token = signSessionToken({
      uid: user.uid,
      userId: user.id,
      email: user.email,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        city: user.city,
        country: user.country,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        preferredTheme: user.preferredTheme,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Adresse email valide requise.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    let previewResetCode: string | undefined;

    if (found.length) {
      const user = found[0];
      const { rawToken, tokenHash } = generateResetToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.insert(passwordResets).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      await recordAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'user',
        entityId: user.id,
        ipAddress: getClientIp(req),
      });

      // Only surface a preview token in non-production when SMTP is not configured
      if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
        previewResetCode = rawToken;
      }
    }

    return res.json({
      message:
        'Si un compte correspond à cet email, les instructions de réinitialisation ont été générées.',
      ...(previewResetCode ? { previewResetCode } : {}),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation.' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Code ou jeton de réinitialisation requis.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const tokenHash = hashResetToken(token.trim());
    const resetRows = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetRows.length) {
      return res.status(400).json({ error: 'Jeton de réinitialisation invalide ou expiré.' });
    }

    const resetRecord = resetRows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetRecord.userId));

    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, resetRecord.id));

    await recordAuditLog({
      actorUserId: resetRecord.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'user',
      entityId: resetRecord.userId,
      ipAddress: getClientIp(req),
    });

    return res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureStarterChurches();
    const user = req.authUser!;

    // If super admin, ensure they can see all churches or their memberships
    const memberships = await withTenantContext(
      { userId: user.id, isSuperAdmin: user.isPlatformSuperAdmin },
      async (tx) => {
        const rows = await tx
          .select({
            membershipId: churchMemberships.id,
            churchId: churchMemberships.churchId,
            role: churchMemberships.role,
            departmentId: churchMemberships.departmentId,
            leadershipTitle: churchMemberships.leadershipTitle,
            status: churchMemberships.status,
            joinedAt: churchMemberships.joinedAt,
            churchName: churches.name,
            churchSlug: churches.slug,
            churchLogoUrl: churches.logoUrl,
            churchBannerUrl: churches.bannerUrl,
            churchPrimaryColor: churches.primaryColor,
            churchAccentColor: churches.accentColor,
            churchCurrency: churches.currency,
            churchCity: churches.city,
            churchCountry: churches.country,
            enabledModules: churches.enabledModules,
          })
          .from(churchMemberships)
          .innerJoin(churches, eq(churchMemberships.churchId, churches.id))
          .where(eq(churchMemberships.userId, user.id));

        const enriched = await Promise.all(
          rows.map(async (row) => {
            const role: ChurchRole = isValidChurchRole(row.role) ? row.role : 'member';
            const custom = await withTenantContext(
              { churchId: row.churchId, userId: user.id, isSuperAdmin: true },
              async (innerTx) =>
                innerTx
                  .select()
                  .from(rolePermissions)
                  .where(
                    and(
                      eq(rolePermissions.churchId, row.churchId),
                      eq(rolePermissions.role, role)
                    )
                  )
                  .limit(1)
            );
            const permissions = custom.length
              ? custom[0].permissions
              : DEFAULT_ROLE_PERMISSIONS[role];
            return { ...row, permissions };
          })
        );
        return enriched;
      }
    );

    return res.json({
      user,
      memberships,
    });
  } catch (error) {
    console.error('Get /me error:', error);
    return res.status(500).json({ error: 'Erreur lors du chargement du profil.' });
  }
});

authRouter.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const { fullName, phone, city, country, bio, avatarUrl, preferredTheme } = req.body ?? {};

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      updates.fullName = fullName.trim();
    }
    if (typeof phone === 'string') {
      updates.phone = phone.trim() || null;
    }
    if (typeof city === 'string') {
      updates.city = city.trim() || null;
    }
    if (typeof country === 'string' && country.trim()) {
      updates.country = country.trim();
    }
    if (typeof bio === 'string') {
      updates.bio = bio.trim() || null;
    }
    if (typeof avatarUrl === 'string') {
      updates.avatarUrl = avatarUrl.trim() || null;
    }
    if (preferredTheme === 'light' || preferredTheme === 'dark') {
      updates.preferredTheme = preferredTheme;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    await recordAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'PROFILE_UPDATED',
      entityType: 'user',
      entityId: user.id,
      ipAddress: getClientIp(req),
    });

    return res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        city: updated.city,
        country: updated.country,
        bio: updated.bio,
        avatarUrl: updated.avatarUrl,
        preferredTheme: updated.preferredTheme,
        isPlatformSuperAdmin: updated.isPlatformSuperAdmin,
        emailVerified: updated.emailVerified,
      },
    });
  } catch (error) {
    console.error('Update /me error:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});
