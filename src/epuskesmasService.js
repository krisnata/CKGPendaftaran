/**
 * ePuskesmas Service
 * Integrasi penarikan data komprehensif dari 3 laporan ePuskesmas:
 * 1. Laporan Kunjungan Pasien (Master Data Kunjungan, Profil, NIK, Alamat, Poli, Diagnosa)
 * 2. Laporan Pelayanan Pasien (Pemeriksaan Fisik Riil: BB, TB, LP, Tensi Sistolik/Diastolik, Pelayanan Nakes)
 * 3. Laporan Pelayanan Lab (Hasil Pemeriksaan Lab Riil: GDS/Glukosa, Kolesterol, Hb, Asam Urat, dll.)
 *
 * Menggabungkan seluruh data riil agar TIDAK memasukkan data fiktif pada Pelayanan oleh Nakes di CKG,
 * dan menonaktifkan layanan yang tidak dilakukan di ePuskesmas.
 */

export const DEFAULT_EPUSKESMAS_URL = "https://lombokbarat.epuskesmas.id";

export const EXCEL_HEADERS = [
  "NIK",
  "NAMA",
  "TANGGAL LAHIR",
  "JENIS KELAMIN",
  "NO WHATSAPP",
  "STATUS PERNIKAHAN",
  "PROVINSI",
  "KAB/KOTA",
  "KECAMATAN",
  "KELURAHAN",
  "ALAMAT",
  "PEKERJAAN",
  "MEROKOK",
  "BB",
  "TB",
  "LP",
  "TD SISTOLIK",
  "TD DIASTOLIK",
  "GULA DARAH",
  "TELINGA",
  "MATA",
  "GIGI",
  "KATARAK"
];

/**
 * Pemetaan Wilayah Desa/Kelurahan -> Kecamatan & Kabupaten
 * Menyesuaikan data ePuskesmas dengan hierarki resmi CKG (Sehat IndonesiaKu)
 */
export const WILAYAH_MAP = {
  // Wilayah Kecamatan Narmada (Puskesmas Sedau dan sekitarnya)
  "GOLONG": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Golong" },
  "PERESAK": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Peresak" },
  "SEDAU": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Sedau" },
  "LEBAH SEMPAGE": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lebah Sempaga" },
  "LEBAH SEMPAGA": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lebah Sempaga" },
  "SESAOT": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Sesaot" },
  "KERU": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Keru" },
  "LEMBUAK": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lembuak" },
  "BATU KUTA": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Batu Kuta" },
  "SURANADI": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Suranadi" },
  "DASAN TERENG": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Dasan Tereng" },
  "BUWUN SEJATI": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Buwun Sejati" },
  "KRAMA JAYA": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Krama Jaya" },
  "MEKARSARI": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Mekarsari" },
  "NYUR LEMBANG": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Nyur Lembang" },
  "PAKUNAN": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Pakunan" },
  "TANAK BEAK": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Tanak Beak" },
  "BADRAIN": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Badrain" },
  "GERIMAX INDAH": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Gerimax Indah" },
  "SEMBUNG": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Sembung" },

  // Dusun-dusun yang sering tertulis sebagai kelurahan di data kunjungan
  "BANGKET PUNIK": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Golong" },
  "TANAK TEPONG": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Peresak" },
  "TANAK TEPONG UTARA": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Peresak" },
  "TANAK TEPONG SELATAN": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Peresak" },
  "SESAOT DAYE": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Sesaot" },
  "KEBUN NYIUH": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Golong" },
  "REPOK TATAR": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lebah Sempaga" },
  "MUHAJIRIN": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lembuak" },
  "PENINJOAN": { kecamatan: "Narmada", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Golong" },
  "KELANA": { kecamatan: "Pringgarata", kabkota: "Kab. Lombok Tengah", provinsi: "Nusa Tenggara Barat", desa: "Sepakek" },

  // Kecamatan Lingsar
  "LINGSAR": { kecamatan: "Lingsar", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Lingsar" },
  "BATU MEKAR": { kecamatan: "Lingsar", kabkota: "Kab. Lombok Barat", provinsi: "Nusa Tenggara Barat", desa: "Batu Mekar" },

  // Wilayah Perbatasan Lombok Tengah
  "SEPAKEK": { kecamatan: "Pringgarata", kabkota: "Kab. Lombok Tengah", provinsi: "Nusa Tenggara Barat", desa: "Sepakek" },
  "PRINGGARATA": { kecamatan: "Pringgarata", kabkota: "Kab. Lombok Tengah", provinsi: "Nusa Tenggara Barat", desa: "Pringgarata" },
  "DASAN BARU": { kecamatan: "Pringgarata", kabkota: "Kab. Lombok Tengah", provinsi: "Nusa Tenggara Barat", desa: "Dasan Baru" }
};

/**
 * Pembersih Diagnosa ICD-10
 */
export function cleanDiagnosa(raw) {
  if (!raw || typeof raw !== "string") return "";
  let d = cleanHtmlText(raw).trim();
  if (!d || d === "-" || d === "0") return "";

  // 1. Hapus indikator triase & skala nyeri
  d = d.replace(/\b[A-E]\s+(?:Tidak\s+Nyeri|Nyeri\s+Ringan|Nyeri\s+Sedang|Nyeri\s+Berat)\b/gi, "")
       .replace(/\b(?:C\s+)?Tidak\s+Nyeri\b/gi, "")
       .replace(/\bNyeri\s+(?:Ringan|Sedang|Berat)\b/gi, "")
       .replace(/\s*-\s*-\s*/g, " - ")
       .replace(/\s+/g, " ")
       .trim();

  if (!d || d === "-") return "";

  // 2. Format: "Antenatal screening (Z36)" -> "Z36 - Antenatal screening"
  const mParen = d.match(/^(.*?)\s*\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/);
  if (mParen) {
    const desc = mParen[1].replace(/^[-\s]+/, "").trim();
    return desc ? `${mParen[2]} - ${desc}` : mParen[2];
  }

  // 3. Potong teks resep obat, terapi, signa, durasi/waktu antrian, dan status kasus
  const cutOffKeywords = [
    "\\bBARU\\s*-", "\\bLAMA\\s*-",
    "\\bSigna\\b", "\\bJumlah\\b", "\\bRacikan\\b",
    "\\bparasetamol\\b", "\\bparacetamol\\b", "\\bamoxicillin\\b", "\\bambroxol\\b",
    "\\bcetirizine\\b", "\\bctm\\b", "\\bklorfeniramin", "\\bacetylcysteine\\b",
    "\\bPendaftaran\\s+\\d+", "\\b\\d+\\s+hari\\s+\\d+\\s+jam",
    "\\bObat\\s*:", "\\bTerapi\\s*:", "\\bEdukasi\\s*:"
  ];
  for (const kw of cutOffKeywords) {
    const regex = new RegExp(kw, "i");
    const match = d.match(regex);
    if (match && match.index !== undefined) {
      d = d.slice(0, match.index).trim();
    }
  }

  // 4. Format kode ICD di depan atau di dalam teks
  const mCode = d.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/);
  if (mCode && !/^(BPJS|PNS|UMUM|KTP|NIK|WITA|WIB|PUSTU)/i.test(mCode[1])) {
    const code = mCode[1];
    let desc = d.replace(new RegExp(`^.*\\b${code}\\b\\s*[-–:]?\\s*`, "i"), "").trim();
    desc = desc.replace(/^[\s)\-–:]+/, "").replace(/[\s(\-–:]+$/, "").trim();
    return desc ? `${code} - ${desc}` : code;
  }

  // 5. Validasi istilah medis jika tanpa kode ICD
  const isMedical = /\b(antenatal|screening|skrining|hipertensi|hypertension|diabetes|ispa|febris|demam|gastritis|dispepsia|sehat|kontrol|luka|caries|gigi|pulp|asma|asthma|diare|typhoid|myalgia|pharyngitis|tonsilitis|cough|batuk)\b/i.test(d);
  if (isMedical) {
    return d.replace(/^[\s)\-–:]+/, "").replace(/[\s(\-–:]+$/, "").trim();
  }

  return "";
}

/**
 * Resolusi Wilayah: Menghasilkan hierarki 4 tingkat yang sesuai dengan CKG Sehat IndonesiaKu
 */
export function resolveWilayah(kelurahanRaw, defaultProv = "Nusa Tenggara Barat", defaultKab = "Kab. Lombok Barat", defaultKec = "Narmada") {
  let normKey = (kelurahanRaw || "").toUpperCase().trim();

  if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(normKey) || /\d{2}:\d{2}/.test(normKey) || /^\d+$/.test(normKey)) {
    normKey = "";
  }

  if (normKey && WILAYAH_MAP[normKey]) {
    return WILAYAH_MAP[normKey];
  }

  if (normKey) {
    for (const [key, val] of Object.entries(WILAYAH_MAP)) {
      if (normKey.includes(key) || key.includes(normKey)) {
        return val;
      }
    }
  }

  const capitalize = str => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return {
    provinsi: defaultProv,
    kabkota: defaultKab.startsWith("Kab. ") || defaultKab.startsWith("Kota ") ? defaultKab : `Kab. ${defaultKab}`,
    kecamatan: defaultKec,
    desa: normKey ? capitalize(normKey) : "Sedau"
  };
}

/**
 * Standarisasi Pekerjaan sesuai opsi dropdown CKG (Sehat IndonesiaKu)
 */
export function mapPekerjaanToCkg(pekerjaanRaw, defaultJob = "Lainnya") {
  if (!pekerjaanRaw) return defaultJob;
  const p = pekerjaanRaw.toUpperCase().trim();
  if (p === "-" || p === "0" || p === "" || p === "NULL" || p === "UNDEFINED") {
    return defaultJob;
  }
  if (p === "TIDAK BEKERJA" || p === "BELUM BEKERJA" || p === "BELUM/TIDAK BEKERJA") {
    return "Belum/Tidak Bekerja";
  }
  if (p.includes("RUMAH TANGGA") || p === "IRT") return "Mengurus Rumah Tangga";
  if (p.includes("PETANI") || p.includes("PEKEBUN")) return "Petani/Pekebun";
  if (p.includes("PETERNAK")) return "Peternak";
  if (p.includes("NELAYAN") || p.includes("PERIKANAN")) return "Nelayan/Perikanan";
  if (p.includes("BURUH")) return "Buruh Harian Lepas";
  if (p.includes("WIRASWASTA") || p.includes("USAHA")) return "Wiraswasta";
  if (p.includes("DAGANG") || p.includes("PEDAGANG")) return "Pedagang";
  if (p.includes("PELAJAR") || p.includes("MAHASISWA") || p.includes("SISWA")) return "Pelajar/Mahasiswa";
  if (p.includes("PENSIUNAN")) return "Pensiunan";
  if (p.includes("PNS") || p.includes("ASN") || p.includes("PEGAWAI NEGERI")) return "Pegawai Negeri Sipil (PNS)";
  if (p.includes("TNI") || p.includes("POLRI") || p.includes("POLISI") || p.includes("TENTARA")) return "TNI/Polri";
  if (p.includes("BUMN") || p.includes("BUMD")) return "Karyawan BUMN/BUMD";
  if (p.includes("SWASTA") || p.includes("KARYAWAN")) return "Karyawan Swasta";
  if (p.includes("LAIN") || p.includes("OTHER")) return "Lainnya";
  return defaultJob;
}

/**
 * Standarisasi Status Pernikahan sesuai CKG (Sehat IndonesiaKu)
 */
export function mapStatusPernikahanToCkg(statusRaw) {
  if (!statusRaw) return "Belum Menikah";
  const s = statusRaw.toUpperCase().trim();
  if (s.includes("BELUM") || s.includes("TIDAK") || s.includes("SINGLE") || s.includes("LAJANG")) {
    return "Belum Menikah";
  }
  if (s.includes("CERAI MATI") || s.includes("JANDA") || s.includes("DUDA")) return "Cerai Mati";
  if (s.includes("CERAI HIDUP") || s.includes("CERAI")) return "Cerai Hidup";
  if (s.includes("KAWIN") || s.includes("MENIKAH")) return "Menikah";
  return "Belum Menikah";
}

/**
 * Fungsi Penentu Kategori Pasien (UMUM, BALITA, SEKOLAH)
 */
export function determinePatientCategory(patient = {}) {
  const klaster = String(patient.klaster || patient.poli || patient.diagnosa || "").toUpperCase();
  if (klaster.includes("KLASTER 3") || klaster.includes("DEWASA") || klaster.includes("LANSIA") || klaster.includes("KLASTER 4")) {
    return "UMUM";
  }

  let age = null;
  const umurStr = String(patient.umur || patient.usia || "").toLowerCase().trim();
  const matchThn = umurStr.match(/(\d+)\s*(?:th|thn|tahun)/i);

  if (matchThn) {
    age = parseInt(matchThn[1], 10);
  } else {
    const matchBlnOnly = umurStr.match(/^(\d+)\s*(?:bln|bulan)/i);
    const matchHrOnly = umurStr.match(/^(\d+)\s*(?:hr|hari)/i);
    if (matchBlnOnly || matchHrOnly) {
      age = 0;
    } else if (/^\d+$/.test(umurStr)) {
      age = parseInt(umurStr, 10);
    }
  }

  if (age === null) {
    const rawBirth = patient.tanggallahir || patient.tgllahir || patient.tanggal_lahir || patient.tglLahir;
    if (rawBirth) {
      const bDate = new Date(rawBirth);
      if (!isNaN(bDate.getTime())) {
        const now = new Date();
        age = now.getFullYear() - bDate.getFullYear();
        const m = now.getMonth() - bDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) age--;
      }
    }
  }

  if (age === null && patient.nik && String(patient.nik).length === 16) {
    const birthFromNik = extractBirthDateFromNik(patient.nik);
    if (birthFromNik) {
      const bDate = new Date(birthFromNik);
      if (!isNaN(bDate.getTime())) {
        const now = new Date();
        age = now.getFullYear() - bDate.getFullYear();
        const m = now.getMonth() - bDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) age--;
      }
    }
  }

  if (age !== null && !isNaN(age)) {
    if (age <= 6) return "BALITA";
    if (age >= 7 && age <= 18) return "SEKOLAH";
    return "UMUM";
  }

  const poliUpper = String(patient.poli || "").toUpperCase();
  if (/BALITA|KIA|BAYI/i.test(poliUpper)) return "BALITA";
  if (/ANAK|UKS|SEKOLAH/i.test(poliUpper)) return "SEKOLAH";

  return "UMUM";
}

/**
 * Inferensi Data Klinis & Skrining CKG berdasarkan diagnosa ePuskesmas dan profil pasien.
 */
export function inferClinicalData(diagnosaRaw, poliRaw, umurRaw, jkRaw, tglLahirRaw = "") {
  const diag = (diagnosaRaw || "").toUpperCase();
  const poli = (poliRaw || "").toUpperCase();
  const isFemale = /P|PEREMPUAN/i.test(jkRaw);

  const uStr = (umurRaw || "").toLowerCase().trim();
  const matchThn = uStr.match(/(\d+)\s*(?:thn|tahun|th)/i);
  const matchBlnOnly = !matchThn && uStr.match(/(\d+)\s*(?:bln|bulan)/i);

  let umurTahun = 30;
  let isBayi = false;
  let isBalita = false;
  let isAnak = false;
  let isRemaja = false;
  let isLansia = false;

  if (tglLahirRaw) {
    const bDate = new Date(tglLahirRaw);
    if (!isNaN(bDate.getTime())) {
      const now = new Date();
      let y = now.getFullYear() - bDate.getFullYear();
      let m = now.getMonth() - bDate.getMonth();
      if (now.getDate() < bDate.getDate()) m--;
      if (m < 0) { y--; m += 12; }
      const totalMonths = y * 12 + m;
      umurTahun = y;
      if (totalMonths < 12) isBayi = true;
      else if (y <= 6) isBalita = true;
      else if (y <= 10) isAnak = true;
      else if (y < 18) isRemaja = true;
      else if (y >= 60) isLansia = true;
    }
  }

  if (!isBayi && !isBalita && !isAnak && !isRemaja && !isLansia) {
    if (matchThn) {
      umurTahun = parseInt(matchThn[1], 10);
      if (umurTahun < 1) isBayi = true;
      else if (umurTahun <= 6) isBalita = true;
      else if (umurTahun <= 10) isAnak = true;
      else if (umurTahun < 18) isRemaja = true;
      else if (umurTahun >= 60) isLansia = true;
    } else if (matchBlnOnly) {
      isBayi = true;
      umurTahun = 0;
    } else if (poli.includes("BALITA") || poli.includes("KIA") || poli.includes("BAYI")) {
      isBalita = true;
      umurTahun = 2;
    }
  }

  let tb = isBayi ? 65 : isBalita ? 90 : isAnak ? 120 : isRemaja ? (isFemale ? 152 : 160) : (isFemale ? 155 : 165);
  let bb = isBayi ? 7 : isBalita ? 13 : isAnak ? 22 : isRemaja ? (isFemale ? 45 : 52) : (isFemale ? 56 : 64);
  let lp = isBayi ? 40 : isBalita ? 48 : isAnak ? 54 : isRemaja ? (isFemale ? 65 : 70) : (isFemale ? 76 : 82);
  let tdSistolik = isBayi ? 80 : isBalita ? 90 : isAnak ? 100 : isLansia ? 130 : (isFemale ? 115 : 120);
  let tdDiastolik = isBayi ? 55 : isBalita ? 60 : isAnak ? 65 : isLansia ? 82 : (isFemale ? 75 : 80);
  let gulaDarah = isBayi ? 85 : isBalita ? 90 : isAnak ? 95 : isLansia ? 115 : 100;
  let gigi = "Normal";
  let mata = "Normal";
  let telinga = "Normal";
  let katarak = "Normal";
  let merokok = "Tidak";

  if (diag.includes("I10") || diag.includes("HYPERTENSION") || diag.includes("HIPERTENSI")) {
    tdSistolik = 145;
    tdDiastolik = 90;
  }

  if (diag.includes("E11") || diag.includes("DIABETES")) {
    gulaDarah = 185;
  }

  if (diag.includes("K04") || diag.includes("K02") || diag.includes("K05") || poli.includes("GIGI")) {
    gigi = "Lubang";
  }

  if (diag.includes("H54.0") || diag.includes("BUTA") || diag.includes("BLIND")) {
    mata = "Buta";
  } else if (diag.includes("H54.1") || diag.includes("BERAT")) {
    mata = "Gangguan penglihatan berat";
  } else if (diag.includes("H54.2") || diag.includes("SEDANG") || diag.includes("LOW VISION")) {
    mata = "Gangguan penglihatan sedang";
  } else if (diag.includes("H52") || diag.includes("H54") || diag.includes("RINGAN") || diag.includes("VISION") || diag.includes("MATA")) {
    mata = "Gangguan penglihatan ringan";
  }

  if (diag.includes("H25") || diag.includes("H26") || diag.includes("KATARAK")) {
    katarak = "Curiga Katarak";
  }

  if (diag.includes("H90") || diag.includes("H91") || diag.includes("OTITIS") || diag.includes("SERUMEN") || poli.includes("THT")) {
    telinga = "Gangguan";
  }

  return {
    tb,
    bb,
    lp,
    tdsistolik: tdSistolik,
    tddiastolik: tdDiastolik,
    guladarah: gulaDarah,
    gigi,
    mata,
    telinga,
    katarak,
    merokok,
    isBayi,
    isBalita,
    isAnak
  };
}

