const copFormatter = new Intl.NumberFormat('es-CO', {
style: 'currency',
currency: 'COP',
maximumFractionDigits: 0
});

export function formatCOP(value) {
return copFormatter.format(Number(value) || 0);
}

export function renderCategories(stripEl, categories, activeCategory, onSelect) {
const allCats = ['Todos', ...categories];
stripEl.replaceChildren();

allCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-pill';
    btn.role = 'tab';
    btn.textContent = cat;
    btn.setAttribute('aria-selected', String(cat === activeCategory));
    btn.addEventListener('click', () => onSelect(cat));
    stripEl.appendChild(btn);
});
}

export function renderMenu(containerEl, items, onItemClick) {
containerEl.replaceChildren();

if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>No encontramos productos con ese filtro.</p>';
    containerEl.appendChild(empty);
    return;
}

const grouped = new Map();
for (const item of items) {
    if (!grouped.has(item.categoria)) grouped.set(item.categoria, []);
    grouped.get(item.categoria).push(item);
}

for (const [category, list] of grouped.entries()) {
    const section = document.createElement('section');
    section.className = 'cat-section';

    const heading = document.createElement('div');
    heading.className = 'cat-heading';
    heading.innerHTML = `<h2></h2><span></span>`;
    heading.querySelector('h2').textContent = category;
    heading.querySelector('span').textContent = `${list.length}`;

    const listWrap = document.createElement('div');
    listWrap.className = 'item-list';

    for (const item of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `menu-item${item.disponible ? '' : ' is-unavailable'}`;
    btn.addEventListener('click', () => onItemClick(item));

    if (item.foto_url) {
        const img = document.createElement('img');
        img.className = 'menu-item__thumb';
        img.src = item.foto_url;
        img.alt = item.nombre;
        img.loading = 'lazy';
        img.onerror = () => img.remove();
        btn.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'menu-item__info';

    const nameRow = document.createElement('div');
    nameRow.className = 'menu-item__name';
    nameRow.textContent = item.nombre;

    if (item.destacado) {
        const star = document.createElement('span');
        star.className = 'star-dot';
        star.textContent = '★';
        star.title = 'Recomendado';
        nameRow.appendChild(star);
    }

    info.appendChild(nameRow);

    if (item.opciones && item.opciones.length) {
        const hint = document.createElement('div');
        hint.className = 'menu-item__hint';
        hint.textContent = item.opciones.join(' · ');
        info.appendChild(hint);
    }

    const right = document.createElement('div');
    right.className = 'menu-item__right';

    const price = document.createElement('span');
    price.className = 'menu-item__price';
    price.textContent = formatCOP(item.precio);
    right.appendChild(price);

    if (!item.disponible) {
        const sold = document.createElement('span');
        sold.className = 'menu-item__soldout';
        sold.textContent = 'Agotado';
        right.appendChild(sold);
    }

    btn.append(info, right);
    listWrap.appendChild(btn);
    }

    section.append(heading, listWrap);
    containerEl.appendChild(section);
}
}

export function renderError(containerEl, message, onRetry) {
containerEl.replaceChildren();
const box = document.createElement('div');
box.className = 'empty-state';

const p = document.createElement('p');
p.textContent = message;

const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn-accent';
btn.textContent = 'Reintentar';
btn.addEventListener('click', onRetry);

box.append(p, btn);
containerEl.appendChild(box);
}

export function openDetailSheet(dialogEl, item) {
const media = dialogEl.querySelector('#sheetMedia');
const img = dialogEl.querySelector('#sheetImg');
const cat = dialogEl.querySelector('#sheetCategory');
const status = dialogEl.querySelector('#sheetStatus');
const title = dialogEl.querySelector('#sheetTitle');
const price = dialogEl.querySelector('#sheetPrice');
const desc = dialogEl.querySelector('#sheetDesc');
const optsWrap = dialogEl.querySelector('#sheetOptionsWrap');
const optsBox = dialogEl.querySelector('#sheetOptions');

cat.textContent = item.categoria;
title.textContent = item.nombre;
price.textContent = formatCOP(item.precio);
status.hidden = item.disponible;

if (item.foto_url) {
        img.src = item.foto_url;
        img.alt = item.nombre;
        media.style.setProperty('--photo-bg', `url("${item.foto_url}")`);
        media.hidden = false;
        img.onerror = () => { media.hidden = true; };
    } else {
        media.hidden = true;
        media.style.removeProperty('--photo-bg');
        img.removeAttribute('src');
    }

if (item.descripcion) {
    desc.textContent = item.descripcion;
    desc.hidden = false;
} else {
    desc.hidden = true;
}

optsBox.replaceChildren();
if (item.opciones && item.opciones.length) {
    item.opciones.forEach(opt => {
    const chip = document.createElement('span');
    chip.className = 'option-chip';
    chip.textContent = opt;
    optsBox.appendChild(chip);
    });
    optsWrap.hidden = false;
} else {
    optsWrap.hidden = true;
}

dialogEl.showModal();
}

let toastTimer;
export function showToast(toastEl, text) {
toastEl.textContent = text;
toastEl.classList.add('is-visible');
clearTimeout(toastTimer);
toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}