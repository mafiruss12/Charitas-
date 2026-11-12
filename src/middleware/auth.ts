import type { NextFunction, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, withTenantContext } from '../db/index.ts';
import {
  DEFAULT_ROLE_PERMISSIONS,
  isValidChurchRole,
  type ChurchRole,
  type Permission,
} from '../db/rbac.ts';
import { churchMemberships, churches, rolePermissions, users } from '../db/schema.ts';
import { verifySessionToken } from '../lib/auth-tokens.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  country: string;
  bio: string | null;
  avatarUrl: string | null;
  preferredTheme: string;
  isPlatformSuperAdmin: boolean;
  emailVerified: boolean;
}

export interface ChurchTenantContext {
  churchId: number;
  churchSlug: string;
  churchName: string;
  role: ChurchRole;
  membershipId: number | null;
  departmentId: number | null;
  permissions: Permission[];
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
  tenant?: ChurchTenantContext;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise (jeton manquant).' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Jeton invalide.' });
  }

  try {
    // 1. Check local HMAC session token first
    const localPayload = verifySessionToken(token);
    if (localPayload) {
      const found = await db
        .select()
        .from(users)
        .where(eq(users.id, localPayload.userId))
        .limit(1);

      if (!found.length) {
        return res.status(401).json({ error: 'Session expirée ou utilisateur introuvable.' });
      }
      const u = found[0];
      req.authUser = {
        id: u.id,
        uid: u.uid,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        city: u.city,
        country: u.country,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        preferredTheme: u.preferredTheme,
        isPlatformSuperAdmin: u.isPlatformSuperAdmin,
        emailVerified: u.emailVerified,
      };
      return next();
    }

    // 2. Otherwise verify Firebase ID Token
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@firebase.local`;
    const displayName = decoded.name || email.split('@')[0];

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let syncedUser;
    if (existingByEmail.length && existingByEmail[0].uid !== decoded.uid) {
      // Link Firebase UID to existing email account cleanly
      const updated = await db
        .update(users)
        .set({
          uid: decoded.uid,
          emailVerified: Boolean(decoded.email_verified),
          avatarUrl: existingByEmail[0].avatarUrl || decoded.picture || null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      syncedUser = updated[0];
    } else {
      const upserted = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email,
          fullName: displayName,
          avatarUrl: decoded.picture || null,
          emailVerified: Boolean(decoded.email_verified),
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            emailVerified: Boolean(decoded.email_verified),
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      syncedUser = upserted[0];
    }

    req.authUser = {
      id: syncedUser.id,
      uid: syncedUser.uid,
      email: syncedUser.email,
      fullName: syncedUser.fullName,
      phone: syncedUser.phone,
      city: syncedUser.city,
      country: syncedUser.country,
      bio: syncedUser.bio,
      avatarUrl: syncedUser.avatarUrl,
      preferredTheme: syncedUser.preferredTheme,
      isPlatformSuperAdmin: syncedUser.isPlatformSuperAdmin,
      emailVerified: syncedUser.emailVerified,
    };
    return next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return res.status(401).json({ error: 'Jeton d’authentification invalide ou expiré.' });
  }
}

export function requireChurchPermission(permission?: Permission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    const rawChurchId =
      req.params.churchId ||
      (typeof req.headers['x-church-id'] === 'string' ? req.headers['x-church-id'] : '');
    const churchId = Number(rawChurchId);

    if (!Number.isInteger(churchId) || churchId <= 0) {
      return res.status(400).json({ error: 'Identifiant d’église invalide ou manquant.' });
    }

    try {
      const churchRows = await db
        .select()
        .from(churches)
        .where(eq(churches.id, churchId))
        .limit(1);

      if (!churchRows.length) {
        return res.status(404).json({ error: 'Église introuvable.' });
      }
      const church = churchRows[0];

      if (church.status !== 'active' && !req.authUser.isPlatformSuperAdmin) {
        return res.status(403).json({
          error: 'Cette église est temporairement suspendue par l’administration centrale.',
        });
      }

      const ctx = await withTenantContext(
        {
          churchId,
          userId: req.authUser.id,
          isSuperAdmin: req.authUser.isPlatformSuperAdmin,
        },
        async (tx) => {
          const membershipRows = await tx
            .select()
            .from(churchMemberships)
            .where(
              and(
                eq(churchMemberships.churchId, churchId),
                eq(churchMemberships.userId, req.authUser!.id)
              )
            )
            .limit(1);

          const membership = membershipRows[0];

          if (req.authUser!.isPlatformSuperAdmin) {
            return {
              churchId,
              churchSlug: church.slug,
              churchName: church.name,
              role: 'super_admin' as ChurchRole,
              membershipId: membership?.id ?? null,
              departmentId: membership?.departmentId ?? null,
              permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
            };
          }

          if (!membership) {
            return null;
          }

          if (membership.status !== 'active') {
            return 'SUSPENDED' as const;
          }

          const role: ChurchRole = isValidChurchRole(membership.role) ? membership.role : 'member';
          const customPermsRows = await tx
            .select()
            .from(rolePermissions)
            .where(and(eq(rolePermissions.churchId, churchId), eq(rolePermissions.role, role)))
            .limit(1);

          const permissions = (
            customPermsRows.length
              ? customPermsRows[0].permissions
              : DEFAULT_ROLE_PERMISSIONS[role]
          ) as Permission[];

          return {
            churchId,
            churchSlug: church.slug,
            churchName: church.name,
            role,
            membershipId: membership.id,
            departmentId: membership.departmentId,
            permissions,
          };
        }
      );

      if (ctx === null) {
        return res.status(403).json({
          error: "Accès refusé : vous n'êtes pas membre de cette église.",
        });
      }

      if (ctx === 'SUSPENDED') {
        return res.status(403).json({
          error: 'Votre adhésion à cette église est actuellement suspendue.',
        });
      }

      if (permission && !ctx.permissions.includes(permission)) {
        return res.status(403).json({
          error: `Permission insuffisante (${permission}) pour effectuer cette action.`,
        });
      }

      req.tenant = ctx;
      return next();
    } catch (error) {
      console.error('Tenant context check failed:', error);
      return res.status(500).json({ error: 'Erreur lors de la vérification des droits.' });
    }
  };
}
