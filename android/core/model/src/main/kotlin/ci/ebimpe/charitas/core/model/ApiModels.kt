package ci.ebimpe.charitas.core.model

import kotlinx.serialization.Serializable

@Serializable
data class ServiceScheduleItem(
    val day: String = "",
    val time: String = "",
    val title: String = "",
    val location: String? = null
)

@Serializable
data class UserDto(
    val id: Int,
    val uid: String = "",
    val email: String,
    val fullName: String,
    val phone: String? = null,
    val city: String? = null,
    val country: String = "Côte d'Ivoire",
    val bio: String? = null,
    val avatarUrl: String? = null,
    val preferredTheme: String = "light",
    val isPlatformSuperAdmin: Boolean = false,
    val emailVerified: Boolean = true
)

@Serializable
data class ChurchMembershipDto(
    val membershipId: Int,
    val churchId: Int,
    val role: String,
    val departmentId: Int? = null,
    val leadershipTitle: String? = null,
    val status: String = "active",
    val joinedAt: String = "",
    val churchName: String,
    val churchSlug: String = "",
    val churchLogoUrl: String? = null,
    val churchBannerUrl: String? = null,
    val churchPrimaryColor: String = "#1B365D",
    val churchAccentColor: String = "#881337",
    val churchCurrency: String = "XOF",
    val churchCity: String? = null,
    val churchCountry: String? = null,
    val permissions: List<String> = emptyList()
)

@Serializable
data class AuthResponseDto(
    val token: String,
    val user: UserDto
)

@Serializable
data class MeResponseDto(
    val user: UserDto,
    val memberships: List<ChurchMembershipDto> = emptyList()
)

@Serializable
data class MessageResponseDto(
    val message: String = "",
    val previewResetCode: String? = null
)

@Serializable
data class PublicChurchDto(
    val id: Int,
    val slug: String = "",
    val name: String,
    val tagline: String? = null,
    val description: String? = null,
    val denomination: String? = null,
    val address: String? = null,
    val city: String? = null,
    val country: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val website: String? = null,
    val logoUrl: String? = null,
    val bannerUrl: String? = null,
    val primaryColor: String = "#1B365D",
    val accentColor: String = "#881337",
    val currency: String = "XOF",
    val serviceSchedule: List<ServiceScheduleItem> = emptyList(),
    val membersCount: Int = 0,
    val departmentsCount: Int = 0
)

@Serializable
data class PublicShowcaseResponseDto(
    val featuredChurch: PublicChurchDto? = null,
    val churches: List<PublicChurchDto> = emptyList(),
    val latestPosts: List<SocialPostDto> = emptyList(),
    val upcomingEvents: List<ChurchEventDto> = emptyList(),
    val activeCampaigns: List<DonationCampaignDto> = emptyList(),
    val humanitarianActions: List<InterventionReportDto> = emptyList(),
    val openVolunteerMissionsCount: Int = 0
)

@Serializable
data class PollOptionDto(
    val id: Int,
    val postId: Int = 0,
    val label: String,
    val votesCount: Int = 0
)

@Serializable
data class SocialPostDto(
    val id: Int,
    val churchId: Int = 0,
    val authorUserId: Int? = null,
    val authorName: String,
    val authorAvatar: String? = null,
    val groupId: Int? = null,
    val postType: String = "text",
    val content: String,
    val mediaUrl: String? = null,
    val hashtags: List<String> = emptyList(),
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val sharesCount: Int = 0,
    val createdAt: String = "",
    val myReaction: String? = null,
    val isBookmarked: Boolean = false,
    val pollOptions: List<PollOptionDto> = emptyList(),
    val myPollOptionId: Int? = null
)

@Serializable
data class SocialFeedResponseDto(
    val posts: List<SocialPostDto> = emptyList()
)

@Serializable
data class SocialCommentDto(
    val id: Int,
    val postId: Int,
    val authorName: String,
    val content: String,
    val createdAt: String = ""
)

@Serializable
data class CommentsResponseDto(
    val comments: List<SocialCommentDto> = emptyList()
)

@Serializable
data class CommunityGroupDto(
    val id: Int,
    val churchId: Int = 0,
    val name: String,
    val description: String? = null,
    val category: String = "Général",
    val membersCount: Int = 0,
    val isMember: Boolean = false
)

@Serializable
data class GroupsResponseDto(
    val groups: List<CommunityGroupDto> = emptyList()
)

@Serializable
data class ConversationParticipantDto(
    val conversationId: Int = 0,
    val userId: Int,
    val fullName: String
)

@Serializable
data class ConversationDto(
    val id: Int,
    val churchId: Int = 0,
    val type: String = "public_room",
    val title: String? = null,
    val displayTitle: String? = null,
    val updatedAt: String = "",
    val participants: List<ConversationParticipantDto> = emptyList()
)

@Serializable
data class ConversationsResponseDto(
    val conversations: List<ConversationDto> = emptyList()
)

@Serializable
data class ChatMessageDto(
    val id: Int,
    val conversationId: Int,
    val senderUserId: Int,
    val senderName: String = "",
    val content: String,
    val messageType: String = "text",
    val createdAt: String = "",
    val isLocalPending: Boolean = false,
    val localOutboxId: Long? = null
)

@Serializable
data class MessagesResponseDto(
    val messages: List<ChatMessageDto> = emptyList()
)

@Serializable
data class NotificationDto(
    val id: Int,
    val churchId: Int = 0,
    val type: String = "info",
    val title: String,
    val body: String,
    val isRead: Boolean = false,
    val createdAt: String = ""
)

@Serializable
data class NotificationsResponseDto(
    val notifications: List<NotificationDto> = emptyList()
)

