/**
 * CKG Bulk Data Transformer & Normalizer Ultimate
 * Menyatukan engine dari Pengolah_Data_Excel_CKG, Jembatan data CKG, dan CKG Revisi.
 * Output format 100% presisi sesuai CKG Real automation\templates_excel:
 * - Balita
 * - Sekolah SD
 * - Remaja SMP-SMA
 * - Dewasa Laki-Laki & Perempuan
 * - Lansia Laki-Laki & Perempuan
 * - Master CKG Umum & Master CKG Sekolah
 */

// ==============================================================================
// 1. DEFINISI STRUKTUR KOLOM STANDAR SESUAI templates_excel
// ==============================================================================

export const TEMPLATE_COLUMNS = {
  BALITA: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "PROVINSI", "KAB/KOTA",
    "KECAMATAN", "KELURAHAN", "ALAMAT", "STATUS PERNIKAHAN", "PEKERJAAN",
    "NIK WALI", "NAMA LENGKAP WALI", "TANGGAL LAHIR WALI", "JENIS KELAMIN WALI", "NO HP WALI",
    "BB", "TB", "CARA UKUR", "LK", "LILA", "STATUS IMUNISASI", "KPSP", "MCHAT",
    "GULA DARAH", "TELINGA", "MATA", "GIGI", "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
  ],
  SEKOLAH_SD: [
    "SEKOLAH", "KELAS", "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
    "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
    "GIGI", "KARIES", "MATA", "KACAMATA", "BUTA WARNA", "TELINGA", "KEBUGARAN",
    "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
  ],
  REMAJA: [
    "SEKOLAH", "KELAS", "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
    "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
    "HEMOGLOBIN", "ANEMIA", "MEROKOK", "KADAR CO", "MENSTRUASI",
    "GIGI", "KARIES", "MATA", "KACAMATA", "TELINGA", "KEBUGARAN",
    "GEJALA CEMAS", "GEJALA DEPRESI", "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
  ],
  DEWASA_LAKI: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "STATUS PERNIKAHAN",
    "PEKERJAAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH", "GULA DARAH PUASA", "HBA1C",
    "MEROKOK", "KADAR CO", "RIWAYAT DIABETES", "DURASI DIABETES BULAN", "RIWAYAT HIPERTENSI",
    "KOLESTEROL TOTAL", "TRIGLISERIDA", "HDL", "LDL", "UREUM", "KREATININ", "PROTEIN URIN",
    "HEMOGLOBIN", "TELINGA", "MATA", "KATARAK", "GIGI", "PUMA SCORE", "KANKER PARU",
    "KANKER USUS", "KESEHATAN JIWA SRQ20", "TBC", "KUSTA", "FRAMBUSIA", "SKABIES",
    "MALARIA", "HEPATITIS B", "HEPATITIS C", "HIV", "SIFILIS"
  ],
  DEWASA_PEREMPUAN: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "STATUS PERNIKAHAN",
    "PEKERJAAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "SEDANG HAMIL", "RENCANA MENIKAH", "HUBUNGAN INTIM", "SADANIS", "IVA", "HPV DNA", "CATIN PEREMPUAN",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH", "GULA DARAH PUASA", "HBA1C",
    "MEROKOK", "KADAR CO", "RIWAYAT DIABETES", "DURASI DIABETES BULAN", "RIWAYAT HIPERTENSI",
    "KOLESTEROL TOTAL", "TRIGLISERIDA", "HDL", "LDL", "UREUM", "KREATININ", "PROTEIN URIN",
    "HEMOGLOBIN", "ANEMIA", "TELINGA", "MATA", "KATARAK", "GIGI", "PUMA SCORE", "KANKER PARU",
    "KANKER USUS", "KESEHATAN JIWA SRQ20", "TBC", "KUSTA", "FRAMBUSIA", "SKABIES",
    "MALARIA", "HEPATITIS B", "HEPATITIS C", "HIV", "SIFILIS"
  ],
  LANSIA_LAKI: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "STATUS PERNIKAHAN",
    "PEKERJAAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "SKILAS KOGNITIF", "SKILAS MOBILISASI", "CHAIR STAND DETIK", "SKILAS MALNUTRISI", "SKILAS DEPRESI", "BARTHEL INDEX ADL",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH", "GULA DARAH PUASA", "HBA1C",
    "MEROKOK", "KADAR CO", "RIWAYAT DIABETES", "DURASI DIABETES BULAN", "RIWAYAT HIPERTENSI",
    "KOLESTEROL TOTAL", "TRIGLISERIDA", "HDL", "LDL", "UREUM", "KREATININ", "PROTEIN URIN",
    "HEMOGLOBIN", "TELINGA", "MATA", "KATARAK", "GIGI", "PUMA SCORE", "KANKER PARU",
    "KANKER USUS", "KESEHATAN JIWA SRQ20", "TBC", "KUSTA", "FRAMBUSIA", "SKABIES",
    "MALARIA", "HEPATITIS B", "HEPATITIS C", "HIV", "SIFILIS"
  ],
  LANSIA_PEREMPUAN: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "STATUS PERNIKAHAN",
    "PEKERJAAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "SKILAS KOGNITIF", "SKILAS MOBILISASI", "CHAIR STAND DETIK", "SKILAS MALNUTRISI", "SKILAS DEPRESI", "BARTHEL INDEX ADL",
    "SADANIS", "IVA",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH", "GULA DARAH PUASA", "HBA1C",
    "MEROKOK", "KADAR CO", "RIWAYAT DIABETES", "DURASI DIABETES BULAN", "RIWAYAT HIPERTENSI",
    "KOLESTEROL TOTAL", "TRIGLISERIDA", "HDL", "LDL", "UREUM", "KREATININ", "PROTEIN URIN",
    "HEMOGLOBIN", "TELINGA", "MATA", "KATARAK", "GIGI", "PUMA SCORE", "KANKER PARU",
    "KANKER USUS", "KESEHATAN JIWA SRQ20", "TBC", "KUSTA", "FRAMBUSIA", "SKABIES",
    "MALARIA", "HEPATITIS B", "HEPATITIS C", "HIV", "SIFILIS"
  ],
  // Template Standar 3 File (Backward Compatibility)
  BALITA_LEGACY: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
    "STATUS PERNIKAHAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN",
    "ALAMAT", "PEKERJAAN", "MEROKOK", "BB", "TB", "LP",
    "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
    "NIK Wali", "Nama Lengkap Wali", "Tanggal Lahir Wali", "Jenis Kelamin Wali", "No HP Wali"
  ],
  SEKOLAH_LEGACY: [
    "NAMA", "KELAS", "SEKOLAH", "JENIS KELAMIN", "NIK", "TANGGAL LAHIR",
    "NO WHATSAPP", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
    "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
    "KARIES", "KEBUGARAN", "MENSTRUASI", "KACAMATA"
  ],
  UMUM_LEGACY: [
    "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
    "STATUS PERNIKAHAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN",
    "ALAMAT", "PEKERJAAN", "MEROKOK", "BB", "TB", "LP",
    "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
    "TELINGA", "MATA", "GIGI", "KATARAK",
    "NIK Wali", "Nama Lengkap Wali", "Tanggal Lahir Wali", "Jenis Kelamin Wali", "No HP Wali"
  ]
};

// ==============================================================================
// 2. KAMUS SINONIM HEADER SUPER LENGKAP
// ==============================================================================

