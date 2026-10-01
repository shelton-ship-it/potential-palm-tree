// routes/legal.js — GET /api/legal/:lang
//
// PORQUÊ ESTA ROTA EXISTE: até agora, todo o texto legal (Aviso Legal,
// Termos de Envio, Termos de Serviço, Privacidade, Cookies, Segurança,
// Contacto, Direitos de Autor, DMCA, Contra-Notificação — 391 chaves em
// legal.* nos 3 idiomas) vinha embutido no bundle do frontend
// (src/i18n/locales/{pt,en,es}.json), compilado dentro do .apk/.ipa.
//
// Problema (levantado pelo sócio): quem já tem a app instalada fora da
// loja (sideload, build antiga, apk partilhado) nunca mais recebe
// atualizações desse bundle — mesmo que publiquemos uma nova versão na
// loja, quem não atualizar continua a ver o texto legal antigo. Isto é
// especialmente mau para a cláusula da entidade responsável (ainda a
// preencher, ver nota no fim do ficheiro), o Agente DMCA, e qualquer
// alteração feita para nos protegermos melhor — sem o utilizador aceitar
// sequer voltar a ver o texto atualizado.
//
// SOLUÇÃO: o texto legal passa a viver aqui (lib/legal-content/{lang}.json),
// servido por esta rota. O frontend (legal/page.tsx) busca-o em runtime e
// funde-o no i18next por cima do que vier empacotado — build antiga ou
// nova, todos os dispositivos com rede passam a ver sempre a versão mais
// recente, sem precisar de nenhuma atualização de app. O bundle do
// frontend mantém uma cópia igual só como fallback caso o pedido falhe
// (sem rede, API em baixo) — nesse caso mostra-se o texto embutido em vez
// de ecrã vazio, mas a fonte de verdade passa a ser este ficheiro.
//
// Para atualizar o texto legal a partir de agora: editar o ficheiro
// lib/legal-content/{lang}.json correspondente e subir `version` em 1 —
// isso é só um deploy do backend, não passa por nenhuma loja de apps.

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '..', 'lib', 'legal-content');

const SUPPORTED = ['pt', 'en', 'es'];

// Cache em memória por idioma — o ficheiro só muda com um deploy, não há
// necessidade de ler do disco em cada pedido.
const cache = {};

function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    const filePath = path.join(CONTENT_DIR, `${lang}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    cache[lang] = parsed;
    return parsed;
}

export default function (app) {

    // ── GET /api/legal/:lang ─────────────────────────────────────────────────
    // Sem autenticação de propósito — é texto público, e a app precisa de o
    // conseguir mostrar mesmo a quem ainda não tem conta/sessão (ex: no ecrã
    // de Aviso Legal antes do login).
    app.get('/api/legal/:lang', (req, res) => {
        const lang = SUPPORTED.includes(req.params.lang) ? req.params.lang : 'pt';
        try {
            const data = loadLang(lang);
            // Cache-Control curto (não zero): permite ao CDN/browser poupar
            // pedidos repetidos no mesmo dia, mas sem arriscar servir texto
            // legal desatualizado durante muito tempo depois de um update.
            res.set('Cache-Control', 'public, max-age=3600');
            res.json(data);
        } catch (err) {
            console.error('[legal] falha ao carregar conteúdo legal:', lang, err.message);
            res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load legal content' });
        }
    });
}
