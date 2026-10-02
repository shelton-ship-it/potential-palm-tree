package io.pixgo.app.ui.auth

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import io.pixgo.app.data.auth.AuthRepository
import io.pixgo.app.data.network.NetworkModule
import io.pixgo.app.data.network.WebViewCookieSync
import kotlinx.coroutines.launch

/**
 * Réplica do fluxo REAL e ativo de login/registo do frontend_web:
 * app/auth/login/page.tsx e register/page.tsx NÃO têm formulário — fazem
 * window.location.replace('https://app.pixgo.qzz.io/auth/{login,register}
 * &amp;return_to=...'). No Android o "redirect" é esta WebView dedicada ao
 * hub (mesma exceção deliberada já autorizada para o checkout em
 * FastWebViewSheet); a app em si continua 100% nativa.
 *
 * Ao autenticar, o hub grava o cookie de sessão partilhado
 * Domain=.pixgo.qzz.io (session-cookie.js) e devolve o token Bearer no
 * corpo/localStorage. Sincronizamos os dois sentidos:
 *  - cookies do webkit -> jar OkHttp (NetworkModule.importCookiesFromWebView);
 *  - token via bridge JS (PixGoNative.onToken -> storeExternalToken), se o
 *    hub o expuser;
 * e hidratamos o estado nativo com AuthRepository.fetchMe(force = true) —
 * exatamente como o hub web faz a seguir ao redirect (GET /api/auth/me).
 *
 * Fecha sozinha quando o hub sai das rotas de autenticacao (equivalente ao
 * `window.location.href = returnTo` pós-login do fluxo ativo).
 */
private const val HUB_ORIGIN = "https://app.pixgo.qzz.io"

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HubLoginSheet(mode: String, authRepository: AuthRepository, onClose: () -> Unit) {
    require(mode == "login" || mode == "register")
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var closed by remember { mutableStateOf(false) }

    val startUrl = "$HUB_ORIGIN/auth/$mode?return_to=${android.net.Uri.encode("$HUB_ORIGIN/main")}"

    fun finishAuth(url: String?) {
        if (closed) return
        closed = true
        // Importa pixgo_session etc. do webkit para o jar OkHttp ANTES de hidratar.
        NetworkModule.importCookiesFromWebView(context.applicationContext, HUB_ORIGIN)
        scope.launch {
            try {
                authRepository.fetchMe(force = true)
            } finally {
                onClose()
            }
        }
    }

    BackHandler {
        val wv = webViewRef
        if (wv != null && wv.canGoBack()) wv.goBack() else onClose()
    }

    DisposableEffect(Unit) {
        onDispose { webViewRef?.destroy() }
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF0A0A0C))) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    setBackgroundColor(AndroidColor.TRANSPARENT)
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    settings.setSupportZoom(false)
                    android.webkit.CookieManager.getInstance().also { cm ->
                        cm.setAcceptCookie(true)
                        cm.setAcceptThirdPartyCookies(this, true)
                    }
                    // Bridge mínima: se o hub expuser o token Bearer na página
                    // (localStorage), entregamo-lo ao TokenManager existente.
                    addJavascriptInterface(
                        object {
                            @android.webkit.JavascriptInterface
                            fun onToken(token: String) {
                                if (token.isNotBlank()) {
                                    scope.launch { authRepository.storeExternalToken(token) }
                                }
                            }
                        },
                        "PixGoNative"
                    )
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, finishedUrl: String?) {
                            loading = false
                            // Fluxo ativo: após o login o hub redireciona para
                            // fora da rota de autenticacao — aqui isso significa "autenticado".
                            val u = view?.url ?: finishedUrl
                            if (u != null && !u.contains("/auth/")) finishAuth(u)
                        }

                        override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                            loading = false
                            val u = url ?: return
                            if (!u.contains("/auth/")) finishAuth(u)
                        }
                    }
                    // Estado de login prévio (ex.: sessão guardada no jar) entra
                    // na WebView já autenticada, tal como o browser com cookie.
                    WebViewCookieSync.syncSessionCookies()
                    webViewRef = this
                    loadUrl(startUrl)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        if (loading) {
            Box(
                Modifier.fillMaxSize().background(Color(0xFF0A0A0C)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color(0xFFE50914))
            }
        }

        IconButton(
            onClick = onClose,
            modifier = Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(8.dp)
        ) {
            Icon(Icons.Filled.Close, contentDescription = "Fechar", tint = Color.White)
        }
    }
}
