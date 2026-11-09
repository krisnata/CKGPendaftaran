// src/template-generator.js
// Generator Template Excel CKG Client-Side menggunakan SheetJS (xlsx.mini.min.js)
// Memungkinkan Nakes Puskesmas mengunduh template Excel siap pakai langsung dari Side Panel.

import {
  TEMPLATE_COLUMNS,
  mapPatientToTemplateRow,
  createFormattedSheet,
  generateMasterUmumWorkbook,
  generateMasterSekolahWorkbook
} from "./data-transformer.js";

export const TEMPLATE_DEFINITIONS = {
  BALITA: {
    title: "Template_CKG_Balita.xlsx",
    sheetName: "Balita & Anak Prasekolah",
    description: "Khusus Balita (0-5 Tahun) lengkap dengan data NIK/Nama Wali & Skrining Pertumbuhan",
    headers: [
      "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "PROVINSI", "KAB/KOTA",
      "KECAMATAN", "KELURAHAN", "ALAMAT", "STATUS PERNIKAHAN", "PEKERJAAN",
      "NIK WALI", "NAMA LENGKAP WALI", "TANGGAL LAHIR WALI", "JENIS KELAMIN WALI", "NO HP WALI",
      "BB", "TB", "CARA UKUR", "LK", "LILA", "STATUS IMUNISASI", "KPSP", "MCHAT",
      "GULA DARAH", "TELINGA", "MATA", "GIGI", "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
    ],
    sampleRows: [
      [
        "5201096008200001", "SALMAH NAFISAH", "20/08/2021", "Perempuan", "081999578341",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah RT 02",
        "Belum Menikah", "Belum/Tidak Bekerja",
        "5201095109900005", "NURHASANAH", "11/09/1990", "Perempuan", "081999578341",
        "12.4", "88.5", "Berdiri", "48.2", "15.0", "Lengkap", "Sesuai", "Normal", "92",
        "Normal", "Normal", "Normal", "Tidak", "Tidak", "Tidak", "Tidak"
      ],
      [
        "5201091503230002", "MUHAMMAD ARKAN", "15/03/2023", "Laki-laki", "081993405632",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Betok",
        "Belum Menikah", "Belum/Tidak Bekerja",
        "5201092005920001", "AHMAD JUNAIDI", "20/05/1992", "Laki-laki", "081993405632",
        "10.2", "79.0", "Terlentang", "46.5", "14.2", "Lengkap", "Sesuai", "Normal", "88",
        "Normal", "Normal", "Normal", "Tidak", "Tidak", "Tidak", "Tidak"
      ]
    ]
  },
  SEKOLAH_SD: {
    title: "Template_CKG_Sekolah_SD.xlsx",
    sheetName: "Usia Sekolah SD (7-12 Thn)",
    description: "Anak Usia Sekolah (SD/MI 7-12 Tahun) dengan data Sekolah, Kelas, Karies, & Kebugaran",
    headers: [
      "SEKOLAH", "KELAS", "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
      "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
      "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
      "GIGI", "KARIES", "MATA", "KACAMATA", "BUTA WARNA", "TELINGA", "KEBUGARAN",
      "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
    ],
    sampleRows: [
      [
        "SDN 1 SESELA", "Kelas 4A", "5201091204140003", "RIZKY RAMADHAN", "12/04/2014", "Laki-laki", "081998765432",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
        "31.5", "135.0", "62", "105", "68", "95", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak"
      ],
      [
        "SDN 1 SESELA", "Kelas 5B", "5201095508130004", "AISYAH AZZAHRA", "15/08/2013", "Perempuan", "081997654321",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Are",
        "34.0", "138.5", "64", "100", "65", "90", "Ada Lubang", "1", "Normal", "Tidak", "Normal", "Normal", "Baik Sekali", "Tidak", "Tidak", "Tidak", "Tidak"
      ]
    ]
  },
  REMAJA: {
    title: "Template_CKG_Remaja_SMP_SMA.xlsx",
    sheetName: "Remaja SMP-SMA (13-17 Thn)",
    description: "Remaja (13-17 Tahun) dengan Skrining Reproduksi/Menstruasi, Anemia/Hb, & Merokok",
    headers: [
      "SEKOLAH", "KELAS", "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP",
      "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
      "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH",
      "HEMOGLOBIN", "ANEMIA", "MEROKOK", "KADAR CO", "MENSTRUASI",
      "GIGI", "KARIES", "MATA", "KACAMATA", "TELINGA", "KEBUGARAN",
      "GEJALA CEMAS", "GEJALA DEPRESI", "GEJALA TBC", "KUSTA", "FRAMBUSIA", "SKABIES"
    ],
    sampleRows: [
      [
        "SMPN 1 GUNUNGSARI", "Kelas 8A", "5201091010100005", "DANIEL SAPUTRA", "10/10/2010", "Laki-laki", "081991234567",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Dasan Geria",
        "48.0", "158.0", "68", "110", "70", "98", "14.2", "Tidak Anemia", "Tidak", "2", "Normal", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak"
      ],
      [
        "SMAN 1 GUNUNGSARI", "Kelas 11 IPA", "5201094503080006", "SITI MARYAM", "05/03/2008", "Perempuan", "081992345678",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
        "46.5", "154.0", "66", "108", "68", "92", "12.8", "Tidak Anemia", "Tidak", "2", "Teratur", "Normal", "Tidak Ada", "Normal", "Tidak", "Normal", "Baik", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak", "Tidak"
      ]
    ]
  },
  DEWASA_LAKI: {
    title: "Template_CKG_Dewasa_Laki_Laki.xlsx",
    sheetName: "Dewasa Laki-Laki (18-59 Thn)",
    description: "Dewasa Laki-Laki (18-59 Tahun) dengan PTM, Merokok, Kadar CO, Lab POCT, & Jiwa",
    headers: [
      "NIK", "NAMA", "TANGGAL LAHIR", "JENIS KELAMIN", "NO WHATSAPP", "STATUS PERNIKAHAN",
      "PEKERJAAN", "PROVINSI", "KAB/KOTA", "KECAMATAN", "KELURAHAN", "ALAMAT",
      "BB", "TB", "LP", "TD SISTOLIK", "TD DIASTOLIK", "GULA DARAH", "GULA DARAH PUASA", "HBA1C",
      "MEROKOK", "KADAR CO", "RIWAYAT DIABETES", "DURASI DIABETES BULAN", "RIWAYAT HIPERTENSI",
      "KOLESTEROL TOTAL", "TRIGLISERIDA", "HDL", "LDL", "UREUM", "KREATININ", "PROTEIN URIN",
      "HEMOGLOBIN", "TELINGA", "MATA", "KATARAK", "GIGI", "PUMA SCORE", "KANKER PARU",
      "KANKER USUS", "KESEHATAN JIWA SRQ20", "TBC", "KUSTA", "FRAMBUSIA", "SKABIES",
      "MALARIA", "HEPATITIS B", "HEPATITIS C", "HIV", "SIFILIS"
    ],
    sampleRows: [
      [
        "5201091506880007", "AHMAD FAUZI", "15/06/1988", "Laki-laki", "081993456789",
        "Menikah", "Wiraswasta / Pedagang",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
        "68.0", "168.0", "82", "118", "78", "102", "88", "5.3",
        "Tidak", "3", "Tidak", "0", "Tidak", "182", "125", "46", "110", "24", "0.95",
        "Negatif", "14.8", "Normal", "Normal", "Normal", "Normal", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
        "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
      ]
    ]
  },
  DEWASA_PEREMPUAN: {
    title: "Template_CKG_Dewasa_Perempuan.xlsx",
    sheetName: "Dewasa Perempuan (18-59 Thn)",
    description: "Dewasa Perempuan (18-59 Tahun) lengkap dengan SADANIS, IVA, Hamil, & Reproduksi",
    headers: [
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
    sampleRows: [
      [
        "5201094807920008", "NURUL HIDAYATI", "08/07/1992", "Perempuan", "081994567890",
        "Menikah", "Ibu Rumah Tangga",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Betok",
        "Tidak", "Tidak", "Ya", "Normal", "Negatif", "Negatif", "Tidak",
        "54.5", "155.0", "72", "112", "74", "98", "85", "5.2",
        "Tidak", "2", "Tidak", "0", "Tidak", "175", "115", "52", "102", "20", "0.78",
        "Negatif", "13.2", "Tidak Anemia", "Normal", "Normal", "Normal", "Normal", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
        "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
      ]
    ]
  },
  LANSIA_LAKI: {
    title: "Template_CKG_Lansia_Laki_Laki.xlsx",
    sheetName: "Lansia Laki-Laki (>=60 Thn)",
    description: "Lansia Laki-Laki (≥60 Tahun) dengan Instrumen SKILAS & Barthel Index ADL",
    headers: [
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
    sampleRows: [
      [
        "5201091208580009", "H. MAHSUN", "12/08/1958", "Laki-laki", "081995678901",
        "Menikah", "Pensiunan / Tidak Bekerja",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Kebun Indah",
        "Normal", "Normal", "11.2", "Normal", "Normal", "Mandiri (Skor 20)",
        "62.0", "162.0", "84", "125", "80", "110", "92", "5.6",
        "Tidak", "3", "Tidak", "0", "Tidak", "190", "135", "45", "118", "28", "1.02",
        "Negatif", "14.0", "Normal", "Normal", "Normal", "Ada Gigi Dicabut", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
        "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
      ]
    ]
  },
  LANSIA_PEREMPUAN: {
    title: "Template_CKG_Lansia_Perempuan.xlsx",
    sheetName: "Lansia Perempuan (>=60 Thn)",
    description: "Lansia Perempuan (≥60 Tahun) dengan SKILAS, Barthel Index, & SADANIS/IVA",
    headers: [
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
    sampleRows: [
      [
        "5201095012550010", "HJ. MARIAM", "10/12/1955", "Perempuan", "081996789012",
        "Cerai Mati", "Tidak Bekerja",
        "NUSA TENGGARA BARAT", "Kab. Lombok Barat", "GUNUNGSARI", "SESELA", "Dusun Montong Are",
        "Normal", "Normal", "12.0", "Normal", "Normal", "Mandiri (Skor 20)", "Normal", "Negatif",
        "52.0", "150.0", "78", "128", "82", "115", "95", "5.8",
        "Tidak", "2", "Tidak", "0", "Tidak", "195", "140", "48", "120", "26", "0.85",
        "Negatif", "12.6", "Normal", "Normal", "Normal", "Ada Gigi Dicabut", "Normal", "Tidak Berisiko", "Tidak Berisiko", "Normal",
        "Tidak", "Tidak", "Tidak", "Tidak", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif", "Non-Reaktif"
      ]
    ]
  }
};

/**
 * Helper memicu unduhan file Blob di browser
 */
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * Mencoba mengunduh file template Excel resmi yang telah dilengkapi
 * fitur Excel Data Validation Dropdown langsung dari bundle ekstensi.
 */
async function tryDownloadExtensionAsset(filename) {
  try {
    if (typeof chrome !== "undefined" && chrome?.runtime?.getURL) {
      const fileUrl = chrome.runtime.getURL(`templates_excel/${filename}`);
      const res = await fetch(fileUrl);
      if (res.ok) {
        const blob = await res.blob();
        triggerBlobDownload(blob, filename);
        return true;
      }
    }
  } catch (err) {
    console.warn(`[tryDownloadExtensionAsset] Gagal memuat asset ${filename}:`, err);
  }
  return false;
}

/**
 * Menghasilkan file Excel dan memicu unduhan di browser (dengan dropdown bila tersedia)
 * @param {string} templateKey - Kunci dari TEMPLATE_DEFINITIONS (BALITA, DEWASA_LAKI, dll.)
 */
export async function downloadTemplate(templateKey) {
  const def = TEMPLATE_DEFINITIONS[templateKey];
  if (!def) {
    alert(`Template "${templateKey}" tidak ditemukan.`);
    return;
  }

  // 1. Prioritas: Unduh file resmi dengan Excel Data Validation Dropdown
  const loaded = await tryDownloadExtensionAsset(def.title);
  if (loaded) return;

  // 2. Fallback: Buat via SheetJS di browser
  const XLSX = window.XLSX;
  if (!XLSX) {
    alert("Library XLSX belum dimuat. Mohon muat ulang ekstensi.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const aoa = [def.headers, ...def.sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = def.headers.map((h, i) => {
    let max = h.length;
    def.sampleRows.forEach(row => {
      const v = String(row[i] || "");
      if (v.length > max) max = v.length;
    });
    return { wch: Math.max(max + 3, 14) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, def.sheetName || "Sheet1");
  XLSX.writeFile(wb, def.title);
}

/**
 * Unduh Master All-in-One Multi-Sheet untuk CKG Umum (Lengkap Dropdown)
 */
export async function downloadMasterUmum() {
  const filename = "Template_Master_CKG_Umum.xlsx";
  const loaded = await tryDownloadExtensionAsset(filename);
  if (loaded) return;

  const XLSX = window.XLSX;
  if (!XLSX) return;

  const wb = XLSX.utils.book_new();
  const sheets = ["DEWASA_LAKI", "DEWASA_PEREMPUAN", "LANSIA_LAKI", "LANSIA_PEREMPUAN", "BALITA"];
  
  sheets.forEach(key => {
    const def = TEMPLATE_DEFINITIONS[key];
    if (def) {
      const aoa = [def.headers, ...def.sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = def.headers.map(h => ({ wch: Math.max(h.length + 3, 14) }));
      XLSX.utils.book_append_sheet(wb, ws, def.sheetName);
    }
  });

  XLSX.writeFile(wb, filename);
}

/**
 * Unduh Master All-in-One Multi-Sheet untuk CKG Sekolah (Lengkap Dropdown)
 */
export async function downloadMasterSekolah() {
  const filename = "Template_Master_CKG_Sekolah.xlsx";
  const loaded = await tryDownloadExtensionAsset(filename);
  if (loaded) return;

  const XLSX = window.XLSX;
  if (!XLSX) return;

  const wb = XLSX.utils.book_new();
  const sheets = ["SEKOLAH_SD", "REMAJA"];

  sheets.forEach(key => {
    const def = TEMPLATE_DEFINITIONS[key];
    if (def) {
      const aoa = [def.headers, ...def.sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = def.headers.map(h => ({ wch: Math.max(h.length + 3, 14) }));
      XLSX.utils.book_append_sheet(wb, ws, def.sheetName);
    }
  });

  XLSX.writeFile(wb, filename);
}

// ==============================================================================
// PENGHASIL EXCEL DATA PASIEN NYATA TERNORMALISASI (OUTPUT RESMI templates_excel)
// ==============================================================================

/**
 * Ekspor data pasien ke file template Excel spesifik
 */
export function exportPatientsDataToExcel(patients, templateKey, customFilename = null) {
  const XLSX = window.XLSX;
  if (!XLSX) {
    alert("Library XLSX belum siap.");
    return;
  }

  const def = TEMPLATE_DEFINITIONS[templateKey];
  const filename = customFilename || (def ? def.title : `Export_CKG_${templateKey}.xlsx`);
  const headers = TEMPLATE_COLUMNS[templateKey] || (def ? def.headers : []);
  const rows = patients.map(p => mapPatientToTemplateRow(p, templateKey));

  const wb = XLSX.utils.book_new();
  const ws = createFormattedSheet(headers, rows);
  XLSX.utils.book_append_sheet(wb, ws, def ? def.sheetName : "Data CKG");
  XLSX.writeFile(wb, filename);
}

/**
 * Ekspor data pasien ke Master CKG Umum (.xlsx)
 */
export function exportPatientsToMasterUmum(patients, customFilename = "Template_Master_CKG_Umum.xlsx") {
  const XLSX = window.XLSX;
  if (!XLSX) return;
  const wb = generateMasterUmumWorkbook(patients);
  XLSX.writeFile(wb, customFilename);
}

/**
 * Ekspor data pasien ke Master CKG Sekolah (.xlsx)
 */
export function exportPatientsToMasterSekolah(patients, customFilename = "Template_Master_CKG_Sekolah.xlsx") {
  const XLSX = window.XLSX;
  if (!XLSX) return;
  const wb = generateMasterSekolahWorkbook(patients);
  XLSX.writeFile(wb, customFilename);
}

/**
 * Ekspor seluruh kategori data pasien ke satu file ZIP
 */
export async function exportPatientsToZip(patients, zipFilename = "Export_CKG_Lengkap.zip") {
  const JSZip = window.JSZip;
  const XLSX = window.XLSX;
  if (!JSZip || !XLSX) {
    alert("Library JSZip atau XLSX belum siap.");
    return;
  }

  const zip = new JSZip();

  // 1. Tambahkan Master Umum & Master Sekolah
  const wbUmum = generateMasterUmumWorkbook(patients);
  const outUmum = XLSX.write(wbUmum, { bookType: "xlsx", type: "array" });
  zip.file("Template_Master_CKG_Umum.xlsx", outUmum);

  const wbSekolah = generateMasterSekolahWorkbook(patients);
  const outSekolah = XLSX.write(wbSekolah, { bookType: "xlsx", type: "array" });
  zip.file("Template_Master_CKG_Sekolah.xlsx", outSekolah);

  // 2. Tambahkan Tiap Kategori Individu
  const categories = [
    { key: "BALITA", filename: "Template_CKG_Balita.xlsx" },
    { key: "SEKOLAH_SD", filename: "Template_CKG_Sekolah_SD.xlsx" },
    { key: "REMAJA", filename: "Template_CKG_Remaja_SMP_SMA.xlsx" },
    { key: "DEWASA_LAKI", filename: "Template_CKG_Dewasa_Laki_Laki.xlsx" },
    { key: "DEWASA_PEREMPUAN", filename: "Template_CKG_Dewasa_Perempuan.xlsx" },
    { key: "LANSIA_LAKI", filename: "Template_CKG_Lansia_Laki_Laki.xlsx" },
    { key: "LANSIA_PEREMPUAN", filename: "Template_CKG_Lansia_Perempuan.xlsx" }
  ];

  categories.forEach(cat => {
    const subset = patients.filter(p => p.category === cat.key || p.detailedCategory === cat.key);
    if (subset.length > 0) {
      const headers = TEMPLATE_COLUMNS[cat.key];
      const rows = subset.map(p => mapPatientToTemplateRow(p, cat.key));
      const wbCat = XLSX.utils.book_new();
      const wsCat = createFormattedSheet(headers, rows);
      XLSX.utils.book_append_sheet(wbCat, wsCat, cat.key);
      const outCat = XLSX.write(wbCat, { bookType: "xlsx", type: "array" });
      zip.file(cat.filename, outCat);
    }
  });

  const blob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(blob, zipFilename);
}


