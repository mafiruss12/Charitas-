package ci.ebimpe.charitas.ui.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.BuildConfig
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
import ci.ebimpe.charitas.update.InAppUpdateChecker
import ci.ebimpe.charitas.update.UpdateCheckResult
import ci.ebimpe.charitas.update.AppVersionInfo
import ci.ebimpe.charitas.update.InAppUpdateDialog
import ci.ebimpe.charitas.core.model.CharitasRoles
import ci.ebimpe.charitas.core.security.AppPreferencesState
import ci.ebimpe.charitas.core.security.AppThemeMode
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.notifications.CharitasNotificationHelper
import ci.ebimpe.charitas.notifications.DailyReminderWorker
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
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
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            FilterChip(selected = authMode == 0, onClick = { authMode = 0 }, label = { Text("Se connecter", maxLines = 1, softWrap = false) })
                            FilterChip(selected = authMode == 1, onClick = { authMode = 1 }, label = { Text("Créer un compte", maxLines = 1, softWrap = false) })
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

                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = {
                                scope.launch {
                                    feedback = when (val r = container.repository.updateProfile(editName, editPhone.ifBlank { null }, editCity.ifBlank { null }, editBio.ifBlank { null })) {
                                        is RepoResult.Success -> "Profil mis à jour."
                                        is RepoResult.Error -> r.message
                                    }
                                }
                            }) { Text("Enregistrer", maxLines = 1, softWrap = false) }
                            OutlinedButton(onClick = onOpenAdmin) { Text("Espace Admin", maxLines = 1, softWrap = false) }
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
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(
                            AppThemeMode.SYSTEM to "Système",
                            AppThemeMode.LIGHT to "Clair",
                            AppThemeMode.DARK to "Sombre"
                        ).forEach { (mode, label) ->
                            FilterChip(
                                selected = prefs.themeMode == mode,
                                onClick = { scope.launch { container.sessionVault.updateThemeMode(mode) } },
                                label = { Text(label, maxLines = 1, softWrap = false) }
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
            val parishLeaders = listOf(
                Triple("Ako Vince", "Responsable de la Paroisse", "0747160619" to "07 47 16 06 19"),
                Triple("Emmanuel Tanoh", "Responsable de la Paroisse", "0747417231" to "07 47 41 72 31"),
                Triple("Some Séraphin", "Responsable de la Paroisse", "0505627855" to "05 05 62 78 55")
            )
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, CharitasGold.copy(alpha = 0.45f))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.logo_saint_louis_ebimpe),
                            contentDescription = "Logo Paroisse Saint Louis Roi d’Ebimpé",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .border(1.5.dp, CharitasGold, CircleShape)
                        )
                        Column {
                            Text(
                                text = "À propos & Personnes à contacter",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = CharitasRoyalNavy
                            )
                            Text(
                                text = "CHARITAS · Église Saint Louis Roi d’Ebimpé",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Text(
                        text = "Responsables de l’église et de l’action caritative CHARITAS à Ebimpé :",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    parishLeaders.forEach { (leaderName, leaderRole, phonePair) ->
                        val (rawPhone, formattedPhone) = phonePair
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(CharitasRoyalNavy.copy(alpha = 0.06f))
                                .clickable {
                                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$rawPhone")))
                                }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    Icons.Rounded.Phone,
                                    contentDescription = null,
                                    tint = CharitasRoyalNavy,
                                    modifier = Modifier.size(18.dp)
                                )
                                Column {
                                    Text(leaderName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Text(leaderRole, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Surface(shape = RoundedCornerShape(50), color = CharitasGold) {
                                Text(
                                    text = formattedPhone,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = CharitasDeepNavy,
                                    maxLines = 1,
                                    softWrap = false,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Application", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Version installée : ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                    Text(
                        text = "Powered by Kevin Akoh de Kevin Tech Pro",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = CharitasRoyalNavy
                    )
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

        item {
            Text(
                text = "Powered by Kevin Akoh de Kevin Tech Pro",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = CharitasRoyalNavy,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            )
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