export const HEADER_SYNONYMS = {
  // --- IDENTITAS & PENDAFTARAN ---
  nik: [
    "nik", "nikpenduduk", "nikanggota", "nikanggotakeluarga", "nikpasien", "nikpeserta",
    "niksiswa", "nikbalita", "nikbayi", "nikanak", "nikwarga", "nikindividu", "nikktp",
    "nomorindukkependudukan", "noindukkependudukan", "nomorindukpenduduk",
    "noktp", "nomorktp", "ktp", "noidentitas", "nomoridentitas", "nomornik",
    "anggotakeluarganik", "anggotanik", "penduduknik", "pasiennik", "nopeserta"
  ],
  nama: [
    "nama", "namalengkap", "namapenduduk", "namawarga", "namaanggotakeluarga",
    "namaanggota", "namapasien", "namapeserta", "namasiswa", "namabalita",
    "namabayi", "namaanak", "namasasaran", "namaindividu", "fullname", "name",
    "namalengkapkandung", "namalengkapktp", "namasesuaiktp", "namaktp",
    "anggotakeluarganama", "anggotanama", "penduduknama", "warganama", "pasiennama"
  ],
  tanggalLahir: [
    "tempattgllahir", "tempattglahir", "tempatdantgllahir", "tempatdantanggallahir",
    "tanggallahir", "tgllahir", "tgllhr", "tgl_lahir", "tanggal_lahir",
    "birthdate", "dob", "tgllahirpeserta", "tgllahiranak", "tgl_lahir_peserta",
    "tgllahirsiswa", "lahirtanggal", "tgllahirpasien", "tempatlhr", "ttl",
    "anggotakeluargatanggallahir", "anggotatgllahir", "penduduktanggallahir"
  ],
  jenisKelamin: [
    "jeniskelamin", "jk", "gender", "sex", "lp", "pl", "l/p", "p/l",
    "jeniskelaminlp", "jklp", "jeniskelaminsiswa", "jksiswa", "kelaminsiswa",
    "jeniskelaminpeserta", "jkpeserta", "jenis_kelamin", "kelamin",
    "anggotakeluargajeniskelamin", "anggotajk", "seks", "sexgender",
    "jeniskelaminanak", "jkanak", "jeniskelaminmurid", "jkmurid"
  ],
  noWhatsapp: [
    "nohandpone", "nohandphone", "handpone", "handphone", "nowhatsapp",
    "nowa", "nohp", "hp", "wa", "telepon", "telp", "kontak", "nomorhp",
    "nomorwa", "nohpmobile", "no_hp", "no_wa", "notelp", "notelpon"
  ],
  statusPernikahan: [
    "statuspernikahan", "statusperkawinan", "statuskawin", "statusnikah",
    "perkawinan", "pernikahan", "maritalstatus"
  ],
  provinsi: ["provinsi", "prov", "province", "provinsidomisili"],
  kabupatenKota: [
    "kabkota", "kabupaten", "kota", "kab", "kabupatenkota", "city",
    "kabupatenkotadomisili", "kotakab"
  ],
  kecamatan: ["kecamatan", "kec", "district", "kecamatandomisili"],
  kelurahan: [
    "kelurahan", "desa", "desakelurahan", "kel", "subdistrict",
    "kelurahandomisili", "desadomisili"
  ],
  alamat: [
    "alamat", "detailalamat", "alamatdomisili", "domisili", "jalan",
    "alamat_lengkap", "dusun", "lingkungan", "alamatlengkap", "tempattinggal", "alamatktp"
  ],
  rt: ["rt", "rttempattinggal"],
  rw: ["rw", "rwtempattinggal"],
  rtRw: ["rtrw", "rt_rw", "rt/rw", "rtdanrw"],
  pekerjaan: [
    "pekerjaan", "profesi", "job", "matapencaharian", "mata_pencaharian",
    "statuspekerjaan", "status_pekerjaan", "jenispekerjaan", "jenis_pekerjaan",
    "pekerjaanutama", "pekerjaan_utama", "pekerjaanstatus", "pekerjaanprofesi",
    "pekerjaan_profesi", "pekerjaan/profesi", "bidangpekerjaan", "pencaharian"
  ],
  noErm: [
    "noerm", "norm", "nomorerm", "nomorrekammedis", "norekammedis", "erm", "rm",
    "normlama", "nodokumenrm", "no_erm", "no_rm"
  ],
  noAsuransi: [
    "noasuransi", "nobpjs", "nomorasuransi", "nomorbpjs", "noka", "nokartuasuransi",
    "norujukanbpjs", "no_asuransi", "no_bpjs"
  ],

  // --- KHUSUS BALITA (WALI & ORTU) ---
  nikWali: [
    "nikwali", "nikibu", "nikayah", "nikortu", "nik_wali", "nik_ibu",
    "nikorangtua", "nikpenanggungjawab"
  ],
  namaWali: [
    "namalengkapwali", "namawali", "namaayah", "namaibu", "namaortu",
    "nama_wali", "nama_ibu", "namaorangtua", "namapenanggungjawab"
  ],
  namaAyah: ["namaayah", "ayah"],
  namaIbu: ["namaibu", "ibu"],
  tanggalLahirWali: [
    "tanggallahirwali", "tgllahirwali", "tgllhrwali", "tglwali", "tglibu",
    "tgllahiribu", "tgl_lahir_wali", "tgl_lahir_ibu", "tanggallahiribu"
  ],
  jenisKelaminWali: ["jeniskelaminwali", "jkwali", "jkibu", "jeniskelaminibu", "jkwalipl"],
  noHpWali: [
    "nohpwali", "nowawali", "hpwali", "wawali", "hpibu", "waibu",
    "no_hp_wali", "nomorwali", "nomoribu", "nohpibu"
  ],

  // --- KHUSUS SEKOLAH & REMAJA ---
  sekolah: [
    "sekolah", "namasekolah", "asalsekolah", "unitsekolah", "instansi",
    "namasekolahasal", "sekolahasal", "madrasah", "namamadrasah"
  ],
  kelas: [
    "kelas", "jenjang", "tingkat", "rombel", "tingkatkelas", "jenjangkelas",
    "kelasrombel", "kelassiswa", "rombelkelas", "jenjangpendidikan"
  ],

  // --- PEMERIKSAAN FISIK & ANTROPOMETRI ---
  bb: ["beratbadankg", "beratbadan", "bb", "berat", "weight", "bbkg", "bb_kg", "berat_badan"],
  tb: ["tinggibadancm", "tinggibadan", "tb", "tinggi", "height", "tbcm", "tb_cm", "tinggi_badan", "panjangbadan", "pb"],
  caraUkur: ["caraukur", "cara_ukur", "posisiukur", "posisipengukuran", "carapengukuran"],
  lp: ["lingkarperut", "lingkarpinggang", "lp", "perut", "lingkar_perut"],
  lk: ["lingkarkepala", "lk", "lingkar_kepala", "lingkarkepalacm"],
  lila: ["lila", "lingkarlenganatas", "lingkarlengan", "lingkar_lengan", "lilacm"],
  tdSistolik: [
    "sistole", "sistolemm", "sistolik", "tdsistole", "tdsistolik", "tensi", "td",
    "tekanandarah", "sis", "td_sistolik", "tensisistolik", "tensi_sistol"
  ],
  tdDiastolik: [
    "diastole", "diastolehg", "diastolik", "tddiastole", "tddiastolik", "dia",
    "td_diastolik", "tensidiastolik", "tensi_diastol"
  ],

  // --- LABORATORIUM & POCT ---
  gulaDarah: ["guladarah", "gds", "guladarahsewaktu", "gula", "glukosa", "bloodsugar"],
  gulaDarahPuasa: ["guladarahpuasa", "gdp", "gula_darah_puasa", "glukosapuasa"],
  hba1c: ["hba1c", "hemoglobin_a1c", "hb_a1c"],
  kolesterolTotal: ["kolesteroltotal", "kolesterol", "choles", "cholesterol", "kolesterol_total", "chol"],
  trigliserida: ["trigliserida", "tg", "triglyceride", "trigliserid"],
  hdl: ["hdl", "kolesterolhdl", "kolesterol_hdl"],
  ldl: ["ldl", "kolesterolldl", "kolesterol_ldl"],
  ureum: ["ureum", "urea", "bloodureanitrogen", "bun"],
  kreatinin: ["kreatinin", "creatinine", "kreatin"],
  proteinUrin: ["proteinurin", "protein_urin", "proteinuri", "reduksiurin", "albuminurin"],
  hemoglobin: ["hemoglobin", "hb", "kadarhb", "kadarhemoglobin"],
  anemia: ["anemia", "statusanemia", "skrininganemia"],

  // --- INDERA & GIGI ---
  telinga: ["telinga", "gangguantelinga", "pendengaran", "pemeriksaantelinga", "telingakanankiri"],
  mata: ["mata", "penglihatan", "gangguanmata", "pemeriksaanmata", "visus"],
  katarak: ["katarak", "skriningkatarak", "keruhmata", "lensa"],
  kacamata: ["kacamata", "kacamataplusminus", "gangguanrefraksi", "alatbantupenglihatan"],
  butaWarna: ["butawarna", "tesbutawarna", "ishihara"],
  gigi: ["gigi", "kesehatangigi", "pemeriksaangigi", "kondisigigi"],
  karies: ["karies", "gigikaries", "kariesgigi", "gigiberlubang", "lubanggigi"],

  // --- PERILAKU & KEBIASAAN ---
  merokok: ["merokok", "rokok", "statusmerokok", "kebiasaanmerokok", "pernahmerokok"],
  kadarCo: ["kadarco", "copernapasan", "analisisco", "hasilco", "smokerlyzer"],
  riwayatDiabetes: ["riwayatdiabetes", "riwayatdm", "pernahdiabetes", "riwayat_diabetes"],
  durasiDiabetesBulan: ["durasidiabetesbulan", "durasidm", "durasidiabetes", "bulandiagnosisdm"],
  riwayatHipertensi: ["riwayathipertensi", "riwayathiper", "riwayattensi", "pernahhipertensi"],
  kebugaran: ["kebugaran", "teskebugaran", "statuskebugaran", "hasilteskebugaran", "rockport"],
  menstruasi: ["menstruasi", "haid", "sudahmenstruasi", "statusmenstruasi", "polahaid"],

  // --- KESEHATAN WANITA & REPRODUKSI ---
  sedangHamil: ["sedanghamil", "hamil", "statuskehamilan", "kehamilan"],
  rencanaMenikah: ["rencanamenikah", "catin", "rencananikah"],
  hubunganIntim: ["hubunganintim", "pernahhubunganintim", "seksualaktif"],
  sadanis: ["sadanis", "pemeriksaansadanis", "payudara", "benjolanpayudara"],
  iva: ["iva", "ivatest", "pemeriksaaniva", "inspeksivisualasamasat"],
  hpvDna: ["hpvdna", "dnaspv", "hpv"],
  catinPerempuan: ["catinperempuan", "calonpengantinperempuan"],

  // --- KHUSUS BALITA (SKRINING TUMBUH KEMBANG) ---
  statusImunisasi: ["statusimunisasi", "imunisasi", "kelengkapanimunisasi"],
  kpsp: ["kpsp", "perkembangankpsp", "kuesionerpraskriningperkembangan"],
  mchat: ["mchat", "mchatr", "autisme", "skriningautisme"],

  // --- SKRINING PARU, JIWA & PTM ---
  pumaScore: ["pumascore", "puma", "skorpuma", "skriningppok"],
  kankerParu: ["kankerparu", "skriningkankerparu", "risikokankerparu"],
  kankerUsus: ["kankerusus", "kankerkolorektal", "risikokankerusus"],
  kesehatanJiwaSrq20: ["kesehatanjiwasrq20", "srq20", "jiwa", "srq", "skriningjiwa"],
  gejalaCemas: ["gejalacemas", "cemas", "gad7", "ansietas"],
  gejalaDepresi: ["gejaladepresi", "depresi", "phq9"],

  // --- PENYAKIT MENULAR ---
  gejalaTbc: ["gejalatbc", "tbc", "tb", "batuk2minggu", "skriningtbc", "gejalatb"],
  kusta: ["kusta", "bercakmati rasa", "lepra"],
  frambusia: ["frambusia", "patek", "koreng"],
  skabies: ["skabies", "gudik", "kudis"],
  malaria: ["malaria", "rdtmalaria", "pemeriksaanmalaria"],
  hepatitisB: ["hepatitisb", "hbsag", "pemeriksaanhepatitisb"],
  hepatitisC: ["hepatitisc", "antihcv", "hcv"],
  hiv: ["hiv", "teshiv", "pemeriksaanhiv"],
  sifilis: ["sifilis", "syphilis", "tessifilis", "tprapid"],

  // --- KHUSUS LANSIA (SKILAS & ADL) ---
  skilasKognitif: ["skilaskognitif", "kognitif", "ingatanlansia", "skilas_kognitif"],
  skilasMobilisasi: ["skilasmobilisasi", "mobilisasi", "skilas_mobilisasi"],
  chairStandDetik: ["chairstanddetik", "chairstand", "tesberdiri", "chairstandtest"],
  skilasMalnutrisi: ["skilasmalnutrisi", "malnutrisi", "nutrisilansia", "skilas_malnutrisi"],
  skilasDepresi: ["skilasdepresi", "depresilansia", "skilas_depresi"],
  barthelIndexAdl: ["barthelindexadl", "barthelindex", "barthel", "indeksbarthel", "kemandirianadl"],

  // --- DIAGNOSA, KELUHAN & REKAM MEDIS (ePuskesmas / BPJS / SIMPUS) ---
  diagnosaText: [
    "diagnosa", "diagnosa1", "diagnosa2", "diagnosa3", "diagnosa4", "diagnosa5",
    "icdx", "icdx1", "icdx2", "icdx3", "icdx4", "icdx5", "diagnosis",
    "soapassessment", "assessment", "penyakit"
  ],
  rpdText: ["rpd", "riwayatpenyakitdahulu", "riwayatpenyakit", "riwayatdahulu"],
  keluhanText: ["keluhanutama", "keluhantambahan", "keluhan", "soapsubjective", "keluhanpasien"],
  poliText: ["poliruangan", "poli", "ruangan", "namapoli", "poliklinik", "pelayanan"],
  tindakanText: ["tindakan", "tindakankeperawatan", "terapi", "edukasi"]
};

// ==============================================================================
// 3. FUNGSI PEMBERSIH & NORMALISASI
// ==============================================================================

