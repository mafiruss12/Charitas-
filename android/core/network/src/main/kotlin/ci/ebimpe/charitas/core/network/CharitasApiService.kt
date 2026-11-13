package ci.ebimpe.charitas.core.network

import ci.ebimpe.charitas.core.model.*
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val fullName: String,
    val phone: String? = null,
    val city: String? = null,
    val country: String = "Côte d'Ivoire",
    val invitationCode: String? = null,
    val churchId: Int? = null
)

@Serializable
data class ForgotPasswordRequest(val email: String)

@Serializable
data class ResetPasswordRequest(val token: String, val newPassword: String)

@Serializable
data class UpdateProfileRequest(
    val fullName: String? = null,
    val phone: String? = null,
    val city: String? = null,
    val bio: String? = null,
    val preferredTheme: String? = null
)

@Serializable
data class CreatePostRequest(
    val postType: String = "text",
    val content: String,
    val mediaUrl: String? = null,
    val groupId: Int? = null,
    val pollOptionsList: List<String>? = null
)

@Serializable
data class CreateCommentRequest(val content: String)

@Serializable
data class ReactRequest(val reactionType: String = "amen")

@Serializable
data class SendMessageRequest(val content: String, val messageType: String = "text")

@Serializable
data class CreateConversationRequest(val type: String = "direct", val targetUserId: Int? = null, val title: String? = null)

@Serializable
data class CreateGroupRequest(val name: String, val description: String? = null, val category: String = "Général")

@Serializable
data class VisitorContactRequest(
    val churchId: Int,
    val fullName: String,
    val email: String? = null,
    val phone: String? = null,
    val interestType: String = "visite",
    val message: String? = null
)

@Serializable
data class BookmarkToggleRequest(val reference: String, val verseText: String)

@Serializable
data class TogglePlanDayRequest(val day: Int)

@Serializable
data class CreatePrayerRequest(val title: String, val content: String, val isAnonymous: Boolean = false)

@Serializable
data class QrCheckinRequest(val qrPayload: String)

@Serializable
data class UpdateChurchSettingsRequest(
    val name: String? = null,
    val tagline: String? = null,
    val description: String? = null,
    val primaryColor: String? = null,
    val accentColor: String? = null
)

interface CharitasApiService {

    // ---- Public Endpoints (Zero Account Required) ----
    @GET("api/public/showcase")
    suspend fun getPublicShowcase(@Query("churchId") churchId: Int? = null): Response<PublicShowcaseResponseDto>

    @GET("api/public/feed")
    suspend fun getPublicFeed(
        @Query("churchId") churchId: Int? = null,
        @Query("type") postType: String? = null,
        @Query("search") search: String? = null
    ): Response<SocialFeedResponseDto>

    @GET("api/public/events")
    suspend fun getPublicEvents(@Query("churchId") churchId: Int? = null): Response<EventsResponseDto>

    @GET("api/public/spiritual/daily")
    suspend fun getPublicSpiritualDaily(@Query("churchId") churchId: Int? = null): Response<PublicSpiritualDailyResponseDto>

    @GET("api/public/media")
    suspend fun getPublicMedia(@Query("churchId") churchId: Int? = null): Response<MediaResponseDto>

    @GET("api/public/solidarity")
    suspend fun getPublicSolidarity(@Query("churchId") churchId: Int? = null): Response<PublicSolidarityResponseDto>

    @GET("api/public/tv/catalog")
    suspend fun getPublicTvCatalog(
        @Query("churchId") churchId: Int? = null,
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("refresh") refresh: Int? = null
    ): Response<PublicTvCatalogResponseDto>

    @POST("api/public/tv/channels/{channelId}/verify-now")
    suspend fun verifyTvChannelNow(@Path("channelId") channelId: Int): Response<VerifyTvChannelResponseDto>

    @POST("api/public/visitor-contact")
    suspend fun submitVisitorContact(@Body body: VisitorContactRequest): Response<MessageResponseDto>

