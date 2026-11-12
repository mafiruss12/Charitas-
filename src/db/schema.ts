import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface ServiceScheduleItem {
  day: string;
  time: string;
  title: string;
  location?: string;
}

export interface EnabledModulesConfig {
  social: boolean;
  messaging: boolean;
  spiritual: boolean;
  donations: boolean;
  humanitarian: boolean;
  marketplace: boolean;
  auctions: boolean;
  academy: boolean;
}

export interface ReadingPlanDay {
  day: number;
  title: string;
  scripture: string;
  reflection: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  reference: string;
}

const tenantIsolationSql = sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer)`;

// ==================== PHASE 1 TABLES ====================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    city: text('city'),
    country: text('country').default("Côte d'Ivoire").notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    preferredTheme: text('preferred_theme').default('light').notNull(),
    isPlatformSuperAdmin: boolean('is_platform_super_admin').default(false).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const passwordResets = pgTable(
  'password_resets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('password_resets_user_idx').on(table.userId)]
);

export const churches = pgTable(
  'churches',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    denomination: text('denomination'),
    address: text('address'),
    city: text('city'),
    country: text('country').default("Côte d'Ivoire").notNull(),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    primaryColor: text('primary_color').default('#1E3A5F').notNull(),
    accentColor: text('accent_color').default('#B45309').notNull(),
    defaultTheme: text('default_theme').default('light').notNull(),
    currency: text('currency').default('XOF').notNull(),
    serviceSchedule: jsonb('service_schedule')
      .$type<ServiceScheduleItem[]>()
      .default([])
      .notNull(),
    enabledModules: jsonb('enabled_modules')
      .$type<EnabledModulesConfig>()
      .default({
        social: true,
        messaging: true,
        spiritual: true,
        donations: true,
        humanitarian: true,
        marketplace: true,
        auctions: true,
        academy: true,
      })
      .notNull(),
    isPublic: boolean('is_public').default(true).notNull(),
    status: text('status').default('active').notNull(),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('churches_slug_idx').on(table.slug), index('churches_status_idx').on(table.status)]
);

export const departments = pgTable(
  'departments',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    leaderUserId: integer('leader_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('departments_church_idx').on(table.churchId),
    uniqueIndex('departments_church_name_uidx').on(table.churchId, table.name),
    pgPolicy('departments_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const churchMemberships = pgTable(
  'church_memberships',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').default('member').notNull(),
    departmentId: integer('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    leadershipTitle: text('leadership_title'),
    status: text('status').default('active').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('memberships_church_user_uidx').on(table.churchId, table.userId),
    index('memberships_church_idx').on(table.churchId),
    index('memberships_user_idx').on(table.userId),
    pgPolicy('memberships_tenant_or_self_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer)`,
      withCheck: sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer)`,
    }),
  ]
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull(),
    permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('role_permissions_church_role_uidx').on(table.churchId, table.role),
    index('role_permissions_church_idx').on(table.churchId),
    pgPolicy('role_permissions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const invitations = pgTable(
  'invitations',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull().unique(),
    invitedEmail: text('invited_email'),
    targetRole: text('target_role').default('member').notNull(),
    departmentId: integer('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    invitedByUserId: integer('invited_by_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    maxUses: integer('max_uses').default(1).notNull(),
    usesCount: integer('uses_count').default(0).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('invitations_church_idx').on(table.churchId),
    index('invitations_code_idx').on(table.code),
    pgPolicy('invitations_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const visitors = pgTable(
  'visitors',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    visitDate: text('visit_date').notNull(),
    source: text('source'),
    prayerOrNeed: text('prayer_or_need'),
    followUpStatus: text('follow_up_status').default('pending').notNull(),
    assignedLeaderId: integer('assigned_leader_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    convertedUserId: integer('converted_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('visitors_church_idx').on(table.churchId),
    index('visitors_status_idx').on(table.churchId, table.followUpStatus),
    pgPolicy('visitors_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id').references(() => churches.id, {
      onDelete: 'cascade',
    }),
    actorUserId: integer('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_church_created_idx').on(table.churchId, table.createdAt),
    pgPolicy('audit_logs_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer)`,
      withCheck: sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (church_id IS NULL)`,
    }),
  ]
);

// ==================== PHASE 2 TABLES ====================

export const communityGroups = pgTable(
  'community_groups',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').default('Général').notNull(),
    createdByUserId: integer('created_by_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('groups_church_idx').on(table.churchId),
    pgPolicy('groups_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const communityGroupMembers = pgTable(
  'community_group_members',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: integer('group_id')
      .references(() => communityGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('group_members_uidx').on(table.groupId, table.userId),
    index('group_members_church_idx').on(table.churchId),
    pgPolicy('group_members_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const socialPosts = pgTable(
  'social_posts',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: integer('group_id').references(() => communityGroups.id, {
      onDelete: 'set null',
    }),
    postType: text('post_type').default('text').notNull(), // text | photo | video | short_video | poll
    content: text('content').notNull(),
    mediaUrl: text('media_url'),
    hashtags: jsonb('hashtags').$type<string[]>().default([]).notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    commentsCount: integer('comments_count').default(0).notNull(),
    sharesCount: integer('shares_count').default(0).notNull(),
    isModeratedHidden: boolean('is_moderated_hidden').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_church_created_idx').on(table.churchId, table.createdAt),
    pgPolicy('posts_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const socialStories = pgTable(
  'social_stories',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    caption: text('caption').notNull(),
    mediaUrl: text('media_url'),
    backgroundColor: text('background_color').default('#1E3A5F').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('stories_church_expires_idx').on(table.churchId, table.expiresAt),
    pgPolicy('stories_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const socialComments = pgTable(
  'social_comments',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id')
      .references(() => socialPosts.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('comments_post_idx').on(table.postId),
    pgPolicy('comments_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const socialReactions = pgTable(
  'social_reactions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id')
      .references(() => socialPosts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reactionType: text('reaction_type').default('amen').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reactions_post_user_uidx').on(table.postId, table.userId),
    pgPolicy('reactions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const socialBookmarks = pgTable(
  'social_bookmarks',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id')
      .references(() => socialPosts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bookmarks_post_user_uidx').on(table.postId, table.userId),
    pgPolicy('bookmarks_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const userFollows = pgTable(
  'user_follows',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    followerUserId: integer('follower_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    followingUserId: integer('following_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_church_pair_uidx').on(
      table.churchId,
      table.followerUserId,
      table.followingUserId
    ),
    pgPolicy('follows_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const pollOptions = pgTable(
  'poll_options',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id')
      .references(() => socialPosts.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull(),
    votesCount: integer('votes_count').default(0).notNull(),
  },
  (table) => [
    index('poll_options_post_idx').on(table.postId),
    pgPolicy('poll_options_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id')
      .references(() => socialPosts.id, { onDelete: 'cascade' })
      .notNull(),
    optionId: integer('option_id')
      .references(() => pollOptions.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('poll_votes_post_user_uidx').on(table.postId, table.userId),
    pgPolicy('poll_votes_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const contentReports = pgTable(
  'content_reports',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    reporterUserId: integer('reporter_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: text('target_type').notNull(), // post | comment | user
    targetId: integer('target_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').default('pending').notNull(),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_church_status_idx').on(table.churchId, table.status),
    pgPolicy('reports_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// Messaging & Notifications
export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').default('direct').notNull(), // direct | group | public_room
    title: text('title'),
    createdByUserId: integer('created_by_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('conversations_church_idx').on(table.churchId),
    pgPolicy('conversations_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    lastReadAt: timestamp('last_read_at'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('conv_participants_uidx').on(table.conversationId, table.userId),
    index('conv_participants_church_idx').on(table.churchId),
    pgPolicy('conv_participants_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderUserId: integer('sender_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    messageType: text('message_type').default('text').notNull(), // text | voice | image | file
    content: text('content').notNull(),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('chat_messages_conv_created_idx').on(table.conversationId, table.createdAt),
    pgPolicy('chat_messages_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    blockerUserId: integer('blocker_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    blockedUserId: integer('blocked_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_blocks_uidx').on(table.churchId, table.blockerUserId, table.blockedUserId),
    pgPolicy('user_blocks_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_idx').on(table.churchId, table.userId, table.createdAt),
    pgPolicy('notifications_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// Spiritual Life
export const spiritualContents = pgTable(
  'spiritual_contents',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(), // daily_verse | meditation | sermon | podcast
    title: text('title').notNull(),
    scriptureRef: text('scripture_ref'),
    content: text('content').notNull(),
    mediaUrl: text('media_url'),
    durationLabel: text('duration_label'),
    publishedDate: text('published_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('spiritual_church_kind_idx').on(table.churchId, table.kind),
    pgPolicy('spiritual_contents_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const readingPlans = pgTable(
  'reading_plans',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    days: jsonb('days').$type<ReadingPlanDay[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reading_plans_church_idx').on(table.churchId),
    pgPolicy('reading_plans_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const readingPlanProgress = pgTable(
  'reading_plan_progress',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    planId: integer('plan_id')
      .references(() => readingPlans.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    completedDays: jsonb('completed_days').$type<number[]>().default([]).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reading_progress_uidx').on(table.planId, table.userId),
    pgPolicy('reading_progress_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const spiritualJournal = pgTable(
  'spiritual_journal',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    scriptureRef: text('scripture_ref'),
    content: text('content').notNull(),
    mood: text('mood'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('journal_user_idx').on(table.churchId, table.userId),
    pgPolicy('spiritual_journal_private_owner', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer`,
      withCheck: sql`church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::integer`,
    }),
  ]
);

