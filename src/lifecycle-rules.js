// lifecycle-rules.js
// Logika Klasifikasi Siklus Hidup & Matriks Kelayakan Formulir Skrining SATUSEHAT / CKG

const MONTH_NAMES_ID = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agt: 7, agu: 7, aug: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, oct: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11
};

/**
 * Parsing teks tanggal lahir Indonesia atau ISO ke objek Date
 * Format: "30 Juni 1972", "1972-06-30", "30-06-1972", "30/06/1972"
 */
export function parseBirthDate(birthDateStr) {
  if (!birthDateStr) return null;
  if (birthDateStr instanceof Date && !isNaN(birthDateStr)) return birthDateStr;

  const clean = String(birthDateStr).trim();

  // Coba format ISO "YYYY-MM-DD"
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    if (!isNaN(d)) return d;
  }

  // Coba format "DD-MM-YYYY" atau "DD/MM/YYYY"
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    if (!isNaN(d)) return d;
  }

  // Coba format teks Indonesia: "30 Juni 1972" atau "30 Jun 1972"
  const idMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (idMatch) {
    const day = parseInt(idMatch[1], 10);
    const mStr = idMatch[2].toLowerCase();
    const year = parseInt(idMatch[3], 10);
    const month = MONTH_NAMES_ID[mStr];
    if (month !== undefined) {
      const d = new Date(year, month, day);
      if (!isNaN(d)) return d;
    }
  }

  // Fallback standar JS
  const parsed = new Date(clean);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Menghitung usia pasien dalam tahun dan bulan
 */
export function calculateAge(birthDateInput) {
  if (typeof birthDateInput === "number" && !isNaN(birthDateInput)) {
    return { years: Math.floor(birthDateInput), months: 0, text: `${Math.floor(birthDateInput)} thn` };
  }

  // Jika input berupa string yang langsung berisi angka usia seperti "52 Tahun" atau "52"
  if (typeof birthDateInput === "string") {
    const directAgeMatch = birthDateInput.trim().match(/^(\d{1,3})\s*(?:tahun|thn)?$/i);
    if (directAgeMatch) {
      const y = parseInt(directAgeMatch[1], 10);
      return { years: y, months: 0, text: `${y} thn` };
    }
  }

  const bDate = parseBirthDate(birthDateInput);
  if (!bDate) {
    return { years: 25, months: 0, text: "Dewasa (Perkiraan 25 thn)" };
  }

  const now = new Date();
  let years = now.getFullYear() - bDate.getFullYear();
  let months = now.getMonth() - bDate.getMonth();
  const dDiff = now.getDate() - bDate.getDate();

  if (dDiff < 0) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  let text = "";
  if (years < 1) {
    text = `${months} bln`;
  } else {
    text = `${years} thn${months > 0 ? ` ${months} bln` : ""}`;
  }

  return { years: Math.max(0, years), months: Math.max(0, months), text };
}

/**
 * Matriks 7 Kategori Siklus Hidup Standar WHO / Kemenkes
 * 1. Bayi: 0 - 11 bulan (< 1 tahun)
 * 2. Balita: 1 - 5 tahun (>= 1 && < 5 tahun)
 * 3. Pra-Sekolah: 5 - 6 tahun (>= 5 && <= 6 tahun)
 * 4. Usia Sekolah: 7 - 12 tahun (> 6 && <= 12 tahun)
 * 5. Remaja: 13 - 17 tahun (> 12 && < 18 tahun)
 * 6. Dewasa: 18 - 59 tahun (>= 18 && < 60 tahun)
 * 7. Lansia: >= 60 tahun
 */
export function getLifeCycleCategory(ageYears) {
  if (ageYears < 1) return "Bayi";
  if (ageYears < 5) return "Balita";
  if (ageYears <= 6) return "Pra-Sekolah";
  if (ageYears <= 12) return "Usia Sekolah";
  if (ageYears < 18) return "Remaja";
  if (ageYears < 60) return "Dewasa";
  return "Lansia";
}

/**
 * Mendapatkan key kategori rentang pengaturan (14 kategori: 7 siklus x 2 gender)
 */
export function getRangeCategoryKey(ageYears, gender) {
  const normGender = normalizeGender(gender);
  let stage = "dewasa";
  if (ageYears < 1) stage = "bayi";
  else if (ageYears < 5) stage = "balita";
  else if (ageYears <= 6) stage = "pra-sekolah";
  else if (ageYears <= 12) stage = "sekolah";
  else if (ageYears < 18) stage = "remaja";
  else if (ageYears < 60) stage = "dewasa";
  else stage = "lansia";

  return `${stage}-${normGender}`;
}

/**
 * Normalisasi gender menjadi 'laki-laki' atau 'perempuan'
 */
export function normalizeGender(genderStr) {
  const g = String(genderStr || "").toLowerCase().trim();
  if (g.includes("perempuan") || g.includes("wanita") || g === "p" || g === "f") return "perempuan";
  if (g.includes("laki") || g.includes("pria") || g === "l" || g === "m") return "laki-laki";
  return "perempuan"; // Default aman untuk screening
}

// Kata kunci formulir semu / button yang harus selalu diabaikan
const PSEUDO_FORM_KEYWORDS = [
  "input data", "lihat data", "edit data", "hapus data",
  "selesai diperiksa", "belum selesai", "dalam pemeriksaan",
  "kembali ke halaman utama", "kirim", "simpan"
];

