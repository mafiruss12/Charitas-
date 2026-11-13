package ci.ebimpe.charitas.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.ChatMessageDto
import ci.ebimpe.charitas.core.model.ConversationDto
import ci.ebimpe.charitas.core.model.NotificationDto
import ci.ebimpe.charitas.core.model.OutboxOperationType
import ci.ebimpe.charitas.core.model.OutboxStatus
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.core.network.SendMessageRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

@Composable
fun MessagingScreen(
    container: CharitasAppContainer,
    onOpenAuth: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()
    val outboxOps by container.database.outboxDao().observeAll().collectAsState(initial = emptyList())
    val json = NetworkClientFactory.jsonSerializer

    if (currentUser == null || !container.repository.hasPermission(CharitasPermissions.MESSAGING_ACCESS)) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Messagerie fraternelle & Notifications", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Connectez-vous avec un compte membre de l’Église Saint Louis Roi d’Ebimpé pour accéder aux discussions et notifications communautaires.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Button(onClick = onOpenAuth) { Text("Se connecter") }
            }
        }
        return
    }

    var tabIndex by remember { mutableIntStateOf(0) }
    var conversations by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var activeConversation by remember { mutableStateOf<ConversationDto?>(null) }
    var messages by remember { mutableStateOf<List<ChatMessageDto>>(emptyList()) }
    var notifications by remember { mutableStateOf<List<NotificationDto>>(emptyList()) }
    var messageDraft by remember { mutableStateOf("") }
    var statusText by remember { mutableStateOf<String?>(null) }

    suspend fun loadConversations() {
        when (val res = container.repository.loadConversations(churchId)) {
            is RepoResult.Success -> conversations = res.data.conversations
            is RepoResult.Error -> statusText = res.message
        }
    }

    suspend fun loadMessages(convId: Int) {
        when (val res = container.repository.loadMessages(churchId, convId)) {
            is RepoResult.Success -> messages = res.data.messages
            is RepoResult.Error -> statusText = res.message
        }
    }

    suspend fun loadNotifs() {
        when (val res = container.repository.loadNotifications(churchId)) {
            is RepoResult.Success -> notifications = res.data.notifications
            is RepoResult.Error -> statusText = res.message
        }
    }

    LaunchedEffect(churchId, isOnline) {
        loadConversations()
        loadNotifs()
    }

    LaunchedEffect(activeConversation?.id, isOnline) {
        activeConversation?.let { loadMessages(it.id) }
    }

    // Listen to live WebSocket updates from /ws
    LaunchedEffect(churchId) {
        container.webSocketClient.events.collect { ev ->
            if (ev.event == "message:new") {
                activeConversation?.let { loadMessages(it.id) }
                loadConversations()
            } else if (ev.event == "notification:new") {
                loadNotifs()
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tabIndex) {
            Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("Discussions") })
            Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Notifications (${notifications.count { !it.isRead }})") })
        }

        if (tabIndex == 0) {
            val conv = activeConversation
            if (conv == null) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (conversations.isEmpty()) {
                        item { Text("Aucune conversation active pour le moment.") }
                    }
                    items(conversations, key = { it.id }) { c ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { activeConversation = c }
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(c.displayTitle ?: c.title ?: "Discussion #${c.id}", fontWeight = FontWeight.Bold)
                                Text(
                                    c.participants.joinToString(", ") { it.fullName }.ifBlank { c.type },
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                    statusText?.let { item { Text(it, style = MaterialTheme.typography.labelMedium) } }
                }
            } else {
                val pendingMessages = remember(outboxOps, conv.id) {
                    outboxOps.filter {
                        it.operationType == OutboxOperationType.SEND_MESSAGE.name && it.targetId == conv.id.toString()
                    }
                }
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { activeConversation = null }) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Retour")
                        }
                        Text(
                            conv.displayTitle ?: conv.title ?: "Conversation",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    LazyColumn(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            val isMine = msg.senderUserId == currentUser?.id
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isMine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text(msg.senderName.ifBlank { "Membre" }, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                    Text(msg.content)
                                }
                            }
                        }
                        items(pendingMessages, key = { "pending_msg_${it.id}" }) { op ->
                            val body = runCatching { json.decodeFromString<SendMessageRequest>(op.payloadJson) }.getOrNull()
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.secondaryContainer,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.HourglassTop, contentDescription = null)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = if (op.status == OutboxStatus.FAILED.name) {
                                                "Échec d'envoi : ${op.lastError ?: "Rejeté"}"
                                            } else {
                                                "En attente d'envoi — non confirmé par le serveur"
                                            },
                                            style = MaterialTheme.typography.labelMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Text(body?.content ?: "")
                                }
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = messageDraft,
                            onValueChange = { messageDraft = it },
                            label = { Text("Écrire un message…") },
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        IconButton(
                            enabled = messageDraft.isNotBlank(),
                            onClick = {
                                val textToSend = messageDraft.trim()
                                messageDraft = ""
                                scope.launch {
                                    container.repository.enqueueMutation(
                                        churchId = churchId,
                                        type = OutboxOperationType.SEND_MESSAGE,
                                        targetId = conv.id.toString(),
                                        payloadJson = json.encodeToString(SendMessageRequest(textToSend))
                                    )
                                    loadMessages(conv.id)
                                }
                            }
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.Send, contentDescription = "Envoyer")
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Centre de notifications", style = MaterialTheme.typography.titleMedium)
                        TextButton(onClick = {
                            scope.launch {
                                runCatching { container.apiService.markAllNotificationsRead(churchId) }
                                loadNotifs()
                            }
                        }) {
                            Icon(Icons.Rounded.DoneAll, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Tout lire")
                        }
                    }
                }
                items(notifications, key = { it.id }) { n ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Notifications, contentDescription = null)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(n.title, fontWeight = if (!n.isRead) FontWeight.Bold else FontWeight.Medium)
                                Text(n.body, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
    }
}
