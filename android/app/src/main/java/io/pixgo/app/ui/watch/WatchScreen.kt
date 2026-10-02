package io.pixgo.app.ui.watch

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
                    CircularProgressIndicator(color = Px.Primary)
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
                        fontFamily = MaterialTheme.typography.displaySmall.fontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 19.sp,
                        color = Px.TextTitle,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        d.type?.let { Badge(it.replaceFirstChar { c -> c.uppercase() }, Px.Primary.copy(alpha = 0.15f), Px.PrimaryGlow) }
                        d.year?.let { Badge(it.toString(), Color(0x1FFFFFFF), Px.TextMuted) }
                        d.displayRating?.takeIf { it > 0 }?.let { r ->
                            Row(
                                Modifier.background(Color(0x1AFFD700), RoundedCornerShape(999.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.Star, null, tint = Color(0xFFFFD700), modifier = Modifier.size(11.dp))
                                Spacer(Modifier.width(3.dp))
                                Text(String.format("%.1f", r), color = Color(0xFFFFD700), fontSize = 11.sp)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))

                    // ── Ações reais: Minha Lista | Baixar (gate) | Compartilhar ──
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
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
                            label = "Compartilhar",
                            icon = Icons.Filled.Share,
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
                        CardBox { Text(desc, color = Px.TextMuted, fontSize = 13.sp, lineHeight = 21.sp) }
                        Spacer(Modifier.height(16.dp))
                    }

                    // ── Temporadas + Episódios ─────────────────────────────
                    if (isEpisodic && d.seasons.isNotEmpty()) {
                        CardBox {
                            Text(t.t("content.seasons"), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Px.TextTitle)
                            Spacer(Modifier.height(8.dp))
                            if (d.seasons.size > 1) {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    items(d.seasons.size) { i ->
                                        SeasonChip(
                                            label = "${t.t("content.season")} ${d.seasons[i].number ?: (i + 1)}",
                                            active = i == activeSeason,
                                            onClick = { activeSeason = i }
                                        )
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                            }
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
                        Spacer(Modifier.height(16.dp))
                    }
                }

                // ── Recomendados (sidebar do desktop; no mobile CSS empilha embaixo) ──
                Column(Modifier.padding(horizontal = 16.dp)) {
                    Text(
                        "Recomendados",
                        fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = Px.TextTitle,
                        modifier = Modifier.padding(bottom = 10.dp)
                    )
                    if (recommendations.isEmpty()) {
                        Text(
                            "Sem recomendações disponíveis.",
                            color = Px.TextMuted, fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 24.dp)
                        )
                    } else {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 24.dp)) {
                            items(recommendations) { item ->
                                RecommendCard(item) { onOpenRecommendation(item.id) }
                            }
                        }
                    }
                }
            }
        }

        // ── Rate limit modal (⏱ + message/plans REAIS do 429) ─────────────
        rateLimit?.let { (message, plans) ->
            RateLimitDialog(
                message = message,
                plans = plans,
                onClose = { rateLimit = null; onClose() },
                onUpgrade = { rateLimit = null; onUpgrade() }
            )
        }

        // ── Sessão substituída (🔒 + body.message do 409) ─────────────────
        sessionReplaced?.let { msg ->
            SessionReplacedDialog(message = msg, onClose = { sessionReplaced = null; onClose() })
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

@Composable
private fun Badge(text: String, bg: Color, fg: Color) {
    Text(
        text, fontSize = 11.sp, color = fg, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.background(bg, RoundedCornerShape(999.dp)).padding(horizontal = 8.dp, vertical = 3.dp)
    )
}

@Composable
private fun ActionChip(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier.background(Px.CardHover, RoundedCornerShape(6.dp))
            .border(1.dp, Px.Border, RoundedCornerShape(6.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = Px.TextLight, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Px.TextLight, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun CardBox(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .background(Px.CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, Px.Border, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) { content() }
}

@Composable
private fun SeasonChip(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        label,
        fontSize = 12.sp,
        color = if (active) Px.PrimaryGlow else Px.TextMuted,
        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
        modifier = Modifier
            .background(if (active) Px.Primary.copy(alpha = 0.12f) else Color.Transparent, RoundedCornerShape(999.dp))
            .border(1.dp, if (active) Px.Primary.copy(alpha = 0.5f) else Px.Border, RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp)
    )
}

@Composable
private fun EpisodeRow(ep: Episode, playing: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .background(
                if (playing) Brush.horizontalGradient(listOf(Px.Primary.copy(alpha = 0.07f), Color.Transparent))
                else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent))
            )
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(width = 72.dp, height = 40.dp).clip(RoundedCornerShape(4.dp))
                .background(Px.BgDarker),
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = ep.poster,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            if (ep.poster == null) {
                Icon(
                    if (playing) Icons.Filled.PlayArrow else Icons.Filled.Star,
                    null,
                    tint = if (playing) Px.Primary else Px.TextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                "E${ep.number ?: ""} · ${ep.title ?: ""}",
                fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                color = if (playing) Px.Primary else Px.TextTitle,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            ep.duration?.takeIf { it > 0 }?.let {
                Text("${it / 60}min", fontSize = 11.sp, color = Px.TextMuted)
            }
        }
    }
}

@Composable
private fun RecommendCard(item: ContentItem, onClick: () -> Unit) {
    Row(
        Modifier.width(220.dp).clip(RoundedCornerShape(6.dp)).clickable(onClick = onClick).padding(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = item.displayPoster, contentDescription = item.displayTitle,
            modifier = Modifier.size(width = 64.dp, height = 90.dp).clip(RoundedCornerShape(4.dp)),
            contentScale = ContentScale.Crop
        )
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                item.displayTitle, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Px.TextTitle,
                maxLines = 2, overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Text(
                listOfNotNull(item.type, item.year?.toString()).joinToString(" · "),
                fontSize = 10.sp, color = Px.TextMuted
            )
        }
    }
}

