# Negotiable Tariff Builder

Negotiable Tariff Builder is a lightweight, browser-based workspace for preparing validated negotiable tariff workbooks for PosIND MILE. It imports route and tariff data, provides an editable validation workspace, and exports a workbook that preserves the operational schema used by the existing application.

> This is an independently developed utility. It must not be presented as an official Pos Indonesia application unless written authorization exists.

## Privacy model

All workbook parsing, editing, validation, and generation happens locally in the browser. The application does not upload tariff data to a server, send it to an API, add analytics, persist tariff rows, place values in URLs, or log full tariff records to the console.

The only runtime dependency is the pinned SheetJS Community Edition browser build. Loading the library does not send the contents of the selected workbook to SheetJS.

## Supported source files

- `.xlsx`
- `.xls`
- `.csv`

Only the first worksheet is processed. The importer scans the worksheet until it finds a row containing all three required headers:

- `RUTE KANTOR`
- `TARIF`
- `Layanan`

Header detection ignores harmless capitalization differences, leading/trailing spaces, and duplicate whitespace. It does not guess unrelated column names.

## Route format and duplicate handling

The expected route format is:

```text
ORIGIN|DESTINATION
```

Example:

```text
29400|10110
```

Origin and destination values remain text so leading zeroes are retained. A route without `|` is placed in the origin field, the destination stays empty, and the row is marked for review.

Imported rows are deduplicated by the trimmed source `RUTE KANTOR` value. The import summary reports source rows, imported routes, skipped duplicates, skipped empty rows, and rows requiring review. Existing editor rows are not erased unless the new file parses successfully.

## Customer setup

Four global values are required:

- Customer ID
- Salesforce Number
- Effective Start Date
- Effective End Date

Customer ID is converted to uppercase only for export. The raw Salesforce value is retained for `tariff_sub_service_code` and the filename. Its numeric-only form is used for `kdlayanan_pelanggan` inside the tariff formula JSON.

## Services and SLA rules

| Service | ID | SLA day | SLA hours |
|---|---:|---:|---:|
| PKH | 420 | 30 | 720 |
| POS EXPRESS | 411 | 2 | 48 |
| PJE | 428 | 30 | 720 |
| PJB | 452 | 30 | 720 |
| KBM | 481 | 30 | 720 |
| Q9 | 408 | 30 | 720 |
| PJM | 453 | 30 | 720 |
| KRT | 470 | 30 | 720 |
| EC3 | 446 | 30 | 720 |

Default values for a new row:

- Service: PKH (`420`)
- Minimum weight: `1300` grams
- Increment weight: `1000` grams

An imported tariff fills both minimum tariff and increment tariff, matching the previous application.

## Tariff formula

`tariff_formula_id` is always `1288` and `disableTariff` is always `0`.

`tariff_formula_data` is exported as a JSON string with this exact structure:

```json
{
  "actual_weight_1": 1300,
  "base_tariff_1": 10000,
  "base_tariff_2": 10000,
  "kelipatan": 1000,
  "kdlayanan_pelanggan": 914372
}
```

Mappings:

- Minimum Weight → `actual_weight_1`
- Minimum Tariff → `base_tariff_1`
- Increment Tariff → `base_tariff_2`
- Increment Weight → `kelipatan`
- Numeric Salesforce value → `kdlayanan_pelanggan`

The exporter rejects missing numeric values, `NaN`, `Infinity`, `undefined`, and malformed formula data.

## Output workbook

Worksheet name:

```text
TariffCustomer
```

Filename pattern:

```text
Tarif_Negotiable_<Salesforce Number>.xlsx
```

Exact output headers and order:

1. `tariff_from_code`
2. `tariff_to_code`
3. `service_id`
4. `tariff_sla_day`
5. `tariff_sla_hours`
6. `tariff_formula_id`
7. `tariff_formula_data`
8. `expiry_start`
9. `expiry_end`
10. `customer_type_code`
11. `disableTariff`
12. `tariff_sub_service_code`
13. `tariff_sub_service_description`

Text cell types are used for origin, destination, formula JSON, dates, customer code, Salesforce/sub-service code, and description. Numeric cell types are used for service ID, SLA values, formula ID, and disable tariff.

Descriptions are trimmed and converted to uppercase only in the exported workbook and export preview.

### Spreadsheet formula-injection protection

Potentially dangerous user-entered text values are written as explicit Excel text cells (`t: "s"`), not formulas. The application does not silently prefix or rewrite legitimate operational values.

## Validation

Global validation covers required fields, Salesforce digits, and the effective date range. Row validation covers origin, destination, service, positive weights, non-negative tariffs, required descriptions, and duplicate origin–destination–service combinations.

Statuses are:

- Ready
- Needs Review
- Invalid
- Incomplete

Critical validation errors and duplicate route-service combinations disable export.

## Local use

Run a static server from the project root. Examples:

```bash
python -m http.server 8080
```

or:

```bash
npx serve .
```

Open `http://localhost:8080/`. Opening `index.html` directly with `file://` is not recommended because root-relative asset paths are designed for production hosting.

## Browser requirements

Use a current version of Chrome, Edge, Firefox, or Safari with JavaScript, FileReader, Blob downloads, native dialogs, and modern DOM APIs enabled. Large workbooks can be limited by available browser memory.

SheetJS is pinned to `0.20.3`:

```text
https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
```

A clear inline error is displayed if the dependency cannot load.

## Manual deployment to Cloudflare Pages

This project is a static site with no build command, server, secret, environment variable, or redirect requirement.

1. Upload the repository contents with `index.html` at the deployment root.
2. Use no build command.
3. Set the output directory to the project root when required by the deployment UI.
4. Attach the custom domain `tarif.posnew.com` manually.
5. Verify that `_headers`, icons, `robots.txt`, `sitemap.xml`, and `404.html` are served.

## Project structure

```text
/
├── index.html
├── 404.html
├── assets/
│   ├── css/
│   │   ├── app.css
│   │   └── 404.css
│   └── js/
│       ├── constants.js
│       ├── importer.js
│       ├── validation.js
│       ├── export.js
│       └── app.js
├── tests/
│   ├── fixtures/
│   ├── regression.cjs
│   └── ui-smoke.py
├── favicon.svg
├── favicon-32x32.png
├── apple-touch-icon.png
├── og-cover.png
├── site.webmanifest
├── robots.txt
├── sitemap.xml
├── _headers
├── README.md
├── CHANGELOG.md
└── QA-REPORT.md
```

## Troubleshooting

- **SheetJS could not be loaded:** confirm internet access to the pinned CDN and reload.
- **Required columns not found:** verify the first worksheet contains `RUTE KANTOR`, `TARIF`, and `Layanan` on the same header row.
- **No valid routes found:** remove empty route rows and ensure `RUTE KANTOR` contains values.
- **Encrypted workbook:** remove the password before importing.
- **Export disabled:** resolve all global and critical row validation issues.
- **Leading zeroes:** keep route codes as text in the source workbook whenever possible; the application preserves imported and edited values as text.
- **Large workbook failure:** close other memory-heavy tabs, split the source file, and retry.

## Maintenance warning

Do not change service IDs, SLA rules, formula ID, formula JSON keys, output headers/order, cell types, worksheet name, filename pattern, or row defaults without running regression tests and comparing output against the operational MILE import requirements.
