// src/excel-importer.js
// Parser & Normalizer Universal CKG
// Mengintegrasikan data-transformer.js yang mendukung file mentah (Posyandu, BPJS, Sekolah, ePuskesmas),
// membaca seluruh kolom Pendaftaran DAN Hasil Pemeriksaan Klinis, serta deduplikasi data.

import { validateBatch } from "./validator.js";
import {
  parseAndNormalizeWorkbook,
  determineCkgCategory,
  mergeAndDeduplicatePatients
} from "./data-transformer.js";

export { mergeAndDeduplicatePatients };

export function detectCategoryFromHeaders(headers) {
  const norm = headers.map(h => (h || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  // HANYA anggap file SEKOLAH jika ada kolom eksplisit nama sekolah
  if (norm.includes("sekolah") || norm.includes("namasekolah") || norm.includes("asalsekolah")) {
    return "SEKOLAH";
  }
  return "UMUM";
}

/**
 * Memformat dan melengkapi alias properti pasien untuk IndexedDB dan form otomasi
 */
export function preparePatientsForBatch(rawPatients, batchCategory, manualCategory = null) {
  return rawPatients.map((p, idx) => {
    // Kategori dibedakan tegas menjadi 2: UMUM dan SEKOLAH.
    // Data mentah pelayanan RME tanpa kolom sekolah adalah UMUM (termasuk anak/remaja, balita, dewasa, lansia).
    const hasSchoolData = Boolean((p.sekolah && String(p.sekolah).trim() !== "") || (p.namaSekolah && String(p.namaSekolah).trim() !== "") || (p.namasekolah && String(p.namasekolah).trim() !== ""));
    let assignedCat = "UMUM";

    if (manualCategory === "SEKOLAH") {
      assignedCat = "SEKOLAH";
    } else if (manualCategory === "UMUM" || manualCategory === "BALITA") {
      assignedCat = "UMUM";
    } else if (hasSchoolData) {
      // HANYA data yang benar-benar memuat nama sekolah yang masuk SEKOLAH
      assignedCat = "SEKOLAH";
    } else {
      assignedCat = "UMUM";
    }

    const item = {
      ...p,
      category: assignedCat,
      detailedCategory: p.category, // BALITA, SEKOLAH_SD, REMAJA, DEWASA_LAKI, DEWASA_PEREMPUAN, LANSIA_LAKI, LANSIA_PEREMPUAN
      indexInFile: idx + 1,

      // Alias Identitas & Pendaftaran
      tgllahir: p.tanggalLahir,
      tgl_lahir: p.tanggalLahir,
      tanggal_lahir: p.tanggalLahir,
      tanggallahir: p.tanggalLahir,
      jk: p.jenisKelamin,
      gender: p.jenisKelamin,
      jeniskelamin: p.jenisKelamin,
      jenis_kelamin: p.jenisKelamin,
      // Alias Kontak WhatsApp
      wa: p.noWhatsapp,
      noWhatsapp: p.noWhatsapp,
      nowhatsapp: p.noWhatsapp,
      hp: p.noWhatsapp,
      nohp: p.noWhatsapp,
      nowa: p.noWhatsapp,
      telp: p.noWhatsapp,
      notelp: p.noWhatsapp,
      telepon: p.noWhatsapp,
      statuspernikahan: p.statusPernikahan,
      status_pernikahan: p.statusPernikahan,
      statusperkawinan: p.statusPernikahan,
      status_perkawinan: p.statusPernikahan,
      statuskawin: p.statusPernikahan,
      status_kawin: p.statusPernikahan,
      statusnikah: p.statusPernikahan,
      profesi: p.pekerjaan,
      job: p.pekerjaan,
      jenispekerjaan: p.pekerjaan,
      jenis_pekerjaan: p.pekerjaan,
      kabkota: p.kabupatenKota,

      // Alias Sekolah
      namasekolah: p.sekolah,
      asalsekolah: p.sekolah,
      jenjang: p.kelas,
      tingkat: p.kelas,
      tingkatkelas: p.kelas,
      jenjangkelas: p.kelas,
      rombel: p.kelas,

      // Alias Data Fisik & Klinis (Hasil Pemeriksaan)
      berat_badan: p.bb,
      tinggi_badan: p.tb,
      lingkar_perut: p.lp,
      lingkar_kepala: p.lk,
      lingkar_lengan: p.lila,
      cara_ukur: p.caraUkur,
      td_sistolik: p.tdSistolik,
      sistolik: p.tdSistolik,
      td_diastolik: p.tdDiastolik,
      diastolik: p.tdDiastolik,
      gula_darah: p.gulaDarah,
      gds: p.gulaDarah,
      gula_darah_puasa: p.gulaDarahPuasa,
      gdp: p.gulaDarahPuasa,
      kolesterol: p.kolesterolTotal,
      kolesterol_total: p.kolesterolTotal,
      hb: p.hemoglobin,
      kadar_co: p.kadarCo,

      // Alias Wali Balita (Untuk kategori BALITA atau jika terdapat data wali)
      ...((p.category === "BALITA" || assignedCat === "BALITA" || Boolean(p.nikWali || p.namaWali)) ? {
        nikWali: p.nikWali,
        namaWali: p.namaWali,
        tanggalLahirWali: p.tanggalLahirWali,
        jenisKelaminWali: p.jenisKelaminWali,
        noHpWali: p.noHpWali,
        nikwali: p.nikWali,
        nik_wali: p.nikWali,
        namawali: p.namaWali,
        namalengkapwali: p.namaWali,
        nama_wali: p.namaWali,
        tanggallahirwali: p.tanggalLahirWali,
        tgllahirwali: p.tanggalLahirWali,
        tgl_lahir_wali: p.tanggalLahirWali,
        jeniskelaminwali: p.jenisKelaminWali,
        jenis_kelamin_wali: p.jenisKelaminWali,
        jkwali: p.jenisKelaminWali,
        nohpwali: p.noHpWali,
        nowawali: p.noHpWali
      } : {})
    };

    // Validasi NIK
    const cleanNik = String(item.nik || "").trim().replace(/\D/g, "");
    if (!cleanNik || cleanNik.length !== 16) {
      item._status = "invalid-nik";
      item._validationError = cleanNik ? `NIK tidak 16 digit (${cleanNik.length} digit)` : "NIK Kosong";
    }

    return item;
  });
}

/**
 * Membaca buffer satu file Excel / CSV dan menghasilkan daftar pasien siap antre
 */
export function parseExcelBuffer(arrayBuffer, manualCategory = null, options = {}) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Library SheetJS (XLSX) tidak ditemukan.");

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
    throw new Error("File Excel kosong atau format tidak valid.");
  }

  // Jalankan pipeline transformer komprehensif
  const transformResult = parseAndNormalizeWorkbook(workbook, {
    enableDeduplication: options.enableDeduplication !== false,
    dateFormat: options.dateFormat || "YYYY-MM-DD",
    ...options
  });

  let rawPatients = transformResult.patients || [];
  if (!rawPatients.length) {
    throw new Error("File Excel kosong atau tidak memiliki baris data yang dapat dibaca.");
  }

  // Tentukan kategori batch utama: HANYA 2 Kategori (UMUM vs SEKOLAH)
  let batchCategory = manualCategory;
  if (!batchCategory || batchCategory === "AUTO") {
    // HANYA batch yang benar-benar memuat data nama sekolah yang menjadi batch SEKOLAH
    const hasAnySchool = rawPatients.some(p => Boolean((p.sekolah && String(p.sekolah).trim()) || (p.namaSekolah && String(p.namaSekolah).trim()) || (p.namasekolah && String(p.namasekolah).trim())));
    batchCategory = hasAnySchool ? "SEKOLAH" : "UMUM";
  }

  const preparedPatients = preparePatientsForBatch(rawPatients, batchCategory, manualCategory);

  return {
    category: batchCategory,
    totalRows: preparedPatients.length,
    duplicatesRemoved: transformResult.duplicatesRemoved,
    patients: validateBatch(preparedPatients, batchCategory)
  };
}

