# Pembuat Tarif Negotiable MILE

Versi **2.0.0** adalah aplikasi web statis berbahasa Indonesia untuk mengimpor rute tarif, memvalidasi data, dan membuat workbook `TariffCustomer` yang siap digunakan pada MILE.

> Aplikasi ini dikembangkan secara independen dan tidak boleh dinyatakan sebagai aplikasi resmi Pos Indonesia tanpa otorisasi tertulis.

## Privasi

File diproses secara lokal di browser. Data tarif tidak diunggah ke server, tidak dikirim ke API, dan tidak disimpan oleh aplikasi.

## Format file impor

Format yang didukung: `.xlsx`, `.xls`, dan `.csv`. Hanya lembar kerja pertama yang dibaca. Importer mencari tiga header berikut pada baris yang sama:

- `RUTE KANTOR`
- `TARIF`
- `Layanan`

Format rute wajib `ASAL|TUJUAN`, misalnya `29400|10110`. Contoh siap pakai tersedia di:

```text
assets/templates/Contoh_Import_Tarif_Route_v2.0.0.xlsx
```

Nilai `TARIF` hasil impor mengisi Tarif Minimum dan Tarif Kelipatan. Rute duplikat berdasarkan nilai `RUTE KANTOR` dilewati.

## Data pelanggan

Empat nilai global wajib diisi:

- ID Pelanggan
- Nomor Salesforce
- Tanggal Mulai Berlaku
- Tanggal Akhir Berlaku

ID Pelanggan diubah menjadi huruf besar hanya saat ekspor. Nilai Salesforce asli dipertahankan untuk nama file dan `tariff_sub_service_code`; bentuk numeriknya dipakai pada `kdlayanan_pelanggan`.

## Nilai per rute

- Layanan: default PKH (`420`)
- Formula ID: otomatis mengikuti layanan
- Opsi manual Formula ID: `1644` (`PJE`)
- SLA: wajib diisi pengguna dalam hari bulat lebih dari `0`
- SLA jam: otomatis dihitung `hari × 24`
- Berat Minimum: default `1000` gram
- Berat Kelipatan: default `1000` gram

Layanan dan Formula ID otomatis:

| Layanan | Service ID | Formula ID |
|---|---:|---:|
| PKH | 420 | 1288 |
| PE | 411 | 1288 |
| PJE | 428 | 1644 |
| PJB | 452 | 1669 |
| KBM | 481 | Tidak tersedia |
| Q9 | 408 | 1288 |
| PJM | 453 | 1672 |
| KRT | 470 | 1701 |
| EC3 | 446 | 1288 |
| PPB_SEKOGRAM | 483 | 1711 |
| PPB_KARTUPOS | 485 | 1711 |
| PPB_PKT | 477 | 1711 |
| PPB_SRT | 476 | 1711 |
| DG | 466 | 1678 |
| VG | 465 | 1677 |
| 3PE, Q23, Q13, 3LX, 3LP, 332, 331, 312, 311, 010 | 464–455 | 1648 |

Untuk KBM, Formula ID otomatis tidak tersedia karena tabel referensi menampilkan tanda `-`. Ekspor akan ditahan sampai pengguna memilih override `1644 (PJE)` atau mengganti layanan.

## Formula JSON

`tariff_formula_data` diekspor sebagai string JSON:

```json
{
  "actual_weight_1": 1000,
  "base_tariff_1": 10000,
  "base_tariff_2": 10000,
  "kelipatan": 1000,
  "kdlayanan_pelanggan": 914372
}
```

`disableTariff` tetap `0`. Exporter menolak angka kosong atau tidak valid, SLA tidak valid, Formula ID yang tidak tersedia, dan data duplikat kritis.

## Workbook keluaran

- Nama lembar kerja: `TariffCustomer`
- Nama file: `Tarif_Negotiable_<Nomor Salesforce>.xlsx`
- Jumlah kolom: 13
- Kode asal, tujuan, tanggal, kode pelanggan, deskripsi, dan JSON ditulis sebagai teks
- Service ID, SLA, Formula ID, dan `disableTariff` ditulis sebagai angka

## Deployment Cloudflare Pages

Repositori ini dirancang untuk Cloudflare Pages melalui integrasi GitHub.

1. Letakkan `index.html` di root repositori.
2. Gunakan tanpa build command.
3. Gunakan root proyek sebagai output directory bila diminta.
4. Pastikan custom domain `tarif.posnew.com` telah terpasang.
5. Folder `functions/` harus ikut diunggah. Middleware akan mengalihkan `tarifmile.pages.dev` ke `tarif.posnew.com` sambil mempertahankan path dan query.

HTML menggunakan `Cache-Control: no-store`, sedangkan URL CSS/JavaScript memakai versi `20260814-200`. Kombinasi ini memastikan HTML terbaru memanggil aset versi baru setelah deployment.

## Pengujian

```bash
node tests/regression.cjs
python tests/ui-smoke.py
```

Smoke test memerlukan Playwright dan browser Chromium.

## Struktur penting

```text
/
├── index.html
├── assets/
│   ├── css/
│   ├── js/
│   └── templates/Contoh_Import_Tarif_Route_v2.0.0.xlsx
├── functions/_middleware.js
├── tests/
├── _headers
├── CHANGELOG.md
└── QA-REPORT.md
```