export function cleanKey(str) {
  if (!str) return "";
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cleanText(val) {
  if (val === null || val === undefined) return "";
  return String(val).replace(/\s+/g, " ").trim();
}

/**
 * Normalisasi NIK:
 * - Menangani string, scientific notation (5.20109E+15)
 * - Menjamin 16 digit angka
 * - Menjaga angka 0 di depan
 */
export function normalizeNik(rawVal) {
  if (rawVal === null || rawVal === undefined) return "";
  let str = String(rawVal).trim();
  if (!str) return "";

  // Tangani format scientific notation
  if (/^[0-9]+(\.[0-9]+)?[eE]\+[0-9]+$/.test(str)) {
    try {
      str = BigInt(Math.round(Number(str))).toString();
    } catch (e) {
      str = Number(str).toFixed(0);
    }
  }

  // Bersihkan karakter non-digit
  const digits = str.replace(/\D/g, "");
  return digits;
}

/**
 * Parse & normalisasi tanggal lahir dari berbagai format:
 * - DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 * - Excel Serial Date (44123)
 * - Teks Indonesia ("SESELA, 25 MEI 2005", "12 AGUSTUS 1990")
 * - Fallback ekstraksi dari digit NIK jika tanggal kosong
 */
export function normalizeDate(rawVal, formatTarget = "YYYY-MM-DD", fallbackNik = "") {
  let dateObj = null;

  if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
    if (typeof rawVal === "number") {
      // Excel serial date: 25569 = 1 Jan 1970
      dateObj = new Date(Math.round((rawVal - 25569) * 86400 * 1000));
    } else {
      let str = String(rawVal).trim();

      // Tangani string angka murni (misal: "34172", "43856" hasil stringifikasi Excel Serial Date)
      if (/^\d{4,5}(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        if (num > 10000 && num < 70000) {
          dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
        }
      }

      if (!dateObj) {
        // Jika format teks gabungan seperti "SESELA, 1990-12-29" atau "LOMBOK, 20/08/2021"
        if (str.includes(",")) {
          const parts = str.split(",");
          str = parts[parts.length - 1].trim();
        }

        // Regex ISO YYYY-MM-DD
        const matchIso = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (matchIso) {
          const y = parseInt(matchIso[1], 10);
          const m = parseInt(matchIso[2], 10) - 1;
          const d = parseInt(matchIso[3], 10);
          dateObj = new Date(y, m, d);
        } else {
          // Regex DD-MM-YYYY atau DD/MM/YYYY
          const matchIndo = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
          if (matchIndo) {
            const d = parseInt(matchIndo[1], 10);
            const m = parseInt(matchIndo[2], 10) - 1;
            const y = parseInt(matchIndo[3], 10);
            dateObj = new Date(y, m, d);
          } else {
            // Tangani bulan tertulis bahasa Indonesia
            const MONTH_NAMES_ID = {
              januari: 0, jan: 0, februari: 1, feb: 1, maret: 2, mar: 2,
              april: 3, apr: 3, mei: 4, may: 4, juni: 5, jun: 5, juli: 6, jul: 6,
              agustus: 7, agt: 7, agu: 7, aug: 7, september: 8, sep: 8, oktober: 9, okt: 9, oct: 9,
              november: 10, nov: 10, desember: 11, des: 11, dec: 11
            };
            const textMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
            if (textMatch) {
              const d = parseInt(textMatch[1], 10);
              const mStr = textMatch[2].toLowerCase();
              const y = parseInt(textMatch[3], 10);
              if (MONTH_NAMES_ID[mStr] !== undefined) {
                dateObj = new Date(y, MONTH_NAMES_ID[mStr], d);
              }
            }
          }
        }
      }
    }
  }

  // Validasi kewajaran tahun dateObj (1910 s/d tahun berjalan)
  if (dateObj && !isNaN(dateObj.getTime())) {
    const yrCheck = dateObj.getFullYear();
    const curYr = new Date().getFullYear();
    if (yrCheck < 1910 || yrCheck > curYr) {
      dateObj = null;
    }
  }

  // Fallback: Ekstrak dari NIK jika dateObj masih null
  const cleanFallbackNik = String(fallbackNik || "").replace(/\D/g, "");
  if ((!dateObj || isNaN(dateObj.getTime())) && cleanFallbackNik.length === 16) {
    try {
      let d = parseInt(cleanFallbackNik.substring(6, 8), 10);
      if (d > 40) d -= 40; // Perempuan: tgl ditambah 40
      const m = parseInt(cleanFallbackNik.substring(8, 10), 10) - 1;
      const yrShort = parseInt(cleanFallbackNik.substring(10, 12), 10);
      const currentYrShort = new Date().getFullYear() % 100;
      const y = (yrShort <= currentYrShort ? 2000 : 1900) + yrShort;
      if (d >= 1 && d <= 31 && m >= 0 && m <= 11) {
        dateObj = new Date(y, m, d);
      }
    } catch (e) {}
  }

  if (!dateObj || isNaN(dateObj.getTime())) return "";

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");

  if (formatTarget === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (formatTarget === "DD-MM-YYYY") return `${dd}-${mm}-${yyyy}`;
  return `${yyyy}-${mm}-${dd}`; // Standar ISO
}

/**
 * Normalisasi Jenis Kelamin: Laki-laki / Perempuan
 * Prioritaskan ekstraksi pintar dari NIK 16 digit (digit 7-8: > 40 adalah Perempuan, 01-31 adalah Laki-laki)
 */
export function normalizeGender(rawVal, fallbackNik = "") {
  const cleanNik = String(fallbackNik || "").replace(/\D/g, "");
  if (cleanNik.length === 16) {
    const day = parseInt(cleanNik.substring(6, 8), 10);
    const month = parseInt(cleanNik.substring(8, 10), 10);
    if (!isNaN(day) && !isNaN(month) && month >= 1 && month <= 12) {
      if (day >= 41 && day <= 71) return "Perempuan";
      if (day >= 1 && day <= 31) return "Laki-laki";
    }
  }

  let str = String(rawVal || "").trim().toLowerCase();
  if (str === "perempuan" || str === "wanita" || str === "female" || str === "p" || str === "w" || str === "f" || str === "2" || str.includes("perem") || str.includes("wanita")) {
    return "Perempuan";
  }
  if (str === "laki-laki" || str === "laki - laki" || str === "laki" || str === "pria" || str === "male" || str === "l" || str === "m" || str === "1" || str.includes("laki") || str.includes("pria")) {
    return "Laki-laki";
  }

  // Fallback dari NIK >= 8 digit (Digit 7-8: > 40 adalah perempuan)
  if (cleanNik.length >= 8) {
    const day = parseInt(cleanNik.substring(6, 8), 10);
    if (!isNaN(day)) {
      return day > 40 ? "Perempuan" : "Laki-laki";
    }
  }
  return "";
}

/**
 * Normalisasi Nomor Telepon / WhatsApp
 */
export function normalizePhone(rawVal) {
  if (!rawVal) return "";
  let digits = String(rawVal).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) digits = "0" + digits.substring(2);
  else if (!digits.startsWith("0") && digits.length >= 9) digits = "0" + digits;
  return digits;
}

/**
 * Normalisasi Angka Desimal (koma ke titik)
 */
export function normalizeNumber(val, fallback = "") {
  if (val === null || val === undefined || val === "") return fallback;
  const cleaned = String(val).replace(",", ".").replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return (!isNaN(num) && isFinite(num) && num > 0) ? String(num) : fallback;
}

/**
 * Hitung Umur Pasien (Tahun & Bulan)
 * Mendukung fallback ekstraksi tanggal lahir dari NIK jika birthDateStr kosong
 */
export function calculateAge(birthDateStr, fallbackNik = "") {
  let d = null;
  if (birthDateStr) {
    const raw = String(birthDateStr).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      const parts = raw.split("/");
      d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parts = raw.split("-");
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      const parsed = new Date(birthDateStr);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  // Fallback ekstrak dari NIK 16 digit jika belum ada objek tanggal
  if (!d && fallbackNik) {
    const cleanNik = String(fallbackNik).replace(/\D/g, "");
    if (cleanNik.length === 16) {
      try {
        let day = parseInt(cleanNik.substring(6, 8), 10);
        if (day > 40) day -= 40;
        const m = parseInt(cleanNik.substring(8, 10), 10) - 1;
        const yrShort = parseInt(cleanNik.substring(10, 12), 10);
        const currentYrShort = new Date().getFullYear() % 100;
        const y = (yrShort <= currentYrShort ? 2000 : 1900) + yrShort;
        if (day >= 1 && day <= 31 && m >= 0 && m <= 11) {
          d = new Date(y, m, day);
        }
      } catch (e) {}
    }
  }

  if (!d || isNaN(d.getTime())) return { years: 0, months: 0, totalMonths: 0 };

  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();

  if (now.getDate() < d.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);
  return { years, months, totalMonths: years * 12 + months };
}

/**
 * Tentukan Kategori Siklus Hidup CKG secara Akurat
 */
export function determineCkgCategory(patient) {
  const age = calculateAge(patient.tanggalLahir, patient.nik);
  const jk = patient.jenisKelamin || "";
  const isMale = jk.toLowerCase().includes("laki") || jk.toLowerCase().startsWith("l");

  // HANYA jika ada data nama sekolah yang valid di sumber data
  const hasSchool = Boolean((patient.sekolah && String(patient.sekolah).trim() !== "") || (patient.namaSekolah && String(patient.namaSekolah).trim() !== ""));

  // Indikator status dewasa (Pekerjaan produktif atau sudah menikah)
  const isAdultWork = Boolean(patient.pekerjaan && !/belum|tidak\s*bekerja|anak|balita|siswa|pelajar/i.test(patient.pekerjaan));
  const isAdultMarriage = Boolean(patient.statusPernikahan && !/belum|tidak/i.test(patient.statusPernikahan) && /\b(menikah|kawin|cerai)\b/i.test(patient.statusPernikahan));

  // Balita jika usia < 7 tahun (tanpa sekolah), ATAU ada data wali untuk usia < 10 tahun
  const hasWali = Boolean(patient.nikWali || patient.namaWali || patient.nikwali || patient.namawali);
  const hasValidBirthOrAge = Boolean(patient.tanggalLahir) || age.totalMonths > 0;
  if (hasValidBirthOrAge && age.years < 7 && !hasSchool) {
    return "BALITA";
  }
  if ((age.years < 7 || (hasWali && age.years < 10)) && !hasSchool && !isAdultWork && !isAdultMarriage) {
    return "BALITA";
  }

  // HANYA jika ada data sekolah atau jenjang kelas maka dikategorikan sebagai CKG Sekolah (SEKOLAH_SD / REMAJA)
  // Pasien dari data mentah RME / faskes tanpa kolom sekolah TIDAK BOLEH dikategorikan Sekolah!
  if (hasSchool && age.years < 18) {
    const cls = String(patient.kelas || "").toLowerCase();
    if (cls.includes("smp") || cls.includes("sma") || cls.includes("7") || cls.includes("8") || cls.includes("9") || cls.includes("10") || cls.includes("11") || cls.includes("12")) {
      return "REMAJA";
    }
    return "SEKOLAH_SD";
  }

  // Jika usia < 18 tahun tapi TIDAK ada data sekolah (data mentah RME / pelayanan faskes biasa):
  // Masuk sebagai kategori UMUM (Dewasa Muda / Skrining Puskesmas)
  if (age.years < 18 && !hasSchool) {
    return isMale ? "DEWASA_LAKI" : "DEWASA_PEREMPUAN";
  }

  if (age.years >= 60) {
    return isMale ? "LANSIA_LAKI" : "LANSIA_PEREMPUAN";
  }

  // Dewasa (18 - 59 Tahun)
  return isMale ? "DEWASA_LAKI" : "DEWASA_PEREMPUAN";
}

// ==============================================================================
// 4. ENGINE DETEKSI HEADER OTOMATIS & PARSER EXCEL
// ==============================================================================

/**
 * Memindai baris 1 s/d 35 untuk mencari baris header yang paling sesuai
 */
export function detectHeaderRow(rawSheetRows) {
  let bestRowIdx = 0;
  let maxScore = 0;

  const maxScan = Math.min(35, rawSheetRows.length);
  for (let r = 0; r < maxScan; r++) {
    const row = rawSheetRows[r];
    if (!row || !Array.isArray(row)) continue;

    let score = 0;
    const cleanCells = row.map(c => cleanKey(c));

    // Cek kecocokan kata kunci primer
    for (const [fieldKey, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (cleanCells.some(cell => cell && synonyms.includes(cell))) {
        score += 3;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestRowIdx = r;
    }
  }

  return { headerRowIndex: bestRowIdx, confidence: maxScore };
}

/**
 * Memetakan setiap kolom header ke kamus sinonim CKG
 */
export function buildHeaderMapping(headerCells) {
  const mapping = {}; // { colIdx: fieldKey }

  // Cek apakah ada kolom eksplisit jenis kelamin di baris header
  const cleanHeaders = headerCells.map(h => cleanKey(h));
  const hasExplicitJk = cleanHeaders.some(k => ["jeniskelamin", "jk", "gender", "sex", "jeniskelaminpeserta", "jkpeserta"].includes(k));

  // Tahap 1: Exact Synonym Matching
  headerCells.forEach((rawHeader, idx) => {
    const key = cleanKey(rawHeader);
    if (!key) return;

    // Disambiguasi cerdas LP: Jika ada kolom Jenis Kelamin tersendiri atau rawHeader adalah "LP" tanpa slash "/",
    // maka kolom ini 100% adalah Lingkar Perut (lp)!
    if (key === "lp") {
      if (hasExplicitJk || !String(rawHeader).includes("/")) {
        mapping[idx] = "lp";
        return;
      }
    }

    for (const [fieldKey, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (synonyms.includes(key)) {
        if (!mapping[idx]) {
          mapping[idx] = fieldKey;
        }
        break;
      }
    }
  });

  // Tahap 2: Intelligent Substring & Keyword Matching untuk kolom yang belum terpetakan
  headerCells.forEach((rawHeader, idx) => {
    if (mapping[idx]) return;
    const key = cleanKey(rawHeader);
    if (!key) return;

    // NIK
    if (key.includes("nik")) {
      if (key.includes("wali") || key.includes("ibu") || key.includes("ortu") || key.includes("ayah")) {
        mapping[idx] = "nikWali";
      } else {
        mapping[idx] = "nik";
      }
      return;
    }

    // Jenis Kelamin / Gender / L/P (Sangat cerdas mengenali variasi JK siswa / sekolah)
    if (key.includes("kelamin") || key.includes("gender") || key === "jk" || key.startsWith("jk") || key.includes("sex") || key === "lp" || key === "pl") {
      if (key.includes("wali") || key.includes("ibu") || key.includes("ortu")) {
        mapping[idx] = "jenisKelaminWali";
      } else {
        mapping[idx] = "jenisKelamin";
      }
      return;
    }

    // Pekerjaan / Profesi / Mata Pencaharian (Wajib diproses SEBELUM nama agar "Nama Pekerjaan" tidak tertukar ke nama, namun JANGAN memetakan "Kepesertaan" agar tidak menimpa Pekerjaan asli!)
    if (key.includes("pekerjaan") || key.includes("profesi") || key.includes("matapencaharian") || key === "job" || key.includes("pencaharian") || key.includes("bidangusaha")) {
      mapping[idx] = "pekerjaan";
      return;
    }

    // Nama
    if (key.includes("nama") || key === "name") {
      // Abaikan kolom metadata, kepesertaan, asuransi, faskes, dokter, petugas, dsb agar tidak salah terbaca sebagai nama pasien
      if (key.includes("kepesertaan") || key.includes("asuransi") || key.includes("faskes") || key.includes("dokter") ||
          key.includes("petugas") || key.includes("perawat") || key.includes("bidan") || key.includes("nakes") ||
          key.includes("obat") || key.includes("tindakan") || key.includes("diagnosa") || key.includes("instansi") || key.includes("perusahaan")) {
        return;
      }
      if (key.includes("sekolah") || key.includes("madrasah") || key.includes("satuanpendidikan")) {
        mapping[idx] = "sekolah";
      } else if (key.includes("wali") || key.includes("ibu") || key.includes("ortu") || key.includes("ayah") || key.includes("penanggungjawab")) {
        mapping[idx] = "namaWali";
      } else {
        // HANYA petakan sebagai nama pasien jika belum ada kolom yang dipetakan sebagai 'nama'!
        const alreadyHasNama = Object.values(mapping).includes("nama");
        if (!alreadyHasNama) {
          mapping[idx] = "nama";
        }
      }
      return;
    }

    // Tanggal Lahir / TTL
    if (key.includes("lahir") || key.includes("birth") || key.includes("ttl") || key === "dob") {
      if (key.includes("wali") || key.includes("ibu") || key.includes("ortu")) {
        mapping[idx] = "tanggalLahirWali";
      } else {
        mapping[idx] = "tanggalLahir";
      }
      return;
    }

    // Sekolah
    if (key.includes("sekolah") || key.includes("madrasah") || key.includes("satuanpendidikan") || key.includes("instansi")) {
      mapping[idx] = "sekolah";
      return;
    }

    // Kelas / Jenjang / Rombel (Khusus Sekolah, abaikan kelas rawat / tingkat faskes / BPJS)
    const isHospitalClass = /rawat|bpjs|kamar|tarif|tindakan|pelayanan|faskes|rujukan/i.test(key);
    if (!isHospitalClass && (key.includes("kelas") || key.includes("jenjang") || key.includes("rombel") || key.includes("tingkatkelas") || key.includes("tingkatsekolah"))) {
      mapping[idx] = "kelas";
      return;
    }

    // Kontak / WhatsApp / HP
    if (key.includes("wa") || key.includes("hp") || key.includes("telepon") || key.includes("telp") || key.includes("phone") || key.includes("kontak")) {
      if (key.includes("wali") || key.includes("ibu") || key.includes("ortu")) {
        mapping[idx] = "noHpWali";
      } else {
        mapping[idx] = "noWhatsapp";
      }
      return;
    }

    // Fisik: BB, TB, LP
    if (key.includes("berat") || key === "bb" || key.startsWith("bb")) { mapping[idx] = "bb"; return; }
    if (key.includes("tinggi") || key === "tb" || key.startsWith("tb") || key.includes("panjangbadan") || key === "pb") { mapping[idx] = "tb"; return; }
    if (key.includes("perut") || key.includes("pinggang") || key === "lp") { mapping[idx] = "lp"; return; }
    if (key.includes("sistol") || key === "td" || key.includes("tensi")) { mapping[idx] = "tdSistolik"; return; }
    if (key.includes("diastol")) { mapping[idx] = "tdDiastolik"; return; }
    if (key.includes("gula") || key === "gds" || key.includes("glukosa")) { mapping[idx] = "gulaDarah"; return; }
    if (key.includes("kolesterol") || key.includes("cholesterol")) { mapping[idx] = "kolesterolTotal"; return; }
    if (key.includes("hemoglobin") || key === "hb") { mapping[idx] = "hemoglobin"; return; }
    if (key.includes("karies") || key.includes("berlubang")) { mapping[idx] = "karies"; return; }
    if (key.includes("gigi")) { mapping[idx] = "gigi"; return; }
  });

  return mapping;
}

/**
 * Deteksi Provinsi, Kabupaten/Kota, Kecamatan, & Kelurahan dari NIK 16 Digit & Teks Alamat (Universal Seluruh Indonesia)
 */
function resolveWilayahUniversal(nik, alamatText = "") {
  const cleanNik = String(nik || "").replace(/\D/g, "");
  const addr = String(alamatText || "").trim();
  let prov = "", kab = "", kec = "", kel = "";

  if (addr) {
    const mKel = addr.match(/\b(?:kel(?:urahan)?|desa|ds|amp|kampung|nagari|gampong|pekon|lembang)\.?\s+([a-zA-Z0-9\s\-]{3,25}?)(?=\s*(?:,|\b(?:kec|kab|kota|prov|rt|rw|no|blok|kode)\b|$))/i);
    if (mKel && mKel[1]) kel = mKel[1].trim();
    const mKec = addr.match(/\b(?:kec(?:amatan)?|distrik|kap(?:anewon)?|kem(?:antren)?)\.?\s+([a-zA-Z0-9\s\-]{3,25}?)(?=\s*(?:,|\b(?:kel|desa|kab|kota|prov|rt|rw|no|blok|kode)\b|$))/i);
    if (mKec && mKec[1]) kec = mKec[1].trim();
    const mKab = addr.match(/\b(kab(?:upaten)?\.?\s+[a-zA-Z\s]{3,25}?|kota\s+[a-zA-Z\s]{3,25}?)(?=\s*(?:,|\b(?:kec|kel|desa|prov|rt|rw)\b|$))/i);
    if (mKab && mKab[1]) kab = mKab[1].trim();
  }

  if (cleanNik.length >= 4) {
    const nik2 = cleanNik.substring(0, 2);
    const nik4 = cleanNik.substring(0, 4);
    const nik6 = cleanNik.substring(0, 6);

    const nikProvMap = {
      "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
      "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Kepulauan Bangka Belitung", "21": "Kepulauan Riau",
      "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah", "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten",
      "51": "Bali", "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur",
      "61": "Kalimantan Barat", "62": "Kalimantan Tengah", "63": "Kalimantan Selatan", "64": "Kalimantan Timur", "65": "Kalimantan Utara",
      "71": "Sulawesi Utara", "72": "Sulawesi Tengah", "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "75": "Gorontalo", "76": "Sulawesi Barat",
      "81": "Maluku", "82": "Maluku Utara",
      "91": "Papua", "92": "Papua Barat", "93": "Papua Selatan", "94": "Papua Tengah", "95": "Papua Pegunungan", "96": "Papua Barat Daya"
    };

    const nikKabMap = {
      "1101": "Kab. Aceh Selatan", "1102": "Kab. Aceh Tenggara", "1103": "Kab. Aceh Timur", "1104": "Kab. Aceh Tengah", "1105": "Kab. Aceh Barat", "1106": "Kab. Aceh Besar", "1107": "Kab. Pidie", "1108": "Kab. Aceh Utara", "1109": "Kab. Simeulue", "1110": "Kab. Aceh Singkil", "1111": "Kab. Bireuen", "1112": "Kab. Aceh Barat Daya", "1113": "Kab. Gayo Lues", "1114": "Kab. Aceh Jaya", "1115": "Kab. Nagan Raya", "1116": "Kab. Aceh Tamiang", "1117": "Kab. Bener Meriah", "1118": "Kab. Pidie Jaya", "1171": "Kota Banda Aceh", "1172": "Kota Sabang", "1173": "Kota Lhokseumawe", "1174": "Kota Langsa", "1175": "Kota Subulussalam",
      "1201": "Kab. Tapanuli Tengah", "1202": "Kab. Tapanuli Utara", "1203": "Kab. Tapanuli Selatan", "1204": "Kab. Nias", "1205": "Kab. Langkat", "1206": "Kab. Karo", "1207": "Kab. Deli Serdang", "1208": "Kab. Simalungun", "1209": "Kab. Asahan", "1210": "Kab. Labuhanbatu", "1211": "Kab. Dairi", "1212": "Kab. Toba", "1213": "Kab. Mandailing Natal", "1214": "Kab. Nias Selatan", "1215": "Kab. Pakpak Bharat", "1216": "Kab. Humbang Hasundutan", "1217": "Kab. Samosir", "1218": "Kab. Serdang Bedagai", "1219": "Kab. Batu Bara", "1220": "Kab. Padang Lawas Utara", "1221": "Kab. Padang Lawas", "1222": "Kab. Labuhanbatu Selatan", "1223": "Kab. Labuhanbatu Utara", "1224": "Kab. Nias Utara", "1225": "Kab. Nias Barat", "1271": "Kota Medan", "1272": "Kota Pematangsiantar", "1273": "Kota Sibolga", "1274": "Kota Tanjungbalai", "1275": "Kota Binjai", "1276": "Kota Tebing Tinggi", "1277": "Kota Padangsidimpuan", "1278": "Kota Gunungsitoli",
      "1301": "Kab. Pesisir Selatan", "1302": "Kab. Solok", "1303": "Kab. Sijunjung", "1304": "Kab. Tanah Datar", "1305": "Kab. Padang Pariaman", "1306": "Kab. Agam", "1307": "Kab. Lima Puluh Kota", "1308": "Kab. Pasaman", "1309": "Kab. Kepulauan Mentawai", "1310": "Kab. Dharmasraya", "1311": "Kab. Solok Selatan", "1312": "Kab. Pasaman Barat", "1371": "Kota Padang", "1372": "Kota Solok", "1373": "Kota Sawahlunto", "1374": "Kota Padang Panjang", "1375": "Kota Bukittinggi", "1376": "Kota Payakumbuh", "1377": "Kota Pariaman",
      "1401": "Kab. Kampar", "1402": "Kab. Indragiri Hulu", "1403": "Kab. Bengkalis", "1404": "Kab. Indragiri Hilir", "1405": "Kab. Pelalawan", "1406": "Kab. Rokan Hulu", "1407": "Kab. Rokan Hilir", "1408": "Kab. Siak", "1409": "Kab. Kuantan Singingi", "1410": "Kab. Kepulauan Meranti", "1471": "Kota Pekanbaru", "1472": "Kota Dumai",
      "1501": "Kab. Kerinci", "1502": "Kab. Merangin", "1503": "Kab. Sarolangun", "1504": "Kab. Batanghari", "1505": "Kab. Muaro Jambi", "1506": "Kab. Tanjung Jabung Barat", "1507": "Kab. Tanjung Jabung Timur", "1508": "Kab. Bungo", "1509": "Kab. Tebo", "1571": "Kota Jambi", "1572": "Kota Sungai Penuh",
      "1601": "Kab. Ogan Komering Ulu", "1602": "Kab. Ogan Komering Ilir", "1603": "Kab. Muara Enim", "1604": "Kab. Lahat", "1605": "Kab. Musi Rawas", "1606": "Kab. Musi Banyuasin", "1607": "Kab. Banyuasin", "1608": "Kab. OKU Timur", "1609": "Kab. OKU Selatan", "1610": "Kab. Ogan Ilir", "1611": "Kab. Empat Lawang", "1612": "Kab. PALI", "1613": "Kab. Musi Rawas Utara", "1671": "Kota Palembang", "1672": "Kota Pagar Alam", "1673": "Kota Lubuklinggau", "1674": "Kota Prabumulih",
      "1701": "Kab. Bengkulu Selatan", "1702": "Kab. Rejang Lebong", "1703": "Kab. Bengkulu Utara", "1704": "Kab. Kaur", "1705": "Kab. Seluma", "1706": "Kab. Mukomuko", "1707": "Kab. Lebong", "1708": "Kab. Kepahiang", "1709": "Kab. Bengkulu Tengah", "1771": "Kota Bengkulu",
      "1801": "Kab. Lampung Selatan", "1802": "Kab. Lampung Tengah", "1803": "Kab. Lampung Utara", "1804": "Kab. Lampung Barat", "1805": "Kab. Tulang Bawang", "1806": "Kab. Tanggamus", "1807": "Kab. Lampung Timur", "1808": "Kab. Way Kanan", "1809": "Kab. Pesawaran", "1810": "Kab. Pringsewu", "1811": "Kab. Mesuji", "1812": "Kab. Tulang Bawang Barat", "1813": "Kab. Pesisir Barat", "1871": "Kota Bandar Lampung", "1872": "Kota Metro",
      "1901": "Kab. Bangka", "1902": "Kab. Belitung", "1903": "Kab. Bangka Selatan", "1904": "Kab. Bangka Tengah", "1905": "Kab. Bangka Barat", "1906": "Kab. Belitung Timur", "1971": "Kota Pangkalpinang",
      "2101": "Kab. Bintan", "2102": "Kab. Karimun", "2103": "Kab. Natuna", "2104": "Kab. Lingga", "2105": "Kab. Kepulauan Anambas", "2171": "Kota Batam", "2172": "Kota Tanjungpinang",
      "3101": "Kab. Kepulauan Seribu", "3171": "Kota Jakarta Pusat", "3172": "Kota Jakarta Utara", "3173": "Kota Jakarta Barat", "3174": "Kota Jakarta Selatan", "3175": "Kota Jakarta Timur",
      "3201": "Kab. Bogor", "3202": "Kab. Sukabumi", "3203": "Kab. Cianjur", "3204": "Kab. Bandung", "3205": "Kab. Garut", "3206": "Kab. Tasikmalaya", "3207": "Kab. Ciamis", "3208": "Kab. Kuningan", "3209": "Kab. Cirebon", "3210": "Kab. Majalengka", "3211": "Kab. Sumedang", "3212": "Kab. Indramayu", "3213": "Kab. Subang", "3214": "Kab. Purwakarta", "3215": "Kab. Karawang", "3216": "Kab. Bekasi", "3217": "Kab. Bandung Barat", "3218": "Kab. Pangandaran", "3271": "Kota Bogor", "3272": "Kota Sukabumi", "3273": "Kota Bandung", "3274": "Kota Cirebon", "3275": "Kota Bekasi", "3276": "Kota Depok", "3277": "Kota Cimahi", "3278": "Kota Tasikmalaya", "3279": "Kota Banjar",
      "3301": "Kab. Cilacap", "3302": "Kab. Banyumas", "3303": "Kab. Purbalingga", "3304": "Kab. Banjarnegara", "3305": "Kab. Kebumen", "3306": "Kab. Purworejo", "3307": "Kab. Wonosobo", "3308": "Kab. Magelang", "3309": "Kab. Boyolali", "3310": "Kab. Klaten", "3311": "Kab. Sukoharjo", "3312": "Kab. Wonogiri", "3313": "Kab. Karanganyar", "3314": "Kab. Sragen", "3315": "Kab. Grobogan", "3316": "Kab. Blora", "3317": "Kab. Rembang", "3318": "Kab. Pati", "3319": "Kab. Kudus", "3320": "Kab. Jepara", "3321": "Kab. Demak", "3322": "Kab. Semarang", "3323": "Kab. Temanggung", "3324": "Kab. Kendal", "3325": "Kab. Batang", "3326": "Kab. Pekalongan", "3327": "Kab. Pemalang", "3328": "Kab. Tegal", "3329": "Kab. Brebes", "3371": "Kota Magelang", "3372": "Kota Surakarta", "3373": "Kota Salatiga", "3374": "Kota Semarang", "3375": "Kota Pekalongan", "3376": "Kota Tegal",
      "3401": "Kab. Kulon Progo", "3402": "Kab. Bantul", "3403": "Kab. Gunungkidul", "3404": "Kab. Sleman", "3471": "Kota Yogyakarta",
      "3501": "Kab. Pacitan", "3502": "Kab. Ponorogo", "3503": "Kab. Trenggalek", "3504": "Kab. Tulungagung", "3505": "Kab. Blitar", "3506": "Kab. Kediri", "3507": "Kab. Malang", "3508": "Kab. Lumajang", "3509": "Kab. Jember", "3510": "Kab. Banyuwangi", "3511": "Kab. Bondowoso", "3512": "Kab. Situbondo", "3513": "Kab. Probolinggo", "3514": "Kab. Pasuruan", "3515": "Kab. Sidoarjo", "3516": "Kab. Mojokerto", "3517": "Kab. Jombang", "3518": "Kab. Nganjuk", "3519": "Kab. Madiun", "3520": "Kab. Magetan", "3521": "Kab. Ngawi", "3522": "Kab. Bojonegoro", "3523": "Kab. Tuban", "3524": "Kab. Lamongan", "3525": "Kab. Gresik", "3526": "Kab. Bangkalan", "3527": "Kab. Sampang", "3528": "Kab. Pamekasan", "3529": "Kab. Sumenep", "3571": "Kota Kediri", "3572": "Kota Blitar", "3573": "Kota Malang", "3574": "Kota Probolinggo", "3575": "Kota Pasuruan", "3576": "Kota Mojokerto", "3577": "Kota Madiun", "3578": "Kota Surabaya", "3579": "Kota Batu",
      "3601": "Kab. Pandeglang", "3602": "Kab. Lebak", "3603": "Kab. Tangerang", "3604": "Kab. Serang", "3671": "Kota Tangerang", "3672": "Kota Cilegon", "3673": "Kota Serang", "3674": "Kota Tangerang Selatan",
      "5101": "Kab. Jembrana", "5102": "Kab. Tabanan", "5103": "Kab. Badung", "5104": "Kab. Gianyar", "5105": "Kab. Klungkung", "5106": "Kab. Bangli", "5107": "Kab. Karangasem", "5108": "Kab. Buleleng", "5171": "Kota Denpasar",
      "5201": "Kab. Lombok Barat", "5202": "Kab. Lombok Tengah", "5203": "Kab. Lombok Timur", "5204": "Kab. Sumbawa", "5205": "Kab. Dompu", "5206": "Kab. Bima", "5207": "Kab. Sumbawa Barat", "5208": "Kab. Lombok Utara", "5271": "Kota Mataram", "5272": "Kota Bima",
      "5301": "Kab. Kupang", "5302": "Kab. Timor Tengah Selatan", "5303": "Kab. Timor Tengah Utara", "5304": "Kab. Belu", "5305": "Kab. Alor", "5306": "Kab. Flores Timur", "5307": "Kab. Sikka", "5308": "Kab. Ende", "5309": "Kab. Ngada", "5310": "Kab. Manggarai", "5311": "Kab. Sumba Timur", "5312": "Kab. Sumba Barat", "5313": "Kab. Lembata", "5314": "Kab. Rote Ndao", "5315": "Kab. Manggarai Barat", "5316": "Kab. Nagekeo", "5317": "Kab. Sumba Tengah", "5318": "Kab. Sumba Barat Daya", "5319": "Kab. Manggarai Timur", "5320": "Kab. Sabu Raijua", "5321": "Kab. Malaka", "5371": "Kota Kupang",
      "6101": "Kab. Sambas", "6102": "Kab. Mempawah", "6103": "Kab. Sanggau", "6104": "Kab. Ketapang", "6105": "Kab. Sintang", "6106": "Kab. Kapuas Hulu", "6107": "Kab. Bengkayang", "6108": "Kab. Landak", "6109": "Kab. Sekadau", "6110": "Kab. Melawi", "6111": "Kab. Kayong Utara", "6112": "Kab. Kubu Raya", "6171": "Kota Pontianak", "6172": "Kota Singkawang",
      "6201": "Kab. Kotawaringin Barat", "6202": "Kab. Kotawaringin Timur", "6203": "Kab. Kapuas", "6204": "Kab. Barito Selatan", "6205": "Kab. Barito Utara", "6206": "Kab. Katingan", "6207": "Kab. Seruyan", "6208": "Kab. Sukamara", "6209": "Kab. Lamandau", "6210": "Kab. Gunung Mas", "6211": "Kab. Pulang Pisau", "6212": "Kab. Murung Raya", "6213": "Kab. Barito Timur", "6271": "Kota Palangka Raya",
      "6301": "Kab. Tanah Laut", "6302": "Kab. Kotabaru", "6303": "Kab. Banjar", "6304": "Kab. Barito Kuala", "6305": "Kab. Tapin", "6306": "Kab. Hulu Sungai Selatan", "6307": "Kab. Hulu Sungai Tengah", "6308": "Kab. Hulu Sungai Utara", "6309": "Kab. Tabalong", "6310": "Kab. Tanah Bumbu", "6311": "Kab. Balangan", "6371": "Kota Banjarmasin", "6372": "Kota Banjarbaru",
      "6401": "Kab. Paser", "6402": "Kab. Kutai Kartanegara", "6403": "Kab. Berau", "6407": "Kab. Kutai Barat", "6408": "Kab. Kutai Timur", "6409": "Kab. Penajam Paser Utara", "6411": "Kab. Mahakam Ulu", "6471": "Kota Balikpapan", "6472": "Kota Samarinda", "6474": "Kota Bontang",
      "6501": "Kab. Bulungan", "6502": "Kab. Malinau", "6503": "Kab. Nunukan", "6504": "Kab. Tana Tidung", "6571": "Kota Tarakan",
      "7101": "Kab. Bolaang Mongondow", "7102": "Kab. Minahasa", "7103": "Kab. Kepulauan Sangihe", "7104": "Kab. Kepulauan Talaud", "7105": "Kab. Minahasa Selatan", "7106": "Kab. Minahasa Utara", "7107": "Kab. Minahasa Tenggara", "7108": "Kab. Bolaang Mongondow Utara", "7171": "Kota Manado", "7172": "Kota Bitung", "7173": "Kota Tomohon", "7174": "Kota Kotamobagu",
      "7201": "Kab. Banggai", "7202": "Kab. Poso", "7203": "Kab. Donggala", "7204": "Kab. Tolitoli", "7205": "Kab. Buol", "7206": "Kab. Morowali", "7207": "Kab. Banggai Kepulauan", "7208": "Kab. Parigi Moutong", "7209": "Kab. Tojo Una-Una", "7210": "Kab. Sigi", "7271": "Kota Palu",
      "7301": "Kab. Kepulauan Selayar", "7302": "Kab. Bulukumba", "7303": "Kab. Bantaeng", "7304": "Kab. Jeneponto", "7305": "Kab. Takalar", "7306": "Kab. Gowa", "7307": "Kab. Sinjai", "7308": "Kab. Bone", "7309": "Kab. Maros", "7310": "Kab. Pangkajene dan Kepulauan", "7311": "Kab. Barru", "7312": "Kab. Soppeng", "7313": "Kab. Wajo", "7314": "Kab. Sidenreng Rappang", "7315": "Kab. Pinrang", "7316": "Kab. Enrekang", "7317": "Kab. Luwu", "7318": "Kab. Tana Toraja", "7322": "Kab. Luwu Utara", "7324": "Kab. Luwu Timur", "7326": "Kab. Toraja Utara", "7371": "Kota Makassar", "7372": "Kota Parepare", "7373": "Kota Palopo",
      "7401": "Kab. Kolaka", "7402": "Kab. Konawe", "7403": "Kab. Muna", "7404": "Kab. Buton", "7405": "Kab. Konawe Selatan", "7406": "Kab. Bombana", "7407": "Kab. Wakatobi", "7408": "Kab. Kolaka Utara", "7471": "Kota Kendari", "7472": "Kota Baubau",
      "7501": "Kab. Gorontalo", "7502": "Kab. Boalemo", "7503": "Kab. Bone Bolango", "7504": "Kab. Pohuwato", "7505": "Kab. Gorontalo Utara", "7571": "Kota Gorontalo",
      "7601": "Kab. Pasangkayu", "7602": "Kab. Mamuju", "7603": "Kab. Mamasa", "7604": "Kab. Polewali Mandar", "7605": "Kab. Majene", "7606": "Kab. Mamuju Tengah",
      "8101": "Kab. Maluku Tengah", "8102": "Kab. Maluku Tenggara", "8103": "Kab. Kepulauan Tanimbar", "8104": "Kab. Buru", "8171": "Kota Ambon", "8172": "Kota Tual",
      "8201": "Kab. Halmahera Barat", "8202": "Kab. Halmahera Tengah", "8203": "Kab. Halmahera Utara", "8204": "Kab. Halmahera Selatan", "8271": "Kota Ternate", "8272": "Kota Tidore Kepulauan",
      "9101": "Kab. Merauke", "9102": "Kab. Jayawijaya", "9103": "Kab. Jayapura", "9104": "Kab. Nabire", "9106": "Kab. Biak Numfor", "9109": "Kab. Mimika", "9171": "Kota Jayapura",
      "9201": "Kab. Fakfak", "9202": "Kab. Manokwari", "9271": "Kota Sorong"
    };

    const wilMap6 = {
      "631104": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Batu Mandi", kel: "Gunung Manau" },
      "520108": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Gunungsari", kel: "Sesela" },
      "520101": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Gerung" },
      "520102": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Kediri" },
      "520103": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Narmada" },
      "520107": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Labuapi" },
      "520109": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Lingsar" },
      "520113": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Batu Layar" }
    };

    const m6 = wilMap6[nik6];
    if (m6) {
      prov = prov || m6.prov;
      kab = kab || m6.kab;
      kec = kec || m6.kec;
      if (!kel && m6.kel) kel = m6.kel;
    } else {
      if (!prov && nikProvMap[nik2]) prov = nikProvMap[nik2];
      if (!kab && nikKabMap[nik4]) kab = nikKabMap[nik4];
    }
  }

  return { prov, kab, kec, kel };
}

/**
 * Parsing Buffer File Excel / Sheet Data ke Array Pasien Ternormalisasi
 */
export function parseAndNormalizeWorkbook(workbook, options = {}) {
  const {
    dateFormat = "YYYY-MM-DD",
    defaultProvinsi = options.defaultProvinsi || "",
    defaultKabKota = options.defaultKabKota || "",
    defaultKecamatan = options.defaultKecamatan || "",
    defaultKelurahan = options.defaultKelurahan || "",
    defaultAlamat = options.defaultAlamat || "",
    defaultWali = null,
    enableDeduplication = true
  } = options;

  const allRawPatients = [];

  workbook.SheetNames.forEach(sheetName => {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;

    // Ambil data dalam bentuk 2D Array
    const sheetData = window.XLSX ? window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) : [];
    if (!sheetData || sheetData.length < 2) return;

    const { headerRowIndex } = detectHeaderRow(sheetData);
    const headerRow = sheetData[headerRowIndex] || [];
    const mapping = buildHeaderMapping(headerRow);

    for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row || !row.length) continue;

      const p = {};
      const textAccumulators = ["diagnosaText", "rpdText", "keluhanText", "tindakanText", "poliText"];

      Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
        const val = cleanText(row[colIdx]);
        if (!val) return;
        if (textAccumulators.includes(fieldKey)) {
          p[fieldKey] = p[fieldKey] ? (p[fieldKey] + " " + val) : val;
        } else {
          p[fieldKey] = val;
        }
      });

      // Abaikan baris kosong tanpa Nama atau NIK
      if (!p.nama && !p.nik) continue;
      if (p.nama && p.nama.toUpperCase().includes("CONTOH NAMA")) continue;

      // Normalisasi Dasar
      p.nik = normalizeNik(p.nik);
      p.tanggalLahir = normalizeDate(p.tanggalLahir, dateFormat, p.nik);
      p.jenisKelamin = normalizeGender(p.jenisKelamin, p.nik);
      p.noWhatsapp = normalizePhone(p.noWhatsapp);

      // Normalisasi Alamat jika ada kolom RT / RW / RT/RW terpisah
      if (p.rt || p.rw || p.rtRw) {
        const rtRwStr = p.rtRw ? `RT/RW ${p.rtRw}` : `RT ${p.rt || '000'} RW ${p.rw || '000'}`;
        if (!p.alamat) {
          p.alamat = rtRwStr;
        } else if (!p.alamat.toLowerCase().includes("rt")) {
          p.alamat = `${p.alamat} ${rtRwStr}`;
        }
      }

      // Deteksi & pulihkan otomatis jika kolom PROVINSI tidak sengaja terisi Pekerjaan (misal "Tidak Bekerja" akibat pergeseran kolom template 7-sheet vs Umum)
      const isJobOrStatusVal = v => /^(belum|tidak)\s*\/?\s*(belum|tidak)?\s*bekerja$|^tidak bekerja$|^belum bekerja$|ibu rumah tangga|\birt\b|mengurus rumah|wiraswasta|wirausaha|pedagang|petani|pekebun|nelayan|buruh|karyawan|pegawai|swasta|\bpns\b|\basn\b|\btni\b|\bpolri\b|pelajar|mahasiswa|pensiunan/i.test(String(v || "").trim());
      if (isJobOrStatusVal(p.provinsi)) {
        if (!p.pekerjaan) p.pekerjaan = p.provinsi;
        p.provinsi = p.kabupatenKota || "";
        p.kabupatenKota = p.kecamatan || "";
        p.kecamatan = p.kelurahan || "";
        p.kelurahan = (!isJobOrStatusVal(p.alamat) ? p.alamat : "") || "";
      }
      if (isJobOrStatusVal(p.provinsi)) p.provinsi = "";
      if (isJobOrStatusVal(p.kabupatenKota)) p.kabupatenKota = "";
      if (isJobOrStatusVal(p.kecamatan)) p.kecamatan = "";
      if (isJobOrStatusVal(p.kelurahan)) p.kelurahan = "";

      // Normalisasi Wilayah dari Excel -> Kode NIK (38 Provinsi & 514 Kab/Kota se-Indonesia) -> Default Options
      const wilNik = resolveWilayahUniversal(p.nik, p.alamat);
      p.provinsi = p.provinsi || wilNik.prov || defaultProvinsi;
      p.kabupatenKota = p.kabupatenKota || wilNik.kab || defaultKabKota;
      p.kecamatan = p.kecamatan || wilNik.kec || defaultKecamatan;
      p.kelurahan = p.kelurahan || wilNik.kel || defaultKelurahan;
      p.alamat = p.alamat || p.kelurahan || p.kecamatan || defaultAlamat;

      // Normalisasi Pekerjaan & Status Pernikahan
      p.statusPernikahan = p.statusPernikahan || "Belum Menikah";
      // Simpan pekerjaan persis dari Excel apa adanya. Jika kolom kosong/tanda strip atau status asuransi (PBI/BPJS), biarkan ""
      // agar Hardlock Pekerjaan di Pengaturan Pendaftaran dapat bekerja optimal!
      const rawJob = p.pekerjaan ? String(p.pekerjaan).trim() : "";
      const isInsuranceTerm = /^(pbi\b|non[\s-]*pbi|bpjs|kis\b|jamkesmas|jamsostek|asuransi\b|pasien\s*umum\b|^umum$|^mandiri$|apbn\b|apbd\b)/i.test(rawJob) ||
                              /\bpbi\b/i.test(rawJob);
      p.pekerjaan = (rawJob && rawJob !== "-" && rawJob !== "0" && !isInsuranceTerm)
        ? rawJob
        : "";

      // Normalisasi Data Hasil Pemeriksaan Klinis (Jika Tertera di File)
      p.bb = normalizeNumber(p.bb);
      p.tb = normalizeNumber(p.tb);
      p.lp = normalizeNumber(p.lp);
      p.lk = normalizeNumber(p.lk);
      p.lila = normalizeNumber(p.lila);
      p.tdSistolik = normalizeNumber(p.tdSistolik);
      p.tdDiastolik = normalizeNumber(p.tdDiastolik);
      p.gulaDarah = normalizeNumber(p.gulaDarah);
      p.gulaDarahPuasa = normalizeNumber(p.gulaDarahPuasa);
      p.hba1c = normalizeNumber(p.hba1c);
      p.kolesterolTotal = normalizeNumber(p.kolesterolTotal);
      p.trigliserida = normalizeNumber(p.trigliserida);
      p.hdl = normalizeNumber(p.hdl);
      p.ldl = normalizeNumber(p.ldl);
      p.ureum = normalizeNumber(p.ureum);
      p.kreatinin = normalizeNumber(p.kreatinin);
      p.hemoglobin = normalizeNumber(p.hemoglobin);
      p.kadarCo = normalizeNumber(p.kadarCo);
      p.chairStandDetik = normalizeNumber(p.chairStandDetik);

      // Status Merokok langsung dari file jika tersedia
      if (p.merokok) {
        const rawRokok = String(p.merokok).toLowerCase();
        if (rawRokok.includes("ya") || rawRokok === "1" || rawRokok === "true") p.merokok = "Ya";
        else if (rawRokok.includes("tidak") || rawRokok === "0" || rawRokok === "false") p.merokok = "Tidak";
      }

      // Deteksi Otomatis Kondisi Klinis dari Diagnosa, RPD, Keluhan & Poli
      const clinicalNotes = [
        p.diagnosaText || "",
        p.rpdText || "",
        p.keluhanText || "",
        p.poliText || "",
        p.tindakanText || ""
      ].join(" ").toLowerCase();

      if (clinicalNotes) {
        // Diabetes Melitus (E10-E14, DM, Gula Darah, Metformin, Glimepirid)
        if (!p.riwayatDiabetes) {
          if (/\b(e10|e11|e12|e13|e14|dm|diabetes|gula darah)\b/i.test(clinicalNotes)) {
            p.riwayatDiabetes = "Ya";
          }
        }
        // Hipertensi (I10, I11, I15, HT, Tensi Tinggi, Amlodipin)
        if (!p.riwayatHipertensi) {
          if (/\b(i10|i11|i15|ht|hipertensi|hypertension)\b/i.test(clinicalNotes)) {
            p.riwayatHipertensi = "Ya";
          }
        }
        // Gigi & Karies (K00-K08, Caries, Gigi Goyang, Cabut Gigi, Poli Gigi)
        if (!p.karies) {
          if (/\b(k02|k04|caries|karies|berlubang|gigi lubang)\b/i.test(clinicalNotes)) {
            p.karies = "Ada Lubang";
            p.gigi = "Ada Masalah";
          }
        }
        if (!p.gigi) {
          if (/\b(poli gigi|k00|k01|k03|k05|k06|k08|gingivitis|pulpitis|cabut gigi|tambal gigi)\b/i.test(clinicalNotes)) {
            p.gigi = "Ada Masalah";
          }
        }
        // Mata & Katarak (H00-H59, Katarak, Pterygium, Conjunctivitis, Rabun)
        if (!p.katarak) {
          if (/\b(katarak|h25|h26|cataract)\b/i.test(clinicalNotes)) {
            p.katarak = "Ya";
            p.mata = "Ada Masalah";
          }
        }
        if (!p.mata) {
          if (/\b(h00|h10|h11|h52|pterygium|conjunctivitis|mata|visus|penglihatan)\b/i.test(clinicalNotes)) {
            p.mata = "Ada Masalah";
          }
        }
        // Telinga (H60-H95, Otitis, Telinga, Nyeri Telinga)
        if (!p.telinga) {
          if (/\b(h60|h66|h81|h90|otitis|telinga|pendengaran|congek)\b/i.test(clinicalNotes)) {
            p.telinga = "Ada Masalah";
          }
        }
        // TBC (A15-A16, Z03.0, Batuk 2 Minggu, Batuk Lama, TBC, Tuberculosis)
        if (!p.gejalaTbc) {
          if (/\b(a15|a16|z03\.0|tbc|tb paru|tuberculosis|batuk lama|batuk sudah lama)\b/i.test(clinicalNotes)) {
            p.gejalaTbc = "Ya";
          }
        }
        // Skabies (B86, Scabies, Skabies, Gudik, Kutu Air)
        if (!p.skabies) {
          if (/\b(b86|scabies|skabies|gudik)\b/i.test(clinicalNotes)) {
            p.skabies = "Ya";
          }
        }
        // Kehamilan (Z34, Z35, O00-O99, Ibu Hamil, TM 1, TM 2, TM 3, G1P0, G2P1)
        if (!p.sedangHamil) {
          if (/\b(z34|z35|ibu hamil|hamil|kehamilan|g1p0|g2p1|hpht)\b/i.test(clinicalNotes)) {
            p.sedangHamil = "Ya";
          }
        }
      }

      // Tentukan Kategori CKG Otomatis
      p.category = determineCkgCategory(p);

      // PENTING: Untuk pendaftaran CKG SEKOLAH, HANYA simpan data pendaftaran (tanpa hasil pemeriksaan klinis)
      const isSekolahCategory = p.category === "SEKOLAH_SD" || p.category === "REMAJA" || Boolean(p.sekolah || p.namasekolah || p.namaSekolah);
      if (isSekolahCategory) {
        const examFields = [
          "bb", "tb", "berat_badan", "tinggi_badan", "lp", "lingkar_perut", "lk", "lingkar_kepala",
          "lila", "lingkar_lengan", "caraUkur", "cara_ukur", "tdSistolik", "td_sistolik", "sistolik",
          "tdDiastolik", "td_diastolik", "diastolik", "gulaDarah", "gula_darah", "gds",
          "gulaDarahPuasa", "gdp", "kolesterolTotal", "kolesterol", "kolesterol_total",
          "hemoglobin", "hb", "kadarCo", "kadar_co", "gigi", "karies", "mata", "kacamata",
          "butaWarna", "telinga", "kebugaran", "gejalaTbc", "kusta", "frambusia", "skabies",
          "imt", "statusGizi", "diagnosaText"
        ];
        examFields.forEach(k => { delete p[k]; });
        if (!p.pekerjaan) {
          p.pekerjaan = "Pelajar/Mahasiswa";
        }
        if (!p.statusPernikahan) {
          p.statusPernikahan = "Belum Menikah";
        }
      }

      // Dukungan fallback cerdas jika data wali bergeser di Excel balita.xlsx (EKSKLUSIF KHUSUS BALITA!)
      if (p.category === "BALITA") {
        if (!p.nikWali && p.merokok && /^\d{16}$/.test(String(p.merokok).trim())) p.nikWali = String(p.merokok).trim();
        if (!p.namaWali && p.bb && typeof p.bb === "string" && /[a-zA-Z]{3,}/.test(p.bb)) p.namaWali = String(p.bb).trim();
        if (!p.tanggalLahirWali && p.tb && String(p.tb).trim()) p.tanggalLahirWali = p.tb;
        if (!p.noHpWali && p.tdSistolik && /^08|\+?62/.test(String(p.tdSistolik).trim())) p.noHpWali = String(p.tdSistolik).trim();
      }

      // Normalisasi Data Wali dari options (hanya jika diisi oleh pengguna di UI)
      const hasConfiguredWali = Boolean(
        defaultWali &&
        (defaultWali.nikWali || defaultWali.namaWali || defaultWali.nik || defaultWali.nama)
      );
      const cleanDefNikWali = normalizeNik(defaultWali?.nikWali || defaultWali?.nik || "") || "";
      const effectiveHardlockWali = hasConfiguredWali ? {
        nikWali: cleanDefNikWali,
        namaWali: String(defaultWali?.namaWali || defaultWali?.nama || "").trim(),
        tanggalLahirWali: normalizeDate(defaultWali?.tanggalLahirWali || defaultWali?.tglLahirWali || defaultWali?.tanggalLahir || "", dateFormat, cleanDefNikWali) || "",
        jenisKelaminWali: normalizeGender(defaultWali?.jenisKelaminWali || defaultWali?.jkWali || defaultWali?.jenisKelamin || "", cleanDefNikWali) || "",
        noHpWali: normalizePhone(defaultWali?.noHpWali || defaultWali?.noHp || "") || ""
      } : null;

      if (!p.namaWali) {
        if (p.namaIbu) p.namaWali = p.namaIbu;
        else if (p.namaAyah) p.namaWali = p.namaAyah;
      }
      const hasExcelWali = Boolean(
        (p.nikWali && String(p.nikWali).replace(/\D/g, "").length >= 10) ||
        (p.namaWali && String(p.namaWali).trim().length >= 2)
      );

      if (hasExcelWali) {
        p.nikWali = normalizeNik(p.nikWali);
        p.tanggalLahirWali = normalizeDate(p.tanggalLahirWali, dateFormat, p.nikWali);
        p.jenisKelaminWali = normalizeGender(p.jenisKelaminWali, p.nikWali);
        if (p.noHpWali) p.noHpWali = normalizePhone(p.noHpWali);
        if (!p.noHpWali && p.noWhatsapp) p.noHpWali = p.noWhatsapp;
        p._waliSource = "excel";
      }

      // Jika kategori BALITA atau belum punya NIK 16 digit, lengkapi field Wali HANYA jika pengguna telah mengonfigurasi Hardlock Wali
      const needsWaliFallback = p.category === "BALITA" || !p.nik || p.nik.length !== 16;
      if (needsWaliFallback && effectiveHardlockWali) {
        if (!p.nikWali || p.nikWali.length !== 16) {
          if (effectiveHardlockWali.nikWali) p.nikWali = effectiveHardlockWali.nikWali;
        }
        p.tanggalLahirWali = normalizeDate(p.tanggalLahirWali, dateFormat, p.nikWali);
        p.jenisKelaminWali = normalizeGender(p.jenisKelaminWali, p.nikWali);
        if (p.noHpWali) p.noHpWali = normalizePhone(p.noHpWali);
        if (!p.noHpWali && p.noWhatsapp) p.noHpWali = p.noWhatsapp;

        p.namaWali = p.namaWali || effectiveHardlockWali.namaWali;
        p.tanggalLahirWali = p.tanggalLahirWali || effectiveHardlockWali.tanggalLahirWali;
        p.jenisKelaminWali = p.jenisKelaminWali || effectiveHardlockWali.jenisKelaminWali;
        p.noHpWali = p.noHpWali || effectiveHardlockWali.noHpWali;
        if (!p._waliSource && (effectiveHardlockWali.namaWali || effectiveHardlockWali.nikWali)) p._waliSource = "hardlock";
      } else if (!hasExcelWali) {
        // Hanya hapus field wali jika memang tidak ada data wali di Excel dan Hardlock Wali tidak diatur
        delete p.nikWali;
        delete p.namaWali;
        delete p.tanggalLahirWali;
        delete p.jenisKelaminWali;
        delete p.noHpWali;
      }

      // Validasi NIK 16 digit
      p.isNikValid = Boolean(p.nik && p.nik.length === 16);

      allRawPatients.push(p);
    }
  });

  // Jalankan Penggabungan & Deduplikasi Cerdas Multi-File
  const finalPatients = enableDeduplication ? mergeAndDeduplicatePatients(allRawPatients) : allRawPatients;

  return {
    totalRaw: allRawPatients.length,
    totalClean: finalPatients.length,
    duplicatesRemoved: allRawPatients.length - finalPatients.length,
    patients: finalPatients
  };
}

