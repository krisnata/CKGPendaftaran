// Validator data sebelum menyentuh portal CKG
// Sesuai prinsip: NIK kosong / != 16 digit -> INVALID, Tanggal Lahir tidak valid -> INVALID, dsb.

export function formatNikString(val) {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (/[eE]\+?/.test(s)) {
    const num = Number(s);
    if (!isNaN(num)) {
      try { s = BigInt(Math.round(num)).toString(); } catch(e) {}
    }
  }
  return s.replace(/\D/g, "");
}

export function validateParticipant(p, category = "UMUM") {
  const errors = [];
  const warnings = [];

  // 1. Validasi NIK
  const rawNik = formatNikString(p.nik ?? p.NIK ?? "");
  if (!rawNik) {
    errors.push("NIK wajib diisi");
  } else if (rawNik.length !== 16) {
    errors.push(`NIK harus 16 digit (saat ini ${rawNik.length} digit)`);
  }

  // 2. Validasi Nama
  const rawNama = String(p.nama ?? p.NAMA ?? p.name ?? "").trim();
  if (!rawNama) {
    errors.push("Nama lengkap wajib diisi");
  }

  // 3. Validasi Tanggal Lahir Peserta
  const tglLahir = p.tanggalLahir || p.tanggallahir || p.tgllahir || p["TANGGAL LAHIR"];
  if (!tglLahir) {
    if (category === "BALITA") {
      errors.push("Tanggal lahir peserta wajib diisi untuk Balita");
    } else {
      warnings.push("Tanggal lahir kosong di Excel (akan diambil otomatis dari Dukcapil)");
    }
  }

  // 4. Validasi Jenis Kelamin
  const jk = String(p.jenisKelamin || p.jeniskelamin || p.jk || p["JENIS KELAMIN"] || "").trim().toLowerCase();
  if (!jk) {
    if (category === "BALITA") {
      warnings.push("Jenis kelamin peserta kosong");
    } else {
      warnings.push("Jenis kelamin kosong di Excel (akan diambil otomatis dari Dukcapil)");
    }
  } else if (!jk.startsWith("l") && !jk.startsWith("p") && jk !== "1" && jk !== "2" && !jk.includes("laki") && !jk.includes("perem")) {
    warnings.push("Format jenis kelamin tidak standar (harus L/P)");
  }

  // 5. Validasi Khusus Balita
  if (category === "BALITA") {
    const rawNikWali = formatNikString(p.nikWali || p.nikwali || p["NIK Wali"] || "");
    if (rawNikWali && rawNikWali.length !== 16) {
      warnings.push(`NIK Wali tidak 16 digit (${rawNikWali.length} digit)`);
    }
    const namaWali = String(p.namaWali || p.namalengkapwali || p["Nama Lengkap Wali"] || "").trim();
    if (!namaWali && !rawNikWali) {
      warnings.push("Data Wali (Nama/NIK) kosong untuk kategori Balita");
    }
  }

  // 6. Validasi Khusus Sekolah
  if (category === "SEKOLAH") {
    const sekolah = String(p.sekolah || p.SEKOLAH || p.namasekolah || "").trim();
    const kelas = String(p.kelas || p.KELAS || p.jenjang || p.tingkat || p.tingkatkelas || "").trim();
    if (!sekolah) warnings.push("Nama Sekolah kosong");
    if (!kelas) warnings.push("Jenjang/Kelas kosong");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    status: errors.length === 0 ? "READY" : "INVALID",
    summary: errors.length > 0 ? errors.join("; ") : null
  };
}

export function validateBatch(participants, category = "UMUM") {
  return participants.map(p => {
    const val = validateParticipant(p, category);
    return {
      ...p,
      _validationStatus: val.status,
      _validationError: val.summary,
      _isValid: val.isValid
    };
  });
}

