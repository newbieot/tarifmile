'use strict';

const assert = require('node:assert/strict');
require('../assets/js/constants.js');
require('../assets/js/importer.js');
require('../assets/js/validation.js');
require('../assets/js/export.js');
const T = globalThis.TariffBuilder;
const ZONE_SOURCE_ROWS = [
  [],
  ['NO', 'KODEPOS\nASAL', 'KODEPOS ASAL ZONA', 'KODEPOS\nTUJUAN', 'KODEPOS TUJUAN ZONA',
    'TARIF (Rp)\nREGULER\nPER KG (TERBARU)', 'TARIF (Rp)\nNEXTDAY\nPER KG (TERBARU)',
    'ID PELANGGAN', 'Layanan', 'Kode Salesforce PE', 'Layanan', 'Kode Salesforce PKH'],
  [1, 29411, 29400, 10110, 10000, 32400, 55200, 'CUSTOMER', 'PE', 897924, 'PKH', 898845],
  [2, 29411, 29400, 10120, 10000, 32400, 55200, 'CUSTOMER', 'PE', 897924, 'PKH', 898845],
  [3, 29411, 29400, 14530, 14530, 44400, 0, 'CUSTOMER', 'PE', 897924, 'PKH', 898845]
];

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
  assert.equal(row.formulaIdOverride, 1644);
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

test('KEPRI REGULER import uses zone postcodes, PKH, and the regular tariff', () => {
  const parsed = T.parseSourceRows(ZONE_SOURCE_ROWS, { tariffType: 'reguler' });
  assert.equal(parsed.header.rowIndex, 1);
  assert.equal(parsed.header.format, 'zone');
  assert.equal(parsed.header.indexes.tariff, 5);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].origin, '29400');
  assert.equal(parsed.rows[0].destination, '10000');
  assert.equal(parsed.rows[0].minimumTariff, 32400);
  assert.equal(parsed.rows[0].incrementTariff, 32400);
  assert.equal(parsed.rows[0].serviceId, 420);
  assert.equal(parsed.rows[0].slaDays, 4);
  assert.equal(parsed.rows[0].description, 'PKH');
  assert.equal(parsed.rows[0].sourceRowNumber, 3);
  assert.equal(parsed.rows[0].importNeedsReview, false);
  assert.equal(parsed.summary.duplicatesSkipped, 1);
  assert.deepEqual(parsed.summary.duplicateRoutes, ['29400|10000']);
});

test('KEPRI NEXTDAY import uses PE and preserves zero tariffs', () => {
  const parsed = T.parseSourceRows(ZONE_SOURCE_ROWS, { tariffType: 'nextday' });
  assert.equal(parsed.header.indexes.tariff, 6);
  assert.equal(parsed.rows[0].minimumTariff, 55200);
  assert.equal(parsed.rows[0].incrementTariff, 55200);
  assert.equal(parsed.rows[0].serviceId, 411);
  assert.equal(parsed.rows[0].slaDays, 2);
  assert.equal(parsed.rows[0].description, 'PE');
  assert.equal(parsed.rows[1].minimumTariff, 0);
  assert.equal(parsed.rows[1].importNeedsReview, false);
});

test('zone columns take precedence over regular postcodes and RUTE KANTOR', () => {
  const parsed = T.parseSourceRows([
    ['RUTE KANTOR', 'KODEPOS ASAL', ' kodepos\n asal zona ', 'KODEPOS TUJUAN', ' kodepos tujuan   zona ', 'TARIF', 'Layanan'],
    ['99999|88888', 29411, ' 01234 ', 10110, ' 00110 ', 'Rp 12.500', 'CONTRACT'],
    ['', 29412, '01234', 10120, '00110', 12500, 'CONTRACT']
  ]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].origin, '01234');
  assert.equal(parsed.rows[0].destination, '00110');
  assert.equal(parsed.rows[0].minimumTariff, 12500);
  assert.equal(parsed.summary.duplicatesSkipped, 1);
});

test('incomplete zone routes remain visible for correction without falling back', () => {
  const parsed = T.parseSourceRows([
    ['RUTE KANTOR', 'KODEPOS ASAL ZONA', 'KODEPOS TUJUAN ZONA', 'TARIF', 'Layanan'],
    ['29411|10110', '29400', '', 10000, 'PKH'],
    ['29411|10120', '', '10000', 10000, 'PKH'],
    ['29411|10130', '', '', 10000, 'PKH']
  ]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].destination, '');
  assert.equal(parsed.rows[1].origin, '');
  assert.equal(parsed.summary.rowsRequiringReview, 2);
  assert.equal(parsed.summary.emptyRowsSkipped, 1);
  assert.match(parsed.rows[0].importReviewMessage, /tujuan zona kosong/);
});