/**
 * Menggabungkan dua rekaman pasien yang cocok (Cross-File Merging)
 * Sifat: Komplementer & Pengayaan data (enrichment).
 * Jika file A memiliki kolom A-C dan file B memiliki data pemeriksaan lengkap,
 * keduanya disatukan menjadi 1 profil pasien terpadu tanpa duplikasi.
 */
export function mergePatientRecords(target, source) {
  if (!target || !source) return target || source;

  // 1. NIK: Prioritaskan NIK 16 digit valid jika target sebelumnya kosong/tidak valid
  const targetNikClean = String(target.nik || "").replace(/\D/g, "");
  const sourceNikClean = String(source.nik || "").replace(/\D/g, "");
  if (targetNikClean.length !== 16 && sourceNikClean.length === 16) {
    target.nik = sourceNikClean;
    target.isNikValid = true;
  }

  // 2. Identitas Pokok & Demografi
  if ((!target.nama || target.nama.length < 3) && source.nama) {
    target.nama = source.nama;
  }
  if (!target.tanggalLahir && source.tanggalLahir) {
    target.tanggalLahir = source.tanggalLahir;
  }
  if ((!target.jenisKelamin || (target.jenisKelamin === "Laki-laki" && source.jenisKelamin === "Perempuan")) && source.jenisKelamin) {
    target.jenisKelamin = source.jenisKelamin;
  }
  if (target.nik && String(target.nik).replace(/\D/g, "").length === 16) {
    target.jenisKelamin = normalizeGender(target.jenisKelamin, target.nik) || target.jenisKelamin;
    if (!target.tanggalLahir) target.tanggalLahir = normalizeDate("", "YYYY-MM-DD", target.nik);
  }

  // 3. Kontak / No HP / WhatsApp: Nomor valid (>=9 digit, bukan dummy 00/000/0) diprioritaskan
  const isRealPhone = (ph) => {
    const s = String(ph || "").replace(/\D/g, "");
    return s.length >= 9 && !/^0+$/.test(s) && s !== "0810000000000" && s !== "1";
  };
  if (!isRealPhone(target.noWhatsapp) && isRealPhone(source.noWhatsapp)) {
    target.noWhatsapp = source.noWhatsapp;
  }

  // 4. Nomor eRM & BPJS / Asuransi (untuk pelacakan terpadu)
  if (!target.noErm && source.noErm) target.noErm = source.noErm;
  if (!target.noAsuransi && source.noAsuransi) target.noAsuransi = source.noAsuransi;

  // 5. Alamat & Wilayah Domisili
  if ((!target.alamat || target.alamat === "Jl. Martadireja II RT 02/03" || target.alamat === "Dusun Kebun Indah") && source.alamat && source.alamat !== "Dusun Kebun Indah" && source.alamat !== "Jl. Martadireja II RT 02/03") {
    target.alamat = source.alamat;
  } else if (source.alamat && !target.alamat.toLowerCase().includes("rt") && (source.alamat.toLowerCase().includes("rt") || source.rt || source.rw || source.rtRw)) {
    const rtRwInfo = source.rtRw ? `RT/RW ${source.rtRw}` : (source.rt ? `RT ${source.rt} RW ${source.rw || '000'}` : "");
    if (rtRwInfo && !target.alamat.includes(rtRwInfo)) {
      target.alamat = `${target.alamat} ${rtRwInfo}`.trim();
    }
  }
  if ((!target.kelurahan || target.kelurahan === "ARCAWINANGUN" || target.kelurahan === "SESELA") && source.kelurahan) target.kelurahan = source.kelurahan;
  if ((!target.kecamatan || target.kecamatan === "PURWOKERTO TIMUR" || target.kecamatan === "GUNUNGSARI") && source.kecamatan) target.kecamatan = source.kecamatan;
  if ((!target.kabupatenKota || target.kabupatenKota === "Kab. Banyumas" || target.kabupatenKota === "Kab. Lombok Barat") && source.kabupatenKota) target.kabupatenKota = source.kabupatenKota;
  if (!target.provinsi && source.provinsi) target.provinsi = source.provinsi;

  // 6. Pekerjaan & Status Pernikahan
  if ((!target.pekerjaan || target.pekerjaan === "Belum/Tidak Bekerja") && source.pekerjaan && source.pekerjaan !== "Belum/Tidak Bekerja") {
    target.pekerjaan = source.pekerjaan;
  }
  if ((!target.statusPernikahan || target.statusPernikahan === "Belum Menikah") && source.statusPernikahan && source.statusPernikahan !== "Belum Menikah") {
    target.statusPernikahan = source.statusPernikahan;
  }

  // 7. Wali Balita & Identitas Ortu (Gabungkan jika ada di salah satu sumber)
  if (target.category === "BALITA" || source.category === "BALITA" || source.nikWali || source.namaWali) {
    if ((!target.namaWali || target._waliSource === "hardlock") && source.namaWali) {
      target.namaWali = source.namaWali;
      if (source._waliSource === "excel") target._waliSource = "excel";
    }
    if ((!target.nikWali || String(target.nikWali).length !== 16 || target._waliSource === "hardlock") && source.nikWali && String(source.nikWali).length === 16) {
      target.nikWali = source.nikWali;
      if (source._waliSource === "excel") target._waliSource = "excel";
    }
    if ((!target.tanggalLahirWali || target._waliSource === "hardlock") && source.tanggalLahirWali) target.tanggalLahirWali = source.tanggalLahirWali;
    if ((!target.jenisKelaminWali || target._waliSource === "hardlock") && source.jenisKelaminWali) target.jenisKelaminWali = source.jenisKelaminWali;
    if (!isRealPhone(target.noHpWali) && isRealPhone(source.noHpWali)) target.noHpWali = source.noHpWali;
  }

  // 8. Sekolah & Kelas
  if (!target.sekolah && source.sekolah) target.sekolah = source.sekolah;
  if (!target.kelas && source.kelas) target.kelas = source.kelas;

  // 9. Pemeriksaan Fisik & Klinis Terukur (Angka Positif Nyata Menggantikan Data Kosong/0)
  const numFields = [
    "bb", "tb", "lp", "lk", "lila", "tdSistolik", "tdDiastolik", "gulaDarah",
    "gulaDarahPuasa", "hba1c", "kolesterolTotal", "trigliserida", "hdl", "ldl",
    "ureum", "kreatinin", "proteinUrin", "hemoglobin", "kadarCo", "chairStandDetik"
  ];
  numFields.forEach(k => {
    const sNum = parseFloat(String(source[k] || "").replace(",", "."));
    const tNum = parseFloat(String(target[k] || "").replace(",", "."));
    if ((isNaN(tNum) || tNum <= 0) && !isNaN(sNum) && sNum > 0) {
      target[k] = String(sNum);
    }
  });

  // 10. Indikator Klinis Kategori & Skrining (Abnormal / Positif diprioritaskan)
  const flagFields = [
    "caraUkur", "anemia", "telinga", "mata", "katarak", "kacamata", "butaWarna",
    "gigi", "karies", "merokok", "riwayatDiabetes", "durasiDiabetesBulan",
    "riwayatHipertensi", "kebugaran", "menstruasi", "sedangHamil",
    "sadanis", "iva", "hpvDna", "statusImunisasi", "kpsp", "mchat",
    "pumaScore", "kankerParu", "kankerUsus", "kesehatanJiwaSrq20",
    "gejalaCemas", "gejalaDepresi", "gejalaTbc", "kusta", "frambusia", "skabies",
    "malaria", "hepatitisB", "hepatitisC", "hiv", "sifilis",
    "skilasKognitif", "skilasMobilisasi", "skilasMalnutrisi", "skilasDepresi", "barthelIndexAdl"
  ];
  flagFields.forEach(k => {
    if (!target[k] && source[k]) {
      target[k] = source[k];
    } else if (source[k] && source[k] !== "Normal" && source[k] !== "Tidak" && source[k] !== "Tidak Ada") {
      target[k] = source[k];
    }
  });

  // Gabungkan Diagnosa & Catatan Medis
  if (source.diagnosaText && !target.diagnosaText?.includes(source.diagnosaText)) {
    target.diagnosaText = (target.diagnosaText ? target.diagnosaText + " | " : "") + source.diagnosaText;
  }

  // Hitung ulang kategori pasien berdasarkan data yang telah diperkaya
  target.category = determineCkgCategory(target);
  if (target.category !== "BALITA" && !target.nikWali && !target.namaWali) {
    delete target.nikWali;
    delete target.namaWali;
    delete target.tanggalLahirWali;
    delete target.jenisKelaminWali;
    delete target.noHpWali;
  }

  return target;
}

