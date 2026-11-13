package ci.ebimpe.charitas

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import ci.ebimpe.charitas.core.security.AppPreferencesState
import ci.ebimpe.charitas.ui.CharitasRootScaffold
import ci.ebimpe.charitas.ui.components.SplashScreen
import ci.ebimpe.charitas.ui.theme.CharitasTheme
import ci.ebimpe.charitas.update.InAppUpdateChecker
import ci.ebimpe.charitas.update.UpdateCheckResult
import ci.ebimpe.charitas.update.AppVersionInfo
import ci.ebimpe.charitas.ui.components.InAppUpdateDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = (application as CharitasApplication).container

        setContent {
            val prefs by container.sessionVault.preferencesFlow.collectAsState(initial = AppPreferencesState())
            val isOnline by container.repository.isOnline.collectAsState()
            val memberships by container.repository.memberships.collectAsState()
            val activeChurchId by container.repository.activeChurchId.collectAsState()
            var showSplash by remember { mutableStateOf(true) }
            var updateInfo by remember { mutableStateOf<AppVersionInfo?>(null) }

            val activeMembership = memberships.firstOrNull { it.churchId == activeChurchId } ?: memberships.firstOrNull()

            LaunchedEffect(Unit) {
                container.bibleImporter.ensureImported()
                container.repository.restoreSessionIfPresent()
                when (val result = InAppUpdateChecker.check()) {
                    is UpdateCheckResult.Available -> updateInfo = result.info
                    else -> Unit
                }
            }

            // Automatically flush offline Outbox queue whenever network returns
            LaunchedEffect(isOnline) {
                if (isOnline) {
                    container.repository.flushOutbox()
                }
            }

            CharitasTheme(
                themeMode = prefs.themeMode,
                brandPrimaryHex = activeMembership?.churchPrimaryColor,
                brandAccentHex = activeMembership?.churchAccentColor
            ) {
                if (showSplash) {
                    SplashScreen(onFinished = { showSplash = false })
                } else {
                    CharitasRootScaffold(container = container)
                    updateInfo?.let { info ->
                        InAppUpdateDialog(
                            info = info,
                            onDismiss = { updateInfo = null },
                            onUpdate = {
                                val ctx = this@MainActivity
                                if (InAppUpdateChecker.enqueueApkDownload(ctx, info) == null) {
                                    InAppUpdateChecker.openPageOrApk(ctx, info)
                                }
                                if (!info.forceUpdate) updateInfo = null
                            }
                        )
                    }
                }
            }
        }
    }
}
