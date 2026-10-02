package io.pixgo.app.ui.upload

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import io.pixgo.app.data.auth.AuthRepository
import io.pixgo.app.data.i18n.LocalTranslator
import io.pixgo.app.data.network.UploadMetadata
import io.pixgo.app.data.network.UploadPrecheckRequest
import io.pixgo.app.data.network.UploaderInfo
import io.pixgo.app.ui.theme.Px
import io.pixgo.app.ui.watch.DialogShell
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.Calendar

/**
 * Upload nativo — réplica funcional de app/main/upload/page.tsx (fluxo ATIVO;
 * entrada pela sidebar "Enviar conteúdo" e pelo menu do usuário, como no web).
 *
 * Contrato real (lib/api.ts uploadApi → copyright.pixgo.qzz.io):
 *   POST /precheck            { metadata, uploader, goCreative, videoUrl, thumbnailUrl, dispatch }
 *   GET  /precheck-status/:id (polling 15s enquanto status == 'pending')
 *
 * Termos = consentimento único persistido (equivalente do localStorage
 * 'pixgo_upload_terms_accepted'); fila rules→guide reaparece a cada visita.
 */

private val NEW_TYPES = listOf("entertainment", "finance", "travel", "education", "courses")
private val EXISTING_TYPES = listOf("movie", "series", "anime", "dorama", "documentary")
private val TYPE_OPTIONS = NEW_TYPES + EXISTING_TYPES
private val SERIES_TYPES = setOf("series", "anime", "dorama")
private const val WORKSPACE_URL = "https://workspace.pixgo.qzz.io"