/**
 * Deduplikasi & Penggabungan Cerdas Multi-File
 * Menggabungkan rekaman data pasien ganda dari berbagai file secara multi-kunci (NIK, eRM, BPJS, Nama+DOB).
 */
export function mergeAndDeduplicatePatients(patients) {
  const canonicalList = [];
  const nikMap = new Map();
  const ermMap = new Map();
  const bpjsMap = new Map();
  const nameDobMap = new Map();

  function registerKeys(record) {
    const cleanNik = String(record.nik || "").replace(/\D/g, "");
    if (cleanNik.length === 16) nikMap.set(cleanNik, record);

    const cleanErm = String(record.noErm || "").trim();
    if (cleanErm && cleanErm.length >= 4) ermMap.set(cleanErm, record);

    const cleanBpjs = String(record.noAsuransi || "").replace(/\D/g, "");
    if (cleanBpjs && cleanBpjs.length >= 8) bpjsMap.set(cleanBpjs, record);

    const nameKey = cleanKey(record.nama);
    const dobKey = record.tanggalLahir || "";
    if (nameKey && nameKey.length >= 3) {
      nameDobMap.set(`${nameKey}_${dobKey}`, record);
    }
  }

  patients.forEach(p => {
    if (!p) return;
    const cleanNik = String(p.nik || "").replace(/\D/g, "");
    const cleanErm = String(p.noErm || "").trim();
    const cleanBpjs = String(p.noAsuransi || "").replace(/\D/g, "");
    const nameKey = cleanKey(p.nama);
    const dobKey = p.tanggalLahir || "";
    const nameDobKey = nameKey && nameKey.length >= 3 ? `${nameKey}_${dobKey}` : null;

    // 1. Cari apakah pasien ini sudah ada di salah satu indeks kunci
    let match = null;
    if (cleanNik.length === 16 && nikMap.has(cleanNik)) {
      match = nikMap.get(cleanNik);
    } else if (cleanErm && cleanErm.length >= 4 && ermMap.has(cleanErm)) {
      match = ermMap.get(cleanErm);
    } else if (cleanBpjs && cleanBpjs.length >= 8 && bpjsMap.has(cleanBpjs)) {
      match = bpjsMap.get(cleanBpjs);
    } else if (nameDobKey && nameDobMap.has(nameDobKey)) {
      match = nameDobMap.get(nameDobKey);
    }

    if (match) {
      // 2. Pasien sudah ada: Gabungkan field pelengkap (merge & enrich)
      mergePatientRecords(match, p);
      // Daftarkan ulang identitas baru jika berhasil diperkaya
      registerKeys(match);
    } else {
      // 3. Pasien baru: Daftarkan ke daftar kanonikal
      const newRec = { ...p };
      canonicalList.push(newRec);
      registerKeys(newRec);
    }
  });

  return canonicalList;
}

