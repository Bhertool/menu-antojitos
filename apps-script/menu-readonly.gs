// apps-script/menu-readonly.gs
// Endpoint público 100% de solo lectura para el menú QR

const SHEET_NAME = 'Menu';
const CACHE_KEY = 'ANTOJITOS_MENU_PUBLIC_V1';
const CACHE_TTL_SECONDS = 300; // 5 minutos

function doGet(e) {
  const forceRefresh = e && e.parameter && e.parameter.refresh === '1';
  const cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return jsonResponse(JSON.parse(cached));
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ ok: false, error: 'No se encontró la pestaña Menu' });
  }

  const rows = sheet.getDataRange().getValues();
  rows.shift(); // Quita encabezados

  const items = rows
    .filter(r => r[0] && r[2])
    .map(r => {
      const rawPrice = typeof r[3] === 'number'
        ? r[3]
        : Number(String(r[3] || '').replace(/[^\d]/g, '')) || 0;

      const rawOptions = String(r[5] || '').trim();
      const opciones = rawOptions
        ? rawOptions.split(/[\/|]/).map(o => o.trim()).filter(Boolean)
        : [];

      return {
        id: String(r[0]).trim(),
        categoria: String(r[1]).trim(),
        nombre: String(r[2]).trim(),
        precio: rawPrice,
        descripcion: String(r[4] || '').trim(),
        opciones,
        disponible: r[6] === true || String(r[6]).toUpperCase() === 'TRUE',
        foto_url: String(r[7] || '').trim(),
        destacado: r[8] === true || String(r[8]).toUpperCase() === 'TRUE'
      };
    });

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: items.length,
    items
  };

  cache.put(CACHE_KEY, JSON.stringify(payload), CACHE_TTL_SECONDS);
  return jsonResponse(payload);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}