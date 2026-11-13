package ci.ebimpe.charitas

import android.content.Context
import ci.ebimpe.charitas.core.database.CharitasDatabase
import ci.ebimpe.charitas.core.network.CharitasApiService
import ci.ebimpe.charitas.core.network.CharitasWebSocketClient
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.core.network.NetworkMonitor
import ci.ebimpe.charitas.core.security.SessionVault
import ci.ebimpe.charitas.data.bible.BibleAssetImporter
import ci.ebimpe.charitas.data.sync.CharitasRepository

class CharitasAppContainer(context: Context) {
    val sessionVault = SessionVault(context)
    val database = CharitasDatabase.getInstance(context)
    val networkMonitor = NetworkMonitor(context)

    private val okHttpClient = NetworkClientFactory.buildOkHttpClient(
        tokenProvider = sessionVault,
        enableLogging = BuildConfig.DEBUG
    )

    val apiService: CharitasApiService = NetworkClientFactory.buildApiService(
        baseUrl = BuildConfig.API_BASE_URL,
        okHttpClient = okHttpClient
    )

    val webSocketClient = CharitasWebSocketClient(
        baseUrl = BuildConfig.API_BASE_URL,
        okHttpClient = okHttpClient
    )

    val bibleImporter = BibleAssetImporter(
        context = context,
        bibleDao = database.bibleDao()
    )

    val repository = CharitasRepository(
        context = context,
        api = apiService,
        db = database,
        sessionVault = sessionVault,
        networkMonitor = networkMonitor,
        webSocketClient = webSocketClient
    )
}
