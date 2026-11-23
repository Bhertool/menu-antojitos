import { CONFIG } from './config.js';

export function readCachedMenu() {
try {
    const raw = localStorage.getItem(CONFIG.CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : null;
} catch {
    return null;
}
}

export async function fetchLiveMenu() {
if (!CONFIG.API_URL || CONFIG.API_URL.includes('PEGA_AQUI')) {
    throw new Error('Falta configurar API_URL en js/config.js');
}

const response = await fetch(CONFIG.API_URL, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
}

const data = await response.json();
if (!data.ok || !Array.isArray(data.items)) {
    throw new Error(data.error || 'Respuesta inválida del servidor');
}

try {
    localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
    savedAt: Date.now(),
    items: data.items
    }));
} catch {
    // Ignorar si el almacenamiento local está restringido
}

return data.items;
}