export const deduplicatePatients = mergeAndDeduplicatePatients;

// ==============================================================================
// 5. EXPORTER FORMAT RESMI templates_excel (SheetJS)
// ==============================================================================

/**
 * Format Baris Pasien ke Format Kolom Template Spesifik
 */
export function mapPatientToTemplateRow(patient, templateKey) {
  const p = patient || {};
  const row = [];

  switch (templateKey) {
    case "BALITA":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.statusPernikahan || "Belum Menikah", p.pekerjaan || "Belum/Tidak Bekerja",
        p.nikWali || "", p.namaWali || "", p.tanggalLahirWali || "", p.jenisKelaminWali || "", p.noHpWali || "",
        p.bb || "", p.tb || "", p.caraUkur || "Berdiri", p.lk || "", p.lila || "",
        p.statusImunisasi || "Lengkap", p.kpsp || "Sesuai", p.mchat || "Normal",
        p.gulaDarah || "", p.telinga || "Normal", p.mata || "Normal", p.gigi || "Normal",
        p.gejalaTbc || "Tidak", p.kusta || "Tidak", p.frambusia || "Tidak", p.skabies || "Tidak"
      ];

    case "SEKOLAH_SD":
      return [
        p.sekolah || "", p.kelas || "", p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.gigi || "Normal", p.karies || "Tidak Ada", p.mata || "Normal", p.kacamata || "Tidak",
        p.butaWarna || "Normal", p.telinga || "Normal", p.kebugaran || "Baik",
        p.gejalaTbc || "Tidak", p.kusta || "Tidak", p.frambusia || "Tidak", p.skabies || "Tidak"
      ];

    case "REMAJA":
      return [
        p.sekolah || "", p.kelas || "", p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.hemoglobin || "", p.anemia || "Tidak Anemia", p.merokok || "Tidak", p.kadarCo || "2",
        p.menstruasi || "Teratur", p.gigi || "Normal", p.karies || "Tidak Ada", p.mata || "Normal",
        p.kacamata || "Tidak", p.telinga || "Normal", p.kebugaran || "Baik",
        p.gejalaCemas || "Tidak", p.gejalaDepresi || "Tidak", p.gejalaTbc || "Tidak",
        p.kusta || "Tidak", p.frambusia || "Tidak", p.skabies || "Tidak"
      ];

    case "DEWASA_LAKI":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Menikah", p.pekerjaan || "Wiraswasta / Pedagang",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.gulaDarahPuasa || "", p.hba1c || "", p.merokok || "Tidak", p.kadarCo || "3",
        p.riwayatDiabetes || "Tidak", p.durasiDiabetesBulan || "0", p.riwayatHipertensi || "Tidak",
        p.kolesterolTotal || "", p.trigliserida || "", p.hdl || "", p.ldl || "",
        p.ureum || "", p.kreatinin || "", p.proteinUrin || "Negatif", p.hemoglobin || "",
        p.telinga || "Normal", p.mata || "Normal", p.katarak || "Normal", p.gigi || "Normal",
        p.pumaScore || "Normal", p.kankerParu || "Tidak Berisiko", p.kankerUsus || "Tidak Berisiko",
        p.kesehatanJiwaSrq20 || "Normal", p.gejalaTbc || p.tbc || "Tidak", p.kusta || "Tidak",
        p.frambusia || "Tidak", p.skabies || "Tidak", p.malaria || "Non-Reaktif",
        p.hepatitisB || "Non-Reaktif", p.hepatitisC || "Non-Reaktif", p.hiv || "Non-Reaktif", p.sifilis || "Non-Reaktif"
      ];

    case "DEWASA_PEREMPUAN":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Menikah", p.pekerjaan || "Ibu Rumah Tangga",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.sedangHamil || "Tidak", p.rencanaMenikah || "Tidak", p.hubunganIntim || "Ya",
        p.sadanis || "Normal", p.iva || "Negatif", p.hpvDna || "Negatif", p.catinPerempuan || "Tidak",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.gulaDarahPuasa || "", p.hba1c || "", p.merokok || "Tidak", p.kadarCo || "2",
        p.riwayatDiabetes || "Tidak", p.durasiDiabetesBulan || "0", p.riwayatHipertensi || "Tidak",
        p.kolesterolTotal || "", p.trigliserida || "", p.hdl || "", p.ldl || "",
        p.ureum || "", p.kreatinin || "", p.proteinUrin || "Negatif", p.hemoglobin || "", p.anemia || "Tidak Anemia",
        p.telinga || "Normal", p.mata || "Normal", p.katarak || "Normal", p.gigi || "Normal",
        p.pumaScore || "Normal", p.kankerParu || "Tidak Berisiko", p.kankerUsus || "Tidak Berisiko",
        p.kesehatanJiwaSrq20 || "Normal", p.gejalaTbc || p.tbc || "Tidak", p.kusta || "Tidak",
        p.frambusia || "Tidak", p.skabies || "Tidak", p.malaria || "Non-Reaktif",
        p.hepatitisB || "Non-Reaktif", p.hepatitisC || "Non-Reaktif", p.hiv || "Non-Reaktif", p.sifilis || "Non-Reaktif"
      ];

    case "LANSIA_LAKI":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Menikah", p.pekerjaan || "Tidak Bekerja",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.skilasKognitif || "Normal", p.skilasMobilisasi || "Normal", p.chairStandDetik || "11.2",
        p.skilasMalnutrisi || "Normal", p.skilasDepresi || "Normal", p.barthelIndexAdl || "Mandiri (Skor 20)",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.gulaDarahPuasa || "", p.hba1c || "", p.merokok || "Tidak", p.kadarCo || "3",
        p.riwayatDiabetes || "Tidak", p.durasiDiabetesBulan || "0", p.riwayatHipertensi || "Tidak",
        p.kolesterolTotal || "", p.trigliserida || "", p.hdl || "", p.ldl || "",
        p.ureum || "", p.kreatinin || "", p.proteinUrin || "Negatif", p.hemoglobin || "",
        p.telinga || "Normal", p.mata || "Normal", p.katarak || "Normal", p.gigi || "Normal",
        p.pumaScore || "Normal", p.kankerParu || "Tidak Berisiko", p.kankerUsus || "Tidak Berisiko",
        p.kesehatanJiwaSrq20 || "Normal", p.gejalaTbc || p.tbc || "Tidak", p.kusta || "Tidak",
        p.frambusia || "Tidak", p.skabies || "Tidak", p.malaria || "Non-Reaktif",
        p.hepatitisB || "Non-Reaktif", p.hepatitisC || "Non-Reaktif", p.hiv || "Non-Reaktif", p.sifilis || "Non-Reaktif"
      ];

    case "LANSIA_PEREMPUAN":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Cerai Mati", p.pekerjaan || "Tidak Bekerja",
        p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.skilasKognitif || "Normal", p.skilasMobilisasi || "Normal", p.chairStandDetik || "12.0",
        p.skilasMalnutrisi || "Normal", p.skilasDepresi || "Normal", p.barthelIndexAdl || "Mandiri (Skor 20)",
        p.sadanis || "Normal", p.iva || "Negatif",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.gulaDarahPuasa || "", p.hba1c || "", p.merokok || "Tidak", p.kadarCo || "2",
        p.riwayatDiabetes || "Tidak", p.durasiDiabetesBulan || "0", p.riwayatHipertensi || "Tidak",
        p.kolesterolTotal || "", p.trigliserida || "", p.hdl || "", p.ldl || "",
        p.ureum || "", p.kreatinin || "", p.proteinUrin || "Negatif", p.hemoglobin || "",
        p.telinga || "Normal", p.mata || "Normal", p.katarak || "Normal", p.gigi || "Normal",
        p.pumaScore || "Normal", p.kankerParu || "Tidak Berisiko", p.kankerUsus || "Tidak Berisiko",
        p.kesehatanJiwaSrq20 || "Normal", p.gejalaTbc || p.tbc || "Tidak", p.kusta || "Tidak",
        p.frambusia || "Tidak", p.skabies || "Tidak", p.malaria || "Non-Reaktif",
        p.hepatitisB || "Non-Reaktif", p.hepatitisC || "Non-Reaktif", p.hiv || "Non-Reaktif", p.sifilis || "Non-Reaktif"
      ];

    case "BALITA_LEGACY":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Belum Menikah", p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "",
        p.alamat || "", p.pekerjaan || "Belum/Tidak Bekerja", p.merokok || "tidak",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.nikWali || "", p.namaWali || "", p.tanggalLahirWali || "", p.jenisKelaminWali || "", p.noHpWali || ""
      ];

    case "SEKOLAH_LEGACY":
      return [
        p.nama || "", p.kelas || "", p.sekolah || "", p.jenisKelamin || "", p.nik || "", p.tanggalLahir || "",
        p.noWhatsapp || "", p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "", p.alamat || "",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.karies || "", p.kebugaran || "", p.menstruasi || "", p.kacamata || ""
      ];

    case "UMUM_LEGACY":
      return [
        p.nik || "", p.nama || "", p.tanggalLahir || "", p.jenisKelamin || "", p.noWhatsapp || "",
        p.statusPernikahan || "Menikah", p.provinsi || "", p.kabupatenKota || "", p.kecamatan || "", p.kelurahan || "",
        p.alamat || "", p.pekerjaan || "Lainnya", p.merokok || "tidak",
        p.bb || "", p.tb || "", p.lp || "", p.tdSistolik || "", p.tdDiastolik || "", p.gulaDarah || "",
        p.telinga || "Normal", p.mata || "Normal", p.gigi || "Normal", p.katarak || "Normal"
      ];

    default:
      return [];
  }
}

