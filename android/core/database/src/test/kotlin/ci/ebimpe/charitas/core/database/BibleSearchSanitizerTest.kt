package ci.ebimpe.charitas.core.database

import org.junit.Assert.assertEquals
import org.junit.Test

class BibleSearchSanitizerTest {
    @Test
    fun `toFtsQuery sanitizes French apostrophes and punctuation cleanly`() {
        assertEquals("L* Éternel* est* mon* berger*", BibleSearchSanitizer.toFtsQuery("L’Éternel est mon berger !"))
        assertEquals("au* commencement* Dieu*", BibleSearchSanitizer.toFtsQuery("au commencement, Dieu..."))
        assertEquals("", BibleSearchSanitizer.toFtsQuery("a ? !"))
    }
}
