// lib/validation.js
import { z } from 'zod';

export const schemas = {
    register: z.object({
        username:       z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
        password:       z.string().min(8).max(100),
        name:           z.string().min(2).max(100),
        email:          z.string().email().optional(),
        preferred_lang: z.string().length(2).default('en'),
    }),

    login: z.object({
        username: z.string().min(3).max(30),
        password: z.string().min(1).max(100),
        remember: z.boolean().optional().default(false),
    }),

    userUpdate: z.object({
        name:           z.string().min(2).max(100).optional(),
        email:          z.string().email().optional(),
        preferred_lang: z.string().length(2).optional(),
    }),

    changePassword: z.object({
        current_password: z.string().min(1),
        new_password:      z.string().min(8).max(100),
    }),

    // ── Job genérico — usado por todos os serviços (compress, convert, etc.) ──
    // O `service` identifica a plataforma que criou o job (compresshub,
    // convertall, editpdf, ...) — cada rota de serviço regista o seu próprio
    // valor fixo, não vem do cliente.
    jobCreate: z.object({
        input_name:  z.string().min(1).max(255),
        input_size:  z.number().int().min(0).max(5 * 1024 * 1024 * 1024), // 5GB
        input_type:  z.string().max(100).optional(),
        options:     z.record(z.any()).optional().default({}),
    }),

    hotmartWebhook: z.object({
        event: z.string(),
        data:  z.record(z.any()),
    }),
};

export function safeValidate(schema, data) {
    try {
        return { success: true, data: schema.parse(data) };
    } catch (error) {
        return {
            success: false,
            errors: error.errors?.map(e => ({ path: e.path.join('.'), message: e.message })) || [{ message: error.message }],
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
        hour: '2-digit', minute: '2-digit',
    });
}