@Serializable
data class EventRegistrationDto(
    val id: Int,
    val status: String = "registered",
    val checkedInAt: String? = null,
    val qrPayload: String = ""
)

@Serializable
data class ChurchEventDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val description: String? = null,
    val eventType: String = "culte",
    val location: String? = null,
    val startsAt: String = "",
    val endsAt: String? = null,
    val streamUrl: String? = null,
    val isLive: Boolean = false,
    val registrationsCount: Int = 0,
    val checkedInCount: Int = 0,
    val myRegistration: EventRegistrationDto? = null
)

@Serializable
data class EventsResponseDto(
    val churchId: Int = 0,
    val churchName: String = "",
    val events: List<ChurchEventDto> = emptyList()
)

@Serializable
data class SpiritualContentDto(
    val id: Int,
    val churchId: Int = 0,
    val kind: String = "meditation",
    val title: String,
    val scriptureRef: String? = null,
    val content: String,
    val mediaUrl: String? = null,
    val durationLabel: String? = null,
    val publishedDate: String = ""
)

@Serializable
data class ReadingPlanDayDto(
    val day: Int,
    val title: String,
    val scripture: String,
    val reflection: String
)

@Serializable
data class ReadingPlanDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val description: String = "",
    val days: List<ReadingPlanDayDto> = emptyList(),
    val completedDays: List<Int> = emptyList()
)

@Serializable
data class PublicSpiritualDailyResponseDto(
    val churchId: Int = 0,
    val churchName: String = "",
    val dailyVerse: SpiritualContentDto? = null,
    val meditations: List<SpiritualContentDto> = emptyList(),
    val sermons: List<SpiritualContentDto> = emptyList(),
    val podcasts: List<SpiritualContentDto> = emptyList(),
    val readingPlans: List<ReadingPlanDto> = emptyList()
)

@Serializable
data class PrayerRequestDto(
    val id: Int,
    val authorName: String = "Membre",
    val isAnonymous: Boolean = false,
    val title: String,
    val content: String,
    val prayCount: Int = 0,
    val hasPrayed: Boolean = false,
    val createdAt: String = ""
)

@Serializable
data class SpiritualOverviewResponseDto(
    val dailyVerse: SpiritualContentDto? = null,
    val meditations: List<SpiritualContentDto> = emptyList(),
    val sermons: List<SpiritualContentDto> = emptyList(),
    val podcasts: List<SpiritualContentDto> = emptyList(),
    val readingPlans: List<ReadingPlanDto> = emptyList(),
    val prayers: List<PrayerRequestDto> = emptyList()
)

@Serializable
data class MediaItemDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val description: String? = null,
    val mediaType: String = "replay",
    val mediaUrl: String,
    val thumbnailUrl: String? = null,
    val speakerName: String? = null,
    val durationLabel: String? = null,
    val publishedDate: String = ""
)

@Serializable
data class MediaResponseDto(
    val churchId: Int = 0,
    val churchName: String = "",
    val media: List<MediaItemDto> = emptyList()
)

@Serializable
data class DonationCampaignDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val description: String? = null,
    val fundCategory: String = "church",
    val goalAmount: Long = 0,
    val collectedAmount: Long = 0,
    val currency: String = "XOF"
)

@Serializable
data class InterventionReportDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val summary: String,
    val beneficiariesHelpedCount: Int = 0,
    val totalAmountSpent: Long = 0,
    val proofImageUrl: String? = null,
    val publishedDate: String = ""
)

@Serializable
data class VolunteerMissionDto(
    val id: Int,
    val missionTitle: String,
    val roleDescription: String? = null,
    val scheduledDate: String = "",
    val status: String = "assigned",
    val volunteerName: String? = null
)

@Serializable
data class PublicSolidarityResponseDto(
    val churchId: Int = 0,
    val churchName: String = "",
    val campaigns: List<DonationCampaignDto> = emptyList(),
    val reports: List<InterventionReportDto> = emptyList(),
    val volunteerMissions: List<VolunteerMissionDto> = emptyList()
)

@Serializable
data class TvChannelDto(
    val id: Int,
    val churchId: Int = 0,
    val name: String,
    val category: String,
    val language: String = "Français",
    val country: String? = null,
    val logoUrl: String? = null,
    val streamUrl: String,
    val streamFormat: String = "hls",
    val description: String? = null,
    val currentProgram: String? = null,
    val isRecommended: Boolean = false,
    val isValidated: Boolean = false,
    val isActive: Boolean = true,
    val streamStatus: String = "operational",
    val lastCheckError: String? = null
)

@Serializable
data class TvBroadcastDto(
    val id: Int,
    val churchId: Int = 0,
    val title: String,
    val broadcastType: String = "culte",
    val speakerName: String? = null,
    val description: String? = null,
    val streamUrl: String,
    val status: String = "live"
)

@Serializable
data class PublicTvCatalogResponseDto(
    val churchId: Int = 0,
    val churchName: String = "",
    val categories: List<String> = emptyList(),
    val channels: List<TvChannelDto> = emptyList(),
    val recommendedChannels: List<TvChannelDto> = emptyList(),
    val broadcasts: List<TvBroadcastDto> = emptyList()
)

@Serializable
data class ChurchMemberDto(
    val membershipId: Int,
    val userId: Int,
    val fullName: String,
    val email: String,
    val phone: String? = null,
    val role: String,
    val leadershipTitle: String? = null,
    val status: String = "active"
)

@Serializable
data class MembersResponseDto(
    val members: List<ChurchMemberDto> = emptyList()
)

@Serializable
data class AuditLogDto(
    val id: Int,
    val action: String,
    val actorEmail: String? = null,
    val entityType: String = "",
    val createdAt: String = ""
)

@Serializable
data class AuditLogsResponseDto(
    val logs: List<AuditLogDto> = emptyList()
)
