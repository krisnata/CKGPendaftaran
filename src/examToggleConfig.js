// Katalog & Konfigurasi On/Off Pemeriksaan Berdasarkan Siklus Hidup (Pelayanan Nakes Saja)
// PENTING: Skrining Mandiri WAJIB 100% di portal SATUSEHAT CKG dan TIDAK dimasukkan ke katalog setting ON/OFF.
import { calculateAge } from "./lifecycle-rules.js";

export const LIFECYCLE_LABELS = {
  bayi: "Bayi Baru Lahir (< 1 Tahun)",
  balita: "Balita (1 - 4 Tahun)",
  prasekolah: "Pra-Sekolah (5 - 6 Tahun)",
  sekolah: "Usia Sekolah (7 - 12 Tahun)",
  remaja: "Remaja (13 - 17 Tahun)",
  dewasa: "Dewasa (18 - 59 Tahun)",
  lansia: "Lansia (≥ 60 Tahun)"
};

export const EXAM_CATALOG_BY_LIFECYCLE = {
  bayi: [
    {
      id: "nakes_antropometri_bb",
      title: "Pertumbuhan (Berat Badan & Panjang Badan)",
      source: "nakes",
      matchKeywords: ["berat badan", "antropometri", "pertumbuhan", "gizi", "panjang badan"],
      uncheckKeywords: ["berat badan", "gizi"],
      defaultEnabled: true
    },
    {
      id: "nakes_shk",
      title: "Skrining Hipotiroid Kongenital (SHK)",
      source: "nakes",
      matchKeywords: ["hipotiroid kongenital", "shk"],
      uncheckKeywords: ["hipotiroid kongenital"],
      defaultEnabled: true
    },
    {
      id: "nakes_shk_pak",
      title: "Skrining Hiperplasia Adrenal Kongenital (S-HAK)",
      source: "nakes",
      matchKeywords: ["hiperplasia adrenal", "s-hak", "shak"],
      uncheckKeywords: ["hiperplasia adrenal"],
      defaultEnabled: true
    },
    {
      id: "nakes_g6pd",
      title: "Skrining Defisiensi Enzim G6PD",
      source: "nakes",
      matchKeywords: ["g6pd", "defisiensi enzim"],
      uncheckKeywords: ["g6pd"],
      defaultEnabled: true
    },
    {
      id: "nakes_pjb_kritis",
      title: "Penyakit Jantung Bawaan (PJB) Kritis",
      source: "nakes",
      matchKeywords: ["jantung bawaan", "pjb kritis", "saturasi oksigen"],
      uncheckKeywords: ["jantung bawaan"],
      defaultEnabled: true
    },
    {
      id: "nakes_ikterus_empedu",
      title: "Skrining Kelainan Saluran Empedu / Ikterus",
      source: "nakes",
      matchKeywords: ["saluran empedu", "atresia bilier", "ikterus"],
      uncheckKeywords: ["saluran empedu"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_bayi",
      title: "Verifikasi Status Imunisasi Bayi (HB0, BCG, Polio)",
      group: "Imunisasi",
      description: "Pencatatan kelengkapan imunisasi awal bayi baru lahir",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["imunisasi", "hb0", "bcg", "polio"],
      uncheckKeywords: ["imunisasi"],
      defaultEnabled: true
    }
  ],

  balita: [
    {
      id: "nakes_antropometri_bb_tb",
      title: "Antropometri (Berat Badan & Tinggi Badan)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "panjang badan", "antropometri", "gizi"],
      uncheckKeywords: ["berat badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_lingkar_kepala_lila",
      title: "Lingkar Kepala & LILA",
      source: "nakes",
      matchKeywords: ["lingkar kepala", "lila", "lingkar lengan"],
      uncheckKeywords: ["lingkar kepala", "lila"],
      defaultEnabled: true
    },
    {
      id: "nakes_perkembangan",
      title: "Pemeriksaan Perkembangan Balita (SDIDTK / KPSP)",
      source: "nakes",
      matchKeywords: ["perkembangan", "sdidtk", "kpsp"],
      uncheckKeywords: ["perkembangan"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga",
      title: "Pemeriksaan Telinga / Pendengaran",
      source: "nakes",
      matchKeywords: ["telinga", "pendengaran", "tes daya dengar"],
      uncheckKeywords: ["telinga", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata",
      title: "Pemeriksaan Mata / Penglihatan (Pupil Putih)",
      source: "nakes",
      matchKeywords: ["mata", "penglihatan", "pupil putih"],
      uncheckKeywords: ["mata", "penglihatan"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi",
      title: "Pemeriksaan Gigi & Mulut",
      source: "nakes",
      matchKeywords: ["gigi", "karies"],
      uncheckKeywords: ["gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS) / Gula Darah Anak",
      source: "nakes",
      matchKeywords: ["gula darah", "diabetes", "glukosa", "gds", "gula darah anak", "dm", "faktor risiko diabetes"],
      uncheckKeywords: ["gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Tuberkulosis (Nakes Balita)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc", "kontak tb"],
      uncheckKeywords: ["tuberkulosis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_talasemia",
      title: "Hemoglobin & Skrining Talasemia",
      source: "nakes",
      matchKeywords: ["hemoglobin", "talasemia", "anemia"],
      uncheckKeywords: ["talasemia", "hemoglobin"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria (Daerah Endemis)",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    },
    {
      id: "nakes_mchat_autis",
      title: "Skrining Autisme (M-CHAT-R) & GPPH",
      group: "Tumbuh Kembang & Skrining Balita / Bayi",
      description: "Deteksi dini spektrum autisme dan pemusatan perhatian anak",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["m-chat", "mchat", "autis", "gpph"],
      uncheckKeywords: ["m-chat", "autis", "gpph"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_rutin",
      title: "Kelengkapan Imunisasi Dasar & Baduta",
      group: "Imunisasi",
      description: "Pemeriksaan status imunisasi dasar lengkap & booster",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["imunisasi", "status imunisasi"],
      uncheckKeywords: ["imunisasi"],
      defaultEnabled: true
    }
  ],

  prasekolah: [
    {
      id: "nakes_antropometri_bb_tb",
      title: "Antropometri (Berat Badan & Tinggi Badan)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "pertumbuhan", "gizi", "antropometri"],
      uncheckKeywords: ["berat badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_perkembangan",
      title: "Pemeriksaan Perkembangan Prasekolah",
      source: "nakes",
      matchKeywords: ["perkembangan", "sdidtk"],
      uncheckKeywords: ["perkembangan"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga",
      title: "Pemeriksaan Telinga / Pendengaran",
      source: "nakes",
      matchKeywords: ["telinga", "pendengaran"],
      uncheckKeywords: ["telinga", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata",
      title: "Pemeriksaan Mata / Penglihatan (Visus)",
      source: "nakes",
      matchKeywords: ["mata", "penglihatan", "visus"],
      uncheckKeywords: ["mata", "penglihatan"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi",
      title: "Pemeriksaan Gigi & Mulut",
      source: "nakes",
      matchKeywords: ["gigi", "karies"],
      uncheckKeywords: ["gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS) / Gula Darah Anak",
      source: "nakes",
      matchKeywords: ["gula darah", "diabetes", "glukosa", "gds", "gula darah anak", "dm", "faktor risiko diabetes"],
      uncheckKeywords: ["gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Tuberkulosis (Nakes Prasekolah)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc"],
      uncheckKeywords: ["tuberkulosis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_talasemia",
      title: "Hemoglobin & Skrining Talasemia",
      source: "nakes",
      matchKeywords: ["hemoglobin", "talasemia", "anemia"],
      uncheckKeywords: ["talasemia", "hemoglobin"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    }
  ],

  sekolah: [
    {
      id: "nakes_antropometri_imt",
      title: "Antropometri (Berat Badan & Tinggi Badan / IMT)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "antropometri", "imt", "gizi"],
      uncheckKeywords: ["berat badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_tekanan_darah",
      title: "Tekanan Darah",
      source: "nakes",
      matchKeywords: ["tekanan darah", "hipertensi", "tensi"],
      uncheckKeywords: ["tekanan darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_visus",
      title: "Pemeriksaan Tajam Penglihatan (Visus)",
      source: "nakes",
      matchKeywords: ["tajam penglihatan", "visus", "penglihatan mata"],
      uncheckKeywords: ["tajam penglihatan", "visus"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_buta_warna",
      title: "Pemeriksaan Buta Warna",
      source: "nakes",
      matchKeywords: ["buta warna"],
      uncheckKeywords: ["buta warna"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga",
      title: "Pemeriksaan Telinga & Tajam Pendengaran",
      source: "nakes",
      matchKeywords: ["telinga", "pendengaran", "serumen", "tajam pendengaran"],
      uncheckKeywords: ["telinga", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi",
      title: "Pemeriksaan Gigi & Mulut (Karies)",
      source: "nakes",
      matchKeywords: ["gigi", "karies"],
      uncheckKeywords: ["gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_kebugaran",
      title: "Pemeriksaan Kebugaran Jasmani",
      source: "nakes",
      matchKeywords: ["kebugaran"],
      uncheckKeywords: ["kebugaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS Anak)",
      source: "nakes",
      matchKeywords: ["gula darah", "diabetes", "glukosa", "gds", "gula darah anak", "dm", "faktor risiko diabetes"],
      uncheckKeywords: ["gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_anemia",
      title: "Hemoglobin (Skrining Anemia)",
      source: "nakes",
      matchKeywords: ["hemoglobin", "anemia"],
      uncheckKeywords: ["hemoglobin", "anemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_talasemia",
      title: "Pemeriksaan Lab Talasemia",
      source: "nakes",
      matchKeywords: ["talasemia"],
      uncheckKeywords: ["talasemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Tuberkulosis (Nakes Sekolah)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc"],
      uncheckKeywords: ["tuberkulosis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_b",
      title: "Rapid Test Hepatitis B (HBsAg)",
      source: "nakes",
      matchKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      uncheckKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_c",
      title: "Rapid Test Hepatitis C (Anti-HCV)",
      source: "nakes",
      matchKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      uncheckKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    },
    {
      id: "nakes_jiwa_sdq",
      title: "Kesehatan Jiwa Anak Sekolah (Kuesioner SDQ)",
      group: "Kesehatan Jiwa & Kebugaran",
      description: "Strengths and Difficulties Questionnaire (emosi & perilaku anak)",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kesehatan jiwa", "sdq", "emosi", "perilaku"],
      uncheckKeywords: ["kesehatan jiwa", "sdq"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_bias",
      title: "Status Imunisasi Anak Sekolah (BIAS: Campak/MR, DT, Td, HPV)",
      group: "Imunisasi",
      description: "Riwayat Bulan Imunisasi Anak Sekolah & HPV putri kelas 5-6",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["imunisasi", "bias", "td", "dt", "mr"],
      uncheckKeywords: ["imunisasi", "bias"],
      defaultEnabled: true
    }
  ],

  remaja: [
    {
      id: "nakes_antropometri_imt",
      title: "Antropometri (Berat Badan & Tinggi Badan / IMT)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "antropometri", "imt", "gizi"],
      uncheckKeywords: ["berat badan", "tinggi\u5355badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_tekanan_darah",
      title: "Tekanan Darah",
      source: "nakes",
      matchKeywords: ["tekanan darah", "hipertensi", "tensi"],
      uncheckKeywords: ["tekanan darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_visus",
      title: "Pemeriksaan Tajam Penglihatan (Visus)",
      source: "nakes",
      matchKeywords: ["tajam penglihatan", "visus", "penglihatan mata"],
      uncheckKeywords: ["tajam penglihatan", "visus"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_buta_warna",
      title: "Pemeriksaan Buta Warna",
      source: "nakes",
      matchKeywords: ["buta warna"],
      uncheckKeywords: ["buta warna"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga",
      title: "Pemeriksaan Telinga & Pendengaran",
      source: "nakes",
      matchKeywords: ["telinga", "pendengaran", "serumen", "tajam pendengaran"],
      uncheckKeywords: ["telinga", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi",
      title: "Pemeriksaan Gigi & Mulut (Karies)",
      source: "nakes",
      matchKeywords: ["gigi", "karies"],
      uncheckKeywords: ["gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_kebugaran",
      title: "Pemeriksaan Kebugaran Jasmani",
      source: "nakes",
      matchKeywords: ["kebugaran"],
      uncheckKeywords: ["kebugaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_anemia",
      title: "Hemoglobin (Skrining Anemia Remaja)",
      source: "nakes",
      matchKeywords: ["hemoglobin", "anemia"],
      uncheckKeywords: ["hemoglobin", "anemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS Remaja)",
      source: "nakes",
      matchKeywords: ["gula darah", "diabetes", "glukosa", "gds", "gula darah remaja", "gula darah anak", "dm", "faktor risiko diabetes"],
      uncheckKeywords: ["gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_talasemia",
      title: "Pemeriksaan Lab Talasemia",
      source: "nakes",
      matchKeywords: ["talasemia"],
      uncheckKeywords: ["talasemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Tuberkulosis (Nakes Remaja)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc"],
      uncheckKeywords: ["tuberkulosis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_b",
      title: "Rapid Test Hepatitis B (HBsAg)",
      source: "nakes",
      matchKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      uncheckKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_c",
      title: "Rapid Test Hepatitis C (Anti-HCV)",
      source: "nakes",
      matchKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      uncheckKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    },
    {
      id: "nakes_kadar_co",
      title: "Pengukuran Kadar CO Pernapasan (Smokerlyzer Remaja)",
      group: "Paru & Pernapasan",
      description: "Uji karbon monoksida paru bagi remaja terpapar rokok",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kadar co", "co pernapasan", "smokerlyzer", "merokok"],
      uncheckKeywords: ["kadar co", "co pernapasan"],
      defaultEnabled: true
    },
    {
      id: "nakes_jiwa_remaja",
      title: "Kesehatan Jiwa Remaja (SDQ / PHQ-9 / GAD-7)",
      group: "Kesehatan Jiwa & Kebugaran",
      description: "Skrining kecemasan, depresi, dan kesehatan mental remaja",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kesehatan jiwa", "sdq", "phq", "gad", "cemas", "depresi"],
      uncheckKeywords: ["kesehatan jiwa", "sdq"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_hpv",
      title: "Verifikasi Imunisasi HPV & Tetanus (Remaja Putri)",
      group: "Imunisasi",
      description: "Pencatatan riwayat vaksinasi HPV remaja putri",
      gender: "perempuan",
      source: "nakes",
      matchKeywords: ["imunisasi", "hpv", "tetanus"],
      uncheckKeywords: ["imunisasi"],
      defaultEnabled: true
    }
  ],

  dewasa: [
    {
      id: "nakes_antropometri_bb_tb",
      title: "Antropometri (Berat Badan & Tinggi Badan / IMT)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "antropometri", "imt", "status gizi"],
      uncheckKeywords: ["berat badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_lingkar_perut",
      title: "Lingkar Perut (Risiko Obesitas Sentral)",
      source: "nakes",
      matchKeywords: ["lingkar perut"],
      uncheckKeywords: ["lingkar perut"],
      defaultEnabled: true
    },
    {
      id: "nakes_tekanan_darah",
      title: "Tekanan Darah (Hipertensi)",
      source: "nakes",
      matchKeywords: ["tekanan darah", "hipertensi", "tensi", "sistol", "diastol"],
      uncheckKeywords: ["tekanan darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS)",
      source: "nakes",
      matchKeywords: ["gula darah sewaktu", "gds", "skrining gula darah", "pemeriksaan gula darah", "gula darah", "glukosa", "diabetes"],
      uncheckKeywords: ["gula darah sewaktu", "gds", "skrining gula darah", "pemeriksaan gula darah", "gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_gdp_hba1c",
      title: "Gula Darah Puasa (GDP) & HbA1c",
      source: "nakes",
      matchKeywords: ["gula darah puasa", "gdp", "hba1c", "gula darah 2 jam pp"],
      uncheckKeywords: ["gula darah puasa", "gdp", "hba1c"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_visus",
      title: "Skrining Tajam Penglihatan (Visus)",
      source: "nakes",
      matchKeywords: ["tajam penglihatan", "visus", "penglihatan mata", "skrining penglihatan", "pemeriksaan mata", "kesehatan mata", "indera penglihatan", "mata", "penglihatan"],
      uncheckKeywords: ["tajam penglihatan", "visus", "pemeriksaan mata", "kesehatan mata", "skrining penglihatan", "penglihatan"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_katarak",
      title: "Pemeriksaan Pupil & Curiga Katarak",
      source: "nakes",
      matchKeywords: ["katarak", "pemeriksaan pupil", "pupil", "kekeruhan lensa"],
      uncheckKeywords: ["katarak", "pemeriksaan pupil"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga_serumen",
      title: "Pemeriksaan Telinga Luar (Serumen & Infeksi)",
      source: "nakes",
      matchKeywords: ["serumen", "infeksi telinga", "telinga luar", "pemeriksaan telinga", "kesehatan telinga", "indera pendengaran", "telinga"],
      uncheckKeywords: ["serumen", "infeksi telinga", "pemeriksaan telinga", "telinga"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga_pendengaran",
      title: "Skrining Tajam Pendengaran (Tes Bisik)",
      source: "nakes",
      matchKeywords: ["tajam pendengaran", "gangguan pendengaran", "tes bisik", "pemeriksaan pendengaran", "skrining pendengaran", "pendengaran"],
      uncheckKeywords: ["tajam pendengaran", "gangguan pendengaran", "pemeriksaan pendengaran", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi_karies",
      title: "Kesehatan Gigi (Karies Gigi / Gigi Berlubang)",
      source: "nakes",
      matchKeywords: ["karies gigi", "gigi berlubang", "jumlah gigi karies", "karies", "pemeriksaan gigi", "kesehatan gigi", "gigi dan mulut", "gigi"],
      uncheckKeywords: ["karies", "pemeriksaan gigi", "kesehatan gigi", "gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi_periodontal",
      title: "Jaringan Periodontal & Gigi Goyang",
      source: "nakes",
      matchKeywords: ["periodontal", "gigi goyang", "gusi berdarah", "karang gigi"],
      uncheckKeywords: ["periodontal", "gigi goyang"],
      defaultEnabled: true
    },
    {
      id: "nakes_sadanis",
      title: "Kanker Payudara (SADANIS)",
      source: "nakes",
      matchKeywords: ["payudara", "sadanis", "kanker payudara"],
      uncheckKeywords: ["payudara", "sadanis"],
      defaultEnabled: true
    },
    {
      id: "nakes_leher_rahim",
      title: "Kanker Leher Rahim (IVA & HPV DNA)",
      source: "nakes",
      matchKeywords: ["kanker leher rahim", "leher rahim", "hpv", "iva", "inspekulo", "serviks", "kanker serviks"],
      uncheckKeywords: ["kanker leher rahim", "leher rahim", "hpv", "iva", "serviks"],
      defaultEnabled: true
    },
    {
      id: "nakes_kanker_usus",
      title: "Kanker Usus (Colok Dubur & Darah Samar)",
      source: "nakes",
      matchKeywords: ["kanker usus", "colok dubur", "darah samar", "kolorektal", "kanker kolorektal"],
      uncheckKeywords: ["kanker usus", "colok dubur", "darah samar", "kolorektal"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Skrining Tuberkulosis (TBC Nakes)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc", "bta", "tcm", "skrining tb", "pemeriksaan tb"],
      uncheckKeywords: ["tuberkulosis", "tbc", "skrining tb", "pemeriksaan tb"],
      defaultEnabled: true
    },
    {
      id: "nakes_ppok_puma",
      title: "PPOK - Skrining Kuesioner PUMA",
      source: "nakes",
      matchKeywords: ["skrining puma", "skor puma", "puma", "kuesioner puma", "ppok", "skrining ppok", "pemeriksaan ppok", "paru obstruktif"],
      uncheckKeywords: ["puma", "skor puma", "ppok", "paru obstruktif"],
      defaultEnabled: true
    },
    {
      id: "nakes_ppok_spirometri",
      title: "PPOK - Pemeriksaan Spirometri / Peak Flow",
      source: "nakes",
      matchKeywords: ["spirometri", "peak flow", "fungsi paru"],
      uncheckKeywords: ["spirometri", "peak flow", "fungsi paru"],
      defaultEnabled: true
    },
    {
      id: "nakes_kadar_co",
      title: "Pengukuran Kadar CO Pernapasan (Smokerlyzer)",
      source: "nakes",
      matchKeywords: ["kadar co", "co pernapasan", "smokerlyzer"],
      uncheckKeywords: ["kadar co"],
      defaultEnabled: true
    },
    {
      id: "nakes_profil_lipid",
      title: "Profil Lipid (Kolesterol, Trigliserida, HDL, LDL)",
      source: "nakes",
      matchKeywords: ["profil lipid", "kolesterol", "trigliserida", "hdl", "ldl"],
      uncheckKeywords: ["profil lipid", "kolesterol"],
      defaultEnabled: true
    },
    {
      id: "nakes_jantung_ekg",
      title: "Rekam Jantung (EKG)",
      source: "nakes",
      matchKeywords: ["ekg", "rekam jantung", "jantung"],
      uncheckKeywords: ["ekg", "rekam jantung"],
      defaultEnabled: true
    },
    {
      id: "nakes_ginjal",
      title: "Fungsi Ginjal (Ureum, Kreatinin, e-LFG)",
      source: "nakes",
      matchKeywords: ["fungsi ginjal", "ureum", "kreatinin", "e-lfg", "elfg", "egfr"],
      uncheckKeywords: ["fungsi ginjal", "ureum", "kreatinin"],
      defaultEnabled: true
    },
    {
      id: "nakes_protein_urin",
      title: "Protein Urin / Albuminuria (Urinalisis)",
      source: "nakes",
      matchKeywords: ["protein urin", "albuminuria", "uacr", "urinalisis"],
      uncheckKeywords: ["protein urin", "albuminuria"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_b",
      title: "Rapid Test Hepatitis B (HBsAg)",
      source: "nakes",
      matchKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      uncheckKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_c",
      title: "Rapid Test Hepatitis C (Anti-HCV)",
      source: "nakes",
      matchKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      uncheckKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      defaultEnabled: true
    },
    {
      id: "nakes_fibrosis_sirosis",
      title: "Fibrosis & Sirosis Hati (APRI Score)",
      source: "nakes",
      matchKeywords: ["fibrosis", "sirosis", "apri", "sgot", "sgpt"],
      uncheckKeywords: ["fibrosis", "sirosis", "apri"],
      defaultEnabled: true
    },
    {
      id: "nakes_hiv",
      title: "Rapid Test HIV",
      source: "nakes",
      matchKeywords: ["rapid test hiv", "hiv"],
      uncheckKeywords: ["rapid test hiv", "hiv"],
      defaultEnabled: true
    },
    {
      id: "nakes_sifilis",
      title: "Rapid Test Sifilis",
      source: "nakes",
      matchKeywords: ["rapid test sifilis", "sifilis", "treponema"],
      uncheckKeywords: ["rapid test sifilis", "sifilis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_anemia",
      title: "Pemeriksaan Hemoglobin (Hb / Anemia)",
      source: "nakes",
      matchKeywords: ["hemoglobin", "anemia", "kadar hb"],
      uncheckKeywords: ["hemoglobin", "anemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_talasemia",
      title: "Skrining Talasemia",
      source: "nakes",
      matchKeywords: ["talasemia"],
      uncheckKeywords: ["talasemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    },
    {
      id: "nakes_kusta",
      title: "Pemeriksaan Penyakit Kusta",
      source: "nakes",
      matchKeywords: ["kusta", "lepra"],
      uncheckKeywords: ["kusta", "lepra"],
      defaultEnabled: true
    },
    {
      id: "nakes_frambusia",
      title: "Pemeriksaan Penyakit Frambusia",
      source: "nakes",
      matchKeywords: ["frambusia", "yaws"],
      uncheckKeywords: ["frambusia", "yaws"],
      defaultEnabled: true
    },
    {
      id: "nakes_skabies",
      title: "Pemeriksaan Penyakit Skabies",
      source: "nakes",
      matchKeywords: ["skabies", "scabies", "kudis"],
      uncheckKeywords: ["skabies", "scabies", "kudis"],
      defaultEnabled: true
    },
    {
      id: "nakes_kebugaran",
      title: "Pemeriksaan Kebugaran Jasmani",
      source: "nakes",
      matchKeywords: ["kebugaran", "rockport"],
      uncheckKeywords: ["kebugaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_kanker_paru",
      title: "Skrining Risiko Kanker Paru",
      group: "Skrining Onkologi (Kanker)",
      description: "Penilaian faktor risiko keganasan paru (usia ≥45 thn / perokok)",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kanker paru"],
      uncheckKeywords: ["kanker paru"],
      defaultEnabled: true
    },
    {
      id: "nakes_prediksi_kardiovaskular",
      title: "Prediksi Risiko Kardiovaskular (Tabel CARTA WHO)",
      group: "Jantung & Kardiovaskular",
      description: "Kalkulasi risiko serangan jantung & stroke 10 tahun ke depan",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["risiko kardiovaskular", "carta", "jantung dan pembuluh darah", "prediksi risiko"],
      uncheckKeywords: ["risiko kardiovaskular", "carta"],
      defaultEnabled: true
    },
    {
      id: "nakes_jiwa_dewasa",
      title: "Skrining Kesehatan Jiwa Dewasa (SRQ-20 / PHQ-4 / GAD)",
      group: "Kesehatan Jiwa & Kebugaran",
      description: "Deteksi masalah kesehatan mental, kecemasan, dan depresi",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kesehatan jiwa", "srq", "phq", "gad", "mental"],
      uncheckKeywords: ["kesehatan jiwa", "srq", "phq"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_tetanus_wus",
      title: "Skrining Status Imunisasi Tetanus (Status T WUS / Catin)",
      group: "Imunisasi",
      description: "Verifikasi status T1-T5 bagi Wanita Usia Subur & Calon Pengantin",
      gender: "perempuan",
      source: "nakes",
      matchKeywords: ["imunisasi tetanus", "status t", "tetanus", "imunisasi catin", "imunisasi"],
      uncheckKeywords: ["imunisasi tetanus", "status t", "imunisasi"],
      defaultEnabled: true
    }
  ],

  lansia: [
    {
      id: "nakes_antropometri_bb_tb",
      title: "Antropometri (Berat Badan & Tinggi Badan / IMT)",
      source: "nakes",
      matchKeywords: ["berat badan", "tinggi badan", "antropometri", "imt", "status gizi"],
      uncheckKeywords: ["berat badan", "tinggi badan"],
      defaultEnabled: true
    },
    {
      id: "nakes_lingkar_perut",
      title: "Lingkar Perut (Risiko Obesitas Sentral)",
      source: "nakes",
      matchKeywords: ["lingkar perut"],
      uncheckKeywords: ["lingkar perut"],
      defaultEnabled: true
    },
    {
      id: "nakes_tekanan_darah",
      title: "Tekanan Darah (Hipertensi)",
      source: "nakes",
      matchKeywords: ["tekanan darah", "hipertensi", "tensi", "sistol", "diastol"],
      uncheckKeywords: ["tekanan darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_gds",
      title: "Gula Darah Sewaktu (GDS)",
      source: "nakes",
      matchKeywords: ["gula darah sewaktu", "gds", "skrining gula darah", "pemeriksaan gula darah", "gula darah", "glukosa", "diabetes"],
      uncheckKeywords: ["gula darah sewaktu", "gds", "skrining gula darah", "pemeriksaan gula darah", "gula darah"],
      defaultEnabled: true
    },
    {
      id: "nakes_gdp_hba1c",
      title: "Gula Darah Puasa (GDP) & HbA1c",
      source: "nakes",
      matchKeywords: ["gula darah puasa", "gdp", "hba1c", "gula darah 2 jam pp"],
      uncheckKeywords: ["gula darah puasa", "gdp", "hba1c"],
      defaultEnabled: true
    },
    {
      id: "nakes_skilas_nakes",
      title: "Pemeriksaan SKILAS Lanjutan Nakes (Kognitif, Depresi, Nutrisi)",
      source: "nakes",
      matchKeywords: ["skilas", "geriatri", "lansia", "kognitif", "depresi", "nutrisi"],
      uncheckKeywords: ["skilas", "geriatri"],
      defaultEnabled: true
    },
    {
      id: "nakes_kemandirian_adl",
      title: "Tingkat Kemandirian (Barthel Index ADL)",
      source: "nakes",
      matchKeywords: ["barthel", "adl", "kemandirian", "indeks barthel"],
      uncheckKeywords: ["barthel", "adl"],
      defaultEnabled: true
    },
    {
      id: "nakes_mobilisasi_chair_stand",
      title: "Tes Mobilisasi (Chair Stand Test Lansia)",
      source: "nakes",
      matchKeywords: ["chair stand", "mobilisasi", "tes berdiri"],
      uncheckKeywords: ["chair stand", "mobilisasi"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_visus",
      title: "Skrining Tajam Penglihatan (Visus)",
      source: "nakes",
      matchKeywords: ["tajam penglihatan", "visus", "penglihatan mata", "skrining penglihatan", "pemeriksaan mata", "kesehatan mata", "indera penglihatan", "mata", "penglihatan"],
      uncheckKeywords: ["tajam penglihatan", "visus", "pemeriksaan mata", "kesehatan mata", "skrining penglihatan", "penglihatan"],
      defaultEnabled: true
    },
    {
      id: "nakes_mata_katarak",
      title: "Pemeriksaan Pupil & Curiga Katarak",
      source: "nakes",
      matchKeywords: ["katarak", "pemeriksaan pupil", "pupil", "kekeruhan lensa"],
      uncheckKeywords: ["katarak", "pemeriksaan pupil"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga_serumen",
      title: "Pemeriksaan Telinga Luar (Serumen & Infeksi)",
      source: "nakes",
      matchKeywords: ["serumen", "infeksi telinga", "telinga luar", "pemeriksaan telinga", "kesehatan telinga", "indera pendengaran", "telinga"],
      uncheckKeywords: ["serumen", "infeksi telinga", "pemeriksaan telinga", "telinga"],
      defaultEnabled: true
    },
    {
      id: "nakes_telinga_pendengaran",
      title: "Skrining Tajam Pendengaran (Presbikusis / Tes Bisik)",
      source: "nakes",
      matchKeywords: ["tajam pendengaran", "gangguan pendengaran", "presbikusis", "tes bisik", "pemeriksaan pendengaran", "skrining pendengaran", "pendengaran"],
      uncheckKeywords: ["tajam pendengaran", "gangguan pendengaran", "presbikusis", "pemeriksaan pendengaran", "pendengaran"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi_karies",
      title: "Kesehatan Gigi (Karies Gigi / Gigi Berlubang)",
      source: "nakes",
      matchKeywords: ["karies gigi", "gigi berlubang", "jumlah gigi karies", "karies", "pemeriksaan gigi", "kesehatan gigi", "gigi dan mulut", "gigi"],
      uncheckKeywords: ["karies", "pemeriksaan gigi", "kesehatan gigi", "gigi"],
      defaultEnabled: true
    },
    {
      id: "nakes_gigi_periodontal",
      title: "Jaringan Periodontal & Gigi Tiruan",
      source: "nakes",
      matchKeywords: ["periodontal", "gigi tiruan", "gigi goyang", "gusi berdarah"],
      uncheckKeywords: ["periodontal", "gigi tiruan"],
      defaultEnabled: true
    },
    {
      id: "nakes_sadanis",
      title: "Kanker Payudara (SADANIS)",
      source: "nakes",
      matchKeywords: ["payudara", "sadanis", "kanker payudara"],
      uncheckKeywords: ["payudara", "sadanis"],
      defaultEnabled: true
    },
    {
      id: "nakes_kanker_usus",
      title: "Kanker Usus (Colok Dubur & Darah Samar)",
      source: "nakes",
      matchKeywords: ["kanker usus", "colok dubur", "darah samar", "kolorektal", "kanker kolorektal"],
      uncheckKeywords: ["kanker usus", "colok dubur", "darah samar", "kolorektal"],
      defaultEnabled: true
    },
    {
      id: "nakes_tb",
      title: "Skrining Tuberkulosis (TBC Lansia)",
      source: "nakes",
      matchKeywords: ["tuberkulosis", "tbc", "skrining tb", "pemeriksaan tb"],
      uncheckKeywords: ["tuberkulosis", "tbc", "skrining tb", "pemeriksaan tb"],
      defaultEnabled: true
    },
    {
      id: "nakes_ppok_puma",
      title: "PPOK - Skrining Kuesioner PUMA",
      source: "nakes",
      matchKeywords: ["skrining puma", "skor puma", "puma", "kuesioner puma", "ppok", "skrining ppok", "pemeriksaan ppok", "paru obstruktif"],
      uncheckKeywords: ["puma", "skor puma", "ppok", "paru obstruktif"],
      defaultEnabled: true
    },
    {
      id: "nakes_ppok_spirometri",
      title: "PPOK - Pemeriksaan Spirometri / Peak Flow",
      source: "nakes",
      matchKeywords: ["spirometri", "peak flow", "fungsi paru"],
      uncheckKeywords: ["spirometri", "peak flow", "fungsi paru"],
      defaultEnabled: true
    },
    {
      id: "nakes_kadar_co",
      title: "Pengukuran Kadar CO Pernapasan (Smokerlyzer)",
      source: "nakes",
      matchKeywords: ["kadar co", "co pernapasan", "smokerlyzer"],
      uncheckKeywords: ["kadar co"],
      defaultEnabled: true
    },
    {
      id: "nakes_profil_lipid",
      title: "Profil Lipid (Kolesterol, Trigliserida, HDL, LDL)",
      source: "nakes",
      matchKeywords: ["profil lipid", "kolesterol", "trigliserida", "hdl", "ldl"],
      uncheckKeywords: ["profil lipid", "kolesterol"],
      defaultEnabled: true
    },
    {
      id: "nakes_jantung_ekg",
      title: "Rekam Jantung (EKG)",
      source: "nakes",
      matchKeywords: ["ekg", "rekam jantung", "jantung"],
      uncheckKeywords: ["ekg", "rekam jantung"],
      defaultEnabled: true
    },
    {
      id: "nakes_ginjal",
      title: "Fungsi Ginjal (Ureum, Kreatinin, e-LFG)",
      source: "nakes",
      matchKeywords: ["fungsi ginjal", "ureum", "kreatinin", "e-lfg", "elfg", "egfr"],
      uncheckKeywords: ["fungsi ginjal", "ureum", "kreatinin"],
      defaultEnabled: true
    },
    {
      id: "nakes_protein_urin",
      title: "Protein Urin / Albuminuria (Urinalisis)",
      source: "nakes",
      matchKeywords: ["protein urin", "albuminuria", "uacr", "urinalisis"],
      uncheckKeywords: ["protein urin", "albuminuria"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_b",
      title: "Rapid Test Hepatitis B (HBsAg)",
      source: "nakes",
      matchKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      uncheckKeywords: ["hepatitis b", "hbsag", "skrining hepatitis", "pemeriksaan hepatitis", "hepatitis"],
      defaultEnabled: true
    },
    {
      id: "nakes_hepatitis_c",
      title: "Rapid Test Hepatitis C (Anti-HCV)",
      source: "nakes",
      matchKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      uncheckKeywords: ["hepatitis c", "anti-hcv", "hcv"],
      defaultEnabled: true
    },
    {
      id: "nakes_fibrosis_sirosis",
      title: "Fibrosis & Sirosis Hati (APRI Score)",
      source: "nakes",
      matchKeywords: ["fibrosis", "sirosis", "apri", "sgot", "sgpt"],
      uncheckKeywords: ["fibrosis", "sirosis", "apri"],
      defaultEnabled: true
    },
    {
      id: "nakes_malaria",
      title: "Skrining Malaria",
      source: "nakes",
      matchKeywords: ["malaria"],
      uncheckKeywords: ["malaria"],
      defaultEnabled: true
    },
    {
      id: "nakes_kusta",
      title: "Pemeriksaan Penyakit Kusta",
      source: "nakes",
      matchKeywords: ["kusta", "lepra"],
      uncheckKeywords: ["kusta", "lepra"],
      defaultEnabled: true
    },
    {
      id: "nakes_frambusia",
      title: "Pemeriksaan Penyakit Frambusia",
      source: "nakes",
      matchKeywords: ["frambusia", "yaws"],
      uncheckKeywords: ["frambusia", "yaws"],
      defaultEnabled: true
    },
    {
      id: "nakes_skabies",
      title: "Pemeriksaan Penyakit Skabies",
      source: "nakes",
      matchKeywords: ["skabies", "scabies", "kudis"],
      uncheckKeywords: ["skabies", "scabies", "kudis"],
      defaultEnabled: true
    },
    {
      id: "nakes_leher_rahim",
      title: "Kanker Leher Rahim (IVA & HPV DNA Lansia ≤ 69 Thn)",
      group: "Skrining Onkologi (Kanker)",
      description: "Deteksi lesi prakanker serviks bagi lansia perempuan",
      gender: "perempuan",
      source: "nakes",
      matchKeywords: ["kanker leher rahim", "leher rahim", "hpv", "iva"],
      uncheckKeywords: ["kanker leher rahim", "leher rahim", "hpv", "iva"],
      defaultEnabled: true
    },
    {
      id: "nakes_kanker_paru",
      title: "Skrining Risiko Kanker Paru Lansia",
      group: "Skrining Onkologi (Kanker)",
      description: "Kuesioner gejala & riwayat merokok risiko keganasan paru",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["kanker paru"],
      uncheckKeywords: ["kanker paru"],
      defaultEnabled: true
    },
    {
      id: "nakes_prediksi_kardiovaskular",
      title: "Prediksi Risiko Kardiovaskular (CARTA WHO Lansia)",
      group: "Jantung & Kardiovaskular",
      description: "Kalkulasi risiko penyakit jantung koroner & stroke",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["risiko kardiovaskular", "carta", "jantung dan pembuluh darah"],
      uncheckKeywords: ["risiko kardiovaskular", "carta"],
      defaultEnabled: true
    },
    {
      id: "nakes_hb_anemia",
      title: "Pemeriksaan Hemoglobin (Hb / Anemia Lansia)",
      group: "Hematologi & Infeksi Menular",
      description: "Deteksi anemia kronis pada lansia",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["hemoglobin", "anemia"],
      uncheckKeywords: ["hemoglobin", "anemia"],
      defaultEnabled: true
    },
    {
      id: "nakes_hiv",
      title: "Rapid Test HIV (Populasi Berisiko)",
      group: "Hematologi & Infeksi Menular",
      description: "Tes antibodi HIV",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["rapid test hiv", "hiv"],
      uncheckKeywords: ["rapid test hiv", "hiv"],
      defaultEnabled: true
    },
    {
      id: "nakes_sifilis",
      title: "Rapid Test Sifilis (TP Rapid)",
      group: "Hematologi & Infeksi Menular",
      description: "Tes serologi sifilis",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["rapid test sifilis", "sifilis"],
      uncheckKeywords: ["rapid test sifilis", "sifilis"],
      defaultEnabled: true
    },
    {
      id: "nakes_imunisasi_lansia",
      title: "Skrining Imunisasi Lansia (Influenza / Pneumokokus / COVID-19)",
      group: "Imunisasi",
      description: "Riwayat vaksinasi lansia",
      gender: "semua",
      source: "nakes",
      matchKeywords: ["imunisasi", "vaksin", "influenza", "pneumokokus"],
      uncheckKeywords: ["imunisasi"],
      defaultEnabled: true
    }
  ]

};


export const EXAM_GROUPS = [
  "Antropometri, Gizi & Tanda Vital",
  "Tumbuh Kembang & Skrining Balita / Bayi",
  "Pemeriksaan Fisik, Indera & Gigi",
  "Laboratorium & Metabolisme",
  "Skrining Onkologi (Kanker)",
  "Paru & Pernapasan",
  "Jantung & Kardiovaskular",
  "Hematologi & Infeksi Menular",
  "Kesehatan Jiwa & Kebugaran",
  "Geriatri & SKILAS (Lansia)",
  "Imunisasi"
];

// Enrich seluruh item di EXAM_CATALOG_BY_LIFECYCLE dengan group, gender, dan description setara CKG_Puskesmas_Android_V2
for (const [lcKey, list] of Object.entries(EXAM_CATALOG_BY_LIFECYCLE)) {
  for (const item of list) {
    const id = item.id || "";
    const titleLow = (item.title || "").toLowerCase();
    if (!item.gender) {
      if (id.includes("sadanis") || id.includes("leher_rahim") || id.includes("hpv") || id.includes("wus")) {
        item.gender = "perempuan";
      } else {
        item.gender = "semua";
      }
    }
    if (!item.group) {
      if (id.includes("antropometri") || id.includes("lingkar") || id.includes("tekanan_darah")) {
        item.group = "Antropometri, Gizi & Tanda Vital";
      } else if (id.includes("shk") || id.includes("g6pd") || id.includes("pjb") || id.includes("ikterus") || id.includes("perkembangan") || id.includes("mchat")) {
        item.group = "Tumbuh Kembang & Skrining Balita / Bayi";
      } else if (id.includes("mata") || id.includes("telinga") || id.includes("gigi")) {
        item.group = "Pemeriksaan Fisik, Indera & Gigi";
      } else if (id.includes("gds") || id.includes("gdp") || id.includes("lipid") || id.includes("ginjal") || id.includes("protein_urin") || id.includes("fibrosis")) {
        item.group = "Laboratorium & Metabolisme";
      } else if (id.includes("sadanis") || id.includes("leher_rahim") || id.includes("kanker")) {
        item.group = "Skrining Onkologi (Kanker)";
      } else if (id.includes("tb") || id.includes("ppok") || id.includes("kadar_co")) {
        item.group = "Paru & Pernapasan";
      } else if (id.includes("jantung") || id.includes("kardiovaskular")) {
        item.group = "Jantung & Kardiovaskular";
      } else if (id.includes("skilas") || id.includes("adl") || id.includes("chair_stand")) {
        item.group = "Geriatri & SKILAS (Lansia)";
      } else if (id.includes("kebugaran") || id.includes("jiwa")) {
        item.group = "Kesehatan Jiwa & Kebugaran";
      } else if (id.includes("imunisasi")) {
        item.group = "Imunisasi";
      } else {
        item.group = "Hematologi & Infeksi Menular";
      }
    }
    if (typeof item.isSubItem === "undefined") {
      item.isSubItem = Boolean(
        id.includes("mata_katarak") || id.includes("mata_buta_warna") ||
        id.includes("telinga_pendengaran") || id.includes("gigi_periodontal") ||
        id.includes("ppok_spirometri") || id.includes("kemandirian_adl") || id.includes("mobilisasi_chair_stand")
      );
    }
  }
}

export function getDefaultExamToggles() {
  const defaults = {};
  for (const [lifecycleKey, items] of Object.entries(EXAM_CATALOG_BY_LIFECYCLE)) {
    defaults[lifecycleKey] = {};
    for (const item of items) {
      defaults[lifecycleKey][item.id] = true;
    }
  }
  return defaults;
}

export function mergeExamToggles(savedToggles = {}) {
  const defaults = getDefaultExamToggles();
  if (!savedToggles || typeof savedToggles !== "object") return defaults;

  const merged = {};
  for (const [lifecycleKey, defMap] of Object.entries(defaults)) {
    merged[lifecycleKey] = { ...defMap };
    const savedCat = savedToggles[lifecycleKey];
    if (savedCat && typeof savedCat === "object") {
      for (const [examId, val] of Object.entries(savedCat)) {
        if (typeof val === "boolean") {
          merged[lifecycleKey][examId] = val;
        }
      }
    }
  }
  return merged;
}

export async function loadExamToggles() {
  try {
    const { ckg_exam_toggles, ckg_exam_toggles_version } = await chrome.storage.local.get([
      "ckg_exam_toggles",
      "ckg_exam_toggles_version"
    ]);
    // Migrasi versi 3: membersihkan seluruh toggle skrining mandiri (karena mandiri adalah wajib 100%) dan memastikan seluruh pemeriksaan nakes default ke ON
    if (ckg_exam_toggles_version !== 3) {
      const defaults = getDefaultExamToggles();
      await chrome.storage.local.set({ ckg_exam_toggles: defaults, ckg_exam_toggles_version: 3 });
      return defaults;
    }
    return mergeExamToggles(ckg_exam_toggles);
  } catch (e) {
    return getDefaultExamToggles();
  }
}

export async function saveExamToggles(toggles) {
  const merged = mergeExamToggles(toggles);
  await chrome.storage.local.set({ ckg_exam_toggles: merged });
  return merged;
}

export function resolveLifecycleKey(patientInfoOrCategory) {
  if (!patientInfoOrCategory) return "dewasa";
  if (typeof patientInfoOrCategory === "string") {
    const s = patientInfoOrCategory.toLowerCase().trim();
    if (EXAM_CATALOG_BY_LIFECYCLE[s]) return s;
    if (s.includes("bayi")) return "bayi";
    if (s.includes("balita")) return "balita";
    if (s.includes("pra")) return "prasekolah";
    if (s.includes("remaja") || s.includes("smp") || s.includes("sma") || s.includes("smk")) return "remaja";
    if (s.includes("sekolah") || s.includes("sd")) return "sekolah";
    if (s.includes("lansia")) return "lansia";
    return "dewasa";
  }

  if (typeof patientInfoOrCategory === "object") {
    if (patientInfoOrCategory.lifecycleKey && EXAM_CATALOG_BY_LIFECYCLE[patientInfoOrCategory.lifecycleKey]) {
      return patientInfoOrCategory.lifecycleKey;
    }
    const siklusRaw = String(patientInfoOrCategory.siklusHidup || "").toLowerCase().trim();
    if (siklusRaw) {
      if (siklusRaw.includes("bayi")) return "bayi";
      if (siklusRaw.includes("balita")) return "balita";
      if (siklusRaw.includes("pra")) return "prasekolah";
      if (siklusRaw.includes("remaja")) return "remaja";
      if (siklusRaw.includes("sekolah")) return "sekolah";
      if (siklusRaw.includes("lansia")) return "lansia";
      if (siklusRaw.includes("dewasa")) return "dewasa";
    }
    if (typeof patientInfoOrCategory.ageYears === "number" && !isNaN(patientInfoOrCategory.ageYears)) {
      const y = patientInfoOrCategory.ageYears;
      if (y < 1) return "bayi";
      if (y >= 1 && y <= 4) return "balita";
      if (y >= 5 && y <= 6) return "prasekolah";
      if (y >= 7 && y <= 12) return "sekolah";
      if (y >= 13 && y <= 17) return "remaja";
      if (y >= 18 && y <= 59) return "dewasa";
      if (y >= 60) return "lansia";
    }
    let birthDate =
      patientInfoOrCategory.tanggalLahir ||
      patientInfoOrCategory.tanggal_lahir ||
      patientInfoOrCategory.tglLahir ||
      patientInfoOrCategory.birthDate ||
      "";
    // Fallback ekstraksi tanggal lahir dari NIK 16 digit jika tanggal lahir kosong / "—"
    if ((!birthDate || birthDate === "—") && patientInfoOrCategory.nik) {
      const nikDigits = String(patientInfoOrCategory.nik).replace(/\D/g, "");
      if (nikDigits.length === 16) {
        let dd = parseInt(nikDigits.substring(6, 8), 10);
        const mm = parseInt(nikDigits.substring(8, 10), 10);
        const yy = parseInt(nikDigits.substring(10, 12), 10);
        if (dd > 40) dd -= 40;
        if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
          const curYY = new Date().getFullYear() % 100;
          const fullYear = yy <= curYY ? 2000 + yy : 1900 + yy;
          birthDate = `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }
      }
    }
    if (birthDate && birthDate !== "—") {
      const ageObj = calculateAge(birthDate);
      const y = ageObj?.years;
      if (typeof y === "number" && !isNaN(y)) {
        if (y < 1) return "bayi";
        if (y >= 1 && y <= 4) return "balita";
        if (y >= 5 && y <= 6) return "prasekolah";
        if (y >= 7 && y <= 12) return "sekolah";
        if (y >= 13 && y <= 17) return "remaja";
        if (y >= 18 && y <= 59) return "dewasa";
        if (y >= 60) return "lansia";
      }
    }
    const cat = String(patientInfoOrCategory.category || patientInfoOrCategory.kategori || "").toLowerCase();
    if (cat.includes("bayi")) return "bayi";
    if (cat.includes("balita")) return "balita";
    if (cat.includes("pra")) return "prasekolah";
    if (cat.includes("remaja") || cat.includes("smp") || cat.includes("sma")) return "remaja";
    if (cat.includes("sekolah") || cat.includes("sd")) return "sekolah";
    if (cat.includes("lansia")) return "lansia";
  }
  return "dewasa";
}

// Pemetaan ID pemeriksaan yang setara antar siklus hidup agar toggle di Pengaturan selalu sinkron
export const EQUIVALENT_EXAM_FAMILY = {
  nakes_antropometri_bb: ["nakes_antropometri_bb", "nakes_antropometri_bb_tb", "nakes_antropometri_imt"],
  nakes_antropometri_bb_tb: ["nakes_antropometri_bb", "nakes_antropometri_bb_tb", "nakes_antropometri_imt"],
  nakes_antropometri_imt: ["nakes_antropometri_bb", "nakes_antropometri_bb_tb", "nakes_antropometri_imt"],
  nakes_mata: ["nakes_mata", "nakes_mata_visus"],
  nakes_mata_visus: ["nakes_mata", "nakes_mata_visus"],
  nakes_telinga: ["nakes_telinga", "nakes_telinga_serumen", "nakes_telinga_pendengaran"],
  nakes_telinga_serumen: ["nakes_telinga", "nakes_telinga_serumen"],
  nakes_telinga_pendengaran: ["nakes_telinga", "nakes_telinga_pendengaran"],
  nakes_gigi: ["nakes_gigi", "nakes_gigi_karies", "nakes_gigi_periodontal"],
  nakes_gigi_karies: ["nakes_gigi", "nakes_gigi_karies"],
  nakes_gigi_periodontal: ["nakes_gigi", "nakes_gigi_periodontal"],
  nakes_hb_talasemia: ["nakes_hb_talasemia", "nakes_hb_anemia", "nakes_talasemia"],
  nakes_hb_anemia: ["nakes_hb_talasemia", "nakes_hb_anemia"],
  nakes_talasemia: ["nakes_hb_talasemia", "nakes_talasemia"],
  nakes_jiwa_sdq: ["nakes_jiwa_sdq", "nakes_jiwa_remaja", "nakes_jiwa_dewasa"],
  nakes_jiwa_remaja: ["nakes_jiwa_sdq", "nakes_jiwa_remaja", "nakes_jiwa_dewasa"],
  nakes_jiwa_dewasa: ["nakes_jiwa_sdq", "nakes_jiwa_remaja", "nakes_jiwa_dewasa"],
  nakes_imunisasi_bayi: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"],
  nakes_imunisasi_rutin: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"],
  nakes_imunisasi_bias: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"],
  nakes_imunisasi_hpv: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"],
  nakes_imunisasi_tetanus_wus: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"],
  nakes_imunisasi_lansia: ["nakes_imunisasi_bayi", "nakes_imunisasi_rutin", "nakes_imunisasi_bias", "nakes_imunisasi_hpv", "nakes_imunisasi_tetanus_wus", "nakes_imunisasi_lansia"]
};

export function syncExamToggleAcrossLifecycles(toggles, examId, newState) {
  if (!toggles || !examId) return toggles;
  const eqIds = new Set([examId, ...(EQUIVALENT_EXAM_FAMILY[examId] || [])]);
  for (const [lcKey, catalog] of Object.entries(EXAM_CATALOG_BY_LIFECYCLE)) {
    if (!toggles[lcKey]) toggles[lcKey] = {};
    for (const item of catalog) {
      if (eqIds.has(item.id)) {
        toggles[lcKey][item.id] = newState;
      }
    }
  }
  return toggles;
}

export function findAllMatchingExamCatalogItems(title, source = "nakes", lifecycleKey = "dewasa", layanan = "") {
  const cleanTitle = String(title || "").replace(/\s+/g, " ").trim().toLowerCase();
  const cleanLayanan = String(layanan || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleanTitle && !cleanLayanan) return [];

  const catalog = EXAM_CATALOG_BY_LIFECYCLE[lifecycleKey] || EXAM_CATALOG_BY_LIFECYCLE.dewasa || [];
  const matches = [];

  for (const item of catalog) {
    const hit = (item.matchKeywords || []).some(kw => {
      const k = String(kw || "").toLowerCase().trim();
      if (!k) return false;
      if (cleanTitle && (cleanTitle === k || cleanTitle.includes(k) || (cleanTitle.length >= 4 && k.includes(cleanTitle)))) return true;
      if (cleanLayanan && (cleanLayanan === k || cleanLayanan.includes(k))) return true;
      return false;
    });
    if (hit) {
      matches.push({ item, lifecycleKey });
    }
  }

  return matches;
}

export function findMatchingExamCatalogItem(title, source = "nakes", lifecycleKey = "dewasa", layanan = "") {
  const matches = findAllMatchingExamCatalogItems(title, source, lifecycleKey, layanan);
  return matches.length > 0 ? matches[0] : null;
}

function isItemEnabledInToggles(item, lifecycleKey, toggles) {
  const catToggles = toggles[lifecycleKey] || {};
  if (catToggles[item.id] === false) return false;

  // Jika user mematikan pemeriksaan di kategori utama (misal 'dewasa' yang default tampil di modal Pengaturan)
  // sementara kategori siklus hidup pasien saat ini belum pernah dimodifikasi (semua masih true),
  // maka hormati pengaturan OFF dari 'dewasa' agar selalu sinkron!
  if (lifecycleKey !== "dewasa") {
    const lifecycleHasAnyOff = Object.values(catToggles).some(v => v === false);
    const dewasaToggles = toggles.dewasa || {};
    const dewasaHasAnyOff = Object.values(dewasaToggles).some(v => v === false);
    if (!lifecycleHasAnyOff && dewasaHasAnyOff) {
      const eqIds = [item.id, ...(EQUIVALENT_EXAM_FAMILY[item.id] || [])];
      if (eqIds.some(id => dewasaToggles[id] === false)) {
        return false;
      }
    }
  }
  return true;
}

export function isExamEnabled(title, source = "nakes", patientInfoOrLifecycle = "dewasa", examToggles = null, layanan = "") {
  // PENTING: Seluruh Skrining Mandiri adalah WAJIB di sistem SATUSEHAT CKG dan TIDAK PERNAH di-skip / di-OFF-kan!
  if (source === "mandiri" || source === "table") return true;

  const lifecycleKey = resolveLifecycleKey(patientInfoOrLifecycle);
  const toggles = mergeExamToggles(examToggles);
  let matches = findAllMatchingExamCatalogItems(title, source, lifecycleKey, layanan);
  if (matches.length === 0 && lifecycleKey !== "dewasa") {
    matches = findAllMatchingExamCatalogItems(title, source, "dewasa", layanan);
  }
  if (matches.length === 0) return true; // Default aktif jika tidak ada di katalog agar tidak terlewat tanpa sengaja

  for (const match of matches) {
    // Cek kecocokan gender jika item khusus perempuan/laki-laki dan info gender pasien tersedia
    if (match.item.gender && match.item.gender !== "semua" && typeof patientInfoOrLifecycle === "object" && patientInfoOrLifecycle !== null) {
      const rawG = String(
        patientInfoOrLifecycle.normGender ||
        patientInfoOrLifecycle.gender ||
        patientInfoOrLifecycle.jenisKelamin ||
        patientInfoOrLifecycle.jenis_kelamin ||
        ""
      ).toLowerCase();
      if (rawG) {
        const isPatientFemale = rawG.includes("perempuan") || rawG.includes("wanita") || rawG === "p" || rawG === "f";
        const isPatientMale = !isPatientFemale && (rawG.includes("laki") || rawG.includes("pria") || rawG === "l" || rawG === "m");
        if (match.item.gender === "perempuan" && isPatientMale) return false;
        if (match.item.gender === "laki-laki" && isPatientFemale) return false;
      }
    }

    if (!isItemEnabledInToggles(match.item, match.lifecycleKey, toggles)) {
      return false;
    }
  }

  return true;
}

export function getDisabledUncheckKeywords(patientInfoOrLifecycle = "dewasa", examToggles = null) {
  const lifecycleKey = resolveLifecycleKey(patientInfoOrLifecycle);
  const toggles = mergeExamToggles(examToggles);
  const catalog = EXAM_CATALOG_BY_LIFECYCLE[lifecycleKey] || EXAM_CATALOG_BY_LIFECYCLE.dewasa || [];

  const keywords = new Set();
  for (const item of catalog) {
    if (item.source === "nakes" && !isItemEnabledInToggles(item, lifecycleKey, toggles)) {
      const kws = [...(item.uncheckKeywords || []), ...(item.matchKeywords || [])];
      for (const kw of kws) {
        if (kw) keywords.add(kw.toLowerCase());
      }
    }
  }
  return Array.from(keywords);
}

export function applyTogglesToUncheckKeywords(baseKeywords = [], patientInfoOrLifecycle = "dewasa", examToggles = null) {
  const lifecycleKey = resolveLifecycleKey(patientInfoOrLifecycle);
  const toggles = mergeExamToggles(examToggles);
  const catalog = EXAM_CATALOG_BY_LIFECYCLE[lifecycleKey] || EXAM_CATALOG_BY_LIFECYCLE.dewasa || [];

  // Kumpulkan keyword yang secara eksplisit diaktifkan (ON) vs dinonaktifkan (OFF) oleh user
  const enabledNakesKeywords = new Set();
  const disabledNakesKeywords = new Set();

  for (const item of catalog) {
    if (item.source !== "nakes") continue;
    const isEnabled = isItemEnabledInToggles(item, lifecycleKey, toggles);
    const kws = [...(item.uncheckKeywords || []), ...(item.matchKeywords || [])];
    for (const kw of kws) {
      const low = kw.toLowerCase();
      if (isEnabled) enabledNakesKeywords.add(low);
      else disabledNakesKeywords.add(low);
    }
  }

  // Filter baseKeywords: buang keyword yang di-enable oleh user di siklus hidup ini
  const finalSet = new Set();
  for (const bkw of baseKeywords) {
    const low = String(bkw || "").toLowerCase().trim();
    if (!low) continue;
    const isExplicitlyEnabled = Array.from(enabledNakesKeywords).some(
      ekw => low === ekw || low.includes(ekw) || ekw.includes(low)
    );
    if (!isExplicitlyEnabled) {
      finalSet.add(bkw);
    }
  }

  // Tambahkan semua keyword dari pemeriksaan nakes yang di-OFF-kan oleh user (PROTEKSI: Jangan pernah uncheck mandiri)
  for (const dkw of disabledNakesKeywords) {
    if (/mandiri/i.test(dkw)) continue;
    finalSet.add(dkw);
  }

  return Array.from(finalSet);
}