@Composable
private fun RateLimitDialog(
    message: String?,
    plans: List<UpsellPlan>,
    onClose: () -> Unit,
    onUpgrade: () -> Unit
) {
    val t = LocalTranslator.current
    AlertDialog(
        onDismissRequest = onClose,
        containerColor = Px.CardBg,
        title = { Text("⏱ Limite diário atingido", color = Px.TextTitle, fontWeight = FontWeight.Black) },
        text = {
            Column {
                Text(
                    message ?: "Limite diário do plano gratuito atingido. Assine para streaming ilimitado.",
                    color = Px.TextMuted, fontSize = 13.sp, lineHeight = 20.sp
                )
                val featured = plans.find { it.billingCycle == "monthly" } ?: plans.firstOrNull()
                if (featured != null) {
                    Spacer(Modifier.height(12.dp))
                    Column(
                        Modifier.fillMaxWidth().background(Px.BgDarker, RoundedCornerShape(10.dp))
                            .border(1.dp, Px.Primary, RoundedCornerShape(10.dp)).padding(14.dp)
                    ) {
                        Text(featured.name ?: "", fontSize = 12.sp, color = Px.TextMuted)
                        Text(
                            "por apenas ${featured.label ?: ""}",
                            fontSize = 20.sp, fontWeight = FontWeight.Black, color = Px.TextTitle
                        )
                        featured.features.take(4).forEach { f ->
                            Text("✓ $f", fontSize = 12.sp, color = Px.TextMuted)
                        }
                    }
                }
                val others = plans.filter { it.id != featured?.id }
                if (others.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Também disponível: ${others.joinToString(" · ") { it.label ?: it.id }}",
                        fontSize = 11.sp, color = Px.TextMuted
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onUpgrade) { Text("Assinar", color = Px.PrimaryGlow) } },
        dismissButton = { TextButton(onClick = onClose) { Text(t.t("common.close")) } }
    )
}

@Composable
private fun SessionReplacedDialog(message: String, onClose: () -> Unit) {
    DialogShell(
        title = "🔒 Sessão encerrada",
        message = message,
        primaryLabel = "Entendi",
        onPrimary = onClose,
    )
}

/**
 * Diálogo modal no padrão visual dos modais do frontend (UploadTermsModal/
 * UploadRulesModal/SessionReplacedModal): overlay rgba(0,0,0,.82), card
 * #121216 borda #1F1F26 raio 14, título Montserrat 800, corpo muted 13sp,
 * rodapé com botões. Reutilizado pela tela de Upload (uploadDialogs).
 */
@Composable
fun DialogShell(
    title: String,
    message: String,
    primaryLabel: String,
    onPrimary: () -> Unit,
    secondaryLabel: String? = null,
    onSecondary: (() -> Unit)? = null,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xD1000000)) // rgba(0,0,0,0.82)
            .clickable(enabled = false) {},
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Px.CardBg)
                .border(1.dp, Px.Border, RoundedCornerShape(14.dp))
                .padding(20.dp)
        ) {
            Text(title, color = Px.TextTitle, fontWeight = FontWeight.Black, fontSize = 17.sp)
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                Text(message, color = Px.TextMuted, fontSize = 13.sp, lineHeight = 20.sp)
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (secondaryLabel != null && onSecondary != null) {
                    TextButton(
                        onClick = onSecondary,
                        modifier = Modifier.weight(1f).clip(RoundedCornerShape(6.dp)).background(Color(0xFF1A1A20)),
                    ) { Text(secondaryLabel, color = Px.TextMuted, fontSize = 13.sp) }
                }
                TextButton(
                    onClick = onPrimary,
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(6.dp)).background(Px.Primary.copy(alpha = 0.15f)),
                ) { Text(primaryLabel, color = Px.PrimaryGlow, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}
