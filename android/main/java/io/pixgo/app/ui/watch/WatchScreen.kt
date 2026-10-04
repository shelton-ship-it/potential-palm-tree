package io.pixgo.app.ui.watch

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BookmarkAdded
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import io.pixgo.app.data.auth.AuthState
import io.pixgo.app.data.catalog.CatalogRepository
import io.pixgo.app.data.i18n.LocalTranslator
import io.pixgo.app.data.i18n.contentLangFor
import io.pixgo.app.data.model.ContentDetail
import io.pixgo.app.data.model.ContentItem
import io.pixgo.app.data.model.Episode
import io.pixgo.app.data.model.UpsellPlan
import io.pixgo.app.ui.theme.Px
import io.pixgo.app.ui.theme.Montserrat
import io.pixgo.app.ui.common.PxBadge
import io.pixgo.app.ui.common.PxBadgeKind
import io.pixgo.app.ui.common.PxBtnSize
import io.pixgo.app.ui.common.PxBtnVariant
import io.pixgo.app.ui.common.PxButton
import io.pixgo.app.ui.common.PxLoadingRing
import io.pixgo.app.ui.common.pxTap
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.material.icons.filled.Movie
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Watch nativa — réplica funcional de app/main/watch/[id]/page.tsx (o
 * único player-page ATIVO do frontend: os cards levam direto para cá;
 * Content Detail foi banida do fluxo).
 *
 * O vídeo em si é o PlayerScreen EXISTENTE (protegido, apenas com os
 * callbacks opcionais aditivos que expõe): onTimeUpdate (heartbeat de
 * progresso — PROGRESS_INTERVAL_MS = 60s do original),
 * onRateLimited/onSessionReplaced (modais com message/plans REAIS do
 * 429/409) e onNextEpisode (handleNext do original, alimentado pelo
 * evento 'ended' do player).
 */
