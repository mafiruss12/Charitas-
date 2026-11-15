-- Phase 6: Module Charité TV & Charité Live — RLS Policies
-- Appliquée après création des tables via Drizzle Kit

ALTER TABLE "public"."tv_channels" ENABLE ROW LEVEL SECURITY;
ALTER POLICY "tv_channels_tenant_isolation" ON "public"."tv_channels"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE "public"."tv_broadcasts" ENABLE ROW LEVEL SECURITY;
ALTER POLICY "tv_broadcasts_tenant_isolation" ON "public"."tv_broadcasts"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE "public"."tv_favorites" ENABLE ROW LEVEL SECURITY;
ALTER POLICY "tv_favorites_tenant_isolation" ON "public"."tv_favorites"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE "public"."tv_watch_history" ENABLE ROW LEVEL SECURITY;
ALTER POLICY "tv_watch_history_tenant_isolation" ON "public"."tv_watch_history"
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));
