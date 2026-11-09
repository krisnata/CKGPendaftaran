// Modul Otentikasi & Lisensi Pengguna CKG
// Status: FITUR LOGIN & LISENSI DINONAKTIFKAN (AKSES PENUH TERBUKA / TANPA KUNCI)

const AUTH_SESSION_KEY = "ckg_auth_session";
const DEVICE_ID_KEY = "ckg_device_id";

/**
 * Generate atau ambil Device ID perangkat
 */
export async function getDeviceId() {
  try {
    const stored = await chrome.storage.local.get(DEVICE_ID_KEY);
    if (stored[DEVICE_ID_KEY]) {
      return stored[DEVICE_ID_KEY];
    }

    const part1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newDeviceId = `DEV-${part1}-${part2}`;

    await chrome.storage.local.set({ [DEVICE_ID_KEY]: newDeviceId });
    return newDeviceId;
  } catch (e) {
    return "DEV-OPEN-ACCESS";
  }
}

/**
 * Ambil data sesi otentikasi (selalu aktif & valid)
 */
export async function getAuthSession() {
  return {
    email: "petugas@ckg.puskesmas",
    namaPengguna: "Petugas CKG",
    status: "Aktif",
    masaBerlaku: "Permanen",
    unitKerja: "Puskesmas",
    unlocked: true,
    loginAt: Date.now()
  };
}

/**
 * Simpan data sesi otentikasi
 */
export async function saveAuthSession(sessionData) {
  try {
    if (sessionData) {
      await chrome.storage.local.set({ [AUTH_SESSION_KEY]: sessionData });
    }
  } catch (e) {}
  return true;
}

/**
 * Hapus sesi login
 */
export async function clearAuthSession() {
  try {
    await chrome.storage.local.remove(AUTH_SESSION_KEY);
  } catch (e) {}
  return true;
}

/**
 * Periksa apakah sesi saat ini masih aktif dan belum kedaluwarsa
 * Selalu mengembalikan true (login tidak diperlukan)
 */
export async function isSessionValid() {
  return true;
}

/**
 * Verifikasi lisensi (Bypass: selalu sukses tanpa request server)
 */
export async function verifyLicenseWithServer(email = null, customUrl = null) {
  const sessionData = {
    email: email || "petugas@ckg.puskesmas",
    namaPengguna: "Petugas CKG",
    status: "Aktif",
    masaBerlaku: "Permanen",
    unitKerja: "Puskesmas",
    unlocked: true,
    loginAt: Date.now()
  };
  await saveAuthSession(sessionData);
  return {
    success: true,
    data: sessionData,
    message: "Akses terbuka penuh tanpa login."
  };
}
