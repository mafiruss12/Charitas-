package ci.ebimpe.charitas.core.network

import ci.ebimpe.charitas.core.security.TokenProvider
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

object NetworkClientFactory {

    val jsonSerializer: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
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
                chain.proceed(reqBuilder.build())
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
        val normalizedBaseUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(jsonSerializer.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(CharitasApiService::class.java)
    }

    fun parseErrorMessage(response: Response<*>): String {
        val raw = runCatching { response.errorBody()?.string() }.getOrNull().orEmpty()
        return if (raw.contains("\"error\"")) {
            raw.substringAfter("\"error\"").substringAfter(":\"")
                .substringBefore("\"")
                .ifBlank { "Erreur serveur (${response.code()})." }
        } else {
            "Requête refusée (${response.code()})."
        }
    }
}
