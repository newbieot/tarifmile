(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};

  const SERVICES = Object.freeze([
    Object.freeze({ id: 420, name: 'PKH' }),
    Object.freeze({ id: 411, name: 'POS EXPRESS' }),
    Object.freeze({ id: 428, name: 'PJE' }),
    Object.freeze({ id: 452, name: 'PJB' }),
    Object.freeze({ id: 481, name: 'KBM' }),
    Object.freeze({ id: 408, name: 'Q9' }),
    Object.freeze({ id: 453, name: 'PJM' }),
    Object.freeze({ id: 470, name: 'KRT' }),
    Object.freeze({ id: 446, name: 'EC3' })
  ]);

  const OUTPUT_HEADERS = Object.freeze([
    'tariff_from_code',
    'tariff_to_code',
    'service_id',
    'tariff_sla_day',
    'tariff_sla_hours',
    'tariff_formula_id',
    'tariff_formula_data',
    'expiry_start',
    'expiry_end',
    'customer_type_code',
    'disableTariff',
    'tariff_sub_service_code',
    'tariff_sub_service_description'
  ]);

  const DEFAULTS = Object.freeze({
    serviceId: 420,
    minimumWeight: 1300,
    incrementWeight: 1000,
    formulaId: 1288,
    disableTariff: 0,
    worksheetName: 'TariffCustomer'
  });

  let rowSequence = 0;

  function createRowId() {
    rowSequence += 1;
    return `route-${Date.now().toString(36)}-${rowSequence.toString(36)}`;
  }

  function createDefaultRow(overrides) {
    const source = overrides || {};
    return {
      id: source.id || createRowId(),
      origin: String(source.origin ?? ''),
      destination: String(source.destination ?? ''),
      serviceId: Number(source.serviceId ?? DEFAULTS.serviceId),
      minimumWeight: source.minimumWeight ?? DEFAULTS.minimumWeight,
      minimumTariff: source.minimumTariff ?? '',
      incrementWeight: source.incrementWeight ?? DEFAULTS.incrementWeight,
      incrementTariff: source.incrementTariff ?? '',
      description: String(source.description ?? ''),
      importedRouteRaw: String(source.importedRouteRaw ?? ''),
      importNeedsReview: Boolean(source.importNeedsReview),
      importReviewMessage: String(source.importReviewMessage ?? ''),
      selected: Boolean(source.selected),
      expanded: Boolean(source.expanded),
      sourceRowNumber: source.sourceRowNumber ?? null
    };
  }

  function getService(serviceId) {
    const numericId = Number(serviceId);
    return SERVICES.find((service) => service.id === numericId) || null;
  }

  function getServiceLabel(serviceId) {
    const service = getService(serviceId);
    return service ? `${service.name} · ${service.id}` : `Unknown · ${serviceId}`;
  }

  function getSla(serviceId) {
    return Number(serviceId) === 411
      ? { days: 2, hours: 48, label: '2 days · 48 hours' }
      : { days: 30, hours: 720, label: '30 days · 720 hours' };
  }

  function numericSalesforce(value) {
    const digits = String(value ?? '').replace(/[^0-9]/g, '');
    return digits ? Number(digits) : Number.NaN;
  }

  function normalizeDescription(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function normalizeCustomerId(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function safeTrim(value) {
    return String(value ?? '').trim();
  }

  function formatFileSize(bytes) {
    const numericBytes = Number(bytes) || 0;
    if (numericBytes < 1024) return `${numericBytes} B`;
    if (numericBytes < 1024 * 1024) return `${(numericBytes / 1024).toFixed(1)} KB`;
    return `${(numericBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  Object.assign(namespace, {
    SERVICES,
    OUTPUT_HEADERS,
    DEFAULTS,
    createDefaultRow,
    getService,
    getServiceLabel,
    getSla,
    numericSalesforce,
    normalizeDescription,
    normalizeCustomerId,
    safeTrim,
    formatFileSize
  });

  root.TariffBuilder = namespace;
  if (typeof module !== 'undefined' && module.exports) module.exports = namespace;
})(typeof window !== 'undefined' ? window : globalThis);
