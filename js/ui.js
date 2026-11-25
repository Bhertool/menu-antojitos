const copFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const MAX_QTY = 20;

export function formatCOP(value) {
    return copFormatter.format(Number(value) || 0);
}

function parseMinutes(hhmm) {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
}

function format12h(hhmm) {
    const mins = parseMinutes(hhmm);
    if (mins === null) return '';
    const h24 = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const suffix = h24 >= 12 ? 'p. m.' : 'a. m.';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function renderStoreStatus(el, schedule) {
    if (!el || !schedule) return;

    const setPill = (isOpen, text) => {
        el.hidden = false;
        el.className = `status-pill ${isOpen ? 'is-open' : 'is-closed'}`;
        el.innerHTML = '<span class="status-pill__dot" aria-hidden="true"></span><span></span>';
        el.querySelector('span:last-child').textContent = text;
    };

    if (schedule.modo === 'ABIERTO') {
        setPill(true, schedule.mensaje ? `Abierto · ${schedule.mensaje}` : 'Abierto ahora');
        return;
    }
    if (schedule.modo === 'CERRADO') {
        setPill(false, schedule.mensaje ? `Cerrado · ${schedule.mensaje}` : 'Cerrado hoy');
        return;
    }

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayNum = dayMap[parts.find(p => p.type === 'weekday')?.value];
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0) % 24;
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const nowMins = hour * 60 + minute;

    const daysByNum = new Map((schedule.dias || []).map(d => [Number(d.dia_num), d]));
    const today = daysByNum.get(todayNum);

    if (today && today.abierto) {
        const openM = parseMinutes(today.apertura);
        const closeM = parseMinutes(today.cierre);
        if (openM !== null && closeM !== null) {
            const crossesMidnight = closeM <= openM;
            const isOpen = crossesMidnight
                ? (nowMins >= openM || nowMins < closeM)
                : (nowMins >= openM && nowMins < closeM);

            if (isOpen) {
                setPill(true, `Abierto · Hasta ${format12h(today.cierre)}`);
                return;
            }
            if (nowMins < openM) {
                setPill(false, `Cerrado · Abrimos hoy ${format12h(today.apertura)}`);
                return;
            }
        }
    }

    for (let offset = 1; offset <= 7; offset++) {
        const next = daysByNum.get((todayNum + offset) % 7);
        if (next && next.abierto && next.apertura) {
            const labelDia = offset === 1 ? 'mañana' : next.dia.slice(0, 3).toLowerCase();
            setPill(false, `Cerrado · Abrimos ${labelDia} ${format12h(next.apertura)}`);
            return;
        }
    }

    setPill(false, schedule.mensaje ? `Cerrado · ${schedule.mensaje}` : 'Cerrado');
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

function placeholderThumb() {
    const span = document.createElement('span');
    span.className = 'menu-item__thumb menu-item__thumb--empty';
    span.setAttribute('aria-hidden', 'true');
    return span;
}

function createThumb(item) {
    if (!item.foto_url) return placeholderThumb();

    const img = document.createElement('img');
    img.className = 'menu-item__thumb';
    img.src = item.foto_url;
    img.alt = item.nombre;
    img.loading = 'lazy';
    img.decoding = 'async';
    // Sin señal o foto rota: se muestra el placeholder en vez de un hueco
    img.onerror = () => img.replaceWith(placeholderThumb());
    return img;
}

/**
 * handlers.onOpen(item): abrir el detalle
 * handlers.onQuickAdd(item): tocar el "+" de la fila
 */
export function renderMenu(containerEl, items, handlers) {
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

        const ornament = document.createElement('div');
        ornament.className = 'cat-ornament';
        ornament.setAttribute('aria-hidden', 'true');
        ornament.appendChild(document.createElement('i'));

        const listWrap = document.createElement('div');
        listWrap.className = 'item-list';

        for (const item of list) {
            const row = document.createElement('div');
            row.className = `menu-item${item.disponible ? '' : ' is-unavailable'}`;

            const main = document.createElement('button');
            main.type = 'button';
            main.className = 'menu-item__main';
            main.addEventListener('click', () => handlers.onOpen(item));

            const info = document.createElement('div');
            info.className = 'menu-item__info';

            const nameRow = document.createElement('div');
            nameRow.className = 'menu-item__name';
            nameRow.textContent = item.nombre;

            if (item.destacado && item.disponible) {
                const badge = document.createElement('span');
                badge.className = 'badge-featured';
                badge.textContent = 'Recomendado';
                nameRow.appendChild(badge);
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
                sold.textContent = 'Agotado hoy';
                right.appendChild(sold);
            }

            main.append(createThumb(item), info, right);
            row.appendChild(main);

            if (item.disponible) {
                const add = document.createElement('button');
                add.type = 'button';
                add.className = 'menu-item__add';
                add.dataset.addId = item.id;
                add.textContent = '+';
                add.setAttribute('aria-label', `Agregar ${item.nombre} al pedido`);
                add.addEventListener('click', () => handlers.onQuickAdd(item));
                row.appendChild(add);
            }

            listWrap.appendChild(row);
        }

        section.append(heading, ornament, listWrap);
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

/**
 * Hoja de detalle. onAdd(item, opcionElegida|null, cantidad) se llama al
 * tocar "Agregar"; la hoja se cierra sola después.
 */
export function openDetailSheet(dialogEl, item, onAdd) {
    const media = dialogEl.querySelector('#sheetMedia');
    const img = dialogEl.querySelector('#sheetImg');
    const cat = dialogEl.querySelector('#sheetCategory');
    const featured = dialogEl.querySelector('#sheetFeatured');
    const status = dialogEl.querySelector('#sheetStatus');
    const title = dialogEl.querySelector('#sheetTitle');
    const price = dialogEl.querySelector('#sheetPrice');
    const desc = dialogEl.querySelector('#sheetDesc');
    const optsWrap = dialogEl.querySelector('#sheetOptionsWrap');
    const optsLabel = dialogEl.querySelector('#sheetOptionsLabel');
    const optsBox = dialogEl.querySelector('#sheetOptions');
    const qtyMinus = dialogEl.querySelector('#qtyMinus');
    const qtyPlus = dialogEl.querySelector('#qtyPlus');
    const qtyValue = dialogEl.querySelector('#qtyValue');
    const addBtn = dialogEl.querySelector('#addToCartBtn');

    cat.textContent = item.categoria;
    title.textContent = item.nombre;
    price.textContent = formatCOP(item.precio);
    if (featured) featured.hidden = !(item.destacado && item.disponible);
    status.hidden = item.disponible;

    // Foto completa, o placeholder si no hay foto / no cargó
    media.hidden = false;
    if (item.foto_url) {
        media.classList.remove('is-placeholder');
        img.src = item.foto_url;
        img.alt = item.nombre;
        media.style.setProperty('--photo-bg', `url("${item.foto_url}")`);
        img.onerror = () => {
            media.classList.add('is-placeholder');
            media.style.removeProperty('--photo-bg');
        };
    } else {
        media.classList.add('is-placeholder');
        media.style.removeProperty('--photo-bg');
        img.removeAttribute('src');
        img.alt = '';
        img.onerror = null;
    }

    if (item.descripcion) {
        desc.textContent = item.descripcion;
        desc.hidden = false;
    } else {
        desc.hidden = true;
    }

    // Estado del pedido dentro de la hoja
    const options = item.opciones || [];
    let selected = options.length === 1 ? options[0] : null;
    let qty = 1;

    const refresh = () => {
        qtyValue.textContent = String(qty);
        qtyMinus.disabled = qty <= 1;
        qtyPlus.disabled = qty >= MAX_QTY;

        if (!item.disponible) {
            addBtn.disabled = true;
            addBtn.textContent = 'Agotado hoy';
        } else if (options.length && !selected) {
            addBtn.disabled = true;
            addBtn.textContent = 'Elige una opción';
        } else {
            addBtn.disabled = false;
            addBtn.textContent = `Agregar · ${formatCOP((Number(item.precio) || 0) * qty)}`;
        }

        optsBox.querySelectorAll('.option-chip').forEach(chip => {
            chip.setAttribute('aria-pressed', String(chip.dataset.option === selected));
        });
    };

    optsBox.replaceChildren();
    if (options.length) {
        optsLabel.textContent = item.disponible ? 'Elige una opción' : 'Opciones disponibles';
        options.forEach(opt => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'option-chip';
            chip.dataset.option = opt;
            chip.textContent = opt;
            chip.disabled = !item.disponible;
            chip.addEventListener('click', () => {
                selected = opt;
                refresh();
            });
            optsBox.appendChild(chip);
        });
        optsWrap.hidden = false;
    } else {
        optsWrap.hidden = true;
    }

    // onclick (no addEventListener): cada apertura reemplaza el manejador anterior
    qtyMinus.onclick = () => { qty = Math.max(1, qty - 1); refresh(); };
    qtyPlus.onclick = () => { qty = Math.min(MAX_QTY, qty + 1); refresh(); };
    addBtn.onclick = () => {
        if (!item.disponible || (options.length && !selected)) return;
        onAdd(item, selected, qty);
        dialogEl.close();
    };

    refresh();
    dialogEl.scrollTop = 0;
    dialogEl.showModal();
}

let toastTimer;
export function showToast(toastEl, text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}
