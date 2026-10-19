'use strict';

// Run with the same pinned SheetJS browser build used by index.html:
// node tests/workbook-roundtrip.cjs <path-to-xlsx.full.min.js>
const assert = require('node:assert/strict');
const path = require('node:path');
if (!process.argv[2]) throw new Error('Pass the path to the pinned SheetJS build.');
globalThis.XLSX = require(path.resolve(process.argv[2]));
require('../assets/js/constants.js');
require('../assets/js/importer.js');
require('../assets/js/validation.js');
require('../assets/js/export.js');
const T = globalThis.TariffBuilder;

async function main() {
  const imported = T.parseSourceRows([
    ['RUTE KANTOR', 'TARIF', 'Layanan'],
    ['01234|00110', 10000, 'CBA'],
    ['01234|00111', 15000, 'CBA']
  ], { tariffType: 'krt' });
  imported.rows.forEach((row) => { row.slaDays = 14; });
  const globals = { customerId: 'KRT-TEST', salesforceNumber: 'SF-123', internalOrder: '00100021859', startDate: '2026-10-19', endDate: '2029-09-30' };
  const standard = T.createDefaultRow({ origin: '29400', destination: '10110', slaDays: 4, minimumTariff: 12000, incrementTariff: 11000, description: 'PKH' });
  assert.equal(T.validateWorkspace(globals, [...imported.rows, standard]).exportable, true);
  const outputs = T.createWorkbookBlobs(globals, [...imported.rows, standard]);
  for (const output of outputs) {
    const reopened = XLSX.read(await output.blob.arrayBuffer(), { type: 'array' });
    const krt = output.filename === 'Tarif_KRT_916479.xlsx';
    const sheetName = krt ? 'TariffCbaCustomer' : 'TariffCustomer';
    assert.deepEqual(reopened.SheetNames, [sheetName]);
    const sheet = reopened.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet);
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    assert.deepEqual(headers, krt ? T.KRT_OUTPUT_HEADERS : T.OUTPUT_HEADERS);
    assert.equal(records.length, krt ? 2 : 1);
    assert.equal(sheet.A2.t, 's');
    assert.equal(sheet.C2.t, 'n');
    if (krt) {
      assert.equal(sheet.A2.v, '01234');
      assert.equal(sheet.B2.v, '00110');
      assert.equal(sheet.N2.t, 's');
      assert.equal(sheet.N2.v, '00100021859');
      assert.equal(sheet.N3.v, '00100021859');
      assert.equal(sheet.F2.v, 1644);
      assert.equal(sheet.L2.v, '916479');
      assert.deepEqual(JSON.parse(sheet.G2.v), { base_tariff: '10000', kdlayanan_pelanggan: 915903 });
      assert.deepEqual(JSON.parse(sheet.G3.v), { base_tariff: '15000', kdlayanan_pelanggan: 915903 });
    } else {
      assert.equal(sheet.N1, undefined);
      assert.equal(JSON.parse(sheet.G2.v).base_tariff_2, 11000);
      assert.equal(JSON.parse(sheet.G2.v).kdlayanan_pelanggan, 123);
    }
    console.log(`Roundtrip passed: ${output.filename}, ${records.length} rows, ${headers.length} columns.`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
