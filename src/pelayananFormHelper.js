// pelayananFormHelper.js
// Pengubah Data Pasien & Excel Menjadi Aturan Isian Formulir Klinis CKG Terstandarisasi
// Diadopsi penuh dari modul teruji CKG_Puskesmas_Android_V2 (extracted_automator.js)

import { getFieldConfig } from "./remoteConfig.js";
import { buildFieldRules } from "./fieldConfig.js";
import { parseBirthDate, calculateAge, normalizeGender, getRangeCategoryKey, getLifeCycleCategory } from "./lifecycle-rules.js";
import { isExamEnabled } from "./examToggleConfig.js";

const clean = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const getRand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, dec = 1) => Number((Math.random() * (max - min) + min).toFixed(dec));

/**
 * Kalkulator Antropometri Standar WHO / Kemenkes RI Berdasarkan Umur & Gender Persis
 */
export function getAnthropometry(gender, ageYears, ageMonths, category) {
  const isMale = gender === "laki-laki";
  const cat = (category || "").toLowerCase();
  const totalMonths = ageYears >= 1
    ? (ageYears * 12 + (ageMonths >= 0 && ageMonths < 12 ? ageMonths : 0))
    : (ageMonths >= 0 ? ageMonths : 6);

  // Standar Dewasa (Default)
  let bb = isMale ? (62 + (Math.random() * 8 - 4)) : (53 + (Math.random() * 8 - 4));
  let tb = isMale ? (165 + (Math.random() * 6 - 3)) : (154 + (Math.random() * 6 - 3));
  let caraUkur = "Berdiri";
  let lk = isMale ? 55 : 54;
  let lila = isMale ? 27 : 25;
  let lp = isMale ? getRand(76, 86) : getRand(68, 78);
  let sistol = isMale ? getRand(110, 125) : getRand(105, 120);
  let diastol = isMale ? getRand(70, 82) : getRand(65, 80);
  let gds = getRand(80, 125);

  if (cat === "bayi" || (ageYears === 0 && totalMonths < 12)) {
    const m = Math.max(0, Math.min(11, totalMonths >= 0 ? totalMonths : 6));
    caraUkur = "Terlentang";
    if (isMale) {
      tb = 50.0 + (m * 2.15) + (Math.random() * 0.8 - 0.4);
      bb = 3.3 + (m * 0.55) + (Math.random() * 0.4 - 0.2);
      lk = 34.5 + (m * 0.95) + (Math.random() * 0.4 - 0.2);
      lila = 11.0 + (m * 0.3) + (Math.random() * 0.3 - 0.1);
    } else {
      tb = 49.2 + (m * 2.15) + (Math.random() * 0.8 - 0.4);
      bb = 3.2 + (m * 0.52) + (Math.random() * 0.4 - 0.2);
      lk = 34.0 + (m * 0.93) + (Math.random() * 0.4 - 0.2);
      lila = 10.8 + (m * 0.3) + (Math.random() * 0.3 - 0.1);
    }
    lp = Math.round(35 + m * 0.8);
    sistol = getRand(80, 95);
    diastol = getRand(50, 65);
  } else if (cat === "balita" || (totalMonths >= 12 && totalMonths < 60) || (ageYears >= 1 && ageYears < 5)) {
    let m = totalMonths;
    if (m < 12 || m >= 60) {
      m = (ageYears >= 1 && ageYears < 5) ? (ageYears * 12 + (ageMonths >= 0 && ageMonths < 12 ? ageMonths : 0)) : 24;
    }
    caraUkur = m < 24 ? "Terlentang" : "Berdiri";
    if (isMale) {
      tb = 75.8 + ((m - 12) * 0.71) + (Math.random() * 1.0 - 0.5);
      bb = 9.6 + ((m - 12) * 0.18) + (Math.random() * 0.4 - 0.2);
      lk = 46.0 + ((m - 12) * 0.11) + (Math.random() * 0.4 - 0.2);
      lila = 14.5 + ((m - 12) * 0.05) + (Math.random() * 0.3 - 0.1);
    } else {
      tb = 74.5 + ((m - 12) * 0.72) + (Math.random() * 1.0 - 0.5);
      bb = 9.0 + ((m - 12) * 0.18) + (Math.random() * 0.4 - 0.2);
      lk = 45.0 + ((m - 12) * 0.11) + (Math.random() * 0.4 - 0.2);
      lila = 14.2 + ((m - 12) * 0.05) + (Math.random() * 0.3 - 0.1);
    }
    lp = Math.round(45 + (m - 12) * 0.18);
    sistol = getRand(88, 102);
    diastol = getRand(54, 68);
  } else if (cat === "sekolah" || cat === "sd" || cat === "anak" || (ageYears >= 5 && ageYears < 12)) {
    const y = Math.max(5, Math.min(12, ageYears || 9));
    caraUkur = "Berdiri";
    tb = 110.0 + ((y - 5) * 4.8) + (Math.random() * 2.0 - 1.0);
    bb = 18.0 + ((y - 5) * 2.7) + (Math.random() * 1.5 - 0.75);
    lk = isMale ? 52.0 : 51.5;
    lila = 17.0 + ((y - 5) * 0.6);
    lp = Math.round(52 + (y - 5) * 1.6);
    sistol = getRand(95, 110);
    diastol = getRand(60, 72);
    gds = getRand(80, 115);
  } else if (cat === "smp" || cat === "sma" || cat === "remaja" || (ageYears >= 12 && ageYears < 18)) {
    caraUkur = "Berdiri";
    tb = isMale ? getRand(155, 172) : getRand(148, 162);
    bb = isMale ? getRand(45, 62) : getRand(42, 56);
    lk = isMale ? 54 : 53;
    lila = isMale ? getRand(22, 26) : getRand(21, 25);
    lp = isMale ? getRand(62, 78) : getRand(60, 74);
    sistol = getRand(100, 118);
    diastol = getRand(65, 78);
    gds = getRand(80, 115);
  } else if (cat === "lansia" || ageYears >= 60) {
    caraUkur = "Berdiri";
    tb = isMale ? getRand(155, 168) : getRand(146, 158);
    bb = isMale ? getRand(54, 68) : getRand(46, 58);
    lk = isMale ? 56 : 55;
    lila = isMale ? getRand(25, 29) : getRand(24, 28);
    lp = isMale ? getRand(78, 90) : getRand(70, 84);
    // SKI 2023 Kemenkes RI: Lansia (>=60 th) 55% hipertensi ringan-sedang, 45% normal
    const isHtnLansia = Math.random() < 0.55;
    sistol = isHtnLansia ? getRand(135, 154) : getRand(118, 128);
    diastol = isHtnLansia ? getRand(84, 94) : getRand(74, 82);
    // GDS Lansia: 16% agak tinggi (135-175), 84% normal (90-125)
    gds = Math.random() < 0.16 ? getRand(135, 175) : getRand(90, 125);
  } else {
    // Dewasa (18-59 tahun) - Proporsi Tekanan Darah & GDS sesuai SKI 2023 Kemenkes RI
    caraUkur = "Berdiri";
    if (ageYears >= 45) {
      // Pra-lansia (45-59 th): ~40% hipertensi, ~12% GDS agak tinggi
      const isHtn45 = Math.random() < 0.40;
      sistol = isHtn45 ? getRand(132, 148) : (isMale ? getRand(114, 126) : getRand(110, 124));
      diastol = isHtn45 ? getRand(84, 92) : (isMale ? getRand(74, 82) : getRand(70, 80));
      gds = Math.random() < 0.12 ? getRand(135, 165) : getRand(88, 120);
    } else if (ageYears >= 35) {
      // Dewasa (35-44 th): ~27% hipertensi, ~9% GDS agak tinggi
      const isHtn35 = Math.random() < 0.27;
      sistol = isHtn35 ? getRand(130, 144) : (isMale ? getRand(112, 124) : getRand(106, 120));
      diastol = isHtn35 ? getRand(84, 90) : (isMale ? getRand(72, 80) : getRand(68, 78));
      gds = Math.random() < 0.09 ? getRand(135, 160) : getRand(85, 120);
    } else {
      // Dewasa muda (18-34 th): ~14% prehipertensi/hipertensi ringan, ~6% GDS agak tinggi
      const isHtn18 = Math.random() < 0.14;
      sistol = isHtn18 ? getRand(126, 136) : (isMale ? getRand(110, 122) : getRand(105, 118));
      diastol = isHtn18 ? getRand(82, 88) : (isMale ? getRand(70, 80) : getRand(65, 76));
      gds = Math.random() < 0.06 ? getRand(135, 155) : getRand(82, 115);
    }
  }

  return {
    bb: Number(bb.toFixed(1)),
    tb: Number(tb.toFixed(1)),
    caraUkur,
    lk: Number(lk.toFixed(1)),
    lila: Number(lila.toFixed(1)),
    lp: Number(lp),
    sistol: Number(sistol),
    diastol: Number(diastol),
    gds: Number(gds)
  };
}

/**
 * Generator Profil Medis Pasien Dinamis & Realistis (Sinkron penuh dengan CKG_Puskesmas_Android_V2)
 */
export function generatePatientMedicalProfile(gender, ageYears, ageMonths, category, existingProfile = null) {
  if (existingProfile && existingProfile.gender === gender && Math.abs(existingProfile.ageYears - ageYears) <= 1 && existingProfile.kadarCO !== undefined) {
    return existingProfile;
  }

  const isMale = gender === "laki-laki";
  const cat = (category || "").toLowerCase();
  const totalMonths = ageYears >= 1
    ? (ageYears * 12 + (ageMonths >= 0 && ageMonths < 12 ? ageMonths : 0))
    : (ageMonths >= 0 ? ageMonths : 0);
  const isAdult = ageYears >= 18 && ageYears < 60;
  const isLansia = ageYears >= 60 || cat.includes("lansia");
  const isRemaja = ageYears >= 12 && ageYears < 18;
  const isSekolah = ageYears >= 6 && ageYears < 12;
  const isBayi = ageYears === 0 && totalMonths < 12;
  const isBalita = !isBayi && ((ageYears >= 1 && ageYears < 6) || (totalMonths >= 12 && totalMonths < 72));
  const isChild = ageYears < 18 || isBayi || isBalita || isSekolah || isRemaja;

  // 1. Antropometri Akurat (SKI 2023 Kemenkes RI)
  const anthro = getAnthropometry(gender, ageYears, ageMonths, category);

  // 2. Status Merokok & Perilaku Merokok (Persis CKG_Puskesmas_Android_V2)
  // - Laki-laki Dewasa/Lansia: 65% merokok ("Ya"); jika tidak merokok, pernahMerokok 15% (lansia) / 10% (dewasa); terpaparAsapRokok 85% ("Ya")
  // - Perempuan Dewasa/Lansia: 0% merokok ("Tidak"), 0% pernahMerokok ("Tidak"), terpaparAsapRokok 85% ("Ya")
  // - Anak/Remaja (<18 th): 0% merokok ("Tidak"), 0% pernahMerokok ("Tidak"), terpaparAsapRokok 80% ("Ya")
  let isSmoker = false;
  let pernahMerokok = false;
  let terpaparAsapRokok = false;

  if (isChild) {
    isSmoker = false;
    pernahMerokok = false;
    terpaparAsapRokok = Math.random() < 0.80;
  } else if (isMale) {
    isSmoker = Math.random() < 0.65;
    pernahMerokok = isSmoker ? false : (Math.random() < (isLansia ? 0.15 : 0.10));
    terpaparAsapRokok = Math.random() < 0.85;
  } else {
    isSmoker = false;
    pernahMerokok = false;
    terpaparAsapRokok = Math.random() < 0.85;
  }

  // Detail Jika Perokok Aktif (Laki-laki Dewasa/Lansia)
  let jenisRokok = "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)";
  let bungkusTahunOption = "5 bungkus tahun";
  let batangRokokPerHari = 12;
  let kadarCO = "";
  let rokokBungkusTahun = 0;

  if (isSmoker) {
    const rJenis = Math.random();
    if (isLansia || ageYears >= 55) {
      jenisRokok = rJenis < 0.92
        ? "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)"
        : "Keduanya";
    } else if (ageYears < 30) {
      if (rJenis < 0.52) jenisRokok = "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)";
      else if (rJenis < 0.76) jenisRokok = "Rokok elektronik (vape, IQOS, dll)";
      else jenisRokok = "Keduanya";
    } else {
      if (rJenis < 0.80) jenisRokok = "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)";
      else if (rJenis < 0.88) jenisRokok = "Rokok elektronik (vape, IQOS, dll)";
      else jenisRokok = "Keduanya";
    }

    const rBungkus = Math.random();
    if (isLansia || ageYears >= 60) {
      if (rBungkus < 0.55) { bungkusTahunOption = "> 30 bungkus tahun"; rokokBungkusTahun = 35; }
      else if (rBungkus < 0.90) { bungkusTahunOption = "20-30 bungkus tahun"; rokokBungkusTahun = 25; }
      else { bungkusTahunOption = "5 bungkus tahun"; rokokBungkusTahun = 5; }
    } else if (ageYears >= 40) {
      if (rBungkus < 0.20) { bungkusTahunOption = "> 30 bungkus tahun"; rokokBungkusTahun = 35; }
      else if (rBungkus < 0.75) { bungkusTahunOption = "20-30 bungkus tahun"; rokokBungkusTahun = 25; }
      else { bungkusTahunOption = "5 bungkus tahun"; rokokBungkusTahun = 5; }
    } else {
      if (rBungkus < 0.25) { bungkusTahunOption = "20-30 bungkus tahun"; rokokBungkusTahun = 25; }
      else { bungkusTahunOption = "5 bungkus tahun"; rokokBungkusTahun = 5; }
    }

    batangRokokPerHari = isLansia ? getRand(8, 16) : (ageYears >= 35 ? getRand(10, 20) : getRand(6, 14));
  } else {
    batangRokokPerHari = 0;
    rokokBungkusTahun = 0;
  }

  // 3. Status Diabetes Melitus (Persis CKG_Puskesmas_Android_V2: Lansia ~10%, 45-59 th ~6%, Dewasa <45 th ~2%, Anak 0%)
  let hasDiabetes = false;
  let diabetesDurationMonths = 0;
  const isGdsExamDone = isChild ? false : (Math.random() < 0.75);

  if (isChild) {
    hasDiabetes = false;
  } else if (isLansia) {
    hasDiabetes = Math.random() < 0.10;
  } else if (ageYears >= 45) {
    hasDiabetes = Math.random() < 0.06;
  } else {
    hasDiabetes = Math.random() < 0.02;
  }

  if (hasDiabetes) {
    const opts = isLansia ? [12, 18, 24, 36, 48] : [6, 12, 18, 24, 36];
    diabetesDurationMonths = opts[getRand(0, opts.length - 1)] || 12;
  } else {
    diabetesDurationMonths = 0;
  }

  // 3b. Gigi & Mulut (Persis CKG_Puskesmas_Android_V2: Lansia 4% karies / 3% karang / 4% gigi hilang; Anak 3% karies; Dewasa 2% karies / 2% karang)
  let hasKaries = false;
  let kariesCount = "tidak-ada";
  let hasPeriodontal = false;
  let hasGigiHilang = false;
  let kebersihanMulut = "Baik";

  if (isBayi || ageYears < 1) {
    hasKaries = false;
    hasPeriodontal = false;
    hasGigiHilang = false;
  } else if (isLansia || ageYears >= 60) {
    hasKaries = Math.random() < 0.04;
    hasPeriodontal = Math.random() < 0.03;
    hasGigiHilang = Math.random() < 0.04;
    kebersihanMulut = (hasKaries || hasPeriodontal) ? "Sedang" : "Baik";
  } else if (isChild) {
    hasKaries = Math.random() < 0.03;
    hasPeriodontal = false;
    hasGigiHilang = false;
    kebersihanMulut = "Baik";
  } else {
    hasKaries = Math.random() < 0.02;
    hasPeriodontal = Math.random() < 0.02;
    hasGigiHilang = false;
    kebersihanMulut = "Baik";
  }
  if (hasKaries) {
    kariesCount = "1";
  }

  // 3c. Pemeriksaan Telinga & Mata (Persis CKG_Puskesmas_Android_V2: 98-99% Normal, 1-2% temuan klinis)
  let telingaSerumen = "Tidak ada serumen impaksi";
  let telingaInfeksi = "Tidak ada infeksi telinga";
  let tajamPendengaran = "Normal";
  let tajamPenglihatan = "Normal (visus 6/6 - 6/12)";
  let pupilKatarak = "Normal";

  if (isLansia || ageYears >= 60) {
    telingaSerumen = Math.random() < 0.02 ? "Ada serumen impaksi" : "Tidak ada serumen impaksi";
    telingaInfeksi = "Tidak ada infeksi telinga";
    tajamPendengaran = Math.random() < 0.02 ? "Curiga gangguan pendengaran" : "Normal";
    tajamPenglihatan = Math.random() < 0.02 ? "Curiga gangguan penglihatan (visus < 6/12)" : "Normal (visus 6/6 - 6/12)";
    pupilKatarak = Math.random() < 0.01 ? "Curiga Katarak" : "Normal";
  } else if (ageYears >= 40) {
    telingaSerumen = Math.random() < 0.01 ? "Ada serumen impaksi" : "Tidak ada serumen impaksi";
    telingaInfeksi = "Tidak ada infeksi telinga";
    tajamPendengaran = "Normal";
    tajamPenglihatan = Math.random() < 0.01 ? "Curiga gangguan penglihatan (visus < 6/12)" : "Normal (visus 6/6 - 6/12)";
    pupilKatarak = "Normal";
  }

  // 3d. PPOK - Skrining PUMA Berdasarkan Usia & Korelasi Merokok
  let pumaUsiaLabel = "40-49";
  if (ageYears >= 60) pumaUsiaLabel = "= > 60";
  else if (ageYears >= 50) pumaUsiaLabel = "50-59";
  else pumaUsiaLabel = "40-49";

  const pumaRiwayatMerokok = (isSmoker || pernahMerokok) ? "Iya" : "Tidak";

  let pumaBungkusTahun = "< 20 bungkus per tahun";
  if (isSmoker) {
    if (bungkusTahunOption === "> 30 bungkus tahun") pumaBungkusTahun = "> 30 bungkus per tahun";
    else if (bungkusTahunOption === "20-30 bungkus tahun") pumaBungkusTahun = "20-30 bungkus per tahun";
    else pumaBungkusTahun = "< 20 bungkus per tahun";
  }

  const pumaNapasPendek = "Tidak";
  const pumaDahak = "Tidak";

  // 4. Laboratorium & Gula Darah (Persis CKG_Puskesmas_Android_V2)
  let gds = isChild ? getRand(76, 108) : (hasDiabetes ? getRand(145, 195) : anthro.gds);
  let gds2 = null;
  let gdp = Math.min(104, Math.max(76, Math.round(gds * 0.82)));
  let hba1c = hasDiabetes ? randFloat(6.8, 8.2, 1) : randFloat(5.0, 5.6, 1);
  if (!hasDiabetes && gds >= 140) {
    gds2 = getRand(135, 160);
  }

  // Profil Lipid
  const kolesterol = getRand(168, 208) + (ageYears >= 50 ? getRand(2, 7) : 0);
  const trigliserida = getRand(110, 155);
  const hdl = isMale ? getRand(42, 54) : getRand(48, 62);
  const ldl = getRand(96, 128);

  // Fungsi Ginjal
  const ureum = getRand(20, 32) + (ageYears >= 60 ? getRand(2, 5) : 0);
  const kreatinin = isMale ? randFloat(0.82, 1.12, 2) : randFloat(0.62, 0.90, 2);
  const egfr = Math.max(78, Math.min(108, Math.round(112 - (ageYears * 0.38) + getRand(-4, 5))));

  // Fungsi Hati
  const sgot = getRand(18, 30);
  const sgpt = getRand(16, 32);
  const bilirubin = randFloat(0.6, 0.95, 2);

  // Hemoglobin (Hb)
  let hb = 13.5;
  if (isMale) {
    hb = isLansia ? randFloat(13.4, 15.6, 1) : randFloat(13.8, 16.5, 1);
  } else {
    hb = isLansia ? randFloat(12.2, 14.2, 1) : randFloat(12.4, 14.8, 1);
  }

  // Tanda Vital & Aktivitas Fisik
  const nadi = getRand(72, 84);
  const respirasi = getRand(16, 20);
  const suhu = randFloat(36.4, 36.8, 1);
  const hariAktif = getRand(3, 5);
  const menitAktif = getRand(30, 45);

  // SKILAS Mobilisasi (Chair Stand Test: normal < 14 detik)
  const chairStandSeconds = randFloat(9.5, 13.2, 1);

  return {
    gender,
    ageYears,
    ageMonths,
    category,
    bb: anthro.bb,
    tb: anthro.tb,
    caraUkur: anthro.caraUkur,
    lk: anthro.lk,
    lila: anthro.lila,
    lp: anthro.lp,
    sistol: anthro.sistol,
    diastol: anthro.diastol,
    isSmoker,
    pernahMerokok,
    terpaparAsapRokok,
    jenisRokok,
    bungkusTahunOption,
    batangRokokPerHari,
    kadarCO,
    rokokBungkusTahun,
    hasDiabetes,
    diabetesDurationMonths,
    isGdsExamDone,
    hasKaries,
    kariesCount,
    hasPeriodontal,
    hasGigiHilang,
    kebersihanMulut,
    telingaSerumen,
    telingaInfeksi,
    tajamPendengaran,
    tajamPenglihatan,
    pupilKatarak,
    pumaUsiaLabel,
    pumaRiwayatMerokok,
    pumaBungkusTahun,
    pumaNapasPendek,
    pumaDahak,
    gds,
    gds2,
    gdp,
    hba1c,
    kolesterol,
    trigliserida,
    hdl,
    ldl,
    ureum,
    kreatinin,
    egfr,
    sgot,
    sgpt,
    bilirubin,
    hb,
    nadi,
    respirasi,
    suhu,
    hariAktif,
    menitAktif,
    chairStandSeconds,
    trombosit: 250000,
    albuminUrin: 15,
    kreatininUrin: 100
  };
}

/**
 * Mengubah data record peserta menjadi aturan isian form SurveyJS/DOM
 * Menjamin integritas data Excel pasien dan menyuplai nilai profil medis realistis jika data kosong.
 */