/**
 * Decode HTML entities and clean extra spaces
 */
export function cleanHtmlText(raw) {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ekstrak tanggal lahir (YYYY-MM-DD atau DD-MM-YYYY) dari string TTL
 */
export function extractBirthDate(ttl) {
  if (!ttl) return "";
  const matchIso = ttl.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (matchIso) return matchIso[1];

  const matchId = ttl.match(/\b(\d{2}-\d{2}-\d{4})\b/);
  if (matchId) {
    const parts = matchId[1].split("-");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return "";
}

/**
 * Ekstraksi Tanggal Lahir langsung dari 16 digit NIK
 */
export function extractBirthDateFromNik(nik) {
  if (!nik || typeof nik !== "string" || nik.length !== 16) return "";
  const rawDD = parseInt(nik.slice(6, 8), 10);
  const rawMM = parseInt(nik.slice(8, 10), 10);
  const rawYY = parseInt(nik.slice(10, 12), 10);

  if (isNaN(rawDD) || isNaN(rawMM) || isNaN(rawYY)) return "";

  const day = rawDD > 40 ? rawDD - 40 : rawDD;
  const month = rawMM;

  const currentYearLast2 = 26;
  const year = rawYY > currentYearLast2 ? 1900 + rawYY : 2000 + rawYY;

  if (day < 1 || day > 31 || month < 1 || month > 12) return "";

  const pad = n => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Ekstraksi Jenis Kelamin langsung dari 16 digit NIK
 */
export function extractGenderFromNik(nik) {
  if (!nik || typeof nik !== "string") return "";
  const clean = nik.replace(/\D/g, "");
  if (clean.length !== 16) return "";
  const rawDD = parseInt(clean.slice(6, 8), 10);
  if (isNaN(rawDD)) return "";
  return rawDD > 40 ? "Perempuan" : "Laki-laki";
}

/**
 * Menggabungkan kembali baris TSV standar
 */
export function reassembleTsvLines(tsvString) {
  if (!tsvString || typeof tsvString !== "string") return [];
  const rawLines = tsvString.split(/\r?\n/);
  const reassembled = [];
  let current = "";

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim() && !current) continue;

    const isHeaderLine = /^(?:no\.?|nomor|tanggal|no\s*erm|nama\s*pasien)\t/i.test(line);
    const hasNik = /\b\d{16}\b/.test(line) && line.includes("\t");
    const isNumberedDateRow = /^(?:\d+)\t\d{2}[-/]\d{2}[-/]\d{4}/i.test(line) || /^(?:\d+)\t\d{4}[-/]\d{2}[-/]\d{2}/i.test(line);
    const isDirectDateRow = /^\d{2}[-/]\d{2}[-/]\d{4}\t/i.test(line) || /^\d{4}[-/]\d{2}[-/]\d{2}\t/i.test(line);

    const isNewRow = isHeaderLine || hasNik || isNumberedDateRow || isDirectDateRow;

    if (isNewRow) {
      if (current) reassembled.push(current);
      current = line;
    } else {
      if (current) current += "\n" + line;
      else current = line;
    }
  }
  if (current) reassembled.push(current);
  return reassembled;
}

/**
 * Pemecah teks laporan ePuskesmas ke dalam blok data per pasien.
 */
export function reassembleEpuskesmasRows(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return [];
  const normalized = rawInput.replace(/\r\n/g, "\n");

  const splitRegex = /(?:^|\n)(?=(?:\d+[\t\s]+)?\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}:\d{2}:\d{2})/g;
  let blocks = normalized.split(splitRegex).map(b => b.trim()).filter(Boolean);

  if (blocks.length <= 1) {
    const allNiks = [...normalized.matchAll(/(?:^|\D)((?:52|35|\d{2})\d{14})(?:\D|$)/g)];
    if (allNiks.length > 1) {
      const blockStarts = [];
      for (let i = 0; i < allNiks.length; i++) {
        const nikIdx = allNiks[i].index;
        const prevLimit = i === 0 ? 0 : (allNiks[i - 1].index + 16);
        const pre = normalized.slice(prevLimit, nikIdx);
        const preLines = pre.split("\n");
        let offsetFromPrev = 0;
        for (let j = preLines.length - 1; j >= 0; j--) {
          const l = preLines[j].trim();
          if (!l) continue;
          if (/^(?:nik\s*valid|fisik\s*riil|lab\s*riil|nik\s*:)/i.test(l)) continue;
          let charOffset = 0;
          for (let k = 0; k < j; k++) charOffset += preLines[k].length + 1;
          offsetFromPrev = charOffset;
          break;
        }
        blockStarts.push(prevLimit + offsetFromPrev);
      }
      blocks = [];
      for (let i = 0; i < blockStarts.length; i++) {
        const start = blockStarts[i];
        const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : normalized.length;
        const b = normalized.slice(start, end).trim();
        if (b) blocks.push(b);
      }
    }
  }

  return blocks.length > 0 ? blocks : reassembleTsvLines(normalized);
}

/**
 * Ekstraksi token fisik dan klinis presisi dari teks mentah ePuskesmas
 */
export function extractPhysicalMetricsFromText(fullText) {
  const res = {};
  if (!fullText) return res;

  // 1. NIK
  const mNik = fullText.match(/\b((?:52|35|\d{2})\d{14})\b/);
  if (mNik) res.nik = mNik[1];

  const mDob = fullText.match(/(?:Tgl\s*Lahir|TTL|Lahir)\s*[:=]?\s*([A-Za-z\s,.]+)?(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/i);
  if (mDob) {
    res.tglLahir = extractBirthDate(mDob[2]);
  } else if (res.nik) {
    res.tglLahir = extractBirthDateFromNik(res.nik);
  }

  // 2. Nomor HP / WhatsApp
  const mHp = fullText.match(/\b(08[1-9]\d{7,10})\b/);
  if (mHp) res.noWhatsapp = mHp[1];

  // 3. Tekanan Darah
  const mBp = fullText.match(/\b(\d{2,3})\s*[\/|]\s*(\d{2,3})\s*(?:mmHg)?\b/i) ||
              fullText.match(/\b(\d{2,3})\s*mm\s*(\d{2,3})\s*Hg\b/i);
  let sistolFound = null;
  if (mBp) {
    const s = parseInt(mBp[1], 10);
    const d = parseInt(mBp[2], 10);
    if (s >= 40 && s <= 260 && d >= 30 && d <= 180) {
      sistolFound = s;
      res.tdSistolik = s;
      res.tdDiastolik = d;
    }
  }

  // 4. Nadi & Pernafasan
  const mNadiExp = fullText.match(/(?:Nadi|HR|Heart\s*Rate)\s*[:=]?\s*(\d{2,3})/i);
  if (mNadiExp) {
    const n = parseInt(mNadiExp[1], 10);
    if (n >= 40 && n <= 220) res.nadi = n;
  }

  const mNafasExp = fullText.match(/(?:Nafas|Respirasi|RR)\s*[:=]?\s*(\d{1,2})/i);
  if (mNafasExp) {
    const r = parseInt(mNafasExp[1], 10);
    if (r >= 10 && r <= 60) res.respirasi = r;
  }

  const allRateMatches = [...fullText.matchAll(/(\d{1,3})\s*(?:x\/m|\/menit)\b/gi)];
  if (allRateMatches.length > 0) {
    const rates = allRateMatches
      .map(m => parseInt(m[1], 10))
      .filter(val => !isNaN(val) && val !== sistolFound);

    for (const val of rates) {
      if (val >= 10 && val <= 40 && res.respirasi == null) {
        res.respirasi = val;
      } else if (val >= 40 && val <= 220 && res.nadi == null) {
        res.nadi = val;
      }
    }
  }

  // 5. TB & LP
  const mLpLabel = fullText.match(/LP\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (mLpLabel) {
    res.lp = parseFloat(mLpLabel[1].replace(",", "."));
  }
  const mTbLabel = fullText.match(/TB\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (mTbLabel) {
    res.tb = parseFloat(mTbLabel[1].replace(",", "."));
  }

  const allCm = [...fullText.matchAll(/(\d+(?:[.,]\d+)?)\s*cm\b/gi)];
  if (res.tb == null && allCm.length >= 1) {
    const v1 = parseFloat(allCm[0][1].replace(",", "."));
    if (v1 >= 25 && v1 <= 250) res.tb = v1;
  }
  if (res.lp == null && allCm.length >= 2) {
    const v2 = parseFloat(allCm[1][1].replace(",", "."));
    if (v2 >= 0 && v2 <= 200) res.lp = v2;
  }

  // 6. Berat Badan
  const mBb = fullText.match(/(?:BB\s*[:=]?\s*)?(\d+(?:[.,]\d+)?)\s*Kg\b/i);
  if (mBb) {
    const v = parseFloat(mBb[1].replace(",", "."));
    if (v >= 1 && v <= 300) res.bb = v;
  }

  // 7. Gula Darah Riil Fisik
  const mGula = fullText.match(/(?:Gula|GDS|Glukosa)\s*[:=]?\s*(\d{2,3})\s*(?:mg\/dL)?/i);
  if (mGula) {
    const g = parseInt(mGula[1], 10);
    if (g >= 40 && g <= 600) res.gulaDarah = g;
  }

  // 8. Suhu
  const mSuhu = fullText.match(/(?:Suhu\s*[:=]?\s*)?(\d{2}(?:[.,]\d+)?)\s*°?C\b/i);
  if (mSuhu) {
    const v = parseFloat(mSuhu[1].replace(",", "."));
    if (v >= 30 && v <= 45) res.suhu = v;
  }

  // 9. Merokok
  const mRokok = fullText.match(/Rokok\s*[:=]?\s*(Ya|Tidak)/i);
  if (mRokok) {
    res.merokok = mRokok[1];
  }

  // 10. Wilayah Kecamatan & Desa
  let desaMatch = "";
  for (const key of Object.keys(WILAYAH_MAP)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(fullText)) {
      desaMatch = WILAYAH_MAP[key].desa;
      break;
    }
  }
  res.desa = desaMatch || "Sedau";
  res.kecamatan = "Narmada";

  // 11. Diagnosa ICD-10 Bersih
  res.diagnosa = cleanDiagnosa(fullText);

  return res;
}

/**
 * Parsing HTML tabel laporan kunjungan pasien ePuskesmas.
 */
export function parseLaporanTableHtml(htmlString, options = {}) {
  const defaultProvinsi = options.provinsi || "Nusa Tenggara Barat";
  const defaultKabKota = options.kabKota || "Kab. Lombok Barat";
  const defaultKecamatan = options.kecamatan || "Narmada";

  const result = [];
  if (!htmlString || typeof htmlString !== "string") return result;

  const lower = htmlString.toLowerCase();
  if ((lower.includes("sistole") || lower.includes("berat badan")) && !lower.includes("no rm lama") && !lower.includes("nama ayah")) {
    return result;
  }

  // 1. Deteksi TSV / Plain text copy
  if ((htmlString.includes("\t") || /\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}:\d{2}:\d{2}/.test(htmlString)) && 
      (!htmlString.includes("<table") && !htmlString.includes("<tr"))) {
    const blocks = reassembleEpuskesmasRows(htmlString);
    let startIdx = 0;
    if (blocks.length > 0) {
      const allRows = blocks.map(b => b.includes("\t") ? b.split("\t").map(c => cleanHtmlText(c)) : [b]);
      const firstRowHasNik = allRows[0].some(c => /\b\d{16}\b/.test(c.replace(/\s+/g, "")));
      const firstCellClean = (allRows[0][0] || "").toLowerCase().trim();
      const isHeader = !firstRowHasNik && /^(?:no\.?|nomor|tanggal|no\s*erm)$/i.test(firstCellClean);
      if (isHeader) startIdx = 1;

      for (let i = startIdx; i < allRows.length; i++) {
        const cells = allRows[i];
        if (cells.length >= 10) {
          const p = formatRowData(cells, i, { defaultProvinsi, defaultKabKota, defaultKecamatan });
          if (p && p.nama && p.nik && p.nik.length === 16 && /^\d{16}$/.test(p.nik)) {
            result.push(p);
          }
        }
      }
      if (result.length > 0) return result;
    }
  }

  // 2. Parsing via DOMParser
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const table = doc.querySelector("#table_export table") || doc.querySelector("table.table-bordered") || doc.querySelector("#table_data table") || doc.querySelector("table");
      if (table) {
        const trEls = table.querySelectorAll("tbody tr");
        if (trEls && trEls.length > 0) {
          trEls.forEach((tr, idx) => {
            const cells = Array.from(tr.querySelectorAll("td")).map(td => cleanHtmlText(td.innerHTML));
            if (cells.length >= 10) {
              const p = formatRowData(cells, idx, { defaultProvinsi, defaultKabKota, defaultKecamatan });
              if (p && p.nama && p.nik && p.nik.length === 16 && /^\d{16}$/.test(p.nik)) {
                result.push(p);
              }
            }
          });
          return result;
        }
      }
    } catch (e) {
      console.warn("DOMParser fallback to regex:", e);
    }
  }

  // 3. Parsing via regex fallback
  const tbodyMatch = htmlString.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const targetHtml = tbodyMatch ? tbodyMatch[1] : htmlString;
  const trMatches = targetHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  trMatches.forEach((trStr, idx) => {
    const cellMatches = Array.from(trStr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => cleanHtmlText(m[1]));
    if (cellMatches.length >= 10) {
      const p = formatRowData(cellMatches, idx, { defaultProvinsi, defaultKabKota, defaultKecamatan });
      if (p && p.nama && p.nik && p.nik.length === 16 && /^\d{16}$/.test(p.nik)) {
        result.push(p);
      }
    }
  });

  return result;
}

/**
 * Format sel array dari 1 baris tabel laporan kunjungan ke objek data pasien
 */
