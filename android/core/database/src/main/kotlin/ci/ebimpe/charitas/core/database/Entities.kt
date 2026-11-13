package ci.ebimpe.charitas.core.database

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "bible_books")
data class BibleBookEntity(
    @PrimaryKey val id: String,
    val bookOrder: Int,
    val nameFr: String,
    val testament: String, // AT | NT
    val chaptersCount: Int
)

@Entity(
    tableName = "bible_verses",
    indices = [
        Index(value = ["bookId", "chapter", "verse"], unique = true),
        Index(value = ["bookOrder", "chapter", "verse"])
    ]
)
data class BibleVerseEntity(
    @PrimaryKey(autoGenerate = true) val rowId: Long = 0,
    val bookId: String,
    val bookOrder: Int,
    val bookNameFr: String,
    val testament: String,
    val chapter: Int,
    val verse: Int,
    val text: String
)

@Fts4(contentEntity = BibleVerseEntity::class)
@Entity(tableName = "bible_verses_fts")
data class BibleVerseFts(
    @PrimaryKey @ColumnInfo(name = "rowid") val rowId: Long,
    val bookNameFr: String,
    val text: String
)

@Entity(
    tableName = "bible_bookmarks",
    indices = [Index(value = ["reference"], unique = true)]
)
data class BibleBookmarkEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bookId: String,
    val chapter: Int,
    val verse: Int,
    val reference: String,
    val verseText: String,
    val highlightColor: String = "#F5B82E",
    val syncedWithServer: Boolean = false,
    val createdAtMs: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "bible_notes",
    indices = [Index(value = ["bookId", "chapter", "verse"])]
)
data class BibleNoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bookId: String,
    val chapter: Int,
    val verse: Int,
    val reference: String,
    val noteText: String,
    val updatedAtMs: Long = System.currentTimeMillis()
)

@Entity(tableName = "bible_reading_history")
data class BibleHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bookId: String,
    val bookNameFr: String,
    val chapter: Int,
    val verse: Int = 1,
    val readAtMs: Long = System.currentTimeMillis()
)

@Entity(tableName = "offline_reading_plans")
data class OfflineReadingPlanEntity(
    @PrimaryKey val id: Int,
    val churchId: Int,
    val title: String,
    val description: String,
    val daysJson: String,
    val completedDaysCsv: String = "",
    val updatedAtMs: Long = System.currentTimeMillis()
)

@Entity(tableName = "offline_meditations")
data class OfflineMeditationEntity(
    @PrimaryKey val id: Int,
    val churchId: Int,
    val kind: String,
    val title: String,
    val scriptureRef: String?,
    val content: String,
    val durationLabel: String?,
    val publishedDate: String,
    val updatedAtMs: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_json_payloads")
data class CachedJsonPayloadEntity(
    @PrimaryKey val cacheKey: String, // "public:*" or "private:*"
    val isPrivateUserScope: Boolean,
    val payloadJson: String,
    val updatedAtMs: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "outbox_operations",
    indices = [Index(value = ["clientMutationId"], unique = true)]
)
data class OutboxOperationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val clientMutationId: String,
    val churchId: Int,
    val operationType: String, // OutboxOperationType.name
    val targetId: String? = null,
    val payloadJson: String,
    val status: String = "PENDING", // PENDING | SENDING | FAILED
    val retryCount: Int = 0,
    val lastError: String? = null,
    val createdAtMs: Long = System.currentTimeMillis()
)
