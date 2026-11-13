import { withTenantContext } from '../db/index.ts';
import { auditLogs } from '../db/schema.ts';

export interface AuditEntryInput {
  churchId?: number | null;
  actorUserId?: number | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAuditLog(entry: AuditEntryInput): Promise<void> {
  try {
    await withTenantContext(
      {
        churchId: entry.churchId ?? null,
        userId: entry.actorUserId ?? null,
        isSuperAdmin: entry.churchId == null,
      },
      async (tx) => {
        await tx.insert(auditLogs).values({
          churchId: entry.churchId ?? null,
          actorUserId: entry.actorUserId ?? null,
          actorEmail: entry.actorEmail ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId != null ? String(entry.entityId) : null,
          details: entry.details ?? {},
          ipAddress: entry.ipAddress ?? null,
        });
      }
    );
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}
