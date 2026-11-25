import { CONFIG } from './config.js';
import { readCachedMenu, fetchLiveMenu } from './api.js';
import {
    renderCategories,
    renderMenu,
    renderError,
    renderStoreStatus,
    openDetailSheet,
    showToast
} from './ui.js';
import { createCart } from './cart.js';
import { initOrder } from './order.js';

const state = {
    items: [],
    schedule: null,
    activeCategory: 'Todos',
    query: ''
};

const els = {
    brandLogo: document.querySelector('#brandLogo'),
    brandName: document.querySelector('#brandName'),
    brandTagline: document.querySelector('#brandTagline'),
    storeStatus: document.querySelector('#storeStatus'),
    nequiNumber: document.querySelector('#nequiNumber'),
    nequiHolder: document.querySelector('#nequiHolder'),
    copyNequiBtn: document.querySelector('#copyNequiBtn'),
    whatsappLink: document.querySelector('#whatsappLink'),
    instagramLink: document.querySelector('#instagramLink'),
    themeToggle: document.querySelector('#themeToggle'),
    themeIcon: document.querySelector('#themeIcon'),
    searchInput: document.querySelector('#searchInput'),
    categoryStrip: document.querySelector('#categoryStrip'),
    menuContainer: document.querySelector('#menuContainer'),
    detailDialog: document.querySelector('#detailDialog'),
    closeSheetBtn: document.querySelector('#closeSheetBtn'),
    toast: document.querySelector('#toast')
};

const cart = createCart();
let order = null;

const THEME_COLORS = { dark: '#1a0f09', light: '#fdf6ea' };

function initBranding() {
    const b = CONFIG.BUSINESS;
    els.brandName.textContent = b.name;
    els.brandTagline.textContent = b.tagline;
    els.nequiNumber.textContent = b.nequiFormatted;
    els.nequiHolder.textContent = b.nequiHolder;
    els.whatsappLink.href = b.whatsappUrl;
    els.instagramLink.href = b.instagramUrl;

    if (b.logoUrl) {
        els.brandLogo.onload = () => { els.brandLogo.hidden = false; };
        els.brandLogo.onerror = () => { els.brandLogo.hidden = true; };
        els.brandLogo.src = b.logoUrl;
        if (els.brandLogo.complete && els.brandLogo.naturalWidth > 0) {
            els.brandLogo.hidden = false;
        }
    }
}

function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('antojitos_theme'); } catch { /* ignorar */ }
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (systemDark ? 'dark' : 'light'), false);

    els.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark', true);
    });
}

function applyTheme(mode, persist) {
    document.documentElement.dataset.theme = mode;
    els.themeIcon.textContent = mode === 'dark' ? '☀' : '☾';
    // La barra del navegador del celular acompaña al tema elegido
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
        m.content = THEME_COLORS[mode];
    });
    if (persist) {
        try { localStorage.setItem('antojitos_theme', mode); } catch { /* ignorar */ }
    }
}

function getFilteredItems() {
    const q = state.query.trim().toLowerCase();
    return state.items.filter(item => {
        const matchCat = state.activeCategory === 'Todos' || item.categoria === state.activeCategory;
        if (!matchCat) return false;
        if (!q) return true;
        const haystack = `${item.nombre} ${item.descripcion} ${item.categoria} ${(item.opciones || []).join(' ')}`.toLowerCase();
        return haystack.includes(q);
    });
}

function handleAdd(item, option, qty) {
    cart.add(item.id, option, qty);
    const label = qty > 1 ? `${qty} × ${item.nombre}` : item.nombre;
    showToast(els.toast, `Agregado: ${label}`);
}

const menuHandlers = {
    onOpen: item => openDetailSheet(els.detailDialog, item, handleAdd),
    onQuickAdd: item => {
        // Si hay que elegir una opción, se abre el detalle; si no, se agrega directo
        if (item.opciones && item.opciones.length) {
            openDetailSheet(els.detailDialog, item, handleAdd);
        } else {
            handleAdd(item, null, 1);
        }
    }
};

function updateView(useTransition = false) {
    const categories = [...new Set(state.items.map(i => i.categoria))];
    const paint = () => {
        renderCategories(els.categoryStrip, categories, state.activeCategory, cat => {
            state.activeCategory = cat;
            updateView(true);
        });
        renderMenu(els.menuContainer, getFilteredItems(), menuHandlers);
        if (order) order.syncBadges();
    };

    if (useTransition && document.startViewTransition) {
        document.startViewTransition(paint);
    } else {
        paint();
    }
}

async function refreshLive() {
    try {
        const live = await fetchLiveMenu();
        state.items = live.items;
        state.schedule = live.schedule;
        renderStoreStatus(els.storeStatus, state.schedule);
        updateView(false);
        if (order) order.refresh();
    } catch (err) {
        if (!state.items.length) {
            renderError(
                els.menuContainer,
                'No pudimos cargar la carta. Revisa tu señal e inténtalo de nuevo.',
                loadData
            );
        } else {
            showToast(els.toast, 'Sin señal: mostrando la última carta guardada');
        }
        console.warn('Error cargando menú en vivo:', err.message);
    }
}

async function loadData() {
    const cached = readCachedMenu();
    if (cached && cached.items.length) {
        state.items = cached.items;
        state.schedule = cached.schedule;
        renderStoreStatus(els.storeStatus, state.schedule);
        updateView(false);
        if (order) order.refresh();
    }
    await refreshLive();
}

function initInteractions() {
    els.searchInput.addEventListener('input', e => {
        state.query = e.target.value;
        updateView(false);
    });

    els.closeSheetBtn.addEventListener('click', () => els.detailDialog.close());

    // Cerrar tocando el fondo oscuro fuera del diálogo
    els.detailDialog.addEventListener('click', e => {
        if (e.target === els.detailDialog) els.detailDialog.close();
    });

    els.copyNequiBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(CONFIG.BUSINESS.nequiRaw);
            showToast(els.toast, 'Número Nequi copiado');
        } catch {
            showToast(els.toast, `Nequi: ${CONFIG.BUSINESS.nequiFormatted}`);
        }
    });

    // Si volvió la señal, se actualiza la carta sin que el cliente haga nada
    window.addEventListener('online', refreshLive);
}

// Service worker: la carta abre al instante y funciona sin señal
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('No se pudo registrar el service worker:', err.message);
        });
    });
}

initBranding();
initTheme();
order = initOrder({
    cart,
    getItems: () => state.items,
    business: CONFIG.BUSINESS,
    toastEl: els.toast
});
initInteractions();
registerServiceWorker();
loadData();
setInterval(() => {
    if (state.schedule) renderStoreStatus(els.storeStatus, state.schedule);
}, 60000);
