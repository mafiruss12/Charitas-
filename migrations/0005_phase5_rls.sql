-- Phase 5: SaaS Subscriptions & Platform Central Administration RLS

ALTER TABLE saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER POLICY saas_subscriptions_tenant_isolation ON saas_subscriptions
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));
