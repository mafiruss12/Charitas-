import crypto from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db, withTenantContext } from '../db/index.ts';
import { recordAuditLog } from '../db/audit.ts';
import {
  ALL_PERMISSIONS,
  CHURCH_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  isValidChurchRole,
  isValidPermission,
} from '../db/rbac.ts';
import {
  auditLogs,
  churchMemberships,
  churches,
  departments,
  invitations,
  rolePermissions,
  users,
  visitors,
} from '../db/schema.ts';
import { generateInviteCode } from '../lib/auth-tokens.ts';
import {
  getClientIp,
  requireAuth,
  requireChurchPermission,
  type AuthRequest,
} from '../middleware/auth.ts';

export const tenantRouter = Router({ mergeParams: true });

tenantRouter.use(requireAuth);

// 1. Church Dashboard Overview
tenantRouter.get(
  '/:churchId/dashboard',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const user = req.authUser!;

      const [church] = await db.select().from(churches).where(eq(churches.id, churchId)).limit(1);

      const data = await withTenantContext(
        { churchId, userId: user.id, isSuperAdmin: user.isPlatformSuperAdmin },
        async (tx) => {
          const allMembers = await tx
            .select({
              id: churchMemberships.id,
              role: churchMemberships.role,
              status: churchMemberships.status,
              departmentId: churchMemberships.departmentId,
            })
            .from(churchMemberships)
            .where(eq(churchMemberships.churchId, churchId));

          const deptRows = await tx
            .select()
            .from(departments)
            .where(eq(departments.churchId, churchId));

          const visitorRows = req.tenant!.permissions.includes('visitors.view')
            ? await tx
                .select({
                  id: visitors.id,
                  followUpStatus: visitors.followUpStatus,
                })
                .from(visitors)
                .where(eq(visitors.churchId, churchId))
            : [];

          const inviteRows = req.tenant!.permissions.includes('invitations.manage')
            ? await tx
                .select({
                  id: invitations.id,
                  revokedAt: invitations.revokedAt,
                  expiresAt: invitations.expiresAt,
                  usesCount: invitations.usesCount,
                  maxUses: invitations.maxUses,
                })
                .from(invitations)
                .where(eq(invitations.churchId, churchId))
            : [];

          const recentAudits = req.tenant!.permissions.includes('audit.view')
            ? await tx
                .select()
                .from(auditLogs)
                .where(eq(auditLogs.churchId, churchId))
                .orderBy(desc(auditLogs.createdAt))
                .limit(8)
            : [];

          const roleBreakdown: Record<string, number> = {};
          let activeMembers = 0;
          let leadersCount = 0;
          for (const m of allMembers) {
            if (m.status === 'active') activeMembers++;
            roleBreakdown[m.role] = (roleBreakdown[m.role] || 0) + 1;
            if (
              [
                'church_admin',
                'senior_pastor',
                'associate_pastor',
                'department_leader',
                'treasurer',
                'humanitarian_lead',
              ].includes(m.role)
            ) {
              leadersCount++;
            }
          }

          const activeInvites = inviteRows.filter(
            (i) => !i.revokedAt && i.expiresAt > new Date() && i.usesCount < i.maxUses
          ).length;

          const pendingVisitors = visitorRows.filter((v) => v.followUpStatus === 'pending').length;

          return {
            stats: {
              totalMembers: allMembers.length,
              activeMembers,
              leadersCount,
              departmentsCount: deptRows.length,
              totalVisitors: visitorRows.length,
              pendingVisitors,
              activeInvites,
            },
            roleBreakdown,
            departments: deptRows,
            recentAudits,
          };
        }
      );

      return res.json({
        church,
        tenant: req.tenant,
        ...data,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord.' });
    }
  }
);

