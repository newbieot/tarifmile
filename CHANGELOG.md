# Changelog

## 2026-07-28 — Complete redesign

### Added

- Fully English application interface, metadata, accessibility labels, messages, dialogs, footer, and documentation.
- Four-stage workflow indicator for customer setup, import, validation, and export.
- Two-column desktop workspace with a deliberate mobile card editor.
- Live global and row-level validation with Ready, Needs Review, Invalid, and Incomplete states.
- Import summary with source rows, imported routes, skipped duplicates, empty rows, and review counts.
- Search, status filter, service filter, clear filters, and invalid-row filter.
- Row selection, duplicate row, duplicate selected, delete selected, reset rows, and clear workspace actions.
- Calculated SLA display for every editable route.
- Real export preview using current workspace values.
- Export confirmation summary and repeat-download support.
- Accessible drop zone, skip link, focus states, live announcements, keyboard-friendly controls, and reduced-motion support.
- SEO metadata, canonical URL, Open Graph, Twitter Card, SoftwareApplication structured data, icons, manifest, robots file, sitemap, and custom 404 page.
- Cloudflare Pages security and cache headers.
- Regression test script for operational constants, parsing, validation, and export records.

### Changed

- Replaced the single large HTML implementation with maintainable HTML, CSS, and JavaScript modules.
- Replaced remote fonts and icon libraries with a system font stack and inline SVG icons.
- Pinned SheetJS Community Edition to version `0.20.3`.
- Migrated the footer to the slim Template MILE style: 38 px desktop, 36 px mobile, dark navy background, 2 px orange top border, PosNew Hub brand, center description, and creator badge.
- Improved header detection by normalizing capitalization and harmless whitespace while retaining the required operational names.
- Preserved existing editor rows until a replacement file has parsed successfully.
- Replaced routine browser alerts with inline messages, status regions, toasts, and meaningful confirmation dialogs.
- Replaced user-derived HTML-string rendering with safe DOM creation and text/value assignment.

### Preserved

- XLSX, XLS, and CSV import from the first worksheet.
- Drag-and-drop and file picker behavior.
- Required headers: `RUTE KANTOR`, `TARIF`, and `Layanan`.
- Route splitting, fallback behavior, route deduplication, and tariff-to-both-fields import behavior.
- All nine service IDs and their ordering.
- Default service `420`, minimum weight `1300`, and increment weight `1000`.
- SLA rules: service `411` uses `2` days / `48` hours; other services use `30` days / `720` hours.
- Formula ID `1288`, disable tariff `0`, and all formula JSON keys.
- Exact 13-column output schema and order.
- Explicit text/numeric workbook cell types.
- Worksheet name `TariffCustomer`.
- Filename pattern `Tarif_Negotiable_<Salesforce Number>.xlsx`.
- Uppercase Customer ID and description behavior at export.
- Raw and numeric-only Salesforce handling.

### Fixed

- Prevented an unsuccessful import from immediately deleting the current tariff editor data.
- Added clear handling for unsupported, empty, corrupt, encrypted, and structurally invalid files.
- Prevented export of missing numeric values, `NaN`, `Infinity`, `undefined`, or invalid tariff formula JSON.
- Added duplicate origin–destination–service validation instead of silently exporting conflicting editor rows.
- Kept postal and identifier fields as text in the output workbook.
- Removed the tall, vertically stacked mobile footer behavior.
