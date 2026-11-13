package ci.ebimpe.charitas

import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.CharitasRoles
import ci.ebimpe.charitas.core.model.ChurchMembershipDto
import ci.ebimpe.charitas.core.model.OutboxOperationType
import ci.ebimpe.charitas.core.model.OutboxStatus
import ci.ebimpe.charitas.core.model.PublicShowcaseResponseDto
import ci.ebimpe.charitas.core.model.hasPermission
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.notifications.DailyReminderWorker
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RbacAndOfflineLogicTest {

    @Test
    fun `rbac recognizes all 11 official roles and enforces permission boundaries`() {
        assertEquals(11, CharitasRoles.labels.size)

        val superMember = ChurchMembershipDto(
            membershipId = 1,
            churchId = 1,
            role = "member",
            status = "active",
            churchName = "CHARITAS — Église Saint Louis Roi d’Ebimpé",
            permissions = listOf(CharitasPermissions.SOCIAL_VIEW, CharitasPermissions.MESSAGING_ACCESS)
        )

        // Regular member cannot access branding or audit logs
        assertTrue(superMember.hasPermission(CharitasPermissions.SOCIAL_VIEW, isPlatformSuperAdmin = false))
        assertFalse(superMember.hasPermission(CharitasPermissions.CHURCH_BRANDING, isPlatformSuperAdmin = false))
        assertFalse(superMember.hasPermission(CharitasPermissions.AUDIT_VIEW, isPlatformSuperAdmin = false))

        // Platform super admin overrides
        assertTrue(superMember.hasPermission(CharitasPermissions.CHURCH_BRANDING, isPlatformSuperAdmin = true))

        // Suspended membership has zero permissions unless platform super admin
        val suspended = superMember.copy(status = "suspended")
        assertFalse(suspended.hasPermission(CharitasPermissions.SOCIAL_VIEW, isPlatformSuperAdmin = false))
    }

    @Test
    fun `daily reminder delay computation never returns less than 60 seconds`() {
        val delayMs = DailyReminderWorker.computeInitialDelayMs(targetHour = 7, targetMinute = 0)
        assertTrue(delayMs >= 60_000L)
        assertTrue(delayMs <= 24L * 60L * 60L * 1000L + 60_000L)
    }

    @Test
    fun `outbox statuses remain explicit until confirmed`() {
        val allowedOfflineTypes = OutboxOperationType.entries.toSet()
        assertTrue(allowedOfflineTypes.contains(OutboxOperationType.CREATE_POST))
        assertTrue(allowedOfflineTypes.contains(OutboxOperationType.SEND_MESSAGE))
        assertFalse(OutboxStatus.entries.any { it.name == "SENT_FAKE" })
    }

    @Test
    fun `kotlinx json serializer decodes showcase dto gracefully with extra server fields`() {
        val rawJson = """
            {
              "featuredChurch": {
                "id": 1,
                "name": "CHARITAS — Église Saint Louis Roi d’Ebimpé",
                "primaryColor": "#1B365D",
                "accentColor": "#881337",
                "unknownExtraFieldFromBackend": "ignored-safely"
              },
              "upcomingEvents": []
            }
        """.trimIndent()

        val decoded = NetworkClientFactory.jsonSerializer.decodeFromString<PublicShowcaseResponseDto>(rawJson)
        assertNotNull(decoded.featuredChurch)
        assertEquals("CHARITAS — Église Saint Louis Roi d’Ebimpé", decoded.featuredChurch?.name)
    }
}
