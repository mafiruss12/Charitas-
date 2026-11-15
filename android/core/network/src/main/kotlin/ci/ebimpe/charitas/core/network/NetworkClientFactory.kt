package ci.ebimpe.charitas.core.network

import ci.ebimpe.charitas.core.security.TokenProvider
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiFormatException(message: String) : IOException(message)

object NetworkClientFactory {

    val jsonSerializer: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    fun isAllowedApiBaseUrl(url: String): Boolean {
        val trimmed = url.trim().lowercase()
        return trimmed.startsWith("https://") ||
            trimmed.startsWith("http://localhost") ||
            trimmed.startsWith("http://127.0.0.1") ||
            trimmed.startsWith("http://10.0.2.2")
    }

    fun buildOkHttpClient(
        tokenProvider: TokenProvider,
        enableLogging: Boolean
    ): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val token = tokenProvider.getToken()
                val reqBuilder = original.newBuilder()
                    .header("Accept", "application/json")
                if (!token.isNullOrBlank()) {
                    reqBuilder.header("Authorization", "Bearer $token")
                }
                val response = chain.proceed(reqBuilder.build())
                val contentType = response.header("Content-Type")?.lowercase().orEmpty()
                val body = response.body
                if (body != null && body.contentLength() != 0L) {
                    val peeked = runCatching { response.peekBody(256).string().trimStart() }.getOrDefault("")
                    val looksHtml = peeked.startsWith("<") ||
                        peeked.startsWith("<!doctype", ignoreCase = true) ||
                        contentType.contains("text/html")
                    val nonJson2xx = response.isSuccessful &&
                        contentType.isNotBlank() &&
                        !contentType.contains("json")
                    if (looksHtml || nonJson2xx) {
                        response.close()
                        throw ApiFormatException(
                            "Serveur API temporairement indisponible ou mal configuré (réponse non-JSON reçue)."
                        )
                    }
                }
                response
            }

        if (enableLogging) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            builder.addInterceptor(logging)
        }
        return builder.build()
    }

    fun buildApiService(
        baseUrl: String,
        okHttpClient: OkHttpClient
    ): CharitasApiService {
        val trimmed = baseUrl.trim()
        require(isAllowedApiBaseUrl(trimmed)) {
            "L'URL du serveur API doit utiliser HTTPS (hors émulateur local)."
        }
        val normalizedBaseUrl = if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        return Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(jsonSerializer.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(CharitasApiService::class.java)
    }

    fun parseErrorMessage(response: Response<*>): String {
        val raw = runCatching { response.errorBody()?.string() }.getOrNull().orEmpty().trim()
        if (raw.isBlank() || raw.startsWith("<")) {
            return "Service serveur temporairement indisponible (${response.code()})."
        }
        val jsonError = runCatching {
            val obj = jsonSerializer.parseToJsonElement(raw).jsonObject
            obj["error"]?.jsonPrimitive?.contentOrNull
                ?: obj["message"]?.jsonPrimitive?.contentOrNull
        }.getOrNull()
        return jsonError?.takeIf { it.isNotBlank() } ?: "Requête refusée (${response.code()})."
    }
}