    // ---- Auth Endpoints ----
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponseDto>

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponseDto>

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequest): Response<MessageResponseDto>

    @POST("api/auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): Response<MessageResponseDto>

    @GET("api/auth/me")
    suspend fun getMe(): Response<MeResponseDto>

    @PATCH("api/auth/me")
    suspend fun updateMe(@Body body: UpdateProfileRequest): Response<MeResponseDto>

    // ---- Social & Community ----
    @GET("api/churches/{churchId}/social/posts")
    suspend fun getChurchPosts(
        @Path("churchId") churchId: Int,
        @Query("type") postType: String? = null,
        @Query("search") search: String? = null,
        @Query("groupId") groupId: Int? = null
    ): Response<SocialFeedResponseDto>

    @POST("api/churches/{churchId}/social/posts")
    suspend fun createPost(@Path("churchId") churchId: Int, @Body body: CreatePostRequest): Response<MessageResponseDto>

    @POST("api/churches/{churchId}/social/posts/{postId}/react")
    suspend fun toggleReaction(
        @Path("churchId") churchId: Int,
        @Path("postId") postId: Int,
        @Body body: ReactRequest
    ): Response<MessageResponseDto>

    @GET("api/churches/{churchId}/social/posts/{postId}/comments")
    suspend fun getPostComments(@Path("churchId") churchId: Int, @Path("postId") postId: Int): Response<CommentsResponseDto>

    @POST("api/churches/{churchId}/social/posts/{postId}/comments")
    suspend fun addPostComment(
        @Path("churchId") churchId: Int,
        @Path("postId") postId: Int,
        @Body body: CreateCommentRequest
    ): Response<MessageResponseDto>

    @GET("api/churches/{churchId}/social/groups")
    suspend fun getGroups(@Path("churchId") churchId: Int): Response<GroupsResponseDto>

    @POST("api/churches/{churchId}/social/groups")
    suspend fun createGroup(@Path("churchId") churchId: Int, @Body body: CreateGroupRequest): Response<MessageResponseDto>

    @POST("api/churches/{churchId}/social/groups/{groupId}/join")
    suspend fun toggleGroupJoin(@Path("churchId") churchId: Int, @Path("groupId") groupId: Int): Response<MessageResponseDto>

    // ---- Messaging & Notifications ----
    @GET("api/churches/{churchId}/messaging/conversations")
    suspend fun getConversations(@Path("churchId") churchId: Int): Response<ConversationsResponseDto>

    @POST("api/churches/{churchId}/messaging/conversations")
    suspend fun createConversation(@Path("churchId") churchId: Int, @Body body: CreateConversationRequest): Response<MessageResponseDto>

    @GET("api/churches/{churchId}/messaging/conversations/{conversationId}/messages")
    suspend fun getMessages(
        @Path("churchId") churchId: Int,
        @Path("conversationId") conversationId: Int
    ): Response<MessagesResponseDto>

    @POST("api/churches/{churchId}/messaging/conversations/{conversationId}/messages")
    suspend fun sendMessage(
        @Path("churchId") churchId: Int,
        @Path("conversationId") conversationId: Int,
        @Body body: SendMessageRequest
    ): Response<MessageResponseDto>

    @GET("api/churches/{churchId}/notifications")
    suspend fun getNotifications(@Path("churchId") churchId: Int): Response<NotificationsResponseDto>

    @POST("api/churches/{churchId}/notifications/read-all")
    suspend fun markAllNotificationsRead(@Path("churchId") churchId: Int): Response<MessageResponseDto>

    // ---- Spiritual & Bible Sync ----
    @GET("api/churches/{churchId}/spiritual/overview")
    suspend fun getSpiritualOverview(@Path("churchId") churchId: Int): Response<SpiritualOverviewResponseDto>

    @POST("api/churches/{churchId}/spiritual/bookmarks")
    suspend fun toggleBibleBookmark(@Path("churchId") churchId: Int, @Body body: BookmarkToggleRequest): Response<MessageResponseDto>

    @POST("api/churches/{churchId}/spiritual/reading-plans/{planId}/toggle-day")
    suspend fun toggleReadingPlanDay(
        @Path("churchId") churchId: Int,
        @Path("planId") planId: Int,
        @Body body: TogglePlanDayRequest
    ): Response<MessageResponseDto>

    @POST("api/churches/{churchId}/spiritual/prayers")
    suspend fun createPrayer(@Path("churchId") churchId: Int, @Body body: CreatePrayerRequest): Response<MessageResponseDto>

    // ---- Events & QR Attendance ----
    @GET("api/churches/{churchId}/events")
    suspend fun getEvents(@Path("churchId") churchId: Int): Response<EventsResponseDto>

    @POST("api/churches/{churchId}/events/{eventId}/register")
    suspend fun registerForEvent(@Path("churchId") churchId: Int, @Path("eventId") eventId: Int): Response<MessageResponseDto>

    @POST("api/churches/{churchId}/events/{eventId}/checkin-qr")
    suspend fun checkinEventQr(
        @Path("churchId") churchId: Int,
        @Path("eventId") eventId: Int,
        @Body body: QrCheckinRequest
    ): Response<MessageResponseDto>

    // ---- CHARITAS TV Member State ----
    @POST("api/churches/{churchId}/tv/favorites/{channelId}")
    suspend fun toggleTvFavorite(@Path("churchId") churchId: Int, @Path("channelId") channelId: Int): Response<MessageResponseDto>

    // ---- Admin & Church Branding ----
    @GET("api/churches/{churchId}/members")
    suspend fun getMembers(@Path("churchId") churchId: Int): Response<MembersResponseDto>

    @GET("api/churches/{churchId}/audit-logs")
    suspend fun getAuditLogs(@Path("churchId") churchId: Int): Response<AuditLogsResponseDto>

    @PATCH("api/churches/{churchId}/settings")
    suspend fun updateChurchSettings(@Path("churchId") churchId: Int, @Body body: UpdateChurchSettingsRequest): Response<MessageResponseDto>
}
