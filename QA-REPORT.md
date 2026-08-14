# Laporan Quality Assurance

Tanggal: 2026-08-14  
Versi: 2.0.0

## Hasil audit implementasi

- UI utama, metadata, manifest, halaman 404, dialog, pesan validasi, dan aksesibilitas telah diubah ke bahasa Indonesia.
- Berat Minimum default telah diubah menjadi `1000` gram.
- SLA tidak lagi berasal dari aturan tetap layanan. SLA hari wajib diisi pada setiap rute dan SLA jam dihitung `hari × 24`.
- Formula ID tidak lagi di-hard-code. Nilai otomatis mengikuti mapping layanan dan dapat di-override ke `1644 (PJE)`.
- Formula ID pada tabel referensi telah dimasukkan untuk semua baris yang memiliki Service ID. `PPB_MBAG` tidak ditambahkan karena referensi tidak memuat Service ID. Formula otomatis KBM ditandai tidak tersedia karena referensi memuat tanda `-`.
- Template Excel contoh telah ditambahkan dan ditautkan dari panel impor.
- Versi `2.0.0` terlihat di footer.
- Middleware host-specific mengalihkan `tarifmile.pages.dev` ke `tarif.posnew.com` tanpa loop pada domain utama.
- HTML menggunakan `no-store`, sedangkan URL aset memakai cache key `20260814-200`.

## Pengujian otomatis

### Regression suite

Perintah:

```bash
node tests/regression.cjs
```

Hasil: **18/18 lulus**.

Cakupan:

- seluruh Service ID dan Formula ID referensi;
- default berat `1000` gram;
- SLA wajib dan konversi jam;
- override Formula ID `1644`;
- deteksi header dan parsing rute/tarif;
- deduplikasi;
- validasi global dan per baris;
- struktur Formula JSON;
- skema 13 kolom;
- normalisasi Customer ID, Salesforce, dan deskripsi;
- nama workbook dan worksheet;
- export gating.

### Middleware redirect

Perintah:

```bash
node tests/middleware.mjs
```

Hasil: **2/2 lulus**.

- Host lama menghasilkan status `301` dan mempertahankan path serta query.
- Host utama diteruskan ke aset tanpa redirect.

### Template Excel

`assets/templates/Contoh_Import_Tarif_Route_v2.0.0.xlsx`:

- berhasil diekspor dan diimpor ulang;
- berhasil dibuka serta dikonversi ke CSV oleh LibreOffice;
- header `RUTE KANTOR`, `TARIF`, dan `Layanan` terbaca;
- nilai tarif tetap bertipe angka;
- tidak ditemukan error formula;
- seluruh isi terlihat pada hasil render tanpa terpotong;
- struktur ZIP XLSX valid.

### Pemeriksaan statis

- Seluruh JavaScript lulus `node --check`.
- `tests/ui-smoke.py` lulus kompilasi Python.
- Tidak ada ID HTML duplikat.
- Seluruh referensi aset lokal ditemukan.
- Hash CSP untuk JSON-LD cocok dengan isi aktual.
- Token cache lama `20260728-1` tidak tersisa pada HTML aktif.
- Nilai lama `1300`, SLA tetap `30/720`, dan Formula ID global tidak tersisa pada kode aktif.

## Batas verifikasi lingkungan

Smoke test browser interaktif belum dapat dijalankan pada lingkungan ini karena paket Playwright Python dan binary browser Chromium tidak tersedia. Skrip `tests/ui-smoke.py` telah diperbarui untuk alur versi 2.0.0 dan dapat dijalankan di mesin yang memiliki Playwright + Chromium. Logika bisnis, struktur UI, aset lokal, middleware, template Excel, serta konstruksi record ekspor telah diverifikasi melalui pengujian yang tersedia di atas.
