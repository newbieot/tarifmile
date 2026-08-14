(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};
  const POSTCODE_LIKE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,11}$/;

  function isBlank(value) {
    return String(value ?? '').trim() === '';
  }

  function toFiniteNumber(value) {
    if (value === '' || value === null || value === undefined) return Number.NaN;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  }

  function validateGlobalFields(values) {
    const customerId = String(values.customerId ?? '').trim();
    const salesforceNumber = String(values.salesforceNumber ?? '').trim();
    const startDate = String(values.startDate ?? '').trim();
    const endDate = String(values.endDate ?? '').trim();
    const errors = {};

    if (!customerId) errors.customerId = 'ID Pelanggan wajib diisi.';
    if (!salesforceNumber) errors.salesforceNumber = 'Nomor Salesforce wajib diisi.';
    else if (!/[0-9]/.test(salesforceNumber)) errors.salesforceNumber = 'Nomor Salesforce harus memuat minimal satu angka.';
    if (!startDate) errors.startDate = 'Tanggal mulai berlaku wajib diisi.';
    if (!endDate) errors.endDate = 'Tanggal akhir berlaku wajib diisi.';
    if (startDate && endDate && endDate < startDate) {
      errors.endDate = 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.';
    }

    const completedFields = [customerId, salesforceNumber, startDate, endDate].filter(Boolean).length;
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      completedFields,
      remainingFields: 4 - completedFields,
      normalized: { customerId, salesforceNumber, startDate, endDate }
    };
  }

  function buildDuplicateMap(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const origin = String(row.origin ?? '').trim().toUpperCase();
      const destination = String(row.destination ?? '').trim().toUpperCase();
      const serviceId = String(row.serviceId ?? '').trim();
      if (!origin || !destination || !serviceId) return;
      const key = `${origin}|${destination}|${serviceId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row.id);
    });
    return map;
  }

  function validateRow(row, duplicateMap) {
    const errors = {};
    const warnings = [];
    const origin = String(row.origin ?? '').trim();
    const destination = String(row.destination ?? '').trim();
    const serviceId = Number(row.serviceId);
    const formulaId = namespace.resolveFormulaId(row);
    const slaDays = toFiniteNumber(row.slaDays);
    const minimumWeight = toFiniteNumber(row.minimumWeight);
    const minimumTariff = toFiniteNumber(row.minimumTariff);
    const incrementWeight = toFiniteNumber(row.incrementWeight);
    const incrementTariff = toFiniteNumber(row.incrementTariff);
    const description = String(row.description ?? '').trim();

    if (!origin) errors.origin = 'Asal wajib diisi.';
    else if (!POSTCODE_LIKE_PATTERN.test(origin)) errors.origin = 'Gunakan kode 3–12 karakter berupa huruf, angka, atau tanda hubung.';

    if (!destination) errors.destination = 'Tujuan wajib diisi.';
    else if (!POSTCODE_LIKE_PATTERN.test(destination)) errors.destination = 'Gunakan kode 3–12 karakter berupa huruf, angka, atau tanda hubung.';

    if (!namespace.getService || !namespace.getService(serviceId)) errors.serviceId = 'Pilih layanan yang didukung.';
    if (!Number.isFinite(formulaId)) errors.formulaIdOverride = 'Formula ID otomatis tidak tersedia. Pilih 1644 (PJE) atau layanan lain.';

    if (!Number.isFinite(slaDays)) errors.slaDays = 'SLA wajib diisi.';
    else if (!Number.isInteger(slaDays) || slaDays <= 0) errors.slaDays = 'SLA harus berupa hari bulat lebih dari 0.';

    if (!Number.isFinite(minimumWeight)) errors.minimumWeight = 'Berat minimum wajib diisi.';
    else if (minimumWeight <= 0) errors.minimumWeight = 'Berat minimum harus lebih dari 0.';

    if (!Number.isFinite(minimumTariff)) errors.minimumTariff = 'Tarif minimum wajib diisi.';
    else if (minimumTariff < 0) errors.minimumTariff = 'Tarif minimum tidak boleh negatif.';

    if (!Number.isFinite(incrementWeight)) errors.incrementWeight = 'Berat kelipatan wajib diisi.';
    else if (incrementWeight <= 0) errors.incrementWeight = 'Berat kelipatan harus lebih dari 0.';

    if (!Number.isFinite(incrementTariff)) errors.incrementTariff = 'Tarif kelipatan wajib diisi.';
    else if (incrementTariff < 0) errors.incrementTariff = 'Tarif kelipatan tidak boleh negatif.';

    if (!description) errors.description = 'Deskripsi wajib diisi.';

    let duplicate = false;
    if (origin && destination && Number.isFinite(serviceId)) {
      const key = `${origin.toUpperCase()}|${destination.toUpperCase()}|${serviceId}`;
      const matches = duplicateMap.get(key) || [];
      duplicate = matches.length > 1;
      if (duplicate) warnings.push('Kombinasi asal–tujuan–layanan duplikat.');
    }

    if (row.importNeedsReview && row.importReviewMessage) warnings.push(row.importReviewMessage);

    const errorKeys = Object.keys(errors);
    const hasMissing = errorKeys.some((key) => isBlank(row[key]));
    let status = 'ready';
    if (errorKeys.length > 0) status = hasMissing ? 'incomplete' : 'invalid';
    else if (warnings.length > 0) status = 'needs-review';

    return {
      rowId: row.id,
      status,
      statusLabel: status === 'ready' ? 'Siap' : status === 'needs-review' ? 'Perlu Ditinjau' : status === 'invalid' ? 'Tidak Valid' : 'Belum Lengkap',
      errors,
      warnings,
      duplicate,
      critical: errorKeys.length > 0 || duplicate,
      normalized: {
        origin,
        destination,
        serviceId,
        formulaId,
        slaDays,
        minimumWeight,
        minimumTariff,
        incrementWeight,
        incrementTariff,
        description
      }
    };
  }

  function validateRows(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const duplicateMap = buildDuplicateMap(safeRows);
    const results = safeRows.map((row) => validateRow(row, duplicateMap));
    const counts = {
      total: results.length,
      ready: 0,
      needsReview: 0,
      invalid: 0,
      incomplete: 0,
      duplicates: 0,
      critical: 0
    };

    results.forEach((result) => {
      if (result.status === 'ready') counts.ready += 1;
      else if (result.status === 'needs-review') counts.needsReview += 1;
      else if (result.status === 'invalid') counts.invalid += 1;
      else counts.incomplete += 1;
      if (result.duplicate) counts.duplicates += 1;
      if (result.critical) counts.critical += 1;
    });

    return { results, counts, duplicateMap };
  }

  function validateWorkspace(globalValues, rows) {
    const globals = validateGlobalFields(globalValues);
    const rowValidation = validateRows(rows);
    const hasRows = Array.isArray(rows) && rows.length > 0;
    const exportable = globals.valid && hasRows && rowValidation.counts.critical === 0;
    return {
      globals,
      rows: rowValidation,
      exportable,
      readyForReview: globals.completedFields > 0 || hasRows,
      readyCount: rowValidation.counts.ready + rowValidation.counts.needsReview
    };
  }

  Object.assign(namespace, {
    POSTCODE_LIKE_PATTERN,
    isBlank,
    toFiniteNumber,
    validateGlobalFields,
    buildDuplicateMap,
    validateRow,
    validateRows,
    validateWorkspace
  });

  root.TariffBuilder = namespace;
  if (typeof module !== 'undefined' && module.exports) module.exports = namespace;
})(typeof window !== 'undefined' ? window : globalThis);
