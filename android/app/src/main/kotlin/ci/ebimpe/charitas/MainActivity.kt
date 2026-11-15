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
import ci.ebimpe.charitas.update.InAppUpdateDialog

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
            val currentUser by container.repository.currentUser.collectAsState()
            var showSplash by remember { mutableStateOf(true) }
            var postLoginSplash by remember { mutableStateOf(false) }
            var sessionBootDone by remember { mutableStateOf(false) }
            var hadAuthenticatedUser by remember { mutableStateOf(false) }
            var updateInfo by remember { mutableStateOf<AppVersionInfo?>(null) }

            val activeMembership = memberships.firstOrNull { it.churchId == activeChurchId } ?: memberships.firstOrNull()

            LaunchedEffect(Unit) {
                container.bibleImporter.ensureImported()
                container.repository.restoreSessionIfPresent()
                hadAuthenticatedUser = container.repository.currentUser.value != null
                sessionBootDone = true
                when (val result = InAppUpdateChecker.check()) {
                    is UpdateCheckResult.Available -> updateInfo = result.info
                    else -> Unit
                }
            }

            LaunchedEffect(currentUser, sessionBootDone) {
                if (!sessionBootDone) return@LaunchedEffect
                if (!hadAuthenticatedUser && currentUser != null) {
                    postLoginSplash = true
                }
                hadAuthenticatedUser = currentUser != null
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
                    SplashScreen(isPostLogin = false, onFinished = { showSplash = false })
                } else if (postLoginSplash) {
                    SplashScreen(
                        isPostLogin = true,
                        userName = currentUser?.fullName,
                        onFinished = { postLoginSplash = false }
                    )
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
