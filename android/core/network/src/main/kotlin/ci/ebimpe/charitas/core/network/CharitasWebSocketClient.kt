package ci.ebimpe.charitas.core.network

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

data class WsIncomingEvent(
    val event: String,
    val rawPayloadJson: String
)

class CharitasWebSocketClient(
    private val baseUrl: String,
    private val okHttpClient: OkHttpClient
) {
    private var webSocket: WebSocket? = null
    private var subscribedChurchId: Int? = null

    private val _events = MutableSharedFlow<WsIncomingEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<WsIncomingEvent> = _events.asSharedFlow()

    fun connect(token: String, churchId: Int) {
        disconnect()
        subscribedChurchId = churchId

        val wsSchemeUrl = baseUrl
            .trimEnd('/')
            .replaceFirst("https://", "wss://")
            .replaceFirst("http://", "ws://") + "/ws?token=$token"

        val request = Request.Builder().url(wsSchemeUrl).build()
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                subscribedChurchId?.let { cid ->
                    val subscribeMsg = JSONObject().apply {
                        put("event", "subscribe:church")
                        put("payload", JSONObject().put("churchId", cid))
                    }.toString()
                    webSocket.send(subscribeMsg)
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val obj = JSONObject(text)
                    val evName = obj.optString("event")
                    val payloadStr = obj.opt("payload")?.toString() ?: "{}"
                    if (evName.isNotBlank()) {
                        _events.tryEmit(WsIncomingEvent(event = evName, rawPayloadJson = payloadStr))
                    }
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Client closed")
        webSocket = null
        subscribedChurchId = null
    }
}