@Composable
fun UploadScreen(authRepository: AuthRepository, onBack: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Consentimento único + fila de lembretes (page.tsx useEffect inicial).
    var termsAccepted by remember { mutableStateOf<Boolean?>(null) }
    var showTerms by remember { mutableStateOf(false) }
    var helperModal by remember { mutableStateOf<String?>(null) } // "rules" | "guide"

    LaunchedEffect(Unit) {
        val accepted = authRepository.getUploadTermsAccepted()
        termsAccepted = accepted
        if (!accepted) showTerms = true else helperModal = "rules"
    }

    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(TYPE_OPTIONS.first()) }
    var year by remember { mutableStateOf("") }
    var lang by remember { mutableStateOf("pt") }
    var url by remember { mutableStateOf("") }
    var fileIndices by remember { mutableStateOf("") }
    var thumbnail by remember { mutableStateOf("") }
    var thumbOk by remember { mutableStateOf(false) }
    var contentId by remember { mutableStateOf("") }
    var season by remember { mutableStateOf("1") }
    var advOpen by remember { mutableStateOf(false) }
    var goCreative by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<AuthRepository.UploadResult2?>(null) }
    var error by remember { mutableStateOf("") }

    // Polling 15s enquanto pending (setInterval de 15000ms no original; erro silencioso).
    LaunchedEffect(result) {
        while (result?.status == "pending") {
            delay(15_000)
            val cur = result ?: break
            runCatching { authRepository.uploadStatus(cur.id) }.onSuccess { s ->
                if (s.status != "pending") result = s
            }
        }
    }

    val isSeries = type in SERIES_TYPES
    val isMagnetLike = url.startsWith("magnet:") || url.endsWith(".torrent")

    fun resetForm() {
        result = null; title = ""; description = ""; year = ""; url = ""
        fileIndices = ""; thumbnail = ""; thumbOk = false; contentId = ""; season = "1"; advOpen = false
    }

    suspend fun submit() {
        error = ""
        if (title.isBlank() || url.isBlank()) { error = t.t("errors.requiredFields"); return }
        if (isSeries && contentId.isBlank()) { error = t.t("errors.requiredFields"); return }
        if (isSeries && !isMagnetLike) { error = t.t("upload.seriesNeedsMagnet"); return }
        submitting = true
        try {
            val user = authRepository.state.value.user
            // Valores fixos da pipeline (constantes em page.tsx).
            val advanced = buildJsonObject {
                put("seg_duration", JsonPrimitive("4"))
                put("max_encode_height", JsonPrimitive("720"))
                put("warm_concurrency", JsonPrimitive("8"))
            }
            val dispatch = buildJsonObject {
                if (isSeries) {
                    put("type", JsonPrimitive("manual"))
                    put("season_number", JsonPrimitive(season.toIntOrNull() ?: 1))
                } else {
                    put("type", JsonPrimitive("lote"))
                    put("lote", JsonPrimitive("A"))
                }
                put("file_indices", JsonPrimitive(fileIndices.trim()))
                advanced.forEach { (k, v) -> put(k, v) }
            }
            result = authRepository.uploadPrecheck(
                UploadPrecheckRequest(
                    metadata = UploadMetadata(
                        title = title.trim(),
                        description = description.trim(),
                        type = type,
                        year = year.toIntOrNull() ?: Calendar.getInstance().get(Calendar.YEAR),
                        lang = lang.trim().ifBlank { "pt" },
                        contentId = contentId.trim().ifBlank { null },
                    ),
                    uploader = UploaderInfo(id = user?.id, username = user?.username, email = user?.email),
                    goCreative = goCreative,
                    videoUrl = url.trim(),
                    thumbnailUrl = thumbnail.trim(),
                    dispatch = dispatch,
                )
            )
        } catch (e: Exception) {
            error = e.message?.takeIf { it.isNotBlank() } ?: t.t("errors.generic")
        } finally {
            submitting = false
        }
    }

    Box(Modifier.fillMaxSize().background(Px.BgDark)) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Coluna central maxWidth 640dp do original.
            Column(Modifier.fillMaxWidth().widthIn(max = 640.dp)) {
                Text(t.t("upload.formTitle"), color = Px.TextTitle, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                Text(t.t("upload.formSubtitle"), color = Px.TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp, bottom = 16.dp))

                // Card Workspace (bloco explícito do original).
                UploadCard(padH = 18.dp, padV = 16.dp) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(t.t("upload.workspaceLabel"), color = Px.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(6.dp))
                            Row(
                                Modifier.clip(RoundedCornerShape(Px.RadiusSm)).background(Px.Primary)
                                    .clickable { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(WORKSPACE_URL))) } }
                                    .padding(horizontal = 14.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.OpenInNew, null, Modifier.size(15.dp), tint = Color.White)
                                Spacer(Modifier.width(6.dp))
                                Text(t.t("upload.workspaceButton"), color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(20.dp))

                val r = result
                if (r != null) {
                    UploadCard(padH = 18.dp, padV = 24.dp) {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                            when (r.status) {
                                "blocked" -> UploadStatusBlock(Icons.Filled.Block, Px.Primary, t.t("upload.statusBlocked"),
                                    "${t.t("upload.statusBlockedDesc")} ${t.t("contact.supportEmail")}")
                                "pending" -> UploadStatusBlock(Icons.Filled.HourglassEmpty, Px.Secondary, t.t("upload.statusPending"), t.t("upload.statusPendingDesc"))
                                "approved" -> UploadStatusBlock(Icons.Filled.CheckCircle, Px.Secondary, t.t("upload.statusApproved"), t.t("upload.statusApprovedDesc"))
                                "rejected" -> UploadStatusBlock(Icons.Filled.Block, Px.Primary, t.t("upload.statusRejected"), null)
                            }
                            if (r.status != "pending") {
                                Spacer(Modifier.height(16.dp))
                                UploadButton(label = t.t("upload.formTitle"), primary = false) { resetForm() }
                            }
                        }
                    }
                } else {
                    UploadCard(padH = 18.dp, padV = 20.dp) {
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            UploadFieldLabel(t.t("upload.fieldUrl"))
                            UploadInput(url, { url = it }, placeholder = "https://...")

                            UploadFieldLabel(t.t("upload.fieldTitle"))
                            UploadInput(title, { title = it })

                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Column(Modifier.weight(1.5f)) {
                                    UploadFieldLabel(t.t("upload.fieldType"))
                                    UploadDropdown(
                                        options = TYPE_OPTIONS.map { t.t("catalog.$it") to it },
                                        selected = type,
                                    ) { type = it }
                                }
                                Column(Modifier.weight(0.75f)) {
                                    UploadFieldLabel(t.t("upload.fieldYear"))
                                    UploadInput(year, { year = it }, placeholder = Calendar.getInstance().get(Calendar.YEAR).toString(), numeric = true)
                                }
                                Column(Modifier.weight(0.75f)) {
                                    UploadFieldLabel(t.t("upload.fieldLang"))
                                    UploadInput(lang, { if (it.length <= 5) lang = it }, placeholder = "pt")
                                }
                            }

                            if (isSeries) {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(Modifier.weight(2f)) {
                                        UploadFieldLabel(t.t("upload.fieldContentId"))
                                        UploadInput(contentId, { contentId = it })
                                    }
                                    Column(Modifier.weight(1f)) {
                                        UploadFieldLabel(t.t("upload.fieldSeason"))
                                        UploadInput(season, { season = it }, numeric = true)
                                    }
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                                Column(Modifier.weight(1f)) {
                                    UploadFieldLabel(t.t("upload.fieldThumbnail"))
                                    UploadInput(thumbnail, { thumbnail = it; thumbOk = false }, placeholder = "https://...")
                                }
                                if (thumbnail.startsWith("http")) {
                                    Spacer(Modifier.height(22.dp))
                                    AsyncImage(
                                        model = thumbnail,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.size(width = 96.dp, height = 54.dp)
                                            .clip(RoundedCornerShape(7.dp))
                                            .border(1.dp, Px.Border, RoundedCornerShape(7.dp))
                                            .background(Px.CardBg),
                                        onSuccess = { thumbOk = true },
                                        onError = { thumbOk = false },
                                    )
                                }
                            }

                            UploadFieldLabel(t.t("upload.fieldDescription"))
                            UploadInput(description, { description = it }, multiLine = true)

                            // PixGo Creative — escolha do criador, não deteção automática.
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                                    .border(1.dp, Px.Border, RoundedCornerShape(8.dp))
                                    .clickable { goCreative = !goCreative }.padding(12.dp),
                                verticalAlignment = Alignment.Top,
                            ) {
                                Checkbox(
                                    checked = goCreative,
                                    onCheckedChange = { goCreative = it },
                                    colors = CheckboxDefaults.colors(checkedColor = Px.Primary, checkmarkColor = Color.White),
                                )
                                Column(Modifier.padding(top = 6.dp)) {
                                    Text(t.t("upload.goCreativeLabel"), color = Px.TextTitle, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    Spacer(Modifier.height(2.dp))
                                    Text(t.t("upload.goCreativeHint"), color = Px.TextMuted, fontSize = 11.sp)
                                }
                            }

                            // Opções avançadas escondidas por defeito (igual ao original).
                            Row(Modifier.clickable { advOpen = !advOpen }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.ExpandMore, null, Modifier.size(18.dp), tint = Px.TextMuted)
                                Spacer(Modifier.width(4.dp))
                                Text(t.t("upload.advancedOptions"), color = Px.TextMuted, fontSize = 13.sp)
                            }
                            if (advOpen) {
                                if (!isSeries) {
                                    Column {
                                        UploadFieldLabel(t.t("upload.fieldContentId"))
                                        UploadInput(contentId, { contentId = it })
                                        Text(t.t("upload.fieldContentIdHint"), color = Px.TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                                    }
                                }
                                Column {
                                    UploadFieldLabel(t.t("upload.fieldFileIndices"))
                                    UploadInput(fileIndices, { fileIndices = it })
                                    Text(t.t("upload.fieldFileIndicesHint"), color = Px.TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                                }
                            }

                            if (error.isNotEmpty()) Text(error, color = Px.Primary, fontSize = 12.sp)

                            UploadButton(
                                label = if (submitting) t.t("upload.submitting") else t.t("upload.submit"),
                                enabled = !submitting,
                            ) { scope.launch { submit() } }
                        }
                    }
                }
            }
        }

        // Modais na ordem real: Terms (uma vez, Aceito/Recusa) → rules → guide.
        if (showTerms && termsAccepted == false) {
            DialogShell(
                title = t.t("upload.termsTitle"),
                message = buildString {
                    appendLine(t.t("upload.termsSubtitle")); appendLine()
                    for (i in 1..12) { appendLine(t.t("upload.t${i}t")); appendLine(t.t("upload.t$i")); appendLine() }
                },
                primaryLabel = t.t("upload.accept"),
                onPrimary = {
                    scope.launch { authRepository.setUploadTermsAccepted(true) }
                    termsAccepted = true; showTerms = false; helperModal = "rules"
                },
                secondaryLabel = t.t("upload.decline"),
                onSecondary = onBack,
            )
        } else if (helperModal == "rules") {
            DialogShell(
                title = t.t("uploadRules.title"),
                message = buildString {
                    appendLine(t.t("uploadRules.subtitle")); appendLine()
                    for (i in 1..3) { appendLine(t.t("uploadRules.s${i}t")); appendLine(t.t("uploadRules.s$i")); appendLine() }
                },
                primaryLabel = t.t("uploadRules.understood"),
                onPrimary = { helperModal = "guide" },
                secondaryLabel = t.t("uploadRules.hide"),
                onSecondary = { helperModal = "guide" },
            )
        } else if (helperModal == "guide") {
            DialogShell(
                title = t.t("uploadGuide.title"),
                message = buildString {
                    appendLine(t.t("uploadGuide.subtitle")); appendLine()
                    for (i in 1..4) { appendLine(t.t("uploadGuide.s${i}t")); appendLine(t.t("uploadGuide.s$i")); appendLine() }
                },
                primaryLabel = t.t("uploadGuide.understood"),
                onPrimary = { helperModal = null },
                secondaryLabel = t.t("uploadGuide.hide"),
                onSecondary = { helperModal = null },
            )
        }
    }
}

