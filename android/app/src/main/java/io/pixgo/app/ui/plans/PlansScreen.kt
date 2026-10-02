package io.pixgo.app.ui.plans

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import io.pixgo.app.data.auth.AuthRepository
import io.pixgo.app.data.i18n.LocalTranslator
import io.pixgo.app.data.model.PaymentPlan
import io.pixgo.app.data.model.Plan
import io.pixgo.app.ui.theme.Px

/**
 * Réplica 1:1 de frontend_web/src/app/main/plans/page.tsx (rota ATIVA
 * /main/plans, v3.0):
 *  - Preço, nome e features vêm SEMPRE do backend — paymentsApi.plans()
 *    (GET /api/payments/plans em api.pixgo.qzz.io, routes/payments.js);
 *    filter(p => p.id !== 'free');
 *  - "Melhor valor" = billing_cycle === 'annual', salvo override `highlight`
 *    (no web chega via ?highlight= do RateLimitModal; aqui é o plano
 *    sugerido passado por quem abre a tela — mesmo mecanismo);
 *  - isMZN (currency==='MZN' num dos planos) → só M-Pesa nos métodos;
 *    senão Pix/Visa/Mastercard/Boleto (mesmos SVGs oficiais de
 *    public/payment-icons, copiados para assets/payment-icons);
 *  - "Assinar" → window.location.href = HUB_CHECKOUT_URL?plan=&return_to=.
 *    No Android o equivalente exacto é abrir a rota REAL de checkout do hub
 *    (https://app.pixgo.qzz.io/main/plans/checkout — para onde também a
 *    rota local /main/plans/checkout redirecciona) na WebView única já
 *    autorizada (FastWebViewSheet), com plan e return_to preservidos.
 */
private const val HUB_CHECKOUT_URL = "https://app.pixgo.qzz.io/main/plans/checkout"

private data class PaymentMethod(val name: String, val asset: String)
private val PAYMENT_METHODS = listOf(
    PaymentMethod("Pix", "payment-icons/pix.svg"),
    PaymentMethod("Visa", "payment-icons/visa.svg"),
    PaymentMethod("Mastercard", "payment-icons/mastercard.svg"),
    PaymentMethod("Boleto", "payment-icons/boleto.svg"),
)
private val MPESA_METHOD = PaymentMethod("M-Pesa", "payment-icons/M-PESA_LOGO-01.svg")

@Composable
fun PlansScreen(
    authRepository: AuthRepository,
    plan: Plan?,
    highlight: String?,
    onSubscribe: (url: String) -> Unit,
) {
    val t = LocalTranslator.current
    var plans by remember { mutableStateOf<List<PaymentPlan>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            plans = authRepository.paymentPlans()
        } catch (_: Exception) {
            error = true
        } finally {
            loading = false
        }
    }

    val isPremium = plan != null && plan.id != "free" && plan.isActive == true
    val isMZN = plans.any { it.currency == "MZN" }
    val paymentMethods = if (isMZN) listOf(MPESA_METHOD) else PAYMENT_METHODS

    fun handleSubscribe(planId: String) {
        // Equivalente ao returnTo do original (`${origin}${pathname}${search}`
        // de /main/plans), apontando para o domínio público da ferramenta.
        val returnTo = "https://pixgo.qzz.io/main/plans" +
            (highlight?.let { "?highlight=$it" } ?: "")
        onSubscribe("$HUB_CHECKOUT_URL?plan=$planId&return_to=${Uri.encode(returnTo)}")
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Px.BgDark)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
    ) {
        Column(Modifier.fillMaxWidth().widthIn(max = 1100.dp)) {
            Text(t.t("plans.title"), color = Px.TextTitle, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
            Text(
                t.t("plans.subtitle"),
                color = Px.TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (isMZN) {
                Row(
                    Modifier.padding(top = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    AsyncImage(
                        model = "file:///android_asset/${MPESA_METHOD.asset}",
                        contentDescription = "M-Pesa",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.height(26.dp),
                    )
                    Text(t.t("plans.payWithMpesa"), color = Px.TextTitle, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        if (loading) {
            Box(Modifier.fillMaxWidth().heightIn(min = 220.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Px.Primary, modifier = Modifier.size(28.dp))
            }
        }

        if (!loading && error) {
            // Texto literal idêntico ao fallback da página web.
            Text(
                "Não foi possível carregar os planos agora. Tenta novamente em instantes.",
                color = Px.TextMuted,
                fontSize = 14.sp,
            )
        }

        if (!loading && !error) {
            Column(
                Modifier.fillMaxWidth().widthIn(max = 1100.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                plans.forEach { p ->
                    val isCurrent = plan?.id == p.id && isPremium
                    val isFeatured = if (highlight != null) p.id == highlight else p.billingCycle == "annual"
                    PlansCard(
                        plan = p,
                        isCurrent = isCurrent,
                        isFeatured = isFeatured,
                        onSubscribe = { handleSubscribe(p.id) },
                    )
                }
            }

            Spacer(Modifier.height(28.dp))
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Métodos de pagamento aceites", color = Px.TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    paymentMethods.map { m ->
                        AsyncImage(
                            model = "file:///android_asset/${m.asset}",
                            contentDescription = m.name,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .height(32.dp)
                                .clip(RoundedCornerShape(6.dp)),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PlansCard(
    plan: PaymentPlan,
    isCurrent: Boolean,
    isFeatured: Boolean,
    onSubscribe: () -> Unit,
) {
    val shape = RoundedCornerShape(Px.Radius)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Px.CardBg)
            .border(1.dp, if (isFeatured) Px.Primary.copy(alpha = 0.5f) else Px.Border, shape)
            .padding(20.dp),
    ) {
        if (isFeatured) {
            Box(
                Modifier.align(Alignment.End).clip(RoundedCornerShape(6.dp)).background(Px.Primary)
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text("Melhor valor", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(8.dp))
        }
        Text(plan.name, color = Px.TextTitle, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
        Spacer(Modifier.height(4.dp))
        Text(plan.label ?: "", color = Px.TextTitle, fontWeight = FontWeight.Black, fontSize = 24.sp)
        Spacer(Modifier.height(14.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            plan.features.forEach { f -> FeatureRow(f) }
            val profiles = plan.maxProfiles ?: 1
            FeatureRow("$profiles " + if (profiles == 1) "perfil" else "perfis")
            FeatureRow(
                if (plan.maxDownloads == null) "Downloads ilimitados"
                else "Até ${plan.maxDownloads} downloads/mês"
            )
        }
        Spacer(Modifier.height(20.dp))
        val btnShape = RoundedCornerShape(Px.RadiusSm)
        Box(
            Modifier
                .fillMaxWidth()
                .clip(btnShape)
                .background(if (isCurrent) Color(0xFF1A1A20) else Px.Primary)
                .then(if (isCurrent) Modifier else Modifier.clickable(onClick = onSubscribe))
                .padding(vertical = 11.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (isCurrent) "Plano atual" else "Assinar",
                color = if (isCurrent) Px.TextMuted else Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun FeatureRow(text: String) {
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = Px.Secondary)
        Text(text, color = Px.TextMuted, fontSize = 13.sp, lineHeight = 19.sp)
    }
}