/**
 * Buat Sheet dengan format string aman (NIK '@')
 */
export function createFormattedSheet(headers, rowsData) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Library SheetJS (XLSX) tidak ditemukan.");

  const ws = {};
  const range = { s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: Math.max(1, rowsData.length) } };

  // Tulis Header di Baris 0
  headers.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ c: colIdx, r: 0 });
    ws[cellRef] = { v: h, t: "s" };
  });

  // Tulis Data Pasien mulai Baris 1
  rowsData.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ c: colIdx, r: rowIdx + 1 });
      const strVal = String(val ?? "");
      const headerName = headers[colIdx] ? headers[colIdx].toUpperCase() : "";

      // Khusus NIK & No HP wajib format string ('s') dengan format cell '@'
      if (headerName.includes("NIK") || headerName.includes("WHATSAPP") || headerName.includes("HP") || headerName.includes("TELEPON")) {
        ws[cellRef] = { v: strVal, t: "s", z: "@" };
      } else {
        ws[cellRef] = { v: strVal, t: "s" };
      }
    });
  });

  ws["!ref"] = XLSX.utils.encode_range(range);

  // Lebar kolom otomatis
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rowsData.forEach(r => {
      const len = String(r[i] ?? "").length;
      if (len > max) max = len;
    });
    return { wch: Math.max(max + 4, 14) };
  });
  ws["!cols"] = colWidths;

  return ws;
}