// 2. Church Settings & Visual Identity
tenantRouter.patch(
  '/:churchId/settings',
  requireChurchPermission('church.branding'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const canManageSettings = req.tenant!.permissions.includes('church.manage');
      const body = req.body ?? {};
      const updates: Partial<typeof churches.$inferInsert> = { updatedAt: new Date() };

      const hexRegex = /^#[0-9A-Fa-f]{6}$/;

      if (typeof body.name === 'string' && body.name.trim().length >= 3) {
        updates.name = body.name.trim();
      }
      if (typeof body.tagline === 'string') updates.tagline = body.tagline.trim() || null;
      if (typeof body.description === 'string') updates.description = body.description.trim() || null;
      if (typeof body.logoUrl === 'string') updates.logoUrl = body.logoUrl.trim() || null;
      if (typeof body.bannerUrl === 'string') updates.bannerUrl = body.bannerUrl.trim() || null;
      if (typeof body.primaryColor === 'string' && hexRegex.test(body.primaryColor)) {
        updates.primaryColor = body.primaryColor;
      }
      if (typeof body.accentColor === 'string' && hexRegex.test(body.accentColor)) {
        updates.accentColor = body.accentColor;
      }
      if (body.defaultTheme === 'light' || body.defaultTheme === 'dark') {
        updates.defaultTheme = body.defaultTheme;
      }

      if (canManageSettings) {
        if (typeof body.denomination === 'string') {
          updates.denomination = body.denomination.trim() || null;
        }
        if (typeof body.address === 'string') updates.address = body.address.trim() || null;
        if (typeof body.city === 'string') updates.city = body.city.trim() || null;
        if (typeof body.country === 'string' && body.country.trim()) {
          updates.country = body.country.trim();
        }
        if (typeof body.phone === 'string') updates.phone = body.phone.trim() || null;
        if (typeof body.email === 'string') updates.email = body.email.trim() || null;
        if (typeof body.website === 'string') updates.website = body.website.trim() || null;
        if (typeof body.currency === 'string' && body.currency.trim()) {
          updates.currency = body.currency.trim();
        }
        if (typeof body.isPublic === 'boolean') updates.isPublic = body.isPublic;
        if (Array.isArray(body.serviceSchedule)) updates.serviceSchedule = body.serviceSchedule;
        if (body.enabledModules && typeof body.enabledModules === 'object') {
          updates.enabledModules = body.enabledModules;
        }
      }

      const [updated] = await db
        .update(churches)
        .set(updates)
        .where(eq(churches.id, churchId))
        .returning();

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'CHURCH_SETTINGS_UPDATED',
        entityType: 'church',
        entityId: churchId,
        details: { updatedFields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
        ipAddress: getClientIp(req),
      });

      return res.json({ church: updated });
    } catch (error) {
      console.error('Update church settings error:', error);
      return res.status(500).json({ error: "Erreur lors de la mise à jour de l'église." });
    }
  }
);

// 3. Members & Leaders Management
tenantRouter.get(
  '/:churchId/members',
  requireChurchPermission('members.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const roleFilter = typeof req.query.role === 'string' ? req.query.role.trim() : '';
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';

      const members = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const conditions = [eq(churchMemberships.churchId, churchId)];
          if (roleFilter) conditions.push(eq(churchMemberships.role, roleFilter));
          if (statusFilter) conditions.push(eq(churchMemberships.status, statusFilter));
          if (search) {
            conditions.push(
              or(
                ilike(users.fullName, `%${search}%`),
                ilike(users.email, `%${search}%`),
                ilike(churchMemberships.leadershipTitle, `%${search}%`)
              )!
            );
          }

          return tx
            .select({
              membershipId: churchMemberships.id,
              userId: users.id,
              fullName: users.fullName,
              email: users.email,
              phone: users.phone,
              city: users.city,
              avatarUrl: users.avatarUrl,
              role: churchMemberships.role,
              departmentId: churchMemberships.departmentId,
              departmentName: departments.name,
              leadershipTitle: churchMemberships.leadershipTitle,
              status: churchMemberships.status,
              joinedAt: churchMemberships.joinedAt,
            })
            .from(churchMemberships)
            .innerJoin(users, eq(churchMemberships.userId, users.id))
            .leftJoin(departments, eq(churchMemberships.departmentId, departments.id))
            .where(and(...conditions))
            .orderBy(churchMemberships.joinedAt);
        }
      );

      return res.json({ members });
    } catch (error) {
      console.error('List members error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des membres.' });
    }
  }
);

