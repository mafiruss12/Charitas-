package ci.ebimpe.charitas.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.core.model.OutboxUiState
import ci.ebimpe.charitas.ui.theme.CharitasAmber
import ci.ebimpe.charitas.ui.theme.CharitasError
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy

@Composable
fun OfflineStatusBanner(
    isOnline: Boolean,
    outboxState: OutboxUiState,
    onRetrySync: () -> Unit
) {
    val showBanner = !isOnline || outboxState.pendingCount > 0 || outboxState.failedCount > 0
    AnimatedVisibility(visible = showBanner) {
        val bgColor = when {
            outboxState.failedCount > 0 -> CharitasError
            !isOnline -> CharitasAmber
            else -> CharitasRoyalNavy
        }
        val icon = when {
            outboxState.failedCount > 0 -> Icons.Rounded.WarningAmber
            !isOnline -> Icons.Rounded.CloudOff
            else -> Icons.Rounded.Sync
        }
        val text = when {
            outboxState.failedCount > 0 ->
                "${outboxState.failedCount} action(s) refusée(s) ou en conflit (non confirmée(s))."
            !isOnline && outboxState.pendingCount > 0 ->
                "Hors connexion · Bible & cache disponibles · ${outboxState.pendingCount} action(s) en attente d'envoi"
            !isOnline ->
                "Mode hors connexion · Bible Crampon 1923 & données locales actives"
            else ->
                "Synchronisation en cours (${outboxState.pendingCount} en attente)…"
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(bgColor)
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = text,
                    color = Color.White,
                    style = MaterialTheme.typography.labelMedium
                )
            }
            if (isOnline && (outboxState.pendingCount > 0 || outboxState.failedCount > 0)) {
                TextButton(onClick = onRetrySync) {
                    Text(
                        text = "Réessayer",
                        color = Color.White,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }
    }
}
