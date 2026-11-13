package ci.ebimpe.charitas.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.BuildConfig
import ci.ebimpe.charitas.update.InAppUpdateChecker
import ci.ebimpe.charitas.update.UpdateCheckResult
import ci.ebimpe.charitas.update.AppVersionInfo
import ci.ebimpe.charitas.ui.components.InAppUpdateDialog
import ci.ebimpe.charitas.core.model.CharitasRoles
import ci.ebimpe.charitas.core.security.AppPreferencesState
import ci.ebimpe.charitas.core.security.AppThemeMode
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.notifications.CharitasNotificationHelper
import ci.ebimpe.charitas.notifications.DailyReminderWorker
import kotlinx.coroutines.launch

@Composable
fun SettingsAuthProfileScreen(
    container: CharitasAppContainer,
    onOpenAdmin: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val membership = container.repository.getCurrentMembership()
    val prefs by container.sessionVault.preferencesFlow.collectAsState(initial = AppPreferencesState())
    val outboxState by container.repository.outboxStateFlow.collectAsState(initial = ci.ebimpe.charitas.core.model.OutboxUiState())

    var authMode by remember { mutableIntStateOf(0) } // 0=Login, 1=Register
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var invitationCode by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf<String?>(null) }
    var updateInfo by remember { mutableStateOf<AppVersionInfo?>(null) }
    var checkingUpdate by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    var showForgotDialog by remember { mutableStateOf(false) }
    var hasNotifPerm by remember { mutableStateOf(CharitasNotificationHelper.hasNotificationPermission(context)) }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasNotifPerm = granted
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        if (currentUser == null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = if (authMode == 0) "Connexion membre CHARITAS" else "Rejoindre la paroisse",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = authMode == 0, onClick = { authMode = 0 }, label = { Text("Se connecter") })
                            FilterChip(selected = authMode == 1, onClick = { authMode = 1 }, label = { Text("Créer un compte") })
                        }
                        if (authMode == 1) {
                            OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Nom complet*") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Téléphone") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = invitationCode, onValueChange = { invitationCode = it }, label = { Text("Code d'invitation (optionnel)") }, modifier = Modifier.fillMaxWidth())
                        }
                        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email*") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Mot de passe*") },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            enabled = !busy && email.isNotBlank() && password.length >= 6,
                            onClick = {
                                scope.launch {
                                    busy = true
                                    val res = if (authMode == 0) {
                                        container.repository.login(email, password)
                                    } else {
                                        container.repository.register(fullName, email, password, phone, invitationCode, churchId)
                                    }
                                    feedback = when (res) {
                                        is RepoResult.Success -> "Bienvenue ${res.data.fullName} !"
                                        is RepoResult.Error -> res.message
                                    }
                                    busy = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (authMode == 0) "Connexion sécurisée" else "Finaliser l'inscription")
                        }
                        if (authMode == 0) {
                            TextButton(onClick = { showForgotDialog = true }) {
                                Text("Mot de passe oublié ?")
                            }
                        }
                    }
                }
            }
        } else {
            item {
                val user = currentUser!!
                var editName by remember(user.id) { mutableStateOf(user.fullName) }
                var editPhone by remember(user.id) { mutableStateOf(user.phone ?: "") }
                var editCity by remember(user.id) { mutableStateOf(user.city ?: "") }
                var editBio by remember(user.id) { mutableStateOf(user.bio ?: "") }

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(user.fullName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("${user.email} · ${CharitasRoles.labels[membership?.role] ?: "Membre"}", style = MaterialTheme.typography.bodyMedium)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(value = editName, onValueChange = { editName = it }, label = { Text("Nom complet") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = editPhone, onValueChange = { editPhone = it }, label = { Text("Téléphone") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = editCity, onValueChange = { editCity = it }, label = { Text("Ville / Quartier") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = editBio, onValueChange = { editBio = it }, label = { Text("Présentation") }, modifier = Modifier.fillMaxWidth())

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = {
                                scope.launch {
                                    feedback = when (val r = container.repository.updateProfile(editName, editPhone.ifBlank { null }, editCity.ifBlank { null }, editBio.ifBlank { null })) {
                                        is RepoResult.Success -> "Profil mis à jour."
                                        is RepoResult.Error -> r.message
                                    }
                                }
                            }) { Text("Enregistrer") }
                            OutlinedButton(onClick = onOpenAdmin) { Text("Espace Admin") }
                        }
                        OutlinedButton(
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            onClick = {
                                scope.launch {
                                    container.repository.logout()
                                    feedback = "Session déconnectée et cache privé purgé de l'appareil."
                                }
                            }
                        ) { Text("Se déconnecter (effacer le cache privé)") }
                    }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Apparence", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            AppThemeMode.SYSTEM to "Système",
                            AppThemeMode.LIGHT to "Clair",
                            AppThemeMode.DARK to "Sombre"
                        ).forEach { (mode, label) ->
                            FilterChip(
                                selected = prefs.themeMode == mode,
                                onClick = { scope.launch { container.sessionVault.updateThemeMode(mode) } },
                                label = { Text(label) }
                            )
                        }
                    }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Rappels spirituels locaux (Hors connexion)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                    if (!hasNotifPerm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        Button(onClick = { permLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }) {
                            Text("Autoriser les notifications Android")
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Verset quotidien (~${String.format("%02d:%02d", prefs.notifications.dailyVerseHour, prefs.notifications.dailyVerseMinute)})")
                            Text("Utilise la Bible Crampon 1923 locale.", style = MaterialTheme.typography.labelMedium)
                        }
                        Switch(
                            checked = prefs.notifications.dailyVerseEnabled,
                            onCheckedChange = { enabled ->
                                scope.launch {
                                    val next = prefs.notifications.copy(dailyVerseEnabled = enabled)
                                    container.sessionVault.updateNotificationPreferences(next)
                                    DailyReminderWorker.rescheduleAll(context, next)
                                }
                            }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Méditation du soir (~${String.format("%02d:%02d", prefs.notifications.meditationHour, prefs.notifications.meditationMinute)})")
                            Text("Planification adaptative Android WorkManager (respecte le mode Doze).", style = MaterialTheme.typography.labelMedium)
                        }
                        Switch(
                            checked = prefs.notifications.meditationEnabled,
                            onCheckedChange = { enabled ->
                                scope.launch {
                                    val next = prefs.notifications.copy(meditationEnabled = enabled)
                                    container.sessionVault.updateNotificationPreferences(next)
                                    DailyReminderWorker.rescheduleAll(context, next)
                                }
                            }
                        )
                    }

                    OutlinedButton(onClick = {
                        CharitasNotificationHelper.showNotification(
                            context = context,
                            channelId = CharitasNotificationHelper.CHANNEL_VERSE,
                            notificationId = 9001,
                            title = "CHARITAS — Église Saint Louis Roi d’Ebimpé",
                            body = "Notification locale active : vos rappels quotidiens fonctionnent même hors connexion."
                        )
                    }) { Text("Tester une notification locale") }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Synchronisation hors ligne (Outbox)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("En attente : ${outboxState.pendingCount} · En échec/conflit : ${outboxState.failedCount}")
                    Button(onClick = {
                        scope.launch {
                            val outcome = container.repository.flushOutbox()
                            feedback = "Synchronisation terminée : ${outcome.syncedCount} envoyé(s), ${outcome.failedCount} échec(s)."
                        }
                    }) { Text("Forcer la synchronisation maintenant") }
                }
            }
        }


        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Application", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Version installée : ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                    Button(
                        enabled = !checkingUpdate,
                        onClick = {
                            checkingUpdate = true
                            scope.launch {
                                when (val r = InAppUpdateChecker.check()) {
                                    is UpdateCheckResult.Available -> {
                                        updateInfo = r.info
                                        feedback = null
                                    }
                                    is UpdateCheckResult.UpToDate ->
                                        feedback = "Vous avez déjà la dernière version (${BuildConfig.VERSION_NAME})."
                                    is UpdateCheckResult.Error ->
                                        feedback = r.message
                                }
                                checkingUpdate = false
                            }
                        }
                    ) {
                        Text(if (checkingUpdate) "Vérification…" else "Vérifier les mises à jour")
                    }
                }
            }
        }

        feedback?.let { msg ->
            item { Text(msg, color = MaterialTheme.colorScheme.primary) }
        }
    }

    updateInfo?.let { info ->
        val ctx = LocalContext.current
        InAppUpdateDialog(
            info = info,
            onDismiss = { updateInfo = null },
            onUpdate = {
                if (InAppUpdateChecker.enqueueApkDownload(ctx, info) == null) {
                    InAppUpdateChecker.openPageOrApk(ctx, info)
                }
                if (!info.forceUpdate) updateInfo = null
            }
        )
    }

    if (showForgotDialog) {
        var resetEmail by remember { mutableStateOf(email) }
        var resetToken by remember { mutableStateOf("") }
        var newPass by remember { mutableStateOf("") }
        var step2 by remember { mutableStateOf(false) }
        var note by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showForgotDialog = false },
            title = { Text("Réinitialiser le mot de passe") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!step2) {
                        OutlinedTextField(value = resetEmail, onValueChange = { resetEmail = it }, label = { Text("Email du compte") })
                    } else {
                        OutlinedTextField(value = resetToken, onValueChange = { resetToken = it }, label = { Text("Code / Jeton reçu") })
                        OutlinedTextField(
                            value = newPass,
                            onValueChange = { newPass = it },
                            label = { Text("Nouveau mot de passe (min 6 car.)") },
                            visualTransformation = PasswordVisualTransformation()
                        )
                    }
                    note?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                }
            },
            confirmButton = {
                Button(onClick = {
                    scope.launch {
                        if (!step2) {
                            when (val r = container.repository.forgotPassword(resetEmail)) {
                                is RepoResult.Success -> {
                                    note = r.data.previewResetCode?.let { "Code de prévisualisation : $it" } ?: r.data.message
                                    step2 = true
                                }
                                is RepoResult.Error -> note = r.message
                            }
                        } else {
                            when (val r = container.repository.resetPassword(resetToken, newPass)) {
                                is RepoResult.Success -> {
                                    feedback = r.data.message
                                    showForgotDialog = false
                                }
                                is RepoResult.Error -> note = r.message
                            }
                        }
                    }
                }) { Text(if (!step2) "Envoyer le code" else "Valider") }
            },
            dismissButton = {
                TextButton(onClick = { showForgotDialog = false }) { Text("Fermer") }
            }
        )
    }
}