// ── Helpers visuais (padrão .card/.form-input/.btn dos tokens portados) ──────

@Composable
internal fun UploadCard(padH: androidx.compose.ui.unit.Dp, padV: androidx.compose.ui.unit.Dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Px.Radius))
            .background(Px.CardBg).border(1.dp, Px.Border, RoundedCornerShape(Px.Radius))
            .padding(horizontal = padH, vertical = padV),
        content = content,
    )
}


@Composable
internal fun UploadFieldLabel(text: String) {
    Text(text, color = Px.TextTitle, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
}

@Composable
internal fun UploadInput(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String = "",
    multiLine: Boolean = false,
    numeric: Boolean = false,
) {
    BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = !multiLine,
        minLines = if (multiLine) 3 else 1,
        textStyle = TextStyle(color = Px.TextTitle, fontSize = 13.sp),
        cursorBrush = SolidColor(Px.PrimaryGlow),
        keyboardOptions = KeyboardOptions(keyboardType = if (numeric) KeyboardType.Number else KeyboardType.Text),
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Px.RadiusSm))
            .background(Color(0xFF0E0E12)).border(1.dp, Px.Border, RoundedCornerShape(Px.RadiusSm))
            .padding(horizontal = 10.dp, vertical = 9.dp),
        decorationBox = { inner ->
            Box {
                if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, color = Px.TextMuted.copy(alpha = 0.6f), fontSize = 13.sp)
                inner()
            }
        },
    )
}

