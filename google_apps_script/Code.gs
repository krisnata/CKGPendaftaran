/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - SISTEM LISENSI & LOGIN EKSTENSI CKG QUEUE ASSISTANT
 * =========================================================================
 * 
 * Fitur:
 * 1. Otomatis membuat header kolom: Email, Nama Pengguna, Status, Masa Berlaku, Keterangan / No WA, Device ID
 * 2. Menyediakan endpoint API Web App (doGet / doPost) untuk verifikasi login email
 * 3. Validasi status "Aktif", tanggal kedaluwarsa "Masa Berlaku", dan penguncian "Device ID"
 * 4. Auto-bind Device ID saat login pertama kali jika kolom Device ID masih kosong
 */

// Nama sheet database lisensi (default: sheet aktif pertama)
const SHEET_NAME = "Users";

// Definisi Header Kolom Resmi
const HEADERS = [
  "Email",
  "Nama Pengguna",
  "Status",
  "Masa Berlaku",
  "Keterangan / No WA",
  "Device ID"
];

/**
 * Menu otomatis di Google Spreadsheet saat file dibuka
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🔑 CKG Lisensi")
    .addItem("1. Buat / Format Kolom Otomatis", "setupSheet")
    .addItem("2. Tambah Contoh Data Pengguna", "addSampleUsers")
    .addToUi();
}

/**
 * Fungsi untuk membuat header kolom dan format otomatis
 * (Jalankan fungsi ini sekali dari editor Apps Script atau menu)
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }

  // Cek apakah baris 1 sudah ada isinya
  const currentHeader = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const isEmpty = !currentHeader[0] || currentHeader[0].toString().trim() === "";

  if (isEmpty || currentHeader[0].toString().toLowerCase() !== "email") {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  // Format Header (Background Biru, Font Putih Tebal persis contoh)
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground("#2980b9");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");

  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);

  // Atur lebar kolom
  sheet.setColumnWidth(1, 240); // Email
  sheet.setColumnWidth(2, 220); // Nama Pengguna
  sheet.setColumnWidth(3, 110); // Status
  sheet.setColumnWidth(4, 130); // Masa Berlaku
  sheet.setColumnWidth(5, 180); // Keterangan / No WA
  sheet.setColumnWidth(6, 220); // Device ID

  // Format kolom Masa Berlaku sebagai teks / tanggal
  sheet.getRange("D2:D").setNumberFormat("@");

  if (sheet.getLastRow() <= 1) {
    addSampleUsers();
  }

  return "Kolom berhasil dibuat dan diformat otomatis!";
}

/**
 * Tambahkan data contoh pengguna
 */
function addSampleUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  const sampleData = [
    [
      "contoh@gmail.com",
      "Puskesmas Contoh",
      "Aktif",
      "2026-12-31",
      "81234567890",
      "DEV-MV7S0KM4-L9JUE9"
    ],
    [
      "galerikegiatanlimo@gmail.com",
      "galerikegiatanlimo@gmail.com",
      "Aktif",
      "2026-10-15",
      "TRIAL 1 HARI",
      "DEV-MV8TJC5L-12IX04"
    ]
  ];

  sheet.getRange(sheet.getLastRow() + 1, 1, sampleData.length, HEADERS.length).setValues(sampleData);
}

/**
 * Endpoint Utama Web App (GET Request)
 */
function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

/**
 * Endpoint Utama Web App (POST Request)
 */
function doPost(e) {
  let params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }
  return handleRequest(params);
}

/**
 * Logika Inti Penanganan Otentikasi
 */