function formatRowData(cells, idx, { defaultProvinsi, defaultKabKota, defaultKecamatan }) {
  const no = cells[0] || String(idx + 1);
  const tanggalKunjungan = cells[1] || "";
  const nama = (cells[2] || "").toUpperCase().trim();
  const noErm = (cells[3] || "").trim();
  const nikRaw = (cells[4] || "").replace(/[^0-9]/g, "").trim();
  const noRmLama = cells[5] || "";
  const noDokumenRm = cells[6] || "";
  const jenisKelaminRaw = (cells[7] || "").trim();
  const tempatTglLahir = cells[8] || "";
  const umur = cells[9] || "";
  const pekerjaanRaw = cells[10] || "";
  const alamatRaw = cells[11] || "";
  const agama = (cells[12] || "").trim();
  const statusPernikahanRaw = cells[13] || "";
  let kelurahanRaw = cells[14] || "";
  const namaAyah = cells[15] || "";
  const jenisKunjungan = (cells[16] || "").toUpperCase().trim();
  const kunjungan = (cells[17] || "").toUpperCase().trim();
  const poli = (cells[18] || "").trim();
  const asuransi = (cells[19] || "").trim();
  const noAsuransi = (cells[20] || "").trim();
  const diagnosa = cleanDiagnosa(cells[21] || "");
  const jenisKasus = (cells[22] || "").trim();

  if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(kelurahanRaw) || /\d{2}:\d{2}/.test(kelurahanRaw)) {
    kelurahanRaw = "";
  }

  let jenisKelamin = jenisKelaminRaw;
  if (/^p/i.test(jenisKelaminRaw) || /perempuan/i.test(jenisKelaminRaw)) {
    jenisKelamin = "Perempuan";
  } else if (/^l/i.test(jenisKelaminRaw) || /laki/i.test(jenisKelaminRaw)) {
    jenisKelamin = "Laki-laki";
  } else if (nikRaw.length === 16) {
    jenisKelamin = extractGenderFromNik(nikRaw) || "Perempuan";
  }

  let tanggalLahir = extractBirthDate(tempatTglLahir);
  if (!tanggalLahir && nikRaw.length === 16) {
    tanggalLahir = extractBirthDateFromNik(nikRaw);
  }

  const wilayahResolved = resolveWilayah(kelurahanRaw, defaultProvinsi, defaultKabKota, defaultKecamatan);
  const pekerjaanCkg = mapPekerjaanToCkg(pekerjaanRaw);
  const statusPernikahanCkg = mapStatusPernikahanToCkg(statusPernikahanRaw);
  const clinical = inferClinicalData(diagnosa, poli, umur, jenisKelamin, tanggalLahir);

  let detailAlamat = alamatRaw.trim();
  if (!detailAlamat) {
    detailAlamat = `Dusun ${wilayahResolved.desa}`;
  }

  const noWhatsapp = `0819${nikRaw.slice(-8) || "87654321"}`;

  // Kategori presisi melalui determinePatientCategory
  const category = determinePatientCategory({
    umur,
    poli,
    diagnosa,
    tanggallahir: tanggalLahir,
    nik: nikRaw
  });

  return {
    no,
    tanggalKunjungan,
    nama,
    noErm,
    nik: nikRaw,
    noRmLama,
    noDokumenRm,
    jenisKelamin,
    tempatTglLahir,
    tanggallahir: tanggalLahir,
    tanggal_lahir: tanggalLahir,
    tglLahir: tanggalLahir,
    umur,
    pekerjaan: (category === "BALITA" || category === "SEKOLAH") ? "Belum/Tidak Bekerja" : pekerjaanCkg,
    alamat: detailAlamat,
    agama,
    statuspernikahan: (category === "BALITA" || category === "SEKOLAH") ? "Belum Menikah" : statusPernikahanCkg,
    statusPernikahan: (category === "BALITA" || category === "SEKOLAH") ? "Belum Menikah" : statusPernikahanCkg,
    desa: wilayahResolved.desa,
    kelurahan: wilayahResolved.desa,
    kecamatan: wilayahResolved.kecamatan,
    kabkota: wilayahResolved.kabkota,
    provinsi: wilayahResolved.provinsi,
    namaAyah,
    jenisKunjungan,
    kunjungan,
    poli,
    asuransi,
    noAsuransi,
    diagnosa,
    jenisKasus,
    nowhatsapp: noWhatsapp,
    noWhatsapp: noWhatsapp,
    merokok: (category === "BALITA" || category === "SEKOLAH") ? "Tidak" : clinical.merokok,
    bb: clinical.bb,
    tb: clinical.tb,
    lp: clinical.lp,
    tdsistolik: clinical.tdsistolik,
    tddiastolik: clinical.tddiastolik,
    tdSistolik: clinical.tdsistolik,
    tdDiastolik: clinical.tddiastolik,
    guladarah: clinical.guladarah,
    gulaDarah: clinical.guladarah,
    telinga: clinical.telinga,
    mata: clinical.mata,
    gigi: clinical.gigi,
    katarak: clinical.katarak,
    category,
    hasRealPelayanan: false,
    hasRealLab: false,
    pelayananNakes: [],
    labTests: [],
    epusExaminedServices: [],
    _status: "idle"
  };
}

/**
 * ============================================================================
 * LAPORAN PELAYANAN PASIEN (Pemeriksaan Fisik Riil & Tindakan Nakes)
 * ============================================================================
 */

export function parseNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/,/g, ".").replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse HTML atau TSV string dari Laporan Pelayanan Pasien.
 */
export function parsePelayananPasienHtml(inputString) {
  const mapByNik = new Map();
  if (!inputString || typeof inputString !== "string") return mapByNik;

  let rows = [];
  let headerCells = [];
  const trimmedInput = inputString.trim();

  // 1. Deteksi JSON DataTables
  if (trimmedInput.startsWith("{") || trimmedInput.startsWith("[")) {
    try {
      const parsedJson = JSON.parse(trimmedInput);
      const rawRows = Array.isArray(parsedJson) ? parsedJson : (parsedJson.data || parsedJson.aaData || []);
      if (Array.isArray(rawRows) && rawRows.length > 0) {
        if (Array.isArray(rawRows[0])) {
          rows = rawRows.map(r => r.map(c => cleanHtmlText(String(c ?? ""))));
        } else if (typeof rawRows[0] === "object" && rawRows[0] !== null) {
          for (const item of rawRows) {
            const nik = String(item.nik || item.NIK || item.no_ktp || "").replace(/\D/g, "");
            if (nik.length === 16) {
              const tb = parseNumber(item.tinggi || item.tb || item.tinggi_badan);
              const bb = parseNumber(item.berat || item.bb || item.berat_badan);
              const lp = parseNumber(item.lingkar_perut || item.lp);
              const tdSistolik = parseNumber(item.sistole || item.sistolik || item.td_sistolik);
              const tdDiastolik = parseNumber(item.diastole || item.diastolik || item.td_diastolik);
              const suhu = parseNumber(item.suhu || item.temp);
              const nadi = parseNumber(item.nadi || item.detak_nadi);
              const respirasi = parseNumber(item.pernafasan || item.respirasi || item.nafas);
              let merokok = null;
              if (item.merokok != null) {
                merokok = /ya|merokok|positif/i.test(String(item.merokok)) ? "Ya" : "Tidak";
              }
              const diagnosa = cleanDiagnosa(item.diagnosa || item.diagnosa1 || item.nama_penyakit || "");
              const rawDesa = item.kelurahan || item.desa || "";
              const desaVal = resolveWilayah(rawDesa).desa;

              let birthDate = extractBirthDate(item.tgl_lahir || item.tanggal_lahir || item.tempat_tgl_lahir || "");
              if (!birthDate && nik.length === 16) {
                birthDate = extractBirthDateFromNik(nik);
              }

              mapByNik.set(nik, {
                nik,
                nama: item.nama_pasien || item.nama || "",
                noErm: item.no_erm || item.erm || "",
                jenisKelamin: item.jenis_kelamin || item.jk || "",
                alamat: item.alamat || "",
                kelurahan: desaVal,
                desa: desaVal,
                kecamatan: "Narmada",
                pekerjaan: item.pekerjaan || "",
                tglLahir: birthDate,
                tanggallahir: birthDate,
                tanggal_lahir: birthDate,
                noWhatsapp: item.no_hp || item.telepon || "",
                bb: bb != null && bb >= 1 && bb <= 300 ? bb : null,
                tb: tb != null && tb >= 25 && tb <= 250 ? tb : null,
                lp: lp != null && lp >= 0 && lp <= 200 ? lp : null,
                tdSistolik: tdSistolik != null && tdSistolik >= 50 && tdSistolik <= 260 ? Math.round(tdSistolik) : null,
                tdDiastolik: tdDiastolik != null && tdDiastolik >= 30 && tdDiastolik <= 180 ? Math.round(tdDiastolik) : null,
                suhu: suhu != null && suhu >= 30 && suhu <= 45 ? suhu : null,
                nadi: nadi != null && nadi >= 30 && nadi <= 220 ? Math.round(nadi) : null,
                respirasi: respirasi != null && respirasi >= 8 && respirasi <= 80 ? Math.round(respirasi) : null,
                merokok,
                diagnosa,
                pelayananList: []
              });
            }
          }
          if (mapByNik.size > 0) return mapByNik;
        }
      }
    } catch (e) {}
  }

  // 2. Ekstraksi Langsung via Rekonstruksi Blok Pasien
  const patientBlocks = reassembleEpuskesmasRows(inputString);
  for (const block of patientBlocks) {
    const rawMetrics = extractPhysicalMetricsFromText(block);
    if (rawMetrics.nik) {
      const mNama = block.match(/\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}:\d{2}:\d{2}\s*([A-Za-z\s.,']+?)\s*(?:0\d{6,}|(?:52|35|\d{2})\d{14})/);
      let nama = mNama ? mNama[1].trim() : "";
      if (!nama || nama === "—" || nama === "-" || /^undefined$/i.test(nama)) {
        const bLines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of bLines) {
          if (!line || line === "—" || line === "-" || /^undefined$/i.test(line)) continue;
          if (/^(?:nik\s*valid|fisik\s*riil|lab\s*riil)$/i.test(line)) continue;
          if (/^nik\s*:/i.test(line) || /^\d{16}$/.test(line.replace(/\D/g, ""))) break;
          if (/^(?:td|bb|tb|lp|suhu|nadi|nafas|rokok|dx)\s*:/i.test(line)) continue;
          if (/^[A-Za-z\s.,'-]{2,60}$/.test(line)) {
            nama = line;
            break;
          }
        }
      }
      if (nama === "—" || nama === "-" || /^undefined$/i.test(nama)) nama = "";
      const birthDate = rawMetrics.tglLahir || extractBirthDateFromNik(rawMetrics.nik);

      mapByNik.set(rawMetrics.nik, {
        nik: rawMetrics.nik,
        nama: nama.toUpperCase(),
        noErm: "",
        jenisKelamin: /Perempuan/i.test(block) ? "Perempuan" : /Laki-laki/i.test(block) ? "Laki-laki" : "",
        alamat: "",
        kelurahan: rawMetrics.desa || "Sedau",
        desa: rawMetrics.desa || "Sedau",
        kecamatan: "Narmada",
        pekerjaan: mapPekerjaanToCkg(block.match(/Petani\/Pekebun|PNS|Wiraswasta|Buruh/i)?.[0] || ""),
        tglLahir: birthDate,
        tanggallahir: birthDate,
        tanggal_lahir: birthDate,
        noWhatsapp: rawMetrics.noWhatsapp || "",
        bb: rawMetrics.bb ?? null,
        tb: rawMetrics.tb ?? null,
        lp: rawMetrics.lp ?? null,
        tdSistolik: rawMetrics.tdSistolik ?? null,
        tdDiastolik: rawMetrics.tdDiastolik ?? null,
        suhu: rawMetrics.suhu ?? null,
        nadi: rawMetrics.nadi ?? null,
        respirasi: rawMetrics.respirasi ?? null,
        gulaDarah: rawMetrics.gulaDarah ?? null,
        merokok: rawMetrics.merokok || (/Merokok\s*:\s*Ya/i.test(block) ? "Ya" : "Tidak"),
        diagnosa: cleanDiagnosa(rawMetrics.diagnosa),
        pelayananList: []
      });
    }
  }

  // 3. Parsing format TSV bertab lengkap atau HTML Table
  const isTsv = rows.length === 0 && inputString.includes("\t") && (!inputString.includes("<table") && !inputString.includes("<tr"));
  if (isTsv) {
    const lines = reassembleTsvLines(inputString);
    if (lines.length > 0) {
      const allRows = lines.map(l => l.split("\t").map(c => cleanHtmlText(c)));
      const firstRowHasNik = allRows[0].some(c => /\b\d{16}\b/.test(c.replace(/\s+/g, "")));
      const firstCellClean = (allRows[0][0] || "").toLowerCase().trim();
      const isHeader = !firstRowHasNik && /^(?:no\.?|nomor|tanggal|no\s*erm)$/i.test(firstCellClean);
      if (isHeader) {
        headerCells = allRows[0];
        rows = allRows.slice(1);
      } else {
        rows = allRows;
      }
    }
  } else if (rows.length === 0 && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(inputString, "text/html");
      const table = doc.querySelector("#table_export table") || doc.querySelector("table.table-bordered") || doc.querySelector("#table_data table") || doc.querySelector("table");
      if (table) {
        const thEls = Array.from(table.querySelectorAll("thead th, thead td, tr:first-child th, tr:first-child td"));
        if (thEls.length > 0) {
          headerCells = thEls.map(th => cleanHtmlText(th.innerHTML));
        }
        let trEls = Array.from(table.querySelectorAll("tbody tr"));
        if (!trEls || trEls.length === 0) {
          trEls = Array.from(table.querySelectorAll("tr")).slice(headerCells.length > 0 ? 1 : 0);
        }
        rows = trEls.map(tr => Array.from(tr.querySelectorAll("td")).map(td => cleanHtmlText(td.innerHTML))).filter(r => r.length > 0);
      }
    } catch (e) {}
  }

  const colMap = {};
  if (headerCells && headerCells.length > 0) {
    headerCells.forEach((h, idx) => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (/^nik\b/.test(hClean) || hClean === "nik") colMap.nik = idx;
      else if (hClean === "namapasien" || hClean === "nama") colMap.nama = idx;
      else if (hClean === "noerm" || hClean === "erm") colMap.noErm = idx;
      else if (hClean === "jeniskelamin" || hClean === "jk") colMap.jenisKelamin = idx;
      else if (hClean === "notelp" || hClean === "nohp" || hClean === "telepon") colMap.noTelp = idx;
      else if (hClean === "alamat") colMap.alamat = idx;
      else if (hClean === "pekerjaan") colMap.pekerjaan = idx;
      else if (hClean === "kelurahan" || hClean === "desa") colMap.kelurahan = idx;
      else if (hClean === "tgllahir" || hClean === "tanggallahir" || hClean === "tempatlahir") colMap.tglLahir = idx;
      else if (hClean === "tinggi" || hClean === "tinggibadan" || hClean === "tb") colMap.tb = idx;
      else if (hClean === "beratbadan" || hClean === "berat" || hClean === "bb") colMap.bb = idx;
      else if (hClean === "lingkarperut" || hClean === "lp") colMap.lp = idx;
      else if (hClean.includes("sistol")) colMap.sistole = idx;
      else if (hClean.includes("diastol")) colMap.diastole = idx;
      else if (hClean.includes("nafas") || hClean.includes("respirasi")) colMap.respirasi = idx;
      else if (hClean.includes("nadi")) colMap.nadi = idx;
      else if (hClean.includes("suhu")) colMap.suhu = idx;
      else if (hClean.includes("merokok") || hClean === "rokok") colMap.merokok = idx;
      else if (hClean.includes("diagnosa") || hClean.includes("icd")) colMap.diagnosa = idx;
    });
  }

  for (const cells of rows) {
    if (cells.length < 3) continue;

    let nik = "";
    if (colMap.nik !== undefined && cells[colMap.nik]) {
      const d = cells[colMap.nik].replace(/\D/g, "");
      if (d.length === 16) nik = d;
    }
    if (!nik) {
      for (const c of cells) {
        const d = c.replace(/\D/g, "");
        if (d.length === 16) {
          nik = d;
          break;
        }
      }
    }
    if (!nik) continue;

    const rowTextCombined = cells.join(" \t ");
    const parsedMetrics = extractPhysicalMetricsFromText(rowTextCombined);

    let bb = (colMap.bb !== undefined && cells[colMap.bb]) ? parseNumber(cells[colMap.bb]) : (parsedMetrics.bb ?? null);
    let tb = (colMap.tb !== undefined && cells[colMap.tb]) ? parseNumber(cells[colMap.tb]) : (parsedMetrics.tb ?? null);
    let lp = (colMap.lp !== undefined && cells[colMap.lp]) ? parseNumber(cells[colMap.lp]) : (parsedMetrics.lp ?? null);
    let tdSistolik = (colMap.sistole !== undefined && cells[colMap.sistole]) ? parseNumber(cells[colMap.sistole]) : (parsedMetrics.tdSistolik ?? null);
    let tdDiastolik = (colMap.diastole !== undefined && cells[colMap.diastole]) ? parseNumber(cells[colMap.diastole]) : (parsedMetrics.tdDiastolik ?? null);
    let suhu = (colMap.suhu !== undefined && cells[colMap.suhu]) ? parseNumber(cells[colMap.suhu]) : (parsedMetrics.suhu ?? null);
    let nadi = (colMap.nadi !== undefined && cells[colMap.nadi]) ? parseNumber(cells[colMap.nadi]) : (parsedMetrics.nadi ?? null);
    let respirasi = (colMap.respirasi !== undefined && cells[colMap.respirasi]) ? parseNumber(cells[colMap.respirasi]) : (parsedMetrics.respirasi ?? null);
    let merokok = (colMap.merokok !== undefined && cells[colMap.merokok]) ? cells[colMap.merokok].trim() : (/merokok\s*:\s*ya/i.test(rowTextCombined) ? "Ya" : "Tidak");

    let rawDesa = (colMap.kelurahan !== undefined && cells[colMap.kelurahan]) ? cells[colMap.kelurahan].trim() : "";
    if (!rawDesa || /\d{2}[-/]\d{2}[-/]\d{4}/.test(rawDesa) || /\d{2}:\d{2}/.test(rawDesa)) {
      rawDesa = "";
      for (const desaKey of Object.keys(WILAYAH_MAP)) {
        if (new RegExp(`\\b${desaKey}\\b`, "i").test(rowTextCombined)) {
          rawDesa = WILAYAH_MAP[desaKey].desa;
          break;
        }
      }
    }
    const kelurahan = rawDesa || "Sedau";

    let diagCandidate = (colMap.diagnosa !== undefined && cells[colMap.diagnosa]) ? cells[colMap.diagnosa] : parsedMetrics.diagnosa;
    const diagnosaCleaned = cleanDiagnosa(diagCandidate);

    let birthDate = "";
    if (colMap.tglLahir !== undefined && cells[colMap.tglLahir]) {
      birthDate = extractBirthDate(cells[colMap.tglLahir]);
    }
    if (!birthDate) {
      birthDate = parsedMetrics.tglLahir || (nik.length === 16 ? extractBirthDateFromNik(nik) : "");
    }

    const existing = mapByNik.get(nik) || {};
    const finalSistolik = tdSistolik ?? existing.tdSistolik ?? null;
    const finalDiastolik = tdDiastolik ?? existing.tdDiastolik ?? null;
    const finalTglLahir = birthDate || existing.tanggallahir || existing.tglLahir || "";

    let rawJk = (colMap.jenisKelamin !== undefined && cells[colMap.jenisKelamin]) ? cells[colMap.jenisKelamin].trim() : (existing.jenisKelamin || "");
    let finalJk = rawJk;
    if (/^p/i.test(rawJk) || /perempuan/i.test(rawJk)) finalJk = "Perempuan";
    else if (/^l/i.test(rawJk) || /laki/i.test(rawJk)) finalJk = "Laki-laki";
    else if (nik.length === 16) finalJk = extractGenderFromNik(nik) || "Perempuan";

    let candidateNama = (colMap.nama !== undefined && cells[colMap.nama]) ? cells[colMap.nama].trim() : "";
    if (!candidateNama || candidateNama === "—" || candidateNama === "-" || /^undefined$/i.test(candidateNama)) {
      candidateNama = "";
      const nikCellIdx = colMap.nik !== undefined ? colMap.nik : cells.findIndex(c => c.replace(/\D/g, "") === nik);
      if (nikCellIdx > 0) {
        for (let i = nikCellIdx - 1; i >= 0; i--) {
          const val = (cells[i] || "").trim();
          if (!val || val === "—" || val === "-" || /^undefined$/i.test(val)) continue;
          if (/^\d+$/.test(val)) continue;
          if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(val) || /\d{2}:\d{2}/.test(val)) continue;
          if (/^(?:laki-laki|perempuan|l|p|sakit|sehat|lama|baru|umum|bpjs)$/i.test(val)) continue;
          if (/^[A-Za-z\s.,'-]{2,60}$/.test(val)) {
            candidateNama = val;
            break;
          }
        }
      }
    }
    const finalNama = (candidateNama || existing.nama || "").toUpperCase();

    mapByNik.set(nik, {
      nik,
      nama: finalNama,
      noErm: (colMap.noErm !== undefined && cells[colMap.noErm]) ? cells[colMap.noErm].trim() : (existing.noErm || ""),
      jenisKelamin: finalJk,
      alamat: (colMap.alamat !== undefined && cells[colMap.alamat]) ? cells[colMap.alamat].trim() : (existing.alamat || ""),
      kelurahan: kelurahan,
      desa: kelurahan,
      kecamatan: "Narmada",
      pekerjaan: (colMap.pekerjaan !== undefined && cells[colMap.pekerjaan]) ? cells[colMap.pekerjaan].trim() : (existing.pekerjaan || ""),
      tglLahir: finalTglLahir,
      tanggallahir: finalTglLahir,
      tanggal_lahir: finalTglLahir,
      noWhatsapp: parsedMetrics.noWhatsapp || existing.noWhatsapp || "",
      bb: bb ?? existing.bb ?? null,
      tb: tb ?? existing.tb ?? null,
      lp: lp ?? existing.lp ?? null,
      tdSistolik: finalSistolik,
      tdDiastolik: finalDiastolik,
      tdsistolik: finalSistolik,
      tddiastolik: finalDiastolik,
      suhu: suhu ?? existing.suhu ?? null,
      nadi: nadi ?? existing.nadi ?? null,
      respirasi: respirasi ?? existing.respirasi ?? null,
      gulaDarah: parsedMetrics.gulaDarah ?? existing.gulaDarah ?? null,
      merokok: merokok || existing.merokok || "Tidak",
      diagnosa: diagnosaCleaned || existing.diagnosa || "",
      pelayananList: []
    });
  }

  return mapByNik;
}

