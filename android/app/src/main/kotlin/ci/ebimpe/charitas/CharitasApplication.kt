package ci.ebimpe.charitas

import android.app.Application
import ci.ebimpe.charitas.data.sync.OutboxSyncWorker
import ci.ebimpe.charitas.notifications.CharitasNotificationHelper
import ci.ebimpe.charitas.notifications.DailyReminderWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class CharitasApplication : Application() {
    lateinit var container: CharitasAppContainer
        private set

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        container = CharitasAppContainer(this)
        CharitasNotificationHelper.ensureChannels(this)

        // Pre-populate full 73-book Public Domain Crampon 1923 Bible silently for instant offline search
        appScope.launch {
            container.bibleImporter.ensureImported()
            val prefs = container.sessionVault.preferencesFlow.first()
            DailyReminderWorker.rescheduleAll(this@CharitasApplication, prefs.notifications)
        }

        // Flush queued Outbox mutations automatically whenever connectivity transitions to Online
        appScope.launch {
            container.networkMonitor.isOnline.collectLatest { online ->
                if (online) {
                    container.repository.flushOutbox()
                } else {
                    OutboxSyncWorker.scheduleSyncWhenConnected(this@CharitasApplication)
                }
            }
        }
    }
}
