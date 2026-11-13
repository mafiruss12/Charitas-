package ci.ebimpe.charitas.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import ci.ebimpe.charitas.CharitasApplication

class OutboxSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? CharitasApplication ?: return Result.failure()
        val repo = app.container.repository
        val outcome = repo.flushOutbox()
        return if (outcome.hasRetryableFailure) Result.retry() else Result.success()
    }

    companion object {
        private const val UNIQUE_OUTBOX_WORK = "charitas_outbox_sync"

        fun scheduleSyncWhenConnected(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val req = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(UNIQUE_OUTBOX_WORK, ExistingWorkPolicy.KEEP, req)
        }
    }
}