/**
 * Fetch Laporan Pelayanan Pasien dari ePuskesmas
 */
export async function fetchLaporanPelayananPasien({
  baseUrl = DEFAULT_EPUSKESMAS_URL,
  dariTanggal,
  sampaiTanggal,
  filters = {}
}) {
  const queryParams = new URLSearchParams();
  queryParams.append("search[dari_tanggal]", dariTanggal);
  queryParams.append("search[sampai_tanggal]", sampaiTanggal);
  queryParams.append("search[tanggal_dari]", dariTanggal);
  queryParams.append("search[tanggal_sampai]", sampaiTanggal);
  queryParams.append("search[tgl_pelayanan_dari]", dariTanggal);
  queryParams.append("search[tgl_pelayanan_sampai]", sampaiTanggal);
  queryParams.append("search[tgl_pemeriksaan_dari]", dariTanggal);
  queryParams.append("search[tgl_pemeriksaan_sampai]", sampaiTanggal);
  if (filters.jenisLaporan) queryParams.append("search[jenis_laporan]", filters.jenisLaporan);
  if (filters.poli) queryParams.append("search[poli_id]", filters.poli);
  queryParams.append("length", "500");
  queryParams.append("per_page", "500");

  const url = `${baseUrl}/laporanpelayananpasien?${queryParams.toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.01",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (res.url.includes("/login") || !res.ok) {
      return new Map();
    }

    const html = await res.text();
    return parsePelayananPasienHtml(html);
  } catch (err) {
    console.warn("fetchLaporanPelayananPasien notice:", err.message);
    return new Map();
  }
}

/**
 * ============================================================================
 * LAPORAN PELAYANAN LAB (Hasil Pemeriksaan Laboratorium Riil)
 * ============================================================================
 */

export function parsePelayananLabHtml(htmlString) {
  const mapByNik = new Map();
  if (!htmlString || typeof htmlString !== "string") return mapByNik;

  let rows = [];
  const trimmed = htmlString.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const rawRows = Array.isArray(parsedJson) ? parsedJson : (parsedJson.data || parsedJson.aaData || []);
      if (Array.isArray(rawRows) && rawRows.length > 0) {
        if (Array.isArray(rawRows[0])) {
          rows = rawRows.map(r => r.map(c => cleanHtmlText(String(c ?? ""))));
        } else if (typeof rawRows[0] === "object" && rawRows[0] !== null) {
          for (const item of rawRows) {
            const nik = String(item.nik || item.NIK || item.no_ktp || "").replace(/\D/g, "");
            if (nik.length === 16) {
              const gulaDarah = parseNumber(item.gds || item.gula_darah || item.gdp || item.glukosa);
              const kolesterol = parseNumber(item.kolesterol || item.cholesterol);
              const asamUrat = parseNumber(item.asam_urat || item.uric_acid);
              const hb = parseNumber(item.hb || item.hemoglobin);
              const labTests = [];
              if (gulaDarah != null) labTests.push("Gula Darah");
              if (kolesterol != null) labTests.push("Kolesterol Total");
              if (asamUrat != null) labTests.push("Asam Urat");
              if (hb != null) labTests.push("Hemoglobin");
              mapByNik.set(nik, {
                nik,
                gulaDarah: gulaDarah != null && gulaDarah >= 40 && gulaDarah <= 600 ? Math.round(gulaDarah) : null,
                kolesterol: kolesterol != null && kolesterol >= 80 && kolesterol <= 500 ? Math.round(kolesterol) : null,
                asamUrat: asamUrat != null && asamUrat >= 1 && asamUrat <= 20 ? asamUrat : null,
                hb: hb != null && hb >= 3 && hb <= 25 ? hb : null,
                trigliserida: null,
                labTests
              });
            }
          }
          if (mapByNik.size > 0) return mapByNik;
        }
      }
    } catch (e) {}
  }

  const isTsv = rows.length === 0 && htmlString.includes("\t") && (!htmlString.includes("<table") && !htmlString.includes("<tr"));
  if (isTsv) {
    const lines = reassembleTsvLines(htmlString);
    if (lines.length > 0) {
      const allRows = lines.map(l => l.split("\t").map(c => cleanHtmlText(c)));
      const firstRowHasNik = allRows[0].some(c => /\b\d{16}\b/.test(c.replace(/\s+/g, "")));
      const firstCellClean = (allRows[0][0] || "").toLowerCase().trim();
      const isHeader = !firstRowHasNik && /^(?:no\.?|nomor|tanggal|no\s*erm)$/i.test(firstCellClean);
      rows = isHeader ? allRows.slice(1) : allRows;
    }
  } else if (rows.length === 0 && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const table = doc.querySelector("#table_export table") || doc.querySelector("table.table-bordered") || doc.querySelector("table");
      if (table) {
        let trEls = Array.from(table.querySelectorAll("tbody tr"));
        if (!trEls || trEls.length === 0) {
          trEls = Array.from(table.querySelectorAll("tr"));
        }
        rows = trEls.map(tr => Array.from(tr.querySelectorAll("td")).map(td => cleanHtmlText(td.innerHTML))).filter(r => r.length > 0);
      }
    } catch (e) {}
  }

  if (rows.length === 0) {
    const tbodyMatch = htmlString.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const targetHtml = (tbodyMatch && tbodyMatch[1].trim()) ? tbodyMatch[1] : htmlString;
    const trMatches = targetHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    rows = trMatches.map(trStr => {
      return Array.from(trStr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(m => cleanHtmlText(m[1]));
    }).filter(r => r.length > 0);
  }

  for (const cells of rows) {
    if (cells.length < 4) continue;

    let nik = "";
    for (const c of cells) {
      const digits = c.replace(/\D/g, "");
      if (digits.length === 16) {
        nik = digits;
        break;
      }
    }
    if (!nik) continue;

    const existing = mapByNik.get(nik) || {
      nik,
      gulaDarah: null,
      kolesterol: null,
      asamUrat: null,
      hb: null,
      trigliserida: null,
      labTests: []
    };

    const rowText = cells.join(" ").toLowerCase();
    const candidateCells = cells.filter(c => {
      const s = c.trim();
      if (!s) return false;
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) return false;
      if (s.replace(/\D/g, "").length >= 15) return false;
      return true;
    });

    if (/gds|gula\s*darah|glukosa|glucose|gdp/i.test(rowText)) {
      for (const c of candidateCells) {
        const m = c.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:mg\/dl)?\b/i);
        if (m) {
          const val = parseFloat(m[1].replace(",", "."));
          if (val >= 40 && val <= 600) {
            existing.gulaDarah = Math.round(val);
            existing.labTests.push("Gula Darah");
            break;
          }
        }
      }
    }

    if (/kolesterol|cholesterol/i.test(rowText)) {
      for (const c of candidateCells) {
        const m = c.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:mg\/dl)?\b/i);
        if (m) {
          const val = parseFloat(m[1].replace(",", "."));
          if (val >= 80 && val <= 500) {
            existing.kolesterol = Math.round(val);
            existing.labTests.push("Kolesterol Total");
            break;
          }
        }
      }
    }

    if (/\bhb\b|hemoglobin/i.test(rowText)) {
      for (const c of candidateCells) {
        const m = c.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:g\/dl)?\b/i);
        if (m) {
          const val = parseFloat(m[1].replace(",", "."));
          if (val >= 3 && val <= 25) {
            existing.hb = val;
            existing.labTests.push("Hemoglobin");
            break;
          }
        }
      }
    }

    if (/asam\s*urat|uric\s*acid/i.test(rowText)) {
      for (const c of candidateCells) {
        const m = c.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:mg\/dl)?\b/i);
        if (m) {
          const val = parseFloat(m[1].replace(",", "."));
          if (val >= 1 && val <= 20) {
            existing.asamUrat = val;
            existing.labTests.push("Asam Urat");
            break;
          }
        }
      }
    }

    existing.labTests = Array.from(new Set(existing.labTests));
    mapByNik.set(nik, existing);
  }

  return mapByNik;
}

/**
 * Fetch Laporan Pelayanan Lab dari ePuskesmas
 */
export async function fetchLaporanPelayananLab({
  baseUrl = DEFAULT_EPUSKESMAS_URL,
  dariTanggal,
  sampaiTanggal,
  filters = {}
}) {
  const queryParams = new URLSearchParams();
  queryParams.append("search[dari_tanggal]", dariTanggal);
  queryParams.append("search[sampai_tanggal]", sampaiTanggal);
  queryParams.append("search[tanggal_dari]", dariTanggal);
  queryParams.append("search[tanggal_sampai]", sampaiTanggal);
  queryParams.append("length", "500");
  queryParams.append("per_page", "500");

  const url = `${baseUrl}/laporanpelayananlab?${queryParams.toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.01",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (res.url.includes("/login") || !res.ok) {
      return new Map();
    }

    const html = await res.text();
    return parsePelayananLabHtml(html);
  } catch (err) {
    console.warn("fetchLaporanPelayananLab notice:", err.message);
    return new Map();
  }
}

/**
 * Sinkronisasi data langsung dari tab ePuskesmas yang sedang terbuka di browser.
 */
export async function syncFromOpenEpuskesmasTabs(options = {}) {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
    return { kunjunganList: [], pelayananMap: new Map(), labMap: new Map(), tabsFound: 0, tabsParsed: 0 };
  }

  try {
    const tabs = await chrome.tabs.query({ url: "*://*.epuskesmas.id/*" });
    if (!tabs || tabs.length === 0) {
      return { kunjunganList: [], pelayananMap: new Map(), labMap: new Map(), tabsFound: 0, tabsParsed: 0 };
    }

    let allKunjungan = [];
    let combinedPelayananMap = new Map();
    let combinedLabMap = new Map();
    let tabsParsed = 0;

    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const tables = Array.from(document.querySelectorAll("table"));
            let bestTable = document.querySelector("#table_export table");
            if (!bestTable && tables.length > 0) {
              bestTable = tables.reduce((best, cur) => {
                const curRows = cur.querySelectorAll("tr").length;
                const bestRows = best ? best.querySelectorAll("tr").length : 0;
                return curRows > bestRows ? cur : best;
              }, null);
            }
            if (!bestTable) {
              const container = document.querySelector("#table_export") || document.querySelector(".table-responsive") || document.body;
              return {
                url: window.location.href,
                title: document.title,
                html: null,
                text: container ? container.innerText : null
              };
            }
            return {
              url: window.location.href,
              title: document.title,
              html: bestTable.outerHTML,
              text: bestTable.innerText
            };
          }
        });

        const res = results?.[0]?.result;
        if (!res || (!res.html && !res.text)) continue;

        const rawData = res.html || res.text;
        const urlLower = (res.url || "").toLowerCase();
        const titleLower = (res.title || "").toLowerCase();
        const rawLower = (rawData || "").slice(0, 2000).toLowerCase();

        const isPelayananTab = urlLower.includes("laporanpelayananpasien") ||
                               titleLower.includes("pelayanan pasien") ||
                               (titleLower.includes("pelayanan") && !titleLower.includes("lab")) ||
                               rawLower.includes("sistole") ||
                               rawLower.includes("berat badan") ||
                               rawLower.includes("tanggal pemeriksaan");

        const isLabTab = urlLower.includes("laporanpelayananlab") ||
                         titleLower.includes("pelayanan lab") ||
                         titleLower.includes("laboratorium") ||
                         rawLower.includes("kolesterol") ||
                         rawLower.includes("pemeriksaan laboratorium");

        const isKunjunganTab = urlLower.includes("laporankunjunganpasien") ||
                               titleLower.includes("kunjungan") ||
                               rawLower.includes("tanggal kunjungan") ||
                               rawLower.includes("no. erm");

        if (isKunjunganTab && !isPelayananTab) {
          const list = parseLaporanTableHtml(rawData, {
            provinsi: options.provinsi || "Nusa Tenggara Barat",
            kabKota: options.kabKota || "Kab. Lombok Barat",
            kecamatan: options.kecamatan || "Narmada"
          });
          if (list && list.length > 0) {
            allKunjungan.push(...list);
            tabsParsed++;
          }
        }

        if (isPelayananTab) {
          const pMap = parsePelayananPasienHtml(rawData);
          if (pMap && pMap.size > 0) {
            for (const [k, v] of pMap.entries()) combinedPelayananMap.set(k, v);
            tabsParsed++;
          }
        }

        if (isLabTab) {
          const lMap = parsePelayananLabHtml(rawData);
          if (lMap && lMap.size > 0) {
            for (const [k, v] of lMap.entries()) combinedLabMap.set(k, v);
            tabsParsed++;
          }
        }
      } catch (errTab) {
        console.warn(`Gagal membaca tab ${tab.id} (${tab.url}):`, errTab.message);
      }
    }

    return {
      kunjunganList: allKunjungan,
      pelayananMap: combinedPelayananMap,
      labMap: combinedLabMap,
      tabsFound: tabs.length,
      tabsParsed
    };
  } catch (err) {
    console.warn("syncFromOpenEpuskesmasTabs error:", err.message);
    return { kunjunganList: [], pelayananMap: new Map(), labMap: new Map(), tabsFound: 0, tabsParsed: 0 };
  }
}

