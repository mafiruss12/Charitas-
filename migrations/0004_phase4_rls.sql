-- Phase 4: Marketplace, Solidarity Auctions, Multimedia Library & Academy RLS Policies

ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER POLICY marketplace_products_tenant_isolation ON marketplace_products
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER POLICY marketplace_orders_tenant_isolation ON marketplace_orders
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER POLICY marketplace_order_items_tenant_isolation ON marketplace_order_items
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER POLICY auctions_tenant_isolation ON auctions
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER POLICY auction_bids_tenant_isolation ON auction_bids
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER POLICY media_library_tenant_isolation ON media_library
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER POLICY academy_courses_tenant_isolation ON academy_courses
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER POLICY academy_enrollments_tenant_isolation ON academy_enrollments
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));