tenantRouter.patch(
  '/:churchId/members/:membershipId',
  requireChurchPermission('members.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const membershipId = Number(req.params.membershipId);
      if (!Number.isInteger(membershipId) || membershipId <= 0) {
        return res.status(400).json({ error: 'Identifiant de membre invalide.' });
      }

      const { role, departmentId, leadershipTitle, status } = req.body ?? {};

      if (role !== undefined) {
        if (typeof role !== 'string' || !isValidChurchRole(role)) {
          return res.status(400).json({ error: 'Rôle invalide.' });
        }
        if (role === 'super_admin' && !req.authUser!.isPlatformSuperAdmin) {
          return res
            .status(403)
            .json({ error: 'Seul un super administrateur plateforme peut attribuer ce rôle.' });
        }
      }

      const updated = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(churchMemberships)
            .where(
              and(
                eq(churchMemberships.id, membershipId),
                eq(churchMemberships.churchId, churchId)
              )
            )
            .limit(1);

          if (!existing.length) return null;

          const updates: Partial<typeof churchMemberships.$inferInsert> = {
            updatedAt: new Date(),
          };
          if (role !== undefined) updates.role = role;
          if (departmentId !== undefined) {
            updates.departmentId =
              departmentId === null || departmentId === '' ? null : Number(departmentId);
          }
          if (leadershipTitle !== undefined) {
            updates.leadershipTitle =
              typeof leadershipTitle === 'string' && leadershipTitle.trim()
                ? leadershipTitle.trim()
                : null;
          }
          if (status === 'active' || status === 'suspended') {
            updates.status = status;
          }

          const [row] = await tx
            .update(churchMemberships)
            .set(updates)
            .where(
              and(
                eq(churchMemberships.id, membershipId),
                eq(churchMemberships.churchId, churchId)
              )
            )
            .returning();
          return row;
        }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Membre introuvable dans cette église.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'MEMBER_UPDATED',
        entityType: 'membership',
        entityId: membershipId,
        details: { role: updated.role, departmentId: updated.departmentId, status: updated.status },
        ipAddress: getClientIp(req),
      });

      return res.json({ membership: updated });
    } catch (error) {
      console.error('Update member error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du membre.' });
    }
  }
);

// 4. Departments Management
tenantRouter.get(
  '/:churchId/departments',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const depts = await tx
            .select({
              id: departments.id,
              churchId: departments.churchId,
              name: departments.name,
              description: departments.description,
              leaderUserId: departments.leaderUserId,
              leaderName: users.fullName,
              createdAt: departments.createdAt,
            })
            .from(departments)
            .leftJoin(users, eq(departments.leaderUserId, users.id))
            .where(eq(departments.churchId, churchId))
            .orderBy(departments.name);

          const counts = await tx
            .select({
              departmentId: churchMemberships.departmentId,
              count: sql<number>`count(*)::int`,
            })
            .from(churchMemberships)
            .where(eq(churchMemberships.churchId, churchId))
            .groupBy(churchMemberships.departmentId);

          const countMap = new Map(counts.map((c) => [c.departmentId, c.count]));
          return depts.map((d) => ({ ...d, memberCount: countMap.get(d.id) ?? 0 }));
        }
      );

      return res.json({ departments: rows });
    } catch (error) {
      console.error('List departments error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des départements.' });
    }
  }
);

tenantRouter.post(
  '/:churchId/departments',
  requireChurchPermission('departments.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { name, description, leaderUserId } = req.body ?? {};
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Nom du département requis.' });
      }

      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(departments)
            .values({
              churchId,
              name: name.trim(),
              description: typeof description === 'string' ? description.trim() || null : null,
              leaderUserId:
                leaderUserId && Number.isInteger(Number(leaderUserId))
                  ? Number(leaderUserId)
                  : null,
            })
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'DEPARTMENT_CREATED',
        entityType: 'department',
        entityId: created.id,
        details: { name: created.name },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ department: created });
    } catch (error: unknown) {
      console.error('Create department error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du département.' });
    }
  }
);

tenantRouter.patch(
  '/:churchId/departments/:deptId',
  requireChurchPermission('departments.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const deptId = Number(req.params.deptId);
      const { name, description, leaderUserId } = req.body ?? {};

      const updates: Partial<typeof departments.$inferInsert> = { updatedAt: new Date() };
      if (typeof name === 'string' && name.trim().length >= 2) updates.name = name.trim();
      if (typeof description === 'string') updates.description = description.trim() || null;
      if (leaderUserId !== undefined) {
        updates.leaderUserId = leaderUserId ? Number(leaderUserId) : null;
      }

      const updated = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(departments)
            .set(updates)
            .where(and(eq(departments.id, deptId), eq(departments.churchId, churchId)))
            .returning()
      );

      if (!updated.length) {
        return res.status(404).json({ error: 'Département introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'department',
        entityId: deptId,
        details: { name: updated[0].name, leaderUserId: updated[0].leaderUserId },
        ipAddress: getClientIp(req),
      });

      return res.json({ department: updated[0] });
    } catch (error) {
      console.error('Update department error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du département.' });
    }
  }
);