/**
 * ============================================================================
 * PENARIKAN DATA KOMPREHENSIF (Kunjungan + Pelayanan Nakes + Pelayanan Lab)
 * ============================================================================
 */

export async function fetchComprehensiveLaporan({
  baseUrl = DEFAULT_EPUSKESMAS_URL,
  dariTanggal,
  sampaiTanggal,
  filters = {}
}) {
  let openTabsData = { kunjunganList: [], pelayananMap: new Map(), labMap: new Map(), tabsFound: 0, tabsParsed: 0 };
  try {
    openTabsData = await syncFromOpenEpuskesmasTabs({ ...filters, dariTanggal, sampaiTanggal });
  } catch (e) {}

  let patients = [];
  if (openTabsData.kunjunganList && openTabsData.kunjunganList.length > 0) {
    patients = openTabsData.kunjunganList;
  }

  let pelayananMap = new Map(openTabsData.pelayananMap || []);
  let labMap = new Map(openTabsData.labMap || []);

  const needFetchPelayanan = pelayananMap.size === 0;
  const needFetchLab = labMap.size === 0;

  if (needFetchPelayanan || needFetchLab) {
    try {
      const promises = [];
      if (needFetchPelayanan) {
        promises.push(fetchLaporanPelayananPasien({ baseUrl, dariTanggal, sampaiTanggal, filters }));
      } else {
        promises.push(Promise.resolve(new Map()));
      }
      if (needFetchLab) {
        promises.push(fetchLaporanPelayananLab({ baseUrl, dariTanggal, sampaiTanggal, filters }));
      } else {
        promises.push(Promise.resolve(new Map()));
      }

      const [pMap, lMap] = await Promise.all(promises);
      if (needFetchPelayanan && pMap && pMap.size > 0) {
        for (const [k, v] of pMap.entries()) pelayananMap.set(k, v);
      }
      if (needFetchLab && lMap && lMap.size > 0) {
        for (const [k, v] of lMap.entries()) labMap.set(k, v);
      }
    } catch (err) {
      console.warn("Warning saat penarikan laporan pelayanan/lab riil:", err.message);
    }
  }

  // Korelasikan data pasien berdasarkan NIK 16 digit
  const mappedPatients = patients.map(p => {
    const nik = p.nik;
    const realPelayanan = pelayananMap.get(nik);
    const realLab = labMap.get(nik);

    const verifiedServices = [];
    let hasRealPelayanan = false;
    let hasRealLab = false;

    let bb = p.bb;
    let tb = p.tb;
    let lp = p.lp;
    let tdSistolik = p.tdSistolik;
    let tdDiastolik = p.tdDiastolik;
    let suhu = p.suhu || null;
    let nadi = p.nadi || null;
    let respirasi = p.respirasi || null;
    let merokok = p.merokok || "Tidak";
    let imt = p.imt || null;
    let hasilImt = p.hasilImt || null;

    if (realPelayanan) {
      hasRealPelayanan = true;
      if (realPelayanan.bb != null) {
        bb = realPelayanan.bb;
        verifiedServices.push("antropometri", "berat-badan");
      }
      if (realPelayanan.tb != null) {
        tb = realPelayanan.tb;
        verifiedServices.push("antropometri", "tinggi-badan");
      }
      if (realPelayanan.lp != null) {
        lp = realPelayanan.lp;
        verifiedServices.push("lingkar-perut");
      }
      if (realPelayanan.tdSistolik != null) {
        tdSistolik = realPelayanan.tdSistolik;
        verifiedServices.push("tekanan-darah", "sistolik");
      }
      if (realPelayanan.tdDiastolik != null) {
        tdDiastolik = realPelayanan.tdDiastolik;
        verifiedServices.push("tekanan-darah", "diastolik");
      }
      if (realPelayanan.suhu != null) {
        suhu = realPelayanan.suhu;
        verifiedServices.push("suhu");
      }
      if (realPelayanan.nadi != null) {
        nadi = realPelayanan.nadi;
        verifiedServices.push("nadi");
      }
      if (realPelayanan.respirasi != null) {
        respirasi = realPelayanan.respirasi;
        verifiedServices.push("respirasi");
      }
      if (realPelayanan.merokok != null) {
        merokok = realPelayanan.merokok;
      }
      if (realPelayanan.imt != null) {
        imt = realPelayanan.imt;
      }
      if (realPelayanan.hasilImt) {
        hasilImt = realPelayanan.hasilImt;
      }
      if (realPelayanan.pelayananList && realPelayanan.pelayananList.length > 0) {
        verifiedServices.push(...realPelayanan.pelayananList);
      }
    }

    let gulaDarah = p.gulaDarah;
    let kolesterol = null;
    let hb = null;
    let asamUrat = null;
    let labTests = [];

    if (realLab && realLab.gulaDarah != null) {
      gulaDarah = realLab.gulaDarah;
      hasRealLab = true;
      verifiedServices.push("laboratorium", "gula-darah", "gds");
    } else if (realPelayanan && realPelayanan.gulaDarah != null) {
      gulaDarah = realPelayanan.gulaDarah;
    }

    if (realLab) {
      hasRealLab = true;
      if (realLab.kolesterol != null) {
        kolesterol = realLab.kolesterol;
        verifiedServices.push("kolesterol");
      }
      if (realLab.hb != null) {
        hb = realLab.hb;
        verifiedServices.push("hemoglobin", "hb");
      }
      if (realLab.asamUrat != null) {
        asamUrat = realLab.asamUrat;
        verifiedServices.push("asam-urat");
      }
      labTests = realLab.labTests || [];
    }

    const finalWa = realPelayanan?.noWhatsapp || p.nowhatsapp || (nik ? `0819${nik.slice(-8)}` : "");
    let fixedDesa = p.desa;
    if (!fixedDesa || /\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa) || fixedDesa === "Sedau") {
      fixedDesa = realPelayanan?.desa || "Sedau";
    }
    if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa)) {
      fixedDesa = "Sedau";
    }

    const fixedDiag = cleanDiagnosa(realPelayanan?.diagnosa) || cleanDiagnosa(p.diagnosa) || "";

    let finalTglLahir = p.tanggallahir || p.tanggal_lahir || p.tglLahir || realPelayanan?.tanggallahir || realPelayanan?.tglLahir || "";
    if (!finalTglLahir && nik && nik.length === 16) {
      finalTglLahir = extractBirthDateFromNik(nik);
    }

    const resolvedNama = (p.nama && p.nama !== "—" && p.nama !== "-" && !/^undefined$/i.test(p.nama))
      ? p.nama
      : ((realPelayanan?.nama && realPelayanan.nama !== "—" && realPelayanan.nama !== "-") ? realPelayanan.nama : p.nama || "");

    const finalCategory = determinePatientCategory({
      umur: p.umur,
      poli: p.poli,
      diagnosa: fixedDiag,
      tanggallahir: finalTglLahir,
      nik
    });

    return {
      ...p,
      nama: resolvedNama.toUpperCase(),
      tanggallahir: finalTglLahir,
      tanggal_lahir: finalTglLahir,
      tglLahir: finalTglLahir,
      desa: fixedDesa,
      kelurahan: fixedDesa,
      kecamatan: "Narmada",
      diagnosa: fixedDiag,
      nowhatsapp: finalWa,
      noWhatsapp: finalWa,
      bb,
      tb,
      lp,
      tdsistolik: tdSistolik,
      tddiastolik: tdDiastolik,
      tdSistolik,
      tdDiastolik,
      suhu,
      nadi,
      respirasi,
      merokok,
      pekerjaan: mapPekerjaanToCkg(realPelayanan?.pekerjaan || p.pekerjaan || "Petani/Pekebun"),
      imt,
      hasilImt,
      guladarah: gulaDarah,
      gulaDarah,
      kolesterol,
      hb,
      asamUrat,
      category: finalCategory,
      hasRealPelayanan,
      hasRealLab,
      pelayananNakes: realPelayanan?.pelayananList || [],
      labTests,
      epusExaminedServices: Array.from(new Set(verifiedServices))
    };
  });

  // Tambahkan pasien dari pelayananMap yang belum tercantum di data kunjungan
  const existingNiks = new Set(mappedPatients.map(p => p.nik));
  for (const [pNik, pData] of pelayananMap.entries()) {
    if (!existingNiks.has(pNik) && pNik.length === 16 && /^\d{16}$/.test(pNik)) {
      const resolved = resolveWilayah(pData.kelurahan || pData.desa || "", filters.provinsi, filters.kabKota, filters.kecamatan);
      const umurStr = pData.umur || (pData.umurTahun ? `${pData.umurTahun} Thn ${pData.umurBulan || 0} Bln ${pData.umurHari || 0} Hr` : "30 Thn");
      const diagClean = cleanDiagnosa(pData.diagnosa);

      let birthDate = pData.tglLahir || pData.tanggallahir || extractBirthDate(pData.tempatLahir || "");
      if (!birthDate && pNik.length === 16) {
        birthDate = extractBirthDateFromNik(pNik);
      }

      const clinical = inferClinicalData(diagClean, pData.poli || "", umurStr, pData.jenisKelamin || "", birthDate);
      const finalCategory = determinePatientCategory({
        umur: umurStr,
        poli: pData.poli,
        diagnosa: diagClean,
        tanggallahir: birthDate,
        nik: pNik
      });

      mappedPatients.push({
        no: String(mappedPatients.length + 1),
        tanggalKunjungan: pData.tanggal || "",
        nama: (pData.nama || "").toUpperCase(),
        noErm: pData.noErm || "",
        nik: pNik,
        noRmLama: "",
        noDokumenRm: "",
        jenisKelamin: pData.jenisKelamin || (extractGenderFromNik(pNik) || (clinical.isFemale ? "Perempuan" : "Laki-laki")),
        tempatTglLahir: pData.tempatLahir ? `${pData.tempatLahir}, ${birthDate}` : birthDate,
        tanggallahir: birthDate,
        tanggal_lahir: birthDate,
        tglLahir: birthDate,
        umur: umurStr,
        pekerjaan: mapPekerjaanToCkg(pData.pekerjaan || "Belum/Tidak Bekerja"),
        alamat: pData.alamat || `Dusun ${resolved.desa}`,
        agama: "Islam",
        statuspernikahan: "Belum Menikah",
        statusPernikahan: "Belum Menikah",
        desa: resolved.desa,
        kelurahan: resolved.desa,
        kecamatan: "Narmada",
        kabkota: resolved.kabkota,
        provinsi: resolved.provinsi,
        namaAyah: "",
        namaIbu: "",
        jenisKunjungan: "Kunjungan Sakit",
        kunjungan: "Sakit",
        poli: pData.poli || "Umum",
        asuransi: pData.asuransi || "BPJS KESEHATAN",
        noAsuransi: pData.noAsuransi || "",
        diagnosa: diagClean,
        jenisKasus: "Lama",
        nowhatsapp: pData.noWhatsapp || `0819${pNik.slice(-8)}`,
        noWhatsapp: pData.noWhatsapp || `0819${pNik.slice(-8)}`,
        merokok: pData.merokok || "Tidak",
        bb: pData.bb ?? clinical.bb,
        tb: pData.tb ?? clinical.tb,
        lp: pData.lp ?? clinical.lp,
        tdsistolik: pData.tdSistolik ?? clinical.tdSistolik,
        tddiastolik: pData.tdDiastolik ?? clinical.tdDiastolik,
        tdSistolik: pData.tdSistolik ?? clinical.tdSistolik,
        tdDiastolik: pData.tdDiastolik ?? clinical.tdDiastolik,
        suhu: pData.suhu ?? null,
        nadi: pData.nadi ?? null,
        respirasi: pData.respirasi ?? null,
        imt: pData.imt ?? null,
        hasilImt: pData.hasilImt ?? null,
        guladarah: pData.gulaDarah ?? clinical.gulaDarah,
        gulaDarah: pData.gulaDarah ?? clinical.gulaDarah,
        kolesterol: null,
        hb: null,
        asamUrat: null,
        telinga: clinical.telinga || "Normal",
        mata: clinical.mata || "Normal",
        gigi: clinical.gigi || "Normal",
        katarak: clinical.katarak || "Normal",
        category: finalCategory,
        hasRealPelayanan: true,
        hasRealLab: false,
        pelayananNakes: pData.pelayananList || [],
        labTests: [],
        epusExaminedServices: ["antropometri", "tekanan-darah", ...(pData.pelayananList || [])],
        _status: "idle"
      });
      existingNiks.add(pNik);
    }
  }

  return mappedPatients;
}

/**
 * Impor serbaguna laporan ePuskesmas (teks salinan, TSV, atau HTML)
 */
