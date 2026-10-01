// routes/usage.js — POST /api/usage/heartbeat
// Ver middleware/tool-usage.js para a lógica completa (limite de 10min/dia
// por ferramenta, plano free).

import { authenticate }       from '../middleware/auth.js';
import { toolUsageHeartbeat } from '../middleware/tool-usage.js';

export default function (app) {
    app.post('/api/usage/heartbeat', authenticate, toolUsageHeartbeat());
}
