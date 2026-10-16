(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};
  const ACCEPTED_EXTENSIONS = Object.freeze(['xlsx', 'xls', 'csv']);
  const REQUIRED_HEADERS = Object.freeze(['RUTE KANTOR', 'TARIF', 'LAYANAN']);
  const ZONE_HEADERS = Object.freeze(['KODEPOS ASAL ZONA', 'KODEPOS TUJUAN ZONA']);
  const ZONE_TARIFF_TYPES = Object.freeze({
    reguler: Object.freeze({ label: 'REGULER', serviceId: 420, serviceName: 'PKH' }),
    nextday: Object.freeze({ label: 'NEXTDAY', serviceId: 411, serviceName: 'PE' })
  });

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

  function findHeaderRow(rawRows, options) {
    const tariffType = (options && options.tariffType) || 'reguler';
    const zoneTariff = ZONE_TARIFF_TYPES[tariffType];
    if (!zoneTariff) {
      const error = new Error('Pilih tarif REGULER (PKH) atau NEXTDAY (PE).');
      error.code = 'INVALID_TARIFF_TYPE';
      throw error;
    }
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return { found: false, rowIndex: -1, indexes: null };
    }

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
      const row = Array.isArray(rawRows[rowIndex]) ? rawRows[rowIndex] : [];
      const normalized = row.map(normalizeHeader);
      const origin = normalized.indexOf(ZONE_HEADERS[0]);
      const destination = normalized.indexOf(ZONE_HEADERS[1]);
      if (origin >= 0 && destination >= 0) {
        const typedTariff = normalized.findIndex((name) => /^TARIF\b/.test(name) && name.split(' ').includes(zoneTariff.label));
        const tariff = typedTariff >= 0 ? typedTariff : normalized.indexOf('TARIF');
        const serviceDescription = normalized.indexOf('LAYANAN');
        if (tariff >= 0 && (typedTariff >= 0 || serviceDescription >= 0)) {
          return {
            found: true, rowIndex, format: 'zone',
            tariffType: typedTariff >= 0 ? tariffType : null,
            indexes: { route: -1, origin, destination, tariff, serviceDescription },
            normalizedHeaders: normalized
          };
        }
        continue;
      }
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

  function parseSourceRows(rawRows, options) {
    const header = findHeaderRow(rawRows, options);
    if (!header.found) {
      const error = new Error('Kolom wajib RUTE KANTOR, TARIF, dan Layanan tidak ditemukan. Format zona memerlukan KODEPOS ASAL ZONA, KODEPOS TUJUAN ZONA, serta kolom tarif REGULER/NEXTDAY yang dipilih (atau TARIF dan Layanan).');
      error.code = 'MISSING_HEADERS';
      throw error;
    }

    const summary = {
      headerRowNumber: header.rowIndex + 1,
      sourceFormat: header.format || 'route',
      tariffType: header.tariffType || null,
      sourceRowsFound: 0,
      routesImported: 0,
      duplicatesSkipped: 0,
      emptyRowsSkipped: 0,
      rowsRequiringReview: 0,
      invalidTariffRows: 0,
      conflictingTariffRoutes: 0,
      duplicateRoutes: []
    };
    const seenRoutes = new Map();
    const duplicateRouteKeys = new Set();
    const zoneTariff = header.tariffType ? ZONE_TARIFF_TYPES[header.tariffType] : null;
    const rows = [];

    for (let index = header.rowIndex + 1; index < rawRows.length; index += 1) {
      const sourceRow = Array.isArray(rawRows[index]) ? rawRows[index] : [];
      if (isEmptySourceRow(sourceRow)) {
        summary.emptyRowsSkipped += 1;
        continue;
      }
      summary.sourceRowsFound += 1;

      const origin = header.format === 'zone' ? String(sourceRow[header.indexes.origin] ?? '').trim() : '';
      const destination = header.format === 'zone' ? String(sourceRow[header.indexes.destination] ?? '').trim() : '';
      const rawRoute = header.format === 'zone'
        ? (origin || destination ? `${origin}|${destination}` : '')
        : String(sourceRow[header.indexes.route] ?? '').trim();
      if (!rawRoute) {
        summary.emptyRowsSkipped += 1;
        continue;
      }

      const tariff = parseTariffValue(sourceRow[header.indexes.tariff]);
      const previous = seenRoutes.get(rawRoute);
      if (previous) {
        summary.duplicatesSkipped += 1;
        duplicateRouteKeys.add(rawRoute);
        if (header.format === 'zone' && previous.tariff !== tariff && !previous.conflict) {
          previous.conflict = true;
          previous.row.minimumTariff = '';
          previous.row.incrementTariff = '';
          previous.row.importNeedsReview = true;
          previous.row.importReviewMessage = [previous.row.importReviewMessage,
            `Tarif berbeda untuk rute zona yang sama pada baris ${previous.row.sourceRowNumber} (${previous.tariff === '' ? 'kosong' : previous.tariff}) dan ${index + 1} (${tariff === '' ? 'kosong' : tariff}). Isi kembali Tarif Minimum dan Tarif Kelipatan.`
          ].filter(Boolean).join(' ');
          summary.conflictingTariffRoutes += 1;
        }
        continue;
      }

      const route = header.format === 'zone'
        ? { origin, destination, raw: rawRoute, needsReview: !origin || !destination,
          message: [!origin ? 'Kodepos asal zona kosong.' : '', !destination ? 'Kodepos tujuan zona kosong.' : ''].filter(Boolean).join(' ') }
        : parseRoute(rawRoute);
      const serviceDescription = zoneTariff ? zoneTariff.serviceName : String(sourceRow[header.indexes.serviceDescription] ?? '').trim();
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
        ...(zoneTariff ? { serviceId: zoneTariff.serviceId } : {}),
        minimumTariff: tariff,
        incrementTariff: tariff,
        description: serviceDescription,
        importedRouteRaw: route.raw,
        importNeedsReview: reviewMessages.length > 0,
        importReviewMessage: reviewMessages.join(' '),
        sourceRowNumber: index + 1
      });
      seenRoutes.set(rawRoute, { row, tariff, conflict: false });
      rows.push(row);
      summary.routesImported += 1;
    }

    summary.duplicateRoutes = Array.from(duplicateRouteKeys);
    summary.rowsRequiringReview = rows.filter((row) => row.importNeedsReview).length;

    if (rows.length === 0) {
      const error = new Error('Tidak ada rute tarif yang valid pada lembar kerja yang dipilih.');
      error.code = 'NO_VALID_ROUTES';
      error.summary = summary;
      throw error;
    }

    return { rows, summary, header };
  }

  async function readWorkbookFile(file, onProgress, options) {
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
        dense: true
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
        range: 0,
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
    const result = parseSourceRows(rawRows, options);
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
    ZONE_HEADERS,
    ZONE_TARIFF_TYPES,
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