test('conflicting zone tariffs require manual tariff values before export', () => {
  const parsed = T.parseSourceRows([
    ['KODEPOS ASAL ZONA', 'KODEPOS TUJUAN ZONA', 'TARIF', 'Layanan'],
    [29400, 10000, 10000, 'PKH'],
    [29400, 10000, 12000, 'PKH'],
    [29400, 10000, 13000, 'PKH'],
    [29400, 10000, 10000, 'PKH']
  ]);
  const row = parsed.rows[0];
  const globals = { customerId:'ABC', salesforceNumber:'914372', startDate:'2026-01-01', endDate:'2026-12-31' };
  row.slaDays = 3;
  assert.equal(parsed.summary.conflictingTariffRoutes, 1);
  assert.equal(parsed.summary.rowsRequiringReview, 1);
  assert.equal(parsed.summary.duplicatesSkipped, 3);
  assert.equal(parsed.summary.duplicateRoutes.length, 1);
  assert.equal(row.minimumTariff, '');
  assert.equal(row.incrementTariff, '');
  assert.match(row.importReviewMessage, /baris 2 \(10000\) dan 3 \(12000\)/);
  assert.equal(T.validateWorkspace(globals, [row]).exportable, false);
  row.minimumTariff = 12000;
  row.incrementTariff = 12000;
  assert.equal(T.validateWorkspace(globals, [row]).exportable, true);
});

test('zone tariff conflicts only concern the selected tariff column', () => {
  const changed = ZONE_SOURCE_ROWS.map((row) => row.slice());
  changed[3][6] = 60000;
  assert.equal(T.parseSourceRows(changed, { tariffType: 'reguler' }).summary.conflictingTariffRoutes, 0);
  assert.equal(T.parseSourceRows(changed, { tariffType: 'nextday' }).summary.conflictingTariffRoutes, 1);
});

test('a missing selected tariff column never silently uses the other tariff', () => {
  const source = [
    ['KODEPOS ASAL ZONA', 'KODEPOS TUJUAN ZONA', 'TARIF REGULER'],
    [29400, 10000, 10000]
  ];
  assert.equal(T.parseSourceRows(source).rows[0].minimumTariff, 10000);
  assert.throws(() => T.parseSourceRows(source, { tariffType: 'nextday' }), (error) => error.code === 'MISSING_HEADERS');
  assert.throws(() => T.parseSourceRows(source, { tariffType: 'other' }), (error) => error.code === 'INVALID_TARIFF_TYPE');
});

test('the selected zone tariff exports its mapped service and zone codes', () => {
  for (const [tariffType, serviceId, tariff, description] of [['reguler', 420, 32400, 'PKH'], ['nextday', 411, 55200, 'PE']]) {
    const row = T.parseSourceRows(ZONE_SOURCE_ROWS, { tariffType }).rows[0];
    row.slaDays = 2;
    const record = T.buildExportRecord({ customerId:'ABC', salesforceNumber:'914372', startDate:'2026-01-01', endDate:'2026-12-31' }, row);
    assert.equal(record.tariff_from_code, '29400');
    assert.equal(record.tariff_to_code, '10000');
    assert.equal(record.service_id, serviceId);
    assert.equal(record.tariff_sub_service_description, description);
    assert.equal(JSON.parse(record.tariff_formula_data).base_tariff_1, tariff);
    assert.equal(JSON.parse(record.tariff_formula_data).base_tariff_2, tariff);
  }
});

test('one upload imports both services with customer data, service Salesforce, and fixed dates', () => {
  const result = T.parseSourceRows(ZONE_SOURCE_ROWS);
  assert.equal(result.header.tariffType, 'both');
  assert.equal(result.rows.length, 4);
  assert.equal(result.summary.sourceRowsFound, 3);
  assert.equal(result.summary.duplicatesSkipped, 2);
  assert.deepEqual(result.summary.serviceCounts, { PKH: 2, PE: 2 });
  assert.deepEqual(result.customerData, {
    customerId: 'CUSTOMER', startDate: '2026-10-16', endDate: '2029-09-30',
    salesforceByService: { 420: '898845', 411: '897924' }
  });
  assert.deepEqual(result.rows.map((row) => [row.serviceId, row.slaDays]), [[420,4],[411,2],[420,4],[411,2]]);
  assert.equal(T.validateRows(result.rows).counts.duplicates, 0);
  assert.equal(T.validateWorkspace(result.customerData, result.rows).exportable, true);
  assert.equal(T.getWorkspaceFilename(result.customerData, result.rows), 'Tarif_Negotiable_898845_897924.xlsx');
});