tenantRouter.delete(
  '/:churchId/departments/:deptId',
  requireChurchPermission('departments.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const deptId = Number(req.params.deptId);

      const deleted = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .delete(departments)
            .where(and(eq(departments.id, deptId), eq(departments.churchId, churchId)))
            .returning()
      );

      if (!deleted.length) {
        return res.status(404).json({ error: 'Département introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'DEPARTMENT_DELETED',
        entityType: 'department',
        entityId: deptId,
        details: { name: deleted[0].name },
        ipAddress: getClientIp(req),
      });

      return res.json({ deleted: true });
    } catch (error) {
      console.error('Delete department error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression du département.' });
    }
  }
);

// 5. Granular Role & Permissions Configuration
tenantRouter.get(
  '/:churchId/roles',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;

      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx.select().from(rolePermissions).where(eq(rolePermissions.churchId, churchId))
      );

      const map = new Map(rows.map((r) => [r.role, r.permissions]));
      const roles = CHURCH_ROLES.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        permissions: map.get(role) ?? DEFAULT_ROLE_PERMISSIONS[role],
      }));

      const permissionsCatalog = ALL_PERMISSIONS.map((key) => ({
        key,
        label: PERMISSION_LABELS[key],
      }));

      return res.json({ roles, permissionsCatalog });
    } catch (error) {
      console.error('List roles error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des rôles.' });
    }
  }
);

tenantRouter.put(
  '/:churchId/roles/:role',
  requireChurchPermission('roles.configure'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const role = String(req.params.role || '');

      if (!isValidChurchRole(role)) {
        return res.status(400).json({ error: 'Rôle invalide.' });
      }
      if (role === 'super_admin') {
        return res
          .status(403)
          .json({ error: 'Les permissions du Super Administrateur ne peuvent pas être restreintes.' });
      }

      const rawPerms = req.body?.permissions;
      if (!Array.isArray(rawPerms)) {
        return res.status(400).json({ error: 'Liste de permissions attendue.' });
      }

      const validPerms = Array.from(new Set(rawPerms.filter((p): p is string => isValidPermission(String(p)))));
      if (role === 'church_admin' && !validPerms.includes('roles.configure')) {
        validPerms.push('roles.configure', 'church.view', 'church.manage', 'members.manage');
      }

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(rolePermissions)
            .values({
              churchId,
              role,
              permissions: validPerms,
              updatedByUserId: req.authUser!.id,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [rolePermissions.churchId, rolePermissions.role],
              set: {
                permissions: validPerms,
                updatedByUserId: req.authUser!.id,
                updatedAt: new Date(),
              },
            })
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entityType: 'role_permissions',
        entityId: role,
        details: { permissionsCount: validPerms.length },
        ipAddress: getClientIp(req),
      });

      return res.json({ rolePermission: updated });
    } catch (error) {
      console.error('Update role permissions error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour des permissions.' });
    }
  }
);

// 6. Invitations Management
tenantRouter.get(
  '/:churchId/invitations',
  requireChurchPermission('invitations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: invitations.id,
              code: invitations.code,
              invitedEmail: invitations.invitedEmail,
              targetRole: invitations.targetRole,
              departmentId: invitations.departmentId,
              departmentName: departments.name,
              maxUses: invitations.maxUses,
              usesCount: invitations.usesCount,
              expiresAt: invitations.expiresAt,
              revokedAt: invitations.revokedAt,
              createdAt: invitations.createdAt,
            })
            .from(invitations)
            .leftJoin(departments, eq(invitations.departmentId, departments.id))
            .where(eq(invitations.churchId, churchId))
            .orderBy(desc(invitations.createdAt))
      );

      return res.json({ invitations: rows });
    } catch (error) {
      console.error('List invitations error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des invitations.' });
    }
  }
);

