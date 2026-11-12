import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './src/routes/auth.ts';
import { churchesRouter } from './src/routes/churches.ts';
import { tenantRouter } from './src/routes/tenant.ts';
import { socialRouter } from './src/routes/social.ts';
import { messagingRouter } from './src/routes/messaging.ts';
import { spiritualRouter } from './src/routes/spiritual.ts';
import { eventsRouter } from './src/routes/events.ts';
import { donationsRouter, webhooksRouter } from './src/routes/donations.ts';
import { humanitarianRouter } from './src/routes/humanitarian.ts';
import { commerceRouter } from './src/routes/commerce.ts';
import { academyMediaRouter } from './src/routes/academyMedia.ts';
import { aiRouter } from './src/routes/ai.ts';
import { superadminRouter } from './src/routes/superadmin.ts';
import { createRateLimiter } from './src/middleware/rateLimit.ts';
import { attachWebSocketServer } from './src/realtime/ws.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 150,
    keyPrefix: 'auth',
    message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.',
  });
  const aiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: 'ai',
  });
  const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 200,
    keyPrefix: 'webhooks',
  });

  app.use('/api/webhooks', webhookLimiter, webhooksRouter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/superadmin', superadminRouter);
  app.use('/api', churchesRouter);
  app.use('/api/churches', tenantRouter);
  app.use('/api/churches', socialRouter);
  app.use('/api/churches', messagingRouter);
  app.use('/api/churches', spiritualRouter);
  app.use('/api/churches', eventsRouter);
  app.use('/api/churches', donationsRouter);
  app.use('/api/churches', humanitarianRouter);
  app.use('/api/churches', commerceRouter);
  app.use('/api/churches', academyMediaRouter);
  app.use('/api/churches/:churchId/ai', aiLimiter);
  app.use('/api/churches', aiRouter);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Route API introuvable.' });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  attachWebSocketServer(server);
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use('/src/assets/images', express.static(path.join(__dirname, 'src/assets/images')));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Charitas — Église Saint Louis Roi d'Ebimpé server listening on http://0.0.0.0:${port}`);
  });
}

// Only bind HTTP listener when executed as entrypoint, not when imported in tests
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
