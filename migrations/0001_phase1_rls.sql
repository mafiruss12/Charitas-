-- Migration 0001 : Phase 1 — Politiques PostgreSQL Row Level Security (RLS)
-- Appliquée sur Cloud SQL PostgreSQL après création des tables via Drizzle Kit

ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."church_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER POLICY "departments_tenant_isolation" ON "public"."departments"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER POLICY "role_permissions_tenant_isolation" ON "public"."role_permissions"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER POLICY "invitations_tenant_isolation" ON "public"."invitations"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER POLICY "visitors_tenant_isolation" ON "public"."visitors"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER POLICY "memberships_tenant_or_self_isolation" ON "public"."church_memberships"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER POLICY "audit_logs_tenant_isolation" ON "public"."audit_logs"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (church_id IS NULL));
