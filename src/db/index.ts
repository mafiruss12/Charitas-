import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface TenantDbContext {
  churchId?: number | null;
  userId?: number | null;
  isSuperAdmin?: boolean;
}

/**
 * Executes database operations inside a transaction with PostgreSQL RLS session variables bound locally.
 * Guarantees multi-tenant isolation at the PostgreSQL engine level.
 */
export async function withTenantContext<T>(
  ctx: TenantDbContext,
  fn: (tx: AppDatabase) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const churchIdStr = ctx.churchId != null ? String(ctx.churchId) : '';
    const userIdStr = ctx.userId != null ? String(ctx.userId) : '';
    const superAdminStr = ctx.isSuperAdmin ? 'true' : 'false';

    await tx.execute(
      sql`SELECT
        set_config('app.current_church_id', ${churchIdStr}, true),
        set_config('app.current_user_id', ${userIdStr}, true),
        set_config('app.is_super_admin', ${superAdminStr}, true)`
    );

    return fn(tx as unknown as AppDatabase);
  });
}