/**
 * Buat Workbook Master CKG Umum (Multi-sheet)
 */
export function generateMasterUmumWorkbook(patients) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const sheets = [
    { title: "Dewasa Laki-Laki", key: "DEWASA_LAKI", filter: p => p.category === "DEWASA_LAKI" },
    { title: "Dewasa Perempuan", key: "DEWASA_PEREMPUAN", filter: p => p.category === "DEWASA_PEREMPUAN" },
    { title: "Lansia Laki-Laki", key: "LANSIA_LAKI", filter: p => p.category === "LANSIA_LAKI" },
    { title: "Lansia Perempuan", key: "LANSIA_PEREMPUAN", filter: p => p.category === "LANSIA_PEREMPUAN" },
    { title: "Balita & Anak Prasekolah", key: "BALITA", filter: p => p.category === "BALITA" }
  ];

  sheets.forEach(s => {
    const subset = patients.filter(s.filter);
    const headers = TEMPLATE_COLUMNS[s.key];
    const rows = subset.map(p => mapPatientToTemplateRow(p, s.key));
    const ws = createFormattedSheet(headers, rows);
    XLSX.utils.book_append_sheet(wb, ws, s.title);
  });

  return wb;
}

/**
 * Buat Workbook Master CKG Sekolah (Multi-sheet)
 */
export function generateMasterSekolahWorkbook(patients) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const sheets = [
    { title: "Usia Sekolah SD (7-12 Thn)", key: "SEKOLAH_SD", filter: p => p.category === "SEKOLAH_SD" },
    { title: "Remaja SMP-SMA (13-17 Thn)", key: "REMAJA", filter: p => p.category === "REMAJA" }
  ];

  sheets.forEach(s => {
    const subset = patients.filter(s.filter);
    const headers = TEMPLATE_COLUMNS[s.key];
    const rows = subset.map(p => mapPatientToTemplateRow(p, s.key));
    const ws = createFormattedSheet(headers, rows);
    XLSX.utils.book_append_sheet(wb, ws, s.title);
  });

  return wb;
}
