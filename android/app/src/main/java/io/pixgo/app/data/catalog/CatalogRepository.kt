package io.pixgo.app.data.catalog

import android.content.Context
import io.pixgo.app.data.auth.AuthRepository
import io.pixgo.app.data.auth.TokenManager
import io.pixgo.app.data.model.ContentItem
import io.pixgo.app.data.model.ContentDetail
import io.pixgo.app.data.model.ContinueItem
import io.pixgo.app.data.model.MyListEntry
import io.pixgo.app.data.network.MyListMutationBody
import io.pixgo.app.data.model.ProgressUpdateBody
import io.pixgo.app.data.network.NetworkModule
import retrofit2.Response

/**
 * Espelha o loadPage()/progressApi.continue de app/main/page.tsx:
 *  - GET /api/catalog?limit=24&page=N&sort=recent&feed=1(&profile_id=)
 *  - GET /api/progress/continue?limit=6
 * `lang` fixo em "pt" por agora — a UI original manda o idioma activo do
 * i18next; a escolha de idioma na app nativa ainda não foi implementada,
 * por isso não finjo uma lógica que não existe aqui ainda.
 */
class CatalogRepository(private val context: Context, private val auth: AuthRepository) {

    private val tokenManager = TokenManager(context)
    private val api by lazy { NetworkModule.catalog(context, tokenManager) }

    companion object {
        const val ITEMS_LIMIT = 24
    }

    private suspend fun <T> retryOn401(call: suspend () -> Response<T>): Response<T> {
        val resp = call()
        if (resp.code() == 401) {
            if (auth.refreshAccessToken() != null) return call()
        }
        return resp
    }

    suspend fun loadHomePage(page: Int, activeProfileId: String?, lang: String): List<ContentItem> {
        val params = mutableMapOf(
            "limit" to ITEMS_LIMIT.toString(),
            "page" to page.toString(),
            "sort" to "recent",
            "feed" to "1",
            "lang" to lang
        )
        activeProfileId?.let { params["profile_id"] = it }
        val resp = retryOn401 { api.list(params) }
        if (!resp.isSuccessful) return emptyList()
        return resp.body()?.items ?: emptyList()
    }

    suspend fun continueWatching(): List<ContinueItem> {
        val resp = retryOn401 { api.continueWatching(mapOf("limit" to "6")) }
        if (!resp.isSuccessful) return emptyList()
        return resp.body() ?: emptyList()
    }

    /** Espelha app/main/catalog/page.tsx (paginação numerada, não infinita). */
    data class CatalogPage(val items: List<ContentItem>, val pages: Int)

    suspend fun loadCatalogPage(
        type: String,
        sort: String,
        page: Int,
        activeProfileId: String?,
        lang: String
    ): CatalogPage {
        val params = mutableMapOf(
            "limit" to ITEMS_LIMIT.toString(),
            "page" to page.toString(),
            "sort" to sort,
            "lang" to lang
        )
        if (type != "all") params["type"] = type
        activeProfileId?.let { params["profile_id"] = it }
        val resp = retryOn401 { api.list(params) }
        if (!resp.isSuccessful) return CatalogPage(emptyList(), 1)
        val body = resp.body() ?: return CatalogPage(emptyList(), 1)
        return CatalogPage(body.items, body.pagination?.pages ?: 1)
    }

    /**
     * Recomendados da Watch — replica exatamente a chamada de
     * watch/[id]/page.tsx: catalogApi.list({ type, limit: 12, sort:
     * 'recommended', exclude: id }). Backend exige `exclude` quando
     * sort=recommended (routes/catalog.js).
     */
    suspend fun recommended(type: String, excludeId: String, lang: String): List<ContentItem> {
        val params = mapOf(
            "type" to type,
            "limit" to "12",
            "sort" to "recommended",
            "exclude" to excludeId,
            "lang" to lang
        )
        val resp = retryOn401 { api.list(params) }
        if (!resp.isSuccessful) return emptyList()
        return (resp.body()?.items ?: emptyList()).take(12)
    }

    /** Espelha app/main/search/page.tsx — sem sugestões/popular (removidas do original). */
    suspend fun search(query: String, lang: String, limit: Int = 24): List<ContentItem> {
        val resp = retryOn401 { api.search(mapOf("q" to query, "limit" to limit.toString(), "lang" to lang)) }
        if (!resp.isSuccessful) return emptyList()
        return resp.body()?.results ?: emptyList()
    }

    /** Espelha app/main/mylist/page.tsx — profileId em camelCase, não profile_id. */
    suspend fun myList(activeProfileId: String): List<MyListEntry> {
        val resp = retryOn401 { api.myList(mapOf("profileId" to activeProfileId, "limit" to "100")) }
        if (!resp.isSuccessful) return emptyList()
        return resp.body()?.items ?: emptyList()
    }

    suspend fun addToMyList(profileId: String, contentId: String): Boolean =
        retryOn401 { api.addToMyList(MyListMutationBody(profileId, contentId)) }.isSuccessful

    suspend fun removeFromMyList(profileId: String, contentId: String): Boolean =
        retryOn401 { api.removeFromMyList(MyListMutationBody(profileId, contentId)) }.isSuccessful

    /**
     * Espelha contentApi.get de lib/api.ts:
     * GET /api/content/:id?lang=(profile_id opcional). O backend embute
     * `in_list` quando profile_id vem junto (routes/content.js) — o ecrã
     * usa-o antes de cair no check separado, tal como watch/[id]/page.tsx.
     */
    suspend fun content(id: String, lang: String, activeProfileId: String?): ContentDetail? {
        val params = mutableMapOf("lang" to lang)
        activeProfileId?.let { params["profile_id"] = it }
        val resp = retryOn401 { api.content(id, params) }
        if (!resp.isSuccessful) return null
        return resp.body()
    }

    /** myListApi.check(contentId, profileId) — fallback quando in_list não vem embutido. */
    suspend fun checkMyList(contentId: String, activeProfileId: String?): Boolean {
        val params = activeProfileId?.let { mapOf("profileId" to it) } ?: emptyMap()
        val resp = retryOn401 { api.checkMyList(contentId, params) }
        return resp.body()?.inList ?: false
    }

    /**
     * progressApi.update do heartbeat de progresso de watch/[id]/page.tsx
     * (POST /api/progress/update, body camelCase; falha silenciosa como o
     * .catch(() => {}) original).
     */
    suspend fun updateProgress(
        profileId: String,
        contentId: String,
        episodeId: String?,
        progress: Int,
        durationSeconds: Int
    ) {
        try {
            retryOn401 {
                api.updateProgress(ProgressUpdateBody(profileId, contentId, episodeId, "en", progress, durationSeconds))
            }
        } catch (_: Exception) { /* silencioso — igual ao original */ }
    }
}
