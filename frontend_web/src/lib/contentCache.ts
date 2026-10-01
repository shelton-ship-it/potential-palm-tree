// src/lib/contentCache.ts
// ─────────────────────────────────────────────────────────────────────────────
// Rodada 3 de otimização (set/2026). Antes: `/main/content/[id]` (detalhes) e
// `/main/watch/[id]` (player) buscavam o MESMO conteúdo duas vezes em
// segundos no fluxo normal (utilizador abre detalhes, depois clica Play).
// Agora: a página que carregar primeiro guarda a resposta aqui; a segunda
// reaproveita sem ir à rede, DENTRO de um TTL curto.
//
// TTL propositadamente curto (3 min, não um dia) porque esta resposta tem
// efeitos colaterais e dados por-sessão: incrementa `views` no servidor a
// cada chamada real, e traz `liked`/`in_list`/`download` específicos do
// utilizador. Reaproveitar dentro da mesma sessão de navegação é seguro;
// reaproveitar por horas não seria (contagem de views ficaria presa,
// like/mylist podiam already ter mudado noutra aba).
//
// Efeito colateral positivo, não um bug: hoje CADA página incrementa
// `views` (2 por sessão real: detalhes + watch). Com o cache, a segunda
// página reaproveita em vez de chamar de novo — passa a 1 incremento por
// sessão de visualização, mais próximo da realidade.
//
// sessionStorage (não localStorage) de propósito: o cache não deve
// sobreviver a uma nova aba/sessão do browser — é só para a transição
// imediata dentro da mesma visita.

const TTL_MS = 3 * 60 * 1000; // 3 minutos

function cacheKey(id: string, lang: string, profileId?: string | null): string {
  return `pixgo_content_cache:${id}:${lang}:${profileId || 'none'}`;
}

export function readContentCache(id: string, lang: string, profileId?: string | null): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(id, lang, profileId));
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (typeof cachedAt !== 'number' || Date.now() - cachedAt > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeContentCache(id: string, lang: string, profileId: string | null | undefined, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(id, lang, profileId), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // sessionStorage cheio ou indisponível (modo privado, etc.) — degrada
    // bem, simplesmente sem cache; nunca deve derrubar a página.
  }
}

// Invalidação explícita — usada depois de like/unlike ou de alterar my list,
// para a próxima navegação (não a actual) já vir correcta, sem esperar o TTL.
export function invalidateContentCache(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = `pixgo_content_cache:${id}:`;
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* melhor esforço */ }
}
