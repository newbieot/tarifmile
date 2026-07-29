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

    if (!customerId) errors.customerId = 'Customer ID is required.';
    if (!salesforceNumber) errors.salesforceNumber = 'Salesforce Number is required.';
    else if (!/[0-9]/.test(salesforceNumber)) errors.salesforceNumber = 'Salesforce Number must contain at least one digit.';
    if (!startDate) errors.startDate = 'Effective Start Date is required.';
    if (!endDate) errors.endDate = 'Effective End Date is required.';
    if (startDate && endDate && endDate < startDate) {
      errors.endDate = 'End date cannot be earlier than the start date.';
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
    const minimumWeight = toFiniteNumber(row.minimumWeight);
    const minimumTariff = toFiniteNumber(row.minimumTariff);
    const incrementWeight = toFiniteNumber(row.incrementWeight);
    const incrementTariff = toFiniteNumber(row.incrementTariff);
    const description = String(row.description ?? '').trim();

    if (!origin) errors.origin = 'Origin is required.';
    else if (!POSTCODE_LIKE_PATTERN.test(origin)) errors.origin = 'Use a postcode-like code with 3–12 letters, digits, or hyphens.';

    if (!destination) errors.destination = 'Destination is required.';
    else if (!POSTCODE_LIKE_PATTERN.test(destination)) errors.destination = 'Use a postcode-like code with 3–12 letters, digits, or hyphens.';

    if (!namespace.getService || !namespace.getService(serviceId)) errors.serviceId = 'Choose a supported service.';

    if (!Number.isFinite(minimumWeight)) errors.minimumWeight = 'Minimum weight is required.';
    else if (minimumWeight <= 0) errors.minimumWeight = 'Minimum weight must be greater than zero.';

    if (!Number.isFinite(minimumTariff)) errors.minimumTariff = 'Minimum tariff is required.';
    else if (minimumTariff < 0) errors.minimumTariff = 'Minimum tariff must not be negative.';

    if (!Number.isFinite(incrementWeight)) errors.incrementWeight = 'Increment weight is required.';
    else if (incrementWeight <= 0) errors.incrementWeight = 'Increment weight must be greater than zero.';

    if (!Number.isFinite(incrementTariff)) errors.incrementTariff = 'Increment tariff is required.';
    else if (incrementTariff < 0) errors.incrementTariff = 'Increment tariff must not be negative.';

    if (!description) errors.description = 'Description is required.';

    let duplicate = false;
    if (origin && destination && Number.isFinite(serviceId)) {
      const key = `${origin.toUpperCase()}|${destination.toUpperCase()}|${serviceId}`;
      const matches = duplicateMap.get(key) || [];
      duplicate = matches.length > 1;
      if (duplicate) warnings.push('Duplicate origin–destination–service combination.');
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
      statusLabel: status === 'ready' ? 'Ready' : status === 'needs-review' ? 'Needs Review' : status === 'invalid' ? 'Invalid' : 'Incomplete',
      errors,
      warnings,
      duplicate,
      critical: errorKeys.length > 0 || duplicate,
      normalized: {
        origin,
        destination,
        serviceId,
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
