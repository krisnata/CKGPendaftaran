import { cleanDiagnosa, extractBirthDateFromNik, extractGenderFromNik } from "./epuskesmasService.js";
import { REPORT_EXPORT_COLUMNS, buildCompleteReportData } from "./pelayananFormHelper.js";
import { loadExamToggles } from "./examToggleConfig.js";

// Header Kolom Baku Sesuai Format CKG Lengkap (208+ Kolom Skrining Mandiri, Pertanyaan Beruntun & Pemeriksaan Nakes)
const CKG_EXPORT_HEADERS = [
  "No",
  ...REPORT_EXPORT_COLUMNS.map(c => c.label),
  "No WhatsApp / HP",
  "Provinsi",
  "Kabupaten / Kota",
  "Kecamatan",
  "Desa / Kelurahan",
  "Alamat Domisili",
  "Diagnosa ICD-10",
  "Status Otomasi"
];

// Helper: Menghitung usia dalam tahun
function calculateAgeInYears(p) {
  if (p.umurTahun != null && !isNaN(parseInt(p.umurTahun, 10))) {
    return parseInt(p.umurTahun, 10);
  }
  const uStr = String(p.umur || p.usia || "").toLowerCase();
  const m = uStr.match(/(\d+)\s*(?:th|thn|tahun)/i);
  if (m) return parseInt(m[1], 10);
  if (uStr.includes("bln") || uStr.includes("bulan") || uStr.includes("hari") || uStr.includes("hr")) {
    return 0;
  }

  const birthRaw = p.tanggallahir || p.tanggal_lahir || p.tglLahir || (p.nik?.length === 16 ? extractBirthDateFromNik(p.nik) : null);
  if (birthRaw) {
    const b = new Date(birthRaw);
    if (!isNaN(b.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - b.getFullYear();
      const monthDiff = now.getMonth() - b.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) {
        age--;
      }
      return Math.max(0, age);
    }
  }
  return 30; // Fallback usia dewasa jika data tidak tercantum
}

// Helper: Tentukan Kelompok Sheet Berdasarkan Usia Kemenkes
function getAgeGroup(age, categoryRaw = "") {
  const catUpper = String(categoryRaw).toUpperCase();
  if (catUpper === "SEKOLAH") return "Sekolah & Remaja";
  if (age <= 6) return "Balita";
  if (age >= 7 && age <= 18) return "Sekolah & Remaja";
  if (age >= 19 && age <= 59) return "Dewasa";
  return "Lansia";
}

