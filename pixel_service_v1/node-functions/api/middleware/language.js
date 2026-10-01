// middleware/language.js
import { detectLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../lib/geoip.js';

export async function languageDetector(req, res, next) {
    try {
        const { lang, source } = await detectLanguage(req);
        req.language = lang;
        res.set('Content-Language', lang);
        res.set('X-Language-Source', source);
    } catch {
        req.language = DEFAULT_LANGUAGE;
        res.set('Content-Language', DEFAULT_LANGUAGE);
        res.set('X-Language-Source', 'error-fallback');
    }
    next();
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
