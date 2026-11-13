package ci.ebimpe.charitas.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.MailOutline
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.model.OutboxUiState
import ci.ebimpe.charitas.ui.components.OfflineStatusBanner
import ci.ebimpe.charitas.ui.screens.AdminChurchScreen
import ci.ebimpe.charitas.ui.screens.BibleScreen
import ci.ebimpe.charitas.ui.screens.EventsSolidarityScreen
import ci.ebimpe.charitas.ui.screens.HomeScreen
import ci.ebimpe.charitas.ui.screens.MessagingScreen
import ci.ebimpe.charitas.ui.screens.SettingsAuthProfileScreen
import ci.ebimpe.charitas.ui.screens.SocialScreen
import ci.ebimpe.charitas.ui.screens.TvScreen
import kotlinx.coroutines.launch

sealed class CharitasRoute(val route: String, val label: String, val icon: ImageVector) {
    data object Home : CharitasRoute("home", "Accueil", Icons.Rounded.Home)
    data object Bible : CharitasRoute("bible", "Bible", Icons.Rounded.AutoStories)
    data object Social : CharitasRoute("social", "Communauté", Icons.Rounded.Forum)
    data object Tv : CharitasRoute("tv", "TV", Icons.Rounded.LiveTv)
    data object Events : CharitasRoute("events", "Actions", Icons.Rounded.VolunteerActivism)
    data object Messaging : CharitasRoute("messaging", "Messages", Icons.Rounded.MailOutline)
    data object Account : CharitasRoute("account", "Compte", Icons.Rounded.Person)
    data object Admin : CharitasRoute("admin", "Admin", Icons.Rounded.Person)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CharitasRootScaffold(container: CharitasAppContainer) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val isOnline by container.repository.isOnline.collectAsState()
    val outboxState by container.repository.outboxStateFlow.collectAsState(initial = OutboxUiState())

    val bottomTabs = listOf(
        CharitasRoute.Home,
        CharitasRoute.Bible,
        CharitasRoute.Social,
        CharitasRoute.Tv,
        CharitasRoute.Events
    )

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    fun navigateSingleTop(route: String) {
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text("CHARITAS · Saint Louis Roi") },
                    actions = {
                        Row {
                            IconButton(onClick = { navigateSingleTop(CharitasRoute.Messaging.route) }) {
                                Icon(Icons.Rounded.MailOutline, contentDescription = "Messagerie & Notifications")
                            }
                            IconButton(onClick = { navigateSingleTop(CharitasRoute.Account.route) }) {
                                Icon(Icons.Rounded.Person, contentDescription = "Profil & Paramètres")
                            }
                        }
                    }
                )
                OfflineStatusBanner(
                    isOnline = isOnline,
                    outboxState = outboxState,
                    onRetrySync = { scope.launch { container.repository.flushOutbox() } }
                )
            }
        },
        bottomBar = {
            NavigationBar {
                bottomTabs.forEach { tab ->
                    val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                    NavigationBarItem(
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label, maxLines = 1) },
                        selected = selected,
                        onClick = { navigateSingleTop(tab.route) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = CharitasRoute.Home.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            composable(CharitasRoute.Home.route) {
                HomeScreen(
                    container = container,
                    onOpenBible = { navigateSingleTop(CharitasRoute.Bible.route) },
                    onOpenTv = { navigateSingleTop(CharitasRoute.Tv.route) },
                    onOpenEvents = { navigateSingleTop(CharitasRoute.Events.route) },
                    onOpenAuth = { navigateSingleTop(CharitasRoute.Account.route) }
                )
            }
            composable(CharitasRoute.Bible.route) {
                BibleScreen(container = container)
            }
            composable(CharitasRoute.Social.route) {
                SocialScreen(
                    container = container,
                    onOpenAuth = { navigateSingleTop(CharitasRoute.Account.route) }
                )
            }
            composable(CharitasRoute.Tv.route) {
                TvScreen(container = container)
            }
            composable(CharitasRoute.Events.route) {
                EventsSolidarityScreen(
                    container = container,
                    onOpenAuth = { navigateSingleTop(CharitasRoute.Account.route) }
                )
            }
            composable(CharitasRoute.Messaging.route) {
                MessagingScreen(
                    container = container,
                    onOpenAuth = { navigateSingleTop(CharitasRoute.Account.route) }
                )
            }
            composable(CharitasRoute.Account.route) {
                SettingsAuthProfileScreen(
                    container = container,
                    onOpenAdmin = { navigateSingleTop(CharitasRoute.Admin.route) }
                )
            }
            composable(CharitasRoute.Admin.route) {
                AdminChurchScreen(container = container)
            }
        }
    }
}