// Kata kunci skrining khusus perempuan
const FEMALE_ONLY_KEYWORDS = [
  "kanker leher rahim", "leher rahim", "inspekulo", "iva",
  "hpv", "hpv-dna", "kanker payudara", "payudara",
  "calon pengantin perempuan", "catin perempuan",
  "gizi (bb - tb - lingkar perut) perempuan", "gizi perempuan",
  "skrining fungsi ginjal perempuan", "sadanis"
];

// Kata kunci skrining khusus laki-laki
const MALE_ONLY_KEYWORDS = [
  "calon pengantin laki-laki", "catin laki-laki",
  "gizi (bb - tb - lingkar perut) laki-laki", "gizi laki-laki",
  "skrining fungsi ginjal laki-laki"
];

/**
 * Evaluasi kelayakan formulir berdasarkan Matriks Siklus Hidup & Gender
 *
 * @param {string} formTitle - Judul form skrining
 * @param {Object} patientInfo - Data pasien { gender, ageYears, birthDate, ... }
 * @returns {Object} { eligible: boolean, reason: string | null, isPseudo: boolean, lifecycle: string }
 */
export function evaluateFormEligibility(formTitle, patientInfo = {}) {
  const rawTitle = String(formTitle || "").replace(/\s+/g, " ").trim();
  const titleLower = rawTitle.toLowerCase();

  // 1. Cek apakah ini label tombol / form semu
  const isPseudo = PSEUDO_FORM_KEYWORDS.some(p => titleLower === p || titleLower.startsWith(p + " ") || titleLower.endsWith(" " + p));
  if (isPseudo || rawTitle.length < 3) {
    return {
      eligible: false,
      reason: "Bukan formulir skrining (label aksi/tombol)",
      isPseudo: true,
      lifecycle: "Tidak Relevan"
    };
  }

  // Hitung usia dan siklus hidup
  let age = patientInfo.ageYears;
  if (age === undefined || age === null) {
    const ageObj = calculateAge(patientInfo.birthDate || patientInfo.tanggalLahir);
    age = ageObj.years;
  }
  const lifecycle = getLifeCycleCategory(age);
  const gender = normalizeGender(patientInfo.gender || patientInfo.jenisKelamin);

  // 2. Filter Gender Spesifik
  if (gender === "laki-laki") {
    const femaleMatch = FEMALE_ONLY_KEYWORDS.find(k => titleLower.includes(k));
    if (femaleMatch) {
      return {
        eligible: false,
        reason: `Khusus perempuan (Pasien: Laki-laki)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  if (gender === "perempuan") {
    const maleMatch = MALE_ONLY_KEYWORDS.find(k => titleLower.includes(k));
    if (maleMatch) {
      return {
        eligible: false,
        reason: `Khusus laki-laki (Pasien: Perempuan)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // 3. Filter Batasan Usia Spesifik
  // Skrining Telinga dan Mata (>= 40 tahun)
  if (titleLower.includes("telinga dan mata") && (titleLower.includes("40") || titleLower.includes("=>40") || titleLower.includes(">=40"))) {
    if (age < 40) {
      return {
        eligible: false,
        reason: `Khusus usia ≥40 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // POCT Lipid Panel (>= 40 tahun)
  if (titleLower.includes("lipid panel") || titleLower.includes("poct lipid")) {
    if (age < 40) {
      return {
        eligible: false,
        reason: `Khusus usia ≥40 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Skrining Kanker Paru (>= 45 tahun)
  if (titleLower.includes("kanker paru") && (titleLower.includes("45") || titleLower.includes("=>45") || titleLower.includes(">=45"))) {
    if (age < 45) {
      return {
        eligible: false,
        reason: `Khusus usia ≥45 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Skrining Fungsi & Kerusakan Ginjal (>= 40 tahun)
  if (titleLower.includes("fungsi ginjal") || titleLower.includes("kerusakan ginjal")) {
    if (age < 40) {
      return {
        eligible: false,
        reason: `Khusus usia ≥40 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Skrining Geriatri (>= 60 tahun / Lansia)
  if (titleLower.includes("geriatri") || titleLower.includes("lansia")) {
    // Form lansia umum boleh diisi jika usia >= 60
    if (titleLower.includes("geriatri") && age < 60) {
      return {
        eligible: false,
        reason: `Khusus lansia ≥60 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Skrining Mandiri & Imunisasi (SELALU ELIGIBLE jika ada di halaman CKG pasien)
  if (titleLower.includes("imunisasi") || titleLower.includes("mandiri") || titleLower.includes("kuesioner")) {
    return {
      eligible: true,
      reason: null,
      isPseudo: false,
      lifecycle
    };
  }

  // Skrining Bayi & Balita (SDIDTK nakes khusus balita)
  if ((titleLower.includes("sdidtk") || titleLower.includes("kpsp")) && !titleLower.includes("imunisasi")) {
    if (age >= 7) {
      return {
        eligible: false,
        reason: `Khusus bayi/balita <7 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Skrining Anak Sekolah / Remaja
  if (titleLower.includes("smp dan sma") || titleLower.includes("anak sekolah")) {
    if (age < 6 || age > 19) {
      return {
        eligible: false,
        reason: `Khusus usia sekolah 6-18 tahun (Pasien: ${age} thn)`,
        isPseudo: false,
        lifecycle
      };
    }
  }

  // Default: Memenuhi syarat (Eligible)
  return {
    eligible: true,
    reason: null,
    isPseudo: false,
    lifecycle
  };
}