@androidx.media3.common.util.UnstableApi
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WatchScreen(
    contentId: String,
    episodeId: String?,
    authState: AuthState,
    catalogRepository: CatalogRepository,
    uiLang: String,
    onClose: () -> Unit,
    onOpenRecommendation: (String) -> Unit,
    onUpgrade: () -> Unit,
    // RateLimitModal real do web: onUpgrade(planId) →
    // router.push(`/main/plans?highlight=${planId}`). Distingue-se de
    // onUpgrade() simples (botões "Fazer upgrade" sem plano sugerido).
    onUpgradeWithHighlight: (planId: String) -> Unit = { onUpgrade() },
    // Sessão offline (abertura de download concluído pela tela Downloads):
    // default false = fluxo remoto idêntico ao anterior.
    offline: Boolean = false
) {
    val t = LocalTranslator.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val contentLang = contentLangFor(uiLang)

    var detail by remember(contentId) { mutableStateOf<ContentDetail?>(null) }
    var loading by remember(contentId) { mutableStateOf(true) }
    var recommendations by remember(contentId) { mutableStateOf<List<ContentItem>>(emptyList()) }

    // activeEp/activeSeason do original.
    var activeEp by remember(contentId) { mutableStateOf<Episode?>(null) }
    var activeSeason by remember(contentId) { mutableIntStateOf(0) }

    // Minha Lista optimistic (toggleList: UI imediata, revert se o pedido falhar).
    var inList by remember(contentId) { mutableStateOf(false) }
    var toast by remember { mutableStateOf<String?>(null) }

    // Modais — dados SEMPRE vindos do body real do backend (nunca hardcoded).
    var rateLimit by remember { mutableStateOf<Pair<String?, List<UpsellPlan>>?>(null) }
    // Fullscreen da Watch: player ocupa a janela inteira e o chrome some
    // (equivalente ao requestFullscreen do PlayerView web).
    var fullscreen by remember(contentId) { mutableStateOf(false) }
    var sessionReplaced by remember { mutableStateOf<String?>(null) }

    // Throttle do heartbeat de progresso (lastProgressSave/lastProgressPct do original).
    var lastSaveAt by remember(contentId) { mutableLongStateOf(0L) }
    var lastPct by remember(contentId) { mutableIntStateOf(-1) }

    // Estado do download deste conteúdo — motor + store nativos (réplica
    // de startDownload() em lib/downloads.ts; ver DownloadEngine.kt).
    val downloadStore = remember { io.pixgo.app.data.download.DownloadStore(context) }
    val downloadEngine = remember { io.pixgo.app.data.download.DownloadEngine(context) }
    val downloadKey = io.pixgo.app.data.download.DownloadStore.keyFor(contentId, episodeId)
    var dlMeta by remember(downloadKey) {
        mutableStateOf<io.pixgo.app.data.download.DownloadMeta?>(null)
    }
    LaunchedEffect(downloadKey, offline) {
        if (offline) return@LaunchedEffect
        while (true) {
            dlMeta = downloadStore.allOnce().find { it.key == downloadKey }
            delay(700L)
        }
    }

    LaunchedEffect(contentId) {
        loading = true
        val d = try {
            catalogRepository.content(contentId, contentLang, authState.activeProfileId)
        } catch (e: Exception) { null }
        loading = false
        if (d == null) { toast = t.t("errors.notFound"); return@LaunchedEffect }
        detail = d
        val episodic = d.type == "series" || d.type == "anime" || d.type == "dorama"
        if (episodic && d.seasons.isNotEmpty()) {
            val allEps = d.seasons.flatMap { s -> s.episodes }
            val ep = episodeId?.let { want -> allEps.find { it.id == want } } ?: allEps.firstOrNull()
            activeEp = ep
            ep?.let { e ->
                val si = d.seasons.indexOfFirst { s -> s.episodes.any { it.id == e.id } }
                if (si >= 0) activeSeason = si
            }
        }
        if (authState.user != null) {
            // in_list embutido quando profile_id foi junto; senão check separado.
            inList = d.inListRaw ?: catalogRepository.checkMyList(contentId, authState.activeProfileId)
        }
        recommendations = try {
            catalogRepository.recommended(d.type ?: "movie", contentId, contentLang)
        } catch (e: Exception) { emptyList() }
    }

    LaunchedEffect(toast) {
        if (toast != null) { delay(2600); toast = null }
    }

    val isEpisodic = detail?.type in listOf("series", "anime", "dorama")
    // Gate real de download: plano != free E ativo (canDownload no original).
    val canDownload = authState.plan?.let { it.id != "free" && it.isActive == true } ?: false

    Box(Modifier.fillMaxSize().background(Px.BgDark)) {
        // Fullscreen: chrome da Watch some e o player ocupa a janela inteira
        // (equivalente ao fullscreenElement + hideControls do PlayerView web).
        if (fullscreen) {
            key(contentId, activeEp?.id ?: episodeId) {
                PlayerScreen(
                    contentId = contentId,
                    episodeId = activeEp?.id ?: episodeId,
                    onClose = onClose,
                    onTimeUpdate = null,
                    offline = offline,
                    fullscreen = true,
                    onToggleFullscreen = { fullscreen = false },
                    onRateLimited = { message, plans -> rateLimit = message to plans },
                    onSessionReplaced = { message -> sessionReplaced = message },
                    onNextEpisode = if (isEpisodic && activeEp != null) {
                        {
                            run {
                                val seasons = detail?.seasons ?: return@run
                                val all = seasons.flatMap { it.episodes }
                                val idx = all.indexOfFirst { it.id == activeEp?.id }
                                if (idx in 0 until all.lastIndex) {
                                    val next = all[idx + 1]
                                    activeEp = next
                                    val si = seasons.indexOfFirst { s -> s.episodes.any { it.id == next.id } }
                                    if (si >= 0) activeSeason = si
                                    lastSaveAt = 0L; lastPct = -1
                                }
                            }
                        }
                    } else null
                )
            }
        } else Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {

            // ── Voltar (btn-ghost btn-sm do topo da página) ────────────────
            Row(
                Modifier.clickable(onClick = onClose).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.ArrowBack, contentDescription = null, tint = Px.TextLight, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(t.t("common.back"), color = Px.TextLight, fontSize = 14.sp)
            }

            // ── Player-wrap 16:9 — camada de reprodução EXISTENTE ──────────
            Box(
                if (fullscreen) Modifier.fillMaxSize().background(Color.Black)
                else Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black)
            ) {
                // key por episódio: troca manual/auto-next remonta o PlayerScreen,
                // disparando onDispose → exoPlayer.release() do anterior (1 player vivo).
                key(contentId, activeEp?.id ?: episodeId) {
                        PlayerScreen(
                            contentId = contentId,
                            episodeId = activeEp?.id ?: episodeId,
                        onClose = onClose,
                        offline = offline,
                        onTimeUpdate = { curSec, durSec ->
                            // handleTime exato: user + profileId + dur válidos; 60s; skip pct repetido.
                            run {
                                if (offline) return@run // progresso remoto não se aplica a sessões locais
                                val pid = authState.activeProfileId ?: return@run
                                if (authState.user == null || durSec <= 0 || curSec < 0) return@run
                                val now = System.currentTimeMillis()
                                if (now - lastSaveAt < 60_000L) return@run
                                val pct = ((curSec.toDouble() / durSec.toDouble()) * 100).roundToInt()
                                if (pct == lastPct) return@run
                                lastSaveAt = now; lastPct = pct
                                val epId = activeEp?.id
                                scope.launch { catalogRepository.updateProgress(pid, contentId, epId, pct, durSec) }
                            }
                        },
                        fullscreen = fullscreen,
                        onToggleFullscreen = { fullscreen = !fullscreen },
                        onRateLimited = { message, plans -> rateLimit = message to plans },
                        onSessionReplaced = { message -> sessionReplaced = message },
                        onNextEpisode = if (isEpisodic && activeEp != null) {
                            {
                                // handleNext: próximo episódio na lista flat + sincroniza temporada ativa.
                                run {
                                    val seasons = detail?.seasons ?: return@run
                                    val all = seasons.flatMap { it.episodes }
                                    val idx = all.indexOfFirst { it.id == activeEp?.id }
                                    if (idx in 0 until all.lastIndex) {
                                        val next = all[idx + 1]
                                        activeEp = next
                                        val si = seasons.indexOfFirst { s -> s.episodes.any { it.id == next.id } }
                                        if (si >= 0) activeSeason = si
                                        lastSaveAt = 0L; lastPct = -1 // reset por troca de episódio (useEffect [activeEp?.id])
                                    }
                                }
                            }
                        } else null
                    )
                }
            }

            if (loading) {
                Box(Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                    PxLoadingRing()
                }
            }

            detail?.let { d ->
                Column(Modifier.padding(horizontal = 16.dp)) {
                    // ── Título + badges ────────────────────────────────────
                    Text(
                        buildString {
                            append(d.displayTitle)
                            activeEp?.let { e -> append(" · E${e.number ?: ""}: ${e.title ?: ""}") }
                        },
                        fontFamily = Montserrat,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 19.2.sp,
                        letterSpacing = (-0.384).sp,           // -0.02em
                        color = Px.TextLight,
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        d.type?.let { PxBadge(it.replaceFirstChar { c -> c.uppercase() }, PxBadgeKind.Red) }
                        d.year?.let { PxBadge(it.toString(), PxBadgeKind.Gray) }
                        d.displayRating?.takeIf { it > 0 }?.let { r ->
                            Row(
                                Modifier.background(Color(0x1AFFD700), RoundedCornerShape(999.dp))
                                    .padding(horizontal = 9.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.Star, null, tint = Color(0xFFFFD700), modifier = Modifier.size(11.dp))
                                Spacer(Modifier.width(3.dp))
                                Text(String.format(java.util.Locale.US, "%.1f", r), color = Color(0xFFFFD700), fontSize = 10.72.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))

                    // ── Ações reais: Minha Lista | Baixar (gate) | Compartilhar ──
                    FlowRow(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        ActionChip(
                            label = if (inList) t.t("content.inList") else t.t("content.addToList"),
                            icon = if (inList) Icons.Filled.BookmarkAdded else Icons.Filled.BookmarkAdd,
                            onClick = {
                                val pid = authState.activeProfileId
                                if (authState.user == null) { onClose(); return@ActionChip }
                                if (pid == null) { toast = "Perfil não encontrado."; return@ActionChip }
                                val was = inList
                                inList = !was
                                toast = if (!was) t.t("myList.added") else t.t("myList.removed")
                                scope.launch {
                                    val ok = if (was) catalogRepository.removeFromMyList(pid, contentId)
                                    else catalogRepository.addToMyList(pid, contentId)
                                    if (!ok) { inList = was; toast = t.t("errors.networkError") }
                                }
                            }
                        )
                        // Baixar — gate idêntico ao original (plano pago ativo);
                        // motor real de download por segmentos (DownloadEngine,
                        // réplica de startDownload() em lib/downloads.ts).
                        val dlStatus = dlMeta?.status
                        ActionChip(
                            label = when {
                                !canDownload -> "Premium"
                                offline || dlStatus == io.pixgo.app.data.download.DownloadStatus.COMPLETED -> "Baixado"
                                dlStatus == io.pixgo.app.data.download.DownloadStatus.DOWNLOADING -> "Baixando ${dlMeta?.progress ?: 0}%"
                                else -> "Baixar"
                            },
                            icon = if (!canDownload) Icons.Filled.Lock else Icons.Filled.Download,
                            ghost = !(offline || dlStatus == io.pixgo.app.data.download.DownloadStatus.COMPLETED),
                            onClick = {
                                if (!canDownload) { onUpgrade(); return@ActionChip }
                                if (offline || dlStatus == io.pixgo.app.data.download.DownloadStatus.COMPLETED) {
                                    toast = "Já está disponível offline."
                                    return@ActionChip
                                }
                                scope.launch {
                                    when (val r = downloadEngine.start(
                                        contentId, activeEp?.id ?: episodeId,
                                        d.displayTitle, d.displayPoster ?: ""
                                    )) {
                                        is io.pixgo.app.data.download.DownloadStart.Started ->
                                            toast = "Download concluído."
                                        is io.pixgo.app.data.download.DownloadStart.AlreadyDone ->
                                            toast = "Já está disponível offline."
                                        is io.pixgo.app.data.download.DownloadStart.GateBlocked -> {
                                            // 403 real do backend: mensagem do servidor.
                                            if (r.exhausted) onUpgrade() else toast = r.message
                                        }
                                        is io.pixgo.app.data.download.DownloadStart.Failed ->
                                            toast = r.message
                                    }
                                }
                            }
                        )
                        ActionChip(
                            label = "",
                            icon = Icons.Filled.Share,
                            ghost = true,
                            onClick = {
                                // navigator.clipboard web → share-sheet nativo do link do conteúdo.
                                val url = "https://pixgo.qzz.io/main/watch/$contentId"
                                val send = Intent(Intent.ACTION_SEND)
                                    .setType("text/plain")
                                    .putExtra(Intent.EXTRA_TEXT, url)
                                runCatching { context.startActivity(Intent.createChooser(send, d.displayTitle)) }
                            }
                        )
                    }
                    Spacer(Modifier.height(14.dp))

                    // ── Descrição (card) — ep.description || meta.description || description ──
                    val desc = d.displayDescription
                    if (!desc.isNullOrBlank()) {
                        CardBox(padding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)) { Text(desc, color = Px.TextMuted, fontSize = 13.44.sp, lineHeight = 22.85.sp) }
                        Spacer(Modifier.height(16.dp))
                    }

                    // ── Temporadas + Episódios ─────────────────────────────
                    if (isEpisodic && d.seasons.isNotEmpty()) {
                        // .card + .card-header (border-bottom) + chips de temporada + lista com altura máx. 320
                        Column(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                .background(Px.CardBg).border(1.dp, Px.Border, RoundedCornerShape(12.dp))
                        ) {
                            Box(
                                Modifier.fillMaxWidth().drawBehind {
                                    drawLine(Px.Border, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                                }.padding(horizontal = 16.dp, vertical = 11.dp)
                            ) {
                                Text(t.t("content.seasons"), fontFamily = Montserrat, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = Px.TextLight)
                            }
                            if (d.seasons.size > 1) {
                                LazyRow(
                                    Modifier.fillMaxWidth().drawBehind {
                                        drawLine(Px.Border, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                                    },
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    items(d.seasons.size) { i ->
                                        SeasonChip(
                                            label = "${t.t("content.season")} ${d.seasons[i].number ?: (i + 1)}",
                                            active = i == activeSeason,
                                            onClick = { activeSeason = i }
                                        )
                                    }
                                }
                            }
                            Column(Modifier.fillMaxWidth().heightIn(max = 320.dp).verticalScroll(rememberScrollState())) {
                                d.seasons.getOrNull(activeSeason)?.episodes?.forEach { ep ->
                                    EpisodeRow(
                                        ep = ep,
                                        playing = ep.id == activeEp?.id,
                                        onClick = {
                                            activeEp = ep
                                            lastSaveAt = 0L; lastPct = -1
                                        }
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                }

                // ── Recomendados (.watch-sidebar; em ecrã estreito empilha por baixo) ──
                Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
                    Box(
                        Modifier.fillMaxWidth().padding(bottom = 12.dp).drawBehind {
                            drawLine(Px.Border, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                        }.padding(bottom = 8.dp)
                    ) {
                        Text("Recomendados", fontFamily = Montserrat, fontWeight = FontWeight.ExtraBold, fontSize = 13.6.sp, color = Px.TextTitle)
                    }
                    if (recommendations.isEmpty()) {
                        Text("Sem recomendações disponíveis.", color = Px.TextMuted, fontSize = 12.8.sp)
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            recommendations.forEach { item -> RecommendCard(item) { onOpenRecommendation(item.id) } }
                        }
                    }
                }
            }
        }

        // ── Rate limit modal (⏱ + message/plans REAIS do 429) ─────────────
        rateLimit?.let { (message, plans) ->
            io.pixgo.app.ui.modals.RateLimitModal(
                message = message,
                plans = plans,
                onClose = { rateLimit = null; onClose() },
                onUpgrade = { planId -> rateLimit = null; onUpgradeWithHighlight(planId) }
            )
        }

        // ── Sessão substituída (🔒 + body.message do 409) ─────────────────
        sessionReplaced?.let { msg ->
            io.pixgo.app.ui.modals.SessionReplacedModal(message = msg, onClose = { sessionReplaced = null; onClose() })
        }

        // ── Toast temporário (sonner do original) ──────────────────────────
        toast?.let { text ->
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                Text(
                    text,
                    color = Px.TextLight, fontSize = 13.sp,
                    modifier = Modifier.padding(bottom = 28.dp)
                        .background(Color(0xE6000000), RoundedCornerShape(8.dp))
                        .padding(horizontal = 14.dp, vertical = 9.dp)
                )
            }
        }
    }
}

// ─── helpers visuais (tokens do globals.css já portados em PixGoTheme) ───────

/** `.btn .btn-sm` — secondary (por defeito) ou ghost; [label] vazio = só ícone. */
@Composable
private fun ActionChip(label: String, icon: ImageVector, onClick: () -> Unit, ghost: Boolean = false) {
    PxButton(
        text = label, onClick = onClick, icon = icon,
        variant = if (ghost) PxBtnVariant.Ghost else PxBtnVariant.Secondary,
        size = PxBtnSize.Sm,
    )
}

@Composable
private fun CardBox(padding: PaddingValues = PaddingValues(14.dp), content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .background(Px.CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, Px.Border, RoundedCornerShape(12.dp))
            .padding(padding)
    ) { content() }
}

/** `.filter-chip.active` reduzido (0.74rem, padding 4/10). */
@Composable
private fun SeasonChip(label: String, active: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Text(
        label,
        fontSize = 11.84.sp,
        color = if (active) Color.White else Px.TextMuted,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        modifier = Modifier
            .clip(shape)
            .background(if (active) Color(0x24E50914) else Color(0x0AFFFFFF))
            .border(1.dp, if (active) Px.Primary else Px.Border, shape)
            .pxTap(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

/** `.episode-row` (+ `.ep-playing`: fundo vermelho 7% e barra esquerda de 3px). */
@Composable
private fun EpisodeRow(ep: Episode, playing: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .background(if (playing) Color(0x12E50914) else Color.Transparent)
            .drawBehind {
                drawLine(Px.Border, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                drawRect(
                    if (playing) Px.Primary else Color.Transparent,
                    topLeft = Offset.Zero,
                    size = androidx.compose.ui.geometry.Size(3.dp.toPx(), size.height)
                )
            }
            .pxTap(onClick = onClick)
            .padding(start = 15.dp, end = 12.dp, top = 9.dp, bottom = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            Modifier.size(width = 72.dp, height = 40.dp).clip(RoundedCornerShape(4.dp)).background(Px.BgDarker),
            contentAlignment = Alignment.Center
        ) {
            if (!ep.poster.isNullOrBlank()) {
                AsyncImage(
                    model = ep.poster, contentDescription = null,
                    modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop
                )
            } else {
                Icon(
                    if (playing) Icons.Filled.PlayArrow else Icons.Filled.Movie, null,
                    tint = if (playing) Px.Primary else Px.TextMuted,
                    modifier = Modifier.size(if (playing) 16.dp else 14.dp)
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(
                "E${ep.number ?: ""} · ${ep.title ?: ""}",
                fontSize = 12.48.sp, fontWeight = FontWeight.SemiBold,
                color = if (playing) Px.Primary else Px.TextTitle,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            ep.duration?.takeIf { it > 0 }?.let {
                Text("${it / 60}min", fontSize = 10.88.sp, color = Px.TextMuted, modifier = Modifier.padding(top = 1.dp))
            }
        }
    }
}

/** `.recommend-card`: miniatura 120×68 (16:9), título 2 linhas, tipo traduzido + ano. */
@Composable
private fun RecommendCard(item: ContentItem, onClick: () -> Unit) {
    val t = LocalTranslator.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).pxTap(onClick = onClick).padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            Modifier.size(width = 120.dp, height = 68.dp).clip(RoundedCornerShape(6.dp)).background(Px.BgDarker),
            contentAlignment = Alignment.Center
        ) {
            if (!item.displayPoster.isNullOrBlank()) {
                AsyncImage(
                    model = item.displayPoster, contentDescription = null,
                    modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop
                )
            } else Icon(Icons.Filled.Movie, null, Modifier.size(20.dp), tint = Px.TextMuted)
        }
        Column(Modifier.weight(1f).padding(end = 4.dp)) {
            Text(
                item.displayTitle, fontSize = 12.8.sp, fontWeight = FontWeight.SemiBold, color = Px.TextTitle,
                lineHeight = 17.9.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item.type?.let { ty ->
                    Text(t.t("catalog.$ty").takeIf { it != "catalog.$ty" } ?: ty, fontSize = 11.2.sp, color = Px.TextMuted)
                }
                item.year?.let { Text(it.toString(), fontSize = 11.2.sp, color = Px.TextMuted) }
            }
        }
    }
}
