package ci.ebimpe.charitas.data.bible

import android.content.Context
import ci.ebimpe.charitas.core.database.BibleBookEntity
import ci.ebimpe.charitas.core.database.BibleDao
import ci.ebimpe.charitas.core.database.BibleVerseEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.Calendar

class BibleAssetImporter(
    private val context: Context,
    private val bibleDao: BibleDao
) {
    private val importMutex = Mutex()

    suspend fun ensureImported() = importMutex.withLock {
        withContext(Dispatchers.IO) {
            if (bibleDao.getBooksCount() >= 73 && bibleDao.getVersesCount() > 30000) {
                return@withContext
            }

            val jsonText = context.assets.open("bible_crampon_1923.json")
                .bufferedReader(Charsets.UTF_8)
                .use { it.readText() }

            val root = JSONObject(jsonText)
            val booksArray = root.getJSONArray("books")
            val bookEntities = ArrayList<BibleBookEntity>(booksArray.length())
            val verseBatch = ArrayList<BibleVerseEntity>(2500)

            for (i in 0 until booksArray.length()) {
                val b = booksArray.getJSONObject(i)
                val bookOrder = b.getInt("o")
                val bookId = b.getString("id")
                val bookNameFr = b.getString("n")
                val testament = b.getString("t")
                val chaptersArray = b.getJSONArray("ch")

                bookEntities.add(
                    BibleBookEntity(
                        id = bookId,
                        bookOrder = bookOrder,
                        nameFr = bookNameFr,
                        testament = testament,
                        chaptersCount = chaptersArray.length()
                    )
                )

                for (cIdx in 0 until chaptersArray.length()) {
                    val cObj = chaptersArray.getJSONObject(cIdx)
                    val chapterNum = cObj.getInt("c")
                    val versesArray = cObj.getJSONArray("v")
                    for (vIdx in 0 until versesArray.length()) {
                        val tuple = versesArray.getJSONArray(vIdx)
                        verseBatch.add(
                            BibleVerseEntity(
                                bookId = bookId,
                                bookOrder = bookOrder,
                                bookNameFr = bookNameFr,
                                testament = testament,
                                chapter = chapterNum,
                                verse = tuple.getInt(0),
                                text = tuple.getString(1)
                            )
                        )
                        if (verseBatch.size >= 2000) {
                            bibleDao.insertVerses(verseBatch.toList())
                            verseBatch.clear()
                        }
                    }
                }
            }

            bibleDao.insertBooks(bookEntities)
            if (verseBatch.isNotEmpty()) {
                bibleDao.insertVerses(verseBatch.toList())
            }
        }
    }

    suspend fun getDeterministicOfflineDailyVerse(): BibleVerseEntity? {
        ensureImported()
        val total = bibleDao.getVersesCount()
        if (total <= 0) return null
        val cal = Calendar.getInstance()
        val daySeed = (cal.get(Calendar.YEAR) * 366L) + cal.get(Calendar.DAY_OF_YEAR)
        return bibleDao.getDeterministicVerseByOffset(daySeed * 37L, total)
    }
}
