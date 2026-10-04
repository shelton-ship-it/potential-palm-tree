package io.pixgo.app.ui.webview

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import io.pixgo.app.R
import io.pixgo.app.data.i18n.LocalTranslator
import io.pixgo.app.data.network.WebViewCookieSync
import io.pixgo.app.ui.common.PxBtnVariant
import io.pixgo.app.ui.common.PxButton
import io.pixgo.app.ui.common.PxEmptyState
import io.pixgo.app.ui.common.PxLoadingRing
import io.pixgo.app.ui.theme.Px
import kotlinx.coroutines.delay

/**
 * Excepção deliberada e única à regra "sem WebView a encapsular a app" —
 * só para o checkout do hub (Assinar Premium), autorizada explicitamente
 * pelo dono do projecto. Objectivo: parecer uma tela da própria app, não
 * um browser.
 *
 * Correções desta versão (spinner descentrado / página "alongada"):
 *  - loadWithOverviewMode = false: com `true`, qualquer elemento mais largo
 *    que o ecrã (iframe do cartão ZumboPay, overlay do Hotmart) fazia a
 *    WebView afastar o zoom para caber — a página ficava esticada e o
 *    `min-height:100vh; align-items:center` do spinner do hub deixava de
 *    coincidir com o centro do ecrã. Agora o layout fica sempre na largura
 *    do ecrã (meta viewport do hub: width=device-width, initial-scale=1);
 *  - textZoom = 100: a escala de fonte do sistema não deforma o layout;
 *  - a WebView ocupa só o espaço abaixo de uma barra nativa (já não há um X
 *    flutuante por cima do conteúdo) e respeita cutout + teclado
 *    (windowInsets safeDrawing). Em modo imersivo, `adjustResize` sozinho não
 *    redimensiona a janela, por isso o teclado empurrava/esticava a página;
 *  - o spinner de carregamento é o MESMO `.loading-ring` (42px/3px) que o hub
 *    desenha no mesmo centro: a passagem do nativo para o da página é contínua;
 *  - falha de rede / HTTP 5xx / processo de render morto / 25s sem carregar
 *    mostram um estado nativo com "Tentar novamente" (antes: página de erro
 *    do Chromium ou spinner eterno).
 */
private const val LOAD_TIMEOUT_MS = 25_000L

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun FastWebViewSheet(url: String, onClose: () -> Unit) {
    val tr = LocalTranslator.current
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var attempt by remember { mutableIntStateOf(0) }        // muda => WebView nova (retry / render morto)
    var progress by remember { mutableIntStateOf(0) }
    var pageReady by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    BackHandler {
        val wv = webViewRef
        if (wv != null && wv.canGoBack() && !failed) wv.goBack() else onClose()
    }

    // Sem resposta em LOAD_TIMEOUT_MS => estado de erro com retry (nunca spinner eterno).
    LaunchedEffect(attempt) {
        delay(LOAD_TIMEOUT_MS)
        if (!pageReady) failed = true
    }

    DisposableEffect(Unit) {
        onDispose { CookieManager.getInstance().flush() }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Px.BgDark)
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        // Barra nativa: fecha + logo (.logo img{height:18px}) + fio de progresso 2px.
        Box(
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(Px.BgDark)
                .drawBehind {
                    drawRect(Px.Border, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx()))
                    if (!pageReady && !failed) {
                        drawRect(
                            Px.Primary,
                            Offset(0f, size.height - 2.dp.toPx()),
                            Size(size.width * (progress.coerceIn(0, 100) / 100f), 2.dp.toPx())
                        )
                    }
                }
        ) {
            Row(Modifier.fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onClose, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = tr.t("common.close"), tint = Px.TextLight)
                }
                Image(
                    painter = painterResource(id = R.drawable.ic_pixgo_logo),
                    contentDescription = "Pixgo",
                    modifier = Modifier.height(18.dp).aspectRatio(786f / 237f)
                )
            }
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            key(attempt) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            setBackgroundColor(0xFF0A0A0C.toInt()) // sem flash branco
                            overScrollMode = View.OVER_SCROLL_NEVER
                            isVerticalScrollBarEnabled = false
                            isHorizontalScrollBarEnabled = false
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                useWideViewPort = true          // honra <meta viewport width=device-width>
                                loadWithOverviewMode = false    // NUNCA encolher a página para caber conteúdo largo
                                setSupportZoom(false)
                                builtInZoomControls = false
                                displayZoomControls = false
                                textZoom = 100
                                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                allowFileAccess = false
                                allowContentAccess = false
                            }
                            CookieManager.getInstance().also { cm ->
                                cm.setAcceptCookie(true)
                                cm.setAcceptThirdPartyCookies(this, true)
                            }

                            webChromeClient = object : WebChromeClient() {
                                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                    progress = newProgress
                                    if (newProgress >= 100) pageReady = true
                                }
                            }

                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    failed = false
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    if (!failed) pageReady = true
                                    CookieManager.getInstance().flush()
                                }

                                override fun onReceivedError(
                                    view: WebView?, request: WebResourceRequest?, error: WebResourceError?
                                ) {
                                    if (request?.isForMainFrame == true) failed = true
                                }

                                override fun onReceivedHttpError(
                                    view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?
                                ) {
                                    if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 0) >= 500) failed = true
                                }

                                // Processo de render morto (OOM etc.): sem isto o app inteiro fecha.
                                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                                    failed = true
                                    webViewRef = null
                                    return true
                                }

                                // http/https ficam na WebView (checkout, 3-D Secure, Hotmart);
                                // esquemas externos (mailto:, tel:, intent:...) abrem a app certa.
                                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                    val uri = request?.url ?: return false
                                    if (uri.scheme == "http" || uri.scheme == "https") return false
                                    try {
                                        view?.context?.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString())))
                                    } catch (_: ActivityNotFoundException) {
                                    }
                                    return true
                                }
                            }

                            // O CookieManager do WebView é separado do CookieJar do OkHttp:
                            // sincroniza a sessão (pixgo_session) ANTES de carregar.
                            WebViewCookieSync.syncSessionCookies()
                            webViewRef = this
                            loadUrl(url)
                        }
                    },
                    onRelease = { wv ->
                        wv.stopLoading()
                        wv.webViewClient = WebViewClient()
                        wv.webChromeClient = null
                        (wv.parent as? ViewGroup)?.removeView(wv)
                        wv.destroy()
                        if (webViewRef === wv) webViewRef = null
                    }
                )
            }

            // Carregamento: cobre exatamente a área da WebView e centra o anel no meio dela.
            AnimatedVisibility(
                visible = !pageReady && !failed,
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(Modifier.fillMaxSize().background(Px.BgDark), contentAlignment = Alignment.Center) {
                    PxLoadingRing()
                }
            }

            if (failed) {
                Box(Modifier.fillMaxSize().background(Px.BgDark), contentAlignment = Alignment.Center) {
                    PxEmptyState(
                        icon = Icons.Outlined.ErrorOutline,
                        title = tr.t("common.error"),
                        description = tr.t("errors.networkError"),
                        action = {
                            Row {
                                PxButton(
                                    text = tr.t("common.retry"),
                                    onClick = {
                                        failed = false
                                        pageReady = false
                                        progress = 0
                                        attempt++
                                    }
                                )
                                Box(Modifier.width(10.dp))
                                PxButton(
                                    text = tr.t("common.close"),
                                    onClick = onClose,
                                    variant = PxBtnVariant.Secondary
                                )
                            }
                        }
                    )
                }
            }
        }
    }
}