export async function exportLaporanCkgByNameByAddress() {
  const XLSX = (typeof window !== "undefined" && window.XLSX) || (typeof global !== "undefined" && global.XLSX);
  if (!xlsxLibAvailable(XLSX)) {
    throw new Error("Library Excel (XLSX) belum dimuat.");
  }

  // 1. Ambil data pasien dari session pendaftaran atau ePuskesmas
  const session = await chrome.storage.session.get([
    "pendaftaranPatients",
    "epuskesmasPatients"
  ]);

  const rawList = (session.pendaftaranPatients && session.pendaftaranPatients.length > 0)
    ? session.pendaftaranPatients
    : (session.epuskesmasPatients || []);

  if (!rawList || rawList.length === 0) {
    throw new Error("Tidak ada data pasien yang tersedia untuk diekspor.");
  }

  // 2. Ambil config pengaturan untuk fallback data
  const local = await chrome.storage.local.get(["ckg_config", "configSettings", "tglPemeriksaan"]);
  const cfg = local.ckg_config || local.configSettings || {};
  const defaultJob = cfg.defaultJob || cfg.defaultPekerjaan || "Lainnya";
  const defaultDate = cfg.tanggalPemeriksaan?.date || cfg.tglPemeriksaan || local.tglPemeriksaan || new Date().toISOString().split("T")[0];

  const examToggles = await loadExamToggles().catch(() => null);

  // 3. Kelompokkan data per kategori umur
  const groupedData = {
    "Balita": [],
    "Sekolah & Remaja": [],
    "Dewasa": [],
    "Lansia": []
  };

  rawList.forEach((p, idx) => {
    const age = calculateAgeInYears(p);
    const ageGroup = getAgeGroup(age, p.category);

    const nikStr = String(p.nik || "").replace(/\D/g, "");
    let tglLahir = p.tanggallahir || p.tanggal_lahir || p.tglLahir || "";
    if (!tglLahir && nikStr.length === 16) {
      tglLahir = extractBirthDateFromNik(nikStr);
    }

    let jk = p.jeniskelamin || p.jenis_kelamin || p.jenisKelamin || "";
    if (!jk && nikStr.length === 16) {
      jk = extractGenderFromNik(nikStr);
    }

    const rawJob = String(p.pekerjaan || "").trim();
    const isJobEmpty = !rawJob || rawJob === "-" || rawJob === "0" || rawJob.toLowerCase() === "null";
    const job = (age <= 18) ? "Belum/Tidak Bekerja" : (isJobEmpty ? defaultJob : rawJob);

    const examDate = p.tglPemeriksaan || p.tanggalpemeriksaan || p.tanggalDaftar || p.tanggalKunjungan || defaultDate;
    const catStr = p.category || (age <= 6 ? "BALITA" : age <= 18 ? "SEKOLAH" : "UMUM");

    const rep = p.reportData || buildCompleteReportData(
      {
        ...p,
        nik: nikStr,
        nomorTiket: p._nomorTiket || p.ticketNumber || p.noTiket || "",
        nama: (p.nama || "").toUpperCase(),
        tanggalLahir: tglLahir,
        usia: `${age} thn`,
        gender: jk || "Perempuan",
        pekerjaan: job,
        category: catStr
      },
      null,
      examToggles
    );

    rep.timestamp = examDate;
    rep.kategori = catStr;
    rep.nomorTiket = p._nomorTiket || p.ticketNumber || p.noTiket || "";
    rep.nik = nikStr;
    rep.nama = (p.nama || "").toUpperCase();
    rep.tanggalLahir = tglLahir;
    rep.usia = `${age} thn`;
    rep.gender = jk || "Perempuan";
    rep.pekerjaan = job;
    rep.statusSkrining = p._status === "done" ? "Selesai" : (p._status === "error" ? "Gagal" : "Menunggu");
    rep.statusRaport = p._status === "done" ? "Selesai Pelayanan" : "Menunggu";
    rep.keterangan = p._status === "done" ? "Selesai Pelayanan Lengkap" : "";

    const row = [
      idx + 1,
      ...REPORT_EXPORT_COLUMNS.map(c => rep[c.key] !== undefined && rep[c.key] !== null ? String(rep[c.key]) : ""),
      p.nowhatsapp || p.noWhatsapp || p.wa || "",
      p.provinsi || "Nusa Tenggara Barat",
      p.kabkota || "Kab. Lombok Barat",
      p.kecamatan || "Narmada",
      p.desa || p.kelurahan || "Sedau",
      p.alamat || p.detailAlamat || `Dusun ${p.desa || "Sedau"}`,
      cleanDiagnosa(p.diagnosa) || "",
      p._status === "done" ? "Selesai" : (p._status === "error" ? "Gagal" : "Menunggu")
    ];

    groupedData[ageGroup].push(row);
  });

  // 4. Bangun Workbook Excel multi-sheet
  const wb = XLSX.utils.book_new();
  const colWidths = CKG_EXPORT_HEADERS.map((h, i) => {
    if (i === 0) return { wch: 5 };
    return { wch: Math.max(18, Math.min(42, String(h).length + 2)) };
  });

  let totalExported = 0;

  // Masukkan sheet yang memiliki data
  Object.keys(groupedData).forEach(groupName => {
    const records = groupedData[groupName];
    if (records.length > 0) {
      totalExported += records.length;
      // Re-numbering urutan baris per sheet
      const sheetRows = [
        CKG_EXPORT_HEADERS,
        ...records.map((r, i) => {
          const cloned = [...r];
          cloned[0] = i + 1;
          return cloned;
        })
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      ws["!cols"] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, groupName);
    }
  });

  // Jika semua sheet kosong, buat satu sheet default
  if (totalExported === 0) {
    const ws = XLSX.utils.aoa_to_sheet([CKG_EXPORT_HEADERS]);
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Data Kosong");
  }

  // 5. Unduh File Excel
  const todayStr = new Date().toISOString().split("T")[0];
  const filename = `Laporan_CKG_Siklus_Hidup_${todayStr}.xlsx`;

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

  return { count: totalExported, filename };
}

function xlsxLibAvailable(lib) {
  return Boolean(lib && lib.utils && typeof lib.utils.book_new === "function");
}