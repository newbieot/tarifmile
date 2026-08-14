(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};

  const APP_VERSION = '2.0.0';
  const PJE_FORMULA_ID = 1644;

  // Formula ID mengikuti tabel referensi operasional yang diberikan pada
  // 14 Agustus 2026. Nilai null berarti tabel referensi tidak menyediakan
  // Formula ID otomatis untuk layanan tersebut.
  const SERVICES = Object.freeze([
    Object.freeze({ id: 420, name: 'PKH', formulaId: 1288 }),
    Object.freeze({ id: 411, name: 'PE', formulaId: 1288 }),
    Object.freeze({ id: 428, name: 'PJE', formulaId: PJE_FORMULA_ID }),
    Object.freeze({ id: 452, name: 'PJB', formulaId: 1669 }),
    Object.freeze({ id: 481, name: 'KBM', formulaId: null }),
    Object.freeze({ id: 408, name: 'Q9', formulaId: 1288 }),
    Object.freeze({ id: 453, name: 'PJM', formulaId: 1672 }),
    Object.freeze({ id: 470, name: 'KRT', formulaId: 1701 }),
    Object.freeze({ id: 446, name: 'EC3', formulaId: 1288 }),
    Object.freeze({ id: 483, name: 'PPB_SEKOGRAM', formulaId: 1711 }),
    Object.freeze({ id: 485, name: 'PPB_KARTUPOS', formulaId: 1711 }),
    Object.freeze({ id: 477, name: 'PPB_PKT', formulaId: 1711 }),
    Object.freeze({ id: 476, name: 'PPB_SRT', formulaId: 1711 }),
    Object.freeze({ id: 466, name: 'DG', formulaId: 1678 }),
    Object.freeze({ id: 465, name: 'VG', formulaId: 1677 }),
    Object.freeze({ id: 464, name: '3PE', formulaId: 1648 }),
    Object.freeze({ id: 463, name: 'Q23', formulaId: 1648 }),
    Object.freeze({ id: 462, name: 'Q13', formulaId: 1648 }),
    Object.freeze({ id: 461, name: '3LX', formulaId: 1648 }),
    Object.freeze({ id: 460, name: '3LP', formulaId: 1648 }),
    Object.freeze({ id: 459, name: '332', formulaId: 1648 }),
    Object.freeze({ id: 458, name: '331', formulaId: 1648 }),
    Object.freeze({ id: 457, name: '312', formulaId: 1648 }),
    Object.freeze({ id: 456, name: '311', formulaId: 1648 }),
    Object.freeze({ id: 455, name: '010', formulaId: 1648 })
  ]);

  const FORMULA_OVERRIDE_OPTIONS = Object.freeze([
    Object.freeze({ id: PJE_FORMULA_ID, name: 'PJE' })
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
    minimumWeight: 1000,
    incrementWeight: 1000,
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
      formulaIdOverride: source.formulaIdOverride ?? '',
      slaDays: source.slaDays ?? '',
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
    return service ? `${service.name} · ${service.id}` : `Tidak dikenal · ${serviceId}`;
  }

  function getServiceFormulaId(serviceId) {
    const service = getService(serviceId);
    return service && Number.isFinite(service.formulaId) ? service.formulaId : null;
  }

  function resolveFormulaId(row) {
    const override = String(row && row.formulaIdOverride != null ? row.formulaIdOverride : '').trim();
    if (override) {
      const numeric = Number(override);
      return FORMULA_OVERRIDE_OPTIONS.some((option) => option.id === numeric) ? numeric : Number.NaN;
    }
    const mapped = getServiceFormulaId(row && row.serviceId);
    return Number.isFinite(mapped) ? mapped : Number.NaN;
  }

  function getSla(slaDays) {
    if (slaDays === '' || slaDays === null || slaDays === undefined) {
      return { days: Number.NaN, hours: Number.NaN, label: 'Wajib diisi' };
    }
    const days = Number(slaDays);
    const hours = days * 24;
    return {
      days,
      hours,
      label: Number.isFinite(days) ? `${days} hari · ${hours} jam` : 'Wajib diisi'
    };
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
    APP_VERSION,
    PJE_FORMULA_ID,
    SERVICES,
    FORMULA_OVERRIDE_OPTIONS,
    OUTPUT_HEADERS,
    DEFAULTS,
    createDefaultRow,
    getService,
    getServiceLabel,
    getServiceFormulaId,
    resolveFormulaId,
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
