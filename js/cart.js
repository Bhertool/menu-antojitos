import { formatCOP } from './ui.js';

const STORAGE_KEY = 'antojitos_cart_v1';
export const MAX_QTY = 20;

const keyOf = (id, option) => `${id}::${option || ''}`;

function isValidLine(l) {
    return l && typeof l.id === 'string' && Number.isInteger(l.qty) && l.qty > 0;
}

/**
 * Carrito guardado en localStorage. Solo guarda id + opción + cantidad:
 * nombres y precios se leen del menú vigente, así un cambio de precio en la
 * hoja de cálculo se refleja en el pedido sin que el cliente haga nada.
 */
export function createCart() {
    const listeners = new Set();
    let lines = [];

    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(parsed)) lines = parsed.filter(isValidLine);
    } catch {
        lines = [];
    }

    function commit() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
        } catch {
            // Almacenamiento restringido: el carrito sigue funcionando en memoria
        }
        listeners.forEach(fn => fn());
    }

    return {
        lines: () => lines.map(l => ({ ...l, key: keyOf(l.id, l.option) })),

        add(id, option, qty = 1) {
            const key = keyOf(id, option);
            const found = lines.find(l => keyOf(l.id, l.option) === key);
            if (found) {
                found.qty = Math.min(MAX_QTY, found.qty + qty);
            } else {
                lines.push({ id: String(id), option: option || null, qty: Math.min(MAX_QTY, qty) });
            }
            commit();
        },

        setQty(key, qty) {
            const idx = lines.findIndex(l => keyOf(l.id, l.option) === key);
            if (idx === -1) return;
            if (qty <= 0) lines.splice(idx, 1);
            else lines[idx].qty = Math.min(MAX_QTY, qty);
            commit();
        },

        clear() {
            lines = [];
            commit();
        },

        /** Quita productos u opciones que ya no existen en la carta. */
        prune(items) {
            if (!items.length) return;
            const byId = new Map(items.map(i => [String(i.id), i]));
            const before = lines.length;
            lines = lines.filter(l => {
                const item = byId.get(l.id);
                if (!item) return false;
                if (l.option && !(item.opciones || []).includes(l.option)) return false;
                return true;
            });
            if (lines.length !== before) commit();
        },

        qtyForItem: id => lines.filter(l => l.id === String(id)).reduce((n, l) => n + l.qty, 0),

        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    };
}

/** Une las líneas guardadas con los datos actuales del menú. */
export function resolveLines(lines, items) {
    const byId = new Map(items.map(i => [String(i.id), i]));
    const out = [];
    for (const l of lines) {
        const item = byId.get(l.id);
        if (!item) continue;
        const price = Number(item.precio) || 0;
        out.push({
            key: l.key,
            item,
            option: l.option,
            qty: l.qty,
            price,
            subtotal: price * l.qty,
            available: Boolean(item.disponible)
        });
    }
    return out;
}

export const orderTotal = resolved =>
    resolved.filter(l => l.available).reduce((sum, l) => sum + l.subtotal, 0);

export const orderCount = resolved =>
    resolved.filter(l => l.available).reduce((n, l) => n + l.qty, 0);

export const SERVICES = {
    aqui: { label: 'Comer aquí', detailLabel: 'Mesa o referencia (opcional)', detailRequired: false, detailShown: true },
    llevar: { label: 'Para llevar', detailLabel: '', detailRequired: false, detailShown: false },
    domicilio: { label: 'Domicilio', detailLabel: 'Dirección de entrega', detailRequired: true, detailShown: true }
};

const money = value => formatCOP(value).replace(/\s/g, '');

/** Texto del pedido listo para WhatsApp (usa *negrita* de WhatsApp). */
export function buildOrderMessage({ businessName, lines, total, customer }) {
    const service = SERVICES[customer.service] || SERVICES.aqui;
    const out = [`*Pedido para ${businessName}*`, ''];

    out.push(`*Nombre:* ${customer.name}`);
    out.push(`*Servicio:* ${service.label}`);
    if (service.detailShown && customer.detail) {
        const label = customer.service === 'domicilio' ? 'Dirección' : 'Mesa';
        out.push(`*${label}:* ${customer.detail}`);
    }

    out.push('', '*Productos*');
    for (const l of lines.filter(x => x.available)) {
        const opt = l.option ? ` (${l.option})` : '';
        out.push(`• ${l.qty} × ${l.item.nombre}${opt} — ${money(l.subtotal)}`);
    }

    out.push('', `*Total productos: ${money(total)}*`);
    if (customer.service === 'domicilio') {
        out.push('_El valor del domicilio se confirma por este chat._');
    }

    if (customer.notes) {
        out.push('', `*Notas:* ${customer.notes}`);
    }

    return out.join('\n');
}
