// lib/validation.js
import { z } from 'zod';

export const schemas = {
    register: z.object({
        username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
        password: z.string().min(8).max(100),
        name: z.string().min(2).max(100),
        email: z.string().email().optional(),
        preferred_lang: z.string().length(2).default('en')
    }),

    login: z.object({
        username: z.string().min(3).max(30),
        password: z.string().min(1).max(100),
        remember: z.boolean().optional().default(false)
    }),

    userUpdate: z.object({
        name: z.string().min(2).max(100).optional(),
        email: z.string().email().optional(),
        preferred_lang: z.string().length(2).optional()
    }),

    changePassword: z.object({
        current_password: z.string().min(1),
        new_password: z.string().min(8).max(100)
    }),

    profile: z.object({
        name: z.string().min(1).max(50),
        avatar: z.string().url().optional(),
        language: z.string().length(2).default('en'),
        pin: z.string().length(4).regex(/^\d+$/).optional(),
        is_kid: z.boolean().optional().default(false)
    }),

    content: z.object({
        id: z.string().optional(),
        // FIX (pedido explícito): a página de upload passou a oferecer mais
        // categorias além de filme/série/etc — entretenimento, finanças,
        // viagens, estudos e cursos. Sem as adicionar aqui também, o passo
        // de aprovação em /admin (que usa este schema) rejeitaria qualquer
        // envio feito com um destes tipos novos.
        type: z.enum(['movie', 'series', 'documentary', 'dorama', 'anime', 'video', 'entertainment', 'finance', 'travel', 'education', 'courses']),
        title: z.string().min(1).max(500),
        title_original: z.string().max(500).optional(),
        year: z.number().int().min(1900).max(2100),
        poster: z.string().url().optional(),
        description: z.string().max(5000).optional(),
        duration: z.number().int().min(0).optional(),
        seasons: z.number().int().min(0).optional(),
        episodes: z.number().int().min(0).optional(),
        audio_langs: z.array(z.string().length(2)).default(['en']),
        subtitle_langs: z.array(z.string().length(2)).default([]),
        tags: z.array(z.string().min(1).max(50)).optional(),
        meta: z.object({
            available_langs: z.array(z.string().length(2)).optional(),
            default_lang: z.string().length(2).optional(),
            original_lang: z.string().length(2).optional(),
            rating: z.number().min(0).max(10).optional(),
            genres: z.array(z.string()).optional(),
            poster_default: z.string().url().optional()
        }).optional()
    }),

    contentMeta: z.object({
        available_langs: z.array(z.string().length(2)),
        default_lang: z.string().length(2),
        original_lang: z.string().length(2),
        year: z.number().int().min(1900).max(2100),
        rating: z.number().min(0).max(10).optional(),
        genres: z.array(z.string()),
        poster_default: z.string().url().optional()
    }),

    season: z.object({
        content_id: z.string().min(1),
        season_number: z.number().int().min(1),
        title: z.string().max(500).optional(),
        poster: z.string().url().optional()
    }),

    episode: z.object({
        content_id: z.string().min(1),
        season_number: z.number().int().min(1),
        episode_number: z.number().int().min(1),
        title: z.string().min(1).max(500),
        duration: z.number().int().min(0).optional(),
        poster: z.string().url().optional(),
        description: z.string().max(2000).optional()
    }),

    chunk: z.object({
        content_id: z.string().optional(),
        episode_id: z.string().optional(),
        lang: z.string().length(2).default('en'),
        quality: z.enum(['360p', '480p', '720p', '1080p', '4k']).default('1080p'),
        chunk_hash: z.string().min(1),
        chunk_index: z.number().int().min(0),
        size_bytes: z.number().int().min(0),
        duration_seconds: z.number().int().min(0).optional(),
        storage_path: z.string().min(1).optional(),
        encryption_key: z.string().optional(),
        encryption_nonce: z.string().optional(),
        urls: z.array(z.object({
            url: z.string().url(),
            provider: z.string().min(1),
            is_active: z.boolean().default(true)
        })).optional()
    }),

    channel: z.object({
        name: z.string().min(1).max(200),
        lang: z.string().length(2),
        logo: z.string().url().optional(),
        description: z.string().max(1000).optional(),
        stream_url: z.string().url(),
        epg_url: z.string().url().optional(),
        category: z.string().min(1),
        country: z.string().length(2).optional()
    }),

    progress: z.object({
        profile_id: z.string().min(1),
        content_id: z.string().min(1),
        lang: z.string().length(2).default('en'),
        episode_id: z.string().optional(),
        progress: z.number().int().min(0).max(100),
        duration: z.number().int().min(0).optional()
    })
};

export function validate(schema, data) {
    try {
        return { success: true, data: schema.parse(data) };
    } catch (error) {
        return {
            success: false,
            errors: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        };
    }
}

export function validateOrThrow(schema, data) {
    return schema.parse(data);
}

export function isValid(schema, data) {
    try { schema.parse(data); return true; } catch { return false; }
}

export function sanitizeString(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim().slice(0, 5000);
}

export function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.+/g, '.').slice(0, 255);
}

export function formatDuration(seconds) {
    if (!seconds) return '0min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

export function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(date) {
    return new Date(date).toLocaleString('en-US', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
