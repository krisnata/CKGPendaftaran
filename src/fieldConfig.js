// fieldConfig.js
// Konfigurasi Lengkap Aturan Pemeriksaan Pelayanan CKG (Kemenkes & SATUSEHAT)
// Diadopsi penuh dari modul teruji CKG_Puskesmas_Android_V2 (extracted_automator.js & ExamSettingsManager.kt)

export const FIELD_CONFIG = [
  // 1. Status Perkawinan & Disabilitas
  {
    id: "status-menikah",
    label: "Status Perkawinan",
    rules: [
      { type: "radio", keyword: "Perkawinan", labelFrom: "option" },
      { type: "radio", keyword: "status pernikahan", labelFrom: "option" },
      { type: "radio", keyword: "Apakah Anda penyandang disabilitas", label: "Non disabilitas" },
      { type: "radio", keyword: "penyandang disabilitas", label: "Non disabilitas" },
      { type: "radio", keyword: "Demografi Anak", label: "Non disabilitas" }
    ],
    default: "menikah",
    options: [
      { label: "Menikah", value: "menikah" },
      { label: "Belum Menikah", value: "belum-menikah" },
      { label: "Cerai Mati", value: "cerai-mati" },
      { label: "Cerai Hidup", value: "cerai-hidup" }
    ],
    required: true,
    showWhen: { notPageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  },
  {
    id: "rencana-menikah",
    label: "Rencana menikah dalam kurun waktu 1 tahun ke depan?",
    rules: [
      { type: "radio", keyword: "Rencana menikah", labelFrom: "option" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { in: ["belum-menikah", "cerai-mati", "cerai-hidup"], field: "status-menikah", notPageData: { kategori: "remaja" } }
  },
  {
    id: "hamil",
    label: "Apakah Anda sedang hamil?",
    rules: [
      { type: "radio", keyword: "sedang hamil", labelFrom: "option" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { pageData: { kategori: "dewasa", jenisKelamin: "perempuan" } }
  },
  {
    id: "hubungan-intim",
    label: "Hubungan Intim & Imunisasi Tetanus",
    rules: [
      { type: "radio", keyword: "Apakah pernah melakukan hubungan intim/seksual?", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "hubungan intim", label: "Ya" },
      { type: "radio", keyword: "imunisasi tetanus minimal 2 kali", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "radio", keyword: "mendapatkan imunisasi tetanus minimal 2 kali", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "radio", keyword: "mendapatkan imunisasi tetanus", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "radio", keyword: "imunisasi tetanus", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "radio", keyword: "status t", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "dropdown", keyword: "imunisasi tetanus minimal 2 kali", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "dropdown", keyword: "mendapatkan imunisasi tetanus minimal 2 kali", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "dropdown", keyword: "tetanus minimal 2 kali", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "dropdown", keyword: "imunisasi tetanus", label: "Pernah imunisasi tetanus minimal dua kali" },
      { type: "dropdown", keyword: "status t", label: "Pernah imunisasi tetanus minimal dua kali" }
    ],
    hideUI: true,
    default: "ya",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { notPageData: { kategori: "remaja" } },
    autoValue: { in: ["menikah", "cerai-hidup", "cerai-mati"], field: "status-menikah", value: "ya" }
  },

  // 2. Perilaku Merokok & Kadar CO (Tatalaksana Merokok)
  {
    id: "merokok",
    label: "Apakah Anda merokok dalam setahun terakhir ini?",
    rules: [
      { type: "radio", keyword: "merokok dalam setahun", labelFrom: "option" },
      { type: "radio", keyword: "apakah anda merokok", labelFrom: "option" },
      { type: "radio", keyword: "riwayat merokok", labelFrom: "option" },
      { type: "radio", keyword: "perilaku merokok", labelMap: { ya: "Merokok", tidak: "Tidak merokok" } },
      { type: "radio", keyword: "status merokok", labelMap: { ya: "Perokok aktif", tidak: "Bukan perokok" } },
      { type: "dropdown", keyword: "status merokok", labelMap: { ya: "Perokok aktif", tidak: "Bukan perokok" } },
      { type: "radio", keyword: "konsumsi rokok", labelFrom: "option" },
      { type: "radio", keyword: "perokok pasif", label: "Tidak" },
      { type: "radio", keyword: "paparan asap rokok", label: "Tidak" },
      { type: "radio", keyword: "rokok elektrik", label: "Tidak" },
      { type: "radio", keyword: "vape", label: "Tidak" },
      { type: "radio", keyword: "jenis rokok apa yang dikonsumsi", label: "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)" },
      { type: "radio", keyword: "kategori kadar co", labelMap: { ya: "Tinggi / Waspada (Merah/Kuning)", tidak: "Normal / Rendah (Hijau)" } },
      { type: "dropdown", keyword: "kategori kadar co", labelMap: { ya: "Tinggi / Waspada (Merah/Kuning)", tidak: "Normal / Rendah (Hijau)" } },
      { type: "radio", keyword: "interpretasi kadar co", labelMap: { ya: "Perokok aktif", tidak: "Bukan perokok" } },
      { type: "dropdown", keyword: "interpretasi kadar co", labelMap: { ya: "Perokok aktif", tidak: "Bukan perokok" } },
      { type: "dropdown", keyword: "tatalaksana merokok", labelMap: { ya: "Konseling Upaya Berhenti Merokok (UBM)", tidak: "KIE Pola Hidup Sehat" } },
      { type: "radio", keyword: "bersedia berhenti merokok", label: "Ya" },
      { type: "radio", keyword: "upaya berhenti merokok", label: "Ya" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { notPageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  },
  {
    id: "pernah-merokok",
    label: "Apakah Anda pernah merokok sebelumnya?",
    rules: [
      { type: "radio", keyword: "pernah merokok", label: "Tidak", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "kapan anda berhenti merokok", label: "1 s.d <10 tahun lalu" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { in: ["tidak"], field: "merokok", notPageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  },

  // 3. Antropometri & Tanda Vital
  {
    id: "berat-badan",
    label: "Berat Badan (Kg)",
    rules: [
      { type: "input", keyword: "berat badan", valueFrom: "field" },
      { type: "input", keyword: "berat", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 62"
  },
  {
    id: "tinggi-badan",
    label: "Tinggi / Panjang Badan (cm)",
    rules: [
      { type: "input", keyword: "tinggi badan", valueFrom: "field" },
      { type: "input", keyword: "panjang badan", valueFrom: "field" },
      { type: "input", keyword: "tinggi", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 165"
  },
  {
    id: "lingkar-perut",
    label: "Lingkar Perut (cm)",
    rules: [
      { type: "input", keyword: "lingkar perut", valueFrom: "field" },
      { type: "input", keyword: "perut", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 78"
  },
  {
    id: "tekanan-darah",
    label: "Pengukuran Tekanan Darah",
    rules: [
      { type: "radio", keyword: "apakah dilakukan pengukuran tekanan darah", label: "Ya" },
      { type: "radio", keyword: "dilakukan pengukuran tekanan darah", label: "Ya" },
      { type: "radio", keyword: "pengukuran tekanan darah", label: "Ya" },
      { type: "radio", keyword: "pemeriksaan tekanan darah", label: "Ya" },
      { type: "radio", keyword: "apakah dilakukan pemeriksaan tekanan darah", label: "Ya" },
      { type: "radio", keyword: "tekanan darah", label: "Ya" },
      { type: "radio", keyword: "cara pengukuran", label: "Duduk" },
      { type: "radio", keyword: "posisi pengukuran", label: "Duduk" },
      { type: "radio", keyword: "obat antihipertensi", label: "Tidak" },
      { type: "radio", keyword: "minum obat darah tinggi", label: "Tidak" },
      { type: "radio", keyword: "minum obat hipertensi", label: "Tidak" },
      { type: "radio", keyword: "riwayat hipertensi", label: "Tidak" },
      { type: "radio", keyword: "apakah sedang minum obat", label: "Tidak" }
    ],
    hideUI: true,
    default: "ya"
  },
  {
    id: "tekanan-darah-sistolik",
    label: "Tekanan Darah Sistolik (mmHg)",
    rules: [
      { type: "input", keyword: "tekanan darah sistol", valueFrom: "field" },
      { type: "input", keyword: "sistol", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 118"
  },
  {
    id: "tekanan-darah-diastolik",
    label: "Tekanan Darah Diastolik (mmHg)",
    rules: [
      { type: "input", keyword: "tekanan darah diastol", valueFrom: "field" },
      { type: "input", keyword: "diastol", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 76"
  },
  {
    id: "gula-darah",
    label: "Gula Darah Sewaktu (GDS) (mg/dL)",
    rules: [
      { type: "input", keyword: "gula darah sewaktu (gds)", valueFrom: "field" },
      { type: "input", keyword: "gula darah sewaktu", valueFrom: "field" },
      { type: "input", keyword: "gds", valueFrom: "field" }
    ],
    required: true,
    inputType: "number",
    placeholder: "contoh: 105"
  },

  // 4. Riwayat Diabetes Melitus & GDS 2 (Validasi Khusus Kemenkes V2)
  {
    id: "diabetes-riwayat",
    label: "Riwayat Diagnosis Diabetes Dokter",
    rules: [
      { type: "radio", keyword: "apakah anda pernah dinyatakan diabetes", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "pernah dinyatakan diabetes", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "dinyatakan diabetes atau kencing manis", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "riwayat diabetes", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "radio", keyword: "riwayat kencing manis", labelMap: { ya: "Ya", tidak: "Tidak" } },
      { type: "input", keyword: "sudah berapa bulan anda didiagnosis", value: "12" },
      { type: "input", keyword: "berapa bulan anda didiagnosis", value: "12" },
      { type: "input", keyword: "total bulan sejak didiagnosis", value: "12" }
    ],
    hideUI: true
  },

  // 5. Skrining Kanker Paru (Usia >= 45 tahun / Dewasa & Lansia)
  {
    id: "kanker-paru",
    label: "Skrining Kanker Paru",
    rules: [
      { type: "radio", keyword: "paparan debu industri", label: "Tidak" },
      { type: "radio", keyword: "paparan asbes", label: "Tidak" },
      { type: "radio", keyword: "paparan gas buang", label: "Tidak" },
      { type: "radio", keyword: "paparan radon", label: "Tidak" },
      { type: "radio", keyword: "riwayat kanker pada keluarga", label: "Tidak" },
      { type: "radio", keyword: "riwayat kanker paru", label: "Tidak" },
      { type: "radio", keyword: "riwayat penyakit paru kronis", label: "Tidak" },
      { type: "radio", keyword: "batuk darah", label: "Tidak" },
      { type: "radio", keyword: "hemoptisis", label: "Tidak" },
      { type: "radio", keyword: "suara serak", label: "Tidak" },
      { type: "radio", keyword: "hasil skrining kanker paru", label: "Risiko Rendah" },
      { type: "dropdown", keyword: "hasil skrining kanker paru", label: "Risiko Rendah" },
      { type: "radio", keyword: "risiko kanker paru", label: "Risiko Rendah" },
      { type: "dropdown", keyword: "risiko kanker paru", label: "Risiko Rendah" }
    ],
    hideUI: true
  },

  // 6. Skrining Kanker Usus (APCS)
  {
    id: "kanker-usus",
    label: "Skrining Kanker Usus (APCS)",
    rules: [
      { type: "radio", keyword: "riwayat polip usus", label: "Tidak" },
      { type: "radio", keyword: "kanker kolorektal keluarga", label: "Tidak" },
      { type: "radio", keyword: "kanker usus pada keluarga", label: "Tidak" },
      { type: "radio", keyword: "keluarga derajat pertama kanker", label: "Tidak" },
      { type: "radio", keyword: "bab berdarah", label: "Tidak" },
      { type: "radio", keyword: "darah pada feses", label: "Tidak" },
      { type: "radio", keyword: "perubahan pola bab", label: "Tidak" },
      { type: "radio", keyword: "darah samar feses", label: "Tidak dilakukan" },
      { type: "dropdown", keyword: "darah samar feses", label: "Tidak dilakukan" },
      { type: "radio", keyword: "fobt", label: "Tidak dilakukan" },
      { type: "radio", keyword: "fit", label: "Tidak dilakukan" },
      { type: "radio", keyword: "hasil skrining apcs", label: "Risiko Rata-rata" },
      { type: "dropdown", keyword: "hasil skrining apcs", label: "Risiko Rata-rata" },
      { type: "radio", keyword: "risiko kanker usus", label: "Risiko Rata-rata" },
      { type: "dropdown", keyword: "risiko kanker usus", label: "Risiko Rata-rata" }
    ],
    hideUI: true
  },

  // 7. Skrining Jantung (Kardiovaskular)
  {
    id: "jantung",
    label: "Skrining Jantung & Kardiovaskular",
    rules: [
      { type: "radio", keyword: "nyeri dada", label: "Tidak" },
      { type: "radio", keyword: "rasa tertekan di dada", label: "Tidak" },
      { type: "radio", keyword: "sesak napas saat aktivitas", label: "Tidak" },
      { type: "radio", keyword: "jantung berdebar", label: "Tidak" },
      { type: "radio", keyword: "palpitasi", label: "Tidak" },
      { type: "bengkak pada kedua tungkai", keyword: "bengkak pada kedua tungkai", label: "Tidak" },
      { type: "radio", keyword: "riwayat penyakit jantung keluarga", label: "Tidak" },
      { type: "radio", keyword: "riwayat penyakit jantung", label: "Tidak" },
      { type: "radio", keyword: "hasil pemeriksaan - skrining jantung", label: "Risiko Rendah" },
      { type: "dropdown", keyword: "hasil pemeriksaan - skrining jantung", label: "Risiko Rendah" },
      { type: "radio", keyword: "risiko kardiovaskular", label: "Risiko Rendah (<10%)" },
      { type: "dropdown", keyword: "risiko kardiovaskular", label: "Risiko Rendah (<10%)" },
      { type: "radio", keyword: "hasil ekg", label: "Normal" },
      { type: "dropdown", keyword: "hasil ekg", label: "Normal" },
      { type: "dropdown", keyword: "elektrokardiogram", label: "Normal" }
    ],
    hideUI: true
  },

  // 8. Pemeriksaan PPOK (Skrining PUMA)
  {
    id: "ppok",
    label: "Pemeriksaan PPOK (Skrining PUMA)",
    rules: [
      { type: "radio", keyword: "apakah anda pernah merasa napas pendek", label: "Tidak" },
      { type: "radio", keyword: "napas pendek ketika berjalan", label: "Tidak" },
      { type: "radio", keyword: "napas pendek saat berjalan cepat", label: "Tidak" },
      { type: "radio", keyword: "dahak yang berasal dari paru", label: "Tidak" },
      { type: "radio", keyword: "kesulitan mengeluarkan dahak", label: "Tidak" },
      { type: "radio", keyword: "dahak", label: "Tidak" },
      { type: "radio", keyword: "batuk saat sedang tidak menderita selesma", label: "Tidak" },
      { type: "radio", keyword: "batuk saat tidak sedang flu", label: "Tidak" },
      { type: "radio", keyword: "pemeriksaan spirometri atau peak flow meter", label: "Tidak" },
      { type: "radio", keyword: "pemeriksaan spirometri", label: "Tidak" },
      { type: "radio", keyword: "tes fungsi paru", label: "Tidak" },
      { type: "radio", keyword: "riwayat merokok (pack-years)", label: "Tidak pernah merokok" },
      { type: "dropdown", keyword: "skor puma", label: "< 6 (Risiko Rendah)" },
      { type: "dropdown", keyword: "hasil puma", label: "Risiko Rendah" },
      { type: "radio", keyword: "hasil skrining puma", label: "Risiko Rendah" },
      { type: "radio", keyword: "risiko ppok", label: "Risiko Rendah" },
      { type: "dropdown", keyword: "risiko ppok", label: "Risiko Rendah" }
    ],
    hideUI: true
  },

  // 9. Skrining Laboratorium (POCT, Gula Darah, Ginjal, Hati, Lipid)
  {
    id: "laboratorium",
    label: "Skrining Laboratorium (GDS, Ginjal, Hati, Lipid)",
    rules: [
      { type: "radio", keyword: "apakah dilakukan pemeriksaan gula darah", label: "Ya" },
      { type: "radio", keyword: "pemeriksaan gula darah", label: "Ya" },
      { type: "radio", keyword: "pemeriksaan gds", label: "Dilakukan" },
      { type: "dropdown", keyword: "jenis pemeriksaan gula darah", label: "Gula Darah Sewaktu (GDS)" },
      { type: "radio", keyword: "jenis pemeriksaan gula darah", label: "Gula Darah Sewaktu (GDS)" },
      { type: "radio", keyword: "apakah dilakukan pemeriksaan laboratorium", label: "Ya" },
      { type: "radio", keyword: "apakah dilakukan pemeriksaan fungsi ginjal", label: "Ya" },
      { type: "radio", keyword: "apakah dilakukan pemeriksaan fungsi hati", label: "Ya" },
      { type: "radio", keyword: "apakah dilakukan pemeriksaan profil lipid", label: "Ya" },
      { type: "radio", keyword: "protein urin", label: "Negatif" },
      { type: "dropdown", keyword: "protein urin", label: "Negatif" },
      { type: "radio", keyword: "albuminuria", label: "Negatif" },
      { type: "dropdown", keyword: "albuminuria", label: "Negatif" },
      { type: "input", keyword: "konsentrasi albumin urin", value: "15" },
      { type: "input", keyword: "konsentrasi kreatinin urin", value: "100" },
      { type: "radio", keyword: "uacr", label: "Normal (< 30 mg/g)" },
      { type: "dropdown", keyword: "uacr", label: "Normal (< 30 mg/g)" },
      { type: "radio", keyword: "kategori e-lfg", label: "Normal (≥ 90 mL/mnt/1.73m²)" },
      { type: "dropdown", keyword: "kategori e-lfg", label: "Normal (≥ 90 mL/mnt/1.73m²)" },
      { type: "radio", keyword: "kesimpulan fungsi ginjal", label: "Normal" },
      { type: "dropdown", keyword: "kesimpulan fungsi ginjal", label: "Normal" },
      { type: "radio", keyword: "kesimpulan fungsi hati", label: "Normal" },
      { type: "dropdown", keyword: "kesimpulan fungsi hati", label: "Normal" },
      { type: "radio", keyword: "kesimpulan profil lipid", label: "Normal" },
      { type: "dropdown", keyword: "kesimpulan profil lipid", label: "Normal" },
      { type: "dropdown", keyword: "metode pemeriksaan", label: "POCT" }
    ],
    hideUI: true
  },

  // 10. Telinga dan Pendengaran
  {
    id: "telinga",
    label: "Telinga",
    rules: [
      { type: "radio", keyword: "serumen impaksi", label: "Tidak ada serumen impaksi" },
      { type: "dropdown", keyword: "serumen impaksi", label: "Tidak ada serumen impaksi" },
      { type: "dropdown", keyword: "infeksi telinga", label: "Tidak ada infeksi telinga" },
      { type: "radio", keyword: "infeksi telinga", label: "Tidak ada infeksi telinga" },
      { type: "radio", keyword: "tajam pendengaran", label: "Normal" },
      { type: "radio", keyword: "gangguan pendengaran di telinga", label: "Normal" },
      { type: "radio", keyword: "gangguan pendengaran", label: "Normal" },
      { type: "radio", keyword: "tes bisik", label: "Normal" },
      { type: "dropdown", keyword: "tes bisik", label: "Normal" },
      { type: "radio", keyword: "hasil skrining pendengaran", label: "Normal" },
      { type: "radio", keyword: "telinga", label: "Normal" },
      { type: "dropdown", keyword: "telinga", label: "Normal" }
    ],
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Gangguan", value: "gangguan" }
    ],
    required: true
  },

  // 11. Mata, Visus, dan Penglihatan
  {
    id: "mata",
    label: "Mata & Visus",
    rules: [
      { type: "radio", keyword: "ditemukan selaput mata merah atau kornea keruh", label: "Normal" },
      { type: "radio", keyword: "selaput mata merah", label: "Normal" },
      { type: "radio", keyword: "kornea keruh", label: "Normal" },
      { type: "radio", keyword: "kelopak mata", label: "Normal" },
      { type: "radio", keyword: "pupil putih", label: "Normal" },
      { type: "dropdown", keyword: "pupil putih", label: "Normal" },
      { type: "radio", keyword: "kelainan mata", label: "Normal" },
      { type: "radio", keyword: "hasil skrining tajam penglihatan", label: "Normal (visus 6/6 - 6/12)" },
      { type: "radio", keyword: "pemeriksaan visus", label: "Normal" },
      { type: "radio", keyword: "tajam penglihatan mata", label: "Normal (visus 6/6 - 6/9)" },
      { type: "radio", keyword: "visus", label: "Normal" },
      { type: "radio", keyword: "pupil", label: "Normal" },
      { type: "radio", keyword: "katarak", label: "Normal" },
      { type: "radio", keyword: "kekeruhan lensa", label: "Tidak ada kekeruhan lensa" },
      { type: "radio", keyword: "glaukoma", label: "Normal" },
      { type: "radio", keyword: "hasil skrining penglihatan", label: "Normal" },
      { type: "radio", keyword: "mata", label: "Normal" },
      { type: "dropdown", keyword: "mata", label: "Normal" }
    ],
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Gangguan penglihatan ringan", value: "gangguan-penglihatan-ringan" },
      { label: "Gangguan penglihatan sedang", value: "gangguan-penglihatan-sedang" },
      { label: "Gangguan penglihatan berat", value: "gangguan-penglihatan-berat" },
      { label: "Buta", value: "buta" }
    ],
    required: true
  },

  // 12. Gigi dan Mulut
  {
    id: "gigi",
    label: "Gigi dan Mulut",
    rules: [
      { type: "radio", keyword: "gigi karies", labelMap: { cabut: "Ya", lubang: "Ya", normal: "Tidak" } },
      { type: "radio", keyword: "gigi hilang/dicabut", labelMap: { cabut: "Ya", lubang: "Tidak", normal: "Tidak" } },
      { type: "radio", keyword: "gigi hilang", label: "Tidak" },
      { type: "radio", keyword: "jumlah gigi karies", label: "Tidak ada" },
      { type: "radio", keyword: "berapa jumlah gigi karies", label: "Tidak ada" }
    ],
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Lubang", value: "lubang" },
      { label: "Cabut", value: "cabut" }
    ],
    required: true
  },
  {
    id: "kacamata",
    label: "Kacamata",
    rules: [
      { type: "radio", keyword: "kacamata", labelFrom: "option" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { pageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  },
  {
    id: "katarak",
    label: "Katarak",
    rules: [
      { type: "radio", keyword: "hasil pemeriksaan pupil", labelFrom: "option" },
      { type: "radio", keyword: "katarak", labelFrom: "option" }
    ],
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Curiga Katarak", value: "curiga-katarak" }
    ],
    required: true,
    showWhen: { notPageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  },

  // 13. SKILAS Lansia Lengkap (Depresi, Malnutrisi, Mobilisasi, Kognitif)
  {
    id: "skilas",
    label: "SKILAS Lansia & Geriatri",
    rules: [
      // Depresi
      { type: "radio", keyword: "puas dengan kehidupan", label: "Ya" },
      { type: "dropdown", keyword: "puas dengan kehidupan", label: "Ya" },
      { type: "radio", keyword: "apakah anda sering merasa bosan", label: "Tidak" },
      { type: "radio", keyword: "apakah anda sering merasa tidak berdaya", label: "Tidak" },
      { type: "radio", keyword: "merasa tidak berharga", label: "Tidak" },
      { type: "dropdown", keyword: "merasa sedih, tertekan", label: "Tidak" },
      { type: "radio", keyword: "merasa sedih, tertekan", label: "Tidak" },
      { type: "dropdown", keyword: "sedikit minat atau kesenangan", label: "Tidak" },
      { type: "radio", keyword: "sedikit minat atau kesenangan", label: "Tidak" },
      { type: "radio", keyword: "kesimpulan depresi", label: "Normal" },

      // Malnutrisi
      { type: "dropdown", keyword: "penurunan asupan makanan", label: "Tidak ada penurunan asupan makanan" },
      { type: "radio", keyword: "penurunan asupan makanan", label: "Tidak ada penurunan asupan makanan" },
      { type: "dropdown", keyword: "penurunan berat badan dalam tiga bulan", label: "Tidak ada penurunan berat badan" },
      { type: "radio", keyword: "penurunan berat badan dalam tiga bulan", label: "Tidak ada penurunan berat badan" },
      { type: "dropdown", keyword: "kemampuan melakukan mobilitas", label: "Bisa bepergian keluar rumah" },
      { type: "radio", keyword: "kemampuan melakukan mobilitas", label: "Bisa bepergian keluar rumah" },
      { type: "radio", keyword: "stress psikologis atau penyakit akut", label: "Tidak" },
      { type: "dropdown", keyword: "masalah neuropsikologis", label: "Tidak ada masalah psikologis" },
      { type: "radio", keyword: "masalah neuropsikologis", label: "Tidak ada masalah psikologis" },
      { type: "dropdown", keyword: "nilai imt (indeks massa tubuh)", label: "IMT 23 atau lebih" },
      { type: "radio", keyword: "nilai imt (indeks massa tubuh)", label: "IMT 23 atau lebih" },
      { type: "dropdown", keyword: "berapa nilai imt", label: "IMT 23 atau lebih" },
      { type: "radio", keyword: "berapa nilai imt", label: "IMT 23 atau lebih" },
      { type: "radio", keyword: "berkurang >3 kg", label: "Tidak" },
      { type: "radio", keyword: "penurunan berat badan > 3 kg", label: "Tidak" },
      { type: "radio", keyword: "penurunan nafsu makan", label: "Tidak" },
      { type: "radio", keyword: "pakaian terasa lebih longgar", label: "Tidak" },
      { type: "radio", keyword: "kesimpulan skrining malnutrisi", label: "Normal" },

      // Mobilisasi (Chair Stand Test & SPPB)
      { type: "radio", keyword: "berdiri berdampingan", label: "Bertahan 10 detik" },
      { type: "radio", keyword: "semi tandem", label: "Bertahan 10 detik" },
      { type: "radio", keyword: "berdiri tandem", label: "Bertahan 10 detik" },
      { type: "radio", keyword: "waktu untuk berjalan sejauh empat meter", label: "4,82 detik" },
      { type: "radio", keyword: "kecepatan berjalan", label: "4,82 detik" },
      { type: "radio", keyword: "waktu untuk bangkit dari kursi", label: "<11.19 detik" },
      { type: "radio", keyword: "bangkit dari kursi lima kali", label: "<11.19 detik" },
      { type: "radio", keyword: "tes berdiri di kursi", label: "Ya" },
      { type: "radio", keyword: "tes berdiri dari kursi", label: "Ya" },
      { type: "radio", keyword: "mampu berdiri 5 kali", label: "Ya" },
      { type: "radio", keyword: "tes keseimbangan", label: "Normal" },
      { type: "radio", keyword: "risiko jatuh", label: "Tidak berisiko jatuh" },
      { type: "radio", keyword: "kesimpulan mobilisasi", label: "Normal" },

      // Kognitif
      { type: "radio", keyword: "mengingat tiga kata", label: "Ya" },
      { type: "radio", keyword: "mengingat tiga kata sebelumnya", label: "Ya" },
      { type: "radio", keyword: "tanggal berapakah hari ini", label: "Benar semua" },
      { type: "radio", keyword: "menggambar jam", label: "Normal" },
      { type: "radio", keyword: "clock drawing", label: "Normal" },
      { type: "radio", keyword: "kesimpulan skrining kognitif", label: "Normal" }
    ],
    hideUI: true
  },

  // 14. Indeks Barthel (Kemandirian ADL Lansia - 10 Butir Pertanyaan Lengkap)
  {
    id: "barthel-index",
    label: "Indeks Barthel (Kemandirian ADL Lansia)",
    rules: [
      { type: "dropdown", keyword: "rangsang buang air besar", label: "Terkendali teratur" },
      { type: "radio", keyword: "rangsang buang air besar", label: "Terkendali teratur" },
      { type: "dropdown", keyword: "buang air besar", label: "Terkendali teratur" },
      { type: "radio", keyword: "buang air besar", label: "Terkendali teratur" },
      { type: "dropdown", keyword: "rangsang berkemih", label: "Mandiri" },
      { type: "radio", keyword: "rangsang berkemih", label: "Mandiri" },
      { type: "dropdown", keyword: "buang air kecil", label: "Mandiri" },
      { type: "radio", keyword: "buang air kecil", label: "Mandiri" },
      { type: "dropdown", keyword: "buar air kecil", label: "Mandiri" },
      { type: "radio", keyword: "buar air kecil", label: "Mandiri" },
      { type: "dropdown", keyword: "membersihkan diri", label: "Mandiri" },
      { type: "radio", keyword: "membersihkan diri", label: "Mandiri" },
      { type: "dropdown", keyword: "penggunaan jamban", label: "Mandiri" },
      { type: "radio", keyword: "penggunaan jamban", label: "Mandiri" },
      { type: "dropdown", keyword: "keluar masuk jamban", label: "Mandiri" },
      { type: "radio", keyword: "keluar masuk jamban", label: "Mandiri" },
      { type: "dropdown", keyword: "makan dan minum", label: "Mandiri" },
      { type: "radio", keyword: "makan dan minum", label: "Mandiri" },
      { type: "dropdown", keyword: "berubah sikap dari berbaring", label: "Mandiri" },
      { type: "radio", keyword: "berubah sikap dari berbaring", label: "Mandiri" },
      { type: "dropdown", keyword: "berbaring ke duduk", label: "Mandiri" },
      { type: "radio", keyword: "berbaring ke duduk", label: "Mandiri" },
      { type: "dropdown", keyword: "berpindah/berjalan", label: "Mandiri" },
      { type: "radio", keyword: "berpindah/berjalan", label: "Mandiri" },
      { type: "dropdown", keyword: "berpindah atau berjalan", label: "Mandiri" },
      { type: "radio", keyword: "berpindah atau berjalan", label: "Mandiri" },
      { type: "dropdown", keyword: "memakai baju", label: "Mandiri" },
      { type: "radio", keyword: "memakai baju", label: "Mandiri" },
      { type: "dropdown", keyword: "naik turun tangga", label: "Mandiri" },
      { type: "radio", keyword: "naik turun tangga", label: "Mandiri" },
      { type: "dropdown", keyword: "mandi", label: "Mandiri" },
      { type: "radio", keyword: "mandi", label: "Mandiri" }
    ],
    hideUI: true
  },

  // 15. Skrining Calon Pengantin (Catin) & Anemia (Hemoglobin)
  {
    id: "anemia-catin",
    label: "Skrining Calon Pengantin & Anemia (Hb)",
    rules: [
      { type: "input", keyword: "pemeriksaan hemoglobin", value: "13.5" },
      { type: "input", keyword: "hasil pemeriksaan hemoglobin", value: "13.5" },
      { type: "input", keyword: "nilai hemoglobin", value: "13.5" },
      { type: "input", keyword: "kadar hemoglobin", value: "13.5" },
      { type: "radio", keyword: "status anemia", label: "Tidak anemia" },
      { type: "dropdown", keyword: "status anemia", label: "Tidak anemia" },
      { type: "radio", keyword: "hasil pemeriksaan catin", label: "Normal" },
      { type: "dropdown", keyword: "hasil pemeriksaan catin", label: "Normal" },
      { type: "dropdown", keyword: "tatalaksana anemia", label: "KIE Gizi Seimbang" }
    ],
    hideUI: true
  },

  // 16. Penyakit Menular: TB, Kusta, Frambusia, Skabies
  {
    id: "tb-xray",
    label: "Faktor Risiko dan Skrining X-Ray TB",
    rules: [
      { type: "dropdown", keyword: "Apakah anda ada kontak dengan pasien Tuberkulosis", label: "Tidak ada" },
      { type: "dropdown", keyword: "Metode Pemeriksaan (untuk terduga TB)", label: "Tidak dilakukan" },
      { type: "radio", keyword: "Apakah Anda mengalami batuk lebih dari 2 minggu", label: "Tidak" },
      { type: "radio", keyword: "batuk berdahak", label: "Tidak" },
      { type: "radio", keyword: "kontak erat dengan pasien TBC", label: "Tidak" },
      { type: "radio", keyword: "mengalami demam meriang", label: "Tidak" },
      { type: "radio", keyword: "berkeringat di malam hari tanpa aktivitas", label: "Tidak" },
      { type: "radio", keyword: "mengalami penurunan berat badan tanpa sebab", label: "Tidak" },
      { type: "radio", keyword: "gejala batuk", label: "Tidak" },
      { type: "radio", keyword: "kontak dengan penderita", label: "Tidak" },
      { type: "radio", keyword: "terduga TB", label: "Tidak" },
      { type: "radio", keyword: "Hasil Foto Toraks", label: "Normal" },
      { type: "radio", keyword: "X-Ray", label: "Normal" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan Foto Toraks (X-Ray)", label: "Normal / Tidak tampak kelainan" }
    ],
    hideUI: true
  },
  {
    id: "frambusia",
    label: "Frambusia",
    rules: [
      { type: "radio", keyword: "papul/nodul/ulkus", label: "Tidak ada" }
    ],
    hideUI: true,
    default: "tidak-ada"
  },
  {
    id: "kusta",
    label: "Kusta",
    rules: [
      { type: "dropdown", keyword: "bercak kulit putih atau merah", label: "Tidak ada" }
    ],
    hideUI: true,
    default: "tidak-ada"
  },
  {
    id: "skabies",
    label: "Skabies",
    rules: [
      { type: "dropdown", keyword: "koreng/ruam/bentol", label: "Tidak ada" }
    ],
    hideUI: true,
    default: "tidak-ada"
  },
  // 16b. Faktor Risiko Gula Darah Anak
  {
    id: "faktor-risiko-gula-darah-anak",
    label: "Faktor Risiko Gula Darah Anak",
    rules: [
      { type: "radio", keyword: "Faktor Risiko Gula Darah Anak", label: "Tidak" },
      { type: "radio", keyword: "faktor risiko gula darah", label: "Tidak" }
    ],
    hideUI: true,
    default: "tidak"
  },

  // 17. Penyakit Menular Seksual, Hepatitis & Malaria
  {
    id: "malaria",
    label: "Pemeriksaan Malaria",
    rules: [
      { type: "radio", keyword: "Hasil Pemeriksaan RDT Malaria", label: "Non-Reaktif", fallbackIndex: 1 },
      { type: "radio", keyword: "Pemeriksaan RDT Malaria", label: "Non-Reaktif", fallbackIndex: 1 },
      { type: "radio", keyword: "RDT Malaria", label: "Non-Reaktif", fallbackIndex: 1 },
      { type: "radio", keyword: "Pemeriksaan Malaria", label: "Non-Reaktif" },
      { type: "radio", keyword: "Hasil Malaria", label: "Non-Reaktif" },
      { type: "radio", keyword: "Malaria", label: "Non-Reaktif" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan RDT Malaria", label: "Non-Reaktif" },
      { type: "dropdown", keyword: "RDT Malaria", label: "Non-Reaktif" },
      { type: "dropdown", keyword: "Malaria", label: "Non-Reaktif" },
      { type: "radio", keyword: "Apakah pernah sakit malaria", label: "Tidak" },
      { type: "radio", keyword: "Apakah ada orang sakit malaria", label: "Tidak" },
      { type: "radio", keyword: "daerah berisiko tinggi malaria", label: "Tidak" },
      { type: "radio", keyword: "Faktor Risiko Malaria", label: "Tidak" }
    ],
    hideUI: true,
    default: "non-reaktif"
  },
  {
    id: "hepatitis",
    label: "Pemeriksaan Hepatitis",
    rules: [
      { type: "radio", keyword: "Hasil Rapid Test Hepatitis B", label: "HBsAg Non Reaktif" },
      { type: "radio", keyword: "Hasil Rapid Test Hepatitis C", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "Rapid Test Hepatitis B", label: "HBsAg Non Reaktif" },
      { type: "radio", keyword: "Rapid Test Hepatitis C", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "Pemeriksaan Hepatitis B", label: "HBsAg Non Reaktif" },
      { type: "radio", keyword: "Pemeriksaan Hepatitis C", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "HBsAg", label: "HBsAg Non Reaktif" },
      { type: "radio", keyword: "Anti-HCV", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "Anti HCV", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "hepatitis b", label: "HBsAg Non Reaktif" },
      { type: "radio", keyword: "hepatitis c", label: "Anti HCV Non Reaktif" },
      { type: "radio", keyword: "hepatitis", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan HBsAg", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan Anti-HCV", label: "Non Reaktif" },
      { type: "dropdown", keyword: "HBsAg", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Anti-HCV", label: "Non Reaktif" },
      { type: "radio", keyword: "Apakah dilakukan Pemeriksaan Hepatitis", label: "Ya" },
      { type: "radio", keyword: "Riwayat Hepatitis", label: "Tidak" },
      { type: "radio", keyword: "orang dengan HIV", label: "Tidak" },
      { type: "radio", keyword: "ODHIV", label: "Tidak" },
      { type: "radio", keyword: "transfusi darah", label: "Tidak" },
      { type: "radio", keyword: "cuci darah", label: "Tidak" },
      { type: "radio", keyword: "hemodialisis", label: "Tidak" },
      { type: "radio", keyword: "bahan adiktif lainnya dengan cara disuntik", label: "Tidak" },
      { type: "radio", keyword: "seksual berisiko", label: "Tidak" }
    ],
    hideUI: true,
    default: "non-reaktif"
  },
  {
    id: "hati",
    label: "Hati",
    rules: [
      { type: "radio", keyword: "tes untuk Hepatitis B", label: "Tidak" },
      { type: "radio", keyword: "menderita Hepatitis B", label: "Tidak" },
      { type: "radio", keyword: "ibu kandung/saudara sekandung yang menderita Hepatitis B", label: "Tidak" },
      { type: "radio", keyword: "seksual berisiko", label: "Tidak" },
      { type: "radio", keyword: "bukan pasangan suami/istri", label: "Tidak" },
      { type: "radio", keyword: "transfusi darah", label: "Tidak" },
      { type: "radio", keyword: "cuci darah", label: "Tidak" },
      { type: "radio", keyword: "hemodialisis", label: "Tidak" },
      { type: "radio", keyword: "narkoba", label: "Tidak" },
      { type: "radio", keyword: "bahan adiktif lainnya dengan cara disuntik", label: "Tidak" },
      { type: "radio", keyword: "orang dengan HIV", label: "Tidak" },
      { type: "radio", keyword: "ODHIV", label: "Tidak" },
      { type: "radio", keyword: "pengobatan Hepatitis C", label: "Tidak" },
      { type: "radio", keyword: "kolesterol (lemak darah) tinggi", label: "Tidak" },
      { type: "radio", keyword: "lemak darah", label: "Tidak" },
      { type: "radio", keyword: "Hati", label: "Tidak" }
    ],
    hideUI: true,
    default: "tidak"
  },
  {
    id: "hiv",
    label: "Pemeriksaan HIV",
    rules: [
      { type: "radio", keyword: "Hasil Pemeriksaan Rapid Test HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "Hasil Rapid Test HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "Hasil R2 HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "Hasil R3 HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "Rapid Test HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "Rapid HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "R2 HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "R3 HIV", label: "Non Reaktif" },
      { type: "radio", keyword: "HIV", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan HIV", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Pemeriksaan HIV", label: "Non Reaktif" }
    ],
    hideUI: true,
    default: "non-reaktif"
  },
  {
    id: "sifilis",
    label: "Pemeriksaan Sifilis",
    rules: [
      { type: "radio", keyword: "Hasil Pemeriksaan Rapid Test Sifilis", label: "Non Reaktif" },
      { type: "radio", keyword: "Hasil Rapid Test Sifilis", label: "Non Reaktif" },
      { type: "radio", keyword: "Rapid Test Sifilis", label: "Non Reaktif" },
      { type: "radio", keyword: "Pemeriksaan Sifilis", label: "Non Reaktif" },
      { type: "radio", keyword: "TP Rapid", label: "Non Reaktif" },
      { type: "radio", keyword: "Treponema", label: "Non Reaktif" },
      { type: "radio", keyword: "Sifilis", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Hasil Pemeriksaan Sifilis", label: "Non Reaktif" },
      { type: "dropdown", keyword: "Pemeriksaan Sifilis", label: "Non Reaktif" }
    ],
    hideUI: true,
    default: "non-reaktif"
  },

  {
    id: "fibrosis-hati",
    label: "Pemeriksaan Fibrosis/Sirosis Hati",
    rules: [
      { type: "radio", keyword: "Fibrosis", label: "F0 - F1" },
      { type: "dropdown", keyword: "Fibrosis", label: "F0 - F1" },
      { type: "radio", keyword: "Sirosis", label: "Tidak ada sirosis" },
      { type: "dropdown", keyword: "Sirosis", label: "Tidak ada sirosis" },
      { type: "radio", keyword: "APRI", label: "< 0.5" },
      { type: "dropdown", keyword: "APRI", label: "< 0.5" },
      { type: "dropdown", keyword: "Derajat Fibrosis", label: "F0 - F1" }
    ],
    hideUI: true,
    default: "f0-f1"
  },

  // 18. Bayi, Balita, dan Anak Sekolah
  {
    id: "anak-sekolah",
    label: "Pemeriksaan Anak Sekolah & Remaja",
    rules: [
      { type: "input", keyword: "berapa hari Anda aktif secara fisik", value: 3 },
      { type: "input", keyword: "biasanya dalam satu minggu", value: 3 },
      { type: "radio", keyword: "Skrining Telinga dan Mata", label: "Normal" },
      { type: "radio", keyword: "telinga dan mata", label: "Normal" },
      { type: "radio", keyword: "infeksi telinga", label: "Tidak ada infeksi telinga" },
      { type: "dropdown", keyword: "infeksi telinga", label: "Tidak ada infeksi telinga" },
      { type: "radio", keyword: "serumen impaksi", label: "Tidak ada serumen impaksi" },
      { type: "radio", keyword: "tajam pendengaran", label: "Normal" },
      { type: "radio", keyword: "tajam penglihatan", label: "Normal (visus 6/6 - 6/12)" },
      { type: "radio", keyword: "visus", label: "Normal" },
      { type: "radio", keyword: "kelainan mata", label: "Normal" },
      { type: "radio", keyword: "buta warna", label: "Tidak buta warna" },
      { type: "radio", keyword: "berat badan meskipun nafsu makan meningkat", label: "Tidak" },
      { type: "dropdown", keyword: "anak pernah memperoleh imunisasi polio tetes", label: "Ya" },
      { type: "dropdown", keyword: "anak pernah memperoleh imunisasi saat usia 0 sd 24 bulan", label: "Ya" },
      { type: "dropdown", keyword: "memiliki dan membawa catatan imunisasi anak", label: "Ya" },
      { type: "dropdown", keyword: "buku kia", label: "Ya" },
      { type: "dropdown", keyword: "buku kms", label: "Ya" },
      { type: "dropdown", keyword: "asi eksklusif", label: "Ya" },
      { type: "radio", keyword: "ditemukan selaput mata merah atau kornea keruh", label: "Normal" },
      { type: "radio", keyword: "nafsu makan turun", label: "Tidak" },
      { type: "radio", keyword: "status imunisasi", label: "Sudah imunisasi" },
      { type: "dropdown", keyword: "status imunisasi", label: "Sudah imunisasi" },
      { type: "dropdown", keyword: "perkembangan anak", label: "Sesuai" },
      { type: "dropdown", keyword: "sdidtk", label: "Sesuai" },
      { type: "radio", keyword: "tanda bahaya", label: "Tidak" },
      { type: "dropdown", keyword: "tanda bahaya", label: "Tidak ada" },
      { type: "radio", keyword: "mendapatkan imunisasi HPV", label: "Sudah" },
      { type: "dropdown", keyword: "kebugaran jasmani", label: "Baik" }
    ],
    hideUI: true
  },
  {
    id: "menstruasi",
    label: "Menstruasi",
    rules: [
      { type: "radio", keyword: "sudah mengalami menstruasi", labelFrom: "option" },
      { type: "radio", keyword: "usia berapa Anda mengalami menstruasi pertama", label: "8 tahun -16 tahun" }
    ],
    default: "tidak",
    options: [
      { label: "Ya", value: "ya" },
      { label: "Tidak", value: "tidak" }
    ],
    required: true,
    showWhen: { pageData: { kategori: ["remaja", "sd", "smp", "sma"], jenisKelamin: "perempuan" } }
  },
  {
    id: "kebugaran",
    label: "Kebugaran Jasmani",
    rules: [
      { type: "dropdown", keyword: "hasil pemeriksaan kebugaran jasmani anak", labelFrom: "option" },
      { type: "dropdown", keyword: "kebugaran", labelFrom: "option" }
    ],
    default: "baik",
    options: [
      { label: "Baik Sekali", value: "baik-sekali" },
      { label: "Baik", value: "baik" },
      { label: "Cukup", value: "cukup" },
      { label: "Kurang", value: "kurang" },
      { label: "Kurang Sekali", value: "kurang-sekali" }
    ],
    required: true,
    showWhen: { pageData: { kategori: ["remaja", "sd", "smp", "sma"] } }
  }
];

export function isFieldVisible(field, values, pageData) {
  if (field.hideUI) return false;
  const condition = field.showWhen;
  if (!condition) return true;

  if (condition.notPageData) {
    const isExcluded = Object.entries(condition.notPageData).some(([key, val]) => {
      const arr = Array.isArray(val) ? val : [val];
      const pageVal = (pageData[key] ?? "").toLowerCase();
      return arr.some(v => pageVal.includes(v.toLowerCase()));
    });
    if (isExcluded) return false;
  }

  if (condition.field) {
    const currentVal = values.get(condition.field) ?? "";
    return condition.in.includes(currentVal);
  }

  if (condition.pageData) {
    return Object.entries(condition.pageData).every(([key, val]) => {
      const arr = Array.isArray(val) ? val : [val];
      const pageVal = (pageData[key] ?? "").toLowerCase();
      return arr.some(v => pageVal.includes(v.toLowerCase()));
    });
  }

  return true;
}

export function buildFieldRules(valuesMap, pageData, config = FIELD_CONFIG) {
  const values = new Map(valuesMap);

  // Jalankan autoValue
  for (const field of config) {
    if (!field.autoValue) continue;
    const { field: targetField, in: targetVals, value: assignedVal } = field.autoValue;
    if (targetVals.includes(values.get(targetField) ?? "")) {
      values.set(field.id, assignedVal);
    } else {
      values.set(field.id, field.default ?? "");
    }
  }

  // Terapkan default jika belum ada
  for (const field of config) {
    if (!values.has(field.id) && field.default !== undefined && field.default !== null) {
      values.set(field.id, field.default);
    }
  }

  const rules = [];
  for (const field of config) {
    const currentVal = values.get(field.id) ?? "";
    for (const rule of field.rules ?? []) {
      if (rule.label) {
        rules.push({ keyword: rule.keyword, type: rule.type, label: rule.label });
      } else if (rule.labelFrom === "option" && currentVal) {
        const opt = field.options?.find(o => o.value === currentVal);
        if (opt) rules.push({ keyword: rule.keyword, type: rule.type, label: opt.label });
      } else if (rule.labelMap && currentVal && rule.labelMap[currentVal]) {
        rules.push({ keyword: rule.keyword, type: rule.type, label: rule.labelMap[currentVal] });
      } else if (rule.valueFrom === "field" && currentVal) {
        rules.push({ keyword: rule.keyword, type: rule.type, value: currentVal });
      } else if (rule.value !== undefined) {
        rules.push({ keyword: rule.keyword, type: rule.type, value: rule.value });
      }
    }
  }

  return rules;
}
