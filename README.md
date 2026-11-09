# 🩺 CKGPendaftaran: Otomatisasi Pendaftaran CKG (Cek Kesehatan Gratis)

> **Ekstensi Google Chrome (Manifest V3)** untuk mengolah data Excel mentah secara otomatis dan mendaftarkan peserta program **Cek Kesehatan Gratis (CKG)** langsung ke portal resmi **SehatIndonesiaku (ASIK - Kementerian Kesehatan Republik Indonesia)** secara unattended dan instan.

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](#)
[![Kemenkes ASIK](https://img.shields.io/badge/Platform-SehatIndonesiaku_(ASIK)-0ea5e9)](#)
[![License](https://img.shields.io/badge/License-Open_Access-green)](#)
[![Version](https://img.shields.io/badge/Version-3.0_Pendaftaran_Only-10b981)](#)

---

## 📋 Daftar Isi
1. [Latar Belakang & Masalah](#-latar-belakang--masalah)
2. [Fitur Unggulan](#-fitur-unggulan)
3. [Perubahan Terbaru: Tanpa Login / Bebas Akses](#-perubahan-terbaru-tanpa-login--bebas-akses)
4. [Persyaratan Sistem](#-persyaratan-sistem)
5. [Panduan Instalasi di Google Chrome / Microsoft Edge](#-panduan-instalasi-di-google-chrome--microsoft-edge)
6. [Panduan Penggunaan Lengkap](#-panduan-penggunaan-lengkap)
7. [Format Excel & Standarisasi Data](#-format-excel--standarisasi-data)
8. [Arsitektur & Struktur Direktori](#-arsitektur--struktur-direktori)
9. [Troubleshooting & Solusi Kendala](#-troubleshooting--solusi-kendala)

---

## 🎯 Latar Belakang & Masalah
Dalam program nasional **Cek Kesehatan Gratis (CKG)**, tenaga kesehatan (Nakes) di Puskesmas, Pustu, Posyandu, dan tim UKS Sekolah seringkali harus mendaftarkan ratusan hingga ribuan peserta setiap harinya ke portal **SehatIndonesiaku (ASIK - Kemenkes)**. 

Proses input pendaftaran satu per satu melalui formulir web memakan waktu berjam-jam, rawan salah ketik NIK/nama/tanggal lahir, dan melelahkan petugas. 

**CKGPendaftaran** hadir sebagai solusi otomasi:
- Cukup **tarik dan lepas (drag-and-drop) file Excel / CSV** mentah dari Puskesmas, Posyandu, Sekolah, atau BPJS.
- Ekstensi membaca data dan langsung menyuntikkan (auto-entry) formulir pendaftaran di portal SehatIndonesiaku secara mandiri (*unattended*).

---

## 🌟 Fitur Unggulan

### 1. 📥 Parser Excel Cerdas & Universal (Multi-Format)
- **Deteksi Header Fleksibel**: Mampu mendeteksi posisi baris header secara otomatis (baris 1 hingga 35), sehingga Anda tidak perlu repot merapikan judul tabel atau baris kosong di bagian atas file.
- **Dukungan Format Luas**: Mendukung format `.xlsx`, `.xls`, dan `.csv`.
- **Dukungan Banyak File Sekaligus**: Pilih atau tarik beberapa file Excel sekaligus dalam satu kali unggah.
- **Normalisasi Data Otomatis**:
  - **NIK**: Memastikan format 16 digit teks (mencegah angka terpotong atau terkonversi ke notasi ilmiah `1.23E+15`).
  - **Tanggal Lahir**: Mengenali format tanggal Indonesia (`DD/MM/YYYY`), ISO (`YYYY-MM-DD`), maupun tanggal serial Excel.
  - **Jenis Kelamin**: Memetakan otomatis variasi input (`L`/`P`, `Laki-laki`/`Perempuan`, `Pria`/`Wanita`).
  - **Data Wali Anak/Balita**: Deteksi otomatis NIK & Nama wali, dilengkapi mekanisme *Hardlock Wali* untuk balita yang tidak memiliki data NIK orang tua di file awal.

### 2. ⚡ Otomasi Pendaftaran CKG Mandiri (*Unattended Automation*)
- **Pengecekan NIK Otomatis**: Mengecek apakah NIK sudah terdaftar di sistem Kemenkes atau belum.
- **Pengisian Formulir Lengkap**: Mengisi NIK, nama lengkap, tanggal lahir, jenis kelamin, nomor handphone/WhatsApp, status pernikahan, alamat domisili, pekerjaan, hingga data wali anak.
- **Konfirmasi Tiket Kehadiran**: Otomatis mengonfirmasi tiket pendaftaran peserta hingga status siap dilayani.
- **Mode Unattended & Anti-Sleep**: Dilengkapi fitur *Keep-Awake* (`chrome.power`) dan *Reconnection Relay* agar otomasi tetap berjalan stabil tanpa terhenti meski layar laptop dibiarkan.

### 3. 🎮 Kontrol Antrean Fleksibel
- **Tombol Eksekusi Terpadu**:
  - `▶ MULAI SUNTIK DATA KE CKG`: Memulai eksekusi antrean secara berurutan.
  - `⏸ Jeda` & `▶ Lanjutkan`: Menjeda sementara proses jika diperlukan.
  - `⏹ Berhenti`: Menghentikan seluruh proses otomasi dengan aman.
  - `1-per-1`: Menjalankan pendaftaran hanya untuk 1 peserta aktif (sangat berguna untuk uji coba awal).
  - `🔄 Ulangi Error`: Otomatis mengulang entri untuk peserta yang sempat gagal tanpa perlu mengunggah ulang file Excel.
- **Live Terminal Log**: Menampilkan riwayat proses secara *real-time* detik demi detik langsung di Side Panel.

### 4. 📊 Generator & Standarisasi Template Excel
Dilengkapi generator template resmi standar CKG yang dapat diunduh langsung:
- `Template_Master_CKG_Umum.xlsx` (Multi-sheet: Balita, Dewasa L/P, Lansia L/P)
- `Template_Master_CKG_Sekolah.xlsx` (Multi-sheet: SD, SMP, SMA)
- Template satuan per kelompok siklus hidup (Balita, Sekolah SD, Remaja, Dewasa, Lansia)
- Kemampuan ekspor arsip ZIP seluruh template sekaligus.

---

## 🔓 Perubahan Terbaru: Tanpa Login / Bebas Akses

Pada rilis versi ini, **seluruh fitur login, kunci lisensi berbayar, dan verifikasi Device ID via Google Apps Script telah dihilangkan secara permanen**:
1. **Tidak Ada Kunci Lisensi**: Tidak lagi memerlukan verifikasi email terdaftar atau otorisasi Google Spreadsheet.
2. **Bebas Dipakai Siapa Saja**: Siapapun petugas/nakes yang menginstal ekstensi dapat langsung menggunakannya.
3. **Privasi & Keamanan Maksimal**: Ekstensi tidak lagi mengirimkan Device ID atau email pengguna ke server pihak ketiga manapun. Seluruh proses pengolahan data berjalan 100% lokal di browser pengguna.

---

## 💻 Persyaratan Sistem
- **Peramban**: Google Chrome, Microsoft Edge, Brave, atau peramban Chromium lainnya versi 116 ke atas (yang mendukung fitur *Side Panel*).
- **Akun ASIK**: Akun resmi Tenaga Kesehatan / Kader di portal [SehatIndonesiaku Kemenkes](https://sehatindonesiaku.kemkes.go.id/).

---

## 🚀 Panduan Instalasi di Google Chrome / Microsoft Edge

1. **Unduh / Clone Repositori Ini**:
   ```bash
   git clone https://github.com/krisnata/CKGPendaftaran.git
   ```
   *(Atau unduh file ZIP dari tombol **Code > Download ZIP** di GitHub lalu ekstrak ke folder komputer Anda).*

2. **Buka Halaman Ekstensi Peramban**:
   - Di Google Chrome: ketik `chrome://extensions/` pada bilah alamat URL lalu tekan Enter.
   - Di Microsoft Edge: ketik `edge://extensions/`.

3. **Aktifkan Developer Mode**:
   - Geser tombol **Developer mode** (Mode Pengembang) di pojok kanan atas ke posisi **Aktif (ON)**.

4. **Muat Ekstensi**:
   - Klik tombol **Load unpacked** (Muat yang belum dibongkar) di pojok kiri atas.
   - Pilih folder tempat repositori ini berada (folder yang berisi file `manifest.json`).

5. **Sematkan (Pin) Ekstensi**:
   - Klik ikon puzzle (Ekstensi) di toolbar kanan atas browser, lalu klik ikon pin di sebelah **CKG Auto Importer & Pendaftaran** agar selalu mudah diakses.

---

## 📖 Panduan Penggunaan Lengkap

### Langkah 1: Buka Portal SehatIndonesiaku & Login
1. Buka tab baru di browser Anda dan kunjungi [https://sehatindonesiaku.kemkes.go.id/](https://sehatindonesiaku.kemkes.go.id/).
2. Masuk (Login) menggunakan akun Nakes / Akun Puskesmas resmi Anda.
3. Masuk ke menu **Pendaftaran** atau **Cek Kesehatan Gratis**.

### Langkah 2: Buka Side Panel Ekstensi
1. Klik ikon ekstensi **CKG Auto Importer** pada bilah alat peramban.
2. Klik tombol **▶ Buka Side Panel CKG**.
3. Side Panel akan terbuka di bilah sisi kanan browser Anda bersebelahan langsung dengan halaman SehatIndonesiaku.

### Langkah 3: Masukkan Data Excel Peserta
1. Seret (*drag & drop*) file Excel / CSV data sasaran Anda ke kotak bertuliskan **📁 Pilih atau Tarik File Excel / CSV**.
2. Anda juga dapat mengeklik tombol **Pilih File Excel / CSV** untuk mencari file dari komputer.
3. Ekstensi akan otomatis membaca data, menyaring kolom yang sesuai, dan menyusun antrean pendaftaran.
4. Periksa ringkasan jumlah sasaran di tabel antrean.

### Langkah 4: Mulai Otomasi Pendaftaran
1. Klik tombol hijau besar: **`▶ MULAI SUNTIK DATA KE CKG`**.
2. Ekstensi akan secara otomatis:
   - Mencari input form pendaftaran di tab SehatIndonesiaku.
   - Mengisikan identitas peserta.
   - Memilih opsi-opsi terkait.
   - Mengonfirmasi pendaftaran.
   - Melanjutkan ke peserta berikutnya hingga selesai.
3. Pantau progres melalui bar progres dan kotak **🖥️ Log Eksekusi Otomasi**.
4. Jika ada peserta yang gagal (misal NIK tidak valid dari Dukcapil), peserta tersebut akan ditandai berstatus **ERROR** dan dapat Anda klik **Ulangi Error** setelah memperbaikinya.

---

## 📑 Format Excel & Standarisasi Data

Ekstensi ini sangat adaptif terhadap berbagai variasi nama kolom. Berikut adalah rekomendasi nama header yang otomatis dikenali:

| Kolom Target | Contoh Variasi Nama Header yang Dikenali |
|---|---|
| **NIK** | `NIK`, `No KTP`, `Nomor Induk Kependudukan`, `No. Identitas` |
| **Nama** | `Nama`, `Nama Lengkap`, `Nama Pasien`, `Nama Peserta` |
| **Tanggal Lahir** | `Tanggal Lahir`, `Tgl Lahir`, `DOB`, `Tgl_Lahir`, `Lahir` |
| **Jenis Kelamin** | `Jenis Kelamin`, `JK`, `Kelamin`, `Sex`, `Gender` |
| **No. Telepon / WA** | `No HP`, `No WhatsApp`, `Nomor Telepon`, `No_HP`, `Telp` |
| **Alamat** | `Alamat`, `Alamat Domisili`, `Alamat KTP`, `Desa`, `Dusun` |
| **Status Kawin** | `Status Pernikahan`, `Status Perkawinan`, `Marital Status` |
| **Pekerjaan** | `Pekerjaan`, `Profesi`, `Jabatan` |
| **Data Wali (Balita)** | `NIK Wali`, `Nama Wali`, `NIK Ibu`, `Nama Ibu`, `NIK Ayah` |
| **Sekolah & Kelas** | `Nama Sekolah`, `Sekolah`, `Kelas`, `Tingkat` |

> 💡 **Tips**: Jika kolom tertentu tidak ada di file Anda (misal nomor telepon), ekstensi akan otomatis mengisi fallback yang aman sesuai standar formulir CKG.

---

## 🏗️ Arsitektur & Struktur Direktori

```text
CKGPendaftaran/
├── manifest.json                  # Manifest Ekstensi V3 Chrome
├── popup.html / popup.js          # Jendela popup pembuka Side Panel
├── sidepanel.html / sidepanel.js  # Antarmuka utama Side Panel otomasi CKG
├── sidepanel.css / santai.css     # Tata letak & styling antarmuka UI
├── icons/                         # Ikon ekstensi (16px, 48px, 128px)
├── lib/
│   ├── xlsx.full.min.js          # Library SheetJS (Parser & Builder Excel)
│   └── jszip.min.js              # Library kompresi ZIP untuk bundle template
├── templates_excel/               # Master file template Excel standar CKG
│   ├── Template_Master_CKG_Umum.xlsx
│   ├── Template_Master_CKG_Sekolah.xlsx
│   └── Template_CKG_*.xlsx
├── generate_templates.py          # Script python pembangun template Excel
└── src/
    ├── auth.js                    # Modul otentikasi (Unlocked / Bebas Akses)
    ├── background.js              # Background service worker & pengatur antrean
    ├── db.js                      # IndexedDB queue manager & database lokal
    ├── data-transformer.js        # Engine normalisasi & pemetaan header Excel
    ├── excel-importer.js          # Parser file mentah ke database antrean
    ├── pendaftaranAutomation.js   # Script otomasi input formulir pendaftaran CKG
    ├── unattended-manager.js      # Monitor koneksi tab & penjaga kestabilan otomasi
    ├── interceptor.js             # Content script pelacak state form ASIK
    └── interceptor-relay.js       # Bridge penghubung halaman web ke service worker
```

---

## 🔧 Troubleshooting & Solusi Kendala

| Gejala Kendala | Penyebab Umum | Solusi |
|---|---|---|
| **Ekstensi tidak merespons saat klik "Mulai"** | Tab SehatIndonesiaku belum dibuka atau sesi login nakes kedaluwarsa. | Buka tab `https://sehatindonesiaku.kemkes.go.id/`, pastikan Anda dalam posisi sudah login di menu pendaftaran, lalu klik Mulai kembali. |
| **NIK terpotong / angka berakhiran 000** | Format kolom di Excel terbaca sebagai angka float (Scientific Number). | Gunakan format Text pada kolom NIK di Excel, atau gunakan fitur simpan template dari ekstensi. |
| **Peserta Balita ditandai Error Wali** | Data NIK/Nama Wali pada balita tersebut kosong di file Excel. | Masukkan NIK salah satu orang tua / gunakan fitur pengaturan Hardlock Wali di ekstensi. |
| **Browser melambat saat memproses ribuan data** | Terlalu banyak log pada terminal. | Klik tombol **Bersihkan** di pojok kanan atas kotak *Log Eksekusi Otomasi* untuk meringankan beban memori browser. |

---

## ⚖️ Lisensi & Kontribusi
Aplikasi ini dikembangkan untuk mempermudah operasional pelayanan kesehatan masyarakat di fasilitas pelayanan kesehatan primer (Puskesmas/Pustu/Posyandu). Kontribusi berupa saran, perbaikan bug, atau fitur baru sangat dipersilakan melalui *Pull Request* atau *Issue* di repositori GitHub ini.
