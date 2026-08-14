'use strict';

const assert = require('node:assert/strict');
require('../assets/js/constants.js');
require('../assets/js/importer.js');
require('../assets/js/validation.js');
require('../assets/js/export.js');
const T = globalThis.TariffBuilder;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('service IDs and reference formula mappings remain exact', () => {
  assert.deepEqual(T.SERVICES.map((s) => [s.name, s.id, s.formulaId]), [
    ['PKH', 420, 1288], ['PE', 411, 1288], ['PJE', 428, 1644],
    ['PJB', 452, 1669], ['KBM', 481, null], ['Q9', 408, 1288],
    ['PJM', 453, 1672], ['KRT', 470, 1701], ['EC3', 446, 1288],
    ['PPB_SEKOGRAM', 483, 1711], ['PPB_KARTUPOS', 485, 1711],
    ['PPB_PKT', 477, 1711], ['PPB_SRT', 476, 1711], ['DG', 466, 1678],
    ['VG', 465, 1677], ['3PE', 464, 1648], ['Q23', 463, 1648],
    ['Q13', 462, 1648], ['3LX', 461, 1648], ['3LP', 460, 1648],
    ['332', 459, 1648], ['331', 458, 1648], ['312', 457, 1648],
    ['311', 456, 1648], ['010', 455, 1648]
  ]);
});

test('default row constants remain exact', () => {
  const row = T.createDefaultRow();
  assert.equal(row.serviceId, 420);
  assert.equal(row.minimumWeight, 1000);
  assert.equal(row.incrementWeight, 1000);
  assert.equal(row.slaDays, '');
  assert.equal(row.formulaIdOverride, '');
});

test('output headers and order remain exact', () => {
  assert.deepEqual(T.OUTPUT_HEADERS, [
    'tariff_from_code', 'tariff_to_code', 'service_id', 'tariff_sla_day',
    'tariff_sla_hours', 'tariff_formula_id', 'tariff_formula_data', 'expiry_start',
    'expiry_end', 'customer_type_code', 'disableTariff', 'tariff_sub_service_code',
    'tariff_sub_service_description'
  ]);
});

test('SLA is user supplied and hours are calculated from days', () => {
  assert.deepEqual(T.getSla(2), { days: 2, hours: 48, label: '2 hari · 48 jam' });
  assert.deepEqual(T.getSla('30'), { days: 30, hours: 720, label: '30 hari · 720 jam' });
  assert.equal(Number.isNaN(T.getSla('').days), true);
});

test('formula ID is automatic per service with an optional PJE override', () => {
  T.SERVICES.filter((service) => Number.isFinite(service.formulaId)).forEach((service) => {
    assert.equal(T.resolveFormulaId({ serviceId: service.id, formulaIdOverride: '' }), service.formulaId);
  });
  assert.equal(T.resolveFormulaId({ serviceId: 420, formulaIdOverride: '' }), 1288);
  assert.equal(T.resolveFormulaId({ serviceId: 452, formulaIdOverride: '' }), 1669);
  assert.equal(T.resolveFormulaId({ serviceId: 470, formulaIdOverride: '' }), 1701);
  assert.equal(T.resolveFormulaId({ serviceId: 481, formulaIdOverride: 1644 }), 1644);
  assert.equal(Number.isNaN(T.resolveFormulaId({ serviceId: 481, formulaIdOverride: '' })), true);
});

test('header detection finds a delayed normalized header', () => {
  const result = T.findHeaderRow([
    ['Negotiable tariff report'],
    [],
    ['\uFEFFrute   kantor ', ' tarif ', ' LAYANAN ']
  ]);
  assert.equal(result.found, true);
  assert.equal(result.rowIndex, 2);
  assert.deepEqual(result.indexes, { route: 0, tariff: 1, serviceDescription: 2 });
});

test('missing headers are rejected', () => {
  assert.throws(() => T.parseSourceRows([['RUTE KANTOR', 'TARIF']]), /Kolom wajib RUTE KANTOR/);
});

test('route split trims values and preserves leading zeroes', () => {
  assert.deepEqual(T.parseRoute(' 01234 | 00110 '), {
    origin: '01234', destination: '00110', needsReview: false, message: '', raw: '01234 | 00110'
  });
});

test('route without a pipe retains origin and requires review', () => {
  const route = T.parseRoute('29400');
  assert.equal(route.origin, '29400');
  assert.equal(route.destination, '');
  assert.equal(route.needsReview, true);
});

test('tariff parser handles common source formats', () => {
  assert.equal(T.parseTariffValue(12500), 12500);
  assert.equal(T.parseTariffValue('Rp 12.500'), 12500);
  assert.equal(T.parseTariffValue('12,500'), 12500);
  assert.equal(T.parseTariffValue('12.500,50'), 12500.5);
  assert.equal(T.parseTariffValue('invalid'), '');
});

