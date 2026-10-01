// lib/monetization.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor de elegibilidade para monetização de criadores (PixGo Creative).
// Funções puras: recebem dados já carregados (user + contents[]) e devolvem
// o estado calculado. Nenhum I/O aqui — quem chama (routes/creator.js) é
// responsável por ir buscar os dados ao Turso (edgeone.js) e persistir o
// início da maturação quando `should_start_maturation` vier true.
//
// Requisitos (regra fixa):
//   R1 — mínimo 3 vídeos publicados com duration > 600s (10 min)
//   R2 — copyright_status !== 'issue' em todos os vídeos qualificados
//   R3 — conta com mais de 90 dias (users.created_at)
//   R4 — atividade de upload: pelo menos 1 upload nos últimos 30 dias
//   R5 — período de maturação de 30 dias, contado a partir do momento em
//        que R1-R4 ficam todos cumpridos pela primeira vez
//        (users.maturation_started_at)
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_QUALIFYING_VIDEOS  = 3;
export const MIN_VIDEO_DURATION_SEC = 600;       // 10 minutos
export const MIN_ACCOUNT_AGE_DAYS   = 90;        // 3 meses
export const UPLOAD_ACTIVITY_WINDOW_DAYS = 30;
export const MATURATION_DAYS        = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromISO, toDate = new Date()) {
    if (!fromISO) return 0;
    const from = new Date(fromISO).getTime();
    if (Number.isNaN(from)) return 0;
    return Math.floor((toDate.getTime() - from) / DAY_MS);
}

/**
 * @param {object} user - linha de users já normalizada (_rowToUser), tem de
 *                         incluir created_at, monetization_status,
 *                         maturation_started_at.
 * @param {object[]} contents - todos os conteúdos com uploader_id = user.id,
 *                              status 'published' (_rowToContent).
 * @returns {object} snapshot completo de elegibilidade, servido por
 *                    GET /api/creator/monetization e /api/creator/me.
 */
export function computeEligibility(user, contents = []) {
    const now = new Date();

    // ── R1: vídeos qualificados ──────────────────────────────────────────
    const qualifyingVideos = contents.filter(c => (c.duration || 0) > MIN_VIDEO_DURATION_SEC);
    const qualifyingCount  = qualifyingVideos.length;
    const hasQualifyingVideos = qualifyingCount >= MIN_QUALIFYING_VIDEOS;

    // ── R2: copyright ────────────────────────────────────────────────────
    const copyrightIssues = qualifyingVideos.filter(c => c.copyright_status === 'issue');
    const copyrightOk = copyrightIssues.length === 0;

    // ── R3: idade da conta ───────────────────────────────────────────────
    const accountAgeDays   = daysBetween(user.created_at, now);
    const accountOldEnough = accountAgeDays >= MIN_ACCOUNT_AGE_DAYS;

    // ── R4: atividade de upload ──────────────────────────────────────────
    const recentUploads = contents.filter(c => daysBetween(c.created_at, now) <= UPLOAD_ACTIVITY_WINDOW_DAYS);
    const hasUploadActivity = recentUploads.length > 0;

    const allBaseRequirementsMet = hasQualifyingVideos && copyrightOk && accountOldEnough && hasUploadActivity;

    // ── R5: maturação ────────────────────────────────────────────────────
    let maturationStartedAt = user.maturation_started_at || null;
    let maturationDaysElapsed = 0;
    let maturationComplete = false;

    if (allBaseRequirementsMet && maturationStartedAt) {
        maturationDaysElapsed = daysBetween(maturationStartedAt, now);
        maturationComplete = maturationDaysElapsed >= MATURATION_DAYS;
    }

    // ── Estado final (máquina de estados) ───────────────────────────────
    let status;
    if (user.monetization_status === 'suspended') {
        status = 'suspended';
    } else if (!allBaseRequirementsMet) {
        status = 'requirements_pending';
        // deixou de cumprir requisitos depois de já ter começado a maturar —
        // o snapshot ainda mostra o progresso perdido via `maturation` abaixo,
        // mas o status volta a requirements_pending até voltar a cumprir tudo.
    } else if (!maturationStartedAt) {
        status = 'requirements_pending'; // cumpriu agora, quem chama inicia a maturação
    } else if (!maturationComplete) {
        status = 'maturation';
    } else {
        status = user.monetization_status === 'active' ? 'active' : 'eligible';
    }

    const estimatedEligibilityDate = (status === 'maturation' && maturationStartedAt)
        ? new Date(new Date(maturationStartedAt).getTime() + MATURATION_DAYS * DAY_MS).toISOString()
        : null;

    return {
        status,
        requirements: {
            qualifying_videos: {
                met: hasQualifyingVideos,
                current: qualifyingCount,
                required: MIN_QUALIFYING_VIDEOS,
            },
            copyright: {
                met: copyrightOk,
                issues: copyrightIssues.length,
            },
            account_age: {
                met: accountOldEnough,
                current_days: accountAgeDays,
                required_days: MIN_ACCOUNT_AGE_DAYS,
            },
            upload_activity: {
                met: hasUploadActivity,
                recent_uploads: recentUploads.length,
                window_days: UPLOAD_ACTIVITY_WINDOW_DAYS,
            },
        },
        maturation: {
            started_at: maturationStartedAt,
            days_elapsed: maturationStartedAt ? maturationDaysElapsed : 0,
            days_required: MATURATION_DAYS,
            complete: maturationComplete,
        },
        estimated_eligibility_date: estimatedEligibilityDate,
        // sinal para quem chama persistir o início da maturação
        should_start_maturation: allBaseRequirementsMet && !maturationStartedAt && user.monetization_status !== 'suspended',
    };
}
