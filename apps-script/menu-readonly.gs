// apps-script/menu-readonly.gs
// Endpoint público 100% de solo lectura para el menú QR y estado de horarios

const MENU_SHEET = 'Menu';
const SCHEDULE_SHEET = 'Horarios';
const CACHE_KEY = 'ANTOJITOS_MENU_PUBLIC_V2';
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
  const sheet = ss.getSheetByName(MENU_SHEET);
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

  const schedule = readSchedule(ss);

  const payload = {
    ok: true,
    updatedAt: new Date().toISOString(),
    total: items.length,
    items,
    schedule
  };

  cache.put(CACHE_KEY, JSON.stringify(payload), CACHE_TTL_SECONDS);
  return jsonResponse(payload);
}

function readSchedule(ss) {
  const sheet = ss.getSheetByName(SCHEDULE_SHEET);
  if (!sheet) return null;

  const formatTime = val => {
    if (!val) return '';
    if (val instanceof Date) {
      return Utilities.formatDate(val, 'America/Bogota', 'HH:mm');
    }
    return String(val).trim();
  };

  const dayRows = sheet.getRange('A2:E8').getValues();
  const dias = dayRows
    .filter(r => r[1])
    .map(r => ({
      dia_num: Number(r[0]),
      dia: String(r[1]).trim(),
      abierto: r[2] === true || String(r[2]).toUpperCase() === 'TRUE',
      apertura: formatTime(r[3]),
      cierre: formatTime(r[4])
    }));

  const modo = String(sheet.getRange('B11').getValue() || 'AUTO').trim().toUpperCase();
  const mensaje = String(sheet.getRange('B12').getValue() || '').trim();

  return { modo, mensaje, dias };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}