tenantRouter.post(
  '/:churchId/invitations',
  requireChurchPermission('invitations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { invitedEmail, targetRole, departmentId, maxUses, expiresInDays } = req.body ?? {};

      const role = typeof targetRole === 'string' && isValidChurchRole(targetRole) ? targetRole : 'member';
      if (role === 'super_admin') {
        return res.status(403).json({ error: "Impossible d'inviter en tant que super administrateur." });
      }

      const safeMaxUses = Math.min(Math.max(Number(maxUses) || 1, 1), 500);
      const safeDays = Math.min(Math.max(Number(expiresInDays) || 7, 1), 90);
      const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
      const prefix = req.tenant!.churchSlug.slice(0, 3).toUpperCase() || 'SAN';
      const code = generateInviteCode(prefix);

      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(invitations)
            .values({
              churchId,
              code,
              invitedEmail:
                typeof invitedEmail === 'string' && invitedEmail.trim()
                  ? invitedEmail.trim().toLowerCase()
                  : null,
              targetRole: role,
              departmentId: departmentId ? Number(departmentId) : null,
              invitedByUserId: req.authUser!.id,
              maxUses: safeMaxUses,
              expiresAt,
            })
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'INVITATION_CREATED',
        entityType: 'invitation',
        entityId: created.id,
        details: { code: created.code, targetRole: created.targetRole, maxUses: created.maxUses },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ invitation: created });
    } catch (error) {
      console.error('Create invitation error:', error);
      return res.status(500).json({ error: "Erreur lors de la création de l'invitation." });
    }
  }
);

tenantRouter.post(
  '/:churchId/invitations/:invitationId/revoke',
  requireChurchPermission('invitations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const invitationId = Number(req.params.invitationId);

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(invitations)
            .set({ revokedAt: new Date() })
            .where(and(eq(invitations.id, invitationId), eq(invitations.churchId, churchId)))
            .returning()
      );

      if (!updated) {
        return res.status(404).json({ error: 'Invitation introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'INVITATION_REVOKED',
        entityType: 'invitation',
        entityId: invitationId,
        details: { code: updated.code },
        ipAddress: getClientIp(req),
      });

      return res.json({ invitation: updated });
    } catch (error) {
      console.error('Revoke invitation error:', error);
      return res.status(500).json({ error: "Erreur lors de la révocation de l'invitation." });
    }
  }
);

// 7. Visitors Management
tenantRouter.get(
  '/:churchId/visitors',
  requireChurchPermission('visitors.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: visitors.id,
              churchId: visitors.churchId,
              fullName: visitors.fullName,
              email: visitors.email,
              phone: visitors.phone,
              visitDate: visitors.visitDate,
              source: visitors.source,
              prayerOrNeed: visitors.prayerOrNeed,
              followUpStatus: visitors.followUpStatus,
              assignedLeaderId: visitors.assignedLeaderId,
              assignedLeaderName: users.fullName,
              notes: visitors.notes,
              convertedUserId: visitors.convertedUserId,
              createdAt: visitors.createdAt,
            })
            .from(visitors)
            .leftJoin(users, eq(visitors.assignedLeaderId, users.id))
            .where(eq(visitors.churchId, churchId))
            .orderBy(desc(visitors.createdAt))
      );

      return res.json({ visitors: rows });
    } catch (error) {
      console.error('List visitors error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des visiteurs.' });
    }
  }
);

tenantRouter.post(
  '/:churchId/visitors',
  requireChurchPermission('visitors.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { fullName, email, phone, visitDate, source, prayerOrNeed, assignedLeaderId, notes } =
        req.body ?? {};

      if (typeof fullName !== 'string' || fullName.trim().length < 2) {
        return res.status(400).json({ error: 'Le nom du visiteur est requis.' });
      }

      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(visitors)
            .values({
              churchId,
              fullName: fullName.trim(),
              email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
              phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
              visitDate:
                typeof visitDate === 'string' && visitDate.trim()
                  ? visitDate.trim()
                  : new Date().toISOString().slice(0, 10),
              source: typeof source === 'string' && source.trim() ? source.trim() : null,
              prayerOrNeed:
                typeof prayerOrNeed === 'string' && prayerOrNeed.trim()
                  ? prayerOrNeed.trim()
                  : null,
              assignedLeaderId: assignedLeaderId ? Number(assignedLeaderId) : null,
              notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
              followUpStatus: 'pending',
            })
            .returning()
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'VISITOR_CREATED',
        entityType: 'visitor',
        entityId: created.id,
        details: { fullName: created.fullName, visitDate: created.visitDate },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ visitor: created });
    } catch (error) {
      console.error('Create visitor error:', error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement du visiteur." });
    }
  }
);

