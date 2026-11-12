-- Phase 2: Multi-Tenant Row Level Security (RLS) & Strict Private Journal Isolation
-- Every Phase 2 table enforces church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer
-- spiritual_journal strictly isolates BOTH church_id AND user_id (even super admins or church admins cannot read another member's private journal via RLS).

ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER POLICY groups_tenant_isolation ON community_groups
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE community_group_members ENABLE ROW LEVEL SECURITY;
ALTER POLICY group_members_tenant_isolation ON community_group_members
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER POLICY posts_tenant_isolation ON social_posts
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE social_stories ENABLE ROW LEVEL SECURITY;
ALTER POLICY stories_tenant_isolation ON social_stories
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
ALTER POLICY comments_tenant_isolation ON social_comments
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE social_reactions ENABLE ROW LEVEL SECURITY;
ALTER POLICY reactions_tenant_isolation ON social_reactions
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE social_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER POLICY bookmarks_tenant_isolation ON social_bookmarks
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER POLICY follows_tenant_isolation ON user_follows
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER POLICY poll_options_tenant_isolation ON poll_options
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER POLICY poll_votes_tenant_isolation ON poll_votes
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER POLICY reports_tenant_isolation ON content_reports
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER POLICY conversations_tenant_isolation ON conversations
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER POLICY conv_participants_tenant_isolation ON conversation_participants
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER POLICY chat_messages_tenant_isolation ON chat_messages
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER POLICY user_blocks_tenant_isolation ON user_blocks
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER POLICY notifications_tenant_isolation ON notifications
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE spiritual_contents ENABLE ROW LEVEL SECURITY;
ALTER POLICY spiritual_contents_tenant_isolation ON spiritual_contents
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE reading_plans ENABLE ROW LEVEL SECURITY;
ALTER POLICY reading_plans_tenant_isolation ON reading_plans
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE reading_plan_progress ENABLE ROW LEVEL SECURITY;
ALTER POLICY reading_progress_tenant_isolation ON reading_plan_progress
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE spiritual_journal ENABLE ROW LEVEL SECURITY;
ALTER POLICY spiritual_journal_private_owner ON spiritual_journal
  USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer)
  WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer);

ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER POLICY prayers_tenant_isolation ON prayer_requests
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE prayer_interactions ENABLE ROW LEVEL SECURITY;
ALTER POLICY prayer_interactions_tenant_isolation ON prayer_interactions
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE testimonies ENABLE ROW LEVEL SECURITY;
ALTER POLICY testimonies_tenant_isolation ON testimonies
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE bible_quizzes ENABLE ROW LEVEL SECURITY;
ALTER POLICY quizzes_tenant_isolation ON bible_quizzes
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE bible_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER POLICY quiz_attempts_tenant_isolation ON bible_quiz_attempts
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE spiritual_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER POLICY spiritual_bookmarks_tenant_isolation ON spiritual_bookmarks
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;
ALTER POLICY events_tenant_isolation ON church_events
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER POLICY event_registrations_tenant_isolation ON event_registrations
  USING ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer))
  WITH CHECK ((current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer));
