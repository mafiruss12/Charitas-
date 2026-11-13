import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server.ts';
import { pool } from '../src/db/index.ts';

let server: http.Server;
let baseUrl = '';

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
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('API Publiques Visiteur Android CHARITAS (Phase 6)', () => {
  it('expose /api/public/spiritual/daily, /api/public/media et /api/public/solidarity sans authentification ni fuite PII', async () => {
    const [spRes, medRes, solRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/spiritual/daily`),
      fetch(`${baseUrl}/api/public/media`),
      fetch(`${baseUrl}/api/public/solidarity`),
    ]);

    assert.equal(spRes.status, 200);
    assert.equal(medRes.status, 200);
    assert.equal(solRes.status, 200);

    const spJson = (await spRes.json()) as Record<string, unknown>;
    const medJson = (await medRes.json()) as Record<string, unknown>;
    const solJson = (await solRes.json()) as Record<string, unknown>;

    assert.ok(Array.isArray(spJson.meditations));
    assert.ok(Array.isArray(spJson.readingPlans));
    assert.ok(Array.isArray(medJson.media));
    assert.ok(Array.isArray(solJson.campaigns));
    assert.ok(Array.isArray(solJson.reports));
    assert.ok(Array.isArray(solJson.volunteerMissions));

    // Confirm zero beneficiary PII keys leaked in solidarity public endpoint
    const serialized = JSON.stringify(solJson);
    assert.ok(!serialized.includes('beneficiaryEmail'));
    assert.ok(!serialized.includes('beneficiaryPhone'));
    assert.ok(!serialized.includes('housingStatus'));
  });
});
