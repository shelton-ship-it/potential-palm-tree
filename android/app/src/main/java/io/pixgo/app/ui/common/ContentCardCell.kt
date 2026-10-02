package io.pixgo.app.ui.common

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import io.pixgo.app.ui.theme.Px

/**
 * Réplica 1:1 de components/ui/ContentCard.tsx (+ .content-card/.content-thumb/
 * .content-info/.content-type-bar/.content-progress/card-action-btn em
 * globals.css):
 *  - thumb 2:3 (ou 16:9 quando wide) com poster, placeholder gradiente
 *    (MovieIcon + título — não imagem estática), barra de tipo colorida de 3px
 *    no topo (TYPE_COLORS verbatim do original), badge de rating dourado
 *    top-right (rgba(0,0,0,0.78)), badge de tipo traduzido bottom-left
 *    (rgba(0,0,0,0.72), chaves catalog.*), barra de progresso 3px;
 *  - info: padding 8/10/10, título 0.8rem/600 duas linhas line-height 1.4,
 *    meta 0.7rem com ano + rating (#ffd700);
 *  - ações: botões 32×32 radius 6 (Add/Check quando inList, Share), separador
 *    superior 1px — só aparecem quando os callbacks são passados, tal como o
 *    condicional {(onAddToList || onShare)} do original.
 * Hover-overlay de play NÃO é replicado: no web ele só existe sob
 * @media (hover:hover) e pointer:fine (comentário explícito em ContentCard.tsx
 * — toque no telemóvel deixá-lo-ia preso). Em Android equivaleria a um estado
 * pressed sem pedido no frontend, portanto foi omitido por decisão informada.
 */

/** TYPE_COLORS literal de ContentCard.tsx (ordem irrelevante). */
private val TYPE_COLORS = mapOf(
    "movie"       to Color(0xFFE50914),
    "series"      to Color(0xFFFF6B00),
    "anime"       to Color(0xFFFF0080),
    "documentary" to Color(0xFF00A8FF),
    "dorama"      to Color(0xFF9C27B0),
    "channel"     to Color(0xFF1CE783)
)

/** t(`catalog.${type}`) — mesmas chaves/valores de assets/locales/pt.json. */
private val CATALOG_TYPE_LABELS = mapOf(
    "movie" to "Filmes",
    "series" to "Séries",
    "anime" to "Anime",
    "documentary" to "Documentários",
    "dorama" to "Animações",
    "channel" to "Canais"
)

private fun fmtRating(r: Double?): String? =
    if (r == null || r <= 0.0) null else String.format("%.1f", r)

@Composable
fun ContentCardCell(
    title: String,
    posterUrl: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    year: Int? = null,
    type: String? = null,
    rating: Double? = null,
    progress: Double? = null,
    inList: Boolean? = null,
    wide: Boolean = false,
    typeLabel: String? = null,
    onAddToList: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null
) {
    // const typeColor = type ? (TYPE_COLORS[type] ?? '#e50914') : '#e50914'
    val typeColor = if (type != null) TYPE_COLORS[type] ?: Px.Primary else Px.Primary
    val ratingStr = fmtRating(rating)
    val shape = RoundedCornerShape(12.dp)

    Column(
        modifier
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .clickable(onClick = onClick)
    ) {
        // ── .content-thumb (aspect 2/3; wide → 16/9) ────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(if (wide) 16f / 9f else 2f / 3f)
                .background(Px.BgDarker)
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
        ) {
            if (!posterUrl.isNullOrBlank()) {
                AsyncImage(
                    model = posterUrl,
                    contentDescription = title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                // .content-thumb-placeholder: gradiente 135deg #1a1a20→#0d0d12,
                // MovieIcon 32 (26 se wide) + título 0.72rem centrado.
                Column(
                    Modifier
                        .fillMaxSize()
                        .background(
                            androidx.compose.ui.graphics.Brush.linearGradient(
                                listOf(Color(0xFF1A1A20), Color(0xFF0D0D12))
                            )
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Filled.Movie,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(if (wide) 26.dp else 32.dp)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        title,
                        fontSize = 11.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 6.dp)
                    )
                }
            }

            // .content-type-bar — 3px no topo, cor do type
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .align(Alignment.TopStart)
                    .background(typeColor)
            )

            // Badge de rating — inline style do original: top 8 / right 8,
            // rgba(0,0,0,0.78), radius 4, padding 2×6, StarIcon 11 #ffd700
            if (ratingStr != null) {
                Row(
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .background(Color(0xC7000000), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = null,
                        tint = Color(0xFFFFD700),
                        modifier = Modifier.size(11.dp)
                    )
                    Text(ratingStr, fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.SemiBold)
                }
            }

            // Badge de tipo — bottom 12 se houver progress, senão 8; left 8
            // right 8 maxWidth fit-content; rgba(0,0,0,0.72) radius 4
            if (type != null) {
                Text(
                    text = typeLabel ?: CATALOG_TYPE_LABELS[type] ?: type,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 8.dp, end = 8.dp, bottom = if ((progress ?: 0.0) > 0.0) 12.dp else 8.dp)
                        .background(Color(0xB8000000), RoundedCornerShape(4.dp))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                )
            }

            // .content-progress — 3px, fundo rgba(255,255,255,0.14), fill primário
            if (progress != null && progress > 0.0) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .align(Alignment.BottomCenter)
                        .background(Color(0x24FFFFFF))
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(minOf(progress, 100.0).toFloat() / 100f)
                            .height(3.dp)
                            .background(Px.Primary)
                    )
                }
            }
        }

        // ── .content-info — padding 8px 10px 10px ───────────────────────────
        Column(Modifier.padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 10.dp)) {
            // .content-title — 0.8rem/600, clamp 2, line-height 1.4, mb 4
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                lineHeight = 18.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(bottom = 4.dp)
            )

            // .content-meta — flex gap 7, 0.7rem muted; year + rating(#ffd700)
            if (year != null || ratingStr != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    if (year != null) {
                        Text(year.toString(), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (ratingStr != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier.align(Alignment.CenterVertically)
                        ) {
                            Icon(
                                Icons.Filled.Star,
                                contentDescription = null,
                                tint = Color(0xFFFFD700),
                                modifier = Modifier.size(11.dp)
                            )
                            Text(ratingStr, fontSize = 11.sp, color = Color(0xFFFFD700))
                        }
                    }
                }
            }

            // .content-actions — mt 7 pt 7 border-top; botões 32×32 radius 6
            if (onAddToList != null || onShare != null) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 7.dp)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        .padding(top = 7.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (onAddToList != null) {
                        CardActionButton(
                            active = inList == true,
                            onClick = onAddToList
                        ) {
                            if (inList == true) {
                                Icon(Icons.Filled.Check, contentDescription = "Remover da lista", modifier = Modifier.size(16.dp))
                            } else {
                                Icon(Icons.Filled.Add, contentDescription = "Adicionar à lista", modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                    if (onShare != null) {
                        CardActionButton(active = false, onClick = onShare) {
                            Icon(Icons.Filled.Share, contentDescription = "Compartilhar", modifier = Modifier.size(15.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CardActionButton(
    active: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(6.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        androidx.compose.runtime.CompositionLocalProvider(
            LocalContentCardActionTint provides if (active) Px.Primary else MaterialTheme.colorScheme.onSurfaceVariant
        ) {
            content()
        }
    }
}

private val LocalContentCardActionTint = compositionLocalOf { Color.Unspecified }