function handleRequest(params) {
  const action = (params.action || "login").toLowerCase();

  if (action === "ping") {
    return jsonResponse({
      success: true,
      message: "Server Lisensi CKG Queue Assistant Aktif",
      time: new Date().toISOString()
    });
  }

  if (action === "setup") {
    setupSheet();
    return jsonResponse({
      success: true,
      message: "Setup sheet dan kolom berhasil dijalankan."
    });
  }

  // Action: login / check
  const emailInput = (params.email || "").toString().trim().toLowerCase();
  const deviceIdInput = (params.deviceId || "").toString().trim();

  if (!emailInput) {
    return jsonResponse({
      success: false,
      code: "EMPTY_EMAIL",
      message: "Parameter email tidak boleh kosong."
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  // Pastikan kolom terpasang jika sheet belum disiapkan
  if (sheet.getLastRow() === 0) {
    setupSheet();
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({
      success: false,
      code: "NO_DATA",
      message: "Database lisensi masih kosong. Daftarkan email pada spreadsheet."
    });
  }

  // Header indices (0-based)
  // Col 0: Email, 1: Nama Pengguna, 2: Status, 3: Masa Berlaku, 4: Keterangan, 5: Device ID
  let foundRowIndex = -1;
  let userData = null;

  for (let i = 1; i < data.length; i++) {
    const rowEmail = (data[i][0] || "").toString().trim().toLowerCase();
    if (rowEmail === emailInput) {
      foundRowIndex = i + 1; // 1-based row index di Sheet
      userData = {
        email: data[i][0].toString().trim(),
        namaPengguna: (data[i][1] || data[i][0]).toString().trim(),
        status: (data[i][2] || "").toString().trim(),
        masaBerlaku: formatMasaBerlaku(data[i][3]),
        keterangan: (data[i][4] || "").toString().trim(),
        deviceId: (data[i][5] || "").toString().trim()
      };
      break;
    }
  }

  // 1. Validasi: Email terdaftar
  if (!userData) {
    return jsonResponse({
      success: false,
      code: "NOT_FOUND",
      message: "Email '" + emailInput + "' tidak terdaftar. Hubungi admin untuk mendaftar."
    });
  }

  // 2. Validasi: Status akun harus 'Aktif'
  if (userData.status.toLowerCase() !== "aktif") {
    return jsonResponse({
      success: false,
      code: "INACTIVE",
      message: "Akun Anda berstatus '" + userData.status + "'. Silakan hubungi admin untuk mengaktifkan akun."
    });
  }

  // 3. Validasi: Masa Berlaku
  if (userData.masaBerlaku) {
    const isExpired = checkIsExpired(userData.masaBerlaku);
    if (isExpired) {
      return jsonResponse({
        success: false,
        code: "EXPIRED",
        message: "Masa berlaku akun telah habis pada " + userData.masaBerlaku + ". Silakan perpanjang lisensi Anda."
      });
    }
  }

  // 4. Validasi & Auto-bind Device ID
  if (deviceIdInput) {
    if (!userData.deviceId) {
      // Jika Device ID di sheet masih kosong, AUTO-BIND perangkat saat ini!
      sheet.getRange(foundRowIndex, 6).setValue(deviceIdInput);
      userData.deviceId = deviceIdInput;
    } else if (userData.deviceId !== deviceIdInput) {
      // Jika sudah terisi dan berbeda
      return jsonResponse({
        success: false,
        code: "DEVICE_MISMATCH",
        message: "Akun ini terdaftar di perangkat lain (" + userData.deviceId + "). Hubungi admin jika ingin memindahkan lisensi."
      });
    }
  }

  // Semua validasi sukses!
  return jsonResponse({
    success: true,
    code: "OK",
    message: "Login berhasil. Selamat datang, " + userData.namaPengguna + "!",
    data: userData
  });
}

/**
 * Format tanggal masa berlaku menjadi YYYY-MM-DD
 */
function formatMasaBerlaku(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return val.toString().trim();
}

/**
 * Periksa apakah tanggal sudah lewat hari ini
 */
function checkIsExpired(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dateStr.split(/[-/]/);
  let expDate = null;

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      // DD/MM/YYYY
      expDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  } else {
    expDate = new Date(dateStr);
  }

  if (expDate && !isNaN(expDate.getTime())) {
    expDate.setHours(23, 59, 59, 999);
    return today > expDate;
  }
  return false;
}

/**
 * Helper respons JSON dengan CORS headers
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