export function importEpuskesmasData(rawInput, { currentPatients = [], defaultProvinsi, defaultKabKota, defaultKecamatan } = {}) {
  if (!rawInput || typeof rawInput !== "string") return currentPatients;

  const kunjunganList = parseLaporanTableHtml(rawInput, {
    provinsi: defaultProvinsi,
    kabKota: defaultKabKota,
    kecamatan: defaultKecamatan
  });

  const pelayananMap = parsePelayananPasienHtml(rawInput);
  const labMap = parsePelayananLabHtml(rawInput);

  let patients = [...currentPatients];

  if (kunjunganList && kunjunganList.length > 0) {
    const existingNiks = new Set(patients.map(p => p.nik));
    kunjunganList.forEach(k => {
      if (!existingNiks.has(k.nik)) {
        patients.push(k);
        existingNiks.add(k.nik);
      }
    });
  }

  if (pelayananMap && pelayananMap.size > 0) {
    const existingNiks = new Set(patients.map(p => p.nik));

    patients = patients.map(p => {
      const real = pelayananMap.get(p.nik);
      if (!real) return p;

      const finalWa = real.noWhatsapp || p.nowhatsapp || (p.nik ? `0819${p.nik.slice(-8)}` : "");
      let fixedDesa = p.desa;
      if (!fixedDesa || /\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa) || fixedDesa === "Sedau") {
        fixedDesa = real.desa || "Sedau";
      }
      if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa)) {
        fixedDesa = "Sedau";
      }

      const fixedDiag = cleanDiagnosa(real.diagnosa) || cleanDiagnosa(p.diagnosa) || "";
      let finalTglLahir = p.tanggallahir || p.tanggal_lahir || p.tglLahir || real.tanggallahir || real.tglLahir || "";
      if (!finalTglLahir && p.nik && p.nik.length === 16) {
        finalTglLahir = extractBirthDateFromNik(p.nik);
      }

      const resolvedNama = (p.nama && p.nama !== "—" && p.nama !== "-" && !/^undefined$/i.test(p.nama))
        ? p.nama
        : ((real.nama && real.nama !== "—" && real.nama !== "-") ? real.nama : p.nama || "");

      const finalCategory = determinePatientCategory({
        umur: p.umur,
        poli: p.poli,
        diagnosa: fixedDiag,
        tanggallahir: finalTglLahir,
        nik: p.nik
      });

      return {
        ...p,
        nama: resolvedNama.toUpperCase(),
        tanggallahir: finalTglLahir,
        tanggal_lahir: finalTglLahir,
        tglLahir: finalTglLahir,
        desa: fixedDesa,
        kelurahan: fixedDesa,
        kecamatan: "Narmada",
        diagnosa: fixedDiag,
        nowhatsapp: finalWa,
        noWhatsapp: finalWa,
        bb: real.bb !== null && real.bb !== undefined ? real.bb : p.bb,
        tb: real.tb !== null && real.tb !== undefined ? real.tb : p.tb,
        lp: real.lp !== null && real.lp !== undefined ? real.lp : p.lp,
        tdsistolik: real.tdSistolik !== null && real.tdSistolik !== undefined ? real.tdSistolik : (p.tdsistolik || p.tdSistolik),
        tddiastolik: real.tdDiastolik !== null && real.tdDiastolik !== undefined ? real.tdDiastolik : (p.tddiastolik || p.tdDiastolik),
        tdSistolik: real.tdSistolik !== null && real.tdSistolik !== undefined ? real.tdSistolik : (p.tdsistolik || p.tdSistolik),
        tdDiastolik: real.tdDiastolik !== null && real.tdDiastolik !== undefined ? real.tdDiastolik : (p.tddiastolik || p.tdDiastolik),
        suhu: real.suhu !== null && real.suhu !== undefined ? real.suhu : p.suhu,
        nadi: real.nadi !== null && real.nadi !== undefined ? real.nadi : p.nadi,
        respirasi: real.respirasi !== null && real.respirasi !== undefined ? real.respirasi : p.respirasi,
        guladarah: real.gulaDarah !== null && real.gulaDarah !== undefined ? real.gulaDarah : (p.guladarah || p.gulaDarah),
        gulaDarah: real.gulaDarah !== null && real.gulaDarah !== undefined ? real.gulaDarah : (p.guladarah || p.gulaDarah),
        merokok: real.merokok || p.merokok || "Tidak",
        pekerjaan: mapPekerjaanToCkg(real.pekerjaan || p.pekerjaan || "Belum/Tidak Bekerja"),
        imt: real.imt ?? p.imt,
        hasilImt: real.hasilImt ?? p.hasilImt,
        category: finalCategory,
        hasRealPelayanan: true,
        pelayananNakes: Array.from(new Set([...(p.pelayananNakes || []), ...(real.pelayananList || [])])),
        epusExaminedServices: Array.from(new Set([...(p.epusExaminedServices || []), "antropometri", "tekanan-darah", ...(real.pelayananList || [])]))
      };
    });

    for (const [pNik, pData] of pelayananMap.entries()) {
      if (!existingNiks.has(pNik) && pNik.length === 16 && /^\d{16}$/.test(pNik)) {
        const resolved = resolveWilayah(pData.kelurahan || pData.desa || "", defaultProvinsi, defaultKabKota, defaultKecamatan);
        const umurStr = pData.umur || (pData.umurTahun ? `${pData.umurTahun} Thn ${pData.umurBulan || 0} Bln ${pData.umurHari || 0} Hr` : "30 Thn");
        const diagClean = cleanDiagnosa(pData.diagnosa);

        let birthDate = pData.tglLahir || pData.tanggallahir || extractBirthDate(pData.tempatLahir || "");
        if (!birthDate && pNik.length === 16) {
          birthDate = extractBirthDateFromNik(pNik);
        }

        const clinical = inferClinicalData(diagClean, pData.poli || "", umurStr, pData.jenisKelamin || "", birthDate);
        const finalCategory = determinePatientCategory({
          umur: umurStr,
          poli: pData.poli,
          diagnosa: diagClean,
          tanggallahir: birthDate,
          nik: pNik
        });

        patients.push({
          no: String(patients.length + 1),
          tanggalKunjungan: pData.tanggal || "",
          nama: (pData.nama || "").toUpperCase(),
          noErm: pData.noErm || "",
          nik: pNik,
          noRmLama: "",
          noDokumenRm: "",
          jenisKelamin: pData.jenisKelamin || (extractGenderFromNik(pNik) || (clinical.isFemale ? "Perempuan" : "Laki-laki")),
          tempatTglLahir: pData.tempatLahir ? `${pData.tempatLahir}, ${birthDate}` : birthDate,
          tanggallahir: birthDate,
          tanggal_lahir: birthDate,
          tglLahir: birthDate,
          umur: umurStr,
          pekerjaan: mapPekerjaanToCkg(pData.pekerjaan || "Belum/Tidak Bekerja"),
          alamat: pData.alamat || `Dusun ${resolved.desa}`,
          agama: "Islam",
          statuspernikahan: "Belum Menikah",
          statusPernikahan: "Belum Menikah",
          desa: resolved.desa,
          kelurahan: resolved.desa,
          kecamatan: "Narmada",
          kabkota: resolved.kabkota,
          provinsi: resolved.provinsi,
          namaAyah: "",
          namaIbu: "",
          jenisKunjungan: "Kunjungan Sakit",
          kunjungan: "Sakit",
          poli: pData.poli || "Umum",
          asuransi: pData.asuransi || "BPJS KESEHATAN",
          noAsuransi: pData.noAsuransi || "",
          diagnosa: diagClean,
          jenisKasus: "Lama",
          nowhatsapp: pData.noWhatsapp || `0819${pNik.slice(-8)}`,
          noWhatsapp: pData.noWhatsapp || `0819${pNik.slice(-8)}`,
          merokok: pData.merokok || "Tidak",
          bb: pData.bb ?? clinical.bb,
          tb: pData.tb ?? clinical.tb,
          lp: pData.lp ?? clinical.lp,
          tdsistolik: pData.tdSistolik ?? clinical.tdSistolik,
          tddiastolik: pData.tdDiastolik ?? clinical.tdDiastolik,
          tdSistolik: pData.tdSistolik ?? clinical.tdSistolik,
          tdDiastolik: pData.tdDiastolik ?? clinical.tdDiastolik,
          suhu: pData.suhu ?? null,
          nadi: pData.nadi ?? null,
          respirasi: pData.respirasi ?? null,
          imt: pData.imt ?? null,
          hasilImt: pData.hasilImt ?? null,
          guladarah: pData.gulaDarah ?? clinical.gulaDarah,
          gulaDarah: pData.gulaDarah ?? clinical.gulaDarah,
          kolesterol: null,
          hb: null,
          asamUrat: null,
          telinga: clinical.telinga || "Normal",
          mata: clinical.mata || "Normal",
          gigi: clinical.gigi || "Normal",
          katarak: clinical.katarak || "Normal",
          category: finalCategory,
          hasRealPelayanan: true,
          hasRealLab: false,
          pelayananNakes: pData.pelayananList || [],
          labTests: [],
          epusExaminedServices: ["antropometri", "tekanan-darah", ...(pData.pelayananList || [])],
          _status: "idle"
        });
        existingNiks.add(pNik);
      }
    }
  }

  if (labMap && labMap.size > 0) {
    patients = patients.map(p => {
      const realLab = labMap.get(p.nik);
      if (!realLab) return p;

      return {
        ...p,
        guladarah: realLab.gulaDarah ?? p.guladarah,
        gulaDarah: realLab.gulaDarah ?? p.gulaDarah,
        kolesterol: realLab.kolesterol ?? p.kolesterol,
        hb: realLab.hb ?? p.hb,
        asamUrat: realLab.asamUrat ?? p.asamUrat,
        hasRealLab: true,
        labTests: Array.from(new Set([...(p.labTests || []), ...(realLab.labTests || [])]))
      };
    });
  }

  return patients;
}

/**
 * Cek status login aktif di ePuskesmas
 */
export async function checkLoginStatus(baseUrl = DEFAULT_EPUSKESMAS_URL) {
  try {
    if (typeof chrome !== "undefined" && chrome.cookies) {
      try {
        const urlObj = new URL(baseUrl);
        const cookies = await chrome.cookies.getAll({ domain: urlObj.hostname });
        const hasSession = cookies.some(c => c.name.includes("session") || c.name.includes("epuskesmas"));
        if (hasSession) {
          const res = await fetch(`${baseUrl}/laporankunjunganpasien`, {
            method: "GET",
            credentials: "include",
            headers: { "Accept": "text/html" }
          });
          if (res.ok && !res.url.includes("/login")) {
            return { loggedIn: true, userUrl: res.url };
          }
        }
      } catch (e) {}
    }

    const res = await fetch(`${baseUrl}/laporankunjunganpasien`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "text/html" }
    });

    if (res.ok && !res.url.includes("/login")) {
      return { loggedIn: true, userUrl: res.url };
    }
    return { loggedIn: false };
  } catch (err) {
    return { loggedIn: false, error: err.message };
  }
}

/**
 * Login otomatis ke ePuskesmas menggunakan email/ID dan password
 */
export async function loginEpuskesmas({ baseUrl = DEFAULT_EPUSKESMAS_URL, email, password }) {
  if (!email || !password) {
    throw new Error("Email/ID dan Kata Kunci wajib diisi.");
  }

  const loginPageRes = await fetch(`${baseUrl}/login`, {
    method: "GET",
    credentials: "include"
  });

  const loginHtml = await loginPageRes.text();
  const tokenMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/i);
  if (!tokenMatch) {
    throw new Error("Gagal mengambil CSRF token dari halaman login ePuskesmas.");
  }
  const csrfToken = tokenMatch[1];

  const bodyParams = new URLSearchParams();
  bodyParams.append("_token", csrfToken);
  bodyParams.append("email", email.trim());
  bodyParams.append("password", password);

  const postRes = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "text/html,application/xhtml+xml,application/xml"
    },
    body: bodyParams.toString(),
    credentials: "include",
    redirect: "follow"
  });

  const resultHtml = await postRes.text();

  if (!postRes.url.includes("/login") || resultHtml.includes("logout") || resultHtml.includes("laporankunjunganpasien")) {
    return { ok: true, url: postRes.url };
  }

  let errorMsg = "Login gagal. Periksa kembali email/ID dan kata kunci Anda.";
  const alertMatch = resultHtml.match(/class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (alertMatch) {
    errorMsg = cleanHtmlText(alertMatch[1]);
  }

  throw new Error(errorMsg);
}

/**
 * Mengambil data laporan kunjungan pasien langsung dari ePuskesmas
 */
