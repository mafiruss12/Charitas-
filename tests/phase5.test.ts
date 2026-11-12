import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { eq, inArray, sql } from 'drizzle-orm';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { churches, socialPosts, users } from '../src/db/schema.ts';

let server: http.Server;
let baseUrl = '';

const createdChurchIds: number[] = [];
const createdUserIds: number[] = [];

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, data: json, headers: res.headers };
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (createdChurchIds.length > 0) {
    await db.delete(churches).where(inArray(churches.id, createdChurchIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('Phase 5 — Administration Centrale Multi-Églises, Sécurité & Audit RLS Complet', () => {
  const suffix = Date.now();
  let tokenChurchAdmin = '';
  let tokenSuperAdmin = '';
  let churchId = 0;

  it('refuse /api/superadmin aux non-super-admins et autorise le Super Admin plateforme', async () => {
    const rAdmin = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p5.admin.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin Local' },
    });
    assert.ok(rAdmin.headers.get('x-ratelimit-limit'));
    tokenChurchAdmin = String(rAdmin.data.token);
    createdUserIds.push((rAdmin.data.user as { id: number }).id);

    const cRes = await api('/api/churches', {
      method: 'POST',
      token: tokenChurchAdmin,
      body: { name: `Église P5 ${suffix}`, currency: 'XOF' },
    });
    churchId = (cRes.data.church as { id: number }).id;
    createdChurchIds.push(churchId);

    // Regular church admin gets 403 on central platform console
    const denied = await api('/api/superadmin/overview', { token: tokenChurchAdmin });
    assert.equal(denied.status, 403);

    // Create dedicated platform super admin in DB
    const rSuper = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p5.super.${suffix}@test.ci`, password: 'Password123!', fullName: 'Super Admin Plateforme' },
    });
    const superId = (rSuper.data.user as { id: number }).id;
    createdUserIds.push(superId);
    tokenSuperAdmin = String(rSuper.data.token);
    await db.update(users).set({ isPlatformSuperAdmin: true }).where(eq(users.id, superId));

    const allowed = await api('/api/superadmin/overview', { token: tokenSuperAdmin });
    assert.equal(allowed.status, 200);
    const churchList = allowed.data.churches as { id: number }[];
    assert.ok(churchList.some((c) => c.id === churchId));
  });

  it('suspend/réactive une église, bascule les modules et gère le plan SaaS', async () => {
    const suspendRes = await api(`/api/superadmin/churches/${churchId}`, {
      method: 'PATCH',
      token: tokenSuperAdmin,
      body: {
        status: 'suspended',
        planName: 'growth',
        monthlyPriceXof: 25000,
        memberQuota: 2000,
        enabledModules: { marketplace: false },
      },
    });
    assert.equal(suspendRes.status, 200);

    // Local admin is blocked while church is suspended
    const blocked = await api(`/api/churches/${churchId}/dashboard`, { token: tokenChurchAdmin });
    assert.equal(blocked.status, 403);

    // Reactivate church
    const reactivate = await api(`/api/superadmin/churches/${churchId}`, {
      method: 'PATCH',
      token: tokenSuperAdmin,
      body: { status: 'active' },
    });
    assert.equal(reactivate.status, 200);

    const dashAfter = await api(`/api/churches/${churchId}/dashboard`, { token: tokenChurchAdmin });
    assert.equal(dashAfter.status, 200);
    assert.equal((dashAfter.data.church as { enabledModules: { marketplace: boolean } }).enabledModules.marketplace, false);
  });

  it('traite la modération globale et vérifie la complétude des politiques RLS PostgreSQL', async () => {
    const postRes = await api(`/api/churches/${churchId}/social/posts`, {
      method: 'POST',
      token: tokenChurchAdmin,
      body: { postType: 'text', content: 'Contenu test modération globale' },
    });
    assert.equal(postRes.status, 201);
    const postId = (postRes.data.post as { id: number }).id;

    const repRes = await api(`/api/churches/${churchId}/social/reports`, {
      method: 'POST',
      token: tokenChurchAdmin,
      body: { targetType: 'post', targetId: postId, reason: 'Contenu hors charte' },
    });
    assert.equal(repRes.status, 201);
    const reportId = (repRes.data.report as { id: number }).id;

    const actionRes = await api(`/api/superadmin/reports/${reportId}`, {
      method: 'PATCH',
      token: tokenSuperAdmin,
      body: { decision: 'action_taken' },
    });
    assert.equal(actionRes.status, 200);

    const [hiddenPost] = await withTenantContext({ isSuperAdmin: true }, async (tx) =>
      tx
        .select({ isModeratedHidden: socialPosts.isModeratedHidden })
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
    );
    assert.equal(hiddenPost?.isModeratedHidden, true);

    // Audit ALL pg_policies in public schema: 100% must have qual and with_check
    const auditRes = await db.execute(
      sql`SELECT COUNT(*)::int AS total, COUNT(qual)::int AS with_qual, COUNT(with_check)::int AS with_check FROM pg_policies WHERE schemaname = 'public'`
    );
    const row = auditRes.rows[0] as { total: number; with_qual: number; with_check: number };
    assert.ok(row.total >= 54);
    assert.equal(row.total, row.with_qual);
    assert.equal(row.total, row.with_check);
  });
});
