// lib/channels-source.ts
// ── Fonte de dados dos canais — 100% client-side ────────────────────────────
// FIX (arquitetura, pedido explícito do dono da plataforma): playlist.m3u e
// logos.json são servidos via jsDelivr (CDN público, mirror do repo GitHub
// shelton-ship-it/assets-main) — já é um CDN, não faz sentido nenhum backend
// serverless andar a descarregar o ficheiro inteiro, fazer parsing e guardar
// tudo em memória por instância só para reenviar como JSON paginado. Isto
// substitui essa camada: o BROWSER busca os ficheiros directamente ao
// jsDelivr, faz o parsing do M3U aqui e trata paginação/categoria/pesquisa
// localmente, sem nenhum pedido ao nosso backend.
//
// O backend (routes/channels.js) deixou de saber o que é um canal — só
// continua a existir para o "gate" de anti-abuso (limite de ecrãs/quota
// diária) em GET /api/channels/:id e o heartbeat, que TÊM de ser
// server-side (ver comentário nesse ficheiro).
//
// Consequência aceite conscientemente: como o M3U completo (com os URLs de
// stream de todos os canais) passa a ser buscado directamente pelo browser,
// esses URLs ficam tecnicamente visíveis na aba de rede mesmo para quem não
// tem sessão — o "cadeado" no UI deixa de ser uma barreira real, é só UX/
// incentivo a criar conta (os canais em si são streams IPTV públicos, sem
// DRM). `locked`/`has_access` abaixo continuam a existir só para essa UX.

const PLAYLIST_URL = 'https://cdn.jsdelivr.net/gh/shelton-ship-it/assets-main@main/playlist.m3u';
const LOGOS_URL    = 'https://cdn.jsdelivr.net/gh/shelton-ship-it/assets-main@main/logos.json';

// FIX (pedido explícito, performance): canais não precisam de nenhuma
// cache no frontend nem no backend além desta — o jsDelivr já é, ele
// próprio, um CDN com a sua cache. 30 min estava a gerar refetch e reparse
// do M3U com frequência desnecessária para dados que mudam pouco (canais
// de TV aberta não trocam de hora em hora). Subido para 22h: refaz-se
// menos de uma vez por dia (nunca mais de uma vez, na prática, já que
// ninguém deixa uma aba aberta 22h seguidas), mantendo os canais frescos
// o suficiente sem reparsear o M3U a cada 30 minutos.
const CACHE_TTL_MS = 22 * 60 * 60 * 1000; // 22h

export type RawChannel = {
  id: string; name: string; url: string; logo: string;
  group: string; country: string; language: string; tvg_id: string;
};

export type ChannelListItem = {
  id: string; name: string; logo: string; group: string; country: string;
  locked: boolean; has_access: boolean; url?: string;
};

let _cache: RawChannel[] | null = null;
let _cacheTime = 0;
let _fetching: Promise<RawChannel[]> | null = null;

function parseM3U(text: string, logos: Record<string, string>): RawChannel[] {
  const channels: RawChannel[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let current: RawChannel | null = null;
  let index = 0;

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      index++;
      current = { id: `ch_${index}`, name: '', url: '', logo: '', group: 'outros', tvg_id: '', country: '', language: '' };

      const ci = line.lastIndexOf(',');
      if (ci !== -1) current.name = line.slice(ci + 1).trim();

      const m = (attr: string) => { const r = line.match(new RegExp(`${attr}="([^"]*)"`)); return r ? r[1] : ''; };

      current.logo     = m('tvg-logo');
      current.group    = m('group-title') || 'outros';
      current.tvg_id   = m('tvg-id');
      current.country  = m('tvg-country');
      current.language = m('tvg-language');

    } else if (current && !line.startsWith('#')) {
      current.url = line;
      if (!current.logo && current.tvg_id && logos[current.tvg_id]) current.logo = logos[current.tvg_id];
      if (current.name && current.url) channels.push(current);
      current = null;
    }
  }

  return channels;
}

async function fetchAndParse(): Promise<RawChannel[]> {
  const [playlistRes, logosRes] = await Promise.all([
    fetch(PLAYLIST_URL),
    fetch(LOGOS_URL),
  ]);

  if (!playlistRes.ok) throw new Error(`M3U respondeu ${playlistRes.status}`);

  const [playlistText, logosData] = await Promise.all([
    playlistRes.text(),
    logosRes.ok ? logosRes.json().catch(() => ({})) : Promise.resolve({}),
  ]);

  const logos = (logosData && typeof logosData === 'object') ? logosData : {};
  return parseM3U(playlistText, logos);
}

async function getRawChannels(): Promise<RawChannel[]> {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;
  if (_fetching) return _fetching;

  _fetching = fetchAndParse()
    .then(channels => { _cache = channels; _cacheTime = Date.now(); return channels; })
    .finally(() => { _fetching = null; });

  return _fetching;
}

// Deduplicação por nome (case-insensitive) — a playlist agregada de
// múltiplas fontes frequentemente repete o mesmo canal.
function dedupe(channels: RawChannel[]): RawChannel[] {
  const seen = new Set<string>();
  return channels.filter(ch => {
    const key = (ch.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapForList(ch: RawChannel, hasUser: boolean): ChannelListItem {
  return {
    id: ch.id, name: ch.name, logo: ch.logo, group: ch.group, country: ch.country,
    locked: !hasUser, has_access: hasUser,
    ...(hasUser ? { url: ch.url } : {}),
  };
}

export async function listChannels(opts: { page?: number; limit?: number; category?: string | null; hasUser: boolean }) {
  const { page = 1, limit = 24, category = null, hasUser } = opts;
  const all = await getRawChannels();
  const dedupedAll = dedupe(all);

  const filtered = category
    ? dedupedAll.filter(ch => ch.group?.toLowerCase() === category.toLowerCase())
    : dedupedAll;

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit).map(ch => mapForList(ch, hasUser));

  return {
    channels:    paginated,
    pagination:  { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    grand_total: dedupedAll.length,
    loading:     false,
  };
}

export async function getCategories() {
  const all = await getRawChannels();
  const categoryMap = new Map<string, number>();

  for (const ch of all) {
    const g = ch.group || 'outros';
    categoryMap.set(g, (categoryMap.get(g) || 0) + 1);
  }

  const categories = [...categoryMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, slug: name.toLowerCase(), count }));

  return { categories, total: categories.length };
}

export async function searchChannels(query: string, hasUser: boolean) {
  const all = await getRawChannels();
  const q = query.toLowerCase().trim();

  let filtered = all;
  if (q) {
    filtered = all.filter(ch =>
      ch.name.toLowerCase().includes(q) ||
      (ch.group    || '').toLowerCase().includes(q) ||
      (ch.country  || '').toLowerCase().includes(q) ||
      (ch.language || '').toLowerCase().includes(q)
    );
  }

  const mapped = filtered.slice(0, 200).map(ch => mapForList(ch, hasUser));
  return { channels: mapped, total: mapped.length };
}
