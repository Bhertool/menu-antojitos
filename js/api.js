import { CONFIG } from './config.js';

const FETCH_TIMEOUT_MS = 15000;

export function readCachedMenu() {
try {
    const raw = localStorage.getItem(CONFIG.CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;
    return { items: parsed.items, schedule: parsed.schedule || null };
} catch {
    return null;
}
}

export async function fetchLiveMenu() {
if (!CONFIG.API_URL || CONFIG.API_URL.includes('PEGA_AQUI')) {
    throw new Error('Falta configurar API_URL en js/config.js');
}

// Con señal mala una petición puede quedarse colgada para siempre:
// se corta a los 15 s para poder mostrar el error o la carta guardada.
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

let data;
try {
    const response = await fetch(CONFIG.API_URL, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
    }
    data = await response.json();
} catch (err) {
    if (err.name === 'AbortError') {
        throw new Error('La carta tardó demasiado en responder');
    }
    throw err;
} finally {
    clearTimeout(timer);
}

if (!data.ok || !Array.isArray(data.items)) {
    throw new Error(data.error || 'Respuesta inválida del servidor');
}

const payload = {
    items: data.items,
    schedule: data.schedule || null
};

try {
    localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
    savedAt: Date.now(),
    ...payload
    }));
} catch {
    // Ignorar si el almacenamiento local está restringido
}

return payload;
}