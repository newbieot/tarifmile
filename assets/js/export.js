(function (root) {
  'use strict';

  const namespace = root.TariffBuilder || {};

  const COLUMN_WIDTHS = Object.freeze([15, 15, 11, 14, 15, 17, 62, 14, 14, 22, 13, 25, 38]);

  function requireFinite(value, label) {
    if (value === '' || value === null || value === undefined) throw new Error(`${label} harus berupa angka yang valid.`);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`${label} harus berupa angka yang valid.`);
    return numeric;
  }

  function protectSpreadsheetText(value) {
    const text = String(value ?? '');
    if (!text) return text;
    // Explicit text cells are already safe in SheetJS. Prefixing an apostrophe would
    // alter operational values, so this helper intentionally preserves the value.
    return text;
  }

  function buildFormula(row, salesforceNumber) {
    const salesforceNumeric = namespace.numericSalesforce(salesforceNumber);
    if (!Number.isFinite(salesforceNumeric)) {
      throw new Error('Nomor Salesforce harus memuat minimal satu angka.');
    }

    const formula = {
      actual_weight_1: requireFinite(row.minimumWeight, 'Berat minimum'),
      base_tariff_1: requireFinite(row.minimumTariff, 'Tarif minimum'),
      base_tariff_2: requireFinite(row.incrementTariff, 'Tarif kelipatan'),
      kelipatan: requireFinite(row.incrementWeight, 'Berat kelipatan'),
      kdlayanan_pelanggan: salesforceNumeric
    };

    const json = JSON.stringify(formula);
    if (!json || /NaN|Infinity|undefined/.test(json)) {
      throw new Error('Formula tarif memuat nilai angka yang tidak valid.');
    }
    return { object: formula, json };
  }

  function buildExportRecord(globalValues, row) {
    const serviceId = requireFinite(row.serviceId, 'ID Layanan');
    const sla = namespace.getSla(row.slaDays);
    if (!Number.isInteger(sla.days) || sla.days <= 0) {
      throw new Error('SLA wajib diisi dalam jumlah hari bulat lebih dari 0.');
    }
    const formulaId = namespace.resolveFormulaId(row);
    if (!Number.isFinite(formulaId)) {
      throw new Error('Formula ID belum tersedia. Pilih Formula ID 1644 (PJE) atau layanan lain.');
    }
    const formula = buildFormula(row, globalValues.salesforceNumber);

    return {
      tariff_from_code: protectSpreadsheetText(String(row.origin ?? '').trim()),
      tariff_to_code: protectSpreadsheetText(String(row.destination ?? '').trim()),
      service_id: serviceId,
      tariff_sla_day: sla.days,
      tariff_sla_hours: sla.hours,
      tariff_formula_id: formulaId,
      tariff_formula_data: formula.json,
      expiry_start: protectSpreadsheetText(String(globalValues.startDate ?? '').trim()),
      expiry_end: protectSpreadsheetText(String(globalValues.endDate ?? '').trim()),
      customer_type_code: protectSpreadsheetText(namespace.normalizeCustomerId(globalValues.customerId)),
      disableTariff: namespace.DEFAULTS.disableTariff,
      tariff_sub_service_code: protectSpreadsheetText(String(globalValues.salesforceNumber ?? '').trim()),
      tariff_sub_service_description: protectSpreadsheetText(namespace.normalizeDescription(row.description))
    };
  }

  function buildExportRecords(globalValues, rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Minimal satu rute tarif wajib tersedia.');
    return rows.map((row) => buildExportRecord(globalValues, row));
  }

  function buildWorksheet(records) {
    if (!root.XLSX || !root.XLSX.utils) throw new Error('SheetJS tidak tersedia. Muat ulang halaman lalu coba lagi.');

    const worksheet = {};
    namespace.OUTPUT_HEADERS.forEach((header, columnIndex) => {
      worksheet[root.XLSX.utils.encode_cell({ r: 0, c: columnIndex })] = { v: header, t: 's' };
    });

    const numericColumns = new Set([2, 3, 4, 5, 10]);
    records.forEach((record, recordIndex) => {
      namespace.OUTPUT_HEADERS.forEach((header, columnIndex) => {
        const value = record[header];
        const isNumeric = numericColumns.has(columnIndex);
        if (isNumeric && !Number.isFinite(value)) throw new Error(`Nilai angka pada ${header} tidak valid.`);
        worksheet[root.XLSX.utils.encode_cell({ r: recordIndex + 1, c: columnIndex })] = {
          v: isNumeric ? Number(value) : String(value ?? ''),
          t: isNumeric ? 'n' : 's'
        };
      });
    });

    worksheet['!ref'] = root.XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: records.length, c: namespace.OUTPUT_HEADERS.length - 1 }
    });
    worksheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
    return worksheet;
  }

  function buildWorkbook(globalValues, rows) {
    if (!root.XLSX || !root.XLSX.utils) throw new Error('SheetJS tidak tersedia. Muat ulang halaman lalu coba lagi.');
    const records = buildExportRecords(globalValues, rows);
    const worksheet = buildWorksheet(records);
    const workbook = root.XLSX.utils.book_new();
    root.XLSX.utils.book_append_sheet(workbook, worksheet, namespace.DEFAULTS.worksheetName);
    return { workbook, worksheet, records };
  }

  function getOutputFilename(salesforceNumber) {
    return `Tarif_Negotiable_${String(salesforceNumber ?? '').trim()}.xlsx`;
  }

  function createWorkbookBlob(globalValues, rows) {
    const built = buildWorkbook(globalValues, rows);
    let arrayBuffer;
    try {
      arrayBuffer = root.XLSX.write(built.workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true,
        cellDates: false
      });
    } catch (cause) {
      const error = new Error('Workbook tidak dapat dibuat. Periksa kembali nilai tarif lalu coba lagi.');
      error.cause = cause;
      throw error;
    }

    return {
      blob: new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      filename: getOutputFilename(globalValues.salesforceNumber),
      records: built.records,
      workbook: built.workbook
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function generateAndDownload(globalValues, rows) {
    const result = createWorkbookBlob(globalValues, rows);
    downloadBlob(result.blob, result.filename);
    return result;
  }

  Object.assign(namespace, {
    COLUMN_WIDTHS,
    protectSpreadsheetText,
    buildFormula,
    buildExportRecord,
    buildExportRecords,
    buildWorksheet,
    buildWorkbook,
    getOutputFilename,
    createWorkbookBlob,
    downloadBlob,
    generateAndDownload
  });

  root.TariffBuilder = namespace;
  if (typeof module !== 'undefined' && module.exports) module.exports = namespace;
})(typeof window !== 'undefined' ? window : globalThis);
