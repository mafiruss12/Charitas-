export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  country: string;
  bio: string | null;
  avatarUrl: string | null;
  preferredTheme: ThemeMode | string;
  isPlatformSuperAdmin: boolean;
  emailVerified: boolean;
}

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

export interface PublicChurch {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  denomination: string | null;
  address: string | null;
  city: string | null;
  country: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  accentColor: string;
  currency: string;
  serviceSchedule: ServiceScheduleItem[];
  membersCount: number;
  departmentsCount: number;
}

export interface ChurchMembershipSummary {
  membershipId: number;
  churchId: number;
  role: string;
  departmentId: number | null;
  leadershipTitle: string | null;
  status: string;
  joinedAt: string;
  churchName: string;
  churchSlug: string;
  churchLogoUrl: string | null;
  churchBannerUrl: string | null;
  churchPrimaryColor: string;
  churchAccentColor: string;
  churchCurrency: string;
  churchCity: string | null;
  churchCountry: string;
  enabledModules: EnabledModulesConfig;
  permissions: string[];
}

export interface ChurchDetail {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  denomination: string | null;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  accentColor: string;
  defaultTheme: string;
  currency: string;
  serviceSchedule: ServiceScheduleItem[];
  enabledModules: EnabledModulesConfig;
  isPublic: boolean;
  status: string;
}

export interface DepartmentItem {
  id: number;
  churchId: number;
  name: string;
  description: string | null;
  leaderUserId: number | null;
  leaderName: string | null;
  memberCount?: number;
  createdAt: string;
}

export interface ChurchMemberItem {
  membershipId: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  role: string;
  departmentId: number | null;
  departmentName: string | null;
  leadershipTitle: string | null;
  status: string;
  joinedAt: string;
}

export interface VisitorItem {
  id: number;
  churchId: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  visitDate: string;
  source: string | null;
  prayerOrNeed: string | null;
  followUpStatus: 'pending' | 'contacted' | 'integrated' | 'archived';
  assignedLeaderId: number | null;
  assignedLeaderName: string | null;
  notes: string | null;
  convertedUserId: number | null;
  createdAt: string;
}

