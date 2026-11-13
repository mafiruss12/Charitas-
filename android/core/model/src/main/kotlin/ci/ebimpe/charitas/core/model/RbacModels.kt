package ci.ebimpe.charitas.core.model

object CharitasRoles {
    val labels: Map<String, String> = mapOf(
        "super_admin" to "Super administrateur de plateforme",
        "church_admin" to "Administrateur d'église",
        "senior_pastor" to "Pasteur principal",
        "associate_pastor" to "Pasteur associé",
        "department_leader" to "Responsable de département",
        "treasurer" to "Trésorier",
        "humanitarian_lead" to "Responsable humanitaire",
        "moderator" to "Modérateur",
        "volunteer" to "Bénévole",
        "member" to "Membre",
        "visitor" to "Visiteur"
    )
}

object CharitasPermissions {
    const val CHURCH_VIEW = "church.view"
    const val CHURCH_MANAGE = "church.manage"
    const val CHURCH_BRANDING = "church.branding"
    const val MEMBERS_VIEW = "members.view"
    const val MEMBERS_MANAGE = "members.manage"
    const val ROLES_CONFIGURE = "roles.configure"
    const val DEPARTMENTS_MANAGE = "departments.manage"
    const val LEADERS_MANAGE = "leaders.manage"
    const val INVITATIONS_MANAGE = "invitations.manage"
    const val VISITORS_VIEW = "visitors.view"
    const val VISITORS_MANAGE = "visitors.manage"
    const val AUDIT_VIEW = "audit.view"
    const val SOCIAL_VIEW = "social.view"
    const val SOCIAL_POST = "social.post"
    const val SOCIAL_MODERATE = "social.moderate"
    const val MESSAGING_ACCESS = "messaging.access"
    const val SPIRITUAL_VIEW = "spiritual.view"
    const val SPIRITUAL_PUBLISH = "spiritual.publish"
    const val EVENTS_MANAGE = "events.manage"
    const val DONATIONS_VIEW = "donations.view"
    const val DONATIONS_MANAGE = "donations.manage"
    const val HUMANITARIAN_VIEW = "humanitarian.view"
    const val HUMANITARIAN_MANAGE = "humanitarian.manage"
    const val MARKETPLACE_MANAGE = "marketplace.manage"
    const val AUCTIONS_MANAGE = "auctions.manage"
    const val STREAMS_MANAGE = "streams.manage"
    const val ACADEMY_MANAGE = "academy.manage"
    const val AI_USE = "ai.use"
}

fun ChurchMembershipDto?.hasPermission(permission: String, isPlatformSuperAdmin: Boolean): Boolean {
    if (isPlatformSuperAdmin) return true
    if (this == null || status != "active") return false
    return permissions.contains(permission)
}
