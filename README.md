# Pembuat Tarif Negotiable MILE

Versi **2.0.1** adalah aplikasi web statis berbahasa Indonesia untuk mengimpor rute tarif, memvalidasi data, dan membuat workbook `TariffCustomer` yang siap digunakan pada MILE.

> Aplikasi ini dikembangkan secara independen dan tidak boleh dinyatakan sebagai aplikasi resmi Pos Indonesia tanpa otorisasi tertulis.

## Privasi

File diproses secara lokal di browser. Data tarif tidak diunggah ke server, tidak dikirim ke API, dan tidak disimpan oleh aplikasi.

## Format file impor

Format yang didukung: `.xlsx`, `.xls`, dan `.csv`. Hanya lembar kerja pertama yang dibaca. Header boleh berada setelah baris judul, menggunakan huruf besar/kecil atau pemisah baris di dalam sel.

Format rute standar memakai tiga header berikut pada baris yang sama:

- `RUTE KANTOR`
- `TARIF`
- `Layanan`

Format rute wajib `ASAL|TUJUAN`, misalnya `29400|10110`. Contoh siap pakai tersedia di:

```text
assets/templates/Contoh_Import_Tarif_Route_v2.0.0.xlsx
```

Nilai `TARIF` hasil impor mengisi Tarif Minimum dan Tarif Kelipatan. Rute duplikat berdasarkan nilai `RUTE KANTOR` dilewati.

Format zona, termasuk workbook tarif MA Provinsi KEPRI, juga didukung:

- Kodepos Asal dibaca dari `KODEPOS ASAL ZONA`.
- Kodepos Tujuan dibaca dari `KODEPOS TUJUAN ZONA`.
- Pilihan default **PKH dan PE sekaligus (otomatis)** memuat kedua tarif dalam satu unggahan dan satu workbook keluaran. REGULER menjadi PKH (`420`) dengan SLA **4 hari / 96 jam**; NEXTDAY menjadi PE (`411`) dengan SLA **2 hari / 48 jam**. Tarif Minimum dan Tarif Kelipatan diambil dari kolom tarif masing-masing. Pilihan impor satu layanan tetap tersedia.
- Format zona dengan kolom `TARIF` dan `Layanan` juga diterima. Pilihan REGULER/NEXTDAY hanya berlaku untuk kolom tarif yang memiliki nama jenis tarif tersebut.
- Kolom kodepos zona diprioritaskan meskipun file juga memiliki `KODEPOS ASAL`, `KODEPOS TUJUAN`, atau `RUTE KANTOR`. Kodepos zona yang kosong harus dilengkapi secara manual.
- Duplikat digabung berdasarkan pasangan kodepos zona **dan layanan**, sehingga PKH dan PE untuk zona yang sama tetap menjadi dua baris. Jika tarif berbeda untuk zona dan layanan yang sama, Tarif Minimum dan Tarif Kelipatan pada layanan tersebut dikosongkan serta diberi pesan berisi baris sumber. Isi kembali kedua tarif sebelum ekspor.

Pilihan tarif diterapkan saat impor; mengubah pilihan setelah impor tidak mengubah baris yang sudah diedit.

## Data pelanggan

Data berikut harus lengkap sebelum ekspor dan tetap dapat diedit melalui formulir:

- ID Pelanggan
- Nomor Salesforce setiap layanan yang dipakai
- Tanggal Mulai Berlaku
- Tanggal Akhir Berlaku

Saat impor, `ID PELANGGAN`, `Kode Salesforce PKH`, dan `Kode Salesforce PE` otomatis mengisi formulir. Kedua Salesforce ditampilkan terpisah dan digunakan sesuai layanan pada setiap baris, termasuk pada JSON `kdlayanan_pelanggan` dan `tariff_sub_service_code`. Format standar juga menerima kolom `Nomor Salesforce` atau `Kode Salesforce`.

Setiap impor mengisi tanggal mulai **16 Oktober 2026** dan tanggal akhir **30 September 2029**. Jika satu file memuat beberapa ID Pelanggan atau Salesforce berbeda untuk layanan yang sama, impor ditolak agar kode pelanggan tidak tercampur.

ID Pelanggan diubah menjadi huruf besar hanya saat ekspor. Nilai Salesforce asli dipertahankan untuk nama file dan `tariff_sub_service_code`; bentuk numeriknya dipakai pada `kdlayanan_pelanggan`. Salesforce yang kosong atau tidak valid pada layanan aktif harus diperbaiki sebelum ekspor.

## Nilai per rute

- Layanan: default PKH (`420`)
- Formula ID: default `1644` (`PJE`); opsi otomatis mengikuti layanan
- Opsi manual Formula ID: `1644` (`PJE`)
- SLA: otomatis 4 hari untuk impor PKH dan 2 hari untuk impor PE; dapat diedit menjadi hari bulat lebih dari `0`. Baris manual dan format standar tetap memerlukan pengisian SLA.
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

Untuk KBM, Formula ID otomatis tidak tersedia karena tabel referensi menampilkan tanda `-`. Jika opsi otomatis dipilih, ekspor akan ditahan sampai pengguna memilih `1644 (PJE)` atau mengganti layanan.

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
- Nama file satu Salesforce: `Tarif_Negotiable_<Nomor Salesforce>.xlsx`; untuk dua Salesforce: `Tarif_Negotiable_<Salesforce PKH>_<Salesforce PE>.xlsx`
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

HTML menggunakan `Cache-Control: no-store`, sedangkan URL CSS/JavaScript memakai versi `20261016-204`. Kombinasi ini memastikan HTML terbaru memanggil aset versi baru setelah deployment.

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
