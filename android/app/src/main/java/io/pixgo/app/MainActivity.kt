package io.pixgo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import io.pixgo.app.data.auth.ApiException
import io.pixgo.app.data.auth.AuthState
import io.pixgo.app.data.i18n.LocalTranslator
import io.pixgo.app.data.i18n.Translator
import io.pixgo.app.data.i18n.contentLangFor
import io.pixgo.app.ui.common.DialogImmersive
import io.pixgo.app.ui.common.applyImmersive
import io.pixgo.app.ui.nav.MainDest
import io.pixgo.app.ui.nav.PixGoScaffold
import io.pixgo.app.ui.theme.PixGoTheme
import io.pixgo.app.ui.theme.Px
import androidx.compose.foundation.Image
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import io.pixgo.app.ui.auth.HubLoginSheet
import kotlinx.coroutines.launch

/**
 * Login/Home ficam sob o NavHost de topo; o shell (header + sidebar, réplica de
 * AppShell.tsx) vive em io.pixgo.app.ui.nav.PixGoScaffold.
 */
sealed class Dest(val route: String) {
    object Login : Dest("login")
    object Home : Dest("home")
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // FULLSCREEN NATIVO: edge-to-edge + modo imersivo. Sem Navigation Bar a fazer de footer.
        window.applyImmersive()
        val app = application as PixGoApp
        setContent {
            PixGoTheme {
                val ctx = LocalContext.current
                val langCode by app.languageManager.languageCode.collectAsStateWithLifecycle(initialValue = "pt")
                val translator = remember(langCode) { Translator.create(ctx, langCode) }
                CompositionLocalProvider(LocalTranslator provides translator) {
                    val nav = rememberNavController()
                    val authState by app.authRepository.state.collectAsStateWithLifecycle()
                    PixGoNavHost(nav, authState, app)
                }
            }
        }
    }

    // Diálogos/teclado/gestos trazem as barras de volta; reaplicamos ao recuperar o foco.
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) window.applyImmersive()
    }
}

@Composable
fun PixGoNavHost(nav: NavHostController, authState: AuthState, app: PixGoApp) {
    // Réplica de MainLayout.tsx: sem token (após hidratar) -> login;
    // com token -> home/shell.
    val startDestination = if (authState.hydrated && authState.token == null) Dest.Login.route else Dest.Home.route

    NavHost(nav, startDestination = startDestination) {
        composable(Dest.Login.route) {
            LoginScreen()
        }
        composable(Dest.Home.route) {
            HomeShell(authState, app)
        }
    }

    // Redireciona automaticamente quando o estado de auth muda, tal como
    // o `if (hydrated && !token) router.replace(...)` de main/layout.tsx.
    LaunchedEffect(authState.hydrated, authState.token) {
        if (authState.hydrated && authState.token == null && nav.currentDestination?.route != Dest.Login.route) {
            nav.navigate(Dest.Login.route)
        } else if (authState.token != null && nav.currentDestination?.route == Dest.Login.route) {
            nav.navigate(Dest.Home.route)
        }
    }
}

/**
 * Tela de entrada NATIVA que reproduz o fluxo REAL ativo do frontend_web:
 *  - app/auth/login|register/page.tsx não têm formulário — redirecionam ao
 *    hub (HubLoginSheet, WebView dedicada só à autenticação, como a
 *    exceção já existente do checkout/FastWebViewSheet);
 *  - app/auth/tv/page.tsx tem código numérico -> POST /api/auth/device/activate
 *    (AuthRepository.loginWithDeviceCode, endpoint já confirmado em
 *    api-core routes/device.js). Nada inventado.
 */
