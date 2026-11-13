package ci.ebimpe.charitas.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import ci.ebimpe.charitas.MainActivity
import ci.ebimpe.charitas.R

object CharitasNotificationHelper {
    const val CHANNEL_VERSE = "charitas_daily_verse"
    const val CHANNEL_MEDITATION = "charitas_meditation"
    const val CHANNEL_EVENTS = "charitas_events"
    const val CHANNEL_COMMUNITY = "charitas_community"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channels = listOf(
            NotificationChannel(
                CHANNEL_VERSE,
                "Verset du jour (Hors connexion)",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Rappel quotidien du verset biblique CHARITAS."
            },
            NotificationChannel(
                CHANNEL_MEDITATION,
                "Méditations quotidiennes",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Rappel de prière et méditation paroissiale."
            },
            NotificationChannel(
                CHANNEL_EVENTS,
                "Cultes & Événements",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alertes des cultes, messes et événements de l’Église Saint Louis Roi d’Ebimpé."
            },
            NotificationChannel(
                CHANNEL_COMMUNITY,
                "Vie communautaire & Messages",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Nouvelles publications, prières et messages reçus lors de la synchronisation."
            }
        )
        manager.createNotificationChannels(channels)
    }

    fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun showNotification(
        context: Context,
        channelId: String,
        notificationId: Int,
        title: String,
        body: String
    ) {
        if (!hasNotificationPermission(context)) return
        ensureChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_charitas_crest)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        }
    }
}
