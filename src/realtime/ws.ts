import type http from 'node:http';
import { URL } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { db, withTenantContext } from '../db/index.ts';
import { churchMemberships, users } from '../db/schema.ts';
import { verifySessionToken } from '../lib/auth-tokens.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  fullName: string;
  churchId: number | null;
}

const clients = new Set<ConnectedClient>();

async function authenticateSocketToken(token: string) {
  const local = verifySessionToken(token);
  if (local) {
    const [u] = await db.select().from(users).where(eq(users.id, local.userId)).limit(1);
    return u || null;
  }
  const decoded = await adminAuth.verifyIdToken(token);
  const [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
  return u || null;
}

export function getOnlineUserIdsForChurch(churchId: number): number[] {
  const ids = new Set<number>();
  for (const c of clients) {
    if (c.churchId === churchId && c.ws.readyState === WebSocket.OPEN) {
      ids.add(c.userId);
    }
  }
  return Array.from(ids);
}

export function broadcastToChurch(churchId: number, event: string, payload: unknown) {
  const msg = JSON.stringify({ event, payload });
  for (const c of clients) {
    if (c.churchId === churchId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  }
}

export function sendToUserInChurch(
  churchId: number,
  targetUserId: number,
  event: string,
  payload: unknown
) {
  const msg = JSON.stringify({ event, payload });
  for (const c of clients) {
    if (
      c.churchId === churchId &&
      c.userId === targetUserId &&
      c.ws.readyState === WebSocket.OPEN
    ) {
      c.ws.send(msg);
    }
  }
}

function broadcastPresence(churchId: number) {
  broadcastToChurch(churchId, 'presence:update', {
    churchId,
    onlineUserIds: getOnlineUserIdsForChurch(churchId),
  });
}

export function attachWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let clientRecord: ConnectedClient | null = null;
    let authDone = false;
    let closedEarly = false;
    const pendingMessages: string[] = [];

    const handleClientMessage = async (rawStr: string) => {
      if (!clientRecord) return;
      try {
        const parsed = JSON.parse(rawStr) as {
          event?: string;
          payload?: Record<string, unknown>;
        };
        if (parsed.event === 'subscribe:church' && parsed.payload?.churchId) {
          const cid = Number(parsed.payload.churchId);
          if (!Number.isInteger(cid) || cid <= 0) return;

          let allowed = clientRecord.userId > 0;
          const [uRow] = await db
            .select({ isSuper: users.isPlatformSuperAdmin })
            .from(users)
            .where(eq(users.id, clientRecord.userId))
            .limit(1);
          allowed = Boolean(uRow?.isSuper);
          if (!allowed) {
            const rows = await withTenantContext(
              { churchId: cid, userId: clientRecord.userId, isSuperAdmin: false },
              async (tx) =>
                tx
                  .select({ id: churchMemberships.id })
                  .from(churchMemberships)
                  .where(
                    and(
                      eq(churchMemberships.churchId, cid),
                      eq(churchMemberships.userId, clientRecord!.userId),
                      eq(churchMemberships.status, 'active')
                    )
                  )
                  .limit(1)
            );
            allowed = rows.length > 0;
          }
          if (!allowed) return;

          const prevChurchId = clientRecord.churchId;
          clientRecord.churchId = cid;
          if (prevChurchId && prevChurchId !== cid) {
            broadcastPresence(prevChurchId);
          }
          broadcastPresence(cid);
        } else if (parsed.event === 'call:signal' && clientRecord.churchId && parsed.payload) {
          const targetUserId = Number(parsed.payload.targetUserId);
          if (Number.isInteger(targetUserId) && targetUserId > 0) {
            sendToUserInChurch(clientRecord.churchId, targetUserId, 'call:signal', {
              fromUserId: clientRecord.userId,
              fromName: clientRecord.fullName,
              signalType: parsed.payload.signalType,
              data: parsed.payload.data,
              callMode: parsed.payload.callMode || 'audio',
            });
          }
        }
      } catch {
        // Ignore malformed client message
      }
    };

    ws.on('message', (raw) => {
      const rawStr = raw.toString();
      if (!authDone) {
        pendingMessages.push(rawStr);
      } else {
        void handleClientMessage(rawStr);
      }
    });

    ws.on('close', () => {
      closedEarly = true;
      if (!clientRecord) return;
      const prevChurchId = clientRecord.churchId;
      clients.delete(clientRecord);
      if (prevChurchId) {
        broadcastPresence(prevChurchId);
      }
    });

    (async () => {
      try {
        const url = new URL(req.url || '/ws', 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
          ws.close(4001, 'Missing auth token');
          return;
        }

        const user = await authenticateSocketToken(token);
        if (!user || closedEarly) {
          if (!closedEarly) ws.close(4001, 'Invalid auth token');
          return;
        }

        clientRecord = {
          ws,
          userId: user.id,
          fullName: user.fullName,
          churchId: null,
        };
        clients.add(clientRecord);
        authDone = true;

        ws.send(JSON.stringify({ event: 'ws:connected', payload: { userId: user.id } }));

        for (const msg of pendingMessages) {
          await handleClientMessage(msg);
        }
        pendingMessages.length = 0;
      } catch {
        ws.close(4001, 'Auth error');
      }
    })();
  });

  return wss;
}
