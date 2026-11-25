/* Service worker de la carta.
 *
 * - Archivos propios (HTML, CSS, JS, fuentes, íconos): se sirven al instante desde
 *   el caché y se actualizan en segundo plano ("stale-while-revalidate").
 * - Fotos de los productos: se guardan la primera vez que se ven.
 * - La API de Google Apps Script NO pasa por aquí: js/api.js ya guarda la última
 *   carta en localStorage y la muestra mientras llega la nueva.
 *
 * Si haces un cambio grande de código (varios archivos a la vez), sube VERSION
 * para que todos los visitantes reciban el conjunto completo y consistente.
 */
const VERSION = 'v1';
const SHELL_CACHE = `antojitos-shell-${VERSION}`;
const IMAGE_CACHE = 'antojitos-images-v2';
const IMAGE_LIMIT = 60; // las respuestas de otros dominios ocupan cuota de sobra: se limita

const SHELL = [
    './',
    'index.html',
    'css/fonts.css',
    'css/tokens.css',
    'css/styles.css',
    'css/components.css',
    'js/app.js',
    'js/api.js',
    'js/cart.js',
    'js/config.js',
    'js/order.js',
    'js/ui.js',
    'assets/img/logo.webp',
    'assets/img/bean.svg',
    'assets/img/ornament-divider.svg',
    'assets/img/favicon.svg',
    'assets/fonts/fraunces-600.woff2',
    'assets/fonts/fraunces-700.woff2',
    'assets/fonts/plus-jakarta-sans-400.woff2',
    'assets/fonts/plus-jakarta-sans-600.woff2',
    'assets/fonts/plus-jakarta-sans-700.woff2'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            // 'reload' evita copiar una versión vieja del caché HTTP del navegador.
            // allSettled: si falta un archivo opcional (p. ej. el logo) la instalación continúa.
            .then(cache => Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('antojitos-shell-') && key !== SHELL_CACHE)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(event));
        return;
    }

    if (request.destination === 'image') {
        event.respondWith(cacheFirstImage(request));
    }
    // Todo lo demás (API de Apps Script, etc.) va directo a la red.
});

async function staleWhileRevalidate(event) {
    const { request } = event;
    const cache = await caches.open(SHELL_CACHE);
    const isPage = request.mode === 'navigate';
    const cached = await cache.match(request, { ignoreSearch: isPage });

    // 'no-cache' = pregunta al servidor si cambió (barato: responde 304 si no)
    const update = fetch(request.url, { cache: 'no-cache' })
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);

    if (cached) {
        event.waitUntil(update);
        return cached;
    }

    const fresh = await update;
    if (fresh) return fresh;
    if (isPage) return (await cache.match('./')) || (await cache.match('index.html')) || Response.error();
    return Response.error();
}

async function cacheFirstImage(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        // 'opaque' = imagen de otro dominio sin CORS (se puede guardar, no inspeccionar)
        if (response.ok || response.type === 'opaque') {
            await cache.put(request, response.clone());
            trimCache(cache, IMAGE_LIMIT);
        }
        return response;
    } catch {
        return Response.error(); // la página mostrará el placeholder
    }
}

async function trimCache(cache, limit) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - limit; i++) {
        await cache.delete(keys[i]);
    }
}
