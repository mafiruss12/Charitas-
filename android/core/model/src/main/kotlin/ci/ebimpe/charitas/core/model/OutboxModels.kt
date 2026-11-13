package ci.ebimpe.charitas.core.model

enum class OutboxOperationType {
    CREATE_POST,
    CREATE_COMMENT,
    TOGGLE_REACTION,
    SEND_MESSAGE,
    TOGGLE_PLAN_DAY,
    TOGGLE_BIBLE_BOOKMARK
}

enum class OutboxStatus {
    PENDING,
    SENDING,
    FAILED
}

data class OutboxUiState(
    val pendingCount: Int = 0,
    val failedCount: Int = 0,
    val lastSyncMessage: String? = null
)