export const prayerRequests = pgTable(
  'prayer_requests',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    prayCount: integer('pray_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('prayers_church_idx').on(table.churchId),
    pgPolicy('prayers_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const prayerInteractions = pgTable(
  'prayer_interactions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    prayerId: integer('prayer_id')
      .references(() => prayerRequests.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('prayer_interactions_uidx').on(table.prayerId, table.userId),
    pgPolicy('prayer_interactions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const testimonies = pgTable(
  'testimonies',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    authorUserId: integer('author_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('testimonies_church_idx').on(table.churchId),
    pgPolicy('testimonies_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const bibleQuizzes = pgTable(
  'bible_quizzes',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    questions: jsonb('questions').$type<QuizQuestion[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('quizzes_church_idx').on(table.churchId),
    pgPolicy('quizzes_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const bibleQuizAttempts = pgTable(
  'bible_quiz_attempts',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    quizId: integer('quiz_id')
      .references(() => bibleQuizzes.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    score: integer('score').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('quiz_attempts_church_idx').on(table.churchId, table.userId),
    pgPolicy('quiz_attempts_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const spiritualBookmarks = pgTable(
  'spiritual_bookmarks',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reference: text('reference').notNull(),
    verseText: text('verse_text').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('spiritual_bookmarks_uidx').on(table.churchId, table.userId, table.reference),
    pgPolicy('spiritual_bookmarks_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// Events & Live Streaming
export const churchEvents = pgTable(
  'church_events',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    eventType: text('event_type').default('culte').notNull(), // culte | conference | reunion | direct
    location: text('location'),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at'),
    streamUrl: text('stream_url'),
    isLive: boolean('is_live').default(false).notNull(),
    qrSecret: text('qr_secret').notNull(),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('events_church_starts_idx').on(table.churchId, table.startsAt),
    pgPolicy('events_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    eventId: integer('event_id')
      .references(() => churchEvents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').default('registered').notNull(), // registered | checked_in
    checkedInAt: timestamp('checked_in_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('event_registrations_uidx').on(table.eventId, table.userId),
    index('event_registrations_church_idx').on(table.churchId),
    pgPolicy('event_registrations_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// ==================== PHASE 3 TABLES (DONS & HUMANITAIRE) ====================

export const donationCampaigns = pgTable(
  'donation_campaigns',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    fundCategory: text('fund_category').default('church').notNull(), // church | humanitarian
    goalAmount: integer('goal_amount').notNull(),
    collectedAmount: integer('collected_amount').default(0).notNull(),
    currency: text('currency').default('XOF').notNull(),
    status: text('status').default('active').notNull(), // active | completed | paused
    endsAt: timestamp('ends_at'),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('campaigns_church_idx').on(table.churchId),
    pgPolicy('campaigns_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const donations = pgTable(
  'donations',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    campaignId: integer('campaign_id').references(() => donationCampaigns.id, {
      onDelete: 'set null',
    }),
    donorUserId: integer('donor_user_id').references(() => users.id, { onDelete: 'set null' }),
    donorName: text('donor_name').notNull(),
    donorEmail: text('donor_email'),
    donorPhone: text('donor_phone'),
    fundCategory: text('fund_category').default('church').notNull(), // church | humanitarian
    amount: integer('amount').notNull(),
    currency: text('currency').default('XOF').notNull(),
    frequency: text('frequency').default('one_time').notNull(), // one_time | monthly | weekly
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    paymentMethod: text('payment_method').notNull(), // orange_money | mtn_momo | moov_money | wave | card | cash
    paymentReference: text('payment_reference').notNull().unique(),
    externalTransactionId: text('external_transaction_id'),
    gatewayMode: text('gateway_mode').default('sandbox').notNull(), // live | sandbox | cash_desk
    status: text('status').default('pending').notNull(), // pending | confirmed | failed | cancelled
    recordedByUserId: integer('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('donations_church_idx').on(table.churchId, table.createdAt),
    index('donations_ref_idx').on(table.paymentReference),
    pgPolicy('donations_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const donationReceipts = pgTable(
  'donation_receipts',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    donationId: integer('donation_id')
      .references(() => donations.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    receiptNumber: text('receipt_number').notNull().unique(),
    verificationHash: text('verification_hash').notNull(),
    issuedAt: timestamp('issued_at').defaultNow().notNull(),
  },
  (table) => [
    index('receipts_church_idx').on(table.churchId),
    pgPolicy('receipts_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id').references(() => churches.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull().unique(),
    paymentReference: text('payment_reference').notNull(),
    signatureValid: boolean('signature_valid').default(false).notNull(),
    status: text('status').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    processedAt: timestamp('processed_at').defaultNow().notNull(),
  },
  (table) => [
    index('webhooks_ref_idx').on(table.paymentReference),
    pgPolicy('webhooks_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: sql`(current_setting('app.is_super_admin', true) = 'true') OR (church_id = NULLIF(current_setting('app.current_church_id', true), '')::integer) OR (church_id IS NULL)`,
    }),
  ]
);

export const beneficiaries = pgTable(
  'beneficiaries',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    address: text('address'),
    householdSize: integer('household_size').default(1).notNull(),
    vulnerabilityLevel: text('vulnerability_level').default('standard').notNull(), // standard | high | critical
    confidentialNotes: text('confidential_notes'),
    status: text('status').default('active').notNull(), // active | archived
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('beneficiaries_church_idx').on(table.churchId),
    pgPolicy('beneficiaries_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const beneficiaryFamilyMembers = pgTable(
  'beneficiary_family_members',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    beneficiaryId: integer('beneficiary_id')
      .references(() => beneficiaries.id, { onDelete: 'cascade' })
      .notNull(),
    fullName: text('full_name').notNull(),
    relationship: text('relationship').notNull(),
    age: integer('age'),
    notes: text('notes'),
  },
  (table) => [
    index('family_beneficiary_idx').on(table.beneficiaryId),
    pgPolicy('family_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const aidRequests = pgTable(
  'aid_requests',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    beneficiaryId: integer('beneficiary_id')
      .references(() => beneficiaries.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    category: text('category').default('alimentaire').notNull(), // alimentaire | sante | education | logement | urgence
    needsAssessment: text('needs_assessment').notNull(),
    requestedAmount: integer('requested_amount').default(0).notNull(),
    allocatedAmount: integer('allocated_amount').default(0).notNull(),
    priorityScore: integer('priority_score').default(50).notNull(),
    status: text('status').default('submitted').notNull(), // submitted | under_review | approved | fulfilled | rejected
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('aid_requests_church_idx').on(table.churchId, table.status),
    pgPolicy('aid_requests_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const aidDistributions = pgTable(
  'aid_distributions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    aidRequestId: integer('aid_request_id').references(() => aidRequests.id, {
      onDelete: 'set null',
    }),
    beneficiaryId: integer('beneficiary_id')
      .references(() => beneficiaries.id, { onDelete: 'cascade' })
      .notNull(),
    volunteerUserId: integer('volunteer_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    amountSpent: integer('amount_spent').default(0).notNull(),
    itemsSummary: text('items_summary').notNull(),
    proofNotes: text('proof_notes'),
    proofImageUrl: text('proof_image_url'),
    distributedAt: timestamp('distributed_at').defaultNow().notNull(),
    recordedByUserId: integer('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('distributions_church_idx').on(table.churchId),
    pgPolicy('distributions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const financialLedger = pgTable(
  'financial_ledger',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    fundType: text('fund_type').notNull(), // church | humanitarian | commercial
    entryType: text('entry_type').notNull(), // credit | debit
    amount: integer('amount').notNull(),
    currency: text('currency').default('XOF').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    campaignId: integer('campaign_id').references(() => donationCampaigns.id, {
      onDelete: 'set null',
    }),
    donationId: integer('donation_id').references(() => donations.id, { onDelete: 'set null' }),
    aidDistributionId: integer('aid_distribution_id').references(() => aidDistributions.id, {
      onDelete: 'set null',
    }),
    justificationNote: text('justification_note'),
    justificationUrl: text('justification_url'),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    previousHash: text('previous_hash').notNull(),
    entryHash: text('entry_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ledger_church_fund_idx').on(table.churchId, table.fundType, table.createdAt),
    pgPolicy('ledger_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const volunteerAssignments = pgTable(
  'volunteer_assignments',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    missionTitle: text('mission_title').notNull(),
    roleDescription: text('role_description'),
    scheduledDate: text('scheduled_date').notNull(),
    status: text('status').default('assigned').notNull(), // assigned | completed | cancelled
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('volunteers_church_idx').on(table.churchId),
    pgPolicy('volunteers_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const interventionReports = pgTable(
  'intervention_reports',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    beneficiariesHelpedCount: integer('beneficiaries_helped_count').default(0).notNull(),
    totalAmountSpent: integer('total_amount_spent').default(0).notNull(),
    proofImageUrl: text('proof_image_url'),
    publishedDate: text('published_date').notNull(),
    authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('intervention_reports_church_idx').on(table.churchId),
    pgPolicy('intervention_reports_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// ==================== PHASE 4 TABLES (MARKETPLACE, ENCHÈRES, MULTIMÉDIA & ACADÉMIE) ====================

export interface AcademyLesson {
  title: string;
  summary: string;
  duration: string;
}

export interface AcademyQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export const marketplaceProducts = pgTable(
  'marketplace_products',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    sellerUserId: integer('seller_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').default('Artisanat & Littérature').notNull(),
    isSolidarityProduct: boolean('is_solidarity_product').default(false).notNull(),
    price: integer('price').notNull(),
    currency: text('currency').default('XOF').notNull(),
    stockQuantity: integer('stock_quantity').default(1).notNull(),
    imageUrl: text('image_url'),
    status: text('status').default('active').notNull(), // active | archived | out_of_stock
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('marketplace_products_church_idx').on(table.churchId),
    pgPolicy('marketplace_products_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const marketplaceOrders = pgTable(
  'marketplace_orders',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    buyerUserId: integer('buyer_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    totalAmount: integer('total_amount').notNull(),
    currency: text('currency').default('XOF').notNull(),
    fundType: text('fund_type').default('commercial').notNull(), // commercial | humanitarian
    paymentMethod: text('payment_method').notNull(), // orange_money | mtn_momo | moov_money | wave | card | cash
    paymentReference: text('payment_reference').notNull().unique(),
    gatewayMode: text('gateway_mode').default('sandbox').notNull(),
    status: text('status').default('pending').notNull(), // pending | paid | shipped | delivered | cancelled
    shippingAddress: text('shipping_address').notNull(),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('marketplace_orders_church_idx').on(table.churchId, table.createdAt),
    pgPolicy('marketplace_orders_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const marketplaceOrderItems = pgTable(
  'marketplace_order_items',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: integer('order_id')
      .references(() => marketplaceOrders.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id').references(() => marketplaceProducts.id, {
      onDelete: 'set null',
    }),
    titleSnapshot: text('title_snapshot').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (table) => [
    index('marketplace_order_items_order_idx').on(table.orderId),
    pgPolicy('marketplace_order_items_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const auctions = pgTable(
  'auctions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    sellerUserId: integer('seller_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    imageUrl: text('image_url'),
    startPrice: integer('start_price').notNull(),
    reservePrice: integer('reserve_price').default(0).notNull(),
    currentBidAmount: integer('current_bid_amount').default(0).notNull(),
    highestBidderUserId: integer('highest_bidder_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    startsAt: timestamp('starts_at').defaultNow().notNull(),
    endsAt: timestamp('ends_at').notNull(),
    moderationStatus: text('moderation_status').default('pending').notNull(), // pending | approved | rejected
    status: text('status').default('draft').notNull(), // draft | active | ended | confirmed | cancelled
    fundAllocation: text('fund_allocation').default('humanitarian').notNull(), // humanitarian | church
    currency: text('currency').default('XOF').notNull(),
    winnerConfirmedAt: timestamp('winner_confirmed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('auctions_church_idx').on(table.churchId, table.status),
    pgPolicy('auctions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const auctionBids = pgTable(
  'auction_bids',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    auctionId: integer('auction_id')
      .references(() => auctions.id, { onDelete: 'cascade' })
      .notNull(),
    bidderUserId: integer('bidder_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('auction_bids_auction_idx').on(table.auctionId, table.createdAt),
    pgPolicy('auction_bids_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const mediaLibrary = pgTable(
  'media_library',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    mediaType: text('media_type').default('replay').notNull(), // replay | conference | music | teaching
    mediaUrl: text('media_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    speakerName: text('speaker_name').notNull(),
    durationLabel: text('duration_label').default('45 min').notNull(),
    publishedDate: text('published_date').notNull(),
    uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('media_library_church_idx').on(table.churchId, table.mediaType),
    pgPolicy('media_library_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const academyCourses = pgTable(
  'academy_courses',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').default('Théologie & Leadership').notNull(),
    level: text('level').default('Fondamentaux').notNull(),
    instructorName: text('instructor_name').notNull(),
    pdfResourceUrl: text('pdf_resource_url'),
    lessons: jsonb('lessons').$type<AcademyLesson[]>().default([]).notNull(),
    quizQuestions: jsonb('quiz_questions').$type<AcademyQuizQuestion[]>().default([]).notNull(),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('academy_courses_church_idx').on(table.churchId),
    pgPolicy('academy_courses_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

export const academyEnrollments = pgTable(
  'academy_enrollments',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull(),
    courseId: integer('course_id')
      .references(() => academyCourses.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    completedLessonIndexes: jsonb('completed_lesson_indexes').$type<number[]>().default([]).notNull(),
    quizScore: integer('quiz_score'),
    certificateCode: text('certificate_code').unique(),
    completedAt: timestamp('completed_at'),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('academy_enrollments_course_user_uidx').on(table.courseId, table.userId),
    index('academy_enrollments_church_idx').on(table.churchId),
    pgPolicy('academy_enrollments_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// ==================== PHASE 5 TABLES (ADMIN CENTRALE & ABONNEMENTS SAAS) ====================

export const saasSubscriptions = pgTable(
  'saas_subscriptions',
  {
    id: serial('id').primaryKey(),
    churchId: integer('church_id')
      .references(() => churches.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    planName: text('plan_name').default('essential').notNull(), // essential | growth | network
    status: text('status').default('active').notNull(), // active | trial | past_due | suspended
    monthlyPriceXof: integer('monthly_price_xof').default(0).notNull(),
    memberQuota: integer('member_quota').default(500).notNull(),
    notes: text('notes'),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('saas_subscriptions_church_idx').on(table.churchId),
    pgPolicy('saas_subscriptions_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: tenantIsolationSql,
      withCheck: tenantIsolationSql,
    }),
  ]
);

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(churchMemberships),
  ledDepartments: many(departments),
}));

export const churchesRelations = relations(churches, ({ many }) => ({
  departments: many(departments),
  memberships: many(churchMemberships),
  rolePermissions: many(rolePermissions),
  invitations: many(invitations),
  visitors: many(visitors),
  auditLogs: many(auditLogs),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  church: one(churches, {
    fields: [departments.churchId],
    references: [churches.id],
  }),
  leader: one(users, {
    fields: [departments.leaderUserId],
    references: [users.id],
  }),
  memberships: many(churchMemberships),
}));

export const churchMembershipsRelations = relations(churchMemberships, ({ one }) => ({
  church: one(churches, {
    fields: [churchMemberships.churchId],
    references: [churches.id],
  }),
  user: one(users, {
    fields: [churchMemberships.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [churchMemberships.departmentId],
    references: [departments.id],
  }),
}));