test('mixed service exports preserve their own Salesforce, tariff, SLA, and dates', () => {
  const result = T.parseSourceRows(ZONE_SOURCE_ROWS);
  const records = T.buildExportRecords(result.customerData, result.rows);
  for (const record of records) {
    const isPkh = record.service_id === 420;
    assert.equal(record.tariff_sub_service_code, isPkh ? '898845' : '897924');
    assert.equal(JSON.parse(record.tariff_formula_data).kdlayanan_pelanggan, isPkh ? 898845 : 897924);
    assert.equal(record.tariff_sla_day, isPkh ? 4 : 2);
    assert.equal(record.tariff_sla_hours, isPkh ? 96 : 48);
    assert.equal(record.customer_type_code, 'CUSTOMER');
    assert.equal(record.expiry_start, '2026-10-16');
    assert.equal(record.expiry_end, '2029-09-30');
  }
  assert.equal(JSON.parse(records[0].tariff_formula_data).base_tariff_1, 32400);
  assert.equal(JSON.parse(records[1].tariff_formula_data).base_tariff_1, 55200);
  assert.equal(JSON.parse(records[3].tariff_formula_data).base_tariff_1, 0);
});

test('Salesforce validation checks each active service and never substitutes PKH for a missing PE code', () => {
  const result = T.parseSourceRows(ZONE_SOURCE_ROWS);
  result.customerData.salesforceByService[411] = '';
  const validation = T.validateWorkspace(result.customerData, result.rows);
  assert.equal(validation.exportable, false);
  assert.match(validation.globals.errors.salesforcePe, /wajib/);
  assert.throws(() => T.buildExportRecords(result.customerData, result.rows), /Salesforce/);
  result.customerData.salesforceByService[411] = 'invalid';
  assert.match(T.validateWorkspace(result.customerData, result.rows).globals.errors.salesforcePe, /angka/);
  result.customerData.salesforceByService[411] = '000123';
  assert.equal(T.validateWorkspace(result.customerData, result.rows).exportable, true);
  assert.equal(T.buildExportRecords(result.customerData, result.rows)[1].tariff_sub_service_code, '000123');
  assert.equal(T.getSalesforceSummary(result.customerData, result.rows), 'PKH: 898845 · PE: 000123');
});

test('single-service import requires only that service Salesforce', () => {
  const result = T.parseSourceRows(ZONE_SOURCE_ROWS, { tariffType: 'nextday' });
  result.customerData.salesforceByService[420] = '';
  assert.equal(T.validateWorkspace(result.customerData, result.rows).exportable, true);
  assert.equal(T.getWorkspaceFilename(result.customerData, result.rows), 'Tarif_Negotiable_897924.xlsx');
});

test('conflicting customer or service Salesforce values are rejected even on duplicate routes', () => {
  for (const column of [7, 9, 11]) {
    const source = ZONE_SOURCE_ROWS.map((row) => row.slice());
    source[3][column] = 'DIFFERENT123';
    assert.throws(() => T.parseSourceRows(source), (error) => error.code === 'INCONSISTENT_CUSTOMER_DATA');
  }
});

test('a tariff conflict only clears the affected service when both are imported', () => {
  const source = ZONE_SOURCE_ROWS.map((row) => row.slice());
  source[3][6] = 60000;
  const result = T.parseSourceRows(source);
  assert.equal(result.summary.conflictingTariffRoutes, 1);
  assert.equal(result.rows[0].minimumTariff, 32400);
  assert.equal(result.rows[1].minimumTariff, '');
  assert.equal(T.validateWorkspace(result.customerData, result.rows).exportable, false);
});

test('standard imports can read generic customer columns and receive import dates', () => {
  const result = T.parseSourceRows([
    ['RUTE KANTOR', 'TARIF', 'Layanan', 'ID PELANGGAN', 'Nomor Salesforce'],
    ['01234|00110', 10000, 'PKH', 'customer', '00123']
  ]);
  assert.deepEqual(result.customerData, { customerId: 'customer', salesforceNumber: '00123', startDate: '2026-10-16', endDate: '2029-09-30' });
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
    origin:'01234', destination:'00110', serviceId:411, formulaIdOverride:'', slaDays:2, minimumWeight:1000,
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
  assert.equal(T.APP_VERSION, '2.0.1');
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
