# Quality Assurance Report

Date: 2026-07-28

## Source audit

The existing `newbieot/tarifmile` implementation was reviewed as a read-only source. Its operational behavior was mapped before redesigning the local copy, including file selection, drag-and-drop, first-worksheet parsing, header discovery, route deduplication and splitting, service choices, tariff defaults, global fields, SLA rules, formula construction, cell types, output headers, worksheet name, filename, and footer behavior.

The footer HTML and CSS from `newbieot/templatemile` were reviewed separately and reproduced with the required slim desktop/mobile dimensions and responsive behavior.

No GitHub write, branch, commit, pull request, merge, or deployment action was performed.

## Automated test results

### Node regression suite

Command:

```bash
node tests/regression.cjs
```

Result: **17/17 passed**

Coverage includes:

- exact service IDs and order;
- default row constants;
- exact 13 output headers and order;
- SLA rules;
- delayed and normalized header detection, including a UTF-8 BOM;
- missing-header rejection;
- route splitting, trimming, fallback, and leading zeroes;
- tariff parsing;
- source deduplication and import behavior;
- global and row validation;
- duplicate route-service detection;
- formula JSON keys and values;
- invalid numeric rejection;
- raw/numeric Salesforce handling;
- uppercase export normalization;
- worksheet name and filename pattern;
- workspace export gating.

### Browser UI smoke suite

Command:

```bash
python tests/ui-smoke.py
```

Requirements: Python Playwright and a Chromium-family browser.

Result: **40/40 passed**

Coverage includes:

- English document and title;
- initial state and disabled export;
- desktop page overflow and 38 px footer;
- keyboard-visible skip link and live status region;
- customer setup;
- XLSX workflow;
- duplicate reporting;
- service `411` SLA update;
- file removal without erasing reviewed rows;
- add, duplicate, filter, confirm, delete, and fix row workflows;
- export dialog, filename, worksheet name, headers, constants, and cell-type object construction;
- repeat-download action;
- mobile page overflow, mobile cards, and 36 px footer;
- unsupported, empty, and corrupt file messages;
- accepted XLS and CSV paths;
- actual drag-and-drop event handling;
- reduced-motion media mode;
- absence of browser page errors.

The browser test uses a deterministic SheetJS API shim because outbound network and DNS access are blocked in the test environment. The production page remains pinned to the official SheetJS `0.20.3` standalone browser build.

## Static checks

Passed:

- all project JavaScript files pass `node -c` syntax checks;
- Python smoke test compiles;
- no duplicate HTML IDs;
- no missing local assets referenced by HTML;
- `<html lang="en">` present;
- no inline style attributes in the main application;
- no `alert()` usage;
- no user-data `innerHTML` rendering;
- no heavy frontend framework;
- no external font or icon library;
- root-relative paths resolve through a local static server;
- expected empty-file fixture is the only zero-byte test file;
- Content Security Policy includes the pinned SheetJS origin and a SHA-256 allowance for the static JSON-LD block;
- Cloudflare cache and security headers are included.

## Compatibility verification status

- Static local serving: passed.
- XLS fixture creation/readability with LibreOffice: passed during fixture preparation.
- Production workbook schema, data mapping, worksheet object, explicit text/numeric cell types, formula JSON, filename, and sheet name: passed automated tests.
- Direct serialization with the official SheetJS binary and manual opening of an application-generated output in Microsoft Excel were **not executable in this isolated environment**, because the pinned browser dependency could not be downloaded and Microsoft Excel is unavailable. These items should receive a final acceptance check after deployment or in a workstation with network access and Excel.

## Regression constants

Do not change without operational testing:

- service IDs;
- service `411` SLA `2` / `48`;
- other-service SLA `30` / `720`;
- formula ID `1288`;
- disable tariff `0`;
- formula JSON keys;
- 13 output headers and order;
- text/numeric cell typing;
- worksheet `TariffCustomer`;
- filename `Tarif_Negotiable_<Salesforce Number>.xlsx`;
- default service `420`;
- default weights `1300` and `1000`.