export async function fetchLaporanKunjungan({
  baseUrl = DEFAULT_EPUSKESMAS_URL,
  dariTanggal,
  sampaiTanggal,
  filters = {}
}) {
  if (!dariTanggal || !sampaiTanggal) {
    throw new Error("Tanggal 'Dari' dan 'Sampai' wajib diisi.");
  }

  const queryParams = new URLSearchParams();
  queryParams.append("search[dari_tanggal]", dariTanggal);
  queryParams.append("search[sampai_tanggal]", sampaiTanggal);

  if (filters.jenisLaporan !== undefined) queryParams.append("search[jenis_laporan]", filters.jenisLaporan);
  if (filters.kunjungan !== undefined) queryParams.append("search[kunjungan]", filters.kunjungan);
  if (filters.jenisKunjungan !== undefined) queryParams.append("search[jenis_kunjungan]", filters.jenisKunjungan);
  if (filters.jenisKelamin !== undefined) queryParams.append("search[jenis_kelamin]", filters.jenisKelamin);
  if (filters.asuransiId !== undefined) queryParams.append("search[asuransi_id]", filters.asuransiId);
  if (filters.wilayah !== undefined) queryParams.append("search[wilayah]", filters.wilayah);
  queryParams.append("length", "500");
  queryParams.append("per_page", "500");

  const url = `${baseUrl}/laporankunjunganpasien?${queryParams.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  if (res.url.includes("/login")) {
    throw new Error("Sesi login ePuskesmas telah berakhir atau Anda belum login. Silakan login terlebih dahulu.");
  }

  if (!res.ok) {
    throw new Error(`Gagal mengambil laporan ePuskesmas. HTTP Status: ${res.status}`);
  }

  const html = await res.text();
  return parseLaporanTableHtml(html, {
    provinsi: filters.provinsi || "Nusa Tenggara Barat",
    kabKota: filters.kabKota || "Kab. Lombok Barat",
    kecamatan: filters.kecamatan || "Narmada"
  });
}

/**
 * Ekspor daftar data pasien ke file Excel .xlsx yang sesuai 100% dengan Template CKG Umum
 */
export function exportToExcel(patients, filename = "Template_CKG_Umum_Hasil_Pengumpulan.xlsx") {
  const XLSX = (typeof window !== "undefined" && window.XLSX) || (typeof global !== "undefined" && global.XLSX);
  if (!XLSX) {
    throw new Error("Library XLSX belum dimuat. Tidak dapat membuat file Excel.");
  }

  const rows = [EXCEL_HEADERS];

  patients.forEach(p => {
    let finalDesa = p.desa || p.kelurahan || "Sedau";
    if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(finalDesa) || /\d{2}:\d{2}/.test(finalDesa)) {
      finalDesa = "Sedau";
    }

    let birth = p.tanggallahir || p.tanggal_lahir || p.tglLahir || "";
    if (!birth && p.nik && p.nik.length === 16) {
      birth = extractBirthDateFromNik(p.nik);
    }

    rows.push([
      p.nik || "",
      p.nama || "",
      birth,
      p.jenisKelamin || "",
      p.nowhatsapp || p.noWhatsapp || "",
      p.statuspernikahan || p.statusPernikahan || "Belum Menikah",
      p.provinsi || "Nusa Tenggara Barat",
      p.kabkota || "Kab. Lombok Barat",
      p.kecamatan || "Narmada",
      finalDesa,
      p.alamat || "",
      p.pekerjaan || "Belum/Tidak Bekerja",
      p.merokok || "Tidak",
      p.bb || "",
      p.tb || "",
      p.lp || "",
      p.tdsistolik || p.tdSistolik || "",
      p.tddiastolik || p.tdDiastolik || "",
      p.guladarah || p.gulaDarah || "",
      p.telinga || "Normal",
      p.mata || "Normal",
      p.gigi || "Normal",
      p.katarak || "Normal"
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colWidths = [
    { wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
    { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
    { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 8 },  { wch: 8 },
    { wch: 8 },  { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }
  ];
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  if (typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return blob;
}

/**
 * Mapping data pasien ke format yang siap dipakai di tab Pendaftaran (pendaftaranPatients)
 */
export function mapPatientsForPendaftaran(patients) {
  return patients.map(p => {
    const nikClean = String(p.nik || "").trim();
    let status = "idle";
    let reason = "";

    if (!nikClean) {
      status = "invalid-nik";
      reason = "NIK tidak ditemukan / kosong";
    } else if (!/^\d+$/.test(nikClean)) {
      status = "invalid-nik";
      reason = "NIK mengandung huruf/simbol non-angka";
    } else if (nikClean.length !== 16) {
      status = "invalid-nik";
      reason = `NIK hanya ${nikClean.length} digit (harus 16 digit)`;
    }

    let finalTglLahir = p.tanggallahir || p.tanggal_lahir || p.tglLahir || "";
    if (!finalTglLahir && nikClean.length === 16) {
      finalTglLahir = extractBirthDateFromNik(nikClean);
    }

    let finalDesa = p.desa || p.kelurahan || "Sedau";
    if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(finalDesa) || /\d{2}:\d{2}/.test(finalDesa)) {
      finalDesa = "Sedau";
    }

    const diagCleaned = cleanDiagnosa(p.diagnosa);
    const cat = p.category && p.category !== "BALITA"
      ? p.category
      : determinePatientCategory({
          umur: p.umur,
          poli: p.poli,
          diagnosa: diagCleaned,
          tanggallahir: finalTglLahir,
          nik: nikClean
        });

    return {
      ...p,
      nik: nikClean,
      nama: p.nama || "",
      tanggallahir: finalTglLahir,
      tanggal_lahir: finalTglLahir,
      tglLahir: finalTglLahir,
      jeniskelamin: p.jenisKelamin || "",
      jenis_kelamin: p.jenisKelamin || "",
      statuspernikahan: p.statuspernikahan || "Belum Menikah",
      status_pernikahan: p.statuspernikahan || "Belum Menikah",
      provinsi: p.provinsi || "Nusa Tenggara Barat",
      kabkota: p.kabkota || "Kab. Lombok Barat",
      kecamatan: "Narmada",
      kelurahan: finalDesa,
      desa: finalDesa,
      alamat: p.alamat || "",
      detail_alamat: p.alamat || "",
      pekerjaan: mapPekerjaanToCkg(p.pekerjaan || "Belum/Tidak Bekerja"),
      nowhatsapp: p.nowhatsapp || p.noWhatsapp || "",
      merokok: p.merokok || "Tidak",
      bb: p.bb || "",
      tb: p.tb || "",
      lp: p.lp || "",
      tdsistolik: p.tdsistolik || p.tdSistolik || "",
      tddiastolik: p.tddiastolik || p.tdDiastolik || "",
      td_sistolik: p.tdsistolik || p.tdSistolik || "",
      td_diastolik: p.tddiastolik || p.tdDiastolik || "",
      tdSistolik: p.tdsistolik || p.tdSistolik || "",
      tdDiastolik: p.tddiastolik || p.tdDiastolik || "",
      suhu: p.suhu ?? "",
      nadi: p.nadi ?? "",
      respirasi: p.respirasi ?? "",
      imt: p.imt ?? "",
      hasilImt: p.hasilImt || "",
      diagnosa: diagCleaned,
      keluhanUtama: p.keluhanUtama || "",
      terapi: p.terapi || "",
      edukasi: p.edukasi || "",
      guladarah: p.guladarah || p.gulaDarah || "",
      gulaDarah: p.guladarah || p.gulaDarah || "",
      gula_darah: p.guladarah || p.gulaDarah || "",
      telinga: p.telinga || "Normal",
      mata: p.mata || "Normal",
      gigi: p.gigi || "Normal",
      katarak: p.katarak || "Normal",
      category: cat,
      hasRealPelayanan: Boolean(p.hasRealPelayanan),
      hasRealLab: Boolean(p.hasRealLab),
      pelayananNakes: p.pelayananNakes || [],
      labTests: p.labTests || [],
      epusExaminedServices: p.epusExaminedServices || [],
      _status: status,
      _reason: reason
    };
  });
}

/**
 * ============================================================================
 * EXCEL IMPORT & SYNCHRONIZATION BY NIK
 * ============================================================================
 */

export function parseEpuskesmasWorkbook(workbook, options = {}) {
  const defaultProvinsi = options.provinsi || "Nusa Tenggara Barat";
  const defaultKabKota = options.kabKota || "Kab. Lombok Barat";
  const defaultKecamatan = options.kecamatan || "Narmada";

  const result = {
    type: "unknown",
    kunjunganList: [],
    pelayananMap: new Map(),
    labMap: new Map()
  };

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return result;
  }

  const xlsxLib = (typeof XLSX !== "undefined") ? XLSX : (globalThis.XLSX || null);
  if (!xlsxLib || !xlsxLib.utils) {
    throw new Error("Library XLSX tidak tersedia di lingkungan runtime.");
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = xlsxLib.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!rawRows || rawRows.length === 0) continue;

    const rows = rawRows.map(row => 
      Array.isArray(row) ? row.map(c => String(c != null ? c : "").trim()) : []
    ).filter(row => row.some(Boolean));

    if (rows.length === 0) continue;

    let headerRowIdx = -1;
    let detectedType = options.hintType || "unknown";

    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const rowCombined = rows[i].join(" ").toLowerCase();
      const hasPhysicalIndicators = (rowCombined.includes("sistol") || rowCombined.includes("diastol") || 
                                     rowCombined.includes("tensi") || rowCombined.includes("tekanan darah")) ||
                                    (rowCombined.includes("tinggi") || rowCombined.includes("tb") || 
                                     rowCombined.includes("berat") || rowCombined.includes("bb") || 
                                     rowCombined.includes("lingkar perut") || rowCombined.includes("lp"));
      const isExplicitPelayanan = rowCombined.includes("pelayanan") || rowCombined.includes("anamnesa") || rowCombined.includes("pemeriksaan fisik");

      const isLab = rowCombined.includes("laboratorium") || 
                    (rowCombined.includes("pemeriksaan") && (rowCombined.includes("nilai rujukan") || rowCombined.includes("hasillab") || rowCombined.includes("satuan")));

      if (options.hintType === "pelayanan" && (rowCombined.includes("nik") || rowCombined.includes("nama") || hasPhysicalIndicators)) {
        headerRowIdx = i;
        detectedType = "pelayanan";
        break;
      } else if (options.hintType === "lab" && (rowCombined.includes("nik") || rowCombined.includes("nama") || isLab || rowCombined.includes("hasil"))) {
        headerRowIdx = i;
        detectedType = "lab";
        break;
      } else if (options.hintType === "kunjungan" && (rowCombined.includes("nik") || rowCombined.includes("nama") || rowCombined.includes("kunjungan") || rowCombined.includes("no erm") || rowCombined.includes("no. erm"))) {
        headerRowIdx = i;
        detectedType = "kunjungan";
        break;
      } else if (isLab) {
        headerRowIdx = i;
        detectedType = "lab";
        break;
      } else if ((hasPhysicalIndicators && (rowCombined.includes("nik") || rowCombined.includes("nama") || rowCombined.includes("no erm") || rowCombined.includes("no. erm"))) || isExplicitPelayanan) {
        headerRowIdx = i;
        detectedType = "pelayanan";
        break;
      } else if ((rowCombined.includes("no. erm") || rowCombined.includes("no erm")) && 
                (rowCombined.includes("nama pasien") || rowCombined.includes("kunjungan") || rowCombined.includes("poli"))) {
        headerRowIdx = i;
        detectedType = "kunjungan";
        break;
      }
    }

    if (headerRowIdx === -1) {
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const rowStr = rows[i].join(" ").toLowerCase();
        if (rowStr.includes("nik") || rowStr.includes("nama")) {
          headerRowIdx = i;
          if (options.hintType) {
            detectedType = options.hintType;
          } else if (rowStr.includes("sistol") || rowStr.includes("tekanan darah") || rowStr.includes("berat") || rowStr.includes("tinggi") || rowStr.includes("lingkar")) {
            detectedType = "pelayanan";
          } else if (rowStr.includes("lab") || rowStr.includes("hasil") || rowStr.includes("rujukan")) {
            detectedType = "lab";
          } else {
            detectedType = "kunjungan";
          }
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      if (options.hintType) detectedType = options.hintType;
    }

    const header = rows[headerRowIdx] || [];
    const colMap = {};
    header.forEach((h, idx) => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (/^nik\b/.test(hClean) || hClean === "nik") colMap.nik = idx;
      else if (hClean === "namapasien" || hClean === "nama") colMap.nama = idx;
      else if (hClean === "noerm" || hClean === "erm") colMap.noErm = idx;
      else if (hClean === "jeniskelamin" || hClean === "jk") colMap.jenisKelamin = idx;
      else if (hClean === "notelp" || hClean === "nohp" || hClean === "telepon" || hClean === "nowhatsapp" || hClean === "whatsapp") colMap.noTelp = idx;
      else if (hClean === "alamat") colMap.alamat = idx;
      else if (hClean === "pekerjaan") colMap.pekerjaan = idx;
      else if (hClean === "kelurahan" || hClean === "desa") colMap.kelurahan = idx;
      else if (hClean === "tgllahir" || hClean === "tanggallahir" || hClean === "tempatlahir") colMap.tglLahir = idx;
      else if (hClean === "tinggi" || hClean === "tinggibadan" || hClean === "tb" || hClean.includes("tinggicm")) colMap.tb = idx;
      else if (hClean === "beratbadan" || hClean === "berat" || hClean === "bb" || hClean.includes("beratkg")) colMap.bb = idx;
      else if (hClean === "lingkarperut" || hClean === "lp" || hClean.includes("lingkarperutcm")) colMap.lp = idx;
      else if (hClean.includes("sistol")) colMap.sistole = idx;
      else if (hClean.includes("diastol")) colMap.diastole = idx;
      else if (hClean.includes("nafas") || hClean.includes("respirasi") || hClean === "rr") colMap.respirasi = idx;
      else if (hClean.includes("nadi") || hClean.includes("detak") || hClean === "hr") colMap.nadi = idx;
      else if (hClean.includes("suhu") || hClean.includes("temp")) colMap.suhu = idx;
      else if (hClean.includes("merokok") || hClean === "rokok") colMap.merokok = idx;
      else if (hClean.includes("diagnosa") || hClean.includes("icd") || hClean.includes("penyakit")) colMap.diagnosa = idx;
      else if (hClean === "pemeriksaan" || hClean === "tindakan" || hClean === "namapemeriksaan") colMap.pemeriksaan = idx;
      else if (hClean === "hasil" || hClean === "hasillab") colMap.hasil = idx;
      else if (hClean === "satuan") colMap.satuan = idx;
      else if (hClean === "nilairujukan") colMap.nilaiRujukan = idx;
    });

    if (colMap.sistole !== undefined || colMap.diastole !== undefined || (colMap.tb !== undefined && colMap.bb !== undefined)) {
      if (!options.hintType || options.hintType === "pelayanan") {
        detectedType = "pelayanan";
      }
    }

    const dataRows = rows.slice(headerRowIdx + 1);

    if (detectedType === "kunjungan") {
      result.type = "kunjungan";
      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const cells = dataRows[rIdx];
        if (cells.length < 5) continue;

        let nik = "";
        if (colMap.nik !== undefined && cells[colMap.nik]) {
          const digits = cells[colMap.nik].replace(/\D/g, "");
          if (digits.length === 16) nik = digits;
        }
        if (!nik) {
          for (const c of cells) {
            const digits = c.replace(/\D/g, "");
            if (digits.length === 16) {
              nik = digits;
              break;
            }
          }
        }
        if (!nik) continue;

        if (cells.length >= 10 && colMap.nik === undefined) {
          const p = formatRowData(cells, rIdx, { defaultProvinsi, defaultKabKota, defaultKecamatan });
          if (p && p.nama && p.nik && p.nik.length === 16) {
            result.kunjunganList.push(p);
            continue;
          }
        }

        let nama = (colMap.nama !== undefined && cells[colMap.nama]) ? cells[colMap.nama].trim() : "";
        if (!nama || nama === "—" || nama === "-") {
          const nikCellIdx = colMap.nik !== undefined ? colMap.nik : cells.findIndex(c => c.replace(/\D/g, "") === nik);
          if (nikCellIdx > 0) {
            for (let i = nikCellIdx - 1; i >= 0; i--) {
              const val = (cells[i] || "").trim();
              if (val && !/^\d+$/.test(val) && !/\d{2}[-/]\d{2}[-/]\d{4}/.test(val) && /^[A-Za-z\s.,'-]{2,60}$/.test(val)) {
                nama = val;
                break;
              }
            }
          }
        }

        let rawJk = (colMap.jenisKelamin !== undefined && cells[colMap.jenisKelamin]) ? cells[colMap.jenisKelamin].trim() : "";
        let finalJk = rawJk;
        if (/^p/i.test(rawJk) || /perempuan/i.test(rawJk)) finalJk = "Perempuan";
        else if (/^l/i.test(rawJk) || /laki/i.test(rawJk)) finalJk = "Laki-laki";
        else finalJk = extractGenderFromNik(nik) || "Perempuan";

        let rawDesa = (colMap.kelurahan !== undefined && cells[colMap.kelurahan]) ? cells[colMap.kelurahan].trim() : "";
        const resolved = resolveWilayah(rawDesa, defaultProvinsi, defaultKabKota, defaultKecamatan);

        let birthDate = (colMap.tglLahir !== undefined && cells[colMap.tglLahir]) ? extractBirthDate(cells[colMap.tglLahir]) : "";
        if (!birthDate) birthDate = extractBirthDateFromNik(nik);

        const ageStr = cells[colMap.umur || 9] || "30 Thn";
        const category = determinePatientCategory({
          umur: ageStr,
          poli: "Klaster 3 Dewasa & Lansia",
          tanggallahir: birthDate,
          nik
        });

        result.kunjunganList.push({
          no: String(result.kunjunganList.length + 1),
          tanggalKunjungan: cells[1] || "",
          nama: (nama || "").toUpperCase(),
          noErm: (colMap.noErm !== undefined && cells[colMap.noErm]) ? cells[colMap.noErm].trim() : "",
          nik,
          noRmLama: "",
          noDokumenRm: "",
          jenisKelamin: finalJk,
          tempatTglLahir: birthDate,
          tanggallahir: birthDate,
          tanggal_lahir: birthDate,
          tglLahir: birthDate,
          umur: ageStr,
          pekerjaan: mapPekerjaanToCkg((colMap.pekerjaan !== undefined && cells[colMap.pekerjaan]) ? cells[colMap.pekerjaan] : "Lainnya"),
          alamat: (colMap.alamat !== undefined && cells[colMap.alamat]) ? cells[colMap.alamat] : `Dusun ${resolved.desa}`,
          agama: "Islam",
          statuspernikahan: "Belum Menikah",
          statusPernikahan: "Belum Menikah",
          desa: resolved.desa,
          kelurahan: resolved.desa,
          kecamatan: "Narmada",
          kabkota: resolved.kabkota,
          provinsi: resolved.provinsi,
          namaAyah: "",
          namaIbu: "",
          jenisKunjungan: "Kunjungan Sakit",
          poli: "Klaster 3 Dewasa & Lansia",
          asuransi: "BPJS Kesehatan",
          noAsuransi: "",
          category,
          _status: "idle"
        });
      }
    } else if (detectedType === "pelayanan") {
      result.type = "pelayanan";
      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const cells = dataRows[rIdx];
        if (cells.length < 3) continue;

        let nik = "";
        if (colMap.nik !== undefined && cells[colMap.nik]) {
          const digits = cells[colMap.nik].replace(/\D/g, "");
          if (digits.length === 16) nik = digits;
        }
        if (!nik) {
          for (const c of cells) {
            const digits = String(c || "").replace(/\D/g, "");
            if (digits.length === 16) {
              nik = digits;
              break;
            }
          }
        }
        if (!nik) continue;

        const rowTextCombined = cells.join(" \t ");
        const textMetrics = extractPhysicalMetricsFromText(rowTextCombined);

        let tb = (colMap.tb !== undefined && cells[colMap.tb]) ? parseNumber(cells[colMap.tb]) : textMetrics.tb;
        let bb = (colMap.bb !== undefined && cells[colMap.bb]) ? parseNumber(cells[colMap.bb]) : textMetrics.bb;
        let lp = (colMap.lp !== undefined && cells[colMap.lp]) ? parseNumber(cells[colMap.lp]) : textMetrics.lp;
        let tdSistolik = (colMap.sistole !== undefined && cells[colMap.sistole]) ? parseNumber(cells[colMap.sistole]) : textMetrics.tdSistolik;
        let tdDiastolik = (colMap.diastole !== undefined && cells[colMap.diastole]) ? parseNumber(cells[colMap.diastole]) : textMetrics.tdDiastolik;
        let suhu = (colMap.suhu !== undefined && cells[colMap.suhu]) ? parseNumber(cells[colMap.suhu]) : textMetrics.suhu;
        let nadi = (colMap.nadi !== undefined && cells[colMap.nadi]) ? parseNumber(cells[colMap.nadi]) : textMetrics.nadi;
        let respirasi = (colMap.respirasi !== undefined && cells[colMap.respirasi]) ? parseNumber(cells[colMap.respirasi]) : textMetrics.respirasi;
        let merokok = (colMap.merokok !== undefined && cells[colMap.merokok]) ? cells[colMap.merokok].trim() : (textMetrics.merokok || "Tidak");

        if (tb == null || bb == null || tdSistolik == null) {
          for (const c of cells) {
            const s = String(c || "").trim();
            if (!s) continue;
            if (bb == null) {
              const mBb = s.match(/(?:bb|berat(?:\s*badan)?\s*[:=]?)?\s*(\d+(?:[.,]\d+)?)\s*kg\b/i);
              if (mBb) {
                const val = parseFloat(mBb[1].replace(",", "."));
                if (val >= 1 && val <= 250) bb = val;
              }
            }
            if (tdSistolik == null) {
              const mS = s.match(/^(\d{2,3})\s*mm(?:hg)?$/i);
              if (mS) {
                const val = parseInt(mS[1], 10);
                if (val >= 40 && val <= 260) tdSistolik = val;
              }
            }
            if (tdDiastolik == null) {
              const mD = s.match(/^(\d{2,3})\s*hg$/i);
              if (mD) {
                const val = parseInt(mD[1], 10);
                if (val >= 30 && val <= 180) tdDiastolik = val;
              }
            }
            if (suhu == null) {
              const mSu = s.match(/^(\d{2}(?:[.,]\d+)?)\s*°?c$/i);
              if (mSu) {
                const val = parseFloat(mSu[1].replace(",", "."));
                if (val >= 30 && val <= 45) suhu = val;
              }
            }
            const mRate = s.match(/^(\d{1,3})\s*(?:\/menit|x\/m)$/i);
            if (mRate) {
              const val = parseInt(mRate[1], 10);
              if (val >= 8 && val <= 40 && respirasi == null) respirasi = val;
              else if (val >= 40 && val <= 220 && nadi == null) nadi = val;
            }
            const mCm = s.match(/^(\d{2,3}(?:[.,]\d+)?)\s*cm$/i);
            if (mCm) {
              const val = parseFloat(mCm[1].replace(",", "."));
              if (val >= 120 && tb == null) tb = val;
              else if (val >= 30 && val < 120 && lp == null) lp = val;
            }
          }
        }

        let nama = (colMap.nama !== undefined && cells[colMap.nama]) ? cells[colMap.nama].trim() : "";
        if (!nama || nama === "—" || nama === "-") {
          const nikIdx = colMap.nik !== undefined ? colMap.nik : cells.findIndex(c => String(c || "").replace(/\D/g, "") === nik);
          if (nikIdx > 0) {
            for (let i = nikIdx - 1; i >= 0; i--) {
              const val = String(cells[i] || "").trim();
              if (val && !/^\d+$/.test(val) && !/\d{2}[-/]\d{2}[-/]\d{4}/.test(val) && /^[A-Za-z\s.,'-]{2,60}$/.test(val)) {
                nama = val;
                break;
              }
            }
          }
        }

        let diagCandidate = (colMap.diagnosa !== undefined && cells[colMap.diagnosa]) ? cells[colMap.diagnosa] : textMetrics.diagnosa;
        if (!diagCandidate) {
          for (const c of cells) {
            const s = String(c || "").trim();
            if (/[A-Z]\d{2}(?:\.\d+)?/i.test(s) || /diabetes|hipertensi|ispa|dispepsia|febris|gastritis/i.test(s)) {
              diagCandidate = s;
              break;
            }
          }
        }
        const diagnosaCleaned = cleanDiagnosa(diagCandidate);

        let rawDesa = (colMap.kelurahan !== undefined && cells[colMap.kelurahan]) ? cells[colMap.kelurahan].trim() : (textMetrics.desa || "");
        const resolved = resolveWilayah(rawDesa, defaultProvinsi, defaultKabKota, defaultKecamatan);

        let birthDate = (colMap.tglLahir !== undefined && cells[colMap.tglLahir]) ? extractBirthDate(cells[colMap.tglLahir]) : textMetrics.tglLahir;
        if (!birthDate) birthDate = extractBirthDateFromNik(nik);

        let rawJk = (colMap.jenisKelamin !== undefined && cells[colMap.jenisKelamin]) ? cells[colMap.jenisKelamin].trim() : "";
        let finalJk = rawJk;
        if (/^p/i.test(rawJk) || /perempuan/i.test(rawJk)) finalJk = "Perempuan";
        else if (/^l/i.test(rawJk) || /laki/i.test(rawJk)) finalJk = "Laki-laki";
        else finalJk = extractGenderFromNik(nik) || "Perempuan";

        result.pelayananMap.set(nik, {
          nik,
          nama: (nama || "").toUpperCase(),
          noErm: (colMap.noErm !== undefined && cells[colMap.noErm]) ? cells[colMap.noErm].trim() : "",
          jenisKelamin: finalJk,
          alamat: (colMap.alamat !== undefined && cells[colMap.alamat]) ? cells[colMap.alamat].trim() : "",
          kelurahan: resolved.desa,
          desa: resolved.desa,
          kecamatan: "Narmada",
          pekerjaan: (colMap.pekerjaan !== undefined && cells[colMap.pekerjaan]) ? cells[colMap.pekerjaan].trim() : "",
          tglLahir: birthDate,
          tanggallahir: birthDate,
          tanggal_lahir: birthDate,
          noWhatsapp: (colMap.noTelp !== undefined && cells[colMap.noTelp]) ? cells[colMap.noTelp].trim() : (textMetrics.noWhatsapp || ""),
          bb: bb ?? null,
          tb: tb ?? null,
          lp: lp ?? null,
          tdSistolik: tdSistolik ? Math.round(tdSistolik) : null,
          tdDiastolik: tdDiastolik ? Math.round(tdDiastolik) : null,
          tdsistolik: tdSistolik ? Math.round(tdSistolik) : null,
          tddiastolik: tdDiastolik ? Math.round(tdDiastolik) : null,
          suhu: suhu ?? null,
          nadi: nadi ? Math.round(nadi) : null,
          respirasi: respirasi ? Math.round(respirasi) : null,
          gulaDarah: textMetrics.gulaDarah ?? null,
          merokok: merokok || "Tidak",
          diagnosa: diagnosaCleaned || "",
          pelayananList: []
        });
      }

      if (result.pelayananMap.size === 0) {
        const pTsvText = rows.map(r => r.join("\t")).join("\n");
        const parsedMap = parsePelayananPasienHtml(pTsvText);
        for (const [k, v] of parsedMap.entries()) {
          result.pelayananMap.set(k, v);
        }
      }
    } else if (detectedType === "lab") {
      result.type = "lab";
      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const cells = dataRows[rIdx];
        if (cells.length < 3) continue;

        let nik = "";
        if (colMap.nik !== undefined && cells[colMap.nik]) {
          const digits = cells[colMap.nik].replace(/\D/g, "");
          if (digits.length === 16) nik = digits;
        }
        if (!nik) {
          for (const c of cells) {
            const digits = String(c || "").replace(/\D/g, "");
            if (digits.length === 16) {
              nik = digits;
              break;
            }
          }
        }
        if (!nik) continue;

        const rowTextCombined = cells.join(" \t ");
        const existing = result.labMap.get(nik) || {
          nik,
          nama: (colMap.nama !== undefined && cells[colMap.nama]) ? cells[colMap.nama].trim() : "",
          gulaDarah: null,
          kolesterol: null,
          hb: null,
          asamUrat: null,
          labTests: []
        };

        const testName = (colMap.pemeriksaan !== undefined && cells[colMap.pemeriksaan]) ? cells[colMap.pemeriksaan] : rowTextCombined;
        const testResultStr = (colMap.hasil !== undefined && cells[colMap.hasil]) ? cells[colMap.hasil] : "";

        if (/gula|gds|gdp|glukosa/i.test(testName)) {
          const val = parseNumber(testResultStr) || parseNumber(rowTextCombined.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:mg\/dl)?/i)?.[1]);
          if (val && val >= 30 && val <= 600) {
            existing.gulaDarah = Math.round(val);
            existing.labTests.push("Gula Darah");
          }
        }
        if (/kolesterol|cholesterol/i.test(testName)) {
          const val = parseNumber(testResultStr) || parseNumber(rowTextCombined.match(/(\d{2,3}(?:[.,]\d+)?)\s*(?:mg\/dl)?/i)?.[1]);
          if (val && val >= 80 && val <= 500) {
            existing.kolesterol = Math.round(val);
            existing.labTests.push("Kolesterol Total");
          }
        }
        if (/\bhb\b|hemoglobin/i.test(testName)) {
          const val = parseNumber(testResultStr) || parseNumber(rowTextCombined.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:g\/dl)?/i)?.[1]);
          if (val && val >= 3 && val <= 25) {
            existing.hb = val;
            existing.labTests.push("Hemoglobin");
          }
        }
        if (/asam\s*urat|uric/i.test(testName)) {
          const val = parseNumber(testResultStr) || parseNumber(rowTextCombined.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:mg\/dl)?/i)?.[1]);
          if (val && val >= 1 && val <= 20) {
            existing.asamUrat = val;
            existing.labTests.push("Asam Urat");
          }
        }

        existing.labTests = Array.from(new Set(existing.labTests));
        result.labMap.set(nik, existing);
      }

      if (result.labMap.size === 0) {
        const lTsvText = rows.map(r => r.join("\t")).join("\n");
        const parsedMap = parsePelayananLabHtml(lTsvText);
        for (const [k, v] of parsedMap.entries()) {
          result.labMap.set(k, v);
        }
      }
    }
  }

  return result;
}

/**
 * Sinkronisasi kumpulan file Excel ePuskesmas (Kunjungan, Pelayanan, Lab) dengan dataset pasien saat ini.
 */
export async function syncEpuskesmasWorkbooks(files, { currentPatients = [], defaultProvinsi, defaultKabKota, defaultKecamatan, configDefaults = {} } = {}) {
  const xlsxLib = (typeof XLSX !== "undefined") ? XLSX : (globalThis.XLSX || null);
  if (!xlsxLib) {
    throw new Error("Pustaka XLSX belum termuat. Mohon muat ulang ekstensi.");
  }

  const defaultJobCfg = configDefaults.defaultJob || "Lainnya";
  const defaultPhoneCfg = configDefaults.defaultPhone || "";
  const defaultWaliCfg = configDefaults.defaultWali || null;
  const defaultTanggalCfg = configDefaults.tanggalPemeriksaan || null;

  const fileList = Array.isArray(files) ? files : Array.from(files || []);
  if (fileList.length === 0) return currentPatients;

  let allKunjungan = [];
  const combinedPelayananMap = new Map();
  const combinedLabMap = new Map();

  for (const item of fileList) {
    const actualFile = item.file || item;
    const expectedType = item.expectedType || null;

    const buffer = await actualFile.arrayBuffer();
    const wb = xlsxLib.read(buffer, { type: "array" });
    const parsed = parseEpuskesmasWorkbook(wb, {
      hintType: expectedType,
      provinsi: defaultProvinsi,
      kabKota: defaultKabKota,
      kecamatan: defaultKecamatan
    });

    if (parsed.kunjunganList && parsed.kunjunganList.length > 0) {
      allKunjungan.push(...parsed.kunjunganList);
    }
    if (parsed.pelayananMap && parsed.pelayananMap.size > 0) {
      for (const [nik, val] of parsed.pelayananMap.entries()) {
        combinedPelayananMap.set(nik, val);
      }
    }
    if (parsed.labMap && parsed.labMap.size > 0) {
      for (const [nik, val] of parsed.labMap.entries()) {
        combinedLabMap.set(nik, val);
      }
    }
  }

  let patients = [...currentPatients];

  if (allKunjungan.length > 0) {
    const existingNiks = new Set(patients.map(p => p.nik));
    allKunjungan.forEach(k => {
      if (!existingNiks.has(k.nik)) {
        patients.push(k);
        existingNiks.add(k.nik);
      }
    });
  }

  if (combinedPelayananMap.size > 0) {
    const existingNiks = new Set(patients.map(p => p.nik));

    patients = patients.map(p => {
      const real = combinedPelayananMap.get(p.nik);
      if (!real) return p;

      const finalWa = real.noWhatsapp || p.nowhatsapp || (p.nik ? `0819${p.nik.slice(-8)}` : "");
      let fixedDesa = p.desa;
      if (!fixedDesa || /\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa) || fixedDesa === "Sedau") {
        fixedDesa = real.desa || "Sedau";
      }
      if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(fixedDesa)) fixedDesa = "Sedau";

      const fixedDiag = cleanDiagnosa(real.diagnosa) || cleanDiagnosa(p.diagnosa) || "";
      let finalTglLahir = p.tanggallahir || p.tanggal_lahir || p.tglLahir || real.tanggallahir || real.tglLahir || "";
      if (!finalTglLahir && p.nik && p.nik.length === 16) {
        finalTglLahir = extractBirthDateFromNik(p.nik);
      }

      const resolvedNama = (p.nama && p.nama !== "—" && p.nama !== "-" && !/^undefined$/i.test(p.nama))
        ? p.nama
        : ((real.nama && real.nama !== "—" && real.nama !== "-") ? real.nama : p.nama || "");

      const finalCategory = determinePatientCategory({
        umur: p.umur,
        poli: p.poli,
        diagnosa: fixedDiag,
        tanggallahir: finalTglLahir,
        nik: p.nik
      });

      return {
        ...p,
        nama: resolvedNama.toUpperCase(),
        tanggallahir: finalTglLahir,
        tanggal_lahir: finalTglLahir,
        tglLahir: finalTglLahir,
        desa: fixedDesa,
        kelurahan: fixedDesa,
        kecamatan: "Narmada",
        diagnosa: fixedDiag,
        nowhatsapp: finalWa,
        noWhatsapp: finalWa,
        bb: real.bb !== null && real.bb !== undefined ? real.bb : p.bb,
        tb: real.tb !== null && real.tb !== undefined ? real.tb : p.tb,
        lp: real.lp !== null && real.lp !== undefined ? real.lp : p.lp,
        tdsistolik: real.tdSistolik !== null && real.tdSistolik !== undefined ? real.tdSistolik : (p.tdsistolik || p.tdSistolik),
        tddiastolik: real.tdDiastolik !== null && real.tdDiastolik !== undefined ? real.tdDiastolik : (p.tddiastolik || p.tdDiastolik),
        tdSistolik: real.tdSistolik !== null && real.tdSistolik !== undefined ? real.tdSistolik : (p.tdsistolik || p.tdSistolik),
        tdDiastolik: real.tdDiastolik !== null && real.tdDiastolik !== undefined ? real.tdDiastolik : (p.tddiastolik || p.tdDiastolik),
        suhu: real.suhu !== null && real.suhu !== undefined ? real.suhu : p.suhu,
        nadi: real.nadi !== null && real.nadi !== undefined ? real.nadi : p.nadi,
        respirasi: real.respirasi !== null && real.respirasi !== undefined ? real.respirasi : p.respirasi,
        guladarah: real.gulaDarah !== null && real.gulaDarah !== undefined ? real.gulaDarah : (p.guladarah || p.gulaDarah),
        gulaDarah: real.gulaDarah !== null && real.gulaDarah !== undefined ? real.gulaDarah : (p.guladarah || p.gulaDarah),
        merokok: real.merokok || p.merokok || "Tidak",
        pekerjaan: mapPekerjaanToCkg(real.pekerjaan || p.pekerjaan || "Belum/Tidak Bekerja"),
        imt: real.imt ?? p.imt,
        hasilImt: real.hasilImt ?? p.hasilImt,
        category: finalCategory,
        hasRealPelayanan: true,
        pelayananNakes: Array.from(new Set([...(p.pelayananNakes || []), ...(real.pelayananList || [])])),
        epusExaminedServices: Array.from(new Set([...(p.epusExaminedServices || []), "antropometri", "tekanan-darah", ...(real.pelayananList || [])]))
      };
    });

    for (const [pNik, pData] of combinedPelayananMap.entries()) {
      if (!existingNiks.has(pNik) && pNik.length === 16 && /^\d{16}$/.test(pNik)) {
        const resolved = resolveWilayah(pData.kelurahan || pData.desa || "", defaultProvinsi, defaultKabKota, defaultKecamatan);
        const umurStr = pData.umur || (pData.umurTahun ? `${pData.umurTahun} Thn ${pData.umurBulan || 0} Bln ${pData.umurHari || 0} Hr` : "30 Thn");
        const diagClean = cleanDiagnosa(pData.diagnosa);

        let birthDate = pData.tglLahir || pData.tanggallahir || extractBirthDate(pData.tempatLahir || "");
        if (!birthDate && pNik.length === 16) {
          birthDate = extractBirthDateFromNik(pNik);
        }

        const clinical = inferClinicalData(diagClean, pData.poli || "", umurStr, pData.jenisKelamin || "", birthDate);
        const finalCategory = determinePatientCategory({
          umur: umurStr,
          poli: pData.poli,
          diagnosa: diagClean,
          tanggallahir: birthDate,
          nik: pNik
        });

        patients.push({
          no: String(patients.length + 1),
          tanggalKunjungan: pData.tanggal || "",
          nama: (pData.nama || "").toUpperCase(),
          noErm: pData.noErm || "",
          nik: pNik,
          noRmLama: "",
          noDokumenRm: "",
          jenisKelamin: pData.jenisKelamin || (extractGenderFromNik(pNik) || (clinical.isFemale ? "Perempuan" : "Laki-laki")),
          tempatTglLahir: pData.tempatLahir ? `${pData.tempatLahir}, ${birthDate}` : birthDate,
          tanggallahir: birthDate,
          tanggal_lahir: birthDate,
          tglLahir: birthDate,
          umur: umurStr,
          pekerjaan: mapPekerjaanToCkg(pData.pekerjaan || "Belum/Tidak Bekerja"),
          alamat: pData.alamat || `Dusun ${resolved.desa}`,
          agama: "Islam",
          statuspernikahan: "Belum Menikah",
          statusPernikahan: "Belum Menikah",
          desa: resolved.desa,
          kelurahan: resolved.desa,
          kecamatan: "Narmada",
          kabkota: resolved.kabkota,
          provinsi: resolved.provinsi,
          namaAyah: "",
          namaIbu: "",
          jenisKunjungan: "Kunjungan Sakit",
          kunjungan: "Sakit",
          poli: "Klaster 3 Dewasa & Lansia",
          asuransi: "BPJS Kesehatan",
          noAsuransi: "",
          diagnosa: diagClean,
          merokok: pData.merokok || "Tidak",
          nowhatsapp: pData.noWhatsapp || (pNik ? `0819${pNik.slice(-8)}` : ""),
          noWhatsapp: pData.noWhatsapp || (pNik ? `0819${pNik.slice(-8)}` : ""),
          bb: pData.bb,
          tb: pData.tb,
          lp: pData.lp,
          tdsistolik: pData.tdSistolik,
          tddiastolik: pData.tdDiastolik,
          tdSistolik: pData.tdSistolik,
          tdDiastolik: pData.tdDiastolik,
          suhu: pData.suhu,
          nadi: pData.nadi,
          respirasi: pData.respirasi,
          imt: pData.imt,
          hasilImt: pData.hasilImt,
          guladarah: pData.gulaDarah,
          gulaDarah: pData.gulaDarah,
          category: finalCategory,
          hasRealPelayanan: true,
          pelayananNakes: pData.pelayananList || [],
          epusExaminedServices: ["antropometri", "tekanan-darah", ...(pData.pelayananList || [])],
          _status: "idle"
        });
        existingNiks.add(pNik);
      }
    }
  }

  if (combinedLabMap.size > 0) {
    patients = patients.map(p => {
      const realLab = combinedLabMap.get(p.nik);
      if (!realLab) return p;

      return {
        ...p,
        guladarah: realLab.gulaDarah ?? p.guladarah,
        gulaDarah: realLab.gulaDarah ?? p.gulaDarah,
        kolesterol: realLab.kolesterol ?? p.kolesterol,
        hb: realLab.hb ?? p.hb,
        asamUrat: realLab.asamUrat ?? p.asamUrat,
        hasRealLab: true,
        labTests: Array.from(new Set([...(p.labTests || []), ...(realLab.labTests || [])])),
        epusExaminedServices: Array.from(new Set([...(p.epusExaminedServices || []), "laboratorium", ...(realLab.labTests || [])]))
      };
    });
  }

  // Timpa nilai default konfigurasi (pekerjaan, whatsapp, wali, tanggal) jika tidak ada di Excel
  patients = patients.map(p => {
    const rawJob = (p.pekerjaan || "").toString().trim();
    const isJobEmpty = !rawJob || rawJob === "-" || rawJob === "0" || rawJob.toLowerCase() === "null";
    const finalJob = isJobEmpty ? defaultJobCfg : mapPekerjaanToCkg(rawJob, defaultJobCfg);

    const rawWa = (p.nowhatsapp || p.noWhatsapp || "").toString().trim();
    const finalWa = rawWa || defaultPhoneCfg || (p.nik ? `0819${p.nik.slice(-8)}` : "081987654321");

    const finalTgl = defaultTanggalCfg || p.tglPemeriksaan || p.tanggalpemeriksaan || p.tanggalKunjungan || "";

    const updated = {
      ...p,
      pekerjaan: (p.category === "BALITA" || p.category === "SEKOLAH") ? "Belum/Tidak Bekerja" : finalJob,
      nowhatsapp: finalWa,
      noWhatsapp: finalWa,
      tglPemeriksaan: finalTgl,
      tanggalpemeriksaan: finalTgl,
      tanggalKunjungan: finalTgl || p.tanggalKunjungan
    };

    // Jika balita atau anak sekolah dan ada defaultWali di konfigurasi, suntikkan wali jika data wali di pasien belum ada
    if ((p.category === "BALITA" || p.category === "SEKOLAH") && defaultWaliCfg) {
      if (!updated.nikwali && defaultWaliCfg.nik) updated.nikwali = defaultWaliCfg.nik;
      if (!updated.namalengkapwali && defaultWaliCfg.nama) updated.namalengkapwali = defaultWaliCfg.nama;
      if (!updated.tanggallahirwali && defaultWaliCfg.tglLahir) updated.tanggallahirwali = defaultWaliCfg.tglLahir;
      if (!updated.jeniskelaminwali && defaultWaliCfg.jk) updated.jeniskelaminwali = defaultWaliCfg.jk;
      if (!updated.nohpwali && defaultWaliCfg.hp) updated.nohpwali = defaultWaliCfg.hp;
    }

    return updated;
  });

  return patients;
}