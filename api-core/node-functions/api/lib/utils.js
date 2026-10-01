// lib/utils.js — funções utilitárias partilhadas por todas as rotas.

/**
 * Parse e valida parâmetros de paginação com limites seguros.
 * Usage: const { limit, page, offset } = parsePagination(req.query)
 */
export function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const limit  = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);
    const page   = Math.max(parseInt(query.page) || 1, 1);
    const offset = (page - 1) * limit;
    return { limit, page, offset };
}

/**
 * Gera um id curto e único para jobs/pedidos (não é um UUID completo,
 * suficiente para chaves KV e para o utilizador referenciar no suporte).
 */
export function shortId(prefix = '') {
    const rand = Math.random().toString(36).slice(2, 10);
    const ts   = Date.now().toString(36);
    return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`;
}

export function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
