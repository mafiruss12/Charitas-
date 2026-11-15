package ci.ebimpe.charitas.core.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

class NetworkClientFactoryTest {
    @Test
    fun `rejects cleartext non-local urls and sanitizes html error responses`() {
        assertTrue(NetworkClientFactory.isAllowedApiBaseUrl("https://api.charitas.ci"))
        assertTrue(NetworkClientFactory.isAllowedApiBaseUrl("http://10.0.2.2:3000"))
        assertFalse(NetworkClientFactory.isAllowedApiBaseUrl("http://api.charitas.ci"))
        assertFalse(NetworkClientFactory.isAllowedApiBaseUrl(""))

        val htmlErrResponse = Response.error<String>(
            502,
            "<!doctype html><html lang=\"en\"><title>Auth</title></html>".toResponseBody("text/html".toMediaType())
        )
        val parsedHtmlMsg = NetworkClientFactory.parseErrorMessage(htmlErrResponse)
        assertFalse(parsedHtmlMsg.contains("<"))
        assertTrue(parsedHtmlMsg.contains("502"))

        val jsonErrResponse = Response.error<String>(
            403,
            """{"error":"Permission insuffisante"}""".toResponseBody("application/json".toMediaType())
        )
        assertEquals("Permission insuffisante", NetworkClientFactory.parseErrorMessage(jsonErrResponse))
    }
}
