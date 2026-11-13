package ci.ebimpe.charitas.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        BibleBookEntity::class,
        BibleVerseEntity::class,
        BibleVerseFts::class,
        BibleBookmarkEntity::class,
        BibleNoteEntity::class,
        BibleHistoryEntity::class,
        OfflineReadingPlanEntity::class,
        OfflineMeditationEntity::class,
        CachedJsonPayloadEntity::class,
        OutboxOperationEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class CharitasDatabase : RoomDatabase() {
    abstract fun bibleDao(): BibleDao
    abstract fun offlineCacheDao(): OfflineCacheDao
    abstract fun outboxDao(): OutboxDao

    companion object {
        @Volatile
        private var instance: CharitasDatabase? = null

        fun getInstance(context: Context): CharitasDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    CharitasDatabase::class.java,
                    "charitas_offline_db"
                ).build().also { instance = it }
            }
        }
    }
}
