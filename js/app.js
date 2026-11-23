import { CONFIG } from './config.js';
import { readCachedMenu, fetchLiveMenu } from './api.js';
import {
renderCategories,
renderMenu,
renderError,
openDetailSheet,
showToast
} from './ui.js';

const state = {
items: [],
activeCategory: 'Todos',
query: ''
};

const els = {
brandLogo: document.querySelector('#brandLogo'),
brandName: document.querySelector('#brandName'),
brandTagline: document.querySelector('#brandTagline'),
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

function initBranding() {
const b = CONFIG.BUSINESS;
els.brandName.textContent = b.name;
els.brandTagline.textContent = b.tagline;
els.nequiNumber.textContent = b.nequiFormatted;
els.nequiHolder.textContent = b.nequiHolder;
els.whatsappLink.href = b.whatsappUrl;
els.instagramLink.href = b.instagramUrl;

if (b.logoUrl) {
    els.brandLogo.src = b.logoUrl;
    els.brandLogo.onload = () => { els.brandLogo.hidden = false; };
    els.brandLogo.onerror = () => { els.brandLogo.hidden = true; };
}
}

function initTheme() {
const saved = localStorage.getItem('antojitos_theme');
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
if (persist) localStorage.setItem('antojitos_theme', mode);
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

function updateView(useTransition = false) {
const categories = [...new Set(state.items.map(i => i.categoria))];
const paint = () => {
    renderCategories(els.categoryStrip, categories, state.activeCategory, cat => {
    state.activeCategory = cat;
    updateView(true);
    });
    renderMenu(els.menuContainer, getFilteredItems(), item => {
    openDetailSheet(els.detailDialog, item);
    });
};

if (useTransition && document.startViewTransition) {
    document.startViewTransition(paint);
} else {
    paint();
}
}

async function loadData() {
const cached = readCachedMenu();
if (cached && cached.length) {
    state.items = cached;
    updateView(false);
}

try {
    const live = await fetchLiveMenu();
    state.items = live;
    updateView(false);
} catch (err) {
    if (!state.items.length) {
    renderError(
        els.menuContainer,
        'No pudimos cargar la carta en este momento. Verifica tu conexión o la URL del menú.',
        loadData
    );
    }
    console.warn('Error cargando menú en vivo:', err.message);
}
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
}

initBranding();
initTheme();
initInteractions();
loadData();