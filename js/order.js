import { formatCOP, showToast } from './ui.js';
import { SERVICES, MAX_QTY, resolveLines, orderTotal, orderCount, buildOrderMessage } from './cart.js';

const CUSTOMER_KEY = 'antojitos_customer_v1';

function loadCustomer() {
    try {
        const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}');
        return {
            name: typeof saved.name === 'string' ? saved.name : '',
            service: SERVICES[saved.service] ? saved.service : 'aqui',
            detail: typeof saved.detail === 'string' ? saved.detail : ''
        };
    } catch {
        return { name: '', service: 'aqui', detail: '' };
    }
}

function saveCustomer(customer) {
    try {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify({
            name: customer.name,
            service: customer.service,
            detail: customer.detail
        }));
    } catch {
        // Ignorar si el almacenamiento está restringido
    }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Conecta carrito + barra flotante + hoja del pedido.
 * getItems(): devuelve el menú vigente (para precios y disponibilidad).
 */
export function initOrder({ cart, getItems, business, toastEl }) {
    const bar = document.querySelector('#cartBar');
    const barCount = document.querySelector('#cartCount');
    const barTotal = document.querySelector('#cartTotal');
    const dialog = document.querySelector('#cartDialog');
    const closeBtn = document.querySelector('#closeCartBtn');
    const linesEl = document.querySelector('#cartLines');
    const warning = document.querySelector('#cartWarning');
    const form = document.querySelector('#orderForm');
    const nameInput = form.elements.name;
    const detailInput = form.elements.detail;
    const notesInput = form.elements.notes;
    const detailField = document.querySelector('#detailField');
    const detailLabel = document.querySelector('#detailLabel');
    const totalEl = document.querySelector('#orderTotal');
    const submitBtn = document.querySelector('#sendOrderBtn');
    const clearBtn = document.querySelector('#clearCartBtn');
    const sentNote = document.querySelector('#sentNote');

    let lastCount = 0;

    const resolved = () => resolveLines(cart.lines(), getItems());

    function selectedService() {
        return form.elements.service.value || 'aqui';
    }

    function applyService() {
        const svc = SERVICES[selectedService()];
        detailField.hidden = !svc.detailShown;
        detailLabel.textContent = svc.detailLabel;
        detailInput.required = svc.detailRequired;
        detailInput.autocomplete = selectedService() === 'domicilio' ? 'street-address' : 'off';
    }

    function syncBadges() {
        document.querySelectorAll('[data-add-id]').forEach(btn => {
            const qty = cart.qtyForItem(btn.dataset.addId);
            if (qty > 0) btn.dataset.qty = String(qty);
            else btn.removeAttribute('data-qty');
        });
    }

    function makeStepper(line) {
        const wrap = document.createElement('div');
        wrap.className = 'stepper stepper--sm';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', `Cantidad de ${line.item.nombre}`);

        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', line.qty === 1 ? `Quitar ${line.item.nombre}` : 'Quitar uno');
        minus.addEventListener('click', () => cart.setQty(line.key, line.qty - 1));

        const out = document.createElement('output');
        out.textContent = String(line.qty);

        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', 'Agregar uno');
        plus.disabled = line.qty >= MAX_QTY || !line.available;
        plus.addEventListener('click', () => cart.setQty(line.key, line.qty + 1));

        wrap.append(minus, out, plus);
        return wrap;
    }

    function renderLines(lines) {
        linesEl.replaceChildren();

        for (const line of lines) {
            const li = document.createElement('li');
            li.className = `cart-line${line.available ? '' : ' is-unavailable'}`;

            const info = document.createElement('div');
            info.className = 'cart-line__info';

            const name = document.createElement('div');
            name.className = 'cart-line__name';
            name.textContent = line.item.nombre;
            info.appendChild(name);

            const metaText = !line.available
                ? 'Agotado hoy — quítalo para continuar'
                : [line.option, `${formatCOP(line.price)} c/u`].filter(Boolean).join(' · ');
            const meta = document.createElement('div');
            meta.className = 'cart-line__meta';
            meta.textContent = metaText;
            info.appendChild(meta);

            const side = document.createElement('div');
            side.className = 'cart-line__side';

            const price = document.createElement('span');
            price.className = 'cart-line__price';
            price.textContent = formatCOP(line.subtotal);

            side.append(price, makeStepper(line));
            li.append(info, side);
            linesEl.appendChild(li);
        }
    }

    function render() {
        const lines = resolved();
        const count = orderCount(lines);
        const total = orderTotal(lines);
        const hasUnavailable = lines.some(l => !l.available);

        // Barra flotante
        bar.hidden = lines.length === 0;
        document.body.classList.toggle('has-cart', lines.length > 0);
        barCount.textContent = String(count);
        barTotal.textContent = formatCOP(total);
        bar.setAttribute('aria-label', `Ver pedido: ${count} productos, ${formatCOP(total)}`);

        if (count > lastCount && !bar.hidden && !reducedMotion()) {
            bar.animate(
                [{ scale: '1' }, { scale: '1.05' }, { scale: '1' }],
                { duration: 260, easing: 'ease-out' }
            );
        }
        lastCount = count;

        syncBadges();

        // Hoja del pedido
        if (!lines.length && dialog.open) dialog.close();
        renderLines(lines);
        warning.hidden = !hasUnavailable;
        warning.textContent = 'Algunos productos se agotaron. Quítalos para poder enviar el pedido.';
        totalEl.textContent = formatCOP(total);
        submitBtn.disabled = !count || hasUnavailable;
        submitBtn.textContent = count ? `Enviar pedido por WhatsApp · ${formatCOP(total)}` : 'Enviar pedido por WhatsApp';
    }

    function openCart() {
        sentNote.hidden = true;
        render();
        dialog.scrollTop = 0;
        dialog.showModal();
    }

    // ── Eventos ──
    bar.addEventListener('click', openCart);
    closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
        if (e.target === dialog) dialog.close();
    });

    form.addEventListener('change', e => {
        if (e.target.name === 'service') applyService();
    });

    clearBtn.addEventListener('click', () => {
        cart.clear();
        showToast(toastEl, 'Pedido vaciado');
    });

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (!form.reportValidity()) return;

        const lines = resolved();
        if (!orderCount(lines) || lines.some(l => !l.available)) return;

        const customer = {
            name: nameInput.value.trim(),
            service: selectedService(),
            detail: detailInput.value.trim(),
            notes: notesInput.value.trim()
        };
        saveCustomer(customer);

        const message = buildOrderMessage({
            businessName: business.name,
            lines,
            total: orderTotal(lines),
            customer
        });

        const url = `${business.whatsappUrl}?text=${encodeURIComponent(message)}`;
        const opened = window.open(url, '_blank', 'noopener');
        if (!opened) window.location.href = url;

        sentNote.hidden = false;
    });

    cart.subscribe(render);

    // Datos recordados del último pedido
    const saved = loadCustomer();
    nameInput.value = saved.name;
    detailInput.value = saved.detail;
    form.elements.service.value = saved.service;
    applyService();
    render();

    return {
        /** Llamar cuando cambie el menú (llegó la versión en vivo). */
        refresh() {
            cart.prune(getItems());
            render();
        },
        syncBadges
    };
}