/**
 * Membaca banyak file Excel / CSV sekaligus, memetakan header masing-masing file secara dinamis,
 * dan menggabungkan data pasien yang cocok (Cross-File Merging) tanpa data ganda.
 * @param {Array<{name: string, buffer: ArrayBuffer}>} fileItems
 * @param {string|null} manualCategory
 * @param {object} options
 */
export function parseMultipleFiles(fileItems, manualCategory = null, options = {}) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("Library SheetJS (XLSX) tidak ditemukan.");
  if (!fileItems || !fileItems.length) {
    throw new Error("Tidak ada file yang dipilih.");
  }

  const allRawPatients = [];
  const fileSummaries = [];
  let totalRawCount = 0;

  fileItems.forEach(({ name, buffer }) => {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) return;

      // Parse baris tanpa deduplikasi per file agar bisa digabungkan secara global
      const transformResult = parseAndNormalizeWorkbook(workbook, {
        ...options,
        enableDeduplication: false,
        dateFormat: options.dateFormat || "YYYY-MM-DD"
      });

      const filePatients = transformResult.patients || [];
      totalRawCount += filePatients.length;
      fileSummaries.push({
        fileName: name,
        rowsCount: filePatients.length
      });

      filePatients.forEach(p => {
        p._sourceFileName = name;
        allRawPatients.push(p);
      });
    } catch (err) {
      console.warn(`[parseMultipleFiles] Gagal membaca berkas "${name}":`, err);
    }
  });

  if (!allRawPatients.length) {
    throw new Error("Tidak ada baris data pasien yang dapat dibaca dari seluruh file yang diunggah.");
  }

  // Jalankan Penggabungan Lintas-File (Cross-File Merge & Deduplication)
  const mergedPatients = mergeAndDeduplicatePatients(allRawPatients);

  // Tentukan kategori batch utama: HANYA 2 Kategori (UMUM vs SEKOLAH)
  let batchCategory = manualCategory;
  if (!batchCategory || batchCategory === "AUTO") {
    // HANYA batch yang benar-benar memuat data nama sekolah di kolom yang menjadi batch SEKOLAH
    const hasAnySchool = mergedPatients.some(p => Boolean((p.sekolah && String(p.sekolah).trim()) || (p.namasekolah && String(p.namasekolah).trim()) || (p.namaSekolah && String(p.namaSekolah).trim())));
    batchCategory = hasAnySchool ? "SEKOLAH" : "UMUM";
  }

  const preparedPatients = preparePatientsForBatch(mergedPatients, batchCategory, manualCategory);

  return {
    category: batchCategory,
    totalFiles: fileItems.length,
    fileSummaries,
    totalRawRows: totalRawCount,
    totalCleanPatients: preparedPatients.length,
    duplicatesMerged: totalRawCount - preparedPatients.length,
    patients: validateBatch(preparedPatients, batchCategory)
  };
}
