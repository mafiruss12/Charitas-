package ci.ebimpe.charitas.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

object BibleSearchSanitizer {
    /**
     * Converts raw French text input into a safe SQLite FTS4 MATCH expression
     * avoiding crashes on apostrophes, colons, hyphens, or unbalanced quotes.
     */
    fun toFtsQuery(rawInput: String): String {
        val tokens = rawInput
            .trim()
            .replace("'", " ")
            .replace("’", " ")
            .replace("\"", " ")
            .split(Regex("[\\s,.;:!?()\\-_/]+"))
            .map { it.trim() }
            .filter { it.length >= 2 }
            .take(6)

        if (tokens.isEmpty()) return ""
        return tokens.joinToString(" ") { "$it*" }
    }
}

@Dao
interface BibleDao {
    @Query("SELECT COUNT(*) FROM bible_books")
    suspend fun getBooksCount(): Int

    @Query("SELECT COUNT(*) FROM bible_verses")
    suspend fun getVersesCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBooks(books: List<BibleBookEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVerses(verses: List<BibleVerseEntity>)

    @Query("SELECT * FROM bible_books ORDER BY bookOrder ASC")
    fun observeAllBooks(): Flow<List<BibleBookEntity>>

    @Query("SELECT * FROM bible_books WHERE testament = :testament ORDER BY bookOrder ASC")
    fun observeBooksByTestament(testament: String): Flow<List<BibleBookEntity>>

    @Query("SELECT DISTINCT chapter FROM bible_verses WHERE bookId = :bookId ORDER BY chapter ASC")
    suspend fun getChaptersForBook(bookId: String): List<Int>

    @Query("SELECT * FROM bible_verses WHERE bookId = :bookId AND chapter = :chapter ORDER BY verse ASC")
    suspend fun getChapterVerses(bookId: String, chapter: Int): List<BibleVerseEntity>

    @Query("SELECT * FROM bible_verses WHERE rowId = :rowId LIMIT 1")
    suspend fun getVerseByRowId(rowId: Long): BibleVerseEntity?

    @Query("SELECT * FROM bible_verses WHERE rowId = ((ABS(:seed) % :totalCount) + 1) LIMIT 1")
    suspend fun getDeterministicVerseByOffset(seed: Long, totalCount: Int): BibleVerseEntity?

    @Query(
        """
        SELECT v.* FROM bible_verses v
        JOIN bible_verses_fts fts ON v.rowId = fts.rowid
        WHERE bible_verses_fts MATCH :ftsQuery
        ORDER BY v.bookOrder ASC, v.chapter ASC, v.verse ASC
        LIMIT 80
        """
    )
    suspend fun searchVersesFts(ftsQuery: String): List<BibleVerseEntity>

    @Query("SELECT * FROM bible_bookmarks ORDER BY createdAtMs DESC")
    fun observeBookmarks(): Flow<List<BibleBookmarkEntity>>

    @Query("SELECT * FROM bible_bookmarks WHERE reference = :reference LIMIT 1")
    suspend fun findBookmarkByRef(reference: String): BibleBookmarkEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertBookmark(bookmark: BibleBookmarkEntity)

    @Query("DELETE FROM bible_bookmarks WHERE reference = :reference")
    suspend fun deleteBookmarkByRef(reference: String)

    @Query("SELECT * FROM bible_notes ORDER BY updatedAtMs DESC")
    fun observeNotes(): Flow<List<BibleNoteEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertNote(note: BibleNoteEntity)

    @Query("DELETE FROM bible_notes WHERE id = :noteId")
    suspend fun deleteNote(noteId: Long)

    @Query("SELECT * FROM bible_reading_history ORDER BY readAtMs DESC LIMIT 25")
    fun observeReadingHistory(): Flow<List<BibleHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReadingHistory(entry: BibleHistoryEntity)

    @Query("DELETE FROM bible_reading_history WHERE id NOT IN (SELECT id FROM bible_reading_history ORDER BY readAtMs DESC LIMIT 25)")
    suspend fun pruneReadingHistory()

    @Transaction
    suspend fun recordHistory(entry: BibleHistoryEntity) {
        insertReadingHistory(entry)
        pruneReadingHistory()
    }
}

@Dao
interface OfflineCacheDao {
    @Query("SELECT * FROM offline_reading_plans ORDER BY id DESC")
    fun observeReadingPlans(): Flow<List<OfflineReadingPlanEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReadingPlans(plans: List<OfflineReadingPlanEntity>)

    @Query("SELECT * FROM offline_reading_plans WHERE id = :planId LIMIT 1")
    suspend fun getReadingPlanById(planId: Int): OfflineReadingPlanEntity?

    @Query("UPDATE offline_reading_plans SET completedDaysCsv = :csv, updatedAtMs = :now WHERE id = :planId")
    suspend fun updatePlanProgress(planId: Int, csv: String, now: Long = System.currentTimeMillis())

    @Query("SELECT * FROM offline_meditations ORDER BY publishedDate DESC, id DESC")
    fun observeMeditations(): Flow<List<OfflineMeditationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMeditations(items: List<OfflineMeditationEntity>)

    @Query("SELECT * FROM cached_json_payloads WHERE cacheKey = :key LIMIT 1")
    suspend fun getCachedJson(key: String): CachedJsonPayloadEntity?

    @Query("SELECT * FROM cached_json_payloads WHERE cacheKey = :key LIMIT 1")
    fun observeCachedJson(key: String): Flow<CachedJsonPayloadEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putCachedJson(entity: CachedJsonPayloadEntity)

    @Query("DELETE FROM cached_json_payloads WHERE isPrivateUserScope = 1")
    suspend fun clearPrivateCaches()
}

@Dao
interface OutboxDao {
    @Query("SELECT * FROM outbox_operations ORDER BY createdAtMs ASC")
    fun observeAll(): Flow<List<OutboxOperationEntity>>

    @Query("SELECT * FROM outbox_operations WHERE status IN ('PENDING', 'FAILED') ORDER BY createdAtMs ASC")
    suspend fun getDispatchableOperations(): List<OutboxOperationEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enqueue(op: OutboxOperationEntity): Long

    @Query("UPDATE outbox_operations SET status = :status, retryCount = :retryCount, lastError = :lastError WHERE id = :id")
    suspend fun updateStatus(id: Long, status: String, retryCount: Int, lastError: String?)

    @Query("DELETE FROM outbox_operations WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM outbox_operations")
    suspend fun clearAll()
}