export async function recordToFieldRules(participant, customRanges = null) {
  const cfg = await getFieldConfig();
  const rawP = participant || {};

  // Ambil custom ranges dari storage lokal jika tidak diteruskan
  let ranges = customRanges;
  if (!ranges || Object.keys(ranges).length === 0) {
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        const stored = await chrome.storage.local.get("ckg_ranges");
        if (stored?.ckg_ranges) ranges = stored.ckg_ranges;
      }
    } catch (e) {}
  }

  // 1. Parsing Tanggal Lahir & Usia Pasien Akurat
  const rawBirth = rawP.tanggalLahir || rawP.tanggal_lahir || rawP.tgllahir || rawP.tgl_lahir || "";
  const ageObj = calculateAge(rawBirth);
  const ageYears = ageObj.years;
  const ageMonths = ageObj.months;

  // 2. Normalisasi Gender & Siklus Hidup
  const rawGender = rawP.jenisKelamin || rawP.jenis_kelamin || rawP.gender || rawP.jk || "";
  const normGender = normalizeGender(rawGender);
  const isMale = normGender === "laki-laki";

  let category = (rawP.category || "").toLowerCase();
  if (!category) {
    if (ageYears < 1) category = "bayi";
    else if (ageYears < 6) category = "balita";
    else if (ageYears < 12) category = "sekolah";
    else if (ageYears < 18) category = "remaja";
    else if (ageYears >= 60) category = "lansia";
    else category = "dewasa";
  }

  // 3. Bangkitkan Profil Medis Realistis
  const prof = generatePatientMedicalProfile(normGender, ageYears, ageMonths, category);

  // Terapkan rentang pengaturan CKG kustom jika tersedia
  try {
    const catKey = getRangeCategoryKey(ageYears, normGender);
    const isAdult = ageYears >= 18 && ageYears < 60;
    // PENTING: Rentang klinis kustom hanya diterapkan jika dikonfigurasi khusus untuk kategori tersebut!
    // Tidak boleh rentang dewasa bocor/mencemari pemeriksaan balita, bayi, anak, remaja, atau lansia.
    const catRange = (ranges && ranges[catKey]) || (isAdult && ranges ? (ranges["dewasa-perempuan"] || ranges["dewasa-laki-laki"]) : null);
    if (catRange) {
      if (catRange.beratBadan && Array.isArray(catRange.beratBadan) && catRange.beratBadan.length === 2 && catRange.beratBadan[1] > 0) {
        prof.bb = getRand(Math.round(catRange.beratBadan[0]), Math.round(catRange.beratBadan[1]));
      }
      if (catRange.tinggiBadan && Array.isArray(catRange.tinggiBadan) && catRange.tinggiBadan.length === 2 && catRange.tinggiBadan[1] > 0) {
        prof.tb = getRand(Math.round(catRange.tinggiBadan[0]), Math.round(catRange.tinggiBadan[1]));
      }
      if (catRange.lingkarPerut && Array.isArray(catRange.lingkarPerut) && catRange.lingkarPerut.length === 2 && catRange.lingkarPerut[1] > 0) {
        prof.lp = getRand(Math.round(catRange.lingkarPerut[0]), Math.round(catRange.lingkarPerut[1]));
      }
      if (catRange.sistolik && Array.isArray(catRange.sistolik) && catRange.sistolik.length === 2 && catRange.sistolik[1] > 0) {
        prof.sistol = getRand(Math.round(catRange.sistolik[0]), Math.round(catRange.sistolik[1]));
      }
      if (catRange.diastolik && Array.isArray(catRange.diastolik) && catRange.diastolik.length === 2 && catRange.diastolik[1] > 0) {
        prof.diastol = getRand(Math.round(catRange.diastolik[0]), Math.round(catRange.diastolik[1]));
      }
      if (catRange.gulaDarah && Array.isArray(catRange.gulaDarah) && catRange.gulaDarah.length === 2 && catRange.gulaDarah[1] > 0) {
        prof.gds = getRand(Math.round(catRange.gulaDarah[0]), Math.round(catRange.gulaDarah[1]));
      }
    }
  } catch (rangeErr) {
    console.warn("[recordToFieldRules] Gagal menerapkan custom ranges:", rangeErr);
  }

  // 4. Pembacaan Data Klinis Asli dari Excel (Prioritas Tertinggi dari File Import)
  const safeVal = (v, fallback, minValid = null, maxValid = null) => {
    if (v !== undefined && v !== null && v !== "" && v !== 0 && v !== "0") {
      const num = parseFloat(String(v).replace(",", "."));
      if (!isNaN(num) && num > 0) {
        if (minValid !== null && num < minValid) return fallback;
        if (maxValid !== null && num > maxValid) return fallback;
        return num;
      }
    }
    return fallback;
  };

  const isInfantOrBalita = ageYears < 6;
  const minBB = isInfantOrBalita ? 2.5 : 15;
  const minTB = isInfantOrBalita ? 45 : 80;
  const minLP = isInfantOrBalita ? 30 : 40;

  // Pembacaan Parameter Klinis: Form Input Manual Nakes Ekstensi memiliki prioritas tertinggi
  // Nilai wajib dalam batas normal/realistis manusia (dilarang dummy typo seperti 3 kg / 3 cm!)
  const realBB = safeVal(rawP["berat-badan"] || rawP.bb || rawP.beratBadan || rawP.berat_badan, prof.bb, minBB, 250);
  const realTB = safeVal(rawP["tinggi-badan"] || rawP.tb || rawP.tinggiBadan || rawP.tinggi_badan, prof.tb, minTB, 240);
  const realLP = safeVal(rawP["lingkar-perut"] || rawP.lp || rawP.lingkarPerut || rawP.lingkar_perut, prof.lp, minLP, 220);
  const realSistol = safeVal(rawP["tekanan-darah-sistolik"] || rawP.sistolik || rawP.sistol || rawP.tdSistolik || rawP.td_sistolik, prof.sistol, 60, 250);
  const realDiastol = safeVal(rawP["tekanan-darah-diastolik"] || rawP.diastolik || rawP.diastol || rawP.tdDiastolik || rawP.td_diastolik, prof.diastol, 40, 150);
  const realGDS = safeVal(rawP["gula-darah"] || rawP.gds || rawP.gulaDarah || rawP.gula_darah, prof.gds, 40, 600);

  // Parameter Klinis Tambahan Hasil Pemeriksaan dari Excel
  const realGDP = safeVal(rawP.gulaDarahPuasa || rawP.gdp || rawP.gula_darah_puasa, prof.gdp);
  const realHbA1c = safeVal(rawP.hba1c || rawP.hba1c_persen, prof.hba1c);
  const realKolesterol = safeVal(rawP.kolesterolTotal || rawP.kolesterol || rawP.kolesterol_total, prof.kolesterol);
  const realTrigliserida = safeVal(rawP.trigliserida || rawP.tg, prof.trigliserida);
  const realHDL = safeVal(rawP.hdl, prof.hdl);
  const realLDL = safeVal(rawP.ldl, prof.ldl);
  const realUreum = safeVal(rawP.ureum, prof.ureum);
  const realKreatinin = safeVal(rawP.kreatinin, prof.kreatinin);
  const realHb = safeVal(rawP.hemoglobin || rawP.hb, prof.hb);
  const realLK = safeVal(rawP.lk || rawP.lingkarKepala, prof.lk);
  const realLILA = safeVal(rawP.lila || rawP.lingkarLengan, prof.lila);
  const realChairStand = safeVal(rawP.chairStandDetik || rawP.chairStand, prof.chairStandSeconds);
  const realCaraUkur = rawP.caraUkur || rawP.cara_ukur || prof.caraUkur;

  // Status Merokok & Perilaku Merokok dari Form Input Manual Nakes / Excel / Profil Medis Realistis
  let isSmoker = prof.isSmoker;
  const rawSmoker = String(rawP.merokok || rawP["merokok"] || "").toLowerCase();
  if (rawSmoker.includes("ya") || rawSmoker === "1" || rawSmoker === "true") {
    isSmoker = true;
  } else if (rawSmoker.includes("tidak") || rawSmoker === "0" || rawSmoker === "false") {
    isSmoker = false;
  }

  let pernahMerokok = isSmoker ? true : prof.pernahMerokok;
  const rawPernahMerokok = String(rawP.pernahMerokok || rawP.pernah_merokok || rawP["pernah-merokok"] || "").toLowerCase();
  if (rawPernahMerokok.includes("ya") || rawPernahMerokok === "1") {
    pernahMerokok = true;
  } else if (rawPernahMerokok.includes("tidak") || rawPernahMerokok === "0") {
    pernahMerokok = false;
  } else if (!isSmoker) {
    if (!isMale) {
      pernahMerokok = false; // Wanita tidak merokok: 99% tidak pernah merokok
    }
  }

  let terpaparAsapRokok = prof.terpaparAsapRokok;
  const rawTerpapar = String(rawP.terpaparAsapRokok || rawP.terpapar_asap || rawP["terpapar-asap"] || "").toLowerCase();
  if (rawTerpapar.includes("ya") || rawTerpapar === "1") {
    terpaparAsapRokok = true;
  } else if (rawTerpapar.includes("tidak") || rawTerpapar === "0") {
    terpaparAsapRokok = false;
  }

  const realKadarCO = safeVal(rawP.kadarCo || rawP.kadar_co || rawP.copernapasan, null);
  const kadarCO = realKadarCO !== null ? realKadarCO : "";

  // Status Riwayat Diabetes Dokter & Durasi
  let hasDiabetes = prof.hasDiabetes;
  const rawRiwayatDM = String(rawP.riwayatDiabetes || rawP.riwayat_diabetes || "").toLowerCase();
  if (rawRiwayatDM.includes("ya")) hasDiabetes = true;
  else if (rawRiwayatDM.includes("tidak")) hasDiabetes = false;

  const realDurasiDM = safeVal(rawP.durasiDiabetesBulan || rawP.durasidiabetes, null);
  const diabetesDuration = realDurasiDM !== null ? realDurasiDM : (hasDiabetes ? Math.max(6, prof.diabetesDurationMonths || 12) : "");

  // Riwayat Hipertensi
  let hasHipertensi = false;
  const rawRiwayatHT = String(rawP.riwayatHipertensi || rawP.riwayat_hipertensi || "").toLowerCase();
  if (rawRiwayatHT.includes("ya")) hasHipertensi = true;
  else if (realSistol >= 140 || realDiastol >= 90) hasHipertensi = true;

  // Status Perkawinan (Input Manual Ekstensi Memiliki Prioritas Mutlak)
  let statusNikah = "menikah";
  const rawNikah = String(rawP["status-menikah"] || rawP.statusPernikahan || rawP.status_pernikahan || "").toLowerCase();
  if (rawNikah.includes("belum") || (ageYears < 18 && !rawNikah.includes("menikah"))) statusNikah = "belum-menikah";
  else if (rawNikah.includes("cerai hidup") || rawNikah.includes("cerai_hidup")) statusNikah = "cerai-hidup";
  else if (rawNikah.includes("cerai mati") || rawNikah.includes("cerai_mati")) statusNikah = "cerai-mati";
  else if (rawNikah.includes("kawin") || rawNikah.includes("menikah")) statusNikah = "menikah";

  // Pekerjaan Pasien (Input Manual Ekstensi Memiliki Prioritas Mutlak)
  const realPekerjaan = rawP.pekerjaan || rawP["pekerjaan"] || prof.pekerjaan || (ageYears < 18 ? "Pelajar / Mahasiswa" : "Tidak Bekerja");

  // Nilai Hemoglobin
  const hbVal = realHb;

  // Status Reproduksi & Pemeriksaan Wanita
  const rawHamil = String(rawP.sedangHamil || rawP.hamil || "").toLowerCase();
  const isHamil = rawHamil.includes("ya");

  const rawRencanaNikah = String(rawP.rencanaMenikah || rawP.catin || "").toLowerCase();
  const isRencanaNikah = rawRencanaNikah.includes("ya");

  const rawHubIntim = String(rawP.hubunganIntim || "").toLowerCase();
  const isHubIntim = rawHubIntim ? rawHubIntim.includes("ya") : (statusNikah !== "belum-menikah");

  // 5. Rakit Nilai Input ke Values Map
  const valuesMap = new Map();
  valuesMap.set("status-menikah", statusNikah);
  valuesMap.set("pekerjaan", realPekerjaan);
  valuesMap.set("rencana-menikah", isRencanaNikah ? "ya" : "tidak");
  valuesMap.set("hamil", isHamil ? "ya" : "tidak");
  valuesMap.set("hubungan-intim", isHubIntim ? "ya" : "tidak");

  valuesMap.set("merokok", isSmoker ? "ya" : "tidak");
  valuesMap.set("pernah-merokok", pernahMerokok ? "ya" : "tidak");
  valuesMap.set("riwayat-diabetes", hasDiabetes ? "ya" : "tidak");

  valuesMap.set("berat-badan", String(realBB));
  valuesMap.set("tinggi-badan", String(realTB));
  valuesMap.set("lingkar-perut", String(realLP));
  valuesMap.set("tekanan-darah-sistolik", String(realSistol));
  valuesMap.set("tekanan-darah-diastolik", String(realDiastol));
  valuesMap.set("gula-darah", String(realGDS));

  // Telinga, Mata, Gigi, Katarak dari Excel jika ada (Fallback ke Profil Realistis Lansia/Dewasa)
  let telingaSerumen = prof.telingaSerumen;
  let telingaInfeksi = prof.telingaInfeksi;
  let tajamPendengaran = prof.tajamPendengaran;
  const rawTelinga = String(rawP.telinga || "").toLowerCase();
  if (rawTelinga.includes("gangguan")) {
    tajamPendengaran = "Curiga gangguan pendengaran";
    valuesMap.set("telinga", "gangguan");
  } else if (rawTelinga.includes("normal")) {
    tajamPendengaran = "Normal";
    valuesMap.set("telinga", "normal");
  } else {
    valuesMap.set("telinga", tajamPendengaran.includes("Curiga") ? "gangguan" : "normal");
  }
  valuesMap.set("daya-dengar", valuesMap.get("telinga"));
  valuesMap.set("tes-daya-dengar", valuesMap.get("telinga"));

  let tajamPenglihatan = prof.tajamPenglihatan;
  const rawMata = String(rawP.mata || "").toLowerCase();
  if (rawMata.includes("buta")) {
    tajamPenglihatan = "Curiga gangguan penglihatan (visus < 6/12)";
    valuesMap.set("mata", "buta");
  } else if (rawMata.includes("berat") || rawMata.includes("sedang") || rawMata.includes("ringan")) {
    tajamPenglihatan = "Curiga gangguan penglihatan (visus < 6/12)";
    valuesMap.set("mata", rawMata.includes("berat") ? "gangguan-penglihatan-berat" : (rawMata.includes("sedang") ? "gangguan-penglihatan-sedang" : "gangguan-penglihatan-ringan"));
  } else if (rawMata.includes("normal")) {
    tajamPenglihatan = "Normal (visus 6/6 - 6/12)";
    valuesMap.set("mata", "normal");
  } else {
    valuesMap.set("mata", tajamPenglihatan.includes("Curiga") ? "gangguan-penglihatan-sedang" : "normal");
  }

  let pupilKatarak = prof.pupilKatarak;
  const rawKatarak = String(rawP.katarak || "").toLowerCase();
  if (rawKatarak.includes("curiga") || rawKatarak.includes("katarak")) {
    pupilKatarak = "Curiga Katarak";
    valuesMap.set("katarak", "curiga-katarak");
  } else if (rawKatarak.includes("normal")) {
    pupilKatarak = "Normal";
    valuesMap.set("katarak", "normal");
  } else {
    valuesMap.set("katarak", pupilKatarak === "Curiga Katarak" ? "curiga-katarak" : "normal");
  }

  const rawGigi = String(rawP.gigi || "").toLowerCase();
  if (rawGigi.includes("lubang")) valuesMap.set("gigi", "lubang");
  else if (rawGigi.includes("cabut")) valuesMap.set("gigi", "cabut");
  else if (rawGigi.includes("normal")) valuesMap.set("gigi", "normal");
  else valuesMap.set("gigi", prof.hasKaries ? "lubang" : "normal");

  const rawKaries = String(rawP.karies || "").toLowerCase();
  if (["1", "2", "3", ">3", "tidak-ada"].includes(rawKaries)) {
    valuesMap.set("karies", rawKaries);
  } else {
    valuesMap.set("karies", prof.hasKaries ? (prof.kariesCount || "1") : "tidak-ada");
  }

  const rawKacamata = String(rawP.kacamata || "").toLowerCase();
  valuesMap.set("kacamata", rawKacamata.includes("ya") ? "ya" : "tidak");

  if (rawP.menstruasi) valuesMap.set("menstruasi", clean(rawP.menstruasi));
  valuesMap.set("kebugaran", rawP.kebugaran ? clean(rawP.kebugaran) : "baik");

  // 6. Buat Field Rules dari template konfigurasi
  const rules = buildFieldRules(valuesMap, {
    kategori: category,
    jenisKelamin: normGender,
    umur: ageYears
  }, cfg);

  // 6.5 INJEKSI ATURAN FORM MANUAL NAKES EKSTENSI DENGAN PRIORITAS TERTINGGI (PRIORITY: 20)
  rules.push({ keyword: "status pernikahan", type: "radio", label: statusNikah === "belum-menikah" ? "Belum Menikah" : (statusNikah === "cerai-mati" ? "Cerai Mati" : (statusNikah === "cerai-hidup" ? "Cerai Hidup" : "Menikah")), priority: 20 });
  rules.push({ keyword: "status perkawinan", type: "radio", label: statusNikah === "belum-menikah" ? "Belum Menikah" : (statusNikah === "cerai-mati" ? "Cerai Mati" : (statusNikah === "cerai-hidup" ? "Cerai Hidup" : "Menikah")), priority: 20 });
  rules.push({ keyword: "Apakah pekerjaan Anda", type: "dropdown", label: realPekerjaan, priority: 20 });
  rules.push({ keyword: "pekerjaan anda saat ini", type: "dropdown", label: realPekerjaan, priority: 20 });
  rules.push({ keyword: "jenis pekerjaan", type: "dropdown", label: realPekerjaan, priority: 20 });
  rules.push({ keyword: "pilih pekerjaan", type: "dropdown", label: realPekerjaan, priority: 20 });
  rules.push({ keyword: "pekerjaan", type: "dropdown", label: realPekerjaan, priority: 20 });

  rules.push({ keyword: "berat badan", type: "input", value: String(realBB), priority: 20 });
  rules.push({ keyword: "tinggi badan", type: "input", value: String(realTB), priority: 20 });
  rules.push({ keyword: "panjang badan", type: "input", value: String(realTB), priority: 20 });
  rules.push({ keyword: "lingkar perut", type: "input", value: String(realLP), priority: 20 });
  rules.push({ keyword: "tekanan darah sistolik", type: "input", value: String(realSistol), priority: 20 });
  rules.push({ keyword: "sistolik", type: "input", value: String(realSistol), priority: 20 });
  rules.push({ keyword: "tekanan darah diastolik", type: "input", value: String(realDiastol), priority: 20 });
  rules.push({ keyword: "diastolik", type: "input", value: String(realDiastol), priority: 20 });
  rules.push({ keyword: "gula darah sewaktu", type: "input", value: String(realGDS), priority: 20 });
  rules.push({ keyword: "gula darah anak", type: "input", value: String(realGDS), priority: 20 });
  rules.push({ keyword: "gds", type: "input", value: String(realGDS), priority: 20 });

  // 7. Sisipkan Aturan Spesifik & Komprehensif Tambahan Sesuai Mesin Android V2
  // A. Perilaku Merokok & Kadar CO (Dinamis Sesuai Status Pasien - Screenshot 1 & 2)
  rules.push({ keyword: "Apakah Anda merokok dalam setahun terakhir ini", type: "radio", label: isSmoker ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "merokok dalam setahun", type: "radio", label: isSmoker ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "Apakah Anda pernah merokok sebelumnya", type: "radio", label: pernahMerokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "pernah merokok sebelumnya", type: "radio", label: pernahMerokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "pernah merokok", type: "radio", label: pernahMerokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "kapan anda berhenti merokok", type: "radio", label: "1 s.d <10 tahun lalu", priority: 10 });
  rules.push({ keyword: "Apakah Anda terpapar asap rokok atau menghirup asap rokok dari orang lain dalam sebulan terakhir", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "Apakah Anda terpapar asap rokok atau menghirup asap rokok dari orang lain", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "terpapar asap rokok atau menghirup asap rokok", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "terpapar asap rokok", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "menghirup asap rokok dari orang lain", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "rokok elektrik", type: "radio", label: "Tidak", priority: 5 });
  rules.push({ keyword: "vape", type: "radio", label: "Tidak", priority: 5 });

  // Pilihan dinamis saat perokok aktif (Screenshot 2)
  if (isSmoker) {
    rules.push({ keyword: "Jika perokok, jenis rokok apa yang dikonsumsi", type: "radio", label: prof.jenisRokok, priority: 10 });
    rules.push({ keyword: "jenis rokok apa yang dikonsumsi", type: "radio", label: prof.jenisRokok, priority: 10 });
    rules.push({ keyword: "Sudah berapa tahun Anda merokok", type: "radio", label: prof.bungkusTahunOption, priority: 10 });
    rules.push({ keyword: "berapa tahun Anda merokok", type: "radio", label: prof.bungkusTahunOption, priority: 10 });
    rules.push({ keyword: "bungkus tahun", type: "radio", label: prof.bungkusTahunOption, priority: 10 });
    rules.push({ keyword: "Biasanya, berapa batang rokok yang Anda hisap dalam sehari", type: "input", value: String(prof.batangRokokPerHari || 10), priority: 10 });
    rules.push({ keyword: "berapa batang rokok yang Anda hisap", type: "input", value: String(prof.batangRokokPerHari || 10), priority: 10 });
    rules.push({ keyword: "batang rokok", type: "input", value: String(prof.batangRokokPerHari || 10), priority: 10 });
  }

  rules.push({ keyword: "kadar co", type: "input", value: String(kadarCO), priority: 10 });
  rules.push({ keyword: "Kadar CO Pernapasan", type: "input", value: String(kadarCO), priority: 10 });
  rules.push({ keyword: "analisis co", type: "input", value: String(kadarCO), priority: 10 });
  rules.push({ keyword: "kategori kadar co", type: "radio", label: isSmoker ? "Tinggi / Waspada (Merah/Kuning)" : "Normal / Rendah (Hijau)", priority: 10 });
  rules.push({ keyword: "kategori kadar co", type: "dropdown", label: isSmoker ? "Tinggi / Waspada (Merah/Kuning)" : "Normal / Rendah (Hijau)", priority: 10 });
  rules.push({ keyword: "interpretasi kadar co", type: "radio", label: isSmoker ? "Perokok aktif" : "Bukan perokok", priority: 10 });
  rules.push({ keyword: "interpretasi kadar co", type: "dropdown", label: isSmoker ? "Perokok aktif" : "Bukan perokok", priority: 10 });
  rules.push({ keyword: "tatalaksana merokok", type: "dropdown", label: isSmoker ? "Konseling Upaya Berhenti Merokok (UBM)" : "KIE Pola Hidup Sehat", priority: 10 });
  rules.push({ keyword: "bersedia berhenti merokok", type: "radio", label: "Ya", priority: 10 });
  rules.push({ keyword: "upaya berhenti merokok", type: "radio", label: "Ya", priority: 10 });

  // B. Riwayat Diabetes Dokter & Durasi Bulan (Screenshot 5)
  rules.push({ keyword: "apakah anda pernah dinyatakan diabetes atau kencing manis oleh dokter", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "apakah anda pernah dinyatakan diabetes", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "pernah dinyatakan diabetes", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "dinyatakan diabetes atau kencing manis", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "riwayat diabetes", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "riwayat kencing manis", type: "radio", label: hasDiabetes ? "Ya" : "Tidak", priority: 10 });
  if (hasDiabetes) {
    rules.push({ keyword: "sudah berapa bulan anda didiagnosis", type: "input", value: String(diabetesDuration), priority: 10 });
    rules.push({ keyword: "berapa bulan anda didiagnosis", type: "input", value: String(diabetesDuration), priority: 10 });
    rules.push({ keyword: "total bulan sejak didiagnosis", type: "input", value: String(diabetesDuration), priority: 10 });
  }

  // Gula Darah Dewasa Lansia (Sesuai CKG_Puskesmas_Android_V2: Hanya isi GDS 1 >= 70/40; kosongkan GDP & GD 2 Jam PP agar tidak kena error validasi < 40)
  const hasExplicitGDP = rawP.gulaDarahPuasa || rawP.gdp || rawP.gula_darah_puasa;
  rules.push({ keyword: "gula darah sewaktu (gds)", type: "input", value: String(realGDS), priority: 10 });
  rules.push({ keyword: "gula darah sewaktu", type: "input", value: String(realGDS), priority: 10 });
  rules.push({ keyword: "gula darah puasa (gdp)", type: "input", value: hasExplicitGDP ? String(realGDP) : "", priority: 10 });
  rules.push({ keyword: "gula darah puasa", type: "input", value: hasExplicitGDP ? String(realGDP) : "", priority: 10 });
  rules.push({ keyword: "gula darah 2 jam pp", type: "input", value: "", priority: 10 });
  rules.push({ keyword: "gd 2 jam pp", type: "input", value: "", priority: 10 });
  if (!hasDiabetes && realGDS >= 140) {
    const gds2Val = prof.gds2 || Math.round(realGDS * 0.95);
    rules.push({ keyword: "gula darah sewaktu kedua", type: "input", value: String(gds2Val), priority: 10 });
    rules.push({ keyword: "gds 2", type: "input", value: String(gds2Val), priority: 10 });
  }

  // C. Hemoglobin & Anemia
  rules.push({ keyword: "pemeriksaan hemoglobin", type: "input", value: String(hbVal) });
  rules.push({ keyword: "hasil pemeriksaan hemoglobin", type: "input", value: String(hbVal) });
  rules.push({ keyword: "nilai hemoglobin", type: "input", value: String(hbVal) });
  rules.push({ keyword: "status anemia", type: "radio", label: "Tidak anemia" });
  rules.push({ keyword: "status anemia", type: "dropdown", label: "Tidak anemia" });
  rules.push({ keyword: "tatalaksana anemia", type: "dropdown", label: "KIE Gizi Seimbang" });

  // D. Laboratorium POCT (Ginjal, Hati, Lipid, Glukosa)
  rules.push({ keyword: "apakah dilakukan pemeriksaan gula darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "pemeriksaan gula darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "apakah dilakukan pemeriksaan laboratorium", type: "radio", label: "Ya" });
  rules.push({ keyword: "apakah dilakukan pemeriksaan fungsi ginjal", type: "radio", label: "Ya" });
  rules.push({ keyword: "apakah dilakukan pemeriksaan fungsi hati", type: "radio", label: "Ya" });
  rules.push({ keyword: "apakah dilakukan pemeriksaan profil lipid", type: "radio", label: "Ya" });
  rules.push({ keyword: "protein urin", type: "radio", label: "Negatif" });
  rules.push({ keyword: "protein urin", type: "dropdown", label: "Negatif" });
  rules.push({ keyword: "albuminuria", type: "radio", label: "Negatif" });
  rules.push({ keyword: "albuminuria", type: "dropdown", label: "Negatif" });
  rules.push({ keyword: "konsentrasi albumin urin", type: "input", value: "15" });
  rules.push({ keyword: "konsentrasi kreatinin urin", type: "input", value: "100" });
  rules.push({ keyword: "uacr", type: "radio", label: "Normal (< 30 mg/g)" });
  rules.push({ keyword: "uacr", type: "dropdown", label: "Normal (< 30 mg/g)" });
  rules.push({ keyword: "kategori e-lfg", type: "radio", label: "Normal (≥ 90 mL/mnt/1.73m²)" });
  rules.push({ keyword: "kategori e-lfg", type: "dropdown", label: "Normal (≥ 90 mL/mnt/1.73m²)" });
  rules.push({ keyword: "kesimpulan fungsi ginjal", type: "radio", label: "Normal" });
  rules.push({ keyword: "kesimpulan fungsi ginjal", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kesimpulan fungsi hati", type: "radio", label: "Normal" });
  rules.push({ keyword: "kesimpulan fungsi hati", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kesimpulan profil lipid", type: "radio", label: "Normal" });
  rules.push({ keyword: "kesimpulan profil lipid", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kolesterol total", type: "input", value: String(prof.kolesterol) });
  rules.push({ keyword: "trigliserida", type: "input", value: String(prof.trigliserida) });
  rules.push({ keyword: "hdl", type: "input", value: String(prof.hdl) });
  rules.push({ keyword: "ldl", type: "input", value: String(prof.ldl) });
  rules.push({ keyword: "ureum", type: "input", value: String(prof.ureum) });
  rules.push({ keyword: "kreatinin", type: "input", value: String(prof.kreatinin) });
  rules.push({ keyword: "sgot", type: "input", value: String(prof.sgot || 24) });
  rules.push({ keyword: "sgpt", type: "input", value: String(prof.sgpt || 22) });
  rules.push({ keyword: "trombosit", type: "input", value: "250000" });
  rules.push({ keyword: "pemeriksaan fibrosis/sirosis", type: "radio", label: "F0-F1 (Normal)" });
  rules.push({ keyword: "fibrosis", type: "radio", label: "F0-F1 (Normal)" });
  rules.push({ keyword: "sirosis", type: "radio", label: "F0-F1 (Normal)" });

  // E. Tanda Vital & Cara Ukur
  rules.push({ keyword: "apakah dilakukan pengukuran tekanan darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "dilakukan pengukuran tekanan darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "pengukuran tekanan darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "pemeriksaan tekanan darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "apakah dilakukan pemeriksaan tekanan darah", type: "radio", label: "Ya" });
  rules.push({ keyword: "obat antihipertensi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "minum obat darah tinggi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "minum obat hipertensi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat hipertensi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "apakah sedang minum obat", type: "radio", label: "Tidak" });
  rules.push({ keyword: "cara pengukuran", type: "radio", label: prof.caraUkur });
  rules.push({ keyword: "posisi pengukuran", type: "radio", label: prof.caraUkur });
  rules.push({ keyword: "sistol", type: "input", value: String(realSistol || 118) });
  rules.push({ keyword: "diastol", type: "input", value: String(realDiastol || 78) });
  rules.push({ keyword: "tekanan darah sistol", type: "input", value: String(realSistol || 118) });
  rules.push({ keyword: "tekanan darah diastol", type: "input", value: String(realDiastol || 78) });
  rules.push({ keyword: "nadi", type: "input", value: String(prof.nadi) });
  rules.push({ keyword: "denyut jantung", type: "input", value: String(prof.nadi) });
  rules.push({ keyword: "respirasi", type: "input", value: String(prof.respirasi) });
  rules.push({ keyword: "suhu", type: "input", value: String(prof.suhu) });
  rules.push({ keyword: "lingkar kepala", type: "input", value: String(prof.lk) });
  rules.push({ keyword: "lila", type: "input", value: String(prof.lila) });
  rules.push({ keyword: "lingkar lengan", type: "input", value: String(prof.lila) });

  // F. Pemeriksaan Mandiri (Demografi Anak, Faktor Risiko Gula Darah Anak)
  const labelRisikoGulaAnak = hasDiabetes ? "Ya" : "Tidak";
  rules.push({ keyword: "Apakah Anda penyandang disabilitas", type: "radio", label: "Non disabilitas" });
  rules.push({ keyword: "penyandang disabilitas", type: "radio", label: "Non disabilitas" });
  rules.push({ keyword: "Demografi Anak", type: "radio", label: "Non disabilitas" });
  rules.push({ keyword: "Faktor Risiko Gula Darah Anak", type: "radio", label: labelRisikoGulaAnak });
  rules.push({ keyword: "faktor risiko gula darah", type: "radio", label: labelRisikoGulaAnak });

  // G. Formulir Mandiri Hati (9 Pertanyaan Skrining Mandiri Hati Semua "Tidak")
  rules.push({ keyword: "tes untuk Hepatitis B", type: "radio", label: "Tidak" });
  rules.push({ keyword: "menderita Hepatitis B", type: "radio", label: "Tidak" });
  rules.push({ keyword: "ibu kandung/saudara sekandung yang menderita Hepatitis B", type: "radio", label: "Tidak" });
  rules.push({ keyword: "seksual berisiko", type: "radio", label: "Tidak" });
  rules.push({ keyword: "bukan pasangan suami/istri", type: "radio", label: "Tidak" });
  rules.push({ keyword: "transfusi darah", type: "radio", label: "Tidak" });
  rules.push({ keyword: "cuci darah", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hemodialisis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "narkoba", type: "radio", label: "Tidak" });
  rules.push({ keyword: "bahan adiktif lainnya dengan cara disuntik", type: "radio", label: "Tidak" });
  rules.push({ keyword: "orang dengan HIV", type: "radio", label: "Tidak" });
  rules.push({ keyword: "ODHIV", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pengobatan Hepatitis C", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kolesterol (lemak darah) tinggi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "lemak darah", type: "radio", label: "Tidak" });

  // H. Penyakit Menular Nakes: Malaria, Hepatitis Nakes, HIV, Sifilis (Semua "Non Reaktif" / "Tidak")
  rules.push({ keyword: "hasil pemeriksaan hbsag", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "hasil pemeriksaan anti-hcv", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "hbsag", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "anti-hcv", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "rapid test hbsag", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "rapid test anti-hcv", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "rapid hbsag", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "rapid anti-hcv", type: "radio", label: "Non Reaktif" });

  // Skrining Telinga dan Mata (Nilai Realistis Lansia vs Dewasa - Screenshot 3)
  rules.push({ keyword: "Skrining Telinga dan Mata", type: "radio", label: "Normal", priority: 5 });
  rules.push({ keyword: "telinga dan mata", type: "radio", label: "Normal", priority: 5 });
  rules.push({ keyword: "Apa Hasil Pemeriksaan Telinga Luar (serumen impaksi)", type: "radio", label: telingaSerumen, priority: 10 });
  rules.push({ keyword: "telinga luar (serumen impaksi)", type: "radio", label: telingaSerumen, priority: 10 });
  rules.push({ keyword: "serumen impaksi", type: "radio", label: telingaSerumen, priority: 10 });
  rules.push({ keyword: "Apa Hasil Pemeriksaan Telinga Luar (infeksi telinga)", type: "radio", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "Apa Hasil Pemeriksaan Telinga Luar (infeksi telinga)", type: "dropdown", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "telinga luar (infeksi telinga)", type: "radio", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "telinga luar (infeksi telinga)", type: "dropdown", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "infeksi telinga", type: "radio", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "infeksi telinga", type: "dropdown", label: telingaInfeksi, priority: 10 });
  rules.push({ keyword: "Hasil pemeriksaan tajam pendengaran", type: "radio", label: tajamPendengaran, priority: 10 });
  rules.push({ keyword: "tajam pendengaran", type: "radio", label: tajamPendengaran, priority: 10 });
  rules.push({ keyword: "gangguan pendengaran", type: "radio", label: tajamPendengaran, priority: 10 });
  rules.push({ keyword: "tes bisik", type: "radio", label: tajamPendengaran, priority: 10 });
  rules.push({ keyword: "tes bisik", type: "dropdown", label: tajamPendengaran, priority: 10 });
  rules.push({ keyword: "Apa hasil skrining tajam penglihatan", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "skrining tajam penglihatan", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "tajam penglihatan mata", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "tajam penglihatan", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "pemeriksaan visus", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "visus", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "Hasil pemeriksaan pupil", type: "radio", label: pupilKatarak, priority: 10 });
  rules.push({ keyword: "pemeriksaan pupil", type: "radio", label: pupilKatarak, priority: 10 });
  rules.push({ keyword: "katarak", type: "radio", label: pupilKatarak, priority: 10 });
  rules.push({ keyword: "kekeruhan lensa", type: "radio", label: pupilKatarak === "Curiga Katarak" ? "Ada kekeruhan lensa" : "Tidak ada kekeruhan lensa", priority: 10 });
  rules.push({ keyword: "glaukoma", type: "radio", label: "Normal", priority: 5 });
  rules.push({ keyword: "gigi karies", type: "radio", label: prof.hasKaries ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "gigi hilang", type: "radio", label: "Tidak", priority: 5 });
  rules.push({ keyword: "kacamata", type: "radio", label: "Tidak", priority: 5 });
  rules.push({ keyword: "hasil skrining penglihatan", type: "radio", label: tajamPenglihatan, priority: 10 });
  rules.push({ keyword: "hasil skrining pendengaran", type: "radio", label: tajamPendengaran, priority: 10 });

  // Pemeriksaan PPOK (Skrining PUMA) (Screenshot 4)
  rules.push({ keyword: "Usia - skor PUMA", type: "radio", label: prof.pumaUsiaLabel, age: ageYears, priority: 10 });
  rules.push({ keyword: "Usia - skor PUMA", type: "dropdown", label: prof.pumaUsiaLabel, age: ageYears, priority: 10 });
  rules.push({ keyword: "usia - skor puma", type: "radio", label: prof.pumaUsiaLabel, age: ageYears, priority: 10 });
  rules.push({ keyword: "usia - skor puma", type: "dropdown", label: prof.pumaUsiaLabel, age: ageYears, priority: 10 });
  rules.push({ keyword: "Apakah anda sedang/mempunyai riwayat merokok", type: "radio", label: prof.pumaRiwayatMerokok, priority: 10 });
  rules.push({ keyword: "sedang/mempunyai riwayat merokok", type: "radio", label: prof.pumaRiwayatMerokok, priority: 10 });
  rules.push({ keyword: "Jika Perokok Aktif, berapa bungkus per tahun", type: "dropdown", label: prof.pumaBungkusTahun, priority: 10 });
  rules.push({ keyword: "Jika Perokok Aktif, berapa bungkus per tahun", type: "radio", label: prof.pumaBungkusTahun, priority: 10 });
  rules.push({ keyword: "berapa bungkus per tahun", type: "dropdown", label: prof.pumaBungkusTahun, priority: 10 });
  rules.push({ keyword: "berapa bungkus per tahun", type: "radio", label: prof.pumaBungkusTahun, priority: 10 });
  rules.push({ keyword: "Apakah Anda pernah merasa napas pendek", type: "radio", label: prof.pumaNapasPendek, priority: 10 });
  rules.push({ keyword: "napas pendek ketika berjalan", type: "radio", label: prof.pumaNapasPendek, priority: 10 });
  rules.push({ keyword: "napas pendek", type: "radio", label: prof.pumaNapasPendek, priority: 10 });
  rules.push({ keyword: "Apakah Anda biasanya mempunyai dahak", type: "radio", label: prof.pumaDahak, priority: 10 });
  rules.push({ keyword: "dahak yang berasal dari paru", type: "radio", label: prof.pumaDahak, priority: 10 });
  rules.push({ keyword: "kesulitan mengeluarkan dahak", type: "radio", label: prof.pumaDahak, priority: 10 });
  rules.push({ keyword: "dahak", type: "radio", label: prof.pumaDahak, priority: 10 });

  // Skrining SADANIS / Kanker Payudara
  rules.push({ keyword: "pemeriksaan yang dilakukan", type: "dropdown", label: "SADANIS" });
  rules.push({ keyword: "hasil pemeriksaan sadanis", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "pemeriksaan sadanis", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "pemeriksaan sadanis", type: "radio", label: "Normal" });
  rules.push({ keyword: "pemeriksaan payudara", type: "radio", label: "Normal" });
  rules.push({ keyword: "benjolan pada payudara", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kelainan pada puting", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kelainan pada kulit payudara", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kelainan payudara", type: "radio", label: "Tidak ada kelainan" });

  // Pemeriksaan Hepatitis B & C (Rapid Test)
  rules.push({ keyword: "Hasil Rapid Test Hepatitis B", type: "radio", label: "HBsAg Non Reaktif" });
  rules.push({ keyword: "Hasil Rapid Test Hepatitis C", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "Rapid Test Hepatitis B", type: "radio", label: "HBsAg Non Reaktif" });
  rules.push({ keyword: "Rapid Test Hepatitis C", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan Hepatitis B", type: "radio", label: "HBsAg Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan Hepatitis C", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "HBsAg", type: "radio", label: "HBsAg Non Reaktif" });
  rules.push({ keyword: "Anti-HCV", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "Anti HCV", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "hepatitis b", type: "radio", label: "HBsAg Non Reaktif" });
  rules.push({ keyword: "hepatitis c", type: "radio", label: "Anti HCV Non Reaktif" });
  rules.push({ keyword: "Hasil Rapid Test", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Pemeriksaan Hepatitis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan Hepatitis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hepatitis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Pemeriksaan RDT Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Pemeriksaan RDT Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "RDT Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Pemeriksaan Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Hasil Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Malaria", type: "radio", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Hasil Pemeriksaan RDT Malaria", type: "dropdown", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Pemeriksaan RDT Malaria", type: "dropdown", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "RDT Malaria", type: "dropdown", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Malaria", type: "dropdown", label: "Non-Reaktif", fallbackIndex: 1 });
  rules.push({ keyword: "Apakah pernah sakit malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "Apakah ada orang sakit malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "daerah berisiko tinggi malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "Faktor Risiko Malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "Hasil Pemeriksaan Rapid Test HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Rapid Test HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil R2 HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil R3 HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Rapid Test HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Rapid HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "R2 HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "R3 HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "HIV", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Pemeriksaan HIV", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan HIV", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Pemeriksaan Rapid Test Sifilis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Rapid Test Sifilis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Rapid Test Sifilis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan Sifilis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "TP Rapid", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Treponema", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Sifilis", type: "radio", label: "Non Reaktif" });
  rules.push({ keyword: "Hasil Pemeriksaan Sifilis", type: "dropdown", label: "Non Reaktif" });
  rules.push({ keyword: "Pemeriksaan Sifilis", type: "dropdown", label: "Non Reaktif" });

  // I. Skrining Penyakit Tidak Menular, Kanker, & Jiwa
  if (rawP.pumaScore) {
    rules.push({ keyword: "puma", type: "radio", label: rawP.pumaScore.includes("PPOK") ? "Risiko PPOK" : "Normal" });
    rules.push({ keyword: "puma", type: "dropdown", label: rawP.pumaScore.includes("PPOK") ? "Risiko PPOK" : "Normal" });
  }
  if (rawP.kankerParu) {
    rules.push({ keyword: "kanker paru", type: "radio", label: rawP.kankerParu.includes("Berisiko") ? "Berisiko" : "Tidak Berisiko" });
  }
  if (rawP.kankerUsus) {
    rules.push({ keyword: "kanker usus", type: "radio", label: rawP.kankerUsus.includes("Berisiko") ? "Berisiko" : "Tidak Berisiko" });
  }
  if (rawP.kesehatanJiwaSrq20) {
    rules.push({ keyword: "srq20", type: "radio", label: rawP.kesehatanJiwaSrq20.includes("Mental") ? "Beresiko Masalah Mental" : "Normal" });
  }

  // J. Skrining Wanita (SADANIS, IVA, HPV DNA)
  if (!isMale) {
    const rawSadanis = String(rawP.sadanis || "Normal");
    rules.push({ keyword: "Pilih jenis pemeriksaan yang dilakukan", type: "radio", label: "Pemeriksaan Payudara Klinis (SADANIS)" });
    rules.push({ keyword: "jenis pemeriksaan yang dilakukan", type: "radio", label: "Pemeriksaan Payudara Klinis (SADANIS)" });
    rules.push({ keyword: "pemeriksaan payudara klinis", type: "radio", label: "Pemeriksaan Payudara Klinis (SADANIS)" });
    rules.push({ keyword: "sadanis", type: "radio", label: rawSadanis.includes("Benjolan") ? "Ada Benjolan" : (rawSadanis.includes("Ganas") ? "Curiga Ganas" : "Tidak ada kelainan") });
    rules.push({ keyword: "sadanis", type: "dropdown", label: rawSadanis.includes("Benjolan") ? "Ada Benjolan" : (rawSadanis.includes("Ganas") ? "Curiga Ganas" : "Tidak ada kelainan") });
    rules.push({ keyword: "pemeriksaan payudara", type: "radio", label: "Tidak ada kelainan" });
    rules.push({ keyword: "skrining kanker payudara", type: "radio", label: "Tidak ada kelainan" });

    const rawIva = String(rawP.iva || "Negatif");
    rules.push({ keyword: "iva", type: "radio", label: rawIva.includes("Positif") ? "Positif" : (rawIva.includes("Kanker") ? "Curiga Kanker Serviks" : "Negatif") });
    rules.push({ keyword: "iva", type: "dropdown", label: rawIva.includes("Positif") ? "Positif" : (rawIva.includes("Kanker") ? "Curiga Kanker Serviks" : "Negatif") });
    rules.push({ keyword: "inspekulo", type: "radio", label: "Negatif" });
    rules.push({ keyword: "pemeriksaan inspekulo dan iva", type: "radio", label: "Negatif" });

    const rawHpv = String(rawP.hpvDna || "Negatif");
    rules.push({ keyword: "hpv", type: "radio", label: rawHpv.includes("Positif") ? "Positif" : "Negatif" });
    rules.push({ keyword: "hasil pemeriksaan hpv-dna", type: "radio", label: "Negatif" });
  }

  // K. Kesehatan Reproduksi Anak Sekolah & Remaja
  rules.push({ keyword: "gatal-gatal di kemaluan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kencing berwarna kuning kental seperti susu", type: "radio", label: "Tidak" });
  rules.push({ keyword: "nyeri/ tidak nyaman saat Buang Air Kecil", type: "radio", label: "Tidak" });
  rules.push({ keyword: "luka di anus atau dubur", type: "radio", label: "Tidak" });
  rules.push({ keyword: "organ reproduksi", type: "radio", label: "Normal" });
  rules.push({ keyword: "kelainan organ reproduksi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kelainan organ reproduksi", type: "dropdown", label: "Tidak ada" });
  rules.push({ keyword: "apakah anda mengalami keluhan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "keluhan pada alat kelamin", type: "radio", label: "Tidak" });
  rules.push({ keyword: "keluhan reproduksi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat penyakit reproduksi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kesehatan reproduksi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "reproduksi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "apakah sudah mengalami menstruasi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sudah mengalami menstruasi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "usia berapa anda mengalami menstruasi", type: "radio", label: "8 tahun -16 tahun" });

  // L. Aktivitas Fisik (Nilai Hari Selalu 1-7, Default 3 Hari)
  rules.push({ keyword: "berapa hari Anda aktif secara fisik", type: "input", value: "3" });
  rules.push({ keyword: "biasanya dalam satu minggu", type: "input", value: "3" });
  rules.push({ keyword: "aktif secara fisik", type: "input", value: "3" });

  // J. Balita (KPSP, MCHAT, Imunisasi)
  if (category === "balita" || category === "bayi") {
    const rawKpsp = String(rawP.kpsp || "Sesuai");
    rules.push({ keyword: "kpsp", type: "radio", label: rawKpsp });
    rules.push({ keyword: "kpsp", type: "dropdown", label: rawKpsp });

    const rawMchat = String(rawP.mchat || "Normal");
    rules.push({ keyword: "mchat", type: "radio", label: rawMchat });
    rules.push({ keyword: "mchat", type: "dropdown", label: rawMchat });

    const rawImun = String(rawP.statusImunisasi || "Lengkap");
    rules.push({ keyword: "status imunisasi", type: "radio", label: rawImun });
    rules.push({ keyword: "imunisasi", type: "radio", label: rawImun });
  }

  // K. Lansia (SKILAS & Barthel Index)
  if (category === "lansia" || ageYears >= 60) {
    const rawKog = String(rawP.skilasKognitif || "Normal");
    rules.push({ keyword: "skilas kognitif", type: "radio", label: rawKog });

    const rawMob = String(rawP.skilasMobilisasi || "Normal");
    rules.push({ keyword: "skilas mobilisasi", type: "radio", label: rawMob });

    rules.push({ keyword: "chair stand", type: "input", value: String(realChairStand) });

    const rawMal = String(rawP.skilasMalnutrisi || "Normal");
    rules.push({ keyword: "skilas malnutrisi", type: "radio", label: rawMal });

    const rawDep = String(rawP.skilasDepresi || "Normal");
    rules.push({ keyword: "skilas depresi", type: "radio", label: rawDep });

    const rawAdl = String(rawP.barthelIndexAdl || "Mandiri (Skor 20)");
    rules.push({ keyword: "barthel", type: "radio", label: rawAdl });
    rules.push({ keyword: "barthel", type: "dropdown", label: rawAdl });
    rules.push({ keyword: "adl", type: "radio", label: rawAdl });
  }

  // L. Pemeriksaan Gigi, Karies, Periodontal & Indera (Berdasarkan Usia)
  const kariesYaTidak = prof.hasKaries ? "Ya" : "Tidak";
  const kariesAdaTidak = prof.hasKaries ? "Ada" : "Tidak ada";
  const periodontalYaTidak = prof.hasPeriodontal ? "Ya" : "Tidak";
  rules.push({ keyword: "karies gigi", type: "radio", label: kariesYaTidak });
  rules.push({ keyword: "gigi berlubang", type: "radio", label: kariesYaTidak });
  rules.push({ keyword: "jumlah gigi karies", type: "radio", label: prof.hasKaries ? String(prof.kariesCount || "1") : "Tidak ada" });
  rules.push({ keyword: "jumlah karies", type: "radio", label: prof.hasKaries ? String(prof.kariesCount || "1") : "Tidak ada" });
  rules.push({ keyword: "periodontal", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "jaringan periodontal", type: "radio", label: prof.hasPeriodontal ? "Tidak Normal" : "Normal" });
  rules.push({ keyword: "gusi berdarah", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "gusi bengkak", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "karang gigi", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "kalkulus", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "poket periodontal", type: "radio", label: periodontalYaTidak });
  rules.push({ keyword: "gigi goyang", type: "radio", label: "Tidak" });
  rules.push({ keyword: "status karies", type: "dropdown", label: kariesAdaTidak });
  rules.push({ keyword: "status periodontal", type: "dropdown", label: periodontalYaTidak });
  if (rawP.butaWarna) {
    rules.push({ keyword: "buta warna", type: "radio", label: String(rawP.butaWarna) });
  }


  // === ATURAN TAMBAHAN LENGKAP DARI MESIN ANDROID V2 ===
  // Status Perkawinan & Disabilitas
  rules.push({ keyword: "perkawinan", type: "radio", label: "Menikah" });
  rules.push({ keyword: "status pernikahan", type: "radio", label: "Menikah" });
  rules.push({ keyword: "rencana menikah", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sedang hamil", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hubungan intim", type: "radio", label: "Ya" });
  rules.push({ keyword: "imunisasi tetanus minimal 2 kali", type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "mendapatkan imunisasi tetanus minimal 2 kali", type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "mendapatkan imunisasi tetanus", type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "imunisasi tetanus", type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "status t", type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "tetanus minimal 2 kali", type: "dropdown", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "mendapatkan imunisasi tetanus minimal 2 kali", type: "dropdown", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  rules.push({ keyword: "imunisasi tetanus", type: "dropdown", label: "Pernah imunisasi tetanus minimal dua kali", priority: 15 });
  // Q1: Apakah merokok dalam setahun terakhir (70% Ya dewasa/lansia)
  rules.push({ keyword: "apakah anda merokok dalam setahun terakhir", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  rules.push({ keyword: "merokok dalam setahun terakhir", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  rules.push({ keyword: "merokok dalam kurun waktu 1 tahun terakhir", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  rules.push({ keyword: "merokok dalam kurun waktu setahun", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  rules.push({ keyword: "apakah anda merokok", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  rules.push({ keyword: "riwayat merokok", type: "radio", label: isSmoker ? "Ya" : (pernahMerokok ? "Ya" : "Tidak") });
  rules.push({ keyword: "perilaku merokok", type: "radio", label: isSmoker ? "Merokok" : "Tidak merokok" });
  rules.push({ keyword: "status merokok", type: "radio", label: isSmoker ? "Perokok aktif" : (pernahMerokok ? "Mantan perokok" : "Bukan perokok") });
  rules.push({ keyword: "status merokok", type: "dropdown", label: isSmoker ? "Perokok aktif" : (pernahMerokok ? "Mantan perokok" : "Bukan perokok") });
  rules.push({ keyword: "konsumsi rokok", type: "radio", label: isSmoker ? "Ya" : "Tidak" });
  // Q2: Apakah Anda pernah merokok sebelumnya (20% Ya jika tidak merokok dalam setahun)
  rules.push({ keyword: "apakah pernah merokok sebelumnya", type: "radio", label: pernahMerokok ? "Ya" : "Tidak" });
  rules.push({ keyword: "apakah anda pernah merokok", type: "radio", label: pernahMerokok ? "Ya" : "Tidak" });
  // Q3: Apakah Anda terpapar asap rokok (Lebih dominan Ya, 80% Ya)
  rules.push({ keyword: "apakah anda terpapar asap rokok", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak" });
  rules.push({ keyword: "paparan asap rokok", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak" });
  rules.push({ keyword: "terpapar asap rokok orang lain", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak" });
  rules.push({ keyword: "paparan asap rokok orang lain", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak" });
  rules.push({ keyword: "perokok pasif", type: "radio", label: terpaparAsapRokok ? "Ya" : "Tidak" });
  // 5. Pemeriksaan Kadar CO Pernapasan (Tatalaksana Merokok) - Jangan isi angka / kosongkan sesuai permintaan user
  rules.push({ keyword: "co napas", type: "input", value: "" });
  rules.push({ keyword: "co pernapasan", type: "input", value: "" });
  // 1. Skrining Kanker Paru (Usia => 45 tahun)
  rules.push({ keyword: "paparan debu industri", type: "radio", label: "Tidak" });
  rules.push({ keyword: "paparan asbes", type: "radio", label: "Tidak" });
  rules.push({ keyword: "paparan gas buang", type: "radio", label: "Tidak" });
  rules.push({ keyword: "paparan radon", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat kanker pada keluarga", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat kanker paru", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat penyakit paru kronis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "batuk darah", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hemoptisis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "suara serak", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hasil skrining kanker paru", type: "radio", label: isSmoker ? "Risiko Sedang" : "Risiko Rendah" });
  rules.push({ keyword: "hasil skrining kanker paru", type: "dropdown", label: isSmoker ? "Risiko Sedang" : "Risiko Rendah" });
  rules.push({ keyword: "risiko kanker paru", type: "radio", label: isSmoker ? "Risiko Sedang" : "Risiko Rendah" });
  rules.push({ keyword: "risiko kanker paru", type: "dropdown", label: isSmoker ? "Risiko Sedang" : "Risiko Rendah" });
  // 2. Skrining Kanker Usus (APCS)
  rules.push({ keyword: "riwayat polip usus", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kanker kolorektal keluarga", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kanker usus pada keluarga", type: "radio", label: "Tidak" });
  rules.push({ keyword: "keluarga derajat pertama kanker", type: "radio", label: "Tidak" });
  rules.push({ keyword: "bab berdarah", type: "radio", label: "Tidak" });
  rules.push({ keyword: "darah pada feses", type: "radio", label: "Tidak" });
  rules.push({ keyword: "perubahan pola bab", type: "radio", label: "Tidak" });
  rules.push({ keyword: "darah samar feses", type: "radio", label: "Tidak dilakukan" });
  rules.push({ keyword: "darah samar feses", type: "dropdown", label: "Tidak dilakukan" });
  rules.push({ keyword: "fobt", type: "radio", label: "Tidak dilakukan" });
  rules.push({ keyword: "fit", type: "radio", label: "Tidak dilakukan" });
  rules.push({ keyword: "hasil skrining apcs", type: "radio", label: "Risiko Rata-rata" });
  rules.push({ keyword: "hasil skrining apcs", type: "dropdown", label: "Risiko Rata-rata" });
  rules.push({ keyword: "risiko kanker usus", type: "radio", label: "Risiko Rata-rata" });
  rules.push({ keyword: "risiko kanker usus", type: "dropdown", label: "Risiko Rata-rata" });
  // 3. Skrining Jantung (Kardiovaskular)
  rules.push({ keyword: "nyeri dada", type: "radio", label: "Tidak" });
  rules.push({ keyword: "rasa tertekan di dada", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sesak napas saat aktivitas", type: "radio", label: "Tidak" });
  rules.push({ keyword: "jantung berdebar", type: "radio", label: "Tidak" });
  rules.push({ keyword: "palpitasi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "bengkak pada kedua tungkai", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat penyakit jantung keluarga", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat penyakit jantung", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hasil pemeriksaan - skrining jantung", type: "radio", label: "Risiko Rendah" });
  rules.push({ keyword: "hasil pemeriksaan - skrining jantung", type: "dropdown", label: "Risiko Rendah" });
  rules.push({ keyword: "risiko kardiovaskular", type: "radio", label: "Risiko Rendah (<10%)" });
  rules.push({ keyword: "risiko kardiovaskular", type: "dropdown", label: "Risiko Rendah (<10%)" });
  rules.push({ keyword: "hasil ekg", type: "radio", label: "Normal" });
  rules.push({ keyword: "hasil ekg", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "elektrokardiogram", type: "dropdown", label: "Normal" });
  // Status Gizi & Antropometri & Tanda Vital
  rules.push({ keyword: "status gizi", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "status gizi", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "status gizi", type: "radio", label: "Normal" });
  rules.push({ keyword: "status gizi", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "penilaian status gizi", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "penilaian status gizi", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "bb/u", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "bb/u", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "berat badan menurut umur", type: "radio", label: "Berat badan normal" });
  rules.push({ keyword: "berat badan menurut umur", type: "dropdown", label: "Berat badan normal" });
  rules.push({ keyword: "tb/u", type: "radio", label: "Normal" });
  rules.push({ keyword: "tb/u", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "tinggi badan menurut umur", type: "radio", label: "Normal" });
  rules.push({ keyword: "tinggi badan menurut umur", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "pb/u", type: "radio", label: "Normal" });
  rules.push({ keyword: "pb/u", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "panjang badan menurut umur", type: "radio", label: "Normal" });
  rules.push({ keyword: "panjang badan menurut umur", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "bb/tb", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "bb/tb", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "berat badan menurut tinggi badan", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "berat badan menurut tinggi badan", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "imt/u", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "imt/u", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "indeks massa tubuh menurut umur", type: "radio", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "indeks massa tubuh menurut umur", type: "dropdown", label: "Gizi Baik (Normal)" });
  rules.push({ keyword: "cara pengukuran", type: "radio", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "cara pengukuran", type: "dropdown", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "posisi pengukuran", type: "radio", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "posisi pengukuran", type: "dropdown", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "cara ukur", type: "radio", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "cara ukur", type: "dropdown", label: prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri") });
  rules.push({ keyword: "status lingkar perut", type: "radio", label: "Normal" });
  rules.push({ keyword: "status lingkar perut", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "obesitas sentral", type: "radio", label: "Tidak" });
  rules.push({ keyword: "status obesitas", type: "radio", label: "Normal" });
  rules.push({ keyword: "status obesitas", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "klasifikasi tekanan darah", type: "radio", label: "Normal" });
  rules.push({ keyword: "klasifikasi tekanan darah", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "status tekanan darah", type: "radio", label: "Normal" });
  rules.push({ keyword: "status tekanan darah", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kebersihan rongga mulut", type: "dropdown", label: prof.kebersihanMulut || "Baik" });
  rules.push({ keyword: "kebersihan rongga mulut", type: "radio", label: prof.kebersihanMulut || "Baik" });
  rules.push({ keyword: "kebersihan mulut", type: "dropdown", label: prof.kebersihanMulut || "Baik" });
  rules.push({ keyword: "kebersihan mulut", type: "radio", label: prof.kebersihanMulut || "Baik" });
  rules.push({ keyword: "mukosa mulut", type: "radio", label: "Normal" });
  rules.push({ keyword: "gingivitis", type: "radio", label: prof.hasPeriodontal ? "Ada" : "Tidak ada" });
  rules.push({ keyword: "lama didiagnosis diabetes", type: "input", value: hasDiabetes ? String(diabetesDuration || 12) : "" });
  rules.push({ keyword: "lama menderita diabetes", type: "input", value: hasDiabetes ? String(diabetesDuration || 12) : "" });
  // 4. Skrining Laboratorium => GDS, Ginjal, Hati, Lipid (Dinamis: Ada yang diperiksa, ada yang tidak)
  rules.push({ keyword: "pemeriksaan gds", type: "radio", label: (prof.isGdsExamDone !== false) ? "Dilakukan" : "Tidak dilakukan" });
  rules.push({ keyword: "jenis pemeriksaan gula darah", type: "dropdown", label: "Gula Darah Sewaktu (GDS)" });
  rules.push({ keyword: "jenis pemeriksaan gula darah", type: "radio", label: "Gula Darah Sewaktu (GDS)" });
  rules.push({ keyword: "metode pemeriksaan", type: "dropdown", label: "POCT" });
  // 6. Pemeriksaan PPOK (Skrining PUMA)
  rules.push({ keyword: "napas pendek saat berjalan cepat", type: "radio", label: "Tidak" });
  rules.push({ keyword: "batuk saat sedang tidak menderita selesma", type: "radio", label: "Tidak" });
  rules.push({ keyword: "batuk saat tidak sedang flu", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pemeriksaan spirometri atau peak flow meter", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pemeriksaan spirometri", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tes fungsi paru", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat merokok (pack-years)", type: "radio", label: isSmoker ? "10-20 bungkus-tahun" : "Tidak pernah merokok" });
  rules.push({ keyword: "skor puma", type: "dropdown", label: "< 6 (Risiko Rendah)" });
  rules.push({ keyword: "hasil puma", type: "dropdown", label: "Risiko Rendah" });
  rules.push({ keyword: "hasil skrining puma", type: "radio", label: "Risiko Rendah" });
  rules.push({ keyword: "risiko ppok", type: "radio", label: "Risiko Rendah" });
  rules.push({ keyword: "risiko ppok", type: "dropdown", label: "Risiko Rendah" });
  // 7. Skrining Telinga dan Mata (=> 40 tahun)
  rules.push({ keyword: "gangguan pendengaran di telinga", type: "radio", label: tajamPendengaran });
  rules.push({ keyword: "pupil", type: "radio", label: pupilKatarak });
  rules.push({ keyword: "gigi hilang/dicabut", type: "radio", label: prof.hasGigiHilang ? "Ya" : "Tidak" });
  rules.push({ keyword: "gigi hilang", type: "radio", label: prof.hasGigiHilang ? "Ya" : "Tidak", priority: 10 });
  rules.push({ keyword: "berapa jumlah gigi karies", type: "radio", label: prof.hasKaries ? String(prof.kariesCount || 1) : "Tidak ada" });
  rules.push({ keyword: "berapa jumlah gigi karies", type: "input", value: prof.hasKaries ? String(prof.kariesCount || 1) : "0" });
  // 8. SKILAS Pemeriksaan Gejala Depresi - Lansia & GDS Lanjutan
  rules.push({ keyword: "puas dengan kehidupan", type: "radio", label: "Ya" });
  rules.push({ keyword: "puas dengan kehidupan", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "apakah anda sering merasa bosan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "apakah anda sering merasa tidak berdaya", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tidak berharga seperti perasaan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "merasa tidak berharga", type: "radio", label: "Tidak" });
  rules.push({ keyword: "merasa sedih, tertekan", type: "dropdown", label: "Tidak" });
  rules.push({ keyword: "merasa sedih, tertekan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sedikit minat atau kesenangan", type: "dropdown", label: "Tidak" });
  rules.push({ keyword: "sedikit minat atau kesenangan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "apakah puas dengan hidup", type: "radio", label: "Ya" });
  rules.push({ keyword: "merasa hidup kosong", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sering merasa bosan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "merasa tidak berdaya", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kesimpulan depresi", type: "radio", label: "Normal" });
  // 8b. Skrining Mandiri: Gejala Depresi Remaja (Anak Sekolah & Remaja)
  rules.push({ keyword: "merasa sedih atau tertekan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tidak tertarik lagi dengan kegiatan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sering capek, sulit tidur", type: "radio", label: "Tidak" });
  rules.push({ keyword: "sulit fokus saat belajar", type: "radio", label: "Tidak" });
  rules.push({ keyword: "gejala depresi remaja", type: "radio", label: "Tidak" });
  // 8c. Skrining Mandiri: Faktor Risiko Hepatitis
  rules.push({ keyword: "faktor risiko hepatitis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tato", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tindik", type: "radio", label: "Tidak" });
  rules.push({ keyword: "anggota keluarga menderita hepatitis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kontak serumah dengan penderita hepatitis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pernah menggunakan narkoba suntik", type: "radio", label: "Tidak" });
  rules.push({ keyword: "jarum suntik", type: "radio", label: "Tidak" });
  // 8d. Skrining Mandiri: Kelayakan Tes Kebugaran (PAR-Q)
  rules.push({ keyword: "kelayakan tes kebugaran", type: "radio", label: "Tidak" });
  rules.push({ keyword: "masalah jantung", type: "radio", label: "Tidak" });
  rules.push({ keyword: "nyeri dada", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kehilangan keseimbangan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pingsan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "masalah tulang atau sendi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tekanan darah tinggi", type: "radio", label: "Tidak" });
  // 8e. Skrining Mandiri: Faktor Risiko Malaria
  rules.push({ keyword: "skrining malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "riwayat malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "daerah endemis malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "bepergian ke daerah endemis", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pernah menderita malaria", type: "radio", label: "Tidak" });
  rules.push({ keyword: "demam menggigil", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hasil pemeriksaan malaria", type: "radio", label: "Negatif" });
  rules.push({ keyword: "hasil pemeriksaan malaria", type: "dropdown", label: "Negatif" });
  // 8f. Skrining Mandiri: Kanker Leher Rahim & HPV
  rules.push({ keyword: "faktor risiko kanker leher rahim", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kanker leher rahim", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kanker serviks", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pemeriksaan iva", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pemeriksaan pap smear", type: "radio", label: "Tidak" });
  rules.push({ keyword: "tes hpv", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hpv-dna", type: "radio", label: "Negatif" });
  rules.push({ keyword: "pendarahan di luar siklus", type: "radio", label: "Tidak" });
  rules.push({ keyword: "keputihan berbau", type: "radio", label: "Tidak" });
  rules.push({ keyword: "nyeri saat berhubungan", type: "radio", label: "Tidak" });
  // 9. SKILAS Malnutrisi & MNA-SF Pemeriksaan Lanjutan
  rules.push({ keyword: "penurunan asupan makanan", type: "dropdown", label: "Tidak ada penurunan asupan makanan" });
  rules.push({ keyword: "penurunan asupan makanan", type: "radio", label: "Tidak ada penurunan asupan makanan" });
  rules.push({ keyword: "penurunan berat badan dalam tiga bulan", type: "dropdown", label: "Tidak ada penurunan berat badan" });
  rules.push({ keyword: "penurunan berat badan dalam tiga bulan", type: "radio", label: "Tidak ada penurunan berat badan" });
  rules.push({ keyword: "kemampuan melakukan mobilitas", type: "dropdown", label: "Bisa bepergian keluar rumah" });
  rules.push({ keyword: "kemampuan melakukan mobilitas", type: "radio", label: "Bisa bepergian keluar rumah" });
  rules.push({ keyword: "stress psikologis atau penyakit akut", type: "radio", label: "Tidak" });
  rules.push({ keyword: "masalah neuropsikologis", type: "dropdown", label: "Tidak ada masalah psikologis" });
  rules.push({ keyword: "masalah neuropsikologis", type: "radio", label: "Tidak ada masalah psikologis" });
  rules.push({ keyword: "nilai imt (indeks massa tubuh)", type: "dropdown", label: "IMT 23 atau lebih" });
  rules.push({ keyword: "nilai imt (indeks massa tubuh)", type: "radio", label: "IMT 23 atau lebih" });
  rules.push({ keyword: "berapa nilai imt", type: "dropdown", label: "IMT 23 atau lebih" });
  rules.push({ keyword: "berapa nilai imt", type: "radio", label: "IMT 23 atau lebih" });
  rules.push({ keyword: "berkurang >3 kg", type: "radio", label: "Tidak" });
  rules.push({ keyword: "penurunan berat badan > 3 kg", type: "radio", label: "Tidak" });
  rules.push({ keyword: "penurunan nafsu makan", type: "radio", label: "Tidak" });
  rules.push({ keyword: "pakaian terasa lebih longgar", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kesimpulan skrining malnutrisi", type: "radio", label: "Normal" });
  // 10. SKILAS Mobilisasi Lansia & SPPB Pemeriksaan Lanjutan
  rules.push({ keyword: "berdiri berdampingan", type: "radio", label: "Bertahan 10 detik" });
  rules.push({ keyword: "semi tandem", type: "radio", label: "Bertahan 10 detik" });
  rules.push({ keyword: "berdiri tandem", type: "radio", label: "Bertahan 10 detik" });
  rules.push({ keyword: "waktu untuk berjalan sejauh empat meter", type: "radio", label: "4,82 detik" });
  rules.push({ keyword: "kecepatan berjalan", type: "radio", label: "4,82 detik" });
  rules.push({ keyword: "waktu untuk bangkit dari kursi", type: "radio", label: "<11.19 detik" });
  rules.push({ keyword: "bangkit dari kursi lima kali", type: "radio", label: "<11.19 detik" });
  rules.push({ keyword: "tes berdiri di kursi", type: "radio", label: "Ya" });
  rules.push({ keyword: "tes berdiri dari kursi", type: "radio", label: "Ya" });
  rules.push({ keyword: "mampu berdiri 5 kali", type: "radio", label: "Ya" });
  rules.push({ keyword: "tes keseimbangan", type: "radio", label: "Normal" });
  rules.push({ keyword: "risiko jatuh", type: "radio", label: "Tidak berisiko jatuh" });
  rules.push({ keyword: "kesimpulan mobilisasi", type: "radio", label: "Normal" });
  // 11. SKILAS Penurunan Kognitif - Lansia
  rules.push({ keyword: "mengingat tiga kata", type: "radio", label: "Ya" });
  rules.push({ keyword: "mengingat tiga kata sebelumnya", type: "radio", label: "Ya" });
  rules.push({ keyword: "tanggal berapakah hari ini", type: "radio", label: "Benar semua" });
  rules.push({ keyword: "menggambar jam", type: "radio", label: "Normal" });
  rules.push({ keyword: "clock drawing", type: "radio", label: "Normal" });
  rules.push({ keyword: "kesimpulan skrining kognitif", type: "radio", label: "Normal" });
  // Kemandirian ADL Barthel (Lansia)
  rules.push({ keyword: "rangsang buang air besar", type: "dropdown", label: "Terkendali teratur" });
  rules.push({ keyword: "rangsang buang air besar", type: "radio", label: "Terkendali teratur" });
  rules.push({ keyword: "buang air besar", type: "dropdown", label: "Terkendali teratur" });
  rules.push({ keyword: "buang air besar", type: "radio", label: "Terkendali teratur" });
  rules.push({ keyword: "rangsang berkemih", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "rangsang berkemih", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "buang air kecil", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "buang air kecil", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "buar air kecil", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "buar air kecil", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "membersihkan diri", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "membersihkan diri", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "penggunaan jamban", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "penggunaan jamban", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "keluar masuk jamban", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "keluar masuk jamban", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "makan dan minum", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "makan dan minum", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "berubah sikap dari berbaring", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "berubah sikap dari berbaring", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "berbaring ke duduk", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "berbaring ke duduk", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "berpindah/berjalan", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "berpindah/berjalan", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "berpindah atau berjalan", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "berpindah atau berjalan", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "memakai baju", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "memakai baju", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "naik turun tangga", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "naik turun tangga", type: "radio", label: "Mandiri" });
  rules.push({ keyword: "mandi", type: "dropdown", label: "Mandiri" });
  rules.push({ keyword: "mandi", type: "radio", label: "Mandiri" });
  // Penyakit Menular & Kulit (Frambusia, Kusta, Skabies, TB) - Opsi Utama "Tidak ada", kemungkinan "Bukan..." 1:100 (1%)
  const labelKusta = Math.random() < 0.01 ? "Bukan Kusta" : "Tidak ada";
  const labelSkabies = Math.random() < 0.01 ? "Bukan Skabies" : "Tidak ada";
  const labelFrambusia = Math.random() < 0.01 ? "Bukan Frambusia" : "Tidak ada";
  rules.push({ keyword: "papul/nodul/ulkus", type: "radio", label: "Tidak ada" });
  rules.push({ keyword: "frambusia", type: "dropdown", label: labelFrambusia });
  rules.push({ keyword: "frambusia", type: "radio", label: labelFrambusia });
  rules.push({ keyword: "bercak kulit putih atau merah", type: "dropdown", label: labelKusta });
  rules.push({ keyword: "bercak kulit putih atau merah", type: "radio", label: labelKusta });
  rules.push({ keyword: "tanda kusta", type: "dropdown", label: labelKusta });
  rules.push({ keyword: "tanda kusta", type: "radio", label: labelKusta });
  rules.push({ keyword: "koreng/ruam/bentol", type: "dropdown", label: labelSkabies });
  rules.push({ keyword: "koreng/ruam/bentol", type: "radio", label: labelSkabies });
  rules.push({ keyword: "tanda skabies", type: "dropdown", label: labelSkabies });
  rules.push({ keyword: "tanda skabies", type: "radio", label: labelSkabies });
  // Skrining Tuberkulosis Nakes Anak (1-9 tahun) & Umum
  rules.push({ keyword: "kontak dengan pasien tuberkulosis", type: "dropdown", label: "Tidak ada", priority: 15 });
  rules.push({ keyword: "kontak dengan pasien tuberkulosis", type: "radio", label: "Tidak ada", priority: 15 });
  rules.push({ keyword: "kontak erat dengan penderita tbc", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "apakah ada kontak dengan pasien tb", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "uji tuberkulin", type: "radio", label: "Negatif", priority: 15 });
  rules.push({ keyword: "uji tuberkulin", type: "dropdown", label: "Negatif", priority: 15 });
  rules.push({ keyword: "mantoux", type: "radio", label: "Negatif", priority: 15 });
  rules.push({ keyword: "demam lebih dari 2 minggu", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "berat badan turun atau tidak naik", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "lesu atau anak kurang aktif", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "pembesaran kelenjar getah bening", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "skrining nakes anak 1-9 tahun", type: "radio", label: "Tidak", priority: 15 });
  rules.push({ keyword: "status imunisasi", type: "radio", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "status imunisasi", type: "dropdown", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi rutin", type: "radio", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi rutin", type: "dropdown", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi dasar", type: "radio", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi dasar", type: "dropdown", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi lanjutan", type: "radio", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "imunisasi lanjutan", type: "dropdown", label: "Lengkap", priority: 15 });
  rules.push({ keyword: "metode pemeriksaan (untuk terduga tb)", type: "dropdown", label: "Tidak dilakukan" });
  rules.push({ keyword: "batuk lebih dari 2 minggu", type: "radio", label: "Tidak" });
  rules.push({ keyword: "batuk berdahak", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kontak erat dengan pasien tbc", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kontak serumah dengan penderita tbc", type: "radio", label: "Tidak" });
  rules.push({ keyword: "mengalami demam meriang", type: "radio", label: "Tidak" });
  rules.push({ keyword: "berkeringat di malam hari tanpa aktivitas", type: "radio", label: "Tidak" });
  rules.push({ keyword: "penurunan berat badan tanpa sebab", type: "radio", label: "Tidak" });
  rules.push({ keyword: "gejala batuk", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kontak dengan penderita", type: "radio", label: "Tidak" });
  rules.push({ keyword: "terduga tb", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hasil foto toraks", type: "radio", label: "Normal" });
  rules.push({ keyword: "x-ray", type: "radio", label: "Normal" });
  rules.push({ keyword: "foto toraks (x-ray)", type: "dropdown", label: "Normal / Tidak tampak kelainan" });
  // Imunisasi & Anak/Balita
  rules.push({ keyword: "imunisasi polio", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "imunisasi polio", type: "radio", label: "Ya" });
  rules.push({ keyword: "imunisasi saat usia 0 sd 24", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "imunisasi saat usia 0 sd 24", type: "radio", label: "Ya" });
  rules.push({ keyword: "catatan imunisasi", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "catatan imunisasi", type: "radio", label: "Ya" });
  rules.push({ keyword: "buku kia", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "buku kia", type: "radio", label: "Ya" });
  rules.push({ keyword: "buku kms", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "buku kms", type: "radio", label: "Ya" });
  rules.push({ keyword: "asi eksklusif", type: "dropdown", label: "Ya" });
  rules.push({ keyword: "asi eksklusif", type: "radio", label: "Ya" });
  rules.push({ keyword: "imunisasi hpv", type: "radio", label: "Sudah" });
  rules.push({ keyword: "imunisasi hpv", type: "dropdown", label: "Sudah" });
  rules.push({ keyword: "sudah imunisasi", type: "radio", label: "Sudah imunisasi" });
  rules.push({ keyword: "sudah imunisasi", type: "dropdown", label: "Sudah imunisasi" });
  rules.push({ keyword: "riwayat imunisasi", type: "radio", label: "Sudah imunisasi" });
  rules.push({ keyword: "riwayat imunisasi", type: "dropdown", label: "Sudah imunisasi" });
  // Skrining Balita: SDIDTK, KPSP & M-CHAT (Autisme)
  rules.push({ keyword: "m-chat-r", type: "radio", label: "Normal" });
  rules.push({ keyword: "m-chat-r", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "m-chat", type: "radio", label: "Normal" });
  rules.push({ keyword: "m-chat", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "autisme", type: "radio", label: "Tidak" });
  rules.push({ keyword: "autisme", type: "dropdown", label: "Tidak" });
  rules.push({ keyword: "risiko autisme", type: "radio", label: "Risiko Rendah" });
  rules.push({ keyword: "risiko autisme", type: "dropdown", label: "Risiko Rendah" });
  rules.push({ keyword: "terlambat bicara", type: "radio", label: "Tidak" });
  rules.push({ keyword: "keterlambatan bicara", type: "radio", label: "Tidak" });
  rules.push({ keyword: "gangguan komunikasi", type: "radio", label: "Tidak" });
  rules.push({ keyword: "interaksi sosial", type: "radio", label: "Tidak" });
  rules.push({ keyword: "perilaku berulang", type: "radio", label: "Tidak" });
  rules.push({ keyword: "perilaku stereotipik", type: "radio", label: "Tidak" });
  rules.push({ keyword: "hasil kpsp", type: "dropdown", label: "Sesuai" });
  rules.push({ keyword: "hasil kpsp", type: "radio", label: "Sesuai" });
  rules.push({ keyword: "perkembangan anak", type: "dropdown", label: "Sesuai" });
  rules.push({ keyword: "perkembangan anak", type: "radio", label: "Sesuai" });
  rules.push({ keyword: "sdidtk", type: "dropdown", label: "Sesuai" });
  rules.push({ keyword: "sdidtk", type: "radio", label: "Sesuai" });
  rules.push({ keyword: "tanda bahaya", type: "dropdown", label: "Tidak ada" });
  rules.push({ keyword: "tanda bahaya", type: "radio", label: "Tidak" });
  rules.push({ keyword: "selaput mata merah", type: "radio", label: "Normal" });
  rules.push({ keyword: "nafsu makan turun", type: "radio", label: "Tidak" });
  rules.push({ keyword: "berat badan meskipun nafsu makan meningkat", type: "radio", label: "Tidak" });
  rules.push({ keyword: "kebugaran jasmani", type: "dropdown", label: "Baik" });
  // Penyakit Menular Seksual & Hepatitis
  rules.push({ keyword: "apri", type: "radio", label: "< 0.5" });
  rules.push({ keyword: "apri", type: "dropdown", label: "< 0.5" });
  rules.push({ keyword: "derajat fibrosis", type: "dropdown", label: "F0 - F1" });
  // Skrining Calon Pengantin (Catin) & Anemia (Kadar Hemoglobin Normal)
  rules.push({ keyword: "kadar hemoglobin", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "kadar hb", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "nilai hb", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hasil hemoglobin", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hasil hb", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hasil kadar hemoglobin", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hasil kadar hb", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hemoglobin (hb)", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "hemoglobin", type: "input", value: String(prof.hb || 13.5) });
  rules.push({ keyword: "kategori anemia", type: "dropdown", label: "Tidak anemia" });
  rules.push({ keyword: "kategori anemia", type: "radio", label: "Tidak anemia" });
  rules.push({ keyword: "anemia", type: "dropdown", label: "Tidak anemia" });
  rules.push({ keyword: "anemia", type: "radio", label: "Tidak anemia" });
  rules.push({ keyword: "tindak lanjut anemia", type: "dropdown", label: "KIE Gizi Seimbang" });
  rules.push({ keyword: "kesimpulan calon pengantin", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kesimpulan calon pengantin", type: "radio", label: "Normal" });
  rules.push({ keyword: "kesimpulan catin", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "kesimpulan catin", type: "radio", label: "Normal" });
  rules.push({ keyword: "status calon pengantin", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "status calon pengantin", type: "radio", label: "Normal" });
  rules.push({ keyword: "status catin", type: "dropdown", label: "Normal" });
  rules.push({ keyword: "status catin", type: "radio", label: "Normal" });
  rules.push({ keyword: "pemeriksaan trombosit", type: "input", value: String(prof.trombosit || 250000) });
  rules.push({ keyword: "albumin urin", type: "input", value: "15" });
  rules.push({ keyword: "kreatinin urin", type: "input", value: "100" });

  rules.patientProfile = {
    ...prof,
    bb: realBB,
    tb: realTB,
    lp: realLP,
    lk: realLK,
    lila: realLILA,
    caraUkur: realCaraUkur,
    sistol: realSistol,
    diastol: realDiastol,
    gds: realGDS,
    gdp: realGDP,
    hba1c: realHbA1c,
    kolesterol: realKolesterol,
    trigliserida: realTrigliserida,
    hdl: realHDL,
    ldl: realLDL,
    ureum: realUreum,
    kreatinin: realKreatinin,
    hb: realHb,
    chairStandSeconds: realChairStand,
    isSmoker,
    pernahMerokok,
    terpaparAsapRokok,
    kadarCO,
    hasDiabetes,
    diabetesDurationMonths: diabetesDuration,
    hasHipertensi,
    statusNikah,
    pekerjaan: realPekerjaan,
    isRencanaNikah,
    isHamil,
    isHubIntim,
    telingaSerumen,
    telingaInfeksi,
    tajamPendengaran,
    tajamPenglihatan,
    pupilKatarak,
    labelKusta,
    labelSkabies,
    labelFrambusia,
    ageYears,
    ageMonths,
    category,
    normGender
  };

  return rules;
}

/**
 * Daftar Lengkap Kolom Ekspor Laporan CKG (Skrining Mandiri + Pertanyaan Beruntun + Pemeriksaan Nakes)
 * Kolom yang tidak relevan dengan usia/gender/kondisi beruntun akan dibiarkan kosong ("").
 */
export const REPORT_EXPORT_COLUMNS = [
  // I. Identitas & Status Layanan
  { key: "timestamp", label: "Waktu Selesai" },
  { key: "kategori", label: "Kategori CKG" },
  { key: "nomorTiket", label: "No. Tiket" },
  { key: "nik", label: "NIK" },
  { key: "nama", label: "Nama Pasien" },
  { key: "tanggalLahir", label: "Tanggal Lahir" },
  { key: "usia", label: "Usia" },
  { key: "gender", label: "Jenis Kelamin" },
  { key: "siklusHidup", label: "Siklus Hidup" },
  { key: "pekerjaan", label: "Pekerjaan" },
  { key: "statusSkrining", label: "Status Skrining Mandiri" },
  { key: "statusRaport", label: "Status Pelayanan Nakes" },
  { key: "keterangan", label: "Keterangan" },

  // II. Skrining Mandiri: Demografi, Status Perkawinan & Reproduksi + Pertanyaan Beruntun
  { key: "disabilitas", label: "[Mandiri Demografi] Status Disabilitas" },
  { key: "statusPerkawinan", label: "[Mandiri Demografi] Status Perkawinan" },
  { key: "beruntunRencanaMenikah", label: "[Beruntun Belum Menikah/Cerai] Rencana Menikah < 1 Tahun (Catin)" },
  { key: "beruntunPernahHubunganIntim", label: "[Beruntun Status Nikah/Catin] Pernah Melakukan Hubungan Intim" },
  { key: "beruntunSedangHamil", label: "[Beruntun Perempuan Menikah] Apakah Sedang Hamil" },
  { key: "beruntunUsiaKehamilanMinggu", label: "[Beruntun Hamil=Ya] Usia Kehamilan (Minggu)" },
  { key: "statusImunisasiTetanusWus", label: "[Beruntun Perempuan WUS/Catin] Status Imunisasi Tetanus" },
  { key: "remajaSudahMenstruasi", label: "[Mandiri Remaja Putri] Apakah Sudah Mengalami Menstruasi" },
  { key: "beruntunUsiaPertamaMenstruasi", label: "[Beruntun Menstruasi=Ya] Usia Pertama Kali Menstruasi" },

  // III. Skrining Mandiri & Nakes: Perilaku Merokok, Paparan Asap & Kadar CO + Pertanyaan Beruntun
  { key: "merokokSetahunTerakhir", label: "[Mandiri Merokok] Merokok dalam 1 Tahun Terakhir" },
  { key: "beruntunJenisRokok", label: "[Beruntun Merokok=Ya] Jenis Rokok yang Dikonsumsi" },
  { key: "beruntunLamaMerokokBungkusTahun", label: "[Beruntun Merokok=Ya] Lama Merokok (Bungkus-Tahun)" },
  { key: "beruntunBatangRokokPerHari", label: "[Beruntun Merokok=Ya] Jumlah Batang Rokok per Hari" },
  { key: "beruntunBersediaBerhentiMerokok", label: "[Beruntun Merokok=Ya] Bersedia Berhenti Merokok (UBM)" },
  { key: "beruntunPernahMerokokSebelumnya", label: "[Beruntun Merokok=Tidak] Apakah Pernah Merokok Sebelumnya" },
  { key: "beruntunKapanBerhentiMerokok", label: "[Beruntun Pernah Merokok=Ya] Kapan Berhenti Merokok" },
  { key: "terpaparAsapRokokSebulan", label: "[Mandiri Merokok] Terpapar Asap Rokok Orang Lain (1 Bulan Terakhir)" },
  { key: "kadarCoPernapasanPpm", label: "[Nakes Merokok] Kadar CO Pernapasan (ppm)" },
  { key: "kategoriKadarCo", label: "[Nakes Merokok] Kategori Kadar CO" },
  { key: "interpretasiKadarCo", label: "[Nakes Merokok] Interpretasi Kadar CO" },
  { key: "tatalaksanaMerokok", label: "[Nakes Merokok] Tatalaksana / Konseling Merokok" },

  // IV. Skrining Mandiri: Tingkat Aktivitas Fisik & Kelayakan Kebugaran (PAR-Q) + Pertanyaan Beruntun
  { key: "aktivitasFisikRutin", label: "[Mandiri Aktivitas Fisik] Melakukan Aktivitas Fisik Sedang/Berat" },
  { key: "beruntunHariAktifPerMinggu", label: "[Beruntun Aktivitas] Jumlah Hari Aktif Fisik per Minggu" },
  { key: "beruntunMenitAktifPerHari", label: "[Beruntun Aktivitas] Durasi Menit Aktif Fisik per Hari" },
  { key: "parqNyeriDadaAktivitas", label: "[Mandiri PAR-Q] Nyeri Dada Saat Aktivitas Fisik" },
  { key: "parqMasalahTulangSendiPingsan", label: "[Mandiri PAR-Q] Masalah Tulang/Sendi atau Pingsan/Keseimbangan" },
  { key: "parqKelayakanTesKebugaran", label: "[Mandiri PAR-Q] Kesimpulan Kelayakan Tes Kebugaran" },

  // V. Skrining Mandiri & Nakes: Tekanan Darah & Hipertensi + Pertanyaan Beruntun
  { key: "riwayatHipertensiDokter", label: "[Mandiri Hipertensi] Pernah Dinyatakan Tekanan Darah Tinggi (Hipertensi)" },
  { key: "beruntunLamaHipertensiBulan", label: "[Beruntun Hipertensi=Ya] Lama Didiagnosis Hipertensi (Bulan)" },
  { key: "beruntunMinumObatHipertensi", label: "[Beruntun Hipertensi=Ya] Sedang Minum Obat Antihipertensi" },
  { key: "dilakukanPengukuranTd", label: "[Nakes Tekanan Darah] Apakah Dilakukan Pengukuran Tekanan Darah" },
  { key: "beruntunPosisiPengukuranTd", label: "[Beruntun TD=Ya] Posisi / Cara Pengukuran TD" },
  { key: "beruntunTdSistolik", label: "[Beruntun TD=Ya] Tekanan Darah Sistolik (mmHg)" },
  { key: "beruntunTdDiastolik", label: "[Beruntun TD=Ya] Tekanan Darah Diastolik (mmHg)" },
  { key: "beruntunKlasifikasiTd", label: "[Beruntun TD=Ya] Klasifikasi Tekanan Darah" },

  // VI. Skrining Mandiri & Nakes: Riwayat Diabetes & Gula Darah + Pertanyaan Beruntun
  { key: "faktorRisikoGulaDarahAnak", label: "[Mandiri Anak/Sekolah] Faktor Risiko Gula Darah Anak" },
  { key: "pernahDinyatakanDiabetes", label: "[Mandiri Diabetes] Pernah Dinyatakan Diabetes / Kencing Manis oleh Dokter" },
  { key: "beruntunLamaDiabetesBulan", label: "[Beruntun Diabetes=Ya] Lama Didiagnosis Diabetes (Bulan)" },
  { key: "beruntunMinumObatDiabetes", label: "[Beruntun Diabetes=Ya] Sedang Pengobatan / Obat Diabetes" },
  { key: "dilakukanPemeriksaanGds", label: "[Nakes Gula Darah] Apakah Dilakukan Pemeriksaan Gula Darah" },
  { key: "beruntunJenisPemeriksaanGula", label: "[Beruntun Gula=Ya] Jenis & Metode Pemeriksaan Gula Darah" },
  { key: "beruntunGulaDarahSewaktuGds1", label: "[Beruntun Gula=Ya] Gula Darah Sewaktu / GDS 1 (mg/dL)" },
  { key: "beruntunGulaDarahSewaktuKeduaGds2", label: "[Beruntun GDS Prediabetes] Gula Darah Sewaktu Kedua / GDS 2 (mg/dL)" },
  { key: "beruntunGulaDarahPuasaGdp", label: "[Beruntun Gula Lanjutan] Gula Darah Puasa / GDP (mg/dL)" },
  { key: "beruntunHba1cPersen", label: "[Beruntun Gula Lanjutan] HbA1c (%)" },

  // VII. Pemeriksaan Nakes: Antropometri, Status Gizi & Tanda Vital
  { key: "beratBadanKg", label: "[Nakes Antropometri] Berat Badan (kg)" },
  { key: "tinggiPanjangBadanCm", label: "[Nakes Antropometri] Tinggi / Panjang Badan (cm)" },
  { key: "caraPengukuranTb", label: "[Nakes Antropometri] Cara Pengukuran TB/PB (Berdiri/Terlentang)" },
  { key: "indeksMassaTubuhImt", label: "[Nakes Antropometri] Indeks Massa Tubuh / IMT (kg/m²)" },
  { key: "statusGiziImt", label: "[Nakes Antropometri] Status Gizi (IMT / IMT-U / BB-TB)" },
  { key: "bbMenurutUmurBbu", label: "[Nakes Bayi/Balita] Status Berat Badan Menurut Umur (BB/U)" },
  { key: "tbMenurutUmurTbu", label: "[Nakes Bayi/Balita/Anak] Status Tinggi/Panjang Badan Menurut Umur (PB/U atau TB/U)" },
  { key: "lingkarKepalaCm", label: "[Nakes Bayi/Balita] Lingkar Kepala (cm)" },
  { key: "lilaCm", label: "[Nakes Balita/WUS] Lingkar Lengan Atas / LILA (cm)" },
  { key: "lingkarPerutCm", label: "[Nakes Dewasa/Lansia] Lingkar Perut (cm)" },
  { key: "statusObesitasSentral", label: "[Nakes Dewasa/Lansia] Status Obesitas Sentral (Lingkar Perut)" },
  { key: "tandaVitalNadi", label: "[Nakes Tanda Vital] Denyut Nadi (x/menit)" },
  { key: "tandaVitalRespirasiSuhu", label: "[Nakes Tanda Vital] Frekuensi Napas (x/menit) & Suhu (°C)" },

  // VIII. Pemeriksaan Nakes: Gigi & Mulut + Pertanyaan Beruntun
  { key: "gigiKebersihanMulut", label: "[Nakes Gigi] Kebersihan Rongga Mulut" },
  { key: "gigiMukosaMulut", label: "[Nakes Gigi] Kondisi Mukosa Mulut" },
  { key: "gigiAdaKaries", label: "[Nakes Gigi] Apakah Ada Gigi Karies / Berlubang" },
  { key: "beruntunJumlahGigiKaries", label: "[Beruntun Karies=Ya] Jumlah Gigi Karies" },
  { key: "gigiHilangDicabut", label: "[Nakes Gigi] Apakah Ada Gigi Hilang / Dicabut" },
  { key: "gigiKarangKalkulus", label: "[Nakes Gigi] Karang Gigi / Kalkulus" },
  { key: "gigiKelainanPeriodontal", label: "[Nakes Gigi] Kelainan Periodontal / Gingivitis" },
  { key: "beruntunGusiBerdarahGigiGoyang", label: "[Beruntun Periodontal=Ya] Gusi Berdarah / Bengkak / Gigi Goyang" },

  // IX. Pemeriksaan Nakes: Telinga & Mata + Pertanyaan Beruntun
  { key: "telingaSerumenImpaksi", label: "[Nakes Telinga] Pemeriksaan Telinga Luar (Serumen Impaksi)" },
  { key: "telingaInfeksi", label: "[Nakes Telinga] Pemeriksaan Telinga Luar (Infeksi Telinga)" },
  { key: "telingaTajamPendengaran", label: "[Nakes Telinga] Hasil Tajam Pendengaran / Tes Bisik" },
  { key: "mataTajamPenglihatanVisus", label: "[Nakes Mata] Hasil Skrining Tajam Penglihatan (Visus)" },
  { key: "mataPakaiKacamata", label: "[Nakes Mata] Menggunakan Kacamata" },
  { key: "mataButaWarna", label: "[Nakes Mata Sekolah/Remaja] Pemeriksaan Buta Warna" },
  { key: "mataPemeriksaanPupilKatarak", label: "[Nakes Mata ≥40th] Hasil Pemeriksaan Pupil / Katarak" },
  { key: "beruntunKekeruhanLensaMata", label: "[Beruntun Katarak] Kekeruhan Lensa Mata" },
  { key: "mataGlaukoma", label: "[Nakes Mata ≥40th] Skrining Glaukoma" },

  // X. Skrining PPOK / PUMA (Usia ≥ 40 Tahun) + Pertanyaan Beruntun
  { key: "pumaSkorUsia", label: "[Mandiri/Nakes PUMA ≥40th] Kategori Usia Skor PUMA" },
  { key: "pumaRiwayatMerokok", label: "[Mandiri/Nakes PUMA ≥40th] Apakah Sedang / Mempunyai Riwayat Merokok" },
  { key: "beruntunPumaBungkusTahun", label: "[Beruntun PUMA Merokok=Iya] Berapa Bungkus Rokok per Tahun" },
  { key: "pumaNapasPendek", label: "[Mandiri/Nakes PUMA ≥40th] Pernah Merasa Napas Pendek Saat Berjalan Cepat" },
  { key: "pumaMempunyaiDahak", label: "[Mandiri/Nakes PUMA ≥40th] Biasanya Mempunyai Dahak dari Paru" },
  { key: "pumaBatukTanpaFlu", label: "[Mandiri/Nakes PUMA ≥40th] Biasanya Batuk Saat Tidak Sedang Flu" },
  { key: "pumaPemeriksaanSpirometri", label: "[Mandiri/Nakes PUMA ≥40th] Pernah Pemeriksaan Spirometri / Peak Flow" },
  { key: "pumaSkorKesimpulan", label: "[Nakes PUMA ≥40th] Skor & Kesimpulan Risiko PPOK (PUMA)" },

  // XI. Skrining Mandiri: Faktor Risiko Hepatitis / Hati (10 Pertanyaan)
  { key: "hatiPernahTesHepB", label: "[Mandiri Hati 1] Pernah Tes Hepatitis B" },
  { key: "hatiMenderitaHepB", label: "[Mandiri Hati 2] Pernah Dinyatakan Menderita Hepatitis B" },
  { key: "hatiKeluargaHepB", label: "[Mandiri Hati 3] Ibu Kandung / Saudara Sekandung Menderita Hepatitis B" },
  { key: "hatiHubunganSeksualBerisiko", label: "[Mandiri Hati 4] Pernah Hubungan Seksual Berisiko" },
  { key: "hatiPernahTransfusiDarah", label: "[Mandiri Hati 5] Pernah Menerima Transfusi Darah" },
  { key: "hatiPernahCuciDarah", label: "[Mandiri Hati 6] Pernah Menjalani Cuci Darah / Hemodialisis" },
  { key: "hatiPernahNarkobaSuntikTato", label: "[Mandiri Hati 7] Pernah Narkoba Suntik / Tato / Tindik Tidak Steril" },
  { key: "hatiApakahOdhiv", label: "[Mandiri Hati 8] Apakah Orang dengan HIV (ODHIV)" },
  { key: "hatiPernahPengobatanHepC", label: "[Mandiri Hati 9] Pernah Mendapatkan Pengobatan Hepatitis C" },
  { key: "hatiLemakDarahTinggi", label: "[Mandiri Hati 10] Pernah Dinyatakan Kolesterol / Lemak Darah Tinggi" },

  // XII. Skrining Mandiri & Nakes: Tuberkulosis (TBC) + Pertanyaan Beruntun
  { key: "tbBatukLebih2Minggu", label: "[Mandiri TB] Apakah Batuk Lebih dari 2 Minggu" },
  { key: "beruntunTbBatukBerdahak", label: "[Beruntun TB Batuk] Apakah Batuk Berdahak" },
  { key: "tbDemamLebih2Minggu", label: "[Mandiri TB] Demam / Meriang Lebih dari 2 Minggu" },
  { key: "tbBerkeringatMalamHari", label: "[Mandiri TB] Berkeringat di Malam Hari Tanpa Aktivitas" },
  { key: "tbBbTurunTanpaSebab", label: "[Mandiri TB] Berat Badan Turun Tanpa Sebab / Tidak Naik (Anak)" },
  { key: "tbKontakEratPasienTbc", label: "[Mandiri TB] Kontak Erat / Serumah dengan Pasien TBC" },
  { key: "beruntunTbStatusTerduga", label: "[Beruntun Skrining TB] Kesimpulan Status Terduga TBC" },
  { key: "beruntunTbMetodePemeriksaan", label: "[Beruntun Nakes TB] Metode Pemeriksaan TB / Uji Tuberkulin" },
  { key: "beruntunTbHasilFotoToraks", label: "[Beruntun Nakes TB] Hasil Foto Toraks (X-Ray)" },

  // XIII. Skrining Mandiri & Nakes: Malaria, Kusta, Skabies & Frambusia
  { key: "malariaPernahSakit", label: "[Mandiri Malaria] Pernah Sakit Malaria" },
  { key: "malariaBepergianEndemis", label: "[Mandiri Malaria] Bepergian / Tinggal di Daerah Endemis Malaria" },
  { key: "malariaGejalaDemamMenggigil", label: "[Mandiri Malaria] Gejala Demam Menggigil" },
  { key: "malariaHasilRdt", label: "[Nakes Malaria] Hasil Pemeriksaan RDT Malaria" },
  { key: "kulitBercakKusta", label: "[Mandiri/Nakes Kulit] Bercak Kulit Putih/Merah Mati Rasa (Tanda Kusta)" },
  { key: "kulitKorengSkabies", label: "[Mandiri/Nakes Kulit] Koreng / Ruam / Bentol Gatal Malam Hari (Skabies)" },
  { key: "kulitPapulFrambusia", label: "[Mandiri/Nakes Kulit] Papul / Nodul / Ulkus (Tanda Frambusia)" },

  // XIV. Skrining Mandiri & Nakes: Jantung, Kanker Paru (≥45th), Kanker Usus (≥45th), Kanker Payudara & Leher Rahim (Perempuan) + Pertanyaan Beruntun
  { key: "jantungKeluhanNyeriDadaSesak", label: "[Mandiri Jantung] Keluhan Nyeri Dada / Sesak / Berdebar / Bengkak Tungkai" },
  { key: "jantungRiwayatKeluarga", label: "[Mandiri Jantung] Riwayat Penyakit Jantung pada Keluarga" },
  { key: "jantungRisikoKardiovaskular", label: "[Nakes Jantung] Risiko Kardiovaskular" },
  { key: "jantungHasilEkg", label: "[Nakes Jantung] Hasil Pemeriksaan EKG" },
  { key: "kankerParuPaparanAsbesDebu", label: "[Mandiri Kanker Paru ≥45th] Paparan Debu Industri / Asbes / Gas Buang / Radon" },
  { key: "kankerParuRiwayatKeluarga", label: "[Mandiri Kanker Paru ≥45th] Riwayat Kanker Paru pada Keluarga" },
  { key: "kankerParuGejalaBatukDarah", label: "[Mandiri Kanker Paru ≥45th] Gejala Batuk Darah / Suara Serak / Penyakit Paru Kronis" },
  { key: "kankerParuHasilRisiko", label: "[Nakes Kanker Paru ≥45th] Kesimpulan Risiko Kanker Paru" },
  { key: "kankerUsusRiwayatPolipKeluarga", label: "[Mandiri Kanker Usus ≥45th] Riwayat Polip Usus / Kanker Kolorektal Keluarga" },
  { key: "kankerUsusGejalaBabBerdarah", label: "[Mandiri Kanker Usus ≥45th] Gejala BAB Berdarah / Perubahan Pola BAB" },
  { key: "kankerUsusDarahSamarFeses", label: "[Nakes Kanker Usus ≥45th] Pemeriksaan Darah Samar Feses (FOBT/FIT)" },
  { key: "kankerUsusHasilApcs", label: "[Nakes Kanker Usus ≥45th] Hasil Skrining APCS / Risiko Kanker Usus" },
  { key: "payudaraJenisPemeriksaan", label: "[Nakes Kanker Payudara Perempuan] Jenis Pemeriksaan Payudara" },
  { key: "beruntunHasilSadanis", label: "[Beruntun SADANIS] Hasil Pemeriksaan Payudara Klinis (SADANIS)" },
  { key: "beruntunSadanisBenjolanPutingKulit", label: "[Beruntun SADANIS] Benjolan / Kelainan Puting / Kulit Payudara" },
  { key: "serviksKeluhanPendarahanKeputihan", label: "[Mandiri Leher Rahim Perempuan] Keluhan Pendarahan di Luar Siklus / Keputihan Berbau / Nyeri Hubungan" },
  { key: "serviksPemeriksaanIvaInspekulo", label: "[Nakes Leher Rahim Perempuan] Hasil Pemeriksaan Inspekulo & IVA" },
  { key: "serviksPemeriksaanHpvDna", label: "[Nakes Leher Rahim Perempuan] Hasil Pemeriksaan HPV-DNA" },

  // XV. Pemeriksaan Nakes: Laboratorium Lengkap (Hb, Profil Lipid, Fungsi Ginjal, Fungsi Hati, Rapid Test) + Pertanyaan Beruntun
  { key: "labKadarHemoglobinHb", label: "[Nakes Lab Hb] Kadar Hemoglobin / Hb (g/dL)" },
  { key: "labStatusAnemia", label: "[Nakes Lab Hb] Kategori / Status Anemia" },
  { key: "beruntunTatalaksanaAnemia", label: "[Beruntun Hb] Tindak Lanjut / Tatalaksana Anemia" },
  { key: "labDilakukanProfilLipid", label: "[Nakes Lab Lipid] Dilakukan Pemeriksaan Profil Lipid" },
  { key: "beruntunLipidKolesterolTotal", label: "[Beruntun Lipid=Ya] Kolesterol Total (mg/dL)" },
  { key: "beruntunLipidTrigliserida", label: "[Beruntun Lipid=Ya] Trigliserida (mg/dL)" },
  { key: "beruntunLipidHdl", label: "[Beruntun Lipid=Ya] Kolesterol HDL (mg/dL)" },
  { key: "beruntunLipidLdl", label: "[Beruntun Lipid=Ya] Kolesterol LDL (mg/dL)" },
  { key: "beruntunLipidKesimpulan", label: "[Beruntun Lipid=Ya] Kesimpulan Profil Lipid" },
  { key: "labDilakukanFungsiGinjal", label: "[Nakes Lab Ginjal] Dilakukan Pemeriksaan Fungsi Ginjal" },
  { key: "beruntunGinjalUreum", label: "[Beruntun Ginjal=Ya] Ureum Darah (mg/dL)" },
  { key: "beruntunGinjalKreatinin", label: "[Beruntun Ginjal=Ya] Kreatinin Darah (mg/dL)" },
  { key: "beruntunGinjalEgfr", label: "[Beruntun Ginjal=Ya] Laju Filtrasi Glomerulus / e-LFG (mL/mnt/1.73m²)" },
  { key: "beruntunGinjalProteinAlbuminUrin", label: "[Beruntun Ginjal=Ya] Protein Urin / Albuminuria" },
  { key: "beruntunGinjalUacr", label: "[Beruntun Ginjal=Ya] Albumin-Kreatinin Urin & Kategori uACR" },
  { key: "beruntunGinjalKesimpulan", label: "[Beruntun Ginjal=Ya] Kesimpulan Fungsi Ginjal" },
  { key: "labDilakukanFungsiHati", label: "[Nakes Lab Hati] Dilakukan Pemeriksaan Fungsi Hati" },
  { key: "beruntunHatiSgotSgpt", label: "[Beruntun Hati=Ya] SGOT & SGPT (U/L)" },
  { key: "beruntunHatiTrombositApri", label: "[Beruntun Hati=Ya] Trombosit & Skor APRI" },
  { key: "beruntunHatiDerajatFibrosis", label: "[Beruntun Hati=Ya] Derajat Fibrosis / Sirosis Hati" },
  { key: "rapidTestHbsag", label: "[Nakes Rapid Test] Hasil Rapid Test Hepatitis B (HBsAg)" },
  { key: "rapidTestAntiHcv", label: "[Nakes Rapid Test] Hasil Rapid Test Hepatitis C (Anti-HCV)" },
  { key: "rapidTestHiv", label: "[Nakes Rapid Test] Hasil Rapid Test HIV" },
  { key: "rapidTestSifilis", label: "[Nakes Rapid Test] Hasil Rapid Test Sifilis (TP Rapid)" },

  // XVI. Skrining Kesehatan Jiwa, Khusus Bayi/Balita (0-6 Thn) & Khusus Anak Sekolah/Remaja (7-17 Thn)
  { key: "jiwaGejalaDepresiSedihCemas", label: "[Mandiri Jiwa] Merasa Sedih / Tertekan / Cemas / Sulit Tidur" },
  { key: "jiwaHilangMinatFokus", label: "[Mandiri Jiwa] Hilang Minat Kegiatan / Sulit Fokus / Mudah Lelah" },
  { key: "jiwaKesimpulanSrqPhq", label: "[Mandiri/Nakes Jiwa] Kesimpulan Skrining Kesehatan Jiwa (SRQ-20 / PHQ / SDQ)" },
  { key: "bayiShkHipotiroid", label: "[Nakes Bayi <1th] Skrining Hipotiroid Kongenital (SHK)" },
  { key: "bayiShakAdrenalG6pd", label: "[Nakes Bayi <1th] Skrining S-HAK & Defisiensi Enzim G6PD" },
  { key: "bayiPjbKritisIkterus", label: "[Nakes Bayi <1th] Skrining PJB Kritis & Saluran Empedu / Ikterus" },
  { key: "balitaBukuKiaKms", label: "[Mandiri/Nakes Bayi/Balita] Kepemilikan Buku KIA / KMS" },
  { key: "balitaAsiEksklusif", label: "[Mandiri/Nakes Bayi/Balita] Riwayat ASI Eksklusif" },
  { key: "balitaStatusImunisasiDasar", label: "[Mandiri/Nakes Bayi/Balita] Status Imunisasi Dasar / Polio / Lanjutan" },
  { key: "balitaPerkembanganKpspSdidtk", label: "[Nakes Balita] Hasil Pemeriksaan Perkembangan (SDIDTK / KPSP)" },
  { key: "balitaAutismeMchat", label: "[Mandiri/Nakes Balita] Hasil Skrining Autisme (M-CHAT-R) & Keterlambatan Bicara" },
  { key: "balitaTandaBahayaUmum", label: "[Nakes Bayi/Balita] Tanda Bahaya Umum" },
  { key: "sekolahKeluhanReproduksi", label: "[Mandiri Sekolah/Remaja 7-17th] Keluhan Organ Reproduksi (Gatal/Nyeri BAK/Kelainan)" },
  { key: "sekolahImunisasiRutinHpv", label: "[Mandiri/Nakes Sekolah/Remaja 7-17th] Status Imunisasi Rutin Anak Sekolah & HPV" },
  { key: "sekolahKebugaranJasmani", label: "[Nakes Sekolah/Remaja 7-17th] Hasil Tes Kebugaran Jasmani" },

  // XVII. Khusus Lansia (Usia ≥ 60 Tahun): SKILAS Lengkap & Indeks Kemandirian ADL Barthel 10 Butir + Pertanyaan Beruntun
  { key: "skilasKognitifMengingat3Kata", label: "[Mandiri/Nakes SKILAS ≥60th] Kognitif: Mengingat 3 Kata" },
  { key: "skilasKognitifOrientasiWaktuJam", label: "[Mandiri/Nakes SKILAS ≥60th] Kognitif: Orientasi Waktu (Tanggal) & Menggambar Jam" },
  { key: "skilasKognitifKesimpulan", label: "[Nakes SKILAS ≥60th] Kesimpulan Skrining Penurunan Kognitif" },
  { key: "skilasMobilisasiTesBerdiriKursi5x", label: "[Nakes SKILAS ≥60th] Mobilisasi: Mampu Berdiri dari Kursi 5 Kali Tanpa Tangan" },
  { key: "beruntunSkilasWaktuChairStandDetik", label: "[Beruntun Chair Stand=Ya] Waktu Bangkit dari Kursi 5 Kali (Detik)" },
  { key: "beruntunSkilasKecepatanJalan4m", label: "[Beruntun SPPB Lansia] Waktu Berjalan Sejauh 4 Meter" },
  { key: "beruntunSkilasTesKeseimbangan", label: "[Beruntun SPPB Lansia] Tes Keseimbangan (Berdampingan/Semi-Tandem/Tandem) & Risiko Jatuh" },
  { key: "skilasMobilisasiKesimpulan", label: "[Nakes SKILAS ≥60th] Kesimpulan Skrining Mobilisasi Lansia" },
  { key: "skilasMalnutrisiPenurunanBb", label: "[Mandiri/Nakes SKILAS ≥60th] Malnutrisi: Penurunan Berat Badan > 3 kg dalam 3 Bulan" },
  { key: "skilasMalnutrisiNafsuMakanPakaianLonggar", label: "[Mandiri/Nakes SKILAS ≥60th] Malnutrisi: Penurunan Asupan/Nafsu Makan & Pakaian Terasa Longgar" },
  { key: "beruntunSkilasMnaImtMobilitasStress", label: "[Beruntun MNA-SF Lansia] Nilai IMT (≥23), Mobilitas Keluar Rumah & Stress Psikologis" },
  { key: "skilasMalnutrisiKesimpulan", label: "[Nakes SKILAS ≥60th] Kesimpulan Skrining Malnutrisi Lansia" },
  { key: "skilasDepresiPuasKehidupan", label: "[Mandiri/Nakes SKILAS ≥60th] Depresi (GDS): Apakah Puas dengan Kehidupan" },
  { key: "skilasDepresiSedihBosanTidakBerdaya", label: "[Mandiri/Nakes SKILAS ≥60th] Depresi (GDS): Merasa Sedih/Tertekan, Bosan, Hidup Kosong, Tidak Berdaya" },
  { key: "skilasDepresiHilangMinat", label: "[Mandiri/Nakes SKILAS ≥60th] Depresi (GDS): Sedikit Minat atau Kesenangan Melakukan Sesuatu" },
  { key: "skilasDepresiKesimpulan", label: "[Nakes SKILAS ≥60th] Kesimpulan Skrining Gejala Depresi Lansia" },
  { key: "barthel1Bab", label: "[Mandiri/Nakes Barthel ADL ≥60th] 1. Mengendalikan Rangsang Buang Air Besar (BAB)" },
  { key: "barthel2Bak", label: "[Mandiri/Nakes Barthel ADL ≥60th] 2. Mengendalikan Rangsang Buang Air Kecil (BAK)" },
  { key: "barthel3MembersihkanDiri", label: "[Mandiri/Nakes Barthel ADL ≥60th] 3. Membersihkan Diri (Cuci Muka, Sisir, Sikat Gigi)" },
  { key: "barthel4PenggunaanJamban", label: "[Mandiri/Nakes Barthel ADL ≥60th] 4. Penggunaan Jamban (Keluar Masuk WC)" },
  { key: "barthel5MakanMinum", label: "[Mandiri/Nakes Barthel ADL ≥60th] 5. Makan dan Minum" },
  { key: "barthel6BerbaringKeDuduk", label: "[Mandiri/Nakes Barthel ADL ≥60th] 6. Berubah Sikap dari Berbaring ke Duduk" },
  { key: "barthel7BerpindahBerjalan", label: "[Mandiri/Nakes Barthel ADL ≥60th] 7. Berpindah / Berjalan" },
  { key: "barthel8MemakaiBaju", label: "[Mandiri/Nakes Barthel ADL ≥60th] 8. Memakai Baju" },
  { key: "barthel9NaikTurunTangga", label: "[Mandiri/Nakes Barthel ADL ≥60th] 9. Naik Turun Tangga" },
  { key: "barthel10Mandi", label: "[Mandiri/Nakes Barthel ADL ≥60th] 10. Mandi" },
  { key: "barthelKesimpulanSkor", label: "[Nakes Barthel ADL ≥60th] Skor Total & Kesimpulan Kemandirian ADL Barthel" },

  // XVIII. Rekapitulasi Formulir Portal & Jawaban Aktual DOM
  { key: "daftarFormulirSelesai", label: "Daftar Formulir yang Diisi di Portal" },
  { key: "detailJawabanDomLengkap", label: "Rekap Detail Pertanyaan & Jawaban Aktual Portal" }
];

/**
 * Membangun objek reportData super lengkap berdasarkan usia, siklus hidup, gender,
 * pengaturan ON/OFF pemeriksaan, dan jawaban aktual dari DOM SurveyJS (termasuk pertanyaan beruntun).
 * Field yang tidak termasuk dalam usia/gender atau tidak terpicu pada pertanyaan beruntun dibiarkan kosong ("").
 */
export function buildCompleteReportData(
  participant = {},
  patientProfile = null,
  examToggles = null,
  scrapedFormAnswers = null,
  completedForms = []
) {
  const rawP = participant || {};
  const rawBirth = rawP.tanggalLahir || rawP.tanggal_lahir || rawP.tgllahir || rawP.tgl_lahir || rawP.birthDate || "";
  const ageObj = (rawBirth && rawBirth !== "—")
    ? calculateAge(rawBirth)
    : (patientProfile?.ageYears !== undefined
        ? { years: patientProfile.ageYears, months: patientProfile.ageMonths || 0, text: `${patientProfile.ageYears} thn` }
        : calculateAge(rawP.usia || rawP.umur || 30));

  const ageYears = ageObj.years ?? 30;
  const ageMonths = ageObj.months ?? 0;

  const rawGender = rawP.jenisKelamin || rawP.jenis_kelamin || rawP.gender || rawP.jk || patientProfile?.normGender || "";
  const normGender = normalizeGender(rawGender);
  const isMale = normGender === "laki-laki";
  const isFemale = !isMale;

  let category = (rawP.category || rawP.kategori || patientProfile?.category || "").toLowerCase();
  if (!category || category === "umum") {
    if (ageYears < 1) category = "bayi";
    else if (ageYears < 5) category = "balita";
    else if (ageYears <= 6) category = "prasekolah";
    else if (ageYears <= 12) category = "sekolah";
    else if (ageYears <= 17) category = "remaja";
    else if (ageYears >= 60) category = "lansia";
    else category = "dewasa";
  }

  const prof = patientProfile || generatePatientMedicalProfile(normGender, ageYears, ageMonths, category);
  const siklusHidup = rawP.siklusHidup || getLifeCycleCategory(ageYears);

  // Flag kelompok usia klinis
  const isBayi = ageYears < 1;
  const isBalita = ageYears >= 1 && ageYears < 5;
  const isPraSekolah = ageYears >= 5 && ageYears <= 6;
  const isUnder6 = ageYears <= 6;
  const isSekolah = ageYears >= 7 && ageYears <= 12;
  const isRemaja = ageYears >= 13 && ageYears <= 17;
  const isSchoolOrTeen = ageYears >= 7 && ageYears <= 17;
  const isDewasa = ageYears >= 18 && ageYears < 60;
  const isLansia = ageYears >= 60;
  const isAdultOrLansia = ageYears >= 18;
  const isAge10Plus = ageYears >= 10;
  const isAge15Plus = ageYears >= 15;
  const isAge30Plus = ageYears >= 30;
  const isAge40Plus = ageYears >= 40;
  const isAge45Plus = ageYears >= 45;

  const patientCtx = {
    ageYears,
    ageMonths,
    normGender,
    gender: normGender,
    category,
    tanggalLahir: rawBirth,
    siklusHidup
  };

  const isNakesOn = (kw) => isExamEnabled(kw, "nakes", patientCtx, examToggles);

  // Inisialisasi semua kolom dengan string kosong ("") sesuai instruksi:
  // "jika tidak ada di isi atau pilihannya di usia yang berbeda yaudah biarin kosong"
  const data = {};
  for (const col of REPORT_EXPORT_COLUMNS) {
    data[col.key] = "";
  }

  // I. Identitas
  data.tanggalLahir = rawBirth && rawBirth !== "—" ? String(rawBirth) : "";
  data.usia = rawP.usia || ageObj.text || `${ageYears} thn`;
  data.gender = isMale ? "Laki-laki" : "Perempuan";
  data.siklusHidup = siklusHidup;
  data.pekerjaan = isUnder6
    ? "Belum Bekerja"
    : (isSchoolOrTeen ? "Pelajar / Mahasiswa" : (prof.pekerjaan || rawP.pekerjaan || "Tidak Bekerja"));

  // II. Demografi, Status Perkawinan & Reproduksi + Pertanyaan Beruntun
  data.disabilitas = rawP.disabilitas || "Non disabilitas";

  if (isAge15Plus) {
    const stNikahCode = prof.statusNikah || (ageYears < 18 ? "belum-menikah" : "menikah");
    const stNikahLabel = stNikahCode === "belum-menikah"
      ? "Belum Menikah"
      : (stNikahCode === "cerai-hidup" ? "Cerai Hidup" : (stNikahCode === "cerai-mati" ? "Cerai Mati" : "Menikah"));
    data.statusPerkawinan = stNikahLabel;

    // Pertanyaan beruntun: Rencana menikah dalam < 1 tahun hanya muncul jika belum menikah / cerai
    if (stNikahLabel !== "Menikah") {
      data.beruntunRencanaMenikah = prof.isRencanaNikah ? "Ya" : "Tidak";
    }
    // Pertanyaan beruntun: Pernah melakukan hubungan intim
    if (isAdultOrLansia || data.beruntunRencanaMenikah === "Ya") {
      data.beruntunPernahHubunganIntim = (stNikahLabel !== "Belum Menikah" || prof.isHubIntim) ? "Ya" : "Tidak";
    }
    // Pertanyaan beruntun: Apakah sedang hamil (Perempuan usia subur yang menikah / pernah hubungan intim)
    if (isFemale && ageYears >= 15 && ageYears <= 54 && (stNikahLabel === "Menikah" || data.beruntunPernahHubunganIntim === "Ya")) {
      data.beruntunSedangHamil = prof.isHamil ? "Ya" : "Tidak";
      if (data.beruntunSedangHamil === "Ya") {
        data.beruntunUsiaKehamilanMinggu = String(rawP.usiaKehamilan || "12");
      }
    }
    // Status imunisasi tetanus (Perempuan WUS 15-49 thn)
    if (isFemale && ageYears >= 15 && ageYears <= 49) {
      data.statusImunisasiTetanusWus = "Pernah imunisasi tetanus minimal dua kali";
    }
  }

  // Menstruasi Remaja Putri (Perempuan 10-17 thn)
  if (isFemale && isSchoolOrTeen && ageYears >= 10) {
    const rawMens = String(rawP.menstruasi || "").toLowerCase();
    const sudahMens = rawMens ? (rawMens.includes("ya") || rawMens.includes("sudah")) : (ageYears >= 12);
    data.remajaSudahMenstruasi = sudahMens ? "Ya" : "Tidak";
    // Pertanyaan beruntun: jika sudah menstruasi = Ya -> Usia pertama menstruasi
    if (data.remajaSudahMenstruasi === "Ya") {
      data.beruntunUsiaPertamaMenstruasi = "8 tahun - 16 tahun";
    }
  }

  // III. Perilaku Merokok, Paparan Asap & Kadar CO + Pertanyaan Beruntun
  data.terpaparAsapRokokSebulan = prof.terpaparAsapRokok ? "Ya" : "Tidak";
  if (isAge10Plus) {
    const merokokAktif = !!prof.isSmoker;
    data.merokokSetahunTerakhir = merokokAktif ? "Ya" : "Tidak";

    if (merokokAktif) {
      // Pertanyaan beruntun jika Merokok = Ya
      data.beruntunJenisRokok = prof.jenisRokok || "Rokok konvensional (rokok putih, filter, kretek, tingwe, dll)";
      data.beruntunLamaMerokokBungkusTahun = prof.bungkusTahunOption || "5 bungkus tahun";
      data.beruntunBatangRokokPerHari = String(prof.batangRokokPerHari || 10);
      data.beruntunBersediaBerhentiMerokok = "Ya";
    } else {
      // Pertanyaan beruntun jika Merokok = Tidak -> Apakah pernah merokok sebelumnya
      const pernah = !!prof.pernahMerokok;
      data.beruntunPernahMerokokSebelumnya = pernah ? "Ya" : "Tidak";
      if (pernah) {
        data.beruntunKapanBerhentiMerokok = "1 s.d <10 tahun lalu";
      }
    }

    if (isNakesOn("kadar co") || isNakesOn("merokok")) {
      data.kadarCoPernapasanPpm = String(prof.kadarCO ?? (merokokAktif ? 15 : 3));
      data.kategoriKadarCo = merokokAktif ? "Tinggi / Waspada (Merah/Kuning)" : "Normal / Rendah (Hijau)";
      data.interpretasiKadarCo = merokokAktif ? "Perokok aktif" : "Bukan perokok";
      data.tatalaksanaMerokok = merokokAktif ? "Konseling Upaya Berhenti Merokok (UBM)" : "KIE Pola Hidup Sehat";
    }
  }

  // IV. Tingkat Aktivitas Fisik & Kelayakan Kebugaran (PAR-Q) + Pertanyaan Beruntun
  if (isAge10Plus) {
    data.aktivitasFisikRutin = "Tidak";
    data.beruntunHariAktifPerMinggu = String(prof.hariAktif || 3);
    data.beruntunMenitAktifPerHari = String(prof.menitAktif || 30);
    data.parqNyeriDadaAktivitas = "Tidak";
    data.parqMasalahTulangSendiPingsan = "Tidak";
    data.parqKelayakanTesKebugaran = "Layak Tes Kebugaran (Normal)";
  }

  // V. Tekanan Darah & Hipertensi + Pertanyaan Beruntun
  if (isAdultOrLansia) {
    const hasHT = !!prof.hasHipertensi || (Number(prof.sistol) >= 140 || Number(prof.diastol) >= 90);
    data.riwayatHipertensiDokter = hasHT ? "Ya" : "Tidak";
    if (hasHT) {
      data.beruntunLamaHipertensiBulan = String(rawP.lamaHipertensiBulan || 12);
      data.beruntunMinumObatHipertensi = "Tidak";
    }
  }
  if (ageYears >= 6 && (isNakesOn("tekanan darah") || isNakesOn("hipertensi"))) {
    data.dilakukanPengukuranTd = "Ya";
    data.beruntunPosisiPengukuranTd = "Duduk / Berdiri";
    const sis = Number(prof.sistol || 118);
    const dia = Number(prof.diastol || 78);
    data.beruntunTdSistolik = String(sis);
    data.beruntunTdDiastolik = String(dia);
    data.beruntunKlasifikasiTd = (sis >= 140 || dia >= 90)
      ? "Hipertensi"
      : ((sis >= 120 || dia >= 80) ? "Pre-Hipertensi / Normal Tinggi" : "Normal");
  }

  // VI. Riwayat Diabetes & Gula Darah + Pertanyaan Beruntun
  const hasDM = !!prof.hasDiabetes;
  if (isSchoolOrTeen) {
    data.faktorRisikoGulaDarahAnak = hasDM ? "Ya" : "Tidak";
  }
  if (isAdultOrLansia || (isSchoolOrTeen && hasDM)) {
    data.pernahDinyatakanDiabetes = hasDM ? "Ya" : "Tidak";
    if (hasDM) {
      data.beruntunLamaDiabetesBulan = String(prof.diabetesDurationMonths || 12);
      data.beruntunMinumObatDiabetes = "Ya";
    }
  }
  if ((isAdultOrLansia || (isSchoolOrTeen && hasDM)) && isNakesOn("gula darah")) {
    data.dilakukanPemeriksaanGds = "Ya";
    data.beruntunJenisPemeriksaanGula = "Gula Darah Sewaktu (GDS) - POCT";
    const gdsVal = Number(prof.gds || 102);
    data.beruntunGulaDarahSewaktuGds1 = String(gdsVal);
    if (!hasDM && gdsVal >= 140) {
      const gds2Val = prof.gds2 || Math.round(gdsVal * 0.95);
      data.beruntunGulaDarahSewaktuKeduaGds2 = String(gds2Val);
    }
    if (hasDM || gdsVal >= 140 || rawP.gdp || rawP.gulaDarahPuasa) {
      data.beruntunGulaDarahPuasaGdp = String(prof.gdp || 92);
      data.beruntunHba1cPersen = String(prof.hba1c || 5.4);
    }
  }

  // VII. Antropometri, Status Gizi & Tanda Vital
  if (isNakesOn("berat badan") || isNakesOn("antropometri") || isNakesOn("gizi")) {
    const bbVal = Number(prof.bb || 58);
    const tbVal = Number(prof.tb || 160);
    const imtVal = tbVal > 0 ? Number((bbVal / Math.pow(tbVal / 100, 2)).toFixed(1)) : 21.5;
    data.beratBadanKg = String(bbVal);
    data.tinggiPanjangBadanCm = String(tbVal);
    data.caraPengukuranTb = prof.caraUkur || (ageYears < 2 ? "Terlentang" : "Berdiri");
    data.indeksMassaTubuhImt = String(imtVal);
    data.statusGiziImt = (imtVal >= 25 && isAdultOrLansia)
      ? "Gemuk / Lebih"
      : ((imtVal < 18.5 && isAdultOrLansia) ? "Kurus / Kurang" : "Gizi Baik (Normal)");

    if (isUnder6) {
      data.bbMenurutUmurBbu = "Berat badan normal (Gizi Baik)";
      data.lingkarKepalaCm = String(prof.lk || 47);
    }
    if (ageYears <= 17) {
      data.tbMenurutUmurTbu = "Normal";
    }
    if (isUnder6 || (isFemale && ageYears >= 15 && ageYears <= 49)) {
      data.lilaCm = String(prof.lila || (isUnder6 ? 15.2 : 25.5));
    }
    if (isAge15Plus && (isNakesOn("lingkar perut") || isNakesOn("gizi") || isNakesOn("berat badan"))) {
      const lpVal = Number(prof.lp || (isMale ? 80 : 74));
      data.lingkarPerutCm = String(lpVal);
      const isObesSentral = (isMale && lpVal > 90) || (isFemale && lpVal > 80);
      data.statusObesitasSentral = isObesSentral ? "Obesitas Sentral" : "Normal (Tidak Obesitas Sentral)";
    }
    data.tandaVitalNadi = String(prof.nadi || 78);
    data.tandaVitalRespirasiSuhu = `${prof.respirasi || 18} x/mnt | ${prof.suhu || 36.6} °C`;
  }

  // VIII. Gigi & Mulut + Pertanyaan Beruntun
  if (!isBayi && isNakesOn("gigi")) {
    data.gigiKebersihanMulut = "Baik";
    data.gigiMukosaMulut = "Normal";
    const adaKaries = !!prof.hasKaries;
    data.gigiAdaKaries = adaKaries ? "Ya" : "Tidak";
    if (adaKaries) {
      data.beruntunJumlahGigiKaries = String(prof.kariesCount || "1");
    }
    data.gigiHilangDicabut = "Tidak";
    const adaPerio = !!prof.hasPeriodontal;
    data.gigiKarangKalkulus = adaPerio ? "Ya" : "Tidak";
    data.gigiKelainanPeriodontal = adaPerio ? "Ya" : "Tidak";
    if (adaPerio) {
      data.beruntunGusiBerdarahGigiGoyang = "Gusi berdarah / gingivitis ringan (Gigi goyang: Tidak)";
    }
  }

  // IX. Telinga & Mata + Pertanyaan Beruntun
  if (!isBayi && (isNakesOn("telinga") || isNakesOn("pendengaran"))) {
    data.telingaSerumenImpaksi = prof.telingaSerumen || "Tidak ada serumen impaksi";
    data.telingaInfeksi = prof.telingaInfeksi || "Tidak ada infeksi telinga";
    data.telingaTajamPendengaran = prof.tajamPendengaran || "Normal";
  }
  if (!isBayi && (isNakesOn("mata") || isNakesOn("penglihatan"))) {
    data.mataTajamPenglihatanVisus = prof.tajamPenglihatan || "Normal (visus 6/6 - 6/12)";
    data.mataPakaiKacamata = String(rawP.kacamata || "").toLowerCase().includes("ya") ? "Ya" : "Tidak";
    if (isSchoolOrTeen && isNakesOn("buta warna")) {
      data.mataButaWarna = rawP.butaWarna || "Normal (Tidak Buta Warna)";
    }
    if (isAge40Plus) {
      const kat = prof.pupilKatarak || "Normal";
      data.mataPemeriksaanPupilKatarak = kat;
      data.beruntunKekeruhanLensaMata = kat === "Curiga Katarak" ? "Ada kekeruhan lensa" : "Tidak ada kekeruhan lensa";
      data.mataGlaukoma = "Normal";
    }
  }

  // X. Skrining PPOK / PUMA (Usia ≥ 40 Tahun) + Pertanyaan Beruntun
  if (isAge40Plus && (isNakesOn("ppok") || isNakesOn("puma"))) {
    data.pumaSkorUsia = prof.pumaUsiaLabel || (ageYears >= 60 ? "= > 60" : (ageYears >= 50 ? "50-59" : "40-49"));
    const pumaRokok = prof.pumaRiwayatMerokok || ((prof.isSmoker || prof.pernahMerokok) ? "Iya" : "Tidak");
    data.pumaRiwayatMerokok = pumaRokok;
    if (pumaRokok === "Iya") {
      data.beruntunPumaBungkusTahun = prof.pumaBungkusTahun || "< 20 bungkus per tahun";
    }
    data.pumaNapasPendek = prof.pumaNapasPendek || "Tidak";
    data.pumaMempunyaiDahak = prof.pumaDahak || "Tidak";
    data.pumaBatukTanpaFlu = "Tidak";
    data.pumaPemeriksaanSpirometri = "Tidak";
    data.pumaSkorKesimpulan = "< 6 (Risiko Rendah PPOK)";
  }

  // XI. Skrining Mandiri Faktor Risiko Hepatitis / Hati (10 Pertanyaan)
  if (isAge15Plus) {
    data.hatiPernahTesHepB = "Tidak";
    data.hatiMenderitaHepB = "Tidak";
    data.hatiKeluargaHepB = "Tidak";
    data.hatiHubunganSeksualBerisiko = "Tidak";
    data.hatiPernahTransfusiDarah = "Tidak";
    data.hatiPernahCuciDarah = "Tidak";
    data.hatiPernahNarkobaSuntikTato = "Tidak";
    data.hatiApakahOdhiv = "Tidak";
    data.hatiPernahPengobatanHepC = "Tidak";
    data.hatiLemakDarahTinggi = "Tidak";
  }

  // XII. Skrining Mandiri & Nakes: Tuberkulosis (TBC) + Pertanyaan Beruntun
  if (!isBayi) {
    data.tbBatukLebih2Minggu = "Tidak";
    data.beruntunTbBatukBerdahak = "Tidak";
    data.tbDemamLebih2Minggu = "Tidak";
    data.tbBerkeringatMalamHari = "Tidak";
    data.tbBbTurunTanpaSebab = "Tidak";
    data.tbKontakEratPasienTbc = "Tidak";
    data.beruntunTbStatusTerduga = "Bukan Terduga TBC";
    if (isNakesOn("tuberkulosis") || isNakesOn("tbc")) {
      data.beruntunTbMetodePemeriksaan = ageYears < 10 ? "Uji Tuberkulin: Negatif" : "Tidak dilakukan (Bukan Terduga TB)";
      if (isAdultOrLansia && isNakesOn("foto toraks")) {
        data.beruntunTbHasilFotoToraks = "Normal / Tidak tampak kelainan";
      }
    }
  }

  // XIII. Malaria, Kusta, Skabies & Frambusia
  if (!isBayi) {
    data.malariaPernahSakit = "Tidak";
    data.malariaBepergianEndemis = "Tidak";
    data.malariaGejalaDemamMenggigil = "Tidak";
    if (isNakesOn("malaria")) {
      data.malariaHasilRdt = "Non-Reaktif / Negatif";
    }
    data.kulitBercakKusta = prof.labelKusta || "Tidak ada";
    data.kulitKorengSkabies = prof.labelSkabies || "Tidak ada";
    data.kulitPapulFrambusia = prof.labelFrambusia || "Tidak ada";
  }

  // XIV. Jantung, Kanker Paru (≥45th), Kanker Usus (≥45th), Payudara & Leher Rahim (Perempuan)
  if (isAdultOrLansia) {
    data.jantungKeluhanNyeriDadaSesak = "Tidak";
    data.jantungRiwayatKeluarga = "Tidak";
    if ((isAge40Plus || prof.hasDiabetes || prof.hasHipertensi) && (isNakesOn("jantung") || isNakesOn("ekg") || isNakesOn("kardiovaskular"))) {
      data.jantungRisikoKardiovaskular = "Risiko Rendah (<10%)";
      if (isNakesOn("ekg") || isNakesOn("jantung")) {
        data.jantungHasilEkg = "Normal";
      }
    }
  }

  if (isAge45Plus) {
    data.kankerParuPaparanAsbesDebu = "Tidak";
    data.kankerParuRiwayatKeluarga = "Tidak";
    data.kankerParuGejalaBatukDarah = "Tidak";
    if (isNakesOn("kanker paru")) {
      data.kankerParuHasilRisiko = prof.isSmoker ? "Risiko Sedang" : "Risiko Rendah";
    }

    data.kankerUsusRiwayatPolipKeluarga = "Tidak";
    data.kankerUsusGejalaBabBerdarah = "Tidak";
    if (isNakesOn("kanker usus") || isNakesOn("kolorektal")) {
      data.kankerUsusDarahSamarFeses = isNakesOn("darah samar") ? "Negatif / Tidak dilakukan" : "Tidak dilakukan";
      data.kankerUsusHasilApcs = "Risiko Rata-rata (Rendah)";
    }
  }

  if (isFemale && isAge30Plus) {
    if (isNakesOn("payudara") || isNakesOn("sadanis")) {
      data.payudaraJenisPemeriksaan = "Pemeriksaan Payudara Klinis (SADANIS)";
      const rawSad = String(rawP.sadanis || "Tidak ada kelainan");
      data.beruntunHasilSadanis = rawSad;
      data.beruntunSadanisBenjolanPutingKulit = "Benjolan: Tidak | Kelainan Puting/Kulit: Tidak";
    }
    if (data.statusPerkawinan !== "Belum Menikah") {
      data.serviksKeluhanPendarahanKeputihan = "Tidak";
      if (isNakesOn("leher rahim") || isNakesOn("iva")) {
        data.serviksPemeriksaanIvaInspekulo = rawP.iva || "Negatif";
      }
      if (isNakesOn("hpv") || isNakesOn("leher rahim")) {
        data.serviksPemeriksaanHpvDna = rawP.hpvDna || "Negatif";
      }
    }
  }

  // XV. Laboratorium Lengkap (Hb, Profil Lipid, Fungsi Ginjal, Fungsi Hati, Rapid Test)
  if ((isSchoolOrTeen || isAdultOrLansia || isUnder6) && (isNakesOn("hemoglobin") || isNakesOn("anemia") || isNakesOn("hb"))) {
    data.labKadarHemoglobinHb = String(prof.hb || 13.5);
    data.labStatusAnemia = "Tidak anemia";
    data.beruntunTatalaksanaAnemia = "KIE Gizi Seimbang";
  }

  if (isAdultOrLansia && (isNakesOn("profil lipid") || isNakesOn("kolesterol") || isNakesOn("lipid"))) {
    data.labDilakukanProfilLipid = "Ya";
    data.beruntunLipidKolesterolTotal = String(prof.kolesterol || 182);
    data.beruntunLipidTrigliserida = String(prof.trigliserida || 128);
    data.beruntunLipidHdl = String(prof.hdl || 50);
    data.beruntunLipidLdl = String(prof.ldl || 110);
    data.beruntunLipidKesimpulan = "Normal";
  }

  if (isAdultOrLansia && (isNakesOn("fungsi ginjal") || isNakesOn("ginjal") || isNakesOn("kreatinin"))) {
    data.labDilakukanFungsiGinjal = "Ya";
    data.beruntunGinjalUreum = String(prof.ureum || 24);
    data.beruntunGinjalKreatinin = String(prof.kreatinin || 0.85);
    data.beruntunGinjalEgfr = `${prof.egfr || 96} mL/mnt/1.73m² (Normal ≥ 90)`;
    data.beruntunGinjalProteinAlbuminUrin = "Negatif";
    data.beruntunGinjalUacr = "Albumin 15 / Kreatinin 100 — Normal (< 30 mg/g)";
    data.beruntunGinjalKesimpulan = "Normal";
  }

  if (isAdultOrLansia && (isNakesOn("fungsi hati") || isNakesOn("sirosis") || isNakesOn("fibrosis") || isNakesOn("sgot"))) {
    data.labDilakukanFungsiHati = "Ya";
    data.beruntunHatiSgotSgpt = `SGOT: ${prof.sgot || 24} U/L | SGPT: ${prof.sgpt || 22} U/L`;
    data.beruntunHatiTrombositApri = `Trombosit: ${prof.trombosit || 250000} | Skor APRI: < 0.5`;
    data.beruntunHatiDerajatFibrosis = "F0 - F1 (Normal)";
  }

  if (isAge15Plus) {
    if (isNakesOn("hepatitis b") || isNakesOn("hbsag") || isNakesOn("hepatitis")) {
      data.rapidTestHbsag = "HBsAg Non Reaktif";
    }
    if (isNakesOn("hepatitis c") || isNakesOn("anti-hcv") || isNakesOn("hepatitis")) {
      data.rapidTestAntiHcv = "Anti HCV Non Reaktif";
    }
    if (isNakesOn("hiv")) {
      data.rapidTestHiv = "Non Reaktif";
    }
    if (isNakesOn("sifilis")) {
      data.rapidTestSifilis = "Non Reaktif";
    }
  }

  // XVI. Kesehatan Jiwa, Khusus Bayi/Balita (0-6 Thn) & Khusus Anak Sekolah/Remaja (7-17 Thn)
  if (!isUnder6) {
    data.jiwaGejalaDepresiSedihCemas = "Tidak";
    data.jiwaHilangMinatFokus = "Tidak";
    data.jiwaKesimpulanSrqPhq = rawP.kesehatanJiwaSrq20 || "Normal (Tidak Berisiko Masalah Kesehatan Jiwa)";
  }

  if (isBayi) {
    if (isNakesOn("shk") || isNakesOn("hipotiroid")) data.bayiShkHipotiroid = "Normal / Negatif";
    if (isNakesOn("s-hak") || isNakesOn("g6pd")) data.bayiShakAdrenalG6pd = "S-HAK: Normal | G6PD: Normal";
    if (isNakesOn("pjb") || isNakesOn("saluran empedu")) data.bayiPjbKritisIkterus = "PJB Kritis: Lolos (Normal) | Saluran Empedu: Normal";
  }

  if (isUnder6) {
    data.balitaBukuKiaKms = "Ya (Memiliki Buku KIA/KMS)";
    data.balitaAsiEksklusif = "Ya";
    data.balitaStatusImunisasiDasar = rawP.statusImunisasi || "Lengkap (Polio & Imunisasi Dasar/Lanjutan)";
    if (!isBayi && (isNakesOn("perkembangan") || isNakesOn("sdidtk") || isNakesOn("kpsp"))) {
      data.balitaPerkembanganKpspSdidtk = rawP.kpsp || "Sesuai Umur (Normal)";
      data.balitaAutismeMchat = rawP.mchat || "Normal (Risiko Rendah Autisme, Terlambat Bicara: Tidak)";
    }
    data.balitaTandaBahayaUmum = "Tidak ada tanda bahaya umum";
  }

  if (isSchoolOrTeen) {
    data.sekolahKeluhanReproduksi = "Tidak ada keluhan (Organ reproduksi normal)";
    data.sekolahImunisasiRutinHpv = isFemale ? "Lengkap (Termasuk Imunisasi HPV: Sudah)" : "Lengkap (Sudah Imunisasi Rutin)";
    if (isNakesOn("kebugaran")) {
      data.sekolahKebugaranJasmani = rawP.kebugaran ? String(rawP.kebugaran) : "Baik";
    }
  }

  // XVII. Khusus Lansia (Usia ≥ 60 Tahun): SKILAS & Indeks ADL Barthel 10 Butir
  if (isLansia) {
    if (isNakesOn("skilas") || isNakesOn("kognitif") || isNakesOn("lansia")) {
      data.skilasKognitifMengingat3Kata = "Ya (Mampu mengingat 3 kata)";
      data.skilasKognitifOrientasiWaktuJam = "Orientasi Tanggal: Benar semua | Menggambar Jam: Normal";
      data.skilasKognitifKesimpulan = rawP.skilasKognitif || "Normal (Tidak ada penurunan kognitif)";

      data.skilasMobilisasiTesBerdiriKursi5x = "Ya (Mampu berdiri 5 kali)";
      data.beruntunSkilasWaktuChairStandDetik = `${prof.chairStandSeconds || 11.0} detik (<11.19 detik)`;
      data.beruntunSkilasKecepatanJalan4m = "4,82 detik (Normal)";
      data.beruntunSkilasTesKeseimbangan = "Berdampingan/Semi-Tandem/Tandem: Bertahan 10 detik (Tidak berisiko jatuh)";
      data.skilasMobilisasiKesimpulan = rawP.skilasMobilisasi || "Normal (Tidak ada gangguan mobilisasi)";

      data.skilasMalnutrisiPenurunanBb = "Tidak ada penurunan berat badan > 3 kg";
      data.skilasMalnutrisiNafsuMakanPakaianLonggar = "Tidak ada penurunan asupan/nafsu makan | Pakaian longgar: Tidak";
      data.beruntunSkilasMnaImtMobilitasStress = "IMT ≥ 23 | Mobilitas: Bisa keluar rumah | Stress psikologis: Tidak";
      data.skilasMalnutrisiKesimpulan = rawP.skilasMalnutrisi || "Normal (Gizi Baik)";

      data.skilasDepresiPuasKehidupan = "Ya";
      data.skilasDepresiSedihBosanTidakBerdaya = "Tidak (Sedih/Bosan/Hidup Kosong/Tidak Berdaya: Tidak)";
      data.skilasDepresiHilangMinat = "Tidak";
      data.skilasDepresiKesimpulan = rawP.skilasDepresi || "Normal (Tidak ada gejala depresi)";
    }

    if (isNakesOn("barthel") || isNakesOn("adl") || isNakesOn("kemandirian") || isNakesOn("skilas")) {
      data.barthel1Bab = "Terkendali teratur (Skor 2)";
      data.barthel2Bak = "Mandiri (Skor 2)";
      data.barthel3MembersihkanDiri = "Mandiri (Skor 1)";
      data.barthel4PenggunaanJamban = "Mandiri (Skor 2)";
      data.barthel5MakanMinum = "Mandiri (Skor 2)";
      data.barthel6BerbaringKeDuduk = "Mandiri (Skor 3)";
      data.barthel7BerpindahBerjalan = "Mandiri (Skor 3)";
      data.barthel8MemakaiBaju = "Mandiri (Skor 2)";
      data.barthel9NaikTurunTangga = "Mandiri (Skor 2)";
      data.barthel10Mandi = "Mandiri (Skor 1)";
      data.barthelKesimpulanSkor = rawP.barthelIndexAdl || "Mandiri (Skor 20/20)";
    }
  }

  // XVIII. Overlay dari Jawaban Aktual DOM SurveyJS (scrapedFormAnswers) jika tersedia
  if (Array.isArray(completedForms) && completedForms.length > 0) {
    data.daftarFormulirSelesai = completedForms.join("; ");
  }

  if (scrapedFormAnswers && typeof scrapedFormAnswers === "object") {
    const rawLines = [];
    for (const [formName, qaList] of Object.entries(scrapedFormAnswers)) {
      if (!Array.isArray(qaList) || qaList.length === 0) continue;
      const pairsStr = qaList.map(qa => `${qa.question}: ${qa.answer}`).join(" | ");
      rawLines.push(`[${formName}] ${pairsStr}`);

      for (const qa of qaList) {
        const q = clean(qa.question || "");
        const ans = String(qa.answer ?? "").trim();
        if (!q || !ans) continue;

        if (q.includes("status perkawinan") || q.includes("status pernikahan")) data.statusPerkawinan = ans;
        else if (q.includes("rencana menikah")) data.beruntunRencanaMenikah = ans;
        else if (q.includes("hubungan intim")) data.beruntunPernahHubunganIntim = ans;
        else if (q.includes("sedang hamil")) data.beruntunSedangHamil = ans;
        else if (q.includes("imunisasi tetanus")) data.statusImunisasiTetanusWus = ans;
        else if (q.includes("sudah mengalami menstruasi")) data.remajaSudahMenstruasi = ans;
        else if (q.includes("usia berapa anda mengalami menstruasi")) data.beruntunUsiaPertamaMenstruasi = ans;
        else if (q.includes("merokok dalam setahun") || q.includes("merokok dalam kurun waktu 1 tahun")) data.merokokSetahunTerakhir = ans;
        else if (q.includes("jenis rokok apa yang dikonsumsi")) data.beruntunJenisRokok = ans;
        else if (q.includes("berapa tahun anda merokok") || (q.includes("bungkus tahun") && !q.includes("puma"))) data.beruntunLamaMerokokBungkusTahun = ans;
        else if (q.includes("berapa batang rokok")) data.beruntunBatangRokokPerHari = ans;
        else if (q.includes("pernah merokok sebelumnya")) data.beruntunPernahMerokokSebelumnya = ans;
        else if (q.includes("kapan anda berhenti merokok")) data.beruntunKapanBerhentiMerokok = ans;
        else if (q.includes("terpapar asap rokok") || q.includes("menghirup asap rokok")) data.terpaparAsapRokokSebulan = ans;
        else if (q.includes("kadar co")) data.kadarCoPernapasanPpm = ans;
        else if (q.includes("pernah dinyatakan diabetes") || q.includes("dinyatakan diabetes atau kencing manis")) data.pernahDinyatakanDiabetes = ans;
        else if (q.includes("berapa bulan anda didiagnosis") || q.includes("lama didiagnosis diabetes")) data.beruntunLamaDiabetesBulan = ans;
        else if (q.includes("gula darah sewaktu kedua") || q.includes("gds 2")) data.beruntunGulaDarahSewaktuKeduaGds2 = ans;
        else if (q.includes("gula darah sewaktu") || q === "gds") data.beruntunGulaDarahSewaktuGds1 = ans;
        else if (q.includes("gula darah puasa") || q === "gdp") data.beruntunGulaDarahPuasaGdp = ans;
        else if (q.includes("tekanan darah sistol") || q === "sistolik") data.beruntunTdSistolik = ans;
        else if (q.includes("tekanan darah diastol") || q === "diastolik") data.beruntunTdDiastolik = ans;
        else if (q.includes("berat badan") && !q.includes("turun") && !q.includes("menurut")) data.beratBadanKg = ans;
        else if ((q.includes("tinggi badan") || q.includes("panjang badan")) && !q.includes("menurut")) data.tinggiPanjangBadanCm = ans;
        else if (q.includes("lingkar perut") && !q.includes("status")) data.lingkarPerutCm = ans;
        else if (q.includes("lingkar kepala")) data.lingkarKepalaCm = ans;
        else if (q.includes("lila") || q.includes("lingkar lengan")) data.lilaCm = ans;
        else if (q.includes("serumen impaksi")) data.telingaSerumenImpaksi = ans;
        else if (q.includes("infeksi telinga")) data.telingaInfeksi = ans;
        else if (q.includes("tajam pendengaran") || q.includes("tes bisik")) data.telingaTajamPendengaran = ans;
        else if (q.includes("tajam penglihatan") || q.includes("visus")) data.mataTajamPenglihatanVisus = ans;
        else if (q.includes("pemeriksaan pupil") || q.includes("katarak")) data.mataPemeriksaanPupilKatarak = ans;
        else if (q.includes("gigi karies") && !q.includes("jumlah")) data.gigiAdaKaries = ans;
        else if (q.includes("jumlah gigi karies") || q.includes("jumlah karies")) data.beruntunJumlahGigiKaries = ans;
        else if (q.includes("usia - skor puma")) data.pumaSkorUsia = ans;
        else if (q.includes("sedang/mempunyai riwayat merokok")) data.pumaRiwayatMerokok = ans;
        else if (q.includes("berapa bungkus per tahun")) data.beruntunPumaBungkusTahun = ans;
        else if (q.includes("napas pendek")) data.pumaNapasPendek = ans;
        else if (q.includes("mempunyai dahak") || q.includes("dahak yang berasal dari paru")) data.pumaMempunyaiDahak = ans;
        else if (q.includes("kadar hemoglobin") || q.includes("nilai hb") || q.includes("hasil hb")) data.labKadarHemoglobinHb = ans;
      }
    }
    if (rawLines.length > 0) {
      data.detailJawabanDomLengkap = rawLines.join(" || ");
    }
  }

  return data;
}

/**
 * Mendapatkan nilai field terformat untuk UI Tab 3
 */
export async function recordToFieldValues(participant) {
  const rawP = participant || {};
  const t = a => (a !== undefined && a !== null && a !== 0 && a !== "0") ? String(a) : "";
  const values = {};

  values["berat-badan"] = t(rawP.bb || rawP.beratBadan || rawP.berat_badan);
  values["tinggi-badan"] = t(rawP.tb || rawP.tinggiBadan || rawP.tinggi_badan);
  values["lingkar-perut"] = t(rawP.lp || rawP.lingkarPerut || rawP.lingkar_perut);
  values["tekanan-darah-sistolik"] = t(rawP.tdSistolik || rawP.td_sistolik || rawP.sistolik);
  values["tekanan-darah-diastolik"] = t(rawP.tdDiastolik || rawP.td_diastolik || rawP.diastolik);
  values["gula-darah"] = t(rawP.gulaDarah || rawP.gula_darah || rawP.gds);

  if (rawP.merokok) {
    const sm = clean(rawP.merokok);
    values["merokok"] = sm.includes("ya") ? "ya" : "tidak";
    if (sm.includes("tidak")) values["pernah-merokok"] = "tidak";
  }

  if (rawP.statusPernikahan || rawP.status_pernikahan) {
    const st = clean(rawP.statusPernikahan || rawP.status_pernikahan);
    if (st.includes("belum")) values["status-menikah"] = "belum-menikah";
    else if (st.includes("cerai hidup") || st.includes("cerai_hidup")) values["status-menikah"] = "cerai-hidup";
    else if (st.includes("cerai mati") || st.includes("cerai_mati")) values["status-menikah"] = "cerai-mati";
    else if (st.includes("kawin") || st.includes("menikah")) values["status-menikah"] = "menikah";
  }

  if (rawP.telinga) {
    const telVal = clean(rawP.telinga).includes("gangguan") ? "gangguan" : "normal";
    values["telinga"] = telVal;
    values["daya-dengar"] = telVal;
    values["tes-daya-dengar"] = telVal;
  }
  if (rawP.mata) {
    const m = clean(rawP.mata);
    if (m.includes("buta")) values["mata"] = "buta";
    else if (m.includes("berat")) values["mata"] = "gangguan-penglihatan-berat";
    else if (m.includes("sedang")) values["mata"] = "gangguan-penglihatan-sedang";
    else if (m.includes("ringan")) values["mata"] = "gangguan-penglihatan-ringan";
    else values["mata"] = "normal";
  }

  if (rawP.gigi) {
    const g = clean(rawP.gigi);
    if (g.includes("lubang")) values["gigi"] = "lubang";
    else if (g.includes("cabut")) values["gigi"] = "cabut";
    else values["gigi"] = "normal";
  }

  if (rawP.karies) {
    const k = clean(rawP.karies);
    values["karies"] = ["1", "2", "3", ">3"].includes(k) ? k : "tidak-ada";
  }

  if (rawP.kacamata) values["kacamata"] = clean(rawP.kacamata).includes("ya") ? "ya" : "tidak";
  if (rawP.katarak) values["katarak"] = clean(rawP.katarak).includes("curiga") || clean(rawP.katarak).includes("katarak") ? "curiga-katarak" : "normal";
  if (rawP.menstruasi) values["menstruasi"] = clean(rawP.menstruasi);
  if (rawP.kebugaran) values["kebugaran"] = clean(rawP.kebugaran);

  return values;
}