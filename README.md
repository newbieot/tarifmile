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

Nilai `TARIF` hasil impor mengisi Tarif Minimum dan Tarif Kelipatan. Rute duplikat berdasarkan nilai `RUTE KANTOR` digabung dengan mengambil tarif tertinggi; perbedaan harga diberi peringatan.

Format zona, termasuk workbook tarif MA Provinsi KEPRI, juga didukung:

- Kodepos Asal dibaca dari `KODEPOS ASAL ZONA`.
- Kodepos Tujuan dibaca dari `KODEPOS TUJUAN ZONA`.
- Pilihan default **PKH dan PE sekaligus (otomatis)** memuat kedua tarif dalam satu unggahan dan satu workbook keluaran. REGULER menjadi PKH (`420`) dengan SLA **4 hari / 96 jam**; NEXTDAY menjadi PE (`411`) dengan SLA **2 hari / 48 jam**. Tarif Minimum dan Tarif Kelipatan diambil dari kolom tarif masing-masing. Pilihan impor satu layanan tetap tersedia.
- Baris PE hanya dibuat jika tarif NEXTDAY lebih dari `0`. Pada rute duplikat, tarif PE kosong atau `0` dilewati sehingga tarif PE yang terisi tetap dipakai, terlepas dari urutan baris sumber. Zona tanpa tarif PE tidak menghasilkan baris PE.
- Format zona dengan kolom `TARIF` dan `Layanan` juga diterima. Pilihan REGULER/NEXTDAY hanya berlaku untuk kolom tarif yang memiliki nama jenis tarif tersebut.
- Kolom kodepos zona diprioritaskan meskipun file juga memiliki `KODEPOS ASAL`, `KODEPOS TUJUAN`, atau `RUTE KANTOR`. Kodepos zona yang kosong harus dilengkapi secara manual.
- Duplikat digabung berdasarkan pasangan kodepos zona **dan layanan**, sehingga PKH dan PE untuk zona yang sama tetap menjadi dua baris. **Tarif tertinggi** yang valid pada Excel dipakai untuk Tarif Minimum dan Tarif Kelipatan, terlepas dari urutan baris. Jika terdapat harga berbeda, peringatan menampilkan nilai yang berbeda, baris sumber, dan harga tertinggi yang dipakai. Peringatan tetap terlihat di tabel, ringkasan impor, dan konfirmasi ekspor, tanpa mengunci ekspor. Nilai yang benar-benar kosong atau tidak valid tetap harus diperbaiki.

Pilihan tarif diterapkan saat impor; mengubah pilihan setelah impor tidak mengubah baris yang sudah diedit.
Filter pencarian, status, dan layanan direset saat impor berhasil agar seluruh hasil unggahan baru terlihat.

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
| KRT | 470 | 1644 |
| EC3 | 446 | 1288 |
| PPB_SEKOGRAM | 483 | 1711 |
| PPB_KARTUPOS | 485 | 1711 |
| PPB_PKT | 477 | 1711 |
| PPB_SRT | 476 | 1711 |
| DG | 466 | 1678 |
| VG | 465 | 1677 |
| 3PE, Q23, Q13, 3LX, 3LP, 332, 331, 312, 311, 010 | 464–455 | 1648 |

Untuk KBM, Formula ID otomatis tidak tersedia karena tabel referensi menampilkan tanda `-`. Jika opsi otomatis dipilih, ekspor akan ditahan sampai pengguna memilih `1644 (PJE)` atau mengganti layanan.

## Layanan KRT (CBA)

Pilih **KRT — Base Tariff (CBA)** sebelum impor untuk memuat seluruh rute sebagai KRT. Kolom `TARIF`, atau `TARIF REGULER` pada format zona, mengisi Base Tariff. Layanan juga dapat diganti menjadi KRT pada setiap baris.

KRT menggunakan Service ID `470`, kode layanan pelanggan `915903`, subservice `916479`, dan Formula ID `1644`. Formulir Salesforce tidak diperlukan untuk KRT. Tabel hanya meminta **Base Tariff**, tanpa berat, tarif minimum, atau tarif kelipatan. SLA hari tetap wajib diisi.

**No IO KRT** wajib dimasukkan pengguna dan berlaku untuk semua rute KRT dalam ekspor. Impor file baru mengosongkan No IO agar tidak memakai IO dari unggahan sebelumnya. Layanan lain tidak memerlukan No IO.

KRT memakai JSON berikut, dengan Base Tariff berupa teks sesuai template CBA:

```json
{"base_tariff":"10000","kdlayanan_pelanggan":915903}
```

## Formula JSON layanan lain

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

KRT diunduh sebagai `Tarif_KRT_916479.xlsx`, sheet `TariffCbaCustomer`, dengan 14 kolom: 13 header standar di atas diikuti `internal_order`. No IO ditulis sebagai teks agar nol awal tetap utuh. Jika terdapat KRT dan layanan lain, aplikasi menyiapkan dan mengunduh dua file terpisah; pratinjau dan konfirmasi menampilkan kedua nama file. Tombol unduh kembali mengunduh kedua file tersebut.

## Deployment Cloudflare Pages

Repositori ini dirancang untuk Cloudflare Pages melalui integrasi GitHub.

1. Letakkan `index.html` di root repositori.
2. Gunakan tanpa build command.
3. Gunakan root proyek sebagai output directory bila diminta.
4. Pastikan custom domain `tarif.posnew.com` telah terpasang.
5. Folder `functions/` harus ikut diunggah. Middleware akan mengalihkan `tarifmile.pages.dev` ke `tarif.posnew.com` sambil mempertahankan path dan query.

HTML menggunakan `Cache-Control: no-store`, sedangkan URL CSS/JavaScript memakai versi `20261019-207`. Kombinasi ini memastikan HTML terbaru memanggil aset versi baru setelah deployment.

## Pengujian

```bash
node tests/regression.cjs
node tests/middleware.mjs
python tests/ui-smoke.py
node tests/workbook-roundtrip.cjs <path-to-xlsx.full.min.js>
```

Smoke test memerlukan Playwright dan browser Chromium/Chrome/Edge. Pengujian roundtrip memakai build SheetJS `0.20.3` yang sama dengan aplikasi untuk membuat dan membaca ulang XLSX asli.

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
