package ci.ebimpe.charitas.data.sync

import android.content.Context
import ci.ebimpe.charitas.core.database.CachedJsonPayloadEntity
import ci.ebimpe.charitas.core.database.CharitasDatabase
import ci.ebimpe.charitas.core.database.OfflineMeditationEntity
import ci.ebimpe.charitas.core.database.OfflineReadingPlanEntity
import ci.ebimpe.charitas.core.database.OutboxOperationEntity
import ci.ebimpe.charitas.core.model.*
import ci.ebimpe.charitas.core.network.*
import ci.ebimpe.charitas.data.tv.TvFallbackCatalog
import ci.ebimpe.charitas.core.security.SessionVault
import ci.ebimpe.charitas.notifications.CharitasNotificationHelper
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import java.util.UUID

sealed class RepoResult<out T> {
    data class Success<T>(val data: T, val fromCache: Boolean = false) : RepoResult<T>()
    data class Error(val message: String, val cachedFallback: Any? = null) : RepoResult<Nothing>()
}

data class OutboxFlushOutcome(
    val syncedCount: Int,
    val failedCount: Int,
    val hasRetryableFailure: Boolean
)

class CharitasRepository(
    private val context: Context,
    private val api: CharitasApiService,
    private val db: CharitasDatabase,
    private val sessionVault: SessionVault,
    private val networkMonitor: NetworkMonitor,
    private val webSocketClient: CharitasWebSocketClient
) {
    private val json = NetworkClientFactory.jsonSerializer
    private val cacheDao = db.offlineCacheDao()
    private val outboxDao = db.outboxDao()

    private val _currentUser = MutableStateFlow<UserDto?>(null)
    val currentUser: StateFlow<UserDto?> = _currentUser.asStateFlow()

    private val _memberships = MutableStateFlow<List<ChurchMembershipDto>>(emptyList())
    val memberships: StateFlow<List<ChurchMembershipDto>> = _memberships.asStateFlow()

    val isOnline: StateFlow<Boolean> = networkMonitor.isOnline
    val activeChurchId: StateFlow<Int> = sessionVault.activeChurchId

    val outboxStateFlow: Flow<OutboxUiState> = outboxDao.observeAll().map { ops ->
        OutboxUiState(
            pendingCount = ops.count { it.status == OutboxStatus.PENDING.name || it.status == OutboxStatus.SENDING.name },
            failedCount = ops.count { it.status == OutboxStatus.FAILED.name }
        )
    }

    fun getCurrentMembership(): ChurchMembershipDto? {
        val cid = sessionVault.activeChurchId.value
        return _memberships.value.firstOrNull { it.churchId == cid } ?: _memberships.value.firstOrNull()
    }

    fun hasPermission(permission: String): Boolean {
        val user = _currentUser.value ?: return false
        return getCurrentMembership().hasPermission(permission, user.isPlatformSuperAdmin)
    }

    fun selectChurch(churchId: Int) {
        sessionVault.setActiveChurchId(churchId)
        val token = sessionVault.getToken()
        if (!token.isNullOrBlank() && networkMonitor.isOnline.value) {
            webSocketClient.connect(token, churchId)
        }
    }

    // ==================== AUTH & PROFILE ====================

    suspend fun restoreSessionIfPresent(): Boolean {
        val token = sessionVault.getToken() ?: return false
        if (!networkMonitor.refreshNow()) {
            // Restore cached /me profile when offline so authenticated user can view cached content safely
            val cached = cacheDao.getCachedJson("private:me")?.let {
                runCatching { json.decodeFromString<MeResponseDto>(it.payloadJson) }.getOrNull()
            }
            if (cached != null) {
                _currentUser.value = cached.user
                _memberships.value = cached.memberships
                return true
            }
            return false
        }

        return runCatching {
            val res = api.getMe()
            if (res.isSuccessful && res.body() != null) {
                val me = res.body()!!
                _currentUser.value = me.user
                _memberships.value = me.memberships
                cacheDao.putCachedJson(
                    CachedJsonPayloadEntity(
                        cacheKey = "private:me",
                        isPrivateUserScope = true,
                        payloadJson = json.encodeToString(me)
                    )
                )
                val targetChurch = me.memberships.firstOrNull { it.churchId == sessionVault.activeChurchId.value }?.churchId
                    ?: me.memberships.firstOrNull()?.churchId
                    ?: 1
                sessionVault.setActiveChurchId(targetChurch)
                webSocketClient.connect(token, targetChurch)
                true
            } else if (res.code() == 401) {
                logout()
                false
            } else {
                false
            }
        }.getOrDefault(false)
    }

    suspend fun login(email: String, password: String): RepoResult<UserDto> {
        if (!networkMonitor.refreshNow()) {
            return RepoResult.Error("Connexion Internet requise pour se connecter.")
        }
        return try {
            val res = api.login(LoginRequest(email.trim(), password))
            val body = res.body()
            if (res.isSuccessful && body != null) {
                sessionVault.saveSession(body.token, body.user.id, body.user.email)
                _currentUser.value = body.user
                restoreSessionIfPresent()
                RepoResult.Success(body.user)
            } else {
                RepoResult.Error(NetworkClientFactory.parseErrorMessage(res))
            }
        } catch (e: Exception) {
            RepoResult.Error(e.message ?: "Impossible de joindre le serveur.")
        }
    }

    suspend fun register(
        fullName: String,
        email: String,
        password: String,
        phone: String?,
        invitationCode: String?,
        churchId: Int
    ): RepoResult<UserDto> {
        if (!networkMonitor.refreshNow()) {
            return RepoResult.Error("Connexion Internet requise pour créer un compte.")
        }
        return try {
            val req = RegisterRequest(
                email = email.trim(),
                password = password,
                fullName = fullName.trim(),
                phone = phone?.trim()?.ifBlank { null },
                invitationCode = invitationCode?.trim()?.ifBlank { null },
                churchId = if (invitationCode.isNullOrBlank()) churchId else null
            )
            val res = api.register(req)
            val body = res.body()
            if (res.isSuccessful && body != null) {
                sessionVault.saveSession(body.token, body.user.id, body.user.email, churchId)
                _currentUser.value = body.user
                restoreSessionIfPresent()
                RepoResult.Success(body.user)
            } else {
                RepoResult.Error(NetworkClientFactory.parseErrorMessage(res))
            }
        } catch (e: Exception) {
            RepoResult.Error(e.message ?: "Erreur réseau lors de l'inscription.")
        }
    }

    suspend fun forgotPassword(email: String): RepoResult<MessageResponseDto> {
        if (!networkMonitor.refreshNow()) return RepoResult.Error("Réseau indisponible.")
        return try {
            val res = api.forgotPassword(ForgotPasswordRequest(email.trim()))
            if (res.isSuccessful && res.body() != null) {
                RepoResult.Success(res.body()!!)
            } else {
                RepoResult.Error(NetworkClientFactory.parseErrorMessage(res))
            }
        } catch (e: Exception) {
            RepoResult.Error(e.message ?: "Erreur réseau.")
        }
    }

    suspend fun resetPassword(token: String, newPassword: String): RepoResult<MessageResponseDto> {
        if (!networkMonitor.refreshNow()) return RepoResult.Error("Réseau indisponible.")
        return try {
            val res = api.resetPassword(ResetPasswordRequest(token.trim(), newPassword))
            if (res.isSuccessful && res.body() != null) {
                RepoResult.Success(res.body()!!)
            } else {
                RepoResult.Error(NetworkClientFactory.parseErrorMessage(res))
            }
        } catch (e: Exception) {
            RepoResult.Error(e.message ?: "Erreur réseau.")
        }
    }

    suspend fun updateProfile(fullName: String, phone: String?, city: String?, bio: String?): RepoResult<UserDto> {
        if (!networkMonitor.refreshNow()) return RepoResult.Error("Connexion requise pour modifier le profil.")
        return try {
            val res = api.updateMe(UpdateProfileRequest(fullName = fullName, phone = phone, city = city, bio = bio))
            if (res.isSuccessful && res.body() != null) {
                val updated = res.body()!!.user
                _currentUser.value = updated
                RepoResult.Success(updated)
            } else {
                RepoResult.Error(NetworkClientFactory.parseErrorMessage(res))
            }
        } catch (e: Exception) {
            RepoResult.Error(e.message ?: "Erreur mise à jour profil.")
        }
    }

    suspend fun logout() {
        webSocketClient.disconnect()
        sessionVault.clearSession()
        cacheDao.clearPrivateCaches()
        outboxDao.clearAll()
        _currentUser.value = null
        _memberships.value = emptyList()
    }

    // ==================== CACHE-FIRST READERS ====================

    private suspend inline fun <reified T> fetchWithOfflineCache(
        cacheKey: String,
        isPrivate: Boolean,
        crossinline fetcher: suspend () -> retrofit2.Response<T>
    ): RepoResult<T> {
        var networkError: String? = null
        if (networkMonitor.refreshNow()) {
            val attemptResult = runCatching { fetcher() }
            val attempt = attemptResult.getOrNull()
            if (attempt != null && attempt.isSuccessful && attempt.body() != null) {
                val payload = attempt.body()!!
                cacheDao.putCachedJson(
                    CachedJsonPayloadEntity(
                        cacheKey = cacheKey,
                        isPrivateUserScope = isPrivate,
                        payloadJson = json.encodeToString(payload)
                    )
                )
                return RepoResult.Success(payload, fromCache = false)
            }
            networkError = when {
                attemptResult.exceptionOrNull() != null ->
                    attemptResult.exceptionOrNull()?.message ?: "Erreur réseau"
                attempt == null -> "Réponse serveur vide"
                !attempt.isSuccessful ->
                    "Serveur ${attempt.code()}: ${NetworkClientFactory.parseErrorMessage(attempt)}"
                else -> "Réponse invalide du serveur"
            }
        } else {
            networkError = "Pas de connexion Internet"
        }

        val cached = cacheDao.getCachedJson(cacheKey)
        if (cached != null) {
            val decoded = runCatching { json.decodeFromString<T>(cached.payloadJson) }.getOrNull()
            if (decoded != null) {
                return RepoResult.Success(decoded, fromCache = true)
            }
        }

        return RepoResult.Error(networkError ?: "Contenu indisponible.")
    }

    suspend fun loadShowcase(churchId: Int? = null): RepoResult<PublicShowcaseResponseDto> =
        fetchWithOfflineCache("public:showcase:${churchId ?: 0}", isPrivate = false) {
            api.getPublicShowcase(churchId)
        }

    suspend fun loadFeed(churchId: Int, type: String? = null, search: String? = null): RepoResult<SocialFeedResponseDto> {
        val isMember = _currentUser.value != null && hasPermission(CharitasPermissions.SOCIAL_VIEW)
        return if (isMember) {
            fetchWithOfflineCache("private:feed:$churchId:${type ?: "all"}", isPrivate = true) {
                api.getChurchPosts(churchId, postType = type, search = search)
            }
        } else {
            fetchWithOfflineCache("public:feed:$churchId:${type ?: "all"}", isPrivate = false) {
                api.getPublicFeed(churchId, postType = type, search = search)
            }
        }
    }

    suspend fun loadEvents(churchId: Int): RepoResult<EventsResponseDto> {
        val isMember = _currentUser.value != null && getCurrentMembership() != null
        return if (isMember) {
            fetchWithOfflineCache("private:events:$churchId", isPrivate = true) { api.getEvents(churchId) }
        } else {
            fetchWithOfflineCache("public:events:$churchId", isPrivate = false) { api.getPublicEvents(churchId) }
        }
    }

    suspend fun loadTvCatalog(
        churchId: Int,
        category: String? = null,
        search: String? = null,
        forceRefresh: Boolean = false
    ): RepoResult<PublicTvCatalogResponseDto> {
        val normalizedSearch = search?.trim()?.ifBlank { null }
        val refreshParam = if (forceRefresh) 1 else null
        val cacheKey = "public:tv:$churchId:${category ?: "all"}"

        // 1) API CHARITAS
        if (networkMonitor.refreshNow()) {
            val apiResult = runCatching {
                api.getPublicTvCatalog(
                    churchId = churchId.takeIf { it > 0 },
                    category = category,
                    search = normalizedSearch,
                    refresh = refreshParam
                )
            }
            val res = apiResult.getOrNull()
            val body = res?.body()
            if (res != null && res.isSuccessful && body != null && body.channels.isNotEmpty()) {
                cacheDao.putCachedJson(
                    CachedJsonPayloadEntity(
                        cacheKey = cacheKey,
                        isPrivateUserScope = false,
                        payloadJson = json.encodeToString(body)
                    )
                )
                return RepoResult.Success(body, fromCache = false)
            }
        }

        // 2) Cache local
        val cached = cacheDao.getCachedJson(cacheKey)
            ?.let { runCatching { json.decodeFromString<PublicTvCatalogResponseDto>(it.payloadJson) }.getOrNull() }
        if (cached != null && cached.channels.isNotEmpty()) {
            val filtered = if (normalizedSearch != null) {
                val q = normalizedSearch.lowercase()
                cached.copy(channels = cached.channels.filter {
                    "${it.name} ${it.category} ${it.language} ${it.country ?: ""}".lowercase().contains(q)
                })
            } else cached
            return RepoResult.Success(filtered, fromCache = true)
        }

        // 3) Secours : playlist religieuse publique (iptv-org) — lecture live même si API 404
        return try {
            val fallback = TvFallbackCatalog.load(
                churchId = churchId,
                category = category,
                search = normalizedSearch
            )
            if (fallback.channels.isEmpty()) {
                RepoResult.Error(
                    "Aucune chaîne TV disponible. Vérifiez la connexion ou réessayez plus tard."
                )
            } else {
                cacheDao.putCachedJson(
                    CachedJsonPayloadEntity(
                        cacheKey = cacheKey,
                        isPrivateUserScope = false,
                        payloadJson = json.encodeToString(fallback)
                    )
                )
                RepoResult.Success(fallback, fromCache = false)
            }
        } catch (e: Exception) {
            RepoResult.Error(
                e.message?.takeIf { it.isNotBlank() }
                    ?: "Impossible de charger le catalogue TV (API et secours M3U en échec)."
            )
        }
    }

    suspend fun verifyTvChannelNow(channelId: Int): TvChannelDto? {
        if (!networkMonitor.refreshNow()) return null
        return runCatching {
            val res = api.verifyTvChannelNow(channelId)
            if (res.isSuccessful) res.body()?.channel else null
        }.getOrNull()
    }

    suspend fun loadPublicMedia(churchId: Int): RepoResult<MediaResponseDto> =
        fetchWithOfflineCache("public:media:$churchId", isPrivate = false) { api.getPublicMedia(churchId) }

    suspend fun loadPublicSolidarity(churchId: Int): RepoResult<PublicSolidarityResponseDto> =
        fetchWithOfflineCache("public:solidarity:$churchId", isPrivate = false) { api.getPublicSolidarity(churchId) }

    suspend fun syncSpiritualForVisitorAndMember(churchId: Int) {
        if (!networkMonitor.refreshNow()) return
        val isAuth = _currentUser.value != null && hasPermission(CharitasPermissions.SPIRITUAL_VIEW)
        if (isAuth) {
            val res = runCatching { api.getSpiritualOverview(churchId) }.getOrNull()
            val body = res?.body()
            if (res?.isSuccessful == true && body != null) {
                val meds = buildList {
                    body.dailyVerse?.let { add(it) }
                    addAll(body.meditations)
                    addAll(body.sermons)
                    addAll(body.podcasts)
                }.map {
                    OfflineMeditationEntity(
                        id = it.id,
                        churchId = churchId,
                        kind = it.kind,
                        title = it.title,
                        scriptureRef = it.scriptureRef,
                        content = it.content,
                        durationLabel = it.durationLabel,
                        publishedDate = it.publishedDate
                    )
                }
                cacheDao.upsertMeditations(meds)
                cacheDao.upsertReadingPlans(body.readingPlans.map { plan ->
                    val existing = cacheDao.getReadingPlanById(plan.id)
                    val mergedDays = ((existing?.completedDaysCsv?.split(",")?.mapNotNull { it.toIntOrNull() }.orEmpty()) + plan.completedDays)
                        .distinct().sorted()
                    OfflineReadingPlanEntity(
                        id = plan.id,
                        churchId = churchId,
                        title = plan.title,
                        description = plan.description,
                        daysJson = json.encodeToString(plan.days),
                        completedDaysCsv = mergedDays.joinToString(",")
                    )
                })
            }
        } else {
            val res = runCatching { api.getPublicSpiritualDaily(churchId) }.getOrNull()
            val body = res?.body()
            if (res?.isSuccessful == true && body != null) {
                val meds = buildList {
                    body.dailyVerse?.let { add(it) }
                    addAll(body.meditations)
                    addAll(body.sermons)
                    addAll(body.podcasts)
                }.map {
                    OfflineMeditationEntity(
                        id = it.id,
                        churchId = churchId,
                        kind = it.kind,
                        title = it.title,
                        scriptureRef = it.scriptureRef,
                        content = it.content,
                        durationLabel = it.durationLabel,
                        publishedDate = it.publishedDate
                    )
                }
                cacheDao.upsertMeditations(meds)
                cacheDao.upsertReadingPlans(body.readingPlans.map { plan ->
                    val existing = cacheDao.getReadingPlanById(plan.id)
                    OfflineReadingPlanEntity(
                        id = plan.id,
                        churchId = churchId,
                        title = plan.title,
                        description = plan.description,
                        daysJson = json.encodeToString(plan.days),
                        completedDaysCsv = existing?.completedDaysCsv ?: ""
                    )
                })
            }
        }
    }

    suspend fun loadConversations(churchId: Int): RepoResult<ConversationsResponseDto> =
        fetchWithOfflineCache("private:convs:$churchId", isPrivate = true) { api.getConversations(churchId) }

    suspend fun loadMessages(churchId: Int, conversationId: Int): RepoResult<MessagesResponseDto> =
        fetchWithOfflineCache("private:msgs:$churchId:$conversationId", isPrivate = true) {
            api.getMessages(churchId, conversationId)
        }

    suspend fun loadNotifications(churchId: Int): RepoResult<NotificationsResponseDto> {
        val result = fetchWithOfflineCache("private:notifs:$churchId", isPrivate = true) {
            api.getNotifications(churchId)
        }
        if (result is RepoResult.Success && !result.fromCache) {
            val unread = result.data.notifications.firstOrNull { !it.isRead }
            if (unread != null) {
                CharitasNotificationHelper.showNotification(
                    context = context,
                    channelId = CharitasNotificationHelper.CHANNEL_COMMUNITY,
                    notificationId = 2000 + (unread.id % 500),
                    title = unread.title,
                    body = unread.body
                )
            }
        }
        return result
    }

    // ==================== OFFLINE-FIRST OUTBOX MUTATIONS ====================

    /**
     * Enqueues a mutation locally (never claimed as sent until HTTP 2xx confirmation).
     * Immediately attempts dispatch if online, otherwise schedules OutboxSyncWorker.
     */
    suspend fun enqueueMutation(
        churchId: Int,
        type: OutboxOperationType,
        targetId: String?,
        payloadJson: String
    ): Long {
        val op = OutboxOperationEntity(
            clientMutationId = UUID.randomUUID().toString(),
            churchId = churchId,
            operationType = type.name,
            targetId = targetId,
            payloadJson = payloadJson,
            status = OutboxStatus.PENDING.name
        )
        val rowId = outboxDao.enqueue(op)
        if (networkMonitor.refreshNow()) {
            flushOutbox()
        } else {
            OutboxSyncWorker.scheduleSyncWhenConnected(context)
        }
        return rowId
    }

    suspend fun flushOutbox(): OutboxFlushOutcome {
        if (!networkMonitor.refreshNow()) {
            return OutboxFlushOutcome(0, 0, hasRetryableFailure = true)
        }
        val ops = outboxDao.getDispatchableOperations()
        var synced = 0
        var failed = 0
        var retryable = false

        for (op in ops) {
            outboxDao.updateStatus(op.id, OutboxStatus.SENDING.name, op.retryCount, null)
            val result = runCatching { dispatchSingleOutboxOp(op) }
            val response = result.getOrNull()

            if (response != null && response.isSuccessful) {
                outboxDao.deleteById(op.id)
                synced++
            } else if (response != null && response.code() in 400..499) {
                // Permanent conflict or authorization rejection -> keep visible to user as FAILED, never fake sent
                outboxDao.updateStatus(
                    op.id,
                    OutboxStatus.FAILED.name,
                    op.retryCount + 1,
                    NetworkClientFactory.parseErrorMessage(response)
                )
                failed++
            } else {
                // Transient server/network error -> leave PENDING & retry via WorkManager
                val err = result.exceptionOrNull()?.message ?: "Erreur réseau temporaire"
                outboxDao.updateStatus(op.id, OutboxStatus.PENDING.name, op.retryCount + 1, err)
                failed++
                retryable = true
            }
        }
        return OutboxFlushOutcome(synced, failed, retryable)
    }

    private suspend fun dispatchSingleOutboxOp(op: OutboxOperationEntity): retrofit2.Response<MessageResponseDto> {
        return when (OutboxOperationType.valueOf(op.operationType)) {
            OutboxOperationType.CREATE_POST -> {
                val body = json.decodeFromString<CreatePostRequest>(op.payloadJson)
                api.createPost(op.churchId, body)
            }
            OutboxOperationType.CREATE_COMMENT -> {
                val postId = op.targetId?.toIntOrNull() ?: error("postId manquant")
                val body = json.decodeFromString<CreateCommentRequest>(op.payloadJson)
                api.addPostComment(op.churchId, postId, body)
            }
            OutboxOperationType.TOGGLE_REACTION -> {
                val postId = op.targetId?.toIntOrNull() ?: error("postId manquant")
                val body = json.decodeFromString<ReactRequest>(op.payloadJson)
                api.toggleReaction(op.churchId, postId, body)
            }
            OutboxOperationType.SEND_MESSAGE -> {
                val convId = op.targetId?.toIntOrNull() ?: error("conversationId manquant")
                val body = json.decodeFromString<SendMessageRequest>(op.payloadJson)
                api.sendMessage(op.churchId, convId, body)
            }
            OutboxOperationType.TOGGLE_PLAN_DAY -> {
                val planId = op.targetId?.toIntOrNull() ?: error("planId manquant")
                val body = json.decodeFromString<TogglePlanDayRequest>(op.payloadJson)
                api.toggleReadingPlanDay(op.churchId, planId, body)
            }
            OutboxOperationType.TOGGLE_BIBLE_BOOKMARK -> {
                val body = json.decodeFromString<BookmarkToggleRequest>(op.payloadJson)
                api.toggleBibleBookmark(op.churchId, body)
            }
        }
    }
}
