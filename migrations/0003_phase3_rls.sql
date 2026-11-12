-- Phase 3: Donations, Côte d'Ivoire Payment Webhooks, Immutable Financial Ledger & Humanitarian RLS

ALTER TABLE donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER POLICY campaigns_tenant_isolation ON donation_campaigns
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER POLICY donations_tenant_isolation ON donations
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE donation_receipts ENABLE ROW LEVEL SECURITY;
ALTER POLICY receipts_tenant_isolation ON donation_receipts
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER POLICY webhooks_tenant_isolation ON payment_webhook_events
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (church_id IS NULL));

ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER POLICY beneficiaries_tenant_isolation ON beneficiaries
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE beneficiary_family_members ENABLE ROW LEVEL SECURITY;
ALTER POLICY family_tenant_isolation ON beneficiary_family_members
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE aid_requests ENABLE ROW LEVEL SECURITY;
ALTER POLICY aid_requests_tenant_isolation ON aid_requests
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE aid_distributions ENABLE ROW LEVEL SECURITY;
ALTER POLICY distributions_tenant_isolation ON aid_distributions
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER POLICY ledger_tenant_isolation ON financial_ledger
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE volunteer_assignments ENABLE ROW LEVEL SECURITY;
ALTER POLICY volunteers_tenant_isolation ON volunteer_assignments
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE intervention_reports ENABLE ROW LEVEL SECURITY;
ALTER POLICY intervention_reports_tenant_isolation ON intervention_reports
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

-- Enforce append-only immutability on financial_ledger (no silent edits or deletions)
CREATE OR REPLACE FUNCTION prevent_financial_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM churches WHERE id = OLD.church_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'financial_ledger is strictly append-only and cannot be modified or deleted directly.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_ledger_immutable ON financial_ledger;
CREATE TRIGGER trg_financial_ledger_immutable
BEFORE UPDATE OR DELETE ON financial_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_financial_ledger_mutation();