test('source import deduplicates routes and fills both tariff fields', () => {
  const parsed = T.parseSourceRows([
    ['Title'],
    ['RUTE KANTOR', 'TARIF', 'Layanan'],
    ['01234|00110', 10000, 'PKH CONTRACT'],
    ['01234|00110', 20000, 'DUPLICATE'],
    ['', '', ''],
    ['29400', 15000, 'MANUAL REVIEW']
  ]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.summary.routesImported, 2);
  assert.equal(parsed.summary.duplicatesSkipped, 1);
  assert.equal(parsed.rows[0].minimumTariff, 10000);
  assert.equal(parsed.rows[0].incrementTariff, 10000);
  assert.equal(parsed.rows[0].origin, '01234');
  assert.equal(parsed.rows[0].destination, '00110');
  assert.equal(parsed.rows[0].minimumWeight, 1000);
  assert.equal(parsed.rows[0].slaDays, '');
  assert.equal(parsed.rows[1].importNeedsReview, true);
});

test('global validation checks required values, digits, and date order', () => {
  assert.equal(T.validateGlobalFields({}).valid, false);
  assert.match(T.validateGlobalFields({ customerId:'A', salesforceNumber:'ABC', startDate:'2026-01-02', endDate:'2026-01-01' }).errors.salesforceNumber, /minimal satu angka/);
  assert.match(T.validateGlobalFields({ customerId:'A', salesforceNumber:'1', startDate:'2026-01-02', endDate:'2026-01-01' }).errors.endDate, /lebih awal/);
  assert.equal(T.validateGlobalFields({ customerId:'A', salesforceNumber:'SF-914372', startDate:'2026-01-01', endDate:'2026-12-31' }).valid, true);
});

test('row validation detects missing and duplicate routes', () => {
  const one = T.createDefaultRow({ origin:'29400', destination:'10110', slaDays:3, minimumTariff:10000, incrementTariff:10000, description:'A' });
  const two = T.createDefaultRow({ origin:'29400', destination:'10110', slaDays:3, minimumTariff:10000, incrementTariff:10000, description:'B' });
  const validation = T.validateRows([one, two]);
  assert.equal(validation.counts.duplicates, 2);
  assert.equal(validation.counts.critical, 2);
  assert.equal(validation.results[0].status, 'needs-review');
});

test('formula JSON keys and values remain exact', () => {
  const result = T.buildFormula({ minimumWeight:1000, minimumTariff:10000, incrementTariff:9000, incrementWeight:1000 }, 'SF-914372');
  assert.deepEqual(result.object, {
    actual_weight_1:1000,
    base_tariff_1:10000,
    base_tariff_2:9000,
    kelipatan:1000,
    kdlayanan_pelanggan:914372
  });
  assert.deepEqual(Object.keys(JSON.parse(result.json)), ['actual_weight_1','base_tariff_1','base_tariff_2','kelipatan','kdlayanan_pelanggan']);
});

test('invalid formula numbers are rejected', () => {
  assert.throws(() => T.buildFormula({ minimumWeight:'', minimumTariff:1, incrementTariff:1, incrementWeight:1 }, '1'), /Berat minimum/);
  assert.throws(() => T.buildFormula({ minimumWeight:1, minimumTariff:1, incrementTariff:1, incrementWeight:1 }, 'ABC'), /minimal satu angka/);
});

test('export record preserves raw Salesforce and uppercase export behavior', () => {
  const row = T.createDefaultRow({
    origin:'01234', destination:'00110', serviceId:411, slaDays:2, minimumWeight:1000,
    minimumTariff:10000, incrementWeight:1000, incrementTariff:10000,
    description:'  express tariff  '
  });
  const record = T.buildExportRecord({ customerId:'abc01', salesforceNumber:'SF-914372-A', startDate:'2026-01-01', endDate:'2026-12-31' }, row);
  assert.equal(record.tariff_from_code, '01234');
  assert.equal(record.tariff_to_code, '00110');
  assert.equal(record.service_id, 411);
  assert.equal(record.tariff_sla_day, 2);
  assert.equal(record.tariff_sla_hours, 48);
  assert.equal(record.tariff_formula_id, 1288);
  assert.equal(record.disableTariff, 0);
  assert.equal(record.customer_type_code, 'ABC01');
  assert.equal(record.tariff_sub_service_code, 'SF-914372-A');
  assert.equal(record.tariff_sub_service_description, 'EXPRESS TARIFF');
  assert.equal(JSON.parse(record.tariff_formula_data).kdlayanan_pelanggan, 914372);
});

test('filename and worksheet constants remain exact', () => {
  assert.equal(T.APP_VERSION, '2.0.0');
  assert.equal(T.DEFAULTS.worksheetName, 'TariffCustomer');
  assert.equal(T.getOutputFilename('914372'), 'Tarif_Negotiable_914372.xlsx');
});

test('workspace is exportable only after critical issues are resolved', () => {
  const row = T.createDefaultRow({ origin:'29400', destination:'10110', slaDays:5, minimumTariff:10000, incrementTariff:10000, description:'PKH' });
  const valid = T.validateWorkspace({ customerId:'ABC', salesforceNumber:'914372', startDate:'2026-01-01', endDate:'2026-12-31' }, [row]);
  assert.equal(valid.exportable, true);
  row.destination = '';
  const invalid = T.validateWorkspace({ customerId:'ABC', salesforceNumber:'914372', startDate:'2026-01-01', endDate:'2026-12-31' }, [row]);
  assert.equal(invalid.exportable, false);
});

console.log(`\n${passed} regression tests passed.`);
