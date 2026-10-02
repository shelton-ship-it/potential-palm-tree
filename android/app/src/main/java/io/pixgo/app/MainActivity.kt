package io.pixgo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
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
import kotlinx.coroutines.delay
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
                // Gate real de Providers.tsx: LanguageModal aparece uma única vez,
                // antes de qualquer conteúdo, enquanto 'pixgo_lang' nunca foi escolhido.
                val langChosen by app.languageManager.langChosen.collectAsStateWithLifecycle(initialValue = true)
                val translator = remember(langCode) { Translator.create(ctx, langCode) }
                CompositionLocalProvider(LocalTranslator provides translator) {
                    val nav = rememberNavController()
                    val authState by app.authRepository.state.collectAsStateWithLifecycle()
                    if (!langChosen) {
                        io.pixgo.app.ui.modals.LanguageChoiceDialog(
                            initialSelected = langCode,
                            onContinue = { code ->
                                app.ioScope.launch { app.languageManager.setLanguage(code) }
                            },
                        )
                    } else {
                        PixGoNavHost(nav, authState, app)
                    }
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
 * Tela de entrada — réplica do fluxo REAL ativo do frontend_web.
 *  - app/auth/login/page.tsx e register/page.tsx NÃO têm formulário nem UI
 *    própria ("pixgo.qzz.io não tem mais UI própria de autenticação"): fazem
 *    window.location.replace para o hub (HUB_LOGIN_URL?return_to=). O
 *    equivalente exacto no Android é abrir a HubLoginSheet (WebView dedicada
 *    só à autenticação, como a exceção já existente do checkout) logo ao
 *    entrar — sem botões "Entrar/Criar conta" inventados;
 *  - app/auth/tv/page.tsx É uma página real com teclado numérico de 6 dígitos
 *    -> POST /api/auth/device/activate (AuthRepository.loginWithDeviceCode,
 *    endpoint confirmado em api-core routes/device.js). Oferecemos esse acesso
 *    como alternativa discreta, tal como o link "entrar com senha" do original
 *    convive com o código. Nada inventado.
 */
@Composable
fun LoginScreen() {
    val context = LocalContext.current
    val app = context.applicationContext as PixGoApp
    val t = LocalTranslator.current
    var hubMode by rememberSaveable { mutableStateOf<String?>(null) }   // "login" | "register"
    var tvMode by rememberSaveable { mutableStateOf(false) }
    var code by rememberSaveable { mutableStateOf("") }
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

    if (!tvMode) {
        // Espelha loginRedirectUrl() de lib/auth-redirect.ts:
        //   if (path === '/auth/login' && isLikelyTV()) path = '/auth/tv';
        //   senão window.location.replace imediato para o hub.
        // /auth/tv É página real do frontend (teclado de 6 dígitos + link
        // "Entrar com utilizador e senha"); smartphone nunca a vê — vai
        // directo ao hub, como o redirect original.
        LaunchedEffect(Unit) {
            val uiCfg = context.resources.configuration
            // Configuration.KEYBOARD (0x0F) — sem constante KEYBOARD_* pública.
            val isTvDevice = (uiCfg.keyboard and 0x0F) == 0 ||
                uiCfg.navigation == android.content.res.Configuration.NAVIGATION_DPAD ||
                context.packageManager.hasSystemFeature("android.software.leanback")
            if (isTvDevice) tvMode = true else hubMode = "login"
        }
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

        if (!tvMode) {
            Spacer(Modifier.height(32.dp))
            CircularProgressIndicator(modifier = Modifier.size(28.dp), color = Px.Primary)
            Spacer(Modifier.height(24.dp))
            TextButton(onClick = { tvMode = true }) {
                Text(t.t("auth.tvCodeTitle"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            Spacer(Modifier.height(32.dp))
            Text(
                t.t("auth.tvCodeSteps"),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { nv -> code = nv.filter { it.isDigit() }.take(6) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                label = { Text(t.t("auth.tvCodeTitle")) }
            )
            error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(12.dp))
            Button(
                enabled = code.length == 6,
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
                            error = t.t("auth.tvActivateError")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Px.Primary)
            ) { Text(t.t("auth.signIn")) }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { hubMode = "login"; tvMode = false; error = null }) {
                Text(t.t("auth.tvUsePassword"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun HomeShell(authState: AuthState, app: PixGoApp) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // Estado de navegação sobrevivente a recomposição (ex.: rotação) — o
    // padrão do web é URL-based; aqui persistimos o destino + contexto aberto.
    val navSaved = rememberSaveable { mutableStateOf(MainDest.HOME) }
    val watchSaved = rememberSaveable { mutableStateOf<String?>(null) }
    val watchOfflineSaved = rememberSaveable {
        mutableStateOf<Pair<String, String?>?>(null)
    }
    var current by navSaved
    var searchQuery by remember { mutableStateOf("") }
    val langCode by app.languageManager.languageCode.collectAsStateWithLifecycle(initialValue = "pt")
    // Estado da rota /main/plans (tela nativa PlansScreen): "highlight" é o
    // ?highlight= do RateLimitModal/ChannelsRateLimit do web; pendingCheckout
    // guarda a URL de checkout que PlansScreen pediu para abrir (handleSubscribe
    // → HUB_CHECKOUT_URL?plan=&return_to=), consumida pelo FastWebViewSheet.
    var plansHighlight by remember { mutableStateOf<String?>(null) }
    fun openPlans(highlight: String? = null) {
        plansHighlight = highlight
        current = MainDest.PLANS
    }
    // URL do checkout do hub aberta a partir da tela Plans ("Assinar" →
    // HUB_CHECKOUT_URL?plan=&return_to=, exactamente como handleSubscribe em
    // plans/page.tsx). null = nenhuma sheet de checkout aberta.
    var checkoutUrl by remember { mutableStateOf<String?>(null) }
    // O aviso jurídico dos planos nunca é memorizado no web (PlansNoticeModal);
    // rearme a cada nova abertura do fluxo de checkout.
    var plansNoticeShown by remember { mutableStateOf(false) }
    LaunchedEffect(checkoutUrl) { if (checkoutUrl != null) plansNoticeShown = false }
    var watchContentId by watchSaved
    // Abertura de download concluído pela tela Downloads → Watch em modo
    // offline (PlayerScreen usa PlayerRepository.startLocal; sem rede).
    var watchOffline by watchOfflineSaved
    // Contagem real do badge — DownloadStore reconcilia DataStore + disco.
    val downloadsStore = remember { io.pixgo.app.data.download.DownloadStore(context) }
    var downloadsCount by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            downloadsCount = runCatching { downloadsStore.allOnce().size }.getOrDefault(0)
            delay(3_000L)
        }
    }
    var watchingChannel by remember { mutableStateOf<io.pixgo.app.data.channels.ChannelListItem?>(null) }
    // DisclaimerGate real (Providers.tsx): com sessão ativa, o DisclaimerModal
    // aparece até aceitar; "Recusar" memoriza pixgo_disclaimer_dismissed.
    var showDisclaimer by remember { mutableStateOf(false) }
    LaunchedEffect(authState.hydrated, authState.token) {
        if (authState.hydrated && authState.token != null &&
            !app.authRepository.isDisclaimerDismissed()
        ) showDisclaimer = true
    }
    if (showDisclaimer) {
        io.pixgo.app.ui.modals.DisclaimerDialog(
            onAccept = { showDisclaimer = false },
            onDismiss = {
                showDisclaimer = false
                app.ioScope.launch { app.authRepository.setDisclaimerDismissed(true) }
            },
        )
    }
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
            // Downloads offline nativos — DownloadEngine/DownloadStore
            // (equivalente de lib/downloads.ts + IndexedDB do web).
            downloadCount = downloadsCount,
            onOpenDownloads = { current = MainDest.DOWNLOADS },
            onUpgrade = { openPlans() },
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
                    onOpenPlans = { openPlans() }
                )
                MainDest.LEGAL -> io.pixgo.app.ui.legal.LegalScreen(legalRepository = app.legalRepository, uiLang = langCode)
                // /main/upload real (page.tsx, 406 linhas) — formulário nativo com
                // contrato uploadApi (copyright.pixgo.qzz.io). Substitui o antigo
                // diálogo fictício "Uploads disponíveis no site apenas."
                MainDest.UPLOAD -> io.pixgo.app.ui.upload.UploadScreen(
                    authRepository = app.authRepository,
                    onBack = { current = MainDest.HOME }
                )
                MainDest.DOWNLOADS -> io.pixgo.app.ui.downloads.DownloadsScreen(
                    authState = authState,
                    onOpenDownload = { cid, ep -> watchOffline = cid to ep },
                    onUpgrade = { openPlans() },
                    onBrowseCatalog = { current = MainDest.CATALOG }
                )
                // /main/plans real (page.tsx) — tela nativa; "Assinar" abre o
                // checkout do hub (?plan=&return_to=) na WebView única.
                MainDest.PLANS -> io.pixgo.app.ui.plans.PlansScreen(
                    authRepository = app.authRepository,
                    plan = authState.plan,
                    highlight = plansHighlight,
                    onSubscribe = { url -> checkoutUrl = url }
                )
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
                onUpgrade = { openPlans() }
            )
        }

        // Download concluído aberto pela tela Downloads → Watch offline
        // (PlayerScreen detecta a sessão local via startLocal; sem rede).
        watchOffline?.let { (cid, ep) ->
            io.pixgo.app.ui.watch.WatchScreen(
                contentId = cid,
                episodeId = ep,
                authState = authState,
                catalogRepository = app.catalogRepository,
                uiLang = langCode,
                onClose = { watchOffline = null },
                onOpenRecommendation = { nid -> watchContentId = nid; watchOffline = null },
                onUpgrade = { openPlans() },
                offline = true
            )
        }

        // PlansNoticeModal real: no web ele vive em /plans (sempre ao entrar) e
        // na aba "subscription" da conta. No Android o checkout é o hub externo
        // (mesmo HUB_CHECKOUT_URL?plan=&return_to= de plans/page.tsx), então o
        // aviso aparece SEMPRE antes de abrir esse fluxo — nunca memorizado,
        // exatamente como no original.
        if (checkoutUrl != null && !plansNoticeShown) {
            io.pixgo.app.ui.modals.PlansNoticeDialog(
                onDismiss = { plansNoticeShown = true }
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

        // Checkout REAL do hub (handleSubscribe de plans/page.tsx →
        // HUB_CHECKOUT_URL?plan=&return_to=) na WebView única. A URL vem
        // SEMPRE da tela Plans nativa via onSubscribe; o fallback antigo
        // (abrir /main/plans direto, ignorando a tela nativa) foi eliminado.
        checkoutUrl?.let { url ->
            if (plansNoticeShown) {
                io.pixgo.app.ui.webview.FastWebViewSheet(
                    url = url,
                    onClose = {
                        checkoutUrl = null
                        // Réplica do fluxo ?px_paid= (CheckoutStatusPage/ZumboPay): ao
                        // fechar, invalida o cache de /me para reflectir um plano novo
                        // sem esperar pelo TTL de 30min.
                        scope.launch { app.authRepository.invalidateMeCacheAfterPayment() }
                    }
                )
            }
        }
    }

}
