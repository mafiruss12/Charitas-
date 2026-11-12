import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { churches, users, visitors } from '../src/db/schema.ts';

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
  return { status: res.status, data: json };
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
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('Phase 1 — Fondation, Multi-Tenant, RBAC & RLS', () => {
  const suffix = Date.now();
  const emailA = `pasteur.alpha.${suffix}@test.ci`;
  const emailB = `pasteur.beta.${suffix}@test.ci`;
  const emailC = `visiteur.gamma.${suffix}@test.ci`;

  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let churchAId = 0;
  let churchBId = 0;
  let inviteCodeA = '';
  let visitorAId = 0;

  it('retourne la liste des églises publiques de démarrage', async () => {
    const res = await api('/api/public/churches');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.churches));
    assert.ok((res.data.churches as unknown[]).length >= 2);
  });

  it('permet inscription, connexion et réinitialisation de mot de passe', async () => {
    const regA = await api('/api/auth/register', {
      method: 'POST',
      body: { email: emailA, password: 'Password123!', fullName: 'Pasteur Alpha', city: 'Abidjan' },
    });
    assert.equal(regA.status, 201);
    tokenA = String(regA.data.token);
    createdUserIds.push((regA.data.user as { id: number }).id);

    const forgot = await api('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: emailA },
    });
    assert.equal(forgot.status, 200);
    const resetCode = String(forgot.data.previewResetCode || '');
    assert.ok(resetCode.length > 10);

    const reset = await api('/api/auth/reset-password', {
      method: 'POST',
      body: { token: resetCode, newPassword: 'NewPassword456!' },
    });
    assert.equal(reset.status, 200);

    const loginNew = await api('/api/auth/login', {
      method: 'POST',
      body: { email: emailA, password: 'NewPassword456!' },
    });
    assert.equal(loginNew.status, 200);
    tokenA = String(loginNew.data.token);

    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: emailB, password: 'Password123!', fullName: 'Pasteur Beta', city: 'Bouaké' },
    });
    assert.equal(regB.status, 201);
    tokenB = String(regB.data.token);
    createdUserIds.push((regB.data.user as { id: number }).id);
  });

  it('permet de créer plusieurs églises indépendantes avec personnalisation', async () => {
    const cA = await api('/api/churches', {
      method: 'POST',
      token: tokenA,
      body: {
        name: `Église Alpha ${suffix}`,
        city: 'Abidjan',
        primaryColor: '#1E3A5F',
        accentColor: '#B45309',
        currency: 'XOF',
      },
    });
    assert.equal(cA.status, 201);
    churchAId = (cA.data.church as { id: number }).id;
    createdChurchIds.push(churchAId);

    const cB = await api('/api/churches', {
      method: 'POST',
      token: tokenB,
      body: {
        name: `Église Beta ${suffix}`,
        city: 'Bouaké',
        primaryColor: '#14532D',
        accentColor: '#D97706',
        currency: 'XOF',
      },
    });
    assert.equal(cB.status, 201);
    churchBId = (cB.data.church as { id: number }).id;
    createdChurchIds.push(churchBId);

    const dashA = await api(`/api/churches/${churchAId}/dashboard`, { token: tokenA });
    assert.equal(dashA.status, 200);
    assert.equal((dashA.data.church as { id: number }).id, churchAId);
  });

  it("applique strictement l'isolation multi-tenant API et PostgreSQL RLS", async () => {
    const createVis = await api(`/api/churches/${churchAId}/visitors`, {
      method: 'POST',
      token: tokenA,
      body: {
        fullName: 'Visiteur Confidentiel Alpha',
        phone: '+225 0700000001',
        visitDate: '2026-11-10',
      },
    });
    assert.equal(createVis.status, 201);
    visitorAId = (createVis.data.visitor as { id: number }).id;

    // API isolation: Pasteur B cannot access Church A visitors or dashboard
    const crossRead = await api(`/api/churches/${churchAId}/visitors`, { token: tokenB });
    assert.equal(crossRead.status, 403);

    const crossDash = await api(`/api/churches/${churchAId}/dashboard`, { token: tokenB });
    assert.equal(crossDash.status, 403);

    // PostgreSQL RLS isolation: querying `visitors` without WHERE inside Church B context returns 0 Church A rows
    const rlsRowsInB = await withTenantContext({ churchId: churchBId, isSuperAdmin: false }, async (tx) =>
      tx.select().from(visitors)
    );
    assert.equal(
      rlsRowsInB.some((v) => v.id === visitorAId),
      false,
      'RLS must prevent Church B context from seeing Church A visitors'
    );

    // PostgreSQL RLS with unset church context returns 0 rows
    const rlsRowsUnset = await withTenantContext({ churchId: null, isSuperAdmin: false }, async (tx) =>
      tx.select().from(visitors)
    );
    assert.equal(rlsRowsUnset.length, 0, 'RLS must return 0 rows when no church context is set');
  });

  it('applique les invitations, rôles granulaires, conversion visiteur et journal audit', async () => {
    const inv = await api(`/api/churches/${churchAId}/invitations`, {
      method: 'POST',
      token: tokenA,
      body: { targetRole: 'visitor', maxUses: 2, expiresInDays: 7 },
    });
    assert.equal(inv.status, 201);
    inviteCodeA = (inv.data.invitation as { code: string }).code;

    const regC = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: emailC,
        password: 'Password123!',
        fullName: 'Visiteur Gamma',
        invitationCode: inviteCodeA,
      },
    });
    assert.equal(regC.status, 201);
    tokenC = String(regC.data.token);
    createdUserIds.push((regC.data.user as { id: number }).id);

    // Role 'visitor' does not have departments.manage
    const forbiddenDept = await api(`/api/churches/${churchAId}/departments`, {
      method: 'POST',
      token: tokenC,
      body: { name: 'Département Non Autorisé' },
    });
    assert.equal(forbiddenDept.status, 403);

    // Pasteur A converts visitorA into member
    const conv = await api(`/api/churches/${churchAId}/visitors/${visitorAId}/convert`, {
      method: 'POST',
      token: tokenA,
    });
    assert.equal(conv.status, 200);
    assert.equal((conv.data.visitor as { followUpStatus: string }).followUpStatus, 'integrated');

    // Audit log recorded actions
    const logs = await api(`/api/churches/${churchAId}/audit-logs`, { token: tokenA });
    assert.equal(logs.status, 200);
    const actions = (logs.data.logs as { action: string }[]).map((l) => l.action);
    assert.ok(actions.includes('CHURCH_CREATED'));
    assert.ok(actions.includes('VISITOR_CONVERTED_TO_MEMBER'));
  });
});
