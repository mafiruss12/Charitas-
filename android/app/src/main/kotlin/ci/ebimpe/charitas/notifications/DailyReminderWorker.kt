package ci.ebimpe.charitas.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import ci.ebimpe.charitas.CharitasApplication
import ci.ebimpe.charitas.core.security.NotificationPreferences
import kotlinx.coroutines.flow.first
import java.util.Calendar
import java.util.concurrent.TimeUnit

class DailyReminderWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val kind = inputData.getString(KEY_REMINDER_KIND) ?: KIND_VERSE
        val app = applicationContext as? CharitasApplication ?: return Result.success()
        val prefs = app.container.sessionVault.preferencesFlow.first().notifications

        when (kind) {
            KIND_VERSE -> {
                if (!prefs.dailyVerseEnabled) return Result.success()
                val verse = app.container.bibleImporter.getDeterministicOfflineDailyVerse()
                if (verse != null) {
                    CharitasNotificationHelper.showNotification(
                        context = applicationContext,
                        channelId = CharitasNotificationHelper.CHANNEL_VERSE,
                        notificationId = 1001,
                        title = "Verset du jour · ${verse.bookNameFr} ${verse.chapter}:${verse.verse}",
                        body = verse.text
                    )
                }
            }
            KIND_MEDITATION -> {
                if (!prefs.meditationEnabled) return Result.success()
                val cached = app.container.database.offlineCacheDao().observeMeditations().first().firstOrNull()
                val title = cached?.title ?: "Temps de méditation — Église Saint Louis Roi d’Ebimpé"
                val body = cached?.content ?: "Prenez un instant de recueillement avec la Parole de Dieu et portez votre communauté dans la prière."
                CharitasNotificationHelper.showNotification(
                    context = applicationContext,
                    channelId = CharitasNotificationHelper.CHANNEL_MEDITATION,
                    notificationId = 1002,
                    title = title,
                    body = body
                )
            }
        }
        return Result.success()
    }

    companion object {
        const val KEY_REMINDER_KIND = "reminder_kind"
        const val KIND_VERSE = "verse"
        const val KIND_MEDITATION = "meditation"

        private const val WORK_VERSE = "charitas_daily_verse_work"
        private const val WORK_MEDITATION = "charitas_daily_meditation_work"

        /**
         * Schedules daily local reminders via WorkManager. Respects Android Doze/battery
         * optimizations; delivery happens within the system's adaptive maintenance window
         * near the configured target hour.
         */
        fun rescheduleAll(context: Context, prefs: NotificationPreferences) {
            val wm = WorkManager.getInstance(context)

            if (prefs.dailyVerseEnabled) {
                val delayMs = computeInitialDelayMs(prefs.dailyVerseHour, prefs.dailyVerseMinute)
                val req = PeriodicWorkRequestBuilder<DailyReminderWorker>(24, TimeUnit.HOURS)
                    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                    .setInputData(workDataOf(KEY_REMINDER_KIND to KIND_VERSE))
                    .build()
                wm.enqueueUniquePeriodicWork(
                    WORK_VERSE,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    req
                )
            } else {
                wm.cancelUniqueWork(WORK_VERSE)
            }

            if (prefs.meditationEnabled) {
                val delayMs = computeInitialDelayMs(prefs.meditationHour, prefs.meditationMinute)
                val req = PeriodicWorkRequestBuilder<DailyReminderWorker>(24, TimeUnit.HOURS)
                    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                    .setInputData(workDataOf(KEY_REMINDER_KIND to KIND_MEDITATION))
                    .build()
                wm.enqueueUniquePeriodicWork(
                    WORK_MEDITATION,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    req
                )
            } else {
                wm.cancelUniqueWork(WORK_MEDITATION)
            }
        }

        fun computeInitialDelayMs(targetHour: Int, targetMinute: Int): Long {
            val now = Calendar.getInstance()
            val next = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, targetHour.coerceIn(0, 23))
                set(Calendar.MINUTE, targetMinute.coerceIn(0, 59))
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (!next.after(now)) {
                next.add(Calendar.DAY_OF_YEAR, 1)
            }
            return (next.timeInMillis - now.timeInMillis).coerceAtLeast(60_000L)
        }
    }
}
