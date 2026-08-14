(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};
  const ACCEPTED_EXTENSIONS = Object.freeze(['xlsx', 'xls', 'csv']);
  const REQUIRED_HEADERS = Object.freeze(['RUTE KANTOR', 'TARIF', 'LAYANAN']);

  function normalizeHeader(value) {
    return String(value ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function getExtension(filename) {
    const parts = String(filename ?? '').toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
  }

  function validateSourceFile(file) {
    if (!file) return { valid: false, message: 'Pilih file XLSX, XLS, atau CSV.' };
    const extension = getExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      return { valid: false, message: 'Jenis file tidak didukung. Pilih file XLSX, XLS, atau CSV.' };
    }
    if (Number(file.size) === 0) {
      return { valid: false, message: 'File yang dipilih kosong.' };
    }
    return { valid: true, extension };
  }

  function findHeaderRow(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return { found: false, rowIndex: -1, indexes: null };
    }

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
      const row = Array.isArray(rawRows[rowIndex]) ? rawRows[rowIndex] : [];
      const normalized = row.map(normalizeHeader);
      const indexes = {
        route: normalized.indexOf(REQUIRED_HEADERS[0]),
        tariff: normalized.indexOf(REQUIRED_HEADERS[1]),
        serviceDescription: normalized.indexOf(REQUIRED_HEADERS[2])
      };
      if (indexes.route >= 0 && indexes.tariff >= 0 && indexes.serviceDescription >= 0) {
        return { found: true, rowIndex, indexes, normalizedHeaders: normalized };
      }
    }

    return { found: false, rowIndex: -1, indexes: null };
  }

  function parseTariffValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : '';

    let text = String(value).trim();
    if (!text) return '';
    text = text.replace(/\s+/g, '').replace(/rp/gi, '').replace(/[^0-9,.-]/g, '');
    if (!text || !/[0-9]/.test(text)) return '';

    const negative = text.startsWith('-');
    text = text.replace(/-/g, '');
    const dotCount = (text.match(/\./g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;

    let normalized = text;
    if (dotCount && commaCount) {
      const lastDot = text.lastIndexOf('.');
      const lastComma = text.lastIndexOf(',');
      const decimalSeparator = lastDot > lastComma ? '.' : ',';
      const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
      normalized = text.split(thousandsSeparator).join('');
      const decimalIndex = normalized.lastIndexOf(decimalSeparator);
      const decimals = normalized.length - decimalIndex - 1;
      if (decimals <= 2) normalized = normalized.replace(decimalSeparator, '.');
      else normalized = normalized.split(decimalSeparator).join('');
    } else if (dotCount || commaCount) {
      const separator = dotCount ? '.' : ',';
      const parts = text.split(separator);
      const lastPart = parts[parts.length - 1];
      const looksLikeThousands = parts.length > 2 || (lastPart.length === 3 && parts[0].length >= 1);
      normalized = looksLikeThousands ? parts.join('') : `${parts.slice(0, -1).join('')}.${lastPart}`;
    }

    const numeric = Number(`${negative ? '-' : ''}${normalized}`);
    return Number.isFinite(numeric) ? numeric : '';
  }

  function parseRoute(routeValue) {
    const raw = String(routeValue ?? '').trim();
    if (!raw) {
      return { origin: '', destination: '', needsReview: true, message: 'Rute kosong.', raw };
    }

    if (!raw.includes('|')) {
      return {
        origin: raw,
        destination: '',
        needsReview: true,
        message: 'Tujuan tidak ditemukan karena rute impor tidak memuat tanda |.',
        raw
      };
    }

    const parts = raw.split('|');
    const origin = String(parts[0] ?? '').trim();
    const destination = String(parts[1] ?? '').trim();
    const messages = [];
    if (!origin) messages.push('Asal kosong.');
    if (!destination) messages.push('Tujuan kosong.');
    if (parts.length > 2) messages.push('Rute memuat lebih dari satu tanda pemisah |.');

    return {
      origin,
      destination,
      needsReview: messages.length > 0,
      message: messages.join(' '),
      raw
    };
  }

  function isEmptySourceRow(row) {
    if (!Array.isArray(row) || row.length === 0) return true;
    return row.every((cell) => String(cell ?? '').trim() === '');
  }

  function parseSourceRows(rawRows) {
    const header = findHeaderRow(rawRows);
    if (!header.found) {
      const error = new Error('Kolom wajib RUTE KANTOR, TARIF, dan Layanan tidak ditemukan.');
      error.code = 'MISSING_HEADERS';
      throw error;
    }

    const summary = {
      headerRowNumber: header.rowIndex + 1,
      sourceRowsFound: 0,
      routesImported: 0,
      duplicatesSkipped: 0,
      emptyRowsSkipped: 0,
      rowsRequiringReview: 0,
      invalidTariffRows: 0,
      duplicateRoutes: []
    };
    const seenRoutes = new Set();
    const rows = [];

    for (let index = header.rowIndex + 1; index < rawRows.length; index += 1) {
      const sourceRow = Array.isArray(rawRows[index]) ? rawRows[index] : [];
      if (isEmptySourceRow(sourceRow)) {
        summary.emptyRowsSkipped += 1;
        continue;
      }
      summary.sourceRowsFound += 1;

      const routeCell = sourceRow[header.indexes.route];
      const rawRoute = String(routeCell ?? '').trim();
      if (!rawRoute) {
        summary.emptyRowsSkipped += 1;
        continue;
      }

      if (seenRoutes.has(rawRoute)) {
        summary.duplicatesSkipped += 1;
        summary.duplicateRoutes.push(rawRoute);
        continue;
      }
      seenRoutes.add(rawRoute);

      const route = parseRoute(rawRoute);
      const tariff = parseTariffValue(sourceRow[header.indexes.tariff]);
      const serviceDescription = String(sourceRow[header.indexes.serviceDescription] ?? '').trim();
      const reviewMessages = [];
      if (route.needsReview && route.message) reviewMessages.push(route.message);
      if (tariff === '') {
        reviewMessages.push('Nilai tarif impor tidak dapat dibaca sebagai angka.');
        summary.invalidTariffRows += 1;
      }
      if (!serviceDescription) reviewMessages.push('Deskripsi layanan pada data impor kosong.');

      const row = namespace.createDefaultRow({
        origin: route.origin,
        destination: route.destination,
        minimumTariff: tariff,
        incrementTariff: tariff,
        description: serviceDescription,
        importedRouteRaw: route.raw,
        importNeedsReview: reviewMessages.length > 0,
        importReviewMessage: reviewMessages.join(' '),
        sourceRowNumber: index + 1
      });
      rows.push(row);
      summary.routesImported += 1;
      if (reviewMessages.length > 0) summary.rowsRequiringReview += 1;
    }

    if (rows.length === 0) {
      const error = new Error('Tidak ada rute tarif yang valid pada lembar kerja yang dipilih.');
      error.code = 'NO_VALID_ROUTES';
      error.summary = summary;
      throw error;
    }

    return { rows, summary, header };
  }

  async function readWorkbookFile(file, onProgress) {
    const validation = validateSourceFile(file);
    if (!validation.valid) {
      const error = new Error(validation.message);
      error.code = 'INVALID_FILE';
      throw error;
    }
    if (!root.XLSX || !root.XLSX.read || !root.XLSX.utils) {
      const error = new Error('SheetJS tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.');
      error.code = 'SHEETJS_UNAVAILABLE';
      throw error;
    }

    const progress = typeof onProgress === 'function' ? onProgress : function () {};
    progress('Membaca workbook', 'Memuat file yang dipilih ke memori…');

    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (cause) {
      const error = new Error('File yang dipilih tidak dapat dibaca oleh browser ini.');
      error.code = 'FILE_READ_FAILED';
      error.cause = cause;
      throw error;
    }

    let workbook;
    try {
      workbook = root.XLSX.read(new Uint8Array(buffer), {
        type: 'array',
        cellDates: false,
        cellText: false,
        raw: true,
        dense: false
      });
    } catch (cause) {
      const message = /password|encrypt/i.test(String(cause && cause.message))
        ? 'Workbook terenkripsi tidak didukung. Hapus kata sandi lalu coba lagi.'
        : 'Workbook tidak dapat dibaca. Pastikan file merupakan XLSX, XLS, atau CSV yang valid.';
      const error = new Error(message);
      error.code = 'WORKBOOK_READ_FAILED';
      error.cause = cause;
      throw error;
    }

    if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
      const error = new Error('Workbook tidak memiliki lembar kerja yang dapat dibaca.');
      error.code = 'EMPTY_WORKBOOK';
      throw error;
    }

    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet || !firstSheet['!ref']) {
      const error = new Error('Lembar kerja pertama kosong.');
      error.code = 'EMPTY_WORKSHEET';
      throw error;
    }

    progress('Mendeteksi header', 'Mencari kolom wajib pada lembar kerja pertama…');
    let rawRows;
    try {
      rawRows = root.XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        raw: true,
        blankrows: true
      });
    } catch (cause) {
      const error = new Error('Lembar kerja pertama tidak dapat dikonversi menjadi baris tarif.');
      error.code = 'WORKSHEET_PARSE_FAILED';
      error.cause = cause;
      throw error;
    }

    progress('Mengimpor rute tarif', 'Memisahkan kode asal dan tujuan…');
    const result = parseSourceRows(rawRows);
    progress('Menghapus duplikat', 'Menyiapkan daftar rute yang dapat diedit…');
    return {
      ...result,
      sheetName: firstSheetName,
      extension: validation.extension
    };
  }

  Object.assign(namespace, {
    ACCEPTED_EXTENSIONS,
    REQUIRED_HEADERS,
    normalizeHeader,
    getExtension,
    validateSourceFile,
    findHeaderRow,
    parseTariffValue,
    parseRoute,
    parseSourceRows,
    readWorkbookFile
  });

  root.TariffBuilder = namespace;
  if (typeof module !== 'undefined' && module.exports) module.exports = namespace;
})(typeof window !== 'undefined' ? window : globalThis);