@Composable
fun LoginScreen() {
    val context = LocalContext.current
    val app = context.applicationContext as PixGoApp
    val t = LocalTranslator.current
    val authState by app.authRepository.state.collectAsStateWithLifecycle()
    var hubMode by remember { mutableStateOf<String?>(null) }   // "login" | "register"
    var tvMode by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    if (hubMode != null) {
        HubLoginSheet(
            mode = hubMode!!,
            authRepository = app.authRepository,
            onClose = { hubMode = null }
        )
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Px.BgDark).windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Image(
            painter = painterResource(id = R.drawable.ic_pixgo_logo),
            contentDescription = "PixGo",
            modifier = Modifier.height(56.dp)
        )
        Spacer(Modifier.height(32.dp))

        Button(
            enabled = !authState.loading,
            onClick = { hubMode = "login" },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Px.Primary),
            shape = MaterialTheme.shapes.small
        ) { Text(t.t("auth.signIn")) }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            enabled = !authState.loading,
            onClick = { hubMode = "register" },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = MaterialTheme.shapes.small
        ) { Text(t.t("auth.signUp")) }

        Spacer(Modifier.height(24.dp))
        TextButton(onClick = { tvMode = !tvMode; error = null }) {
            Text(if (tvMode) t.t("common.cancel") else t.t("auth.tvCodeTitle"))
        }
        if (tvMode) {
            Spacer(Modifier.height(8.dp))
            Text(
                t.t("auth.tvCodeSteps"),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { nv -> code = nv.filter { it.isDigit() }.take(6) },
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                label = { Text(t.t("auth.tvCodeTitle")) }
            )
            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(12.dp))
            Button(
                enabled = !authState.loading && code.length == 6,
                onClick = {
                    error = null
                    scope.launch {
                        try {
                            app.authRepository.loginWithDeviceCode(code)
                        } catch (e: ApiException) {
                            code = ""
                            error = when (e.status) {
                                404 -> t.t("auth.tvCodeInvalid")
                                410 -> t.t("auth.tvCodeExpired")
                                409 -> t.t("auth.tvCodeUsed")
                                else -> t.t("auth.tvActivateError")
                            }
                        } catch (e: Exception) {
                            code = ""
                            error = "Falha de rede."
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Px.Primary)
            ) {
                if (authState.loading) CircularProgressIndicator(modifier = Modifier.size(18.dp)) else Text(t.t("auth.signIn"))
            }
        }
    }
}

@OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun HomeShell(authState: AuthState, app: PixGoApp) {
    val scope = rememberCoroutineScope()
    var current by remember { mutableStateOf(MainDest.HOME) }
    var searchQuery by remember { mutableStateOf("") }
    val langCode by app.languageManager.languageCode.collectAsStateWithLifecycle(initialValue = "pt")
    var uploadDialog by remember { mutableStateOf(false) }
    var plansWebView by remember { mutableStateOf(false) }
    var watchContentId by remember { mutableStateOf<String?>(null) }
    var watchingChannel by remember { mutableStateOf<io.pixgo.app.data.channels.ChannelListItem?>(null) }
    val activeProfile = authState.profiles.find { it.id == authState.activeProfileId }
    var snackbarText by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(snackbarText) {
        snackbarText?.let { snackbarHostState.showSnackbar(it) }
    }

    Box(Modifier.fillMaxSize()) {
        PixGoScaffold(
            current = current,
            onNavigate = { dest -> searchQuery = ""; current = dest },
            user = authState.user,
            plan = authState.plan,
            profiles = authState.profiles,
            activeProfileId = authState.activeProfileId,
            onSelectProfile = { id -> scope.launch { app.authRepository.setActiveProfile(id) } },
            currentLangCode = langCode,
            onSelectLanguage = { code ->
                scope.launch {
                    app.languageManager.setLanguage(code)
                    app.authRepository.setLanguageServerSide(code)
                }
            },
            // Downloads offline (lib/downloads.ts, IndexedDB) ainda sem equivalente nativo.
            downloadCount = 0,
            onOpenDownloads = { snackbarText = "Downloads: ainda por construir." },
            onUpload = { uploadDialog = true },
            onUpgrade = { plansWebView = true },
            onSignOut = { scope.launch { app.authRepository.logout() } },
            suggest = { q -> app.catalogRepository.search(q, contentLangFor(langCode), limit = 6) },
            onOpenContent = { id -> watchContentId = id },
            onSubmitSearch = { q -> searchQuery = q; current = MainDest.SEARCH },
        ) {
            when (current) {
                MainDest.HOME -> io.pixgo.app.ui.home.HomeScreen(
                    catalogRepository = app.catalogRepository,
                    activeProfileId = authState.activeProfileId,
                    uiLang = langCode,
                    onOpenContent = { id -> watchContentId = id }
                )
                MainDest.CATALOG -> io.pixgo.app.ui.explore.ExploreScreen(
                    catalogRepository = app.catalogRepository,
                    activeProfileId = authState.activeProfileId,
                    isKidProfile = activeProfile?.isKid == true,
                    uiLang = langCode,
                    onOpenContent = { id -> watchContentId = id }
                )
                MainDest.MY_LIST -> io.pixgo.app.ui.mylist.MyListScreen(
                    catalogRepository = app.catalogRepository,
                    activeProfileId = authState.activeProfileId,
                    onOpenContent = { id -> watchContentId = id },
                    onBrowseCatalog = { current = MainDest.CATALOG }
                )
                MainDest.SEARCH -> io.pixgo.app.ui.search.SearchScreen(
                    catalogRepository = app.catalogRepository,
                    uiLang = langCode,
                    onOpenContent = { id -> watchContentId = id },
                    initialQuery = searchQuery
                )
                MainDest.LIVE_TV -> io.pixgo.app.ui.channels.ChannelsScreen(
                    repository = app.channelsRepository,
                    hasUser = authState.token != null,
                    onOpenChannel = { ch -> watchingChannel = ch }
                )
                MainDest.ACCOUNT -> io.pixgo.app.ui.account.AccountScreen(
                    authRepository = app.authRepository,
                    contactRepository = app.contactRepository,
                    onForcedLogout = { current = MainDest.HOME },
                    onOpenPlans = { plansWebView = true }
                )
                MainDest.LEGAL -> io.pixgo.app.ui.legal.LegalScreen(legalRepository = app.legalRepository, uiLang = langCode)
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )

        watchContentId?.let { id ->
            // Watch nativa (réplica de /main/watch/[id] ATIVO): chrome,
            // ações, episódios, recomendações, progresso e modais em volta
            // do PlayerScreen existente. Card → Watch direto; sem Content
            // Detail (banida) e sem Bottom Nav (banida).
            io.pixgo.app.ui.watch.WatchScreen(
                contentId = id,
                episodeId = null,
                authState = authState,
                catalogRepository = app.catalogRepository,
                uiLang = langCode,
                onClose = { watchContentId = null },
                onOpenRecommendation = { cid -> watchContentId = cid },
                onUpgrade = { plansWebView = true }
            )
        }

        watchingChannel?.let { ch ->
            val url = ch.url
            if (url != null) {
                io.pixgo.app.ui.channels.ChannelsPlayerScreen(
                    channelId = ch.id,
                    channelName = ch.name,
                    streamUrl = url,
                    channelsRepository = app.channelsRepository,
                    onClose = { watchingChannel = null }
                )
            } else {
                LaunchedEffect(ch.id) { watchingChannel = null }
            }
        }

        if (plansWebView) {
            io.pixgo.app.ui.webview.FastWebViewSheet(
                url = "https://app.pixgo.qzz.io/main/plans",
                onClose = {
                    plansWebView = false
                    // Réplica do fluxo ?px_paid= (CheckoutStatusPage/ZumboPay): ao
                    // fechar, invalida o cache de /me para reflectir um plano novo
                    // sem esperar pelo TTL de 30min.
                    scope.launch { app.authRepository.invalidateMeCacheAfterPayment() }
                }
            )
        }
    }

    // FASE 2: /main/upload real (406 linhas no original) substitui este diálogo provisório.
    if (uploadDialog) {
        AlertDialog(
            onDismissRequest = { uploadDialog = false },
            confirmButton = {
                TextButton(onClick = { uploadDialog = false }) { Text("OK") }
            },
            title = { Text("Enviar conteúdo") },
            text = { DialogImmersive(); Text("Uploads disponíveis no site apenas.") }
        )
    }
}