@Composable
internal fun UploadDropdown(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val sel = options.firstOrNull { it.second == selected }?.first ?: selected
    Box {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(Px.RadiusSm))
                .background(Color(0xFF0E0E12)).border(1.dp, Px.Border, RoundedCornerShape(Px.RadiusSm))
                .clickable { open = !open }.padding(horizontal = 10.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(sel, color = Px.TextTitle, fontSize = 13.sp)
            Icon(Icons.Filled.ExpandMore, null, Modifier.size(16.dp), tint = Px.TextMuted)
        }
        if (open) {
            Column(
                Modifier.fillMaxWidth().padding(top = 2.dp).clip(RoundedCornerShape(Px.RadiusSm))
                    .background(Px.CardBg).border(1.dp, Px.Border, RoundedCornerShape(Px.RadiusSm))
            ) {
                options.forEach { (label, value) ->
                    Text(
                        label,
                        color = if (value == selected) Px.PrimaryGlow else Px.TextMuted,
                        fontSize = 13.sp,
                        modifier = Modifier.fillMaxWidth().clickable { onSelect(value); open = false }.padding(horizontal = 10.dp, vertical = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
internal fun UploadButton(label: String, enabled: Boolean = true, primary: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Px.RadiusSm))
            .background(if (primary) Px.Primary else Color(0xFF1A1A20))
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (primary) Color.White else Px.TextTitle, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun UploadStatusBlock(icon: ImageVector, color: Color, title: String, desc: String?) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, Modifier.size(40.dp), tint = color)
        Spacer(Modifier.height(10.dp))
        Text(title, color = Px.TextTitle, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
        if (desc != null) {
            Spacer(Modifier.height(6.dp))
            Text(desc, color = Px.TextMuted, fontSize = 13.sp, lineHeight = 20.sp)
        }
    }
}
