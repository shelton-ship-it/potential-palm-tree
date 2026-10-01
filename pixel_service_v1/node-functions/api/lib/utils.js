// lib/utils.js — funções utilitárias partilhadas
// Extraído de [[default]].js para evitar imports circulares em routes/

/**
 * Parse e valida parâmetros de paginação com limites seguros.
 * Usage: const { limit, page, offset } = parsePagination(req.query)
 */
export function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const limit  = Math.min(Math.max(parseInt(query.limit)  || defaultLimit, 1), maxLimit);
    const page   = Math.max(parseInt(query.page) || 1, 1);
    const offset = (page - 1) * limit;
    return { limit, page, offset };
}
