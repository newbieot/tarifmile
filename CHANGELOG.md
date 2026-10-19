# Changelog

## 2026-10-19

- KRT memakai Service ID `470`, kode layanan pelanggan `915903`, subservice `916479`, dan Formula ID `1644`.
- UI KRT hanya meminta Base Tariff dan menyembunyikan berat, tarif minimum, serta tarif kelipatan. JSON menggunakan `base_tariff` sesuai template CBA.
- No IO wajib untuk KRT, berlaku pada semua rute KRT, dan diekspor sebagai teks di kolom `internal_order`.
- Pilihan impor KRT memetakan kolom tarif menjadi Base Tariff. File baru mengosongkan IO dari unggahan sebelumnya.
- Ekspor KRT memakai workbook terpisah `Tarif_KRT_916479.xlsx`, sheet `TariffCbaCustomer`, dengan 14 kolom. Layanan lain tetap memakai format 13 kolom.
- Pratinjau, konfirmasi, unduhan campuran, dan unduh kembali mengikuti kedua jenis workbook. Cache key aset `20261019-207`.

## 2026-10-16

- Perbaikan ekspor: tarif duplikat tidak lagi dikosongkan. Tarif tertinggi dari Excel dipakai per rute dan layanan; variasi harga tetap diberi peringatan beserta nomor baris sumber, tanpa mengunci ekspor.
- Konfirmasi ekspor menampilkan jumlah rute dengan peringatan. Filter direset setelah impor berhasil. Cache key aset terbaru `20261016-206`.
- Rute PE hanya diimpor jika tarif NEXTDAY positif. Nilai kosong atau 0 pada duplikat tidak lagi mengosongkan tarif PE yang terisi. Cache key aset terbaru `20261016-205`.
- Satu unggahan otomatis memuat PKH dan PE sekaligus, dengan Salesforce masing-masing pada setiap baris ekspor.
- ID Pelanggan dan kode Salesforce PKH/PE otomatis dibaca dari Excel. Data pelanggan yang tidak konsisten ditolak.
- Tanggal hasil impor otomatis 16 Oktober 2026 sampai 30 September 2029.
- SLA impor PKH otomatis 4 hari (96 jam), PE 2 hari (48 jam).
- Nama file keluaran mendukung kedua Salesforce. Cache key aset terbaru `20261016-204`.
- Impor format kodepos zona, termasuk header multibaris pada workbook tarif MA Provinsi KEPRI.
- Kodepos asal dan tujuan memakai `KODEPOS ASAL ZONA` dan `KODEPOS TUJUAN ZONA`.
- Pilihan tarif sebelum impor: REGULER untuk PKH (`420`), NEXTDAY untuk PE (`411`).
- Duplikat zona dengan tarif berbeda ditandai dan memerlukan pengisian ulang tarif sebelum ekspor.
- Pembacaan workbook memakai penyimpanan sel padat dan daftar duplikat hanya menampilkan pasangan rute unik untuk file besar.
- Cache key aset berubah menjadi `20261016-203`.

## 2026-10-06 — Versi 2.0.1

### Diubah

- Formula ID default untuk rute baru dan hasil impor menjadi `1644 (PJE)`; pilihan otomatis per layanan tetap tersedia.
- Cache key aset berubah menjadi `20261006-202`.

## 2026-08-14 — Versi 2.0.0

### Ditambahkan

- Pilihan Formula ID otomatis per layanan berdasarkan tabel referensi operasional.
- Opsi override Formula ID `1644 (PJE)` pada setiap rute.
- Input SLA wajib per rute; SLA jam dihitung otomatis dari `hari × 24`.
- Layanan tambahan dan Formula ID: PPB, DG, VG, 3PE, Q23, Q13, 3LX, 3LP, 332, 331, 312, 311, dan 010.
- Template unduhan `Contoh_Import_Tarif_Route_v2.0.0.xlsx` dengan format dan data contoh yang dapat langsung diimpor.
- Nomor versi aplikasi yang terlihat pada footer.
- Middleware Cloudflare Pages untuk redirect host `tarifmile.pages.dev` ke `tarif.posnew.com` tanpa me-redirect domain utama.

### Diubah

- Seluruh UI, pesan validasi, dialog, metadata, manifest, dan halaman 404 menjadi bahasa Indonesia.
- Berat Minimum default berubah dari `1300` menjadi `1000` gram.
- Formula ID tidak lagi di-hard-code `1288`; nilai otomatis mengikuti layanan.
- SLA tidak lagi dikunci `30` hari atau mengikuti layanan.
- Cache key aset berubah menjadi `20260814-200`; HTML memakai `no-store` agar versi baru segera dimuat.

### Dipertahankan

- Skema keluaran 13 kolom, nama worksheet `TariffCustomer`, pola nama file, Formula JSON, `disableTariff = 0`, dan tipe sel teks/angka.
- Impor XLSX, XLS, CSV, drag-and-drop, deteksi header, pemisahan rute, dan deduplikasi.

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