export interface InvitationItem {
  id: number;
  code: string;
  invitedEmail: string | null;
  targetRole: string;
  departmentId: number | null;
  departmentName: string | null;
  maxUses: number;
  usesCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: number;
  churchId: number | null;
  actorUserId: number | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardResponse {
  church: ChurchDetail;
  tenant: {
    churchId: number;
    churchSlug: string;
    churchName: string;
    role: string;
    permissions: string[];
  };
  stats: {
    totalMembers: number;
    activeMembers: number;
    leadersCount: number;
    departmentsCount: number;
    totalVisitors: number;
    pendingVisitors: number;
    activeInvites: number;
  };
  roleBreakdown: Record<string, number>;
  departments: DepartmentItem[];
  recentAudits: AuditLogItem[];
}

export interface SocialPollOption {
  id: number;
  postId: number;
  label: string;
  votesCount: number;
}

export interface SocialPostItem {
  id: number;
  churchId: number;
  authorUserId: number;
  authorName: string;
  authorAvatar: string | null;
  groupId: number | null;
  postType: 'text' | 'photo' | 'video' | 'short_video' | 'poll';
  content: string;
  mediaUrl: string | null;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  myReaction: string | null;
  isBookmarked: boolean;
  isFollowingAuthor: boolean;
  pollOptions: SocialPollOption[];
  myPollOptionId: number | null;
}

export interface SocialCommentItem {
  id: number;
  postId: number;
  authorUserId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface SocialStoryItem {
  id: number;
  authorUserId: number;
  authorName: string;
  caption: string;
  mediaUrl: string | null;
  backgroundColor: string;
  expiresAt: string;
  createdAt: string;
}

export interface CommunityGroupItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  membersCount: number;
  isMember: boolean;
}

export interface ContentReportItem {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  reporterName: string;
  createdAt: string;
}

export interface ChatParticipantItem {
  conversationId?: number;
  userId: number;
  fullName?: string;
  lastReadAt: string | null;
}

export interface ConversationItem {
  id: number;
  churchId: number;
  type: 'direct' | 'group' | 'public_room';
  title: string | null;
  displayTitle: string;
  updatedAt: string;
  participants: ChatParticipantItem[];
}

export interface ChatMessageItem {
  id: number;
  conversationId: number;
  senderUserId: number;
  senderName: string;
  messageType: 'text' | 'voice' | 'image' | 'file';
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface SpiritualContentItem {
  id: number;
  kind: 'daily_verse' | 'meditation' | 'sermon' | 'podcast';
  title: string;
  scriptureRef: string | null;
  content: string;
  mediaUrl: string | null;
  durationLabel: string | null;
  publishedDate: string;
}

export interface ReadingPlanItem {
  id: number;
  title: string;
  description: string;
  days: { day: number; title: string; scripture: string; reflection: string }[];
  completedDays: number[];
}

export interface SpiritualJournalEntry {
  id: number;
  title: string;
  scriptureRef: string | null;
  content: string;
  mood: string | null;
  createdAt: string;
}

export interface PrayerRequestItem {
  id: number;
  authorName: string;
  isAnonymous: boolean;
  title: string;
  content: string;
  prayCount: number;
  hasPrayed: boolean;
  createdAt: string;
}

export interface TestimonyItem {
  id: number;
  authorUserId: number;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface BibleQuizItem {
  id: number;
  title: string;
  description: string;
  questions: { question: string; options: string[]; reference: string }[];
  bestScore: number | null;
  attemptsCount: number;
}

export interface ChurchEventItem {
  id: number;
  title: string;
  description: string | null;
  eventType: 'culte' | 'conference' | 'reunion' | 'direct';
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  streamUrl: string | null;
  isLive: boolean;
  registrationsCount: number;
  checkedInCount: number;
  myRegistration: {
    id: number;
    status: string;
    checkedInAt: string | null;
    qrPayload: string;
  } | null;
}

export interface GatewayStatusItem {
  provider: string;
  label: string;
  configured: boolean;
  mode: 'live' | 'sandbox' | 'cash_desk';
  envKeyHint: string;
}

export interface DonationCampaignItem {
  id: number;
  title: string;
  description: string;
  fundCategory: 'church' | 'humanitarian';
  goalAmount: number;
  collectedAmount: number;
  currency: string;
  status: string;
  endsAt: string | null;
  createdAt: string;
}

export interface DonationItem {
  id: number;
  campaignId: number | null;
  donorName: string;
  fundCategory: 'church' | 'humanitarian';
  amount: number;
  currency: string;
  frequency: 'one_time' | 'monthly' | 'weekly';
  isAnonymous: boolean;
  paymentMethod: string;
  paymentReference: string;
  gatewayMode: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  confirmedAt: string | null;
  createdAt: string;
  isMine: boolean;
  receipt: {
    id: number;
    receiptNumber: string;
    verificationHash: string;
    issuedAt: string;
  } | null;
}

export interface FinancialLedgerItem {
  id: number;
  fundType: 'church' | 'humanitarian' | 'commercial';
  entryType: 'credit' | 'debit';
  amount: number;
  currency: string;
  category: string;
  description: string;
  justificationNote: string | null;
  justificationUrl: string | null;
  entryHash: string;
  createdAt: string;
}

export interface BeneficiaryItem {
  id: number;
  fullName: string;
  phone: string | null;
  address: string | null;
  householdSize: number;
  vulnerabilityLevel: 'standard' | 'high' | 'critical';
  confidentialNotes: string | null;
  status: string;
  createdAt: string;
  familyMembers: {
    id: number;
    fullName: string;
    relationship: string;
    age: number | null;
    notes: string | null;
  }[];
}

export interface AidRequestItem {
  id: number;
  beneficiaryId: number;
  beneficiaryName: string;
  title: string;
  category: string;
  needsAssessment: string;
  requestedAmount: number;
  allocatedAmount: number;
  priorityScore: number;
  status: 'submitted' | 'under_review' | 'approved' | 'fulfilled' | 'rejected';
  createdAt: string;
}

export interface AidDistributionItem {
  id: number;
  aidRequestId: number | null;
  beneficiaryId: number;
  beneficiaryName: string;
  amountSpent: number;
  itemsSummary: string;
  proofNotes: string | null;
  proofImageUrl: string | null;
  distributedAt: string;
}

export interface InterventionReportItem {
  id: number;
  title: string;
  summary: string;
  beneficiariesHelpedCount: number;
  totalAmountSpent: number;
  proofImageUrl: string | null;
  publishedDate: string;
}

export interface MarketplaceProductItem {
  id: number;
  title: string;
  description: string;
  category: string;
  isSolidarityProduct: boolean;
  price: number;
  currency: string;
  stockQuantity: number;
  imageUrl: string | null;
  status: 'active' | 'archived' | 'out_of_stock';
  createdAt: string;
}

export interface MarketplaceOrderItem {
  id: number;
  buyerUserId: number;
  buyerName: string;
  totalAmount: number;
  currency: string;
  fundType: 'commercial' | 'humanitarian';
  paymentMethod: string;
  paymentReference: string;
  gatewayMode: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  confirmedAt: string | null;
  createdAt: string;
  items: {
    id: number;
    productId: number | null;
    titleSnapshot: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
}

export interface AuctionItem {
  id: number;
  sellerUserId: number;
  sellerName: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startPrice: number;
  reservePrice: number;
  currentBidAmount: number;
  highestBidderUserId: number | null;
  highestBidderName: string | null;
  startsAt: string;
  endsAt: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  status: 'draft' | 'active' | 'ended' | 'confirmed' | 'cancelled';
  fundAllocation: 'humanitarian' | 'church';
  currency: string;
  bidsCount: number;
  recentBids: {
    id: number;
    bidderName: string;
    amount: number;
    createdAt: string;
  }[];
}

export interface MediaLibraryItem {
  id: number;
  title: string;
  description: string;
  mediaType: 'replay' | 'conference' | 'music' | 'teaching';
  mediaUrl: string;
  thumbnailUrl: string | null;
  speakerName: string;
  durationLabel: string;
  publishedDate: string;
}

export interface AcademyCourseItem {
  id: number;
  title: string;
  description: string;
  category: string;
  level: string;
  instructorName: string;
  pdfResourceUrl: string | null;
  lessons: { title: string; summary: string; duration: string }[];
  quizQuestions: { question: string; options: string[] }[];
  enrollment: {
    id: number;
    completedLessonIndexes: number[];
    quizScore: number | null;
    certificateCode: string | null;
    completedAt: string | null;
  } | null;
}

export interface SuperAdminChurchSummary {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  country: string;
  currency: string;
  status: 'active' | 'suspended' | string;
  enabledModules: EnabledModulesConfig;
  membersCount: number;
  confirmedDonationsAmount: number;
  pendingReports: number;
  subscription: {
    planName: 'essential' | 'growth' | 'network' | string;
    status: string;
    monthlyPriceXof: number;
    memberQuota: number;
  };
  createdAt: string;
}

export interface SuperAdminOverviewResponse {
  stats: {
    totalChurches: number;
    activeChurches: number;
    suspendedChurches: number;
    totalUsers: number;
    totalConfirmedDonationsAmount: number;
    pendingModerationReports: number;
    activeAuctionsCount: number;
  };
  churches: SuperAdminChurchSummary[];
  globalReports: {
    id: number;
    churchId: number;
    churchName: string;
    targetType: string;
    targetId: number;
    reason: string;
    status: string;
    reporterName: string;
    createdAt: string;
  }[];
}

export interface PublicFeaturedChurch extends PublicChurch {
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface PublicShowcasePost {
  id: number;
  churchId: number;
  authorName: string;
  authorAvatar: string | null;
  postType: string;
  content: string;
  mediaUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface PublicShowcaseEvent {
  id: number;
  churchId: number;
  title: string;
  description: string | null;
  eventType: string;
  location: string | null;
  startsAt: string;
  isLive: boolean;
  registrationsCount: number;
}

export interface PublicShowcaseCampaign {
  id: number;
  churchId: number;
  title: string;
  description: string;
  fundCategory: string;
  goalAmount: number;
  collectedAmount: number;
  currency: string;
}

export interface PublicShowcaseIntervention {
  id: number;
  churchId: number;
  title: string;
  summary: string;
  beneficiariesHelped: number;
  photoUrl: string | null;
  publishedAt: string;
}

export interface PublicShowcaseTestimony {
  id: number;
  churchId: number;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface PublicShowcaseResponse {
  featuredChurch: PublicFeaturedChurch | null;
  churches: PublicChurch[];
  latestPosts: PublicShowcasePost[];
  upcomingEvents: PublicShowcaseEvent[];
  activeCampaigns: PublicShowcaseCampaign[];
  humanitarianActions: PublicShowcaseIntervention[];
  openVolunteerMissionsCount: number;
  testimonies: PublicShowcaseTestimony[];
}

export interface PublicFeedPost extends PublicShowcasePost {
  hashtags: string[];
  sharesCount: number;
  pollOptions: { id: number; postId: number; label: string; votesCount: number }[];
}

export interface PublicStory {
  id: number;
  authorName: string;
  caption: string;
  mediaUrl: string | null;
  backgroundColor: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicFeedResponse {
  churchId: number;
  churchName: string;
  posts: PublicFeedPost[];
  stories: PublicStory[];
  availableHashtags: string[];
}

export interface PublicEventDetail extends PublicShowcaseEvent {
  endsAt: string | null;
  streamUrl: string | null;
}

export interface PublicEventsResponse {
  churchId: number;
  churchName: string;
  serviceSchedule: ServiceScheduleItem[];
  events: PublicEventDetail[];
}

export type TvStreamStatus = 'operational' | 'unavailable' | 'incompatible' | 'pending_check';

export interface TvChannelItem {
  id: number;
  churchId: number;
  name: string;
  category: string;
  language: string;
  country: string | null;
  logoUrl: string | null;
  streamUrl: string;
  streamFormat: 'hls' | 'mp4' | 'embed' | string;
  sourceOrigin: 'manual' | 'm3u_import' | 'iptv_org' | string;
  tvgId: string | null;
  description: string | null;
  currentProgram: string | null;
  isRecommended: boolean;
  isValidated: boolean;
  isActive: boolean;
  rightsVerified: boolean;
  rightsHolder: string | null;
  rightsNotes: string | null;
  streamStatus: TvStreamStatus;
  httpStatus: number | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TvBroadcastItem {
  id: number;
  churchId: number;
  title: string;
  broadcastType: 'culte' | 'priere' | 'conference' | 'evenement' | 'rediffusion' | string;
  description: string | null;
  speakerName: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  ingestProvider: 'hls_custom' | 'youtube_live' | 'vimeo' | 'mux_rtmp' | 'replay_mp4' | string;
  status: 'scheduled' | 'live' | 'replay' | 'archived' | string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  viewersCount: number;
  createdAt: string;
}

export interface TvWatchHistoryItem {
  id: number;
  churchId: number;
  channelId: number | null;
  broadcastId: number | null;
  lastPositionSeconds: number;
  durationSeconds: number;
  watchedAt: string;
  channel: TvChannelItem | null;
  broadcast: TvBroadcastItem | null;
}

export interface TvDiscoveryEntry {
  index: number;
  name: string;
  streamUrl: string;
  httpProtocol?: 'https' | 'http';
  logoUrl: string | null;
  tvgId: string | null;
  groupTitle: string | null;
  language: string;
  country: string | null;
  suggestedCategory: string;
  christianRelevanceScore: number;
  isLikelyChristian: boolean;
  streamFormat: 'hls' | 'mp4' | 'embed';
}

export interface PublicTvCatalogResponse {
  churchId: number;
  churchName: string;
  categories: string[];
  channels: TvChannelItem[];
  recommendedChannels: TvChannelItem[];
  broadcasts: TvBroadcastItem[];
}
