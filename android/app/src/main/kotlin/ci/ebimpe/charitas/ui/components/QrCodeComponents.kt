package ci.ebimpe.charitas.ui.components

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix

fun generateQrBitmap(payload: String, sizePx: Int = 512): Bitmap? {
    if (payload.isBlank()) return null
    return runCatching {
        val bitMatrix: BitMatrix = MultiFormatWriter().encode(
            payload,
            BarcodeFormat.QR_CODE,
            sizePx,
            sizePx
        )
        val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        for (x in 0 until sizePx) {
            for (y in 0 until sizePx) {
                bmp.setPixel(x, y, if (bitMatrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
            }
        }
        bmp
    }.getOrNull()
}

@Composable
fun QrTicketCard(
    payload: String,
    eventTitle: String,
    qrSize: Dp = 190.dp
) {
    val bitmap = remember(payload) { generateQrBitmap(payload, 512) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .padding(16.dp)
    ) {
        Text(
            text = eventTitle,
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF0F172A),
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(10.dp))
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Billet QR Code CHARITAS",
                modifier = Modifier.size(qrSize)
            )
        } else {
            Box(
                modifier = Modifier
                    .size(qrSize)
                    .background(Color(0xFFF1F5F9)),
                contentAlignment = Alignment.Center
            ) {
                Text("QR indisponible", color = Color(0xFF475569))
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = payload,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475569),
            textAlign = TextAlign.Center
        )
    }
}
