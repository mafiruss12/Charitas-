import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server.ts';

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
});

describe('DevOps API JSON & Security Guards', () => {
  it('retourne du JSON valide pour /api/health, 404 API et JSON malformé (jamais HTML)', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.ok((health.headers.get('content-type') || '').includes('application/json'));
    const healthJson = (await health.json()) as { status: string };
    assert.equal(healthJson.status, 'ok');

    const notFound = await fetch(`${baseUrl}/api/route-inexistante`);
    assert.equal(notFound.status, 404);
    assert.ok((notFound.headers.get('content-type') || '').includes('application/json'));
    const nfJson = (await notFound.json()) as { error: string };
    assert.ok(nfJson.error.length > 0);

    const badJson = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    assert.equal(badJson.status, 400);
    assert.ok((badJson.headers.get('content-type') || '').includes('application/json'));
    const badJsonBody = (await badJson.json()) as { error: string };
    assert.ok(badJsonBody.error.length > 0);
  });
});