tenantRouter.patch(
  '/:churchId/visitors/:visitorId',
  requireChurchPermission('visitors.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const visitorId = Number(req.params.visitorId);
      const { followUpStatus, notes, assignedLeaderId } = req.body ?? {};

      const updates: Partial<typeof visitors.$inferInsert> = { updatedAt: new Date() };
      if (
        followUpStatus === 'pending' ||
        followUpStatus === 'contacted' ||
        followUpStatus === 'integrated' ||
        followUpStatus === 'archived'
      ) {
        updates.followUpStatus = followUpStatus;
      }
      if (typeof notes === 'string') updates.notes = notes.trim() || null;
      if (assignedLeaderId !== undefined) {
        updates.assignedLeaderId = assignedLeaderId ? Number(assignedLeaderId) : null;
      }

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(visitors)
            .set(updates)
            .where(and(eq(visitors.id, visitorId), eq(visitors.churchId, churchId)))
            .returning()
      );

      if (!updated) {
        return res.status(404).json({ error: 'Visiteur introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'VISITOR_UPDATED',
        entityType: 'visitor',
        entityId: visitorId,
        details: { followUpStatus: updated.followUpStatus },
        ipAddress: getClientIp(req),
      });

      return res.json({ visitor: updated });
    } catch (error) {
      console.error('Update visitor error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du visiteur.' });
    }
  }
);

tenantRouter.post(
  '/:churchId/visitors/:visitorId/convert',
  requireChurchPermission('members.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const visitorId = Number(req.params.visitorId);

      if (!req.tenant!.permissions.includes('visitors.manage')) {
        return res.status(403).json({ error: 'Permission visitors.manage requise.' });
      }

      const result = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const visitorRows = await tx
            .select()
            .from(visitors)
            .where(and(eq(visitors.id, visitorId), eq(visitors.churchId, churchId)))
            .limit(1);

          if (!visitorRows.length) return null;
          const v = visitorRows[0];

          const targetEmail = v.email || `membre.visiteur.${v.id}.${churchId}@sanctuaire.local`;
          const existingUser = await tx
            .select()
            .from(users)
            .where(eq(users.email, targetEmail))
            .limit(1);

          let memberUserId: number;
          if (existingUser.length) {
            memberUserId = existingUser[0].id;
          } else {
            const [createdUser] = await tx
              .insert(users)
              .values({
                uid: `visitor_${crypto.randomUUID()}`,
                email: targetEmail,
                fullName: v.fullName,
                phone: v.phone,
                emailVerified: false,
              })
              .returning();
            memberUserId = createdUser.id;
          }

          const [membership] = await tx
            .insert(churchMemberships)
            .values({
              churchId,
              userId: memberUserId,
              role: 'member',
              status: 'active',
            })
            .onConflictDoUpdate({
              target: [churchMemberships.churchId, churchMemberships.userId],
              set: { status: 'active', updatedAt: new Date() },
            })
            .returning();

          const [updatedVisitor] = await tx
            .update(visitors)
            .set({
              followUpStatus: 'integrated',
              convertedUserId: memberUserId,
              updatedAt: new Date(),
            })
            .where(eq(visitors.id, v.id))
            .returning();

          return { visitor: updatedVisitor, membership };
        }
      );

      if (!result) {
        return res.status(404).json({ error: 'Visiteur introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'VISITOR_CONVERTED_TO_MEMBER',
        entityType: 'visitor',
        entityId: visitorId,
        details: { membershipId: result.membership.id },
        ipAddress: getClientIp(req),
      });

      return res.json(result);
    } catch (error) {
      console.error('Convert visitor error:', error);
      return res.status(500).json({ error: 'Erreur lors de la conversion du visiteur.' });
    }
  }
);

// 8. Audit Logs
tenantRouter.get(
  '/:churchId/audit-logs',
  requireChurchPermission('audit.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim() : '';

      const logs = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const conditions = [eq(auditLogs.churchId, churchId)];
          if (actionFilter) {
            conditions.push(ilike(auditLogs.action, `%${actionFilter}%`));
          }
          return tx
            .select()
            .from(auditLogs)
            .where(and(...conditions))
            .orderBy(desc(auditLogs.createdAt))
            .limit(100);
        }
      );

      return res.json({ logs });
    } catch (error) {
      console.error('List audit logs error:', error);
      return res.status(500).json({ error: "Erreur lors du chargement du journal d'audit." });
    }
  }
);
