# Panduan Integrasi Google Spreadsheet & Apps Script untuk Login CKG

Panduan ini menjelaskan cara menghubungkan Google Spreadsheet Anda dengan ekstensi **CKG Queue Assistant**.

---

### Langkah 1: Buat Spreadsheet Baru di Google Drive
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet Anda, misalnya: `Database Lisensi CKG`.

---

### Langkah 2: Pasang Skrip Apps Script
1. Di menu atas Google Spreadsheet, klik **Extensions (Ekstensi)** > **Apps Script**.
2. Hapus seluruh isi kode bawaan yang ada di editor.
3. Buka file `google_apps_script/Code.gs` dari folder ekstensi ini, lalu salin (copy) semua isinya dan tempel (paste) ke editor Apps Script.
4. Klik tombol **Save (Simpan / ikon disket)** atau tekan `Ctrl + S`.

---

### Langkah 3: Buat Kolom Otomatis
1. Di bilah menu Apps Script atas, pilih fungsi **`setupSheet`** pada dropdown fungsi.
2. Klik tombol **Run (Jalankan)**.
3. Jika muncul dialog perizinan (*Authorization Required*):
   - Klik **Review permissions**
   - Pilih akun Google Anda
   - Klik **Advanced** (Lanjutan) di kiri bawah
   - Klik **Go to Untitled project (unsafe)**
   - Klik **Allow (Izinkan)**
4. Kembali ke tab Google Spreadsheet Anda. Kolom-kolom berikut akan langsung otomatis terbuat dan diformat warna biru persis seperti format Anda:
   - **Email**
   - **Nama Pengguna**
   - **Status** (`Aktif` / `Nonaktif`)
   - **Masa Berlaku** (contoh: `2026-12-31`)
   - **Keterangan / No WA**
   - **Device ID**

---

### Langkah 4: Deploy Menjadi Web App (PENTING!)
1. Di halaman Apps Script, klik tombol biru **Deploy (Terapkan)** di kanan atas > pilih **New deployment (Penerapan baru)**.
2. Pada jenis penerapan (ikon roda gigi ⚙️ di sebelah kiri), pilih **Web app**.
3. Isi konfigurasi berikut:
   - **Description**: `API Lisensi CKG v1`
   - **Execute as (Jalankan sebagai)**: **`Me` (akun Google Anda)**
   - **Who has access (Siapa yang memiliki akses)**: **`Anyone` (Siapa saja)** *(Wajib 'Anyone' agar ekstensi dapat memverifikasi login tanpa popup login Google)*.
4. Klik **Deploy (Terapkan)**.
5. Salin **Web app URL** yang muncul (berakhiran `/exec`).
   - Contoh format: `https://script.google.com/macros/s/AKfycbx.../exec`

---

### Langkah 5: Masukkan URL ke Ekstensi CKG
1. Buka Sidepanel ekstensi CKG di Chrome.
2. Pada layar Login atau menu **Pengaturan**, tempelkan URL Web App tersebut.
3. Masukkan email yang sudah Anda daftarkan di spreadsheet (misalnya: `galerikegiatanlimo@gmail.com`).
4. Klik **Masuk / Aktivasi Ekstensi**.
5. Sistem akan memverifikasi email, mencatat Device ID secara otomatis di spreadsheet, dan membuka seluruh fitur otomatisasi CKG!
