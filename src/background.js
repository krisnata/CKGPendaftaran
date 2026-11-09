// Background Service Worker untuk CKG Queue Assistant
// Menangani alur antrean mandiri (Full Automation Unattended), state machine peserta,
// retry adaptif, pencegah sleep, dan komunikasi ke Side Panel / Popup.

import {
  openDB,
  getNextReadyParticipant,
  updateParticipantStatus,
  getQueueStats,
  setCheckpoint,
  getCheckpoint,
  appendLog,
  getAllRegisteredPatients,
  getPatientById,
  resetInProgressToReady,
  resetErrorsToReady,
  deleteCompletedRegisteredPatients,
  clearAllRegisteredPatients
} from "./db.js";
import { UnattendedManager } from "./unattended-manager.js";
import { PendaftaranAutomation } from "./pendaftaranAutomation.js";
import { runFlow as runPelayananInstanFlow } from "./pelayananInstanAutomation.js";
import { Automation as SkriningAutomation } from "./automation.js";
import { selesaikanLayanan } from "./selesaiLayanan.js";
import { recordToFieldRules } from "./pelayananFormHelper.js";
import { buildFieldRules } from "./fieldConfig.js";
import { getFieldConfig } from "./remoteConfig.js";
import { runUncheckAll } from "./uncheckUtils.js";
import { calculateAge, getLifeCycleCategory } from "./lifecycle-rules.js";
import { TatalaksanaAutomation } from "./tatalaksanaAutomation.js";
import { isSessionValid } from "./auth.js";

const unattendedMgr = new UnattendedManager();

let isQueueRunning = false;
let isQueuePaused = false;
let isProcessingQueue = false;
let activeBatchId = null;
let currentTabId = null;
let currentAutomationInstance = null;
let currentPelayananRunner = null; // Instance SkriningAutomation aktif untuk Tab Pelayanan
let currentActiveTablePatient = null; // Pasien tabel yang sedang dalam proses pemeriksaan aktif
let isBatchPelayananRunning = false;
let isBatchPelayananCancelled = false;

// Buka side panel saat icon diklik
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Konfigurasi Rule DNR: Pastikan setiap request ke form.kemkes.go.id selalu memiliki Referer & Origin resmi Kemenkes (mencegah 403 Forbidden)
async function setupRefererRules() {
  try {
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001],
        addRules: [
          {
            id: 1001,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                { header: "Referer", operation: "set", value: "https://sehatindonesiaku.kemkes.go.id/" },
                { header: "Origin", operation: "set", value: "https://sehatindonesiaku.kemkes.go.id" }
              ]
            },
            condition: {
              urlFilter: "||form.kemkes.go.id",
              resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
            }
          }
        ]
      });
      console.log("[Background] DeclarativeNetRequest Referer Rule 1001 aktif.");
    }
  } catch (e) {
    console.warn("[Background] setupRefererRules error:", e.message);
  }
}
setupRefererRules();

// Handler Alarms untuk keep-alive service worker & antrean
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "CKG_UNATTENDED_HEARTBEAT") {
    console.log("[Heartbeat] Service Worker alive at", new Date().toLocaleTimeString());
    // Periksa jika antrean seharusnya jalan tapi terhenti
    if (isQueueRunning && !isQueuePaused && activeBatchId) {
      processNextQueueItem();
    }
  }
});

// Broadcast status ke UI (Sidepanel & Popup)
function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// Catat histori pelayanan pasien untuk Tab Ekspor Laporan
async function recordServiceHistory(record) {
  try {
    const { ckg_service_history = [] } = await chrome.storage.local.get("ckg_service_history");
    const idx = ckg_service_history.findIndex(h => h.nik && h.nik === record.nik);
    if (idx >= 0) {
      ckg_service_history[idx] = { ...ckg_service_history[idx], ...record };
    } else {
      ckg_service_history.unshift(record);
    }
    if (ckg_service_history.length > 500) ckg_service_history.length = 500;
    await chrome.storage.local.set({ ckg_service_history });
    broadcast({ type: "SERVICE_HISTORY_UPDATED", history: ckg_service_history });
  } catch (err) {
    console.warn("Gagal mencatat service history:", err);
  }
}

// Ambil Tab CKG aktif atau buat tab baru bila belum ada
async function getOrCreateCkgTab(preferredUrl = "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu") {
  const targetPath = preferredUrl ? preferredUrl.replace(/^https?:\/\/[^\/]+/, "").split("?")[0] : "";

  // 1. Cek tab yang sedang aktif di window pengguna
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab && activeTab.url && activeTab.url.includes("sehatindonesiaku.kemkes.go.id")) {
      currentTabId = activeTab.id;
      // Jika caller meminta URL spesifik (misal ckg-pelayanan) tapi activeTab ada di halaman lain (misal pendaftaran)
      if (targetPath && !activeTab.url.includes(targetPath)) {
        await chrome.tabs.update(activeTab.id, { url: preferredUrl, active: true });
        const startNav = Date.now();
        while (Date.now() - startNav < 12000) {
          await new Promise(r => setTimeout(r, 400));
          const t = await chrome.tabs.get(activeTab.id).catch(() => null);
          if (t?.status === "complete" && t.url && t.url.includes(targetPath)) {
            await new Promise(r => setTimeout(r, 800));
            await UnattendedManager.ensureTabHealthy(currentTabId);
            return t;
          }
        }
      }
      await UnattendedManager.ensureTabHealthy(currentTabId);
      return activeTab;
    }
  } catch (e) {}

  // 2. Cek tab tersimpan
  if (currentTabId) {
    try {
      const tab = await chrome.tabs.get(currentTabId);
      if (tab && tab.url && tab.url.includes("sehatindonesiaku.kemkes.go.id")) {
        if (targetPath && !tab.url.includes(targetPath)) {
          await chrome.tabs.update(tab.id, { url: preferredUrl, active: true });
          const startNav = Date.now();
          while (Date.now() - startNav < 12000) {
            await new Promise(r => setTimeout(r, 400));
            const t = await chrome.tabs.get(tab.id).catch(() => null);
            if (t?.status === "complete" && t.url && t.url.includes(targetPath)) {
              await new Promise(r => setTimeout(r, 800));
              await UnattendedManager.ensureTabHealthy(currentTabId);
              return t;
            }
          }
        }
        await UnattendedManager.ensureTabHealthy(currentTabId);
        return tab;
      }
    } catch (e) {
      currentTabId = null;
    }
  }

  // 3. Cari tab lain yang sedang membuka kemkes
  const tabs = await chrome.tabs.query({ url: "*://sehatindonesiaku.kemkes.go.id/*" });
  if (tabs.length > 0) {
    const matched = tabs.find(t => targetPath && t.url && t.url.includes(targetPath)) || tabs[0];
    currentTabId = matched.id;
    if (targetPath && !matched.url.includes(targetPath)) {
      await chrome.tabs.update(matched.id, { url: preferredUrl, active: true });
      await new Promise(r => setTimeout(r, 1500));
    }
    await UnattendedManager.ensureTabHealthy(currentTabId);
    return matched;
  }

  // 4. Buat tab baru jika tidak ada sama sekali
  const newTab = await chrome.tabs.create({ url: preferredUrl });
  currentTabId = newTab.id;
  await UnattendedManager.ensureTabHealthy(currentTabId);
  await new Promise(r => setTimeout(r, 2000));
  return newTab;
}

// Dapatkan tab pemeriksaan aktif (Umum maupun Sekolah)
async function getDetailPemeriksaanTab() {
  // 1. Prioritas TERTINGGI: tab aktif di window browser pengguna
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab && activeTab.url && activeTab.url.includes("sehatindonesiaku.kemkes.go.id")) {
      currentTabId = activeTab.id;
      return activeTab;
    }
  } catch (e) {}

  // 2. Cek tab tersimpan jika masih valid
  if (currentTabId) {
    try {
      const tab = await chrome.tabs.get(currentTabId);
      if (tab && tab.url && tab.url.includes("sehatindonesiaku.kemkes.go.id")) {
        return tab;
      }
    } catch (e) {
      currentTabId = null;
    }
  }

  // 3. Cari tab yang secara eksplisit membuka detail-pemeriksaan
  const allTabs = await chrome.tabs.query({ url: "*://sehatindonesiaku.kemkes.go.id/*" });
  const detailTab = allTabs.find(t => t.url && t.url.includes("detail-pemeriksaan"));
  if (detailTab) {
    currentTabId = detailTab.id;
    return detailTab;
  }

  // 4. Cari tab pelayanan terbuka (prioritaskan CKG Umum kecuali preferensi sekolah aktif)
  const storedPel = await chrome.storage.local.get(["ckg_origin_pelayanan_url", "ckg_is_sekolah"]);
  const isSekolahPel = !!storedPel?.ckg_is_sekolah;
  const pelTab = isSekolahPel
    ? allTabs.find(t => t.url && t.url.includes("ckg-pelayanan-sekolah"))
    : (allTabs.find(t => t.url && t.url.includes("ckg-pelayanan") && !t.url.includes("sekolah")) || allTabs.find(t => t.url && t.url.includes("ckg-pelayanan")));
  if (pelTab) {
    currentTabId = pelTab.id;
    return pelTab;
  }

  return await getOrCreateCkgTab("https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan");
}

// Dapatkan tab antrean tabel pelayanan aktif (Umum atau Sekolah)
async function getPelayananQueueTab(preferredTabId = null) {
  const stored = await chrome.storage.local.get(["ckg_origin_pelayanan_url", "ckg_is_sekolah"]);
  const isSekolahPreferred = !!stored?.ckg_is_sekolah;
  const preferredUrl = stored?.ckg_origin_pelayanan_url || (isSekolahPreferred
    ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
    : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan");

  // 0. Jika caller memberikan preferredTabId eksplisit
  if (preferredTabId) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab && tab.url && tab.url.includes("sehatindonesiaku.kemkes.go.id")) {
        currentTabId = tab.id;
        const isSekolah = tab.url.includes("ckg-pelayanan-sekolah");
        const originUrl = isSekolah
          ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
          : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";
        await chrome.storage.local.set({ ckg_origin_pelayanan_url: originUrl, ckg_is_sekolah: isSekolah });
        return tab;
      }
    } catch (e) {}
  }

  // 1. Cek tab kemkes yang sedang aktif di window pengguna yang aktif / terfokus saat ini
  try {
    const [focusedActiveTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (focusedActiveTab && focusedActiveTab.url && focusedActiveTab.url.includes("sehatindonesiaku.kemkes.go.id")) {
      currentTabId = focusedActiveTab.id;
      const isSekolah = focusedActiveTab.url.includes("ckg-pelayanan-sekolah");
      const originUrl = isSekolah
        ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
        : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";
      await chrome.storage.local.set({ ckg_origin_pelayanan_url: originUrl, ckg_is_sekolah: isSekolah });
      return focusedActiveTab;
    }
  } catch (e) {}

  // 1b. Cek tab kemkes aktif di window manapun
  try {
    const allKemkesTabs = await chrome.tabs.query({ url: "*://sehatindonesiaku.kemkes.go.id/*" });
    const activeTab = allKemkesTabs.find(t => t.active);
    if (activeTab && activeTab.url) {
      currentTabId = activeTab.id;
      const isSekolah = activeTab.url.includes("ckg-pelayanan-sekolah");
      const originUrl = isSekolah
        ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
        : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";
      await chrome.storage.local.set({ ckg_origin_pelayanan_url: originUrl, ckg_is_sekolah: isSekolah });
      return activeTab;
    }
  } catch (e) {}

  // 2. Cek tab tersimpan
  if (currentTabId) {
    try {
      const tab = await chrome.tabs.get(currentTabId);
      if (tab && tab.url && tab.url.includes("sehatindonesiaku.kemkes.go.id")) {
        return tab;
      }
    } catch (e) {
      currentTabId = null;
    }
  }

  // 3. Cari tab antrean terbuka dengan memprioritaskan origin yang sesuai preferensi (Umum vs Sekolah)
  const allTabs = await chrome.tabs.query({ url: "*://sehatindonesiaku.kemkes.go.id/*" });
  if (isSekolahPreferred) {
    const sekolahTab = allTabs.find(t => t.url && t.url.includes("ckg-pelayanan-sekolah") && !t.url.includes("detail-pemeriksaan"));
    if (sekolahTab) {
      currentTabId = sekolahTab.id;
      return sekolahTab;
    }
  } else {
    // Prioritaskan CKG Umum (bukan sekolah)
    const umumTab = allTabs.find(t => t.url && t.url.includes("ckg-pelayanan") && !t.url.includes("sekolah") && !t.url.includes("detail-pemeriksaan"));
    if (umumTab) {
      currentTabId = umumTab.id;
      return umumTab;
    }
  }

  const anyQueueTab = allTabs.find(t => t.url && (t.url.includes("ckg-pelayanan") || t.url.includes("ckg-pelayanan-sekolah")) && !t.url.includes("detail-pemeriksaan"));
  if (anyQueueTab) {
    currentTabId = anyQueueTab.id;
    return anyQueueTab;
  }

  if (allTabs.length > 0) {
    currentTabId = allTabs[0].id;
    return allTabs[0];
  }

  return await getOrCreateCkgTab(preferredUrl);
}

// Runner Pipeline Utama untuk Setiap Peserta
async function processParticipantPipeline(participant, tabId) {
  let { id, batchId, category, nik, nama } = participant;
  let savedSekolah = participant.sekolah || participant.namaSekolah || participant.namasekolah || null;
  let savedKelas = participant.kelas || participant.tingkatKelas || participant.tingkat || participant.jenjang || null;

  // Hanya jika benar-benar ada nama sekolah maka peserta diproses sebagai CKG Sekolah!
  const hasActualSchoolName = Boolean(savedSekolah && String(savedSekolah).trim() !== "" && String(savedSekolah).trim() !== "-");
  const isSekolah = (category === "SEKOLAH" || (participant.kategori || "").toUpperCase() === "SEKOLAH") && hasActualSchoolName;
  if (!isSekolah) {
    category = "UMUM";
    if (participant.category === "SEKOLAH") participant.category = "UMUM";
    if (participant.kategori === "SEKOLAH") participant.kategori = "UMUM";
  }

  broadcast({
    type: "PARTICIPANT_PROGRESS",
    id,
    nik,
    nama,
    stage: "STARTING",
    status: "IN_PROGRESS",
    message: `Memulai otomasi untuk ${nama} (${nik})`
  });

  // 1. TAHAP PENDAFTARAN & KONFIRMASI HADIR
  await updateParticipantStatus(id, { status: "IN_PROGRESS", stage: "REGISTRATION" });
  await appendLog({ batchId, participantId: id, message: `Mulai tahap pendaftaran untuk ${nama}` });

  let nomorTiket = participant.ticketNumber || participant.nomorTiket || null;
  let pendaftaranStatus = null;
  let pendaftaranErrorMsg = null;

  // VALIDASI PRA-PENDAFTARAN (CKG SEKOLAH & WALI BALITA/ANAK) AGAR TIDAK STUCK / LAMA
  if (isSekolah && (!savedSekolah || !savedKelas || String(savedSekolah).trim() === "" || String(savedKelas).trim() === "")) {
    const errorMsg = "Data Nama Sekolah atau Jenjang Kelas kosong di sumber data (CKG Sekolah)";
    await updateParticipantStatus(id, { status: "INVALID", stage: "REGISTRATION", errorMsg });
    await appendLog({ batchId, participantId: id, level: "WARN", message: `Data ${nama} (${nik}) tidak valid: ${errorMsg}` });
    try {
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: "—",
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: "Usia Sekolah",
        statusSkrining: "Tidak Valid",
        statusRaport: "Data Tidak Valid",
        keterangan: `Pendaftaran Dibatalkan: ${errorMsg}`,
        kategori: "SEKOLAH"
      });
    } catch(e) {}
    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "REGISTRATION", status: "INVALID", message: `${errorMsg} (${nama})` });
    const statsInvalid = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsInvalid });
    return;
  }

  const ageObjPre = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
  // KHUSUS CKG ANAK SEKOLAH: BISA DAFTAR TANPA WALI (ACUHKAN WALI!)
  // Untuk umum, wali hanya wajib bagi Balita (< 7 thn) atau peserta tanpa NIK valid
  const cleanParticipantNik = String(participant.nik || "").replace(/\D/g, "");
  const hasNikPre = cleanParticipantNik.length === 16;
  const isMinorNeedsWali = !isSekolah && (category === "BALITA" || category === "BAYI" || (ageObjPre && ageObjPre.years < 7) || !hasNikPre);
  const hasWaliData = !!(participant.namaWali || participant.nama_wali || participant.wali || participant.parentName || participant.guardianName || participant.nikWali || participant.nik_wali);
  
  // Muat Hardlock Data Wali dari ckg_hardlock_wali maupun ckg_config (diatur user di UI)
  const { ckg_hardlock_wali: hlWali, ckg_config: userCfgPre } = await chrome.storage.local.get(["ckg_hardlock_wali", "ckg_config"]).catch(() => ({}));
  const cleanHlNik = String(hlWali?.nikWali || hlWali?.nik || userCfgPre?.defaultNikWali || "").replace(/\D/g, "");
  const cleanHlNama = String(hlWali?.namaWali || hlWali?.nama || userCfgPre?.defaultNamaWali || "").trim();
  const hasConfigWali = Boolean(cleanHlNik.length === 16 || cleanHlNama.length >= 2);

  // Jika pasien anak/balita/tanpa NIK dan belum memiliki data wali di Excel, otomatis pasang Hardlock Wali ke peserta!
  if (isMinorNeedsWali && hasConfigWali) {
    if (!participant.nikWali && cleanHlNik) participant.nikWali = cleanHlNik;
    if (!participant.namaWali && cleanHlNama) participant.namaWali = cleanHlNama;
    if (!participant.tanggalLahirWali && (hlWali?.tglLahirWali || hlWali?.tanggalLahirWali || userCfgPre?.defaultTanggalLahirWali)) {
      participant.tanggalLahirWali = hlWali?.tglLahirWali || hlWali?.tanggalLahirWali || userCfgPre?.defaultTanggalLahirWali;
    }
    if (!participant.jenisKelaminWali && (hlWali?.jkWali || hlWali?.jenisKelaminWali || userCfgPre?.defaultJenisKelaminWali)) {
      participant.jenisKelaminWali = hlWali?.jkWali || hlWali?.jenisKelaminWali || userCfgPre?.defaultJenisKelaminWali;
    }
    if (!participant.noHpWali && (hlWali?.noHpWali || hlWali?.noHp || userCfgPre?.defaultNoHpWali)) {
      participant.noHpWali = hlWali?.noHpWali || hlWali?.noHp || userCfgPre?.defaultNoHpWali;
    }
  }

  // HANYA jika peserta BENAR-BENAR TIDAK MEMILIKI NIK 16 digit (harus centang 'Tidak punya NIK' yang wajib wali)
  // DAN sama sekali tidak punya data wali (baik di Excel maupun Hardlock), barulah ditandai Invalid!
  if (!hasNikPre && !hasWaliData && !hasConfigWali && !nomorTiket) {
    const errorMsg = "Data Nama/NIK Wali kosong di sumber data pasien anak tanpa NIK (Harap isi Hardlock Data Wali di UI)";
    await updateParticipantStatus(id, { status: "INVALID", stage: "REGISTRATION", errorMsg });
    await appendLog({ batchId, participantId: id, level: "WARN", message: `Data ${nama} (${nik}) tidak valid: ${errorMsg}` });
    try {
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObjPre?.text || "—",
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: category || "Umum",
        statusSkrining: "Tidak Valid",
        statusRaport: "Data Tidak Valid",
        keterangan: `Pendaftaran Dibatalkan: ${errorMsg}`,
        kategori: category || "UMUM"
      });
    } catch(e) {}
    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "REGISTRATION", status: "INVALID", message: `${errorMsg} (${nama})` });
    const statsInvalid = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsInvalid });
    return;
  }

  try {
    const pendaftaranPromise = new Promise((resolve, reject) => {
      const runner = new PendaftaranAutomation({
        tabId,
        patient: participant,
        patientIndex: id,
        delayMultiplier: 1,
        category,
        onStatus: async (status, ticket, errorMsg, extra) => {
          pendaftaranStatus = status;
          if (errorMsg) pendaftaranErrorMsg = errorMsg;
          if (ticket) nomorTiket = ticket;
          if (extra?.sekolah) savedSekolah = extra.sekolah;
          if (extra?.kelas) savedKelas = extra.kelas;
          if (status === "done") resolve({ ok: true, ticket });
          else if (status === "already-screened") resolve({ ok: true, ticket, note: "already-screened" });
          else if (status === "invalid-nik") resolve({ ok: false, status: "invalid-nik", errorMsg });
          else if (status === "invalid-data") resolve({ ok: false, status: "invalid-data", errorMsg });
          else if (status === "error") resolve({ ok: false, status: "error", errorMsg });
          else if (status === "stopped") reject(new Error("Otomasi dihentikan"));
          else resolve({ ok: false, status: status || "error", errorMsg });
        }
      });
      currentAutomationInstance = runner;
      runner.run().catch(reject);
    });

    await pendaftaranPromise;
  } catch (err) {
    console.warn("Pendaftaran catatan:", err.message);
  }

  if (isQueuePaused || !isQueueRunning) {
    await updateParticipantStatus(id, { status: "READY", stage: "IMPORTED" });
    const statsPaused = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsPaused });
    return;
  }

  // Jika NIK invalid atau data invalid, tandai INVALID, langsung catat ke Tab Laporan, dan lanjut ke antrean berikutnya
  if (pendaftaranStatus === "invalid-nik" || pendaftaranStatus === "invalid-data") {
    const errorDisplay = pendaftaranErrorMsg || (pendaftaranStatus === "invalid-nik" ? "NIK tidak valid di sistem CKG" : "Data peserta tidak valid di Excel / CKG");
    await updateParticipantStatus(id, { status: "INVALID", stage: "REGISTRATION", errorMsg: errorDisplay });
    await appendLog({ batchId, participantId: id, level: "WARN", message: `Data tidak valid untuk ${nama} (${nik}): ${errorDisplay}` });

    try {
      const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
      const lifecycle = getLifeCycleCategory(ageObj.years);
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObj.text || "—",
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: lifecycle,
        statusSkrining: "Tidak Valid",
        statusRaport: "Data Tidak Valid",
        keterangan: `Pendaftaran Gagal: ${errorDisplay}`,
        kategori: category || "UMUM"
      });
    } catch(e) {}

    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "REGISTRATION", status: "INVALID", message: `${errorDisplay} (${nama})` });
    const statsInvalid = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsInvalid });
    return;
  }

  // Jika sudah pernah diskrining atau terdaftar di CKG
  if (pendaftaranStatus === "already-screened") {
    await updateParticipantStatus(id, {
      status: "ALREADY_SCREENED",
      stage: "CONFIRM_HADIR",
      ticketNumber: nomorTiket,
      errorMsg: "Sudah terdaftar di CKG"
    });
    await appendLog({ batchId, participantId: id, message: `NIK ${nik} (${nama}) terdeteksi: SUDAH TERDAFTAR DI CKG. Dicatat ke Laporan...` });
    
    // Catat ke Tab Laporan secara instan
    try {
      const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
      const lifecycle = getLifeCycleCategory(ageObj.years);
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObj.text,
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: lifecycle,
        statusSkrining: "Sudah di CKG",
        statusRaport: "Sudah Terdaftar",
        keterangan: nomorTiket ? `Sudah Pernah Terdaftar di CKG (Tiket: ${nomorTiket})` : "Sudah Pernah Terdaftar di CKG",
        kategori: category || "UMUM"
      });
    } catch (e) {}

    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "CONFIRM_HADIR", status: "ALREADY_SCREENED", message: `Sudah terdaftar di CKG (${nama})` });
    const statsAlready = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsAlready });
    return;
  }

  // Jika data tidak valid (misal form tidak lengkap / balita tanpa wali)
  if (pendaftaranStatus === "invalid-data") {
    await updateParticipantStatus(id, {
      status: "INVALID",
      stage: "REGISTRATION",
      errorMsg: pendaftaranErrorMsg || "Data pendaftaran tidak valid"
    });
    await appendLog({ batchId, participantId: id, level: "WARN", message: `Data tidak valid untuk ${nama}: ${pendaftaranErrorMsg || "Form belum lengkap"}` });
    
    // Catat ke Tab Laporan secara instan
    try {
      const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
      const lifecycle = getLifeCycleCategory(ageObj.years);
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObj.text,
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: lifecycle,
        statusSkrining: "Tidak Valid",
        statusRaport: "Data Tidak Valid",
        keterangan: pendaftaranErrorMsg || "Data pendaftaran tidak lengkap",
        kategori: category || "UMUM"
      });
    } catch (e) {}

    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "REGISTRATION", status: "INVALID", message: `Data tidak valid (${nama})` });
    const statsInvalid = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsInvalid });
    return;
  }

  // Jika pendaftaran gagal karena error server / data tidak valid / tiket tidak terbit
  if (pendaftaranStatus === "error" || !nomorTiket || pendaftaranStatus !== "done") {
    await updateParticipantStatus(id, {
      status: "ERROR",
      stage: "REGISTRATION",
      errorMsg: pendaftaranErrorMsg || "Pendaftaran gagal (error server CKG atau nomor tiket belum terbit)"
    });
    await appendLog({ batchId, participantId: id, level: "ERROR", message: `Pendaftaran GAGAL untuk ${nama} (${nik}): ${pendaftaranErrorMsg || "status=" + (pendaftaranStatus || "null")}` });

    try {
      const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
      const lifecycle = getLifeCycleCategory(ageObj.years);
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObj.text,
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: lifecycle,
        statusSkrining: "Gagal",
        statusRaport: "Pendaftaran Gagal",
        keterangan: "Pendaftaran gagal: error server CKG atau data tidak valid",
        kategori: category || "UMUM"
      });
    } catch (e) {}

    broadcast({ type: "PARTICIPANT_PROGRESS", id, nik, stage: "REGISTRATION", status: "ERROR", message: `Pendaftaran gagal (${nama})` });
    const statsError = await getQueueStats(batchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsError });
    return;
  }

  {
    const isSekolahPart = category === "SEKOLAH" || (participant.kategori || '').toUpperCase() === 'SEKOLAH' || !!savedSekolah || !!participant.sekolah;
    const finalSekolah = savedSekolah || participant.sekolah || participant.namasekolah || participant.namaSekolah || "";
    const finalKelas = savedKelas || participant.kelas || participant.tingkat || participant.jenjang || participant.tingkatKelas || "";

    // Update status tiket & tandai registrasi selesai dan data valid serta SIMPAN NAMA SEKOLAH & KELAS
    await updateParticipantStatus(id, {
      status: "COMPLETED",
      validStatus: "VALID",
      stage: "CONFIRM_HADIR",
      ticketNumber: nomorTiket,
      nomorTiket: nomorTiket,
      sekolah: finalSekolah,
      namaSekolah: finalSekolah,
      kelas: finalKelas,
      tingkatKelas: finalKelas,
      category: isSekolahPart ? "SEKOLAH" : (category || "UMUM")
    });

    if (isSekolahPart && (finalSekolah || finalKelas)) {
      await chrome.storage.local.set({
        ckg_saved_school_name: finalSekolah,
        ckg_saved_school_class: finalKelas,
        ckg_is_sekolah: true
      });
    }

    // Catat ke Tab Laporan secara instan bahwa pendaftaran berhasil & tiket terbit
    try {
      const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
      const lifecycle = getLifeCycleCategory(ageObj.years);
      await recordServiceHistory({
        id: "HIST-" + Date.now(),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: nik || "—",
        nama: nama || "—",
        usia: ageObj.text,
        gender: participant.jenis_kelamin || participant.gender || "—",
        siklusHidup: lifecycle,
        statusSkrining: "Terdaftar",
        statusRaport: nomorTiket ? `Valid (Tiket: ${nomorTiket})` : "Valid (Terdaftar)",
        keterangan: nomorTiket ? `Pendaftaran Sukses & Terbit Tiket: ${nomorTiket}${finalSekolah ? ` [${finalSekolah} (${finalKelas})]` : ''}` : "Pendaftaran Berhasil Disimpan",
        kategori: isSekolahPart ? "SEKOLAH" : (category || "UMUM")
      });
    } catch (e) {}
  }

  // Sinkronisasi otomatis ke chrome.storage.local agar Tab Pasien langsung sinkron
  try {
    const registered = await getAllRegisteredPatients();
    await chrome.storage.local.set({ ckg_registered_patients: registered });
  } catch (syncErr) {
    console.warn("Gagal sinkronisasi registered patients ke chrome.storage.local:", syncErr);
  }

  await appendLog({
    batchId,
    participantId: id,
    message: `✓ Pasien ${nama} (${nik}) selesai pendaftaran & konfirmasi hadir. Nomor Tiket: ${nomorTiket || "—"}`
  });

  broadcast({
    type: "PARTICIPANT_PROGRESS",
    id,
    nik,
    nama,
    stage: "CONFIRM_HADIR",
    status: "COMPLETED",
    ticketNumber: nomorTiket,
    message: `✓ Pendaftaran selesai: ${nama} (Tiket: ${nomorTiket || "—"})`
  });

  const statsValid = await getQueueStats(batchId);
  broadcast({ type: "QUEUE_STATS_UPDATE", stats: statsValid });
}

// Helper pencarian cerdas di tabel antrean Web CKG & pembukaan pemeriksaan
async function searchAndOpenPatientExam(tabId, participant, isSekolah, onLog) {
  const originQueueUrl = isSekolah
    ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
    : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

  // 1. Pastikan tab berada di halaman antrean yang tepat
  try {
    const curTab = await chrome.tabs.get(tabId).catch(() => null);
    const isOnTargetQueue = curTab?.url && (
      isSekolah
        ? curTab.url.includes("ckg-pelayanan-sekolah")
        : (curTab.url.includes("ckg-pelayanan") && !curTab.url.includes("ckg-pelayanan-sekolah"))
    ) && !curTab.url.includes("detail-pemeriksaan");

    if (!isOnTargetQueue) {
      onLog?.(`Navigasi tab ke halaman antrean ${isSekolah ? "Sekolah" : "Pelayanan Umum"}...`);
      await chrome.tabs.update(tabId, { url: originQueueUrl, active: true });
      const navStart = Date.now();
      while (Date.now() - navStart < 12000) {
        await new Promise(r => setTimeout(r, 400));
        const t = await chrome.tabs.get(tabId).catch(() => null);
        if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (e) {
    console.warn("[searchAndOpenPatientExam] Navigasi queue tab warning:", e);
  }

  // 2. Terapkan filter sekolah/kelas (jika sekolah) atau filter tanggal (jika umum)
  let sch = "";
  let cls = "";
  if (isSekolah) {
    sch = participant.sekolah || participant.namaSekolah || participant.namasekolah || "";
    cls = participant.kelas || participant.tingkatKelas || participant.tingkat || participant.jenjang || "";
    if (!sch || !cls) {
      const stored = await chrome.storage.local.get(["ckg_saved_school_name", "ckg_saved_school_class"]);
      if (!sch) sch = stored?.ckg_saved_school_name || "";
      if (!cls) cls = stored?.ckg_saved_school_class || "";
    }
    if ((!sch || !cls) && participant.batchId) {
      const batchItems = await getQueueByBatch(participant.batchId).catch(() => []);
      const sib = batchItems.find(it => it.sekolah || it.namasekolah || it.namaSekolah);
      if (sib) {
        if (!sch) sch = sib.sekolah || sib.namasekolah || sib.namaSekolah || "";
        if (!cls) cls = sib.kelas || sib.tingkat || sib.jenjang || sib.tingkatKelas || "";
      }
    }
    onLog?.(`Menyesuaikan filter sekolah [${sch || 'Sekolah'} (${cls || 'Kelas'})] & memuat tabel CKG Sekolah...`);
    await ensureQueuePageSchoolFilter(tabId, sch, cls);
    await new Promise(r => setTimeout(r, 1200));
  } else {
    const stored = await chrome.storage.local.get("ckg_saved_pelayanan_date_filter");
    if (stored?.ckg_saved_pelayanan_date_filter) {
      onLog?.(`Memeriksa filter tanggal pelayanan: ${stored.ckg_saved_pelayanan_date_filter}`);
      await ensureQueuePageDateFilter(tabId, stored.ckg_saved_pelayanan_date_filter);
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  // 3. Eksekusi pencarian pasien di Web CKG dan buka pemeriksaan
  const cleanNik = String(participant.nik || "").replace(/\D/g, "").trim();
  const ticketNumber = (participant.ticketNumber || participant.nomorTiket || "").trim();
  const nama = (participant.nama || "").trim();

  if (isSekolah) {
    onLog?.(`Mencari data siswa via Nomor Tiket [Tiket: ${ticketNumber || '—'}, Nama: ${nama}]...`);
  } else {
    onLog?.(`Mencari data pasien via NIK / Nama [NIK: ${cleanNik || '—'}, Nama: ${nama}]...`);
  }
  const searchResult = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (pNik, pTicket, pNama, isSekolahPage, pSchool, pClass) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const clean = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
      const triggerClick = el => {
        if (!el) return;
        const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, td, span") || el;
        target.focus?.();
        const opts = { bubbles: true, cancelable: true, view: window };
        try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
        try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
        try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
        try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
        try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
        if (typeof target.click === "function") {
          try { target.click(); } catch(e) {}
        }
      };

      // 0a. Khusus CKG Sekolah: Pastikan filter sekolah dan kelas sudah diterapkan di form filter kiri
      if (isSekolahPage) {
        const btnCari = Array.from(document.querySelectorAll('button, a, div[role="button"], div.cursor-pointer, .btn')).find(b => {
          const t = clean(b.innerText || b.textContent || '').toLowerCase();
          return t.includes('tampilkan pencarian') || t === 'cari';
        });

        const filterCard = btnCari ? (btnCari.closest('div.bg-white, div.border, div.rounded-xl, div.rounded-lg, form, div.shadow-sm') || btnCari.parentElement?.parentElement) : document;

        const allCandidates = Array.from((filterCard || document).querySelectorAll('button, div.cursor-pointer, [role="combobox"], [role="button"], div.relative, select, span.cursor-pointer, input')).filter(el => {
          if (el === btnCari || (btnCari && btnCari.contains(el))) return false;
          if (el.children.length > 3) return false;
          return true;
        });

        let schTrig = allCandidates.find(el => {
          const t = clean(el.innerText || el.textContent || el.value || el.placeholder || '').toLowerCase();
          return t === 'pilih sekolah' || t.includes('pilih sekolah');
        });

        let clsTrig = allCandidates.find(el => {
          const t = clean(el.innerText || el.textContent || el.value || el.placeholder || '').toLowerCase();
          return t === 'pilih kelas' || t.includes('pilih kelas');
        });

        if (schTrig || clsTrig) {
          if (schTrig && pSchool) {
            triggerClick(schTrig);
            await wait(600);
            const searchInp = document.querySelector('input[placeholder*="Cari" i], input[type="search"], input.vs__search, .multiselect__input, input.dropdown-search');
            if (searchInp) {
              searchInp.focus();
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(searchInp, pSchool);
              else searchInp.value = pSchool;
              searchInp.dispatchEvent(new Event('input', { bubbles: true }));
              searchInp.dispatchEvent(new Event('change', { bubbles: true }));
              await wait(500);
            }
            const opts = Array.from(document.querySelectorAll('button, li, [role="option"], div.cursor-pointer, div.border-b, div[class*="py-"], span, div')).filter(el => {
              if (el === schTrig || (schTrig && schTrig.contains(el))) return false;
              if (el.querySelector('input') || el.querySelector('h1, h2, h3, h4')) return false;
              if (el.children.length > 2) return false;
              const t = clean(el.innerText || el.textContent || '');
              return t.length > 2 && t.length < 80 && !/^pilih\s+(sekolah|kelas|jenjang)/i.test(t);
            });
            const m = opts.find(el => clean(el.innerText || '').includes(clean(pSchool)) || clean(pSchool).includes(clean(el.innerText || '')));
            if (m) { triggerClick(m); await wait(500); }
          }

          if (clsTrig && pClass) {
            triggerClick(clsTrig);
            await wait(600);
            const opts = Array.from(document.querySelectorAll('button, li, [role="option"], div.cursor-pointer, div.border-b, div[class*="py-"], span, div')).filter(el => {
              if (el === clsTrig || (clsTrig && clsTrig.contains(el))) return false;
              if (el.querySelector('input') || el.querySelector('h1, h2, h3, h4')) return false;
              if (el.children.length > 2) return false;
              const t = clean(el.innerText || el.textContent || '');
              return t.length > 0 && t.length < 40 && !/^pilih\b/i.test(t);
            });
            const clsDig = String(pClass).replace(/[^0-9]/g, '');
            const m = opts.find(el => {
              const t = clean(el.innerText || '').toLowerCase();
              return t === clean(pClass).toLowerCase() || (clsDig && t.replace(/[^0-9]/g, '') === clsDig);
            });
            if (m) { triggerClick(m); await wait(500); }
          }

          if (btnCari) {
            triggerClick(btnCari);
            if (typeof btnCari.click === 'function') { try { btnCari.click(); } catch(e) {} }
            await wait(1500);
          }
        }
      }

      // 0b. Khusus CKG Sekolah: Cek apakah baris siswa sudah langsung ada di tabel antrean sekolah yang tampil
      if (isSekolahPage) {
        const tbody = document.querySelector('.table-individu-terdaftar table tbody, table.table-pelayanan tbody, table tbody');
        if (tbody) {
          const curRows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
            if (r.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
            const txt = clean(r.innerText || '');
            return txt.length > 5 && !txt.includes('tidak ditemukan') && !txt.includes('belum ada data');
          });
          const directMatch = curRows.find(r => {
            const txt = clean(r.innerText || '');
            if (pTicket && pTicket.length >= 3 && pTicket !== '—' && txt.includes(clean(pTicket))) return true;
            if (pNama && pNama.length >= 3 && txt.includes(clean(pNama))) return true;
            return false;
          });
          if (directMatch) {
            const btnMulai = Array.from(directMatch.querySelectorAll("button, a, [role='button']")).find(b => {
              const t = clean(b.innerText || b.textContent || "");
              return (t === "mulai" || t.includes("mulai") || t === "periksa" || t === "lanjut" || t.includes("lanjut")) && !b.disabled;
            }) || directMatch.querySelector("button:not([disabled])");
            if (btnMulai) {
              triggerClick(btnMulai);
              await wait(600);
              // Handle date modal if any
              for (let iter = 0; iter < 10; iter++) {
                const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
                  if (el.children.length > 3) return false;
                  return clean(el.innerText || el.textContent || "").includes("konfirmasi tanggal pemeriksaan");
                });
                if (heading) {
                  const modal = heading.closest("div.fixed, div[role='dialog'], .modal, div.z-2000, div.z-50") || heading.parentElement?.parentElement;
                  const todayCell = modal?.querySelector("td.today, td.current, td.active, .mx-date-row td.today, button.relative.h-auto");
                  if (todayCell) { triggerClick(todayCell); await wait(200); }
                  const simpanBtn = Array.from((modal || document).querySelectorAll("button, a, .btn")).find(b => {
                    const txt = clean(b.textContent || b.innerText || "");
                    return !b.disabled && (txt === "simpan" || txt.includes("simpan"));
                  });
                  if (simpanBtn) { triggerClick(simpanBtn); await wait(600); break; }
                }
                await wait(200);
              }
              return { ok: true, status: "OPENED", tab: "Tabel Sekolah Langsung" };
            }
          }
        }
      }

      // 0b. Tunggu search input tersedia di DOM
      let searchInput = null;
      for (let i = 0; i < 20; i++) {
        searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i], input[placeholder*="nik" i], input[placeholder*="cari" i], input[placeholder*="search" i], input[type="search"], .input-group input, .table-filter input, .search-box input');
        if (searchInput) break;
        await wait(250);
      }
      if (!searchInput && isSekolahPage) {
        // Coba klik tombol "Tampilkan Pencarian" jika input belum muncul di halaman sekolah
        const btnCari = Array.from(document.querySelectorAll('button, a, div[role="button"], div.cursor-pointer, .btn')).find(b => {
          const t = clean(b.innerText || b.textContent || '').toLowerCase();
          return t.includes('tampilkan pencarian') || t === 'cari';
        });
        if (btnCari) {
          triggerClick(btnCari);
          if (typeof btnCari.click === 'function') { try { btnCari.click(); } catch(e) {} }
          await wait(1500);
          searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i], input[placeholder*="nik" i], input[placeholder*="cari" i], input[placeholder*="search" i], input[type="search"], .input-group input, .table-filter input, .search-box input');
        }
      }
      if (!searchInput) {
        // Jika di halaman sekolah dan input search tidak ada, cek apakah tabel sudah menampilkan baris siswa langsung
        if (isSekolahPage) {
          const tbody = document.querySelector('.table-individu-terdaftar table tbody, table.table-pelayanan tbody, table tbody');
          if (tbody) {
            const curRows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
              if (r.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
              const txt = clean(r.innerText || '');
              return txt.length > 5 && !txt.includes('tidak ditemukan') && !txt.includes('belum ada data');
            });
            const directMatch = curRows.find(r => {
              const txt = clean(r.innerText || '');
              if (pTicket && pTicket.length >= 3 && pTicket !== '—' && txt.includes(clean(pTicket))) return true;
              if (pNama && pNama.length >= 3 && txt.includes(clean(pNama))) return true;
              return false;
            });
            if (directMatch) {
              const btnMulai = Array.from(directMatch.querySelectorAll("button, a, [role='button']")).find(b => {
                const t = clean(b.innerText || b.textContent || "");
                return (t === "mulai" || t.includes("mulai") || t === "periksa" || t === "lanjut" || t.includes("lanjut")) && !b.disabled;
              }) || directMatch.querySelector("button:not([disabled])");
              if (btnMulai) {
                triggerClick(btnMulai);
                await wait(600);
                await handleDateModal();
                return { ok: true, status: "OPENED", tab: "Tabel Sekolah Terbuka Langsung" };
              }
            }
          }
        }
        return { ok: false, error: "Input pencarian (#searchNik) tidak ditemukan di halaman antrean" };
      }

      // Helper deteksi kriteria pencarian yang sedang aktif di UI
      const getActiveCriteria = () => {
        const ph = clean(searchInput.placeholder || "").toLowerCase();
        if (ph.includes("tiket") || ph.includes("ticket")) return "Nomor Tiket";
        if (ph.includes("nik")) return "NIK";
        if (ph.includes("nama") || ph.includes("name")) return "Nama";

        const container = searchInput.closest('div.flex, form, .input-group, div.grid, div.w-full.flex, div[class*="search"]') || searchInput.parentElement?.parentElement || document;
        const trigs = Array.from(container.querySelectorAll('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2')).filter(el => {
          if (el.contains(searchInput) || el === searchInput || el.tagName === 'INPUT') return false;
          if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
          const t = clean(el.innerText || el.textContent || '').toLowerCase();
          return /^(nama|nomor tiket|no\.?\s*tiket|nik|mitra|tiket|ticket)$/i.test(t) || t === 'nama' || t.includes('tiket');
        });
        if (trigs.length > 0) {
          const t = clean(trigs[0].innerText || trigs[0].textContent || "").toLowerCase();
          if (t.includes("tiket") || t.includes("ticket")) return "Nomor Tiket";
          if (t === "nik" || t.includes("nik")) return "NIK";
          if (t === "nama" || t.includes("nama")) return "Nama";
        }
        return "Nama";
      };

      // Helper temukan trigger dropdown kriteria yang berdampingan dengan #searchNik
      const findCriteriaTrigger = () => {
        const container = searchInput.closest('div.flex, form, .input-group, div.grid, div.w-full.flex, div[class*="search"]') || searchInput.parentElement?.parentElement || document;
        const candidateTriggers = Array.from(container.querySelectorAll('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2')).filter(el => {
          if (el.contains(searchInput) || el === searchInput || el.tagName === 'INPUT') return false;
          if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
          const t = clean(el.innerText || el.textContent || '').toLowerCase();
          return /^(nama|nomor tiket|no\.?\s*tiket|nik|mitra|tiket|ticket)$/i.test(t) || t === 'nama' || t.includes('tiket');
        });
        if (candidateTriggers.length > 0) {
          return candidateTriggers[0].closest('button, [role="combobox"], div.cursor-pointer') || candidateTriggers[0];
        }
        const prevWrap = searchInput.parentElement?.previousElementSibling || searchInput.previousElementSibling;
        if (prevWrap) {
          const btnInside = prevWrap.querySelector('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2');
          if (btnInside) return btnInside.closest('button, [role="combobox"], div.cursor-pointer') || btnInside;
          return prevWrap;
        }
        return document.querySelector('span.line-clamp-2')?.closest('button, div.cursor-pointer') || null;
      };

      // Helper ganti kriteria pencarian (Nama / Nomor Tiket / NIK)
      const setCriteria = async (targetCriteria) => {
        const want = targetCriteria.toLowerCase();
        const cur = getActiveCriteria().toLowerCase();
        if ((want === "nomor tiket" || want === "tiket") && (cur === "nomor tiket" || cur === "tiket")) return true;
        if ((want === "nama" || want === "name") && (cur === "nama" || cur === "name")) return true;
        if (want === "nik" && cur === "nik") return true;

        const trigger = findCriteriaTrigger();
        if (!trigger) return false;
        const clickTarget = trigger.closest('button, [role="combobox"], div.cursor-pointer') || trigger.querySelector('button, [role="combobox"], div.cursor-pointer') || trigger;

        const findOption = () => {
          const poppers = Array.from(document.querySelectorAll('.v-popper__popper, [class*="popper"], div[role="menu"], div[role="listbox"], div.fixed, div.absolute, [data-popper-placement]'));
          let options = [];
          for (const pop of poppers) {
            const items = Array.from(pop.querySelectorAll('div, span, button, li, a, [role="menuitem"], [role="option"]')).filter(el => {
              if (el.children.length > 2) return false;
              const t = clean(el.innerText || el.textContent || '').toLowerCase();
              return t.length >= 2 && t.length < 35;
            });
            options.push(...items);
          }
          if (options.length === 0) {
            options = Array.from(document.querySelectorAll('li, div.cursor-pointer, span.cursor-pointer, button, [role="option"], [role="menuitem"], div[class*="option"], div[class*="dropdown-item"], div[class*="item"]')).filter(el => {
              if (trigger && (el === trigger || trigger.contains(el))) return false;
              if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
              const t = clean(el.innerText || el.textContent || '').toLowerCase();
              return t.length >= 2 && t.length < 35;
            });
          }
          return options.find(el => {
            const t = clean(el.innerText || el.textContent || '').toLowerCase();
            if (want === 'nik') return t === 'nik' || t === 'no. nik' || t === 'no nik' || t.startsWith('nik');
            if (want === 'nama' || want === 'name') return (t === 'name' || t === 'nama' || t.startsWith('nama') || t.startsWith('name')) && !t.includes('tiket');
            if (want === 'nomor tiket' || want === 'tiket') return t.includes('tiket') || t.includes('ticket') || t === 'nomor tiket' || t === 'no. tiket' || t === 'no tiket';
            return false;
          });
        };

        triggerClick(clickTarget);
        await wait(350);
        let matchedOpt = findOption();
        if (!matchedOpt) {
          await wait(250);
          matchedOpt = findOption();
        }
        if (matchedOpt) {
          triggerClick(matchedOpt.closest('.cursor-pointer, button, li, [role="option"]') || matchedOpt);
          await wait(400);
          const updated = getActiveCriteria().toLowerCase();
          if ((want === "nomor tiket" || want === "tiket") && (updated === "nomor tiket" || updated === "tiket")) return true;
          if ((want === "nama" || want === "name") && (updated === "nama" || updated === "name")) return true;
          if (want === "nik" && updated === "nik") return true;
        }

        // Percobaan ulang jika popover sempat tertutup atau terlambat render
        triggerClick(clickTarget);
        await wait(350);
        matchedOpt = findOption();
        if (matchedOpt) {
          triggerClick(matchedOpt.closest('.cursor-pointer, button, li, [role="option"]') || matchedOpt);
          await wait(400);
          const finalMode = getActiveCriteria().toLowerCase();
          if ((want === "nomor tiket" || want === "tiket") && (finalMode === "nomor tiket" || finalMode === "tiket")) return true;
          if ((want === "nama" || want === "name") && (finalMode === "nama" || finalMode === "name")) return true;
          if (want === "nik" && finalMode === "nik") return true;
        }
        return false;
      };

      // Helper ketik pencarian dan submit secara aman tanpa memicu pesan error validasi
      const doSearch = async (val, criteriaName) => {
        const activeMode = getActiveCriteria(); // "Nomor Tiket", "NIK", "Nama"
        let cleanVal = val;

        // PROTEKSI MUTLAK: Jangan biarkan nilai bertolak belakang dengan kriteria aktif di input!
        if (activeMode === "Nama") {
          if (criteriaName === "Nomor Tiket" || criteriaName === "NIK") {
            if (pNama && pNama.trim().length >= 3) {
              cleanVal = pNama.trim(); // Gunakan nama pasien, jangan masukkan nomor tiket ke kolom Nama!
            } else {
              return;
            }
          }
        } else if (activeMode === "Nomor Tiket") {
          if (criteriaName === "Nama") {
            if (pTicket && pTicket.trim().length >= 3 && pTicket !== '—') {
              cleanVal = pTicket.trim();
            } else {
              return;
            }
          }
        } else if (activeMode === "NIK") {
          cleanVal = String(cleanVal).replace(/\D/g, "").trim();
          if (!cleanVal || cleanVal.length < 8) return;
        }

        searchInput.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(searchInput, cleanVal);
        } else {
          searchInput.value = cleanVal;
        }
        if (typeof searchInput._assign === 'function') {
          try { searchInput._assign(cleanVal); } catch(e) {}
        }
        searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: cleanVal }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(150);

        // Enter key events
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

        // Klik tombol search/icon jika ada
        const searchBtn = searchInput.parentElement?.querySelector('button, svg') ||
                          searchInput.closest('.relative, div.flex')?.querySelector('button, svg');
        if (searchBtn) {
          triggerClick(searchBtn);
        }

        if (searchInput.form) {
          try {
            searchInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          } catch(e) {}
        }

        await wait(600);
      };

      // Helper klik tab antrean (Belum, Sedang, Selesai) dengan regex adaptif
      const clickTab = async (tabName) => {
        const isSedang = /sedang/i.test(tabName);
        const isSelesai = /selesai/i.test(tabName);
        const isBelum = /belum/i.test(tabName);

        const tabs = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
          if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
          const t = clean(el.innerText || el.textContent || '');
          if (isSedang) return /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i.test(t);
          if (isSelesai) return /(selesai\s*(pemeriksaan|diperiksa|pelayanan)?)/i.test(t);
          if (isBelum) return /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i.test(t);
          return t.includes(clean(tabName));
        });

        const tabBtn = tabs.find(el => el.classList.contains('cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabs[0];
        if (tabBtn) {
          triggerClick(tabBtn);
          await wait(800);
        }
      };

      // Helper tunggu hasil tabel termuat setelah pencarian
      const waitForTableRows = async (maxWaitMs = 4500) => {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
          const tbody = document.querySelector('.table-individu-terdaftar table tbody, table.table-pelayanan tbody, table tbody');
          if (tbody) {
            const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
              if (r.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
              const txt = clean(r.innerText || '');
              return txt.length > 3;
            });

            // Cek apakah tabel sedang loading spinner
            const isLoading = rows.some(r => {
              const txt = clean(r.innerText || '');
              return txt.includes('memuat data') || txt.includes('loading') || txt.includes('mohon tunggu');
            });

            if (!isLoading) {
              const isExplicitEmpty = rows.some(r => {
                const txt = clean(r.innerText || '');
                return txt.includes('tidak ditemukan') || txt.includes('belum ada data') || txt.includes('lakukan pencarian');
              });
              if (isExplicitEmpty && rows.length <= 2) {
                await wait(350);
                return [];
              }
              const validPatientRows = rows.filter(r => {
                const txt = clean(r.innerText || '');
                return !txt.includes('tidak ditemukan') && !txt.includes('belum ada data') && !txt.includes('lakukan pencarian') && !txt.includes('pencarian terlebih dahulu');
              });
              if (validPatientRows.length > 0) return validPatientRows;
            }
          }
          await wait(250);
        }
        return [];
      };

      // Helper cari baris pasien yang cocok di hasil tabel
      const findMatchingRow = (rows, isNikSearch) => {
        if (!rows || rows.length === 0) return null;

        // Kategori SEKOLAH: Pencarian dan pencocokan BUKAN NIK!
        // Cocokkan berdasarkan Nomor Tiket, lalu Nama siswa
        if (isSekolahPage) {
          if (pTicket && pTicket.length >= 3 && pTicket !== '—') {
            const byTicket = rows.find(r => clean(r.innerText || '').includes(clean(pTicket)));
            if (byTicket) return byTicket;
          }
          if (pNama && pNama.length >= 3) {
            const targetNama = clean(pNama);
            const byExactNama = rows.find(r => clean(r.innerText || '').includes(targetNama));
            if (byExactNama) return byExactNama;

            const words = targetNama.split(' ').filter(w => w.length > 2);
            if (words.length >= 2) {
              const byWords = rows.find(r => {
                const txt = clean(r.innerText || '');
                return words.every(w => txt.includes(w));
              });
              if (byWords) return byWords;
            }
          }
          if (rows.length === 1) {
            const rTxt = clean(rows[0].innerText || '');
            if (!rTxt.includes('tidak ditemukan') && !rTxt.includes('belum ada data')) {
              return rows[0];
            }
          }
          return null;
        }

        // Kategori UMUM: Pertahankan logika (NIK -> Nomor Tiket -> Nama)
        // 1. Prioritas 1: NIK matching (16 digit angka persis di baris tabel)
        if (pNik && pNik.length >= 10) {
          const byNik = rows.find(r => {
            const rowDigits = (r.innerText || '').replace(/\D/g, '');
            return rowDigits.includes(pNik);
          });
          if (byNik) return byNik;
        }

        // 2. Prioritas 2: Nomor tiket matching jika ada
        if (pTicket && pTicket.length >= 4 && pTicket !== '—') {
          const byTicket = rows.find(r => clean(r.innerText || '').includes(clean(pTicket)));
          if (byTicket) return byTicket;
        }

        // 3. Prioritas 3: Nama matching
        if (pNama && pNama.length >= 3) {
          const targetNama = clean(pNama);
          const byExactNama = rows.find(r => clean(r.innerText || '').includes(targetNama));
          if (byExactNama) return byExactNama;

          const words = targetNama.split(' ').filter(w => w.length > 2);
          if (words.length >= 2) {
            const byWords = rows.find(r => {
              const txt = clean(r.innerText || '');
              return words.every(w => txt.includes(w));
            });
            if (byWords) return byWords;
          }
        }

        // 4. Jika pencarian berdasarkan NIK dan hanya ada 1 baris hasil valid
        if (isNikSearch && rows.length === 1) {
          const rTxt = clean(rows[0].innerText || '');
          if (!rTxt.includes('tidak ditemukan') && !rTxt.includes('belum ada data') && !rTxt.includes('lakukan pencarian')) {
            return rows[0];
          }
        }

        // 5. Fallback baris yang punya tombol aksi
        if (isNikSearch && rows.length > 0) {
          const withAction = rows.find(r => {
            const btn = r.querySelector('button:not([disabled]), a.cursor-pointer');
            const bTxt = clean(btn?.innerText || btn?.textContent || '');
            return bTxt.includes('mulai') || bTxt.includes('lanjut') || bTxt.includes('periksa');
          });
          if (withAction) return withAction;
        }

        return null;
      };

      // Helper tangani modal konfirmasi tanggal pemeriksaan
      const handleDateModal = async () => {
        for (let iter = 0; iter < 12; iter++) {
          const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
            if (el.children.length > 3) return false;
            const txt = clean(el.innerText || el.textContent || "");
            return txt.includes("konfirmasi tanggal pemeriksaan");
          });
          if (heading) {
            const modal = heading.closest("div.fixed, div[role='dialog'], .modal, div.z-2000, div.z-50, div.bg-white, div.rounded-xl, div.rounded-lg, div.shadow-xl") || heading.parentElement?.parentElement;
            const searchRoot = modal || document;
            const todayCell = searchRoot.querySelector("td.today, td.current, td.active, .mx-date-row td.today, button.relative.h-auto");
            if (todayCell) {
              triggerClick(todayCell);
              await wait(200);
            }

            const simpanBtn = Array.from(searchRoot.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, .btn")).find(b => {
              if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
              const txt = clean(b.textContent || b.innerText || "");
              if (/batal|cancel|kembali|tutup/i.test(txt)) return false;
              return txt === "simpan" || txt.includes("simpan") || (b.classList.contains("btn-fill-primary") && !txt.includes("mulai"));
            });
            if (simpanBtn) {
              triggerClick(simpanBtn);
              await wait(600);
              return true;
            }
          }
          await wait(250);
        }
        return false;
      };

      // ALGORITMA PENCARIAN TINGKAT TINGGI:
      // Kategori SEKOLAH: Pencarian BUKAN NIK! Tampilkan pencarian sekolah, cari dengan Nomor Tiket, lalu Nama
      // Kategori UMUM: Pertahankan logika (NIK -> Nomor Tiket -> Nama)
      const searchStrategies = [];
      if (isSekolahPage) {
        if (pTicket && pTicket.length >= 3 && pTicket !== '—') {
          searchStrategies.push({ criteria: "Nomor Tiket", val: pTicket, isNik: false });
        }
        if (pNama && pNama.length >= 3) {
          searchStrategies.push({ criteria: "Nama", val: pNama, isNik: false });
        }
        // Fallback terakhir jika data tiket dan nama kosong
        if (searchStrategies.length === 0 && pNik && pNik.length >= 10) {
          searchStrategies.push({ criteria: "NIK", val: pNik, isNik: true });
        }
      } else {
        if (pTicket && pTicket.length >= 3 && pTicket !== '—') {
          searchStrategies.push({ criteria: "Nomor Tiket", val: pTicket, isNik: false });
        }
        if (pNik && pNik.length >= 10) {
          searchStrategies.push({ criteria: "NIK", val: pNik, isNik: true });
        }
        if (pNama && pNama.length >= 3) {
          searchStrategies.push({ criteria: "Nama", val: pNama, isNik: false });
        }
      }

      if (!searchStrategies.length) {
        return { ok: false, error: "Pasien tidak memiliki NIK, Nomor Tiket, maupun Nama untuk dicari" };
      }

      for (const strat of searchStrategies) {
        // Ganti kriteria dropdown (NIK / Nomor Tiket / Nama)
        await setCriteria(strat.criteria);
        await wait(250);

        // 1. CARI DI TAB 'BELUM PEMERIKSAAN'
        await clickTab("Belum Pemeriksaan");
        await doSearch(strat.val, strat.criteria);
        let rows = await waitForTableRows(3500);
        let matchedRow = findMatchingRow(rows, strat.isNik);

        if (matchedRow) {
          const btnMulai = Array.from(matchedRow.querySelectorAll("button, a, [role='button']")).find(b => {
            const t = clean(b.innerText || b.textContent || "");
            return (t === "mulai" || t.includes("mulai") || t === "periksa") && !b.disabled;
          }) || matchedRow.querySelector("button:not([disabled])");

          const targetClickable = btnMulai || matchedRow.querySelector("a, td.cursor-pointer, td") || matchedRow;
          triggerClick(targetClickable);
          await wait(600);
          await handleDateModal();
          return { ok: true, status: "OPENED", tab: "Belum Pemeriksaan" };
        }

        // 2. CARI DI TAB 'SEDANG PEMERIKSAAN'
        await clickTab("Sedang Pemeriksaan");
        await doSearch(strat.val, strat.criteria);
        rows = await waitForTableRows(3500);
        matchedRow = findMatchingRow(rows, strat.isNik);

        if (matchedRow) {
          const btnLanjut = Array.from(matchedRow.querySelectorAll("button, a, [role='button']")).find(b => {
            const t = clean(b.innerText || b.textContent || "");
            return (t === "lanjut" || t === "periksa" || t === "lihat" || t.includes("lanjut") || t === "mulai") && !b.disabled;
          }) || matchedRow.querySelector("button:not([disabled])");

          const targetClickable = btnLanjut || matchedRow.querySelector("a, td.cursor-pointer, td") || matchedRow;
          triggerClick(targetClickable);
          await wait(600);
          await handleDateModal();
          return { ok: true, status: "OPENED", tab: "Sedang Pemeriksaan" };
        }

        // 3. CARI DI TAB 'SELESAI PEMERIKSAAN'
        await clickTab("Selesai Pemeriksaan");
        await doSearch(strat.val, strat.criteria);
        rows = await waitForTableRows(3000);
        matchedRow = findMatchingRow(rows, strat.isNik);

        if (matchedRow) {
          return { ok: true, status: "ALREADY_COMPLETED", tab: "Selesai Pemeriksaan" };
        }
      }

      return { ok: false, status: "NOT_FOUND", error: "Tidak ditemukan di tab antrean pemeriksaan" };
    },
    args: [cleanNik, ticketNumber, nama, isSekolah, sch, cls]
  }).catch(e => ({ error: e.message }));

  const res = Array.isArray(searchResult) ? searchResult[0]?.result : searchResult;
  return res || { ok: false, error: "Gagal mengeksekusi pencarian di halaman" };
}

// Runner Pipeline Pelayanan (Dipicu dari Tab Pasien atau Pelayanan Instan NIK)
async function processPelayananPipeline(participant, tabId) {
  const { id, batchId, category, nik, nama } = participant;
  let isSekolah = category === "SEKOLAH" || (participant.kategori || '').toUpperCase() === 'SEKOLAH' || !!participant.sekolah || !!participant.namaSekolah;
  if (!isSekolah) {
    const stored = await chrome.storage.local.get(["ckg_is_sekolah", "ckg_saved_school_name"]);
    if (stored?.ckg_is_sekolah || stored?.ckg_saved_school_name) isSekolah = true;
  }

  broadcast({
    type: "PARTICIPANT_PROGRESS",
    id,
    nik,
    nama,
    stage: "START_EXAM",
    status: "IN_PROGRESS",
    message: `Memulai tahap pelayanan untuk ${nama} (${nik || 'Tanpa NIK'})`
  });

  // 1. TAHAP PENCARIAN & PEMBUKAAN PEMERIKSAAN VIA FITUR SEARCH WEB CKG
  await updateParticipantStatus(id, { stage: "START_EXAM" });

  const targetPelayananUrl = isSekolah
    ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
    : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

  // Pastikan tab berada di halaman antrean sebelum melakukan pencarian
  try {
    const curTab = await chrome.tabs.get(tabId).catch(() => null);
    if (!curTab?.url || !curTab.url.includes(isSekolah ? "ckg-pelayanan-sekolah" : "ckg-pelayanan") || curTab.url.includes("detail-pemeriksaan")) {
      await chrome.tabs.update(tabId, { url: targetPelayananUrl });
      const navEnd = Date.now() + 10000;
      while (Date.now() < navEnd) {
        await new Promise(r => setTimeout(r, 400));
        const t = await chrome.tabs.get(tabId).catch(() => null);
        if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  } catch (e) {}

  // Pastikan filter tanggal atau sekolah telah disinkronkan sebelum pencarian pasien
  try {
    if (isSekolah) {
      let sch = participant.sekolah || participant.namaSekolah || participant.namasekolah || "";
      let cls = participant.kelas || participant.tingkatKelas || participant.tingkat || participant.jenjang || "";
      if (!sch || !cls) {
        const stored = await chrome.storage.local.get(["ckg_saved_school_name", "ckg_saved_school_class"]);
        if (!sch) sch = stored?.ckg_saved_school_name || "";
        if (!cls) cls = stored?.ckg_saved_school_class || "";
      }
      if ((!sch || !cls) && participant.batchId) {
        const batchItems = await getQueueByBatch(participant.batchId).catch(() => []);
        const sib = batchItems.find(it => it.sekolah || it.namasekolah || it.namaSekolah);
        if (sib) {
          if (!sch) sch = sib.sekolah || sib.namasekolah || sib.namaSekolah || "";
          if (!cls) cls = sib.kelas || sib.tingkat || sib.jenjang || sib.tingkatKelas || "";
        }
      }
      if (sch || cls) {
        participant.sekolah = sch;
        participant.kelas = cls;
        await updateParticipantStatus(id, { sekolah: sch, kelas: cls }).catch(() => {});
        await ensureQueuePageSchoolFilter(tabId, sch, cls);
        await new Promise(r => setTimeout(r, 1200));
      }
    } else {
      const stored = await chrome.storage.local.get("ckg_saved_pelayanan_date_filter");
      if (stored?.ckg_saved_pelayanan_date_filter) {
        await ensureQueuePageDateFilter(tabId, stored.ckg_saved_pelayanan_date_filter);
        await new Promise(r => setTimeout(r, 1200));
      }
    }
  } catch (e) {}

  const searchRes = await searchAndOpenPatientExam(tabId, participant, isSekolah, msg => {
    broadcast({ type: "AUTOMATION_LOG", message: `[${participant.nik || participant.nama}] ${msg}` });
  });

  if (searchRes?.status === "ALREADY_COMPLETED") {
    await updateParticipantStatus(id, { status: "COMPLETED", stage: "COMPLETED" });
    await appendLog({ batchId, participantId: id, message: `Pasien ${nama} sudah selesai pelayanan sebelumnya di Web CKG.` });
    broadcast({
      type: "PARTICIPANT_PROGRESS",
      id,
      nik,
      nama,
      stage: "COMPLETED",
      status: "COMPLETED",
      message: `✓ Pasien ${nama} sudah selesai sebelumnya.`
    });
    broadcast({ type: "SERVICE_COMPLETED", participantId: id, nik, nama });
    return;
  }

  if (!searchRes?.ok || searchRes?.status === "NOT_FOUND") {
    const reason = searchRes?.error || "Tidak ditemukan di antrean Web CKG";
    await updateParticipantStatus(id, { status: "ERROR", errorMsg: reason });
    await appendLog({ batchId, participantId: id, level: "WARN", message: `Pasien ${nama} (${nik || participant.ticketNumber || 'Tanpa NIK'}): ${reason}.` });
    broadcast({
      type: "PARTICIPANT_PROGRESS",
      id,
      nik,
      nama,
      stage: "START_EXAM",
      status: "ERROR",
      message: `❌ ${nama}: ${reason}`
    });
    return;
  }

  // Tunggu tab berpindah ke detail-pemeriksaan
  const detailDeadline = Date.now() + 15000;
  while (Date.now() < detailDeadline) {
    await new Promise(r => setTimeout(r, 400));
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t?.url && t.url.includes("detail-pemeriksaan") && t.status === "complete") break;
  }
  await new Promise(r => setTimeout(r, 1500));

  // Tangani jika ada tombol "Mulai Pemeriksaan" di dalam halaman detail
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      const clean = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
      const b = Array.from(document.querySelectorAll('button')).find(x => clean(x.innerText || x.textContent || '') === 'mulai pemeriksaan' && !x.disabled);
      if (b) {
        b.click();
        await new Promise(r => setTimeout(r, 600));
        const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
          const txt = clean(el.innerText || el.textContent || "");
          return txt.includes("konfirmasi tanggal pemeriksaan");
        });
        if (heading) {
          const modal = heading.closest("div.fixed, div[role='dialog'], .modal") || document;
          const wantDay = String(new Date().getDate());
          const dayCell = Array.from(modal.querySelectorAll("button, span, td")).find(c => clean(c.textContent) === wantDay);
          if (dayCell) dayCell.click();
          await new Promise(r => setTimeout(r, 300));
          const simpanBtn = Array.from(modal.querySelectorAll("button, .btn")).find(btn => clean(btn.textContent || '').includes("simpan"));
          if (simpanBtn) simpanBtn.click();
        }
      }
    }
  }).catch(() => {});

  // 2. TAHAP SKRINING MANDIRI & PELAYANAN NAKES (Isi Nilai Klinis Nyata)
  await updateParticipantStatus(id, { stage: "NURSE_SERVICE" });
  broadcast({
    type: "PARTICIPANT_PROGRESS",
    id,
    nik,
    stage: "NURSE_SERVICE",
    message: `Mengisi formulir skrining & hasil nakes (${nama})`
  });

  // Jalankan uncheck form yang tidak relevan terlebih dahulu
  try {
    const uncheckFieldVals = {};
    if (participant.merokok) uncheckFieldVals["merokok"] = String(participant.merokok).toLowerCase().includes("ya") ? "ya" : "tidak";
    const uncheckRes = await runUncheckAll(tabId, uncheckFieldVals, participant);
    broadcast({ type: "AUTOMATION_LOG", message: `Uncheck selesai: ${uncheckRes.processed}/${uncheckRes.total} form di-skip.` });
    await new Promise(r => setTimeout(r, 1500));
  } catch (uncheckErr) {
    broadcast({ type: "AUTOMATION_LOG", message: `Peringatan uncheck: ${uncheckErr.message}` });
  }

  const { ckg_config: userConfig } = await chrome.storage.local.get("ckg_config");
  const delayMs = Math.round(1000 * (userConfig?.delay ?? 1.0));
  const fieldRules = await recordToFieldRules(participant);

  const skriningRunner = new SkriningAutomation({
    tabId,
    statusMenikah: participant.statusPernikahan || "menikah",
    delay: delayMs,
    testMode: false,
    fieldRules,
    patientProfile: fieldRules?.patientProfile || null,
    patientInfo: participant,
    items: null,
    onProgress: (idx, status, title) => {
      broadcast({ type: "AUTOMATION_LOG", message: `Form [${title}]: ${status}` });
    },
    onDone: () => {}
  });

  currentAutomationInstance = skriningRunner;
  await skriningRunner.run();

  // Verifikasi apakah semua form selesai
  const verifyRes = await skriningRunner.verifyAllDone().catch(() => null);
  if (!verifyRes?.allDone && skriningRunner.failedItems.length > 0) {
    // Retry 1x untuk form yang tertinggal
    await skriningRunner.run().catch(() => {});
  }

  await new Promise(r => setTimeout(r, 600));
  const finalVerify = await skriningRunner.verifyAllDone().catch(() => null);
  const isTrulyDone = finalVerify ? (finalVerify.allDone || finalVerify.remaining === 0) : (skriningRunner.failedItems.length === 0);

  // 3. SELESAIKAN LAYANAN - HANYA jika seluruh formulir benar-benar tuntas terisi!
  let selesRes = null;
  if (isTrulyDone) {
    await updateParticipantStatus(id, { stage: "FINISH_SERVICE" });
    broadcast({
      type: "PARTICIPANT_PROGRESS",
      id,
      nik,
      stage: "FINISH_SERVICE",
      message: `Menyelesaikan dan mengonfirmasi layanan untuk ${nama}`
    });

    try {
      selesRes = await selesaikanLayanan(tabId, {
        report: msg => broadcast({ type: "AUTOMATION_LOG", message: `[SelesaiLayanan] ${msg}` })
      });
      if (!selesRes.ok) {
        console.warn("Peringatan saat selesaikan layanan:", selesRes.reason);
      }
    } catch (e) {
      selesRes = { ok: false, reason: e.message };
      console.warn("Gagal klik selesaikan layanan:", e.message);
    }
  } else {
    broadcast({
      type: "AUTOMATION_LOG",
      message: `[Pelayanan] Pasien ${nama}: Pemeriksaan belum lengkap (${finalVerify?.remaining ?? '?'} formulir tersisa). Layanan TIDAK dikunci agar data pemeriksaan dapat dilengkapi.`
    });
  }

  // 4. TAHAP SELESAI
  await updateParticipantStatus(id, { status: "COMPLETED", stage: "COMPLETED" });
  await appendLog({ batchId, participantId: id, message: `✓ Pasien ${nama} (${nik || 'Tanpa NIK'}) SELESAI diproses pelayanan.` });

  // Catat riwayat pelayanan pasien untuk Tab Ekspor Laporan
  try {
    const ageObj = calculateAge(participant.tanggal_lahir || participant.birthDate || participant.tanggalLahir);
    const lifecycle = getLifeCycleCategory(ageObj.years);
    const isFullComplete = !!(selesRes && selesRes.ok);
    const keterangan = isFullComplete
      ? "Selesai Lengkap (Daftar, Hadir, Pelayanan)"
      : `Belum Selesai Pemeriksaan (${selesRes?.reason || "Belum Konfirmasi Akhir"})`;

    await recordServiceHistory({
      id: "HIST-" + Date.now(),
      timestamp: new Date().toLocaleString("id-ID"),
      nik: nik || "—",
      nama,
      usia: ageObj.text,
      gender: participant.jenis_kelamin || participant.gender || participant.jenisKelamin || "—",
      siklusHidup: lifecycle,
      statusSkrining: "Selesai (Skrining & Nakes)",
      statusRaport: isFullComplete ? "Selesai Pelayanan" : "Belum Selesai",
      keterangan,
      kategori: category || "UMUM"
    });
  } catch (recErr) {
    console.warn("Gagal mencatat service history participant:", recErr);
  }

  broadcast({
    type: "PARTICIPANT_PROGRESS",
    id,
    nik,
    stage: "COMPLETED",
    status: "COMPLETED",
    message: `✓ Pasien ${nama} SELESAI Pelayanan`
  });
  broadcast({ type: "SERVICE_COMPLETED", participantId: id, nik, nama });

  // 5. KEMBALIKAN KE HALAMAN ANTREAN & BERSIHKAN INPUT PENCARIAN
  try {
    broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan] Mengembalikan halaman ke antrean: ${isSekolah ? "Sekolah" : "Umum"}` });
    await chrome.tabs.update(tabId, { url: targetPelayananUrl });
    const navBackDeadline = Date.now() + 12000;
    while (Date.now() < navBackDeadline) {
      await new Promise(r => setTimeout(r, 400));
      const t = await chrome.tabs.get(tabId).catch(() => null);
      if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
    }
    await new Promise(r => setTimeout(r, 1200));

    // Pulihkan filter
    if (isSekolah) {
      if (participant.sekolah || participant.kelas) {
        await ensureQueuePageSchoolFilter(tabId, participant.sekolah, participant.kelas);
      }
    } else {
      const stored = await chrome.storage.local.get("ckg_saved_pelayanan_date_filter");
      if (stored?.ckg_saved_pelayanan_date_filter) {
        await ensureQueuePageDateFilter(tabId, stored.ckg_saved_pelayanan_date_filter);
      }
    }

    // Bersihkan kotak pencarian agar siap untuk pasien berikutnya
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i], input[placeholder*="nik" i]');
        if (searchInput && searchInput.value) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(searchInput, '');
          else searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }).catch(() => {});
  } catch (navBackErr) {
    console.warn("Gagal mengembalikan halaman ke antrean:", navBackErr.message);
  }
}

// Controller Loop Antrean Otomatis Pendaftaran (Unattended Worker)
async function processNextQueueItem() {
  if (isProcessingQueue || !isQueueRunning || isQueuePaused || !activeBatchId) return;
  isProcessingQueue = true;

  try {
    const nextItem = await getNextReadyParticipant(activeBatchId);
    if (!nextItem) {
      // Semua item pendaftaran selesai
      isQueueRunning = false;
      await unattendedMgr.disable();
      await setCheckpoint("CURRENT_BATCH_RUNNING", false);
      broadcast({ type: "QUEUE_FINISHED", batchId: activeBatchId });
      console.log("[Queue] Seluruh antrean pendaftaran selesai diproses!");
      return;
    }

    // Simpan checkpoint peserta yang sedang aktif
    await setCheckpoint("LAST_ACTIVE_ID", nextItem.id);

    const tab = await getOrCreateCkgTab();
    
    // Periksa apakah tab session login masih aktif
    const sessionStatus = await UnattendedManager.checkSessionStatus(tab.id);
    if (!sessionStatus.isLoggedIn) {
      broadcast({
        type: "SESSION_TIMEOUT",
        message: "Sesi terdeteksi logout! Harap login kembali di tab CKG."
      });
      isQueuePaused = true;
      return;
    }

    // Jalankan pipeline pendaftaran peserta
    await processParticipantPipeline(nextItem, tab.id);

    // Adaptive delay sebelum peserta berikutnya (mencegah throttling server)
    const stats = await getQueueStats(activeBatchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats });

    // Ambil konfigurasi delay pengguna (prioritaskan pendaftaranDelay atau delay)
    const { ckg_config: userConfig } = await chrome.storage.local.get("ckg_config");
    const configuredDelay = userConfig?.pendaftaranDelay ?? userConfig?.delay ?? 0.4;
    const pacingMs = Math.max(50, Math.round(1000 * configuredDelay));

    if (isQueueRunning && !isQueuePaused) {
      await new Promise(r => setTimeout(r, pacingMs));
      // Schedule next item
      setTimeout(() => processNextQueueItem(), 50);
    }
  } catch (err) {
    console.error(`Error memproses antrean pendaftaran:`, err);
    try {
      const activeId = await getCheckpoint("LAST_ACTIVE_ID");
      if (activeId) {
        await updateParticipantStatus(activeId, {
          status: "ERROR",
          errorMsg: err.message
        });
        await appendLog({
          batchId: activeBatchId,
          participantId: activeId,
          level: "ERROR",
          message: `Error: ${err.message}`
        });
      }
    } catch (dbErr) {}

    const stats = await getQueueStats(activeBatchId);
    broadcast({ type: "QUEUE_STATS_UPDATE", stats });

    // Lanjut ke antrean berikutnya setelah jeda singkat
    if (isQueueRunning && !isQueuePaused) {
      await new Promise(r => setTimeout(r, 3000));
      setTimeout(() => processNextQueueItem(), 100);
    }
  } finally {
    isProcessingQueue = false;
  }
}

// ---------------------------------------------------------------------------
// PENGELOLA OTOMASI ANTREAN LIVE WEB CKG (LOOP DAN SINGLE EXAM)
// ---------------------------------------------------------------------------
let isTableQueueLoopRunning = false;
let isTablePatientCancelled = false;
const activeTableWorkers = new Map(); // workerTabId -> { runner, isDedicatedTab, patient }

async function ensureQueuePageDateFilter(tabId, targetDateRange, targetTabFilter = null) {
  if (!targetDateRange) return { ok: false, reason: "No target date range specified" };
  try {
    const curTab = await chrome.tabs.get(tabId).catch(() => null);
    if (!curTab || !curTab.url || !curTab.url.includes("ckg-pelayanan")) {
      return { ok: false, reason: "Tab not in ckg-pelayanan" };
    }

    if (!targetTabFilter) {
      const storedTab = await chrome.storage.local.get("ckg_active_table_tab_filter");
      targetTabFilter = storedTab?.ckg_active_table_tab_filter || "BELUM";
    }

    broadcast({
      type: "AUTOMATION_LOG",
      message: `[Filter Tanggal] Memeriksa & menyinkronkan filter tanggal antrean: ${targetDateRange} (Tab: ${targetTabFilter})...`
    });

    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (savedRange, tabFilter) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").replace(/\s+/g, " ").trim();
        const triggerClick = el => {
          if (!el) return;
          const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, td, span") || el;
          target.focus?.();
          const opts = { bubbles: true, cancelable: true, view: window };
          try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
          try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
          if (typeof target.click === "function") {
            try { target.click(); } catch(e) {}
          } else {
            try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
          }
        };

        // 0. Bersihkan input pencarian (#searchNik) HANYA jika sempat terisi teks tanggal yang salah
        const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i]');
        if (searchInput && searchInput.value) {
          const val = searchInput.value;
          const isDatePattern = /^\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(val) || /^\s*\d{4}-\d{2}-\d{2}/.test(val) || (val.includes('-') && !/^\d+$/.test(val));
          if (isDatePattern && !/^\d{10,16}$/.test(val)) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(searchInput, '');
            else searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(150);
          }
        }

        // 1. Tunggu hingga elemen datepicker tersedia di DOM (SPA component mount)
        let datepicker = null;
        let dateInput = null;
        for (let i = 0; i < 25; i++) {
          datepicker = document.querySelector('.mx-datepicker, [class*="datepicker"]');
          if (datepicker) {
            dateInput = datepicker.querySelector('input.mx-input, input');
            if (dateInput) break;
          }
          await wait(200);
        }
        if (!datepicker || !dateInput) return { ok: false, reason: "datepicker element not found" };

        await wait(250);

        // Helper ganti tab antrean (Sedang vs Belum Pemeriksaan) dengan regex
        const applyTabFilter = async () => {
          const isSedang = /sedang/i.test(tabFilter);
          const targetTabRegex = isSedang
            ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
            : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;

          const tabCandidates = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
            if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
            const t = clean(el.innerText || el.textContent || '');
            return targetTabRegex.test(t);
          });
          const activeTabEl = tabCandidates.find(el => el.classList.contains('cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabCandidates[0];
          if (activeTabEl) {
            triggerClick(activeTabEl);
            await wait(800);
          }
        };

        // 2. Cek apakah filter saat ini sudah sesuai persis dengan savedRange
        let currentFilter = clean(dateInput.value || "");
        if (!currentFilter && datepicker) {
          const m = clean(datepicker.innerText || datepicker.textContent || "").match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/);
          if (m) currentFilter = m[0];
        }

        if (currentFilter && currentFilter.toLowerCase() === savedRange.toLowerCase()) {
          await applyTabFilter();
          return { ok: true, matched: true, finalValue: currentFilter, filter: currentFilter };
        }

        // 3. Parsing rentang tanggal target (contoh: "15 Sep 2026 - 15 Sep 2026" atau "20 Jul 2026 - 26 Jul 2026")
        const monthMap = {
          jan: 0, januari: 0, january: 0,
          feb: 1, februari: 1, february: 1,
          mar: 2, maret: 2, march: 2,
          apr: 3, april: 3,
          mei: 4, may: 4,
          jun: 5, juni: 5, june: 5,
          jul: 6, juli: 6, july: 6,
          agu: 7, agt: 7, agustus: 7, august: 7,
          sep: 8, sept: 8, september: 8,
          okt: 9, oct: 9, oktober: 9, october: 9,
          nov: 10, november: 10,
          des: 11, dec: 11, desember: 11, december: 11
        };

        const rangeParts = savedRange.split(/\s*-\s*/);
        const partStart = rangeParts[0] || "";
        const partEnd = rangeParts[1] || rangeParts[0] || "";

        let startDate = null, endDate = null;
        let sDay = null, sMonth = null, sYear = null;
        let eDay = null, eMonth = null, eYear = null;

        const sm = partStart.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        const em = partEnd.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);

        if (sm) {
          sDay = parseInt(sm[1], 10);
          sMonth = monthMap[sm[2].toLowerCase()] ?? 0;
          sYear = parseInt(sm[3], 10);
          startDate = new Date(sYear, sMonth, sDay, 0, 0, 0);
        }
        if (em) {
          eDay = parseInt(em[1], 10);
          eMonth = monthMap[em[2].toLowerCase()] ?? 0;
          eYear = parseInt(em[3], 10);
          endDate = new Date(eYear, eMonth, eDay, 23, 59, 59);
        }

        if (!startDate || !endDate) {
          await applyTabFilter();
          return { ok: false, reason: `Gagal mem-parsing format tanggal: ${savedRange}` };
        }

        const isoStart = `${sYear}-${String(sMonth + 1).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;
        const isoEnd = `${eYear}-${String(eMonth + 1).padStart(2, '0')}-${String(eDay).padStart(2, '0')}`;

        // 4. STRATEGI 1: Direct Native Input Setter + Enter Events (Paling cepat & reliabel pada vue-datepicker-next)
        try {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(dateInput, savedRange);
          else dateInput.value = savedRange;
          dateInput.dispatchEvent(new Event('input', { bubbles: true }));
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
          dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          dateInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          await wait(200);
        } catch(e) {}

        // 5. STRATEGI 2: Update Reactivity Vue 3 / Nuxt 3 & Vue 2 melalui __vnode
        let vueUpdated = false;
        const comp = dateInput.__vnode?.component || datepicker.__vnode?.component || datepicker.__vueParentComponent || dateInput.__vueParentComponent || datepicker.__vue__ || dateInput.__vue__;
        if (comp) {
          try {
            // Vue 2 instance
            if (comp.$emit) {
              comp.currentValue = [startDate, endDate];
              comp.userInput = null;
              comp.$emit('input', [startDate, endDate]);
              comp.$emit('change', [startDate, endDate]);
              vueUpdated = true;
            }
            // Vue 3 ComponentInternalInstance
            if (typeof comp.emit === 'function') {
              comp.emit('update:modelValue', [startDate, endDate]);
              comp.emit('change', [startDate, endDate]);
              comp.emit('input', [startDate, endDate]);
              vueUpdated = true;
            }

            // Traverse parent components to sync reactive state & trigger fetch
            let parent = comp.parent || comp.$parent;
            while (parent) {
              const state = parent.setupState || parent.ctx || parent.proxy || parent.$data;
              if (state) {
                for (const key of Object.keys(state)) {
                  if (/date|filter|tanggal|range|periode/i.test(key)) {
                    const val = state[key];
                    if (Array.isArray(val) && val.length === 2) {
                      state[key] = (typeof val[0] === 'string' && val[0].includes('-')) ? [isoStart, isoEnd] : [startDate, endDate];
                    } else if (typeof val === 'string') {
                      state[key] = savedRange;
                    }
                  }
                }
                const fetchMethods = ['fetchData', 'loadData', 'getQueue', 'getPatients', 'fetchPatients', 'filterData', 'onFilter', 'search', 'refresh', 'init'];
                for (const m of fetchMethods) {
                  if (typeof state[m] === 'function') {
                    try { state[m](); } catch(e) {}
                  }
                  if (parent.proxy && typeof parent.proxy[m] === 'function') {
                    try { parent.proxy[m](); } catch(e) {}
                  }
                }
              }
              parent = parent.parent || parent.$parent;
            }
          } catch (e) {
            console.warn('[ensureQueuePageDateFilter] Vue update error:', e);
          }
        }

        // 6. STRATEGI 3: Interaksi Visual Kalender Dual-Panel Presisi Tinggi jika belum match
        await wait(300);
        let domMatch = clean(dateInput.value || "").toLowerCase() === savedRange.toLowerCase();

        if (!domMatch) {
          // Buka popup kalender
          dateInput.focus();
          triggerClick(dateInput);
          await wait(400);

          let popup = document.querySelector('.mx-datepicker-popup, .mx-datepicker-main, .v-popper__popper');
          if (!popup) {
            const calIcon = datepicker.querySelector('.mx-icon-calendar, svg, [class*="calendar"]');
            if (calIcon) {
              triggerClick(calIcon);
              await wait(400);
              popup = document.querySelector('.mx-datepicker-popup, .mx-datepicker-main, .v-popper__popper');
            }
          }

          if (popup) {
            const getPanelDate = (p) => {
              const mBtn = p.querySelector('.mx-btn-current-month');
              const yBtn = p.querySelector('.mx-btn-current-year');
              let y = null, m = null;
              if (yBtn) y = parseInt(clean(yBtn.textContent), 10);
              if (mBtn) {
                const txt = clean(mBtn.textContent).toLowerCase();
                m = monthMap[txt.slice(0, 3)] ?? monthMap[txt] ?? null;
              }
              if (y === null || m === null) {
                const hdrTxt = clean(p.querySelector('.mx-calendar-header')?.textContent || p.textContent || '');
                const ym = hdrTxt.match(/\b(20\d\d)\b/);
                if (ym) y = parseInt(ym[1], 10);
                const mm = hdrTxt.match(/(jan|feb|mar|apr|mei|may|jun|jul|agu|agt|aug|sep|okt|oct|nov|des|dec)/i);
                if (mm) m = monthMap[mm[1].toLowerCase()] ?? null;
              }
              return { y, m };
            };

            const navPanelTo = async (p, targetYear, targetMonth) => {
              for (let step = 0; step < 24; step++) {
                const { y, m } = getPanelDate(p);
                if (y === null || m === null) break;
                if (y === targetYear && m === targetMonth) return true;

                if (y > targetYear) {
                  const prevY = p.querySelector('.mx-btn-icon-double-left, [class*="double-left"]');
                  if (prevY) { triggerClick(prevY); await wait(120); continue; }
                } else if (y < targetYear) {
                  const nextY = p.querySelector('.mx-btn-icon-double-right, [class*="double-right"]');
                  if (nextY) { triggerClick(nextY); await wait(120); continue; }
                }

                if (m > targetMonth) {
                  const prevM = p.querySelector('.mx-btn-icon-left, [class*="icon-left"]');
                  if (prevM) { triggerClick(prevM); await wait(120); continue; }
                } else if (m < targetMonth) {
                  const nextM = p.querySelector('.mx-btn-icon-right, [class*="icon-right"]');
                  if (nextM) { triggerClick(nextM); await wait(120); continue; }
                }
              }
              return false;
            };

            const findDayInPanel = (p, dayNum) => {
              const cells = Array.from(p.querySelectorAll('td.cell, .mx-table-date td, td')).filter(c => {
                if (c.classList.contains('not-current-month') || c.classList.contains('disabled')) return false;
                const txt = clean(c.innerText || c.textContent || '');
                return txt === String(dayNum);
              });
              return cells[0] || null;
            };

            let panels = Array.from(popup.querySelectorAll('.mx-calendar'));
            let leftPanel = panels[0] || popup;
            let rightPanel = panels[1] || panels[0] || popup;

            // Navigasi panel kiri ke tanggal mulai
            await navPanelTo(leftPanel, sYear, sMonth);
            await wait(200);

            const startCell = findDayInPanel(leftPanel, sDay);
            if (startCell) {
              triggerClick(startCell);
              await wait(350);

              // Re-query panels setelah startCell diklik (DOM di-update oleh kalender)
              panels = Array.from(popup.querySelectorAll('.mx-calendar'));
              leftPanel = panels[0] || popup;
              rightPanel = panels[1] || panels[0] || popup;

              // Navigasi & klik tanggal akhir
              if (eYear === sYear && eMonth === sMonth) {
                const endCell = findDayInPanel(leftPanel, eDay);
                if (endCell) {
                  triggerClick(endCell);
                  await wait(350);
                }
              } else {
                await navPanelTo(rightPanel, eYear, eMonth);
                await wait(200);
                const endCell = findDayInPanel(rightPanel, eDay);
                if (endCell) {
                  triggerClick(endCell);
                  await wait(350);
                }
              }
            }

            // Cek tombol konfirmasi / tutup popup
            const okBtn = popup.querySelector('button.mx-btn-confirm, button[class*="confirm"], button[class*="ok"], button[class*="apply"]');
            if (okBtn) {
              triggerClick(okBtn);
              await wait(250);
            } else {
              document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            dateInput.blur();
            await wait(350);
          }
        }

        // 7. Terapkan Tab Antrean (Sedang Pemeriksaan vs Belum Pemeriksaan)
        await applyTabFilter();

        // 8. Tunggu hingga baris tabel antrean stabil
        for (let i = 0; i < 20; i++) {
          const rows = Array.from(document.querySelectorAll('tbody tr')).filter(r => {
            const t = (r.innerText || '').trim();
            return t.length > 5 && !t.includes('Memuat data') && !t.includes('loading');
          });
          if (rows.length > 0) break;
          await wait(200);
        }

        let finalVal = clean(dateInput.value || "");
        if (!finalVal && datepicker) {
          const m = clean(datepicker.innerText || datepicker.textContent || "").match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/);
          if (m) finalVal = m[0];
        }

        return {
          ok: true,
          target: savedRange,
          finalValue: finalVal,
          matched: finalVal.toLowerCase() === savedRange.toLowerCase(),
          vueUpdated
        };
      },
      args: [targetDateRange, targetTabFilter]
    });

    const outcome = res?.result || { ok: false, matched: false, finalValue: "" };
    if (outcome?.matched) {
      broadcast({
        type: "AUTOMATION_LOG",
        message: `✓ Filter tanggal antrean Web CKG aktif: ${targetDateRange} (Tab: ${targetTabFilter})`
      });
    } else {
      broadcast({
        type: "AUTOMATION_LOG",
        message: `ℹ️ Filter tanggal antrean saat ini: ${outcome?.finalValue || targetDateRange} (Tab: ${targetTabFilter})`
      });
    }
    return outcome;
  } catch (e) {
    console.warn("[DateFilter] Gagal restore date filter:", e.message);
    broadcast({
      type: "AUTOMATION_LOG",
      message: `⚠️ Gagal sinkronisasi tanggal antrean: ${e.message}`
    });
    return { ok: false, error: e.message };
  }
}

// Helper mandiri untuk memastikan tab antrean di Web CKG (Sedang vs Belum) aktif presisi
async function ensureQueuePageTab(tabId, targetTabFilter) {
  try {
    const wantTab = (targetTabFilter || "BELUM").toUpperCase() === "SEDANG" ? "SEDANG" : "BELUM";
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (want) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const triggerClick = el => {
          if (!el) return;
          const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, td, span") || el;
          target.focus?.();
          const opts = { bubbles: true, cancelable: true, view: window };
          try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
          try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
          if (typeof target.click === "function") {
            try { target.click(); } catch(e) {}
          } else {
            try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
          }
        };

        const isSedang = want === "SEDANG";
        const targetRegex = isSedang
          ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
          : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;

        const candidates = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
          if (el.closest('.mx-datepicker, #searchNik, form, table, tbody')) return false;
          if (el.children.length > 3) return false;
          const t = clean(el.innerText || el.textContent || '');
          return targetRegex.test(t);
        });

        const tabBtn = candidates.find(el => el.classList.contains('cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || candidates[0];
        if (!tabBtn) return { ok: false, reason: "tab button not found" };

        const isActive = tabBtn.classList.contains('active') ||
                         tabBtn.classList.contains('border-primary') ||
                         tabBtn.classList.contains('text-primary') ||
                         tabBtn.getAttribute('aria-selected') === 'true' ||
                         tabBtn.closest('.active, [aria-selected="true"]');

        if (!isActive) {
          triggerClick(tabBtn);
          await wait(800);
        }

        return { ok: true, want, clicked: !isActive };
      },
      args: [wantTab]
    });
    return res?.[0]?.result || { ok: false };
  } catch (e) {
    console.warn("[ensureQueuePageTab] Error:", e);
    return { ok: false, error: e.message };
  }
}

// Helper untuk merefresh tabel antrean /ckg-pelayanan tanpa mereset filter tanggal:
// Klik tab seberangnya (Belum Pemeriksaan <-> Sedang Pemeriksaan) lalu klik kembali ke tab asal
async function refreshPelayananQueueByTabToggle(preferredTabId, targetTabFilter = "BELUM") {
  try {
    const tab = await getPelayananQueueTab(preferredTabId);
    if (!tab?.id) return { ok: false, error: "Tab antrean tidak ditemukan" };

    const wantTab = (targetTabFilter || "BELUM").toUpperCase() === "SEDANG" ? "SEDANG" : "BELUM";

    // Pastikan jika ada filter tanggal tersimpan & halaman sempat ke-reset, sinkronkan dulu
    const stored = await chrome.storage.local.get(["ckg_saved_pelayanan_date_filter", "ckg_is_sekolah", "ckg_saved_school_name", "ckg_saved_school_class"]);
    const curTab = await chrome.tabs.get(tab.id).catch(() => null);
    const isSekolah = stored?.ckg_is_sekolah || (curTab?.url && curTab.url.includes("sekolah"));

    if (isSekolah && (stored?.ckg_saved_school_name || stored?.ckg_saved_school_class)) {
      await ensureQueuePageSchoolFilter(tab.id, stored.ckg_saved_school_name, stored.ckg_saved_school_class, wantTab);
    } else if (!isSekolah && stored?.ckg_saved_pelayanan_date_filter) {
      await ensureQueuePageDateFilter(tab.id, stored.ckg_saved_pelayanan_date_filter, wantTab);
    }

    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async (want) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const triggerClick = el => {
          if (!el) return;
          const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, [role='tab']") || el;
          target.focus?.();
          const opts = { bubbles: true, cancelable: true, view: window };
          try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
          try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
          if (typeof target.click === "function") {
            try { target.click(); } catch(e) {}
          } else {
            try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
          }
        };

        // 1. Bersihkan kolom pencarian jika masih berisi nomor tiket / nama agar seluruh daftar antrean muncul kembali
        const searchInp = document.querySelector('input#searchNik, input[placeholder*="Masukkan" i], input[placeholder*="tiket" i], input[placeholder*="nama" i], input[placeholder*="nik" i]');
        if (searchInp && (searchInp.value || '').trim().length > 0) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(searchInp, '');
          else searchInp.value = '';
          if (typeof searchInp._assign === 'function') {
            try { searchInp._assign(''); } catch(e) {}
          }
          searchInp.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'deleteContentBackward' }));
          searchInp.dispatchEvent(new Event('change', { bubbles: true }));
          searchInp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          searchInp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          const clearBtn = searchInp.parentElement?.querySelector('button, svg, [class*="clear"], [class*="close"]');
          if (clearBtn) {
            try { triggerClick(clearBtn); } catch(e) {}
          }
          await wait(500);
        }

        const findTabEl = (isSedangTarget) => {
          const rgx = isSedangTarget
            ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
            : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;
          const candidates = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
            if (el.closest('.mx-datepicker, #searchNik, form, table, tbody')) return false;
            if (el.children.length > 3) return false;
            const t = clean(el.innerText || el.textContent || '');
            return rgx.test(t);
          });
          return candidates.find(el => el.classList.contains('cursor-pointer') || el.closest('.cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || candidates[0] || null;
        };

        const wantIsSedang = want === "SEDANG";
        const oppositeTabEl = findTabEl(!wantIsSedang);
        const targetTabEl = findTabEl(wantIsSedang);

        // 2. Klik tab seberangnya dulu (Belum -> Sedang, atau Sedang -> Belum)
        if (oppositeTabEl) {
          triggerClick(oppositeTabEl);
          await wait(1000);
        }

        // 3. Klik kembali ke tab target agar Vue me-request ulang daftar antrean terbaru
        const targetTabElAfter = findTabEl(wantIsSedang) || targetTabEl;
        if (targetTabElAfter) {
          triggerClick(targetTabElAfter);
          await wait(1400);
        }

        // 4. Tunggu indikator loading selesai
        for (let i = 0; i < 15; i++) {
          const isLoading = !!(document.querySelector('.animate-spin, [role="status"], .loading') ||
                               (document.body?.innerText || '').toLowerCase().includes('memuat data'));
          if (!isLoading) break;
          await wait(250);
        }

        return { ok: true, toggledFrom: wantIsSedang ? "SEDANG" : "BELUM" };
      },
      args: [wantTab]
    });

    return res?.result || { ok: true };
  } catch (err) {
    console.warn("[refreshPelayananQueueByTabToggle] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

// Memeriksa status pasien di tab 'Selesai Pemeriksaan' berdasarkan nomor tiket / nama
// dan mengembalikan status real dari tabel CKG (Status: Mandiri: — | Pelayanan: Selesai Pemeriksaan)
async function checkSelesaiPemeriksaanByTickets(preferredTabId, tickets = [], names = []) {
  try {
    const tab = await getPelayananQueueTab(preferredTabId);
    if (!tab?.id) return { ok: false, error: "Tab antrean tidak ditemukan", verifiedPatients: [] };

    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async (targetTickets, targetNames) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").replace(/\s+/g, " ").trim();
        const triggerClick = el => {
          if (!el) return;
          const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, [role='tab']") || el;
          target.focus?.();
          const opts = { bubbles: true, cancelable: true, view: window };
          try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
          try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
          if (typeof target.click === "function") {
            try { target.click(); } catch(e) {}
          } else {
            try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
          }
        };

        // 1. Bersihkan input pencarian nama/tiket sebelum ganti tab
        const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i]');
        if (searchInput && searchInput.value) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(searchInput, '');
          else searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          const clearBtn = searchInput.parentElement?.querySelector('button, svg, [class*="clear"], [class*="close"]');
          if (clearBtn) try { clearBtn.click(); } catch(e) {}
          await wait(400);
        }

        // 2. Cari tab "Selesai Pemeriksaan"
        const tabs = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
          if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
          const t = clean(el.innerText || el.textContent || '').toLowerCase();
          return /(selesai\s*(pemeriksaan|diperiksa|pelayanan)?)/i.test(t);
        });
        const selesaiTabBtn = tabs.find(el => el.classList.contains('cursor-pointer') || el.closest('.cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabs[0];
        
        if (selesaiTabBtn) {
          triggerClick(selesaiTabBtn);
          await wait(1400);
        }

        // 3. Scrape baris pada tab Selesai Pemeriksaan
        const getSelesaiRows = () => {
          const allTables = Array.from(document.querySelectorAll('table')).filter(tbl => {
            if (tbl.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
            const fullTblText = clean(tbl.innerText || '');
            return (fullTblText.includes('nama') || fullTblText.includes('tiket')) && (fullTblText.includes('pelayanan') || fullTblText.includes('pemeriksaan'));
          });
          const targetTable = allTables[0] || document.querySelector('.table-individu-terdaftar table, table.table-pelayanan') || document;
          return Array.from(targetTable.querySelectorAll('tbody tr')).filter(r => {
            if (r.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
            const txt = (r.innerText || '').trim();
            return txt.length > 5 && !txt.includes('Tidak ditemukan') && !txt.includes('Belum ada data') && !txt.includes('Nama Peserta');
          });
        };

        let rows = [];
        for (let t = 0; t < 15; t++) {
          rows = getSelesaiRows();
          if (rows.length > 0) break;
          await wait(250);
        }

        const parseRow = (tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const txts = cells.map(c => clean(c.innerText || c.textContent || ''));
          const fullText = clean(tr.innerText || tr.textContent || '');

          const nikMatch = fullText.match(/\b\d{16}\b/);
          const rawTiket = txts[3] || "";
          const tiketMatch = rawTiket.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                            rawTiket.match(/\bTKT-[A-Z0-9-]+\b/i) ||
                            fullText.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                            fullText.match(/\bTKT-[A-Z0-9-]+\b/i);
          let nomorTiket = tiketMatch ? tiketMatch[0].toUpperCase() : (rawTiket && rawTiket !== "—" && rawTiket !== "-" && rawTiket.length >= 4 && !/^(laki|perempuan|belum|sedang|sudah|selesai)/i.test(rawTiket) ? rawTiket.trim().toUpperCase() : "—");

          let nama = "—";
          if (cells.length > 1) {
            nama = (cells[1].innerText || cells[1].textContent || '').split('\n')[0].trim();
          }
          if (!nama || nama === "—" || /^\d+$/.test(nama)) {
            nama = (cells[0]?.innerText || '').split('\n')[0].trim();
          }

          // Skrining Mandiri & Status Pelayanan
          const mandiriStatus = txts[6] || (txts.find(t => /^(selesai|belum|—|-)$/i.test(t)) || "—");
          const pelayananStatus = txts[7] || "Selesai Pemeriksaan";

          return {
            nama,
            nik: nikMatch ? nikMatch[0] : "—",
            nomorTiket,
            mandiriStatus: mandiriStatus || "—",
            pelayananStatus: pelayananStatus || "Selesai Pemeriksaan",
            isCompleted: true
          };
        };

        const scrapedSelesai = rows.map(parseRow);

        const targetTicketSet = new Set((targetTickets || []).map(t => clean(t).toUpperCase()));
        const targetNameSet = new Set((targetNames || []).map(n => clean(n).toLowerCase()));

        // Cocokkan pasien yang ada di list target
        const verifiedPatients = [];
        const foundTicketKeys = new Set();

        for (const p of scrapedSelesai) {
          const tKey = p.nomorTiket && p.nomorTiket !== "—" ? p.nomorTiket.toUpperCase() : null;
          const nKey = p.nama && p.nama !== "—" ? p.nama.toLowerCase() : null;

          const isMatch = (tKey && targetTicketSet.has(tKey)) || (nKey && targetNameSet.has(nKey));
          if (isMatch) {
            verifiedPatients.push(p);
            if (tKey) foundTicketKeys.add(tKey);
          }
        }

        // Jika ada tiket yang belum ketemu di halaman pertama Selesai Pemeriksaan, coba cari via input pencarian
        const missingTickets = (targetTickets || []).filter(t => t && t !== "—" && !foundTicketKeys.has(clean(t).toUpperCase()));
        if (missingTickets.length > 0 && searchInput) {
          for (const ticketToSearch of missingTickets.slice(0, 5)) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(searchInput, ticketToSearch);
            else searchInput.value = ticketToSearch;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            await wait(700);

            const searchRows = getSelesaiRows();
            for (const sr of searchRows) {
              const parsed = parseRow(sr);
              if (parsed.nomorTiket && parsed.nomorTiket.toUpperCase() === ticketToSearch.toUpperCase()) {
                verifiedPatients.push(parsed);
                break;
              }
            }
          }

          // Bersihkan kembali input pencarian
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(searchInput, '');
          else searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          await wait(400);
        }

        return {
          ok: true,
          verifiedPatients,
          allSelesaiRows: scrapedSelesai
        };
      },
      args: [tickets, names]
    });

    return res?.result || { ok: false, verifiedPatients: [] };
  } catch (err) {
    console.warn("[checkSelesaiPemeriksaanByTickets] Error:", err.message);
    return { ok: false, error: err.message, verifiedPatients: [] };
  }
}

async function ensureQueuePageSchoolFilter(tabId, targetSchool, targetClass, targetTabFilter = null) {
  try {
    if (!targetSchool || !targetClass) {
      const stored = await chrome.storage.local.get(["ckg_saved_school_name", "ckg_saved_school_class"]);
      if (!targetSchool) targetSchool = stored?.ckg_saved_school_name || "";
      if (!targetClass) targetClass = stored?.ckg_saved_school_class || "";
    }
    if (!targetTabFilter) {
      const storedTab = await chrome.storage.local.get("ckg_active_table_tab_filter");
      targetTabFilter = storedTab?.ckg_active_table_tab_filter || "BELUM";
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (sch, cls, tabFilter) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").replace(/\s+/g, " ").trim();
        const canonSchool = s => clean(s).toLowerCase()
          .replace(/\bsdn\s+negeri\b/g, "sd negeri")
          .replace(/\bsmpn\s+negeri\b/g, "smp negeri")
          .replace(/\bsman\s+negeri\b/g, "sma negeri")
          .replace(/\bsmkn\s+negeri\b/g, "smk negeri")
          .replace(/\bsdn\b/g, "sd negeri")
          .replace(/\bsmpn\b/g, "smp negeri")
          .replace(/\bsman\b/g, "sma negeri")
          .replace(/\bsmkn\b/g, "smk negeri")
          .replace(/\b0+(\d+)\b/g, "$1")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const triggerClick = el => {
          if (!el) return;
          const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn") || el;
          target.focus?.();
          const opts = { bubbles: true, cancelable: true, view: window };
          try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
          try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
          try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
          if (typeof target.click === "function") {
            try { target.click(); } catch(e) {}
          } else {
            try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
          }
        };

        // 0. Bersihkan input pencarian nama jika ada
        const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i]');
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Temukan tombol 'Tampilkan Pencarian'
        const btnCari = Array.from(document.querySelectorAll('button, a, div[role="button"], div.cursor-pointer, .btn')).find(b => {
          const t = clean(b.innerText || b.textContent || '').toLowerCase();
          return t.includes('tampilkan pencarian') || t === 'cari';
        });

        // Temukan card filter (pembungkus form filter di sebelah kiri)
        const filterCard = btnCari ? (btnCari.closest('div.bg-white, div.border, div.rounded-xl, div.rounded-lg, form, div.shadow-sm') || btnCari.parentElement?.parentElement) : document;

        // Helper mencari trigger dropdown sekolah & kelas secara adaptif
        const findSchoolTrigger = () => {
          const spans = Array.from((filterCard || document).querySelectorAll('span.line-clamp-2, div.cursor-pointer, [role="combobox"], button, input')).filter(el => {
            if (el === btnCari || (btnCari && btnCari.contains(el))) return false;
            const t = clean(el.innerText || el.textContent || el.placeholder || el.value || '').toLowerCase();
            return t === 'pilih sekolah' || t.includes('pilih sekolah');
          });
          if (spans.length > 0) return spans[0].closest('.cursor-pointer, [role="combobox"], button, div.relative') || spans[0];

          const label = Array.from((filterCard || document).querySelectorAll('label, div.font-semibold, div.font-500, span.font-semibold, p')).find(el => {
            const t = clean(el.innerText || el.textContent || '').toLowerCase();
            return t === 'sekolah' || t === 'pilih sekolah' || t === 'nama sekolah';
          });
          if (label) {
            const container = label.closest('.flex, .grid, .mb-4, div') || label.parentElement;
            const trig = container?.querySelector('.cursor-pointer, input, button, select, span.line-clamp-2') || label.nextElementSibling;
            if (trig) return trig;
          }

          const boxes = Array.from((filterCard || document).querySelectorAll('div.cursor-pointer, button, [role="combobox"], div.relative')).filter(el => {
            if (el === btnCari || (btnCari && btnCari.contains(el))) return false;
            const t = clean(el.innerText || el.textContent || '').toLowerCase();
            return !t.includes('tampilkan pencarian') && !t.includes('silakan lakukan filter') && !t.startsWith('kelas') && t.length > 0;
          });
          return boxes[0] || null;
        };

        const findClassTrigger = () => {
          const spans = Array.from((filterCard || document).querySelectorAll('span.line-clamp-2, div.cursor-pointer, [role="combobox"], button, input')).filter(el => {
            if (el === btnCari || (btnCari && btnCari.contains(el))) return false;
            const t = clean(el.innerText || el.textContent || el.placeholder || el.value || '').toLowerCase();
            return t === 'pilih kelas' || t.includes('pilih kelas') || t.startsWith('kelas ');
          });
          if (spans.length > 0) return spans[0].closest('.cursor-pointer, [role="combobox"], button, div.relative') || spans[0];

          const label = Array.from((filterCard || document).querySelectorAll('label, div.font-semibold, div.font-500, span.font-semibold, p')).find(el => {
            const t = clean(el.innerText || el.textContent || '').toLowerCase();
            return t === 'kelas' || t === 'pilih kelas' || t === 'tingkat / kelas';
          });
          if (label) {
            const container = label.closest('.flex, .grid, .mb-4, div') || label.parentElement;
            const trig = container?.querySelector('.cursor-pointer, input, button, select, span.line-clamp-2') || label.nextElementSibling;
            if (trig) return trig;
          }

          const boxes = Array.from((filterCard || document).querySelectorAll('div.cursor-pointer, button, [role="combobox"], div.relative')).filter(el => {
            if (el === btnCari || (btnCari && btnCari.contains(el))) return false;
            const t = clean(el.innerText || el.textContent || '').toLowerCase();
            return !t.includes('tampilkan pencarian') && !t.includes('silakan lakukan filter') && t.length > 0;
          });
          return boxes.length > 1 ? boxes[1] : null;
        };

        let schoolTrig = findSchoolTrigger();
        let classTrig = findClassTrigger();

        // Nilai saat ini
        let curSchool = clean(schoolTrig?.innerText || schoolTrig?.textContent || schoolTrig?.value || '');
        let curClass = clean(classTrig?.innerText || classTrig?.textContent || classTrig?.value || '');

        // 2. Jika target school ditentukan dan nilai saat ini belum cocok (misal reset ke 'Pilih Sekolah'), pilih dari dropdown
        const wantCanonSch = canonSchool(sch);
        const curCanonSch = canonSchool(curSchool);
        if (sch && (!curSchool || /^(pilih sekolah|semua sekolah|\*)$/i.test(curSchool) || (!curCanonSch.includes(wantCanonSch) && !wantCanonSch.includes(curCanonSch)))) {
          if (schoolTrig) {
            triggerClick(schoolTrig);
            await wait(600);

            // Cek apakah ada input pencarian di modal/dropdown
            const searchInp = document.querySelector('input[placeholder*="Cari" i], input[type="search"], input.vs__search, .multiselect__input, input.dropdown-search');
            if (searchInp) {
              searchInp.focus();
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(searchInp, sch);
              else searchInp.value = sch;
              searchInp.dispatchEvent(new Event('input', { bubbles: true }));
              searchInp.dispatchEvent(new Event('change', { bubbles: true }));
              await wait(500);
            }

            // Kumpulkan opsi dari seluruh modal / dropdown
            const options = Array.from(document.querySelectorAll('button, li, [role="option"], div.cursor-pointer, div.border-b, div[class*="py-"], div[class*="hover:"], span, div')).filter(el => {
              if (el === schoolTrig || (schoolTrig && schoolTrig.contains(el))) return false;
              if (el.querySelector('input') || el.querySelector('h1, h2, h3, h4')) return false;
              if (el.tagName === 'BUTTON' && el.querySelector('svg') && (el.innerText || '').trim().length <= 2) return false;
              if (el.children.length > 2) return false;
              const t = clean(el.innerText || el.textContent || '');
              return t.length > 2 && t.length < 80 && !/^pilih\s+(sekolah|kelas|jenjang)/i.test(t) && !t.includes('data tidak ditemukan');
            });

            const matchedOpt = options.find(el => {
              const t = canonSchool(el.innerText || el.textContent || '');
              return t === wantCanonSch || t.includes(wantCanonSch) || wantCanonSch.includes(t);
            }) || options.find(el => {
              const tCore = canonSchool(el.innerText || el.textContent || '').replace(/\b(negeri|swasta)\b/g, '').trim();
              const wCore = wantCanonSch.replace(/\b(negeri|swasta)\b/g, '').trim();
              return wCore.length >= 4 && (tCore === wCore || tCore.includes(wCore) || wCore.includes(tCore));
            });

            if (matchedOpt) {
              triggerClick(matchedOpt);
              await wait(600);
              curSchool = clean(matchedOpt.innerText || matchedOpt.textContent || '');

              // Tutup modal jika masih ada tombol X
              const modalClose = document.querySelector('.modal-content button, [role="dialog"] button, div.fixed button');
              if (modalClose && clean(modalClose.innerText || '').toLowerCase() === 'x') {
                triggerClick(modalClose);
                await wait(200);
              }
            }
          }
        }

        // 3. Jika target class ditentukan dan belum cocok, pilih dari dropdown
        const curDigits = curClass.replace(/[^0-9]/g, '');
        const clsDigits = cls.replace(/[^0-9]/g, '');
        const romanMap = { "1":"i","2":"ii","3":"iii","4":"iv","5":"v","6":"vi","7":"vii","8":"viii","9":"ix","10":"x","11":"xi","12":"xii" };
        const clsRom = romanMap[clsDigits] || "";
        const isClassMatched = (curDigits && clsDigits)
          ? (curDigits === clsDigits)
          : (curClass.toLowerCase() === cls.toLowerCase() || curClass.toLowerCase() === ("kelas " + cls.toLowerCase()));

        if (cls && (!curClass || /^(pilih kelas|semua kelas|\*)$/i.test(curClass) || !isClassMatched)) {
          if (classTrig) {
            triggerClick(classTrig);
            await wait(600);

            const options = Array.from(document.querySelectorAll('button, li, [role="option"], div.cursor-pointer, div.border-b, div[class*="py-"], span, div')).filter(el => {
              if (el === classTrig || (classTrig && classTrig.contains(el))) return false;
              if (el.querySelector('input') || el.querySelector('h1, h2, h3, h4')) return false;
              if (el.tagName === 'BUTTON' && el.querySelector('svg') && (el.innerText || '').trim().length <= 2) return false;
              if (el.children.length > 2) return false;
              const t = clean(el.innerText || el.textContent || '');
              return t.length > 0 && t.length < 40 && !/^pilih\b/i.test(t);
            });

            const matchedOpt = options.find(el => {
              const t = clean(el.innerText || el.textContent || '').toLowerCase();
              if (t === cls.toLowerCase() || t === ("kelas " + cls.toLowerCase())) return true;
              if (clsDigits && t.replace(/[^0-9]/g, '') === clsDigits) return true;
              if (clsRom && (t === clsRom || t === ("kelas " + clsRom) || t.replace(/[^a-z]/g, '') === clsRom)) return true;
              if (clsDigits && new RegExp('\\b' + clsDigits + '\\b').test(t)) return true;
              return false;
            }) || options.find(el => {
              const t = clean(el.innerText || el.textContent || '').toLowerCase();
              return cls.length >= 3 && t.includes(cls.toLowerCase());
            });

            if (matchedOpt) {
              triggerClick(matchedOpt);
              await wait(600);
              curClass = clean(matchedOpt.innerText || matchedOpt.textContent || '');
            }
          }
        }

        // 4. KLIK TOMBOL 'TAMPILKAN PENCARIAN'
        // Jika tabel kosong atau setelah kembali dari pemeriksaan, tombol ini WAJIB diklik agar data siswa muncul
        if (btnCari) {
          triggerClick(btnCari);
          if (typeof btnCari.click === 'function') {
            try { btnCari.click(); } catch(e) {}
          }
          await wait(1500);

          // Tunggu baris tabel ter-render
          for (let i = 0; i < 20; i++) {
            const curRows = document.querySelectorAll('tbody tr');
            if (curRows.length > 0 && !curRows[0].innerText.includes('Tidak ditemukan') && !curRows[0].innerText.includes('Belum ada data') && !curRows[0].innerText.includes('Silakan lakukan filter')) {
              break;
            }
            await wait(200);
          }
        }

        // 5. Pastikan tab antrean aktif sesuai targetTabFilter
        await wait(400);
        const isSedang = (tabFilter || "BELUM").toUpperCase() === "SEDANG";
        const targetTabRegex = isSedang
          ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
          : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;

        const tabs = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
          if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
          const t = clean(el.innerText || el.textContent || '').toLowerCase();
          return targetTabRegex.test(t);
        });
        const activeTabEl = tabs.find(el => el.classList.contains('cursor-pointer') || el.closest('.cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabs[0];
        if (activeTabEl) {
          triggerClick(activeTabEl);
          await wait(800);
        }

        return {
          ok: true,
          school: curSchool || sch,
          className: curClass || cls,
          refreshed: true
        };
      },
      args: [targetSchool, targetClass, targetTabFilter]
    });
  } catch (e) {
    console.warn("[SchoolFilter] Gagal restore school filter:", e.message);
  }
}


async function executeSingleTablePatientExam(tabId, patient, tabFilter = null, customValuesOverride = null, options = {}) {
  isTablePatientCancelled = false;
  if (!tabFilter) {
    const storedTab = await chrome.storage.local.get("ckg_active_table_tab_filter");
    tabFilter = storedTab?.ckg_active_table_tab_filter || "BELUM";
  }
  const openInNewTab = !!options?.openInNewTab;
  const closeTabWhenDone = options?.closeTabWhenDone !== false;

  currentActiveTablePatient = { nama: patient.nama, nomorTiket: patient.nomorTiket, nik: patient.nik, index: patient.index, tabFilter };
  broadcast({ type: "TABLE_ACTIVE_PATIENT", patient: currentActiveTablePatient });

  // Deteksi origin page saat ini (CKG Pelayanan Umum vs Sekolah)
  const storedOrigin = await chrome.storage.local.get(["ckg_origin_pelayanan_url", "ckg_is_sekolah", "ckg_saved_pelayanan_date_filter", "ckg_saved_school_name", "ckg_saved_school_class"]);
  const masterTabInfo = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  const isSekolahOrigin = masterTabInfo?.url
    ? masterTabInfo.url.includes("sekolah")
    : !!storedOrigin?.ckg_is_sekolah;
  const originQueueUrl = isSekolahOrigin
    ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
    : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

  await chrome.storage.local.set({
    ckg_origin_pelayanan_url: originQueueUrl,
    ckg_is_sekolah: isSekolahOrigin
  });

  // Jika CKG Sekolah dan filter sekolah belum tersimpan, coba ambil langsung dari tab utama
  if (isSekolahOrigin && (!storedOrigin?.ckg_saved_school_name || !storedOrigin?.ckg_saved_school_class) && tabId) {
    try {
      const [scraped] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim();
          const btnCari = Array.from(document.querySelectorAll('button, a, div[role="button"], div.cursor-pointer, .btn')).find(b => {
            const t = clean(b.innerText || b.textContent || '').toLowerCase();
            return t.includes('tampilkan pencarian') || t === 'cari';
          });
          const filterContainer = btnCari ? (btnCari.closest('form, div.flex, div.grid, div.row') || btnCari.parentElement) : document;
          let school = "";
          let cls = "";
          const boxes = Array.from((filterContainer || document).querySelectorAll('span.line-clamp-2, div.cursor-pointer, [role="combobox"], select, button, input')).filter(el => {
            if (el === btnCari || btnCari?.contains(el)) return false;
            return true;
          });
          for (const box of boxes) {
            const t = clean(box.innerText || box.textContent || box.value || '');
            if (!t || /^(tampilkan pencarian|cari|lakukan filter)$/i.test(t)) continue;
            if (/kelas\s*\d+/i.test(t) || /^kelas\b/i.test(t) || /pilih kelas/i.test(t)) {
              if (!cls && !/pilih kelas/i.test(t)) cls = t;
            } else if (!school && !/^(pilih sekolah|sekolah)$/i.test(t) && t.length > 2) {
              school = t;
            }
          }
          return { school, cls };
        }
      }).catch(() => []);
      if (scraped?.result?.school) {
        storedOrigin.ckg_saved_school_name = scraped.result.school;
        await chrome.storage.local.set({ ckg_saved_school_name: scraped.result.school });
      }
      if (scraped?.result?.cls) {
        storedOrigin.ckg_saved_school_class = scraped.result.cls;
        await chrome.storage.local.set({ ckg_saved_school_class: scraped.result.cls });
      }
    } catch (e) {}
  }

  // Jika mode paralel / tab baru diaktifkan, buka tab khusus untuk pasien ini
  let workerTabId = tabId;
  let isDedicatedWorkerTab = false;
  if (openInNewTab) {
    const newWorkerTab = await chrome.tabs.create({ url: originQueueUrl, active: true });
    workerTabId = newWorkerTab.id;
    isDedicatedWorkerTab = true;
    activeTableWorkers.set(workerTabId, { runner: null, isDedicatedTab: true, patient });
    broadcast({
      type: "AUTOMATION_LOG",
      message: `[Tab Baru #${workerTabId}] Membuka tab pelayanan untuk: ${patient.nama} (Tiket: ${patient.nomorTiket || '—'}) [Tab: ${tabFilter}]...`
    });

    // Tunggu tab baru selesai memuat halaman /ckg-pelayanan
    const loadDeadline = Date.now() + 14000;
    while (Date.now() < loadDeadline) {
      if (isTablePatientCancelled) break;
      const t = await chrome.tabs.get(workerTabId).catch(() => null);
      if (t?.status === "complete") {
        const isReadyDom = await chrome.scripting.executeScript({
          target: { tabId: workerTabId },
          world: "MAIN",
          func: () => !!(document.querySelector('input#searchNik, input[placeholder*="Masukkan" i], .mx-datepicker, table, tbody'))
        }).then(([r]) => r?.result).catch(() => false);
        if (isReadyDom) break;
      }
      await new Promise(r => setTimeout(r, 350));
    }
    await new Promise(r => setTimeout(r, 500));
  } else {
    activeTableWorkers.set(workerTabId, { runner: null, isDedicatedTab: false, patient });
    broadcast({ type: "AUTOMATION_LOG", message: `[Otomasi Tabel] Membuka pemeriksaan: ${patient.nama} (Tiket: ${patient.nomorTiket || '—'}) [Tab: ${tabFilter}]...` });

    // Pastikan tab berada di originQueueUrl jika saat ini masih di pendaftaran / halaman lain
    const curT = await chrome.tabs.get(workerTabId).catch(() => null);
    if (curT?.url && !curT.url.includes("detail-pemeriksaan") && !curT.url.includes(originQueueUrl.split('/').pop())) {
      await chrome.tabs.update(workerTabId, { url: originQueueUrl, active: true });
      await new Promise(r => setTimeout(r, 1500));
    }

    // Tunggu tab siap memuat tabel / kolom pencarian
    const loadDeadline = Date.now() + 10000;
    while (Date.now() < loadDeadline) {
      if (isTablePatientCancelled) break;
      const t = await chrome.tabs.get(workerTabId).catch(() => null);
      if (t?.status === "complete") {
        const isReadyDom = await chrome.scripting.executeScript({
          target: { tabId: workerTabId },
          world: "MAIN",
          func: () => !!(document.querySelector('input#searchNik, input[placeholder*="Masukkan" i], .mx-datepicker, table, tbody, tr'))
        }).then(([r]) => r?.result).catch(() => false);
        if (isReadyDom) break;
      }
      await new Promise(r => setTimeout(r, 350));
    }
    await new Promise(r => setTimeout(r, 400));
  }

  const curTabInfo = await chrome.tabs.get(workerTabId).catch(() => null);
  const { ckg_config: userConfig } = await chrome.storage.local.get("ckg_config");
  let selesRes = null;

  try {
    if (isTablePatientCancelled) return { ok: false, stopped: true };

    // 1. Cek apakah tab saat ini sudah berada di halaman detail pemeriksaan
    const isAlreadyAtDetail = curTabInfo?.url && curTabInfo.url.includes("detail-pemeriksaan");
    let patientDetailUrl = isAlreadyAtDetail ? curTabInfo.url : null;

    if (!isAlreadyAtDetail) {
      // Fungsi helper di dalam halaman antrean untuk mencari pasien (langsung di tabel ATAU via Pencarian Nomor Tiket / Nama / NIK) lalu klik Mulai/Lanjutkan
      const tryFindAndClickPatientInQueue = async (allowTicketSearch = true) => {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: workerTabId },
          world: "MAIN",
          func: async (pNama, pTiket, pIndex, currentTabFilter, pNik, doSearchByTicket) => {
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const triggerClick = el => {
              if (!el) return;
              const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn, li, [role='option']") || el;
              target.focus?.();
              const opts = { bubbles: true, cancelable: true, view: window };
              try { target.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(e) {}
              try { target.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(e) {}
              try { target.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(e) {}
              try { target.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(e) {}
              if (typeof target.click === "function") {
                try { target.click(); } catch(e) {}
              } else {
                try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
              }
            };

            const selectQueueTab = async (wantSedang) => {
              const targetTabRegex = wantSedang
                ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
                : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;
              const tabs = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
                if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
                const t = clean(el.innerText || el.textContent || '');
                return targetTabRegex.test(t);
              });
              const tabBtn = tabs.find(el => el.classList.contains('cursor-pointer') || el.closest('.cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabs[0];
              if (tabBtn) {
                const isAlreadyActive = tabBtn.classList.contains('active') ||
                                        tabBtn.classList.contains('border-primary') ||
                                        tabBtn.classList.contains('text-primary') ||
                                        tabBtn.getAttribute('aria-selected') === 'true' ||
                                        tabBtn.closest('.active, [aria-selected="true"]');
                if (!isAlreadyActive) {
                  triggerClick(tabBtn);
                  await wait(700);
                }
              }
            };

            const isSedang = (currentTabFilter || "BELUM").toUpperCase() === "SEDANG";
            await selectQueueTab(isSedang);

            const isEligible = tr => {
              const btn = Array.from(tr.querySelectorAll('button, a, [role="button"], div.cursor-pointer')).find(b => {
                if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                return /^(mulai|mulai pemeriksaan|lanjut|lanjutkan|periksa)$/i.test(t) || t.startsWith('mulai') || t.startsWith('lanjut');
              });
              return !!btn;
            };

            const getValidRows = () => Array.from(document.querySelectorAll('tbody tr, .table-individu-terdaftar table tbody tr, table tbody tr')).filter(r => {
              const txt = (r.innerText || '').trim();
              return txt.length > 5 &&
                     !txt.includes('Tidak ditemukan') &&
                     !txt.includes('Belum ada data') &&
                     !txt.includes('Memuat data') &&
                     !txt.includes('loading') &&
                     !txt.includes('Lakukan Pencarian') &&
                     !txt.includes('pencarian terlebih dahulu');
            });

            const findMatchingRow = (rowsList) => {
              let trMatch = null;
              if (pNik && String(pNik).replace(/\D/g, '').length >= 10 && pNik !== '—') {
                const cleanDigits = String(pNik).replace(/\D/g, '');
                trMatch = rowsList.find(tr => (tr.innerText || '').replace(/\D/g, '').includes(cleanDigits) && isEligible(tr));
              }
              if (!trMatch && pTiket && pTiket !== '—') {
                const cleanTiket = pTiket.trim().toUpperCase();
                trMatch = rowsList.find(tr => {
                  const cells = tr.querySelectorAll('td');
                  const c3 = (cells[3]?.innerText || cells[3]?.textContent || '').trim().toUpperCase();
                  if (c3 && (c3 === cleanTiket || c3.includes(cleanTiket))) return isEligible(tr);
                  return (tr.innerText || tr.textContent || '').toUpperCase().includes(cleanTiket) && isEligible(tr);
                });
              }
              if (!trMatch && pNama && pNama !== '—') {
                const cleanPNama = pNama.toLowerCase().trim();
                trMatch = rowsList.find(tr => {
                  const cells = tr.querySelectorAll('td');
                  const c1 = (cells[1]?.innerText || cells[1]?.textContent || '').toLowerCase().trim();
                  if (c1 && (c1.includes(cleanPNama) || cleanPNama.includes(c1))) return isEligible(tr);
                  return (tr.innerText || tr.textContent || '').toLowerCase().includes(cleanPNama) && isEligible(tr);
                });
              }
              return trMatch;
            };

            // Cek apakah baris pasien sudah langsung terlihat di tabel saat ini
            let rows = getValidRows();
            let targetTr = findMatchingRow(rows);

            // JIKA BELUM DITEMUKAN DI TABEL (misal halaman baru dibuka / default "Lakukan Pencarian" / tanggal ter-reset):
            // Gunakan fitur pencarian berdasarkan NOMOR TIKET (atau Nama / NIK jika tiket tidak ada) di samping filter tanggal!
            if (!targetTr && doSearchByTicket) {
              const hasValidTiket = pTiket && pTiket !== "—" && pTiket.trim().length >= 3;
              const hasValidNik = pNik && pNik !== "—" && String(pNik).replace(/\D/g, '').length >= 10;
              const hasValidNama = pNama && pNama !== "—" && pNama.trim().length >= 3;

              const searchInp = document.querySelector('input#searchNik, input[placeholder*="Masukkan" i], input[placeholder*="nama" i], input[placeholder*="tiket" i], input[placeholder*="nik" i], input[type="search"]');

              if (searchInp) {
                // Helper deteksi kriteria pencarian yang sedang aktif di UI
                const getActiveSearchMode = () => {
                  const ph = clean(searchInp.placeholder || "").toLowerCase();
                  if (ph.includes("tiket") || ph.includes("ticket")) return "Nomor Tiket";
                  if (ph.includes("nik")) return "NIK";
                  if (ph.includes("nama") || ph.includes("name")) return "Nama";

                  const rowContainer = searchInp.closest('div.flex, form, .input-group, div.grid, div.w-full.flex, div[class*="search"]') || searchInp.parentElement?.parentElement || document;
                  const trigs = Array.from(rowContainer.querySelectorAll('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2')).filter(el => {
                    if (el.contains(searchInp) || el === searchInp || el.tagName === 'INPUT') return false;
                    if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
                    const t = clean(el.innerText || el.textContent || '').toLowerCase();
                    return /^(nama|nomor tiket|no\.?\s*tiket|nik|mitra|tiket|ticket)$/i.test(t) || t === 'nama' || t.includes('tiket');
                  });
                  if (trigs.length > 0) {
                    const t = clean(trigs[0].innerText || trigs[0].textContent || "").toLowerCase();
                    if (t.includes("tiket") || t.includes("ticket")) return "Nomor Tiket";
                    if (t === "nik" || t.includes("nik")) return "NIK";
                    if (t === "nama" || t.includes("nama")) return "Nama";
                  }
                  return "Nama";
                };

                // Helper temukan trigger dropdown kriteria yang berdampingan dengan kolom pencarian
                const findCriteriaTrigger = () => {
                  const rowContainer = searchInp.closest('div.flex, form, .input-group, div.grid, div.w-full.flex, div[class*="search"]') || searchInp.parentElement?.parentElement || document;
                  const candidateTriggers = Array.from(rowContainer.querySelectorAll('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2')).filter(el => {
                    if (el.contains(searchInp) || el === searchInp || el.tagName === 'INPUT') return false;
                    if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
                    const t = clean(el.innerText || el.textContent || '').toLowerCase();
                    return /^(nama|nomor tiket|no\.?\s*tiket|nik|mitra|tiket|ticket)$/i.test(t) || t === 'nama' || t.includes('tiket');
                  });
                  if (candidateTriggers.length > 0) {
                    return candidateTriggers[0].closest('button, [role="combobox"], div.cursor-pointer') || candidateTriggers[0];
                  }
                  const prevWrap = searchInp.parentElement?.previousElementSibling || searchInp.previousElementSibling;
                  if (prevWrap) {
                    const btnInside = prevWrap.querySelector('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2');
                    if (btnInside) return btnInside.closest('button, [role="combobox"], div.cursor-pointer') || btnInside;
                    return prevWrap;
                  }
                  return document.querySelector('span.line-clamp-2')?.closest('button, div.cursor-pointer') || null;
                };

                // Helper ganti kriteria dropdown dengan verifikasi bahwa UI benar-benar berubah
                const switchCriteria = async (targetMode) => {
                  const want = targetMode.toLowerCase();
                  const cur = getActiveSearchMode().toLowerCase();
                  if ((want === "nomor tiket" || want === "tiket") && (cur === "nomor tiket" || cur === "tiket")) return true;
                  if ((want === "nama" || want === "name") && (cur === "nama" || cur === "name")) return true;
                  if (want === "nik" && cur === "nik") return true;

                  const trigger = findCriteriaTrigger();
                  if (!trigger) return false;
                  const clickTarget = trigger.closest('button, [role="combobox"], div.cursor-pointer') || trigger.querySelector('button, [role="combobox"], div.cursor-pointer') || trigger;

                  const findOption = () => {
                    const poppers = Array.from(document.querySelectorAll('.v-popper__popper, [class*="popper"], div[role="menu"], div[role="listbox"], div.fixed, div.absolute, [data-popper-placement]'));
                    let options = [];
                    for (const pop of poppers) {
                      const items = Array.from(pop.querySelectorAll('div, span, button, li, a, [role="menuitem"], [role="option"]')).filter(el => {
                        if (el.children.length > 2) return false;
                        const t = clean(el.innerText || el.textContent || '').toLowerCase();
                        return t.length >= 2 && t.length < 35;
                      });
                      options.push(...items);
                    }
                    if (options.length === 0) {
                      options = Array.from(document.querySelectorAll('li, div.cursor-pointer, span.cursor-pointer, button, [role="option"], [role="menuitem"], div[class*="option"], div[class*="dropdown-item"], div[class*="item"]')).filter(el => {
                        if (trigger && (el === trigger || trigger.contains(el))) return false;
                        if (el.closest('table, tbody, thead, .mx-datepicker')) return false;
                        const t = clean(el.innerText || el.textContent || '').toLowerCase();
                        return t.length >= 2 && t.length < 35;
                      });
                    }
                    return options.find(el => {
                      const t = clean(el.innerText || el.textContent || '').toLowerCase();
                      if (want === 'nik') return t === 'nik' || t === 'no. nik' || t === 'no nik' || t.startsWith('nik');
                      if (want === 'nama' || want === 'name') return (t === 'name' || t === 'nama' || t.startsWith('nama') || t.startsWith('name')) && !t.includes('tiket');
                      if (want === 'nomor tiket' || want === 'tiket') return t.includes('tiket') || t.includes('ticket') || t === 'nomor tiket' || t === 'no. tiket' || t === 'no tiket';
                      return false;
                    });
                  };

                  triggerClick(clickTarget);
                  await wait(350);
                  let matchedOpt = findOption();
                  if (!matchedOpt) {
                    await wait(250);
                    matchedOpt = findOption();
                  }
                  if (matchedOpt) {
                    triggerClick(matchedOpt.closest('.cursor-pointer, button, li, [role="option"]') || matchedOpt);
                    await wait(400);
                    const updated = getActiveSearchMode().toLowerCase();
                    if ((want === "nomor tiket" || want === "tiket") && (updated === "nomor tiket" || updated === "tiket")) return true;
                    if ((want === "nama" || want === "name") && (updated === "nama" || updated === "name")) return true;
                    if (want === "nik" && updated === "nik") return true;
                  }

                  // Percobaan ulang jika popover sempat tertutup atau terlambat render
                  triggerClick(clickTarget);
                  await wait(350);
                  matchedOpt = findOption();
                  if (matchedOpt) {
                    triggerClick(matchedOpt.closest('.cursor-pointer, button, li, [role="option"]') || matchedOpt);
                    await wait(400);
                    const finalMode = getActiveSearchMode().toLowerCase();
                    if ((want === "nomor tiket" || want === "tiket") && (finalMode === "nomor tiket" || finalMode === "tiket")) return true;
                    if ((want === "nama" || want === "name") && (finalMode === "nama" || finalMode === "name")) return true;
                    if (want === "nik" && finalMode === "nik") return true;
                  }
                  return false;
                };

                // Strategi pencarian adaptif: Nomor Tiket (jika ada) -> NIK (jika ada) -> Nama
                const strategies = [];
                if (hasValidTiket) strategies.push({ mode: "Nomor Tiket", val: pTiket.trim() });
                if (hasValidNik) strategies.push({ mode: "NIK", val: String(pNik).replace(/\D/g, '') });
                if (hasValidNama) strategies.push({ mode: "Nama", val: pNama.trim() });

                for (const strat of strategies) {
                  await switchCriteria(strat.mode);
                  const activeMode = getActiveSearchMode();

                  // PROTEKSI MUTLAK: Jangan pernah memasukkan nomor tiket ke kolom 'Nama'!
                  let actualVal = strat.val;
                  if (activeMode === "Nama") {
                    if (!hasValidNama) continue;
                    actualVal = pNama.trim();
                  } else if (activeMode === "Nomor Tiket") {
                    if (!hasValidTiket) continue;
                    actualVal = pTiket.trim();
                  } else if (activeMode === "NIK") {
                    if (!hasValidNik) continue;
                    actualVal = String(pNik).replace(/\D/g, '');
                  }

                  // Bersihkan dan masukkan nilai ke kolom pencarian
                  searchInp.focus();
                  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (nativeSetter) nativeSetter.call(searchInp, actualVal);
                  else searchInp.value = actualVal;
                  if (typeof searchInp._assign === 'function') {
                    try { searchInp._assign(actualVal); } catch(e) {}
                  }
                  searchInp.dispatchEvent(new InputEvent('input', { bubbles: true, data: actualVal, inputType: 'insertText' }));
                  searchInp.dispatchEvent(new Event('change', { bubbles: true }));
                  await wait(150);

                  const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
                  searchInp.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
                  searchInp.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
                  searchInp.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

                  const parentForm = searchInp.closest('form');
                  if (parentForm) {
                    try { parentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch(e) {}
                  }

                  // Tunggu hasil pencarian muncul di tabel
                  await wait(800);
                  for (let poll = 0; poll < 16; poll++) {
                    rows = getValidRows();
                    targetTr = findMatchingRow(rows);
                    if (targetTr) break;
                    await wait(220);
                  }

                  // Jika belum ketemu di tab saat ini (misal Belum), cek juga tab sebelahnya (Sedang Pemeriksaan / Belum Pemeriksaan)
                  if (!targetTr) {
                    await selectQueueTab(!isSedang);
                    await wait(700);
                    for (let poll = 0; poll < 10; poll++) {
                      rows = getValidRows();
                      targetTr = findMatchingRow(rows);
                      if (targetTr) break;
                      await wait(200);
                    }
                    if (!targetTr) {
                      // Kembalikan ke tab semula sebelum mencoba strategi pencarian berikutnya
                      await selectQueueTab(isSedang);
                    }
                  }

                  if (targetTr) break; // Baris pasien ditemukan!
                }
              }
            }

            const tabNameDisplay = isSedang ? "Sedang Pemeriksaan" : "Belum Pemeriksaan";
            if (!targetTr) {
              return { ok: false, notFound: true, error: `Pasien ${pNama} (${pTiket || pNik || '—'}) belum ditemukan di tab ${tabNameDisplay}` };
            }

            // Ambil tombol aksi (prioritaskan dari cells[8] / Pemeriksaan)
            const targetCells = targetTr.querySelectorAll('td');
            const cellAction = targetCells[8] || targetCells[targetCells.length - 2] || targetTr;
            const btn = cellAction.querySelector('button:not([disabled]), a.cursor-pointer, [role="button"]') ||
                        Array.from(targetTr.querySelectorAll('button, a, [role="button"], div.cursor-pointer')).find(b => {
                          if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
                          const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                          return /^(mulai|mulai pemeriksaan|lanjut|lanjutkan|periksa)$/i.test(t) || t.startsWith('mulai') || t.startsWith('lanjut');
                        }) || targetTr.querySelector('button:not([disabled])');

            if (!btn) return { ok: false, error: "Tombol Mulai/Lanjutkan tidak ditemukan pada baris pasien" };

            btn.scrollIntoView({ block: 'center' });
            triggerClick(btn);
            await wait(800);

            // TANGANI MODAL KONFIRMASI TANGGAL PEMERIKSAAN LANGSUNG SETELAH KLIK MULAI
            for (let m = 0; m < 15; m++) {
              if (window.location.href.includes("detail-pemeriksaan")) break;
              const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
                if (el.children.length > 3) return false;
                const t = clean(el.innerText || el.textContent || "");
                return t.includes("konfirmasi tanggal pemeriksaan");
              });
              if (heading) {
                const modalBox = heading.closest("div.fixed, div[role='dialog'], .modal, div.z-2000, div.z-50, div.bg-white, div.rounded-xl, div.rounded-lg, div.shadow-xl") || heading.parentElement?.parentElement;
                const searchRoot = modalBox || document;
                const wantDay = String(new Date().getDate());
                const dayCells = Array.from(searchRoot.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, button")).filter(cell => {
                  const txt = clean(cell.innerText || cell.textContent || "");
                  return txt === wantDay && !cell.classList.contains("text-gray-300");
                });
                if (dayCells.length > 0) {
                  triggerClick(dayCells[0]);
                  await wait(200);
                } else {
                  const todayCell = searchRoot.querySelector("td.today, td.current, td.active, .mx-date-row td.today, button.relative.h-auto");
                  if (todayCell) triggerClick(todayCell);
                }
                const btnSimpan = Array.from(searchRoot.querySelectorAll("button, a, [role='button'], div.cursor-pointer, .btn")).find(b => {
                  if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
                  const t = clean(b.innerText || b.textContent || "");
                  if (/kembali|batal|tutup/i.test(t)) return false;
                  return t === "simpan" || t === "ya, simpan" || t.includes("simpan") || (b.classList.contains("btn-fill-primary") && !t.includes("mulai"));
                });
                if (btnSimpan) {
                  triggerClick(btnSimpan);
                  await wait(800);
                  break;
                }
              }
              await wait(250);
            }

            return { ok: true };
          },
          args: [patient.nama, patient.nomorTiket, patient.index, tabFilter, patient.nik, allowTicketSearch]
        });
        return res?.result;
      };

      // 1. Siapkan filter halaman jika ini tab baru / tab antrean yang belum terfilter
      if (isSekolahOrigin) {
        const schToUse = storedOrigin?.ckg_saved_school_name || "";
        const clsToUse = storedOrigin?.ckg_saved_school_class || "";
        if (schToUse || clsToUse || isDedicatedWorkerTab) {
          broadcast({
            type: "AUTOMATION_LOG",
            message: `[Pencarian Antrean] Menyiapkan filter sekolah (${schToUse || 'Sekolah'} - ${clsToUse || 'Semua'}) lalu mencari ${patient.nama}...`
          });
          await ensureQueuePageSchoolFilter(workerTabId, schToUse, clsToUse, tabFilter);
          await new Promise(r => setTimeout(r, 600));
        }
      } else if (!isSekolahOrigin && isDedicatedWorkerTab && storedOrigin?.ckg_saved_pelayanan_date_filter) {
        await ensureQueuePageDateFilter(workerTabId, storedOrigin.ckg_saved_pelayanan_date_filter, tabFilter);
        await new Promise(r => setTimeout(r, 600));
      }

      // 2. Cari baris pasien di antrean (atau via pencarian Nomor Tiket / Nama / NIK)
      let clickRowRes = await tryFindAndClickPatientInQueue(true);

      // Percobaan 2 (Fallback): Jika pencarian belum memunculkan baris pasien
      if (!clickRowRes?.ok) {
        if (isSekolahOrigin) {
          await ensureQueuePageSchoolFilter(workerTabId, storedOrigin?.ckg_saved_school_name, storedOrigin?.ckg_saved_school_class, tabFilter);
          await new Promise(r => setTimeout(r, 800));
          clickRowRes = await tryFindAndClickPatientInQueue(true);
        } else if (!isSekolahOrigin && storedOrigin?.ckg_saved_pelayanan_date_filter) {
          await ensureQueuePageDateFilter(workerTabId, storedOrigin.ckg_saved_pelayanan_date_filter, tabFilter);
          await new Promise(r => setTimeout(r, 800));
          clickRowRes = await tryFindAndClickPatientInQueue(true);
        }
      }

      if (!clickRowRes?.ok) {
        throw new Error(clickRowRes?.error || "Gagal menemukan / mengklik tombol Mulai pada baris pasien");
      }

      // 2. Tunggu URL tab berpindah ke detail-pemeriksaan dengan fallback modal clicker
      const navDeadline = Date.now() + 15000;
      while (Date.now() < navDeadline) {
        if (isTablePatientCancelled) return { ok: false, stopped: true };
        const curTab = await chrome.tabs.get(workerTabId).catch(() => null);
        if (curTab?.url && curTab.url.includes("pendaftaran")) {
          await chrome.tabs.update(workerTabId, { url: originQueueUrl, active: true });
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        if (curTab?.url && curTab.url.includes("detail-pemeriksaan")) {
          patientDetailUrl = curTab.url;
          if (!isDedicatedWorkerTab) {
            await chrome.storage.local.set({ ckg_active_patient_detail_url: patientDetailUrl });
          }
          break;
        }

        // Fallback jika modal konfirmasi tanggal masih terbuka di DOM
        await chrome.scripting.executeScript({
          target: { tabId: workerTabId },
          world: "MAIN",
          func: () => {
            const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
              if (el.children.length > 3) return false;
              return clean(el.innerText || el.textContent || "").includes("konfirmasi tanggal pemeriksaan");
            });
            if (heading) {
              const modalBox = heading.closest("div.fixed, div[role='dialog'], .modal, div.z-2000, div.z-50, div.bg-white, div.rounded-xl, div.rounded-lg, div.shadow-xl") || heading.parentElement?.parentElement;
              const searchRoot = modalBox || document;
              const wantDay = String(new Date().getDate());
              const dayCells = Array.from(searchRoot.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, button")).filter(cell => {
                const txt = clean(cell.innerText || cell.textContent || "");
                return txt === wantDay && !cell.classList.contains("text-gray-300");
              });
              if (dayCells.length > 0) {
                dayCells[0].focus?.();
                dayCells[0].click();
              } else {
                const todayCell = searchRoot.querySelector("td.today, td.current, td.active, .mx-date-row td.today, button.relative.h-auto");
                if (todayCell) { todayCell.focus?.(); todayCell.click(); }
              }
              const btnSimpan = Array.from(searchRoot.querySelectorAll("button, a, [role='button'], div.cursor-pointer, .btn")).find(b => {
                if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
                const t = clean(b.innerText || b.textContent || "");
                if (/kembali|batal|tutup/i.test(t)) return false;
                return t === "simpan" || t === "ya, simpan" || t.includes("simpan") || (b.classList.contains("btn-fill-primary") && !t.includes("mulai"));
              });
              if (btnSimpan) {
                btnSimpan.focus?.();
                btnSimpan.click();
              }
            }
          }
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 400));
      }

      if (!patientDetailUrl) {
        throw new Error(`Gagal membuka halaman detail pemeriksaan pasien ${patient.nama}. Portal CKG tidak beralih ke detail-pemeriksaan.`);
      }
    } else {
      broadcast({ type: "AUTOMATION_LOG", message: `[Otomasi Tabel] Tab sudah berada di halaman detail pemeriksaan pasien.` });
      if (!isDedicatedWorkerTab) {
        await chrome.storage.local.set({ ckg_active_patient_detail_url: patientDetailUrl });
      }
    }

    // Tunggu sejenak agar Vue app mount komponen detail
    await new Promise(r => setTimeout(r, 1200));

    // 3. Tangani tombol "Mulai Pemeriksaan" & modal konfirmasi tanggal secara adaptif
    const modalDeadline = Date.now() + 20000;
    while (Date.now() < modalDeadline) {
      if (isTablePatientCancelled) return { ok: false, stopped: true };
      const curTab = await chrome.tabs.get(workerTabId).catch(() => null);
      if (curTab?.url && curTab.url.includes("pendaftaran")) {
        return { ok: false, error: "Tab dialihkan ke pendaftaran" };
      }
      const status = await chrome.scripting.executeScript({
        target: { tabId: workerTabId },
        world: "MAIN",
        func: () => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const triggerClick = el => {
            if (!el) return;
            const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn") || el;
            target.focus?.();
            const opts = { bubbles: true, cancelable: true, view: window };
            target.dispatchEvent(new PointerEvent('pointerdown', opts));
            target.dispatchEvent(new MouseEvent('mousedown', opts));
            target.dispatchEvent(new PointerEvent('pointerup', opts));
            target.dispatchEvent(new MouseEvent('mouseup', opts));
            if (typeof target.click === "function") {
              try { target.click(); } catch(e) {}
            } else {
              try { target.dispatchEvent(new MouseEvent('click', opts)); } catch(e) {}
            }
          };

          // PRIORITAS 1: Cek apakah modal "Konfirmasi Tanggal Pemeriksaan" sedang muncul
          const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
            if (el.children.length > 3) return false;
            const t = clean(el.innerText || el.textContent || "");
            return t === "konfirmasi tanggal pemeriksaan" || t.includes("konfirmasi tanggal pemeriksaan");
          });

          if (heading) {
            const modalBox = heading.closest("div.fixed, div[role='dialog'], .modal, div.z-2000, div.z-50, div.bg-white, div.rounded-xl, div.rounded-lg, div.shadow-xl") || heading.parentElement?.parentElement;
            const searchRoot = modalBox || document;
            
            // Klik cell tanggal hari ini jika datepicker terbuka
            const wantDay = String(new Date().getDate());
            const dayCells = Array.from(searchRoot.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, button")).filter(cell => {
              const txt = clean(cell.innerText || cell.textContent || "");
              return txt === wantDay && !cell.classList.contains("text-gray-300");
            });
            if (dayCells.length > 0) {
              triggerClick(dayCells[0]);
            } else {
              const todayCell = searchRoot.querySelector("td.today, td.current, td.active, .mx-date-row td.today");
              if (todayCell) {
                triggerClick(todayCell);
              }
            }

            const modalBtns = Array.from(searchRoot.querySelectorAll("button, a, [role='button'], div.cursor-pointer, .btn"));
            
            const btnSimpan = modalBtns.find(b => {
              if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
              const t = clean(b.innerText || b.textContent || "");
              if (/kembali|batal|tutup/i.test(t)) return false;
              return t === "simpan" || t === "ya, simpan" || t.includes("simpan") ||
                     (b.classList.contains("btn-fill-primary") && !t.includes("mulai") && !t.includes("selesai") && !t.includes("pemeriksaan"));
            });

            if (btnSimpan) {
              triggerClick(btnSimpan);
              return "modal-simpan-clicked";
            }
            return "modal-detected-waiting-simpan";
          }

          // PRIORITAS 2: Cek tombol "Mulai Pemeriksaan" di halaman jika modal belum muncul
          const btnMulaiPemeriksaan = Array.from(document.querySelectorAll('button')).find(b => {
            const t = clean(b.innerText || b.textContent || '');
            const r = b.getBoundingClientRect();
            return (t === 'mulai pemeriksaan' || t.includes('mulai pemeriksaan')) && !b.disabled && r.width > 0 && r.height > 0;
          });
          if (btnMulaiPemeriksaan) {
            triggerClick(btnMulaiPemeriksaan);
            return "mulai-clicked";
          }

          // PRIORITAS 3: Cek apakah sudah siap (tidak ada modal, baris/tabel formulir sudah terlihat)
          const hasModalNow = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div.fixed, div.z-2000, div.z-50")).some(el => {
            if (el.children.length > 3) return false;
            const txt = clean(el.innerText || el.textContent || "");
            return txt.includes("konfirmasi tanggal pemeriksaan");
          });
          if (hasModalNow) return "modal-still-open";

          const hasRows = !!document.querySelector('.table-pemeriksaan-mandiri, #tableLayanan, [id^="rowfrm"], .grid.grid-cols-5');
          return hasRows ? "ready" : "waiting";
        }
      }).then(([res]) => res?.result).catch(() => null);

      if (status === "ready") {
        broadcast({ type: "AUTOMATION_LOG", message: `[Pemeriksaan] Halaman detail pemeriksaan (${patient.nama}) siap diproses.` });
        break;
      }
      if (status === "modal-simpan-clicked") {
        broadcast({ type: "AUTOMATION_LOG", message: `[Pemeriksaan] ✓ Konfirmasi tanggal pemeriksaan (${patient.nama}) berhasil diklik Simpan.` });
        await new Promise(r => setTimeout(r, 1200));
      } else {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // 4. Pastikan elemen formulir pemeriksaan telah ter-render di DOM
    const domDeadline = Date.now() + 8000;
    while (Date.now() < domDeadline) {
      if (isTablePatientCancelled) return { ok: false, stopped: true };
      const curTab = await chrome.tabs.get(workerTabId).catch(() => null);
      if (curTab?.url && curTab.url.includes("pendaftaran")) {
        return { ok: false, error: "Tab dialihkan ke pendaftaran" };
      }
      const hasForms = await chrome.scripting.executeScript({
        target: { tabId: workerTabId },
        world: "MAIN",
        func: () => !!document.querySelector('.table-pemeriksaan-mandiri tr, #tableLayanan [id^="rowfrm"], .grid.grid-cols-5, button:not([disabled])')
      }).then(([res]) => res?.result).catch(() => false);
      if (hasForms) break;
      await new Promise(r => setTimeout(r, 400));
    }

    // 5. Jalankan otomasi pengisian skrining mandiri & pelayanan nakes
    const { ckg_config: userConfig, ckg_nakes_inputs: nakesInputs, ckg_ranges: customRanges } = await chrome.storage.local.get(["ckg_config", "ckg_nakes_inputs", "ckg_ranges"]);
    const delayMs = Math.round(1000 * (userConfig?.delay ?? 0.8));

    // Ekstraksi data pasien dari header halaman jika tglLahir / jenis kelamin belum lengkap
    let finalTglLahir = patient.tglLahir;
    let finalGender = patient.gender || patient.jenisKelamin;
    let finalNama = patient.nama;

    if (!finalTglLahir || finalTglLahir === "—" || !finalGender) {
      const domPatient = await chrome.scripting.executeScript({
        target: { tabId: workerTabId },
        world: "MAIN",
        func: () => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim();
          const pageTxt = document.body ? document.body.innerText : "";
          const tglM = pageTxt.match(/(?:tanggal lahir|tgl lahir)\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
          const jkM = pageTxt.match(/(?:jenis kelamin|jk)\s*[:\n]?\s*(laki-laki|perempuan|pria|wanita)/i);
          const namaEl = document.querySelector("h1, h2, h3, .font-bold.text-lg, .font-semibold.text-base");
          return {
            tglLahir: tglM ? tglM[1] : null,
            gender: jkM ? jkM[1] : null,
            nama: namaEl ? clean(namaEl.innerText) : null
          };
        }
      }).then(([r]) => r?.result).catch(() => null);

      if (domPatient) {
        if (!finalTglLahir || finalTglLahir === "—") finalTglLahir = domPatient.tglLahir || "";
        if (!finalGender) finalGender = domPatient.gender || "";
        if (!finalNama || finalNama === "—") finalNama = domPatient.nama || "";
      }
    }

    const isMandiriDone = Boolean(
      tabFilter === "SEDANG" ||
      (patient.mandiriStatus && /^(selesai|sudah|terisi|lengkap)/i.test(String(patient.mandiriStatus).trim())) ||
      (patient.pelayananStatus && /sedang pemeriksaan/i.test(String(patient.pelayananStatus).trim())) ||
      patient.status === "Sedang Pemeriksaan"
    );

    const participantData = {
      nama: finalNama,
      nik: patient.nik,
      tanggal_lahir: finalTglLahir,
      jenis_kelamin: finalGender,
      status_pernikahan: "menikah",
      category: isSekolahOrigin ? "SEKOLAH" : "UMUM",
      mandiriStatus: patient.mandiriStatus || (isMandiriDone ? "Selesai" : ""),
      pelayananStatus: patient.pelayananStatus || (isMandiriDone ? "Sedang Pemeriksaan" : ""),
      currentTab: tabFilter,
      mandiriAlreadyDone: isMandiriDone,
      status: patient.status || (isMandiriDone ? "Sedang Pemeriksaan" : ""),
      ...(customValuesOverride || nakesInputs || {})
    };
    const fieldRules = await recordToFieldRules(participantData, customRanges);

    // Uncheck form tidak relevan (dan sinkronkan dengan toggle ON/OFF siklus hidup)
    // PENTING: Jika tabFilter === "SEDANG" atau mandiri sudah selesai, JANGAN uncheck agar formulir yang sedang berjalan / dibutuhkan dokter tidak ter-uncheck tanpa sengaja!
    if (tabFilter !== "SEDANG" && !isMandiriDone) {
      try {
        await runUncheckAll(workerTabId, {}, participantData);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {}
    }

    const skriningRunner = new SkriningAutomation({
      tabId: workerTabId,
      patientDetailUrl,
      statusMenikah: "menikah",
      delay: delayMs,
      testMode: false,
      fieldRules,
      patientProfile: fieldRules?.patientProfile || null,
      patientInfo: participantData,
      mandiriAlreadyDone: isMandiriDone, // Jika Sedang Pemeriksaan atau Mandiri Selesai, lewati skrining mandiri secara instan!
      items: null,
      autoSelesai: false,
      onProgress: (idx, status, title) => {
        broadcast({ type: "AUTOMATION_LOG", message: `[${patient.nama}] Form ${title}: ${status}` });
      },
      onDone: () => {}
    });

    if (isTablePatientCancelled) return { ok: false, stopped: true };
    currentAutomationInstance = skriningRunner;
    activeTableWorkers.set(workerTabId, { runner: skriningRunner, isDedicatedTab: isDedicatedWorkerTab, patient });
    await skriningRunner.run();

    // Verifikasi apakah seluruh pemeriksaan benar-benar sudah selesai sebelum memicu Selesaikan Layanan!
    if (!isTablePatientCancelled) {
      await new Promise(r => setTimeout(r, 500));
      let vCheck = await skriningRunner.verifyAllDone().catch(() => null);
      if (vCheck && vCheck.remaining > 0) {
        broadcast({ type: "AUTOMATION_LOG", message: `[${patient.nama}] Masih ada ${vCheck.remaining} formulir belum terisi, menjalankan pengisian lanjutan...` });
        await skriningRunner.run().catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        vCheck = await skriningRunner.verifyAllDone().catch(() => null);
      }

      const isAllVerifiedDone = vCheck
        ? (vCheck.remaining === 0)
        : (skriningRunner.failedItems.length === 0 && skriningRunner.processedCount > 0);

      // 6. Selesaikan layanan secara otomatis jika diaktifkan
      if (userConfig?.autoSelesaiLayanan !== false) {
        try {
          selesRes = await selesaikanLayanan(workerTabId, {
            report: msg => broadcast({ type: "AUTOMATION_LOG", message: `[SelesaiLayanan - ${patient.nama}] ${msg}` })
          });
        } catch (e) {
          selesRes = { ok: false, reason: e.message };
        }
      }
    }

    // Catat riwayat
    try {
      await recordServiceHistory({
        id: "HIST-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toLocaleString("id-ID"),
        nik: patient.nik || "—",
        nama: patient.nama || "—",
        usia: "—",
        gender: finalGender || "—",
        siklusHidup: "Dewasa",
        statusSkrining: "Selesai",
        statusRaport: (selesRes && selesRes.ok) ? "Selesai Pelayanan" : "Belum Selesai",
        keterangan: "Diproses langsung dari antrean tabel CKG",
        kategori: isSekolahOrigin ? "SEKOLAH" : "UMUM"
      });
    } catch (e) {}

  } finally {
    activeTableWorkers.delete(workerTabId);
    const finishedPatient = patient ? { ...patient, tabFilter } : (currentActiveTablePatient ? { ...currentActiveTablePatient } : null);
    if (currentAutomationInstance?.tabId === workerTabId) {
      currentAutomationInstance = null;
    }
    if (activeTableWorkers.size === 0) {
      currentActiveTablePatient = null;
      broadcast({ type: "TABLE_ACTIVE_PATIENT", patient: null });
    }

    if (!isTablePatientCancelled && selesRes?.ok && finishedPatient) {
      broadcast({
        type: "TABLE_PATIENT_COMPLETED",
        patient: finishedPatient
      });
    }

    // Jika pasien ini diproses di Tab Baru (Multi-Tab Worker), TUTUP tab worker setelah proses tuntas agar tab tidak menumpuk di browser
    if (isDedicatedWorkerTab && closeTabWhenDone) {
      try {
        await new Promise(r => setTimeout(r, 1500));
        await chrome.tabs.remove(workerTabId).catch(() => {});
      } catch (e) {}
    } else if (!isTablePatientCancelled) {
      // Mode single tab (tanpa tab baru): kembali ke halaman antrean baik sukses maupun gagal
      try {
        let curTab = await chrome.tabs.get(workerTabId).catch(() => null);
        if (curTab && curTab.url) {
          const isStillInExam = curTab.url.includes("detail-pemeriksaan") || curTab.url.includes("form.kemkes.go.id") || (curTab.url.includes("skrining") && !curTab.url.includes("ckg-pelayanan"));
          const isNavigatedToPendaftaran = curTab.url.includes("pendaftaran");

          if (isStillInExam && !isNavigatedToPendaftaran) {
            await chrome.tabs.update(workerTabId, { url: originQueueUrl });
            const navEnd = Date.now() + 10000;
            while (Date.now() < navEnd) {
              await new Promise(r => setTimeout(r, 400));
              const t = await chrome.tabs.get(workerTabId).catch(() => null);
              if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
            }
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      } catch (e) {}

      if (!selesRes?.ok) {
        broadcast({
          type: "AUTOMATION_LOG",
          message: `ℹ️ [Pemeriksaan Selesai/Belum Lengkap] Pelayanan ${patient.nama} ${selesRes?.reason ? `(${selesRes.reason})` : ''}. Halaman dikembalikan ke antrean.`
        });
      }
    }

    // Jika berhasil diselesaikan, picu pencarian/refresh lembut di tab antrean asal agar status di tabel web portal segera terbarui
    if (!isTablePatientCancelled && selesRes?.ok && tabId && tabId !== workerTabId) {
      try {
        const originTab = await chrome.tabs.get(tabId).catch(() => null);
        if (originTab?.url && (originTab.url.includes("ckg-pelayanan") || originTab.url.includes("ckg-pelayanan-sekolah"))) {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: () => {
              const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
              const btnCari = Array.from(document.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, .btn")).find(b => {
                const t = clean(b.innerText || b.textContent || "");
                return t.includes("tampilkan pencarian") || t === "cari" || t.includes("filter");
              });
              if (btnCari && !btnCari.disabled) {
                btnCari.click();
              }
            }
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }

  return {
    ok: !!selesRes?.ok,
    submitted: selesRes?.ok ?? false,
    stopped: isTablePatientCancelled,
    error: selesRes?.reason || (selesRes?.ok ? null : "Pelayanan belum selesai disubmit")
  };
}

async function startTableQueueLoop(tabFilter = "BELUM", preferredTabId = null) {
  if (isTableQueueLoopRunning) return { ok: true, alreadyRunning: true };
  isTableQueueLoopRunning = true;
  isTablePatientCancelled = false;
  broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: true });
  broadcast({ type: "AUTOMATION_LOG", message: `🚀 Memulai otomasi antrean live Web CKG (Tab: ${tabFilter})...` });

  (async () => {
    try {
      await unattendedMgr.enable();
      const tab = await getPelayananQueueTab(preferredTabId);
      let activeFilter = tabFilter;
      let consecutiveEmptyCount = 0;
      let processedCount = 0;
      const failedAttemptsMap = new Map();

      // Deteksi & simpan filter tanggal dari web jika belum ada di storage
      const existingSaved = await chrome.storage.local.get(["ckg_saved_pelayanan_date_filter", "ckg_saved_school_name", "ckg_saved_school_class"]);
      if (!existingSaved?.ckg_saved_pelayanan_date_filter) {
        try {
          const [detDate] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: () => {
              const clean = s => (s || "").replace(/\s+/g, " ").trim();
              const datepicker = document.querySelector('.mx-datepicker, [class*="datepicker"]');
              let dateVal = "";
              if (datepicker) {
                const inp = datepicker.querySelector('input.mx-input, input');
                if (inp && inp.value) dateVal = clean(inp.value);
              }
              if (!dateVal) {
                const m = clean(document.body?.innerText || "").match(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/);
                if (m) dateVal = m[0];
              }
              return dateVal;
            }
          });
          if (detDate?.result) {
            await chrome.storage.local.set({ ckg_saved_pelayanan_date_filter: detDate.result });
            broadcast({ type: "AUTOMATION_LOG", message: `[Antrean Live] Mendeteksi dan mengunci filter tanggal antrean: ${detDate.result}` });
          }
        } catch(e) {}
      }

      // Bersihkan input pencarian nama jika sempat terisi teks tanggal yang salah
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => {
          const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i]');
          if (searchInput && (/\d{4}/.test(searchInput.value || '') || (searchInput.value || '').includes('-'))) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(searchInput, '');
            else searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            const clearBtn = searchInput.parentElement?.querySelector('button, svg, [class*="clear"], [class*="close"]');
            if (clearBtn) clearBtn.click();
          }
        }
      }).catch(() => {});

      while (isTableQueueLoopRunning && !isTablePatientCancelled) {
        const stored = await chrome.storage.local.get(["ckg_origin_pelayanan_url", "ckg_saved_pelayanan_date_filter", "ckg_is_sekolah", "ckg_saved_school_name", "ckg_saved_school_class"]);
        const targetQueueUrl = stored?.ckg_origin_pelayanan_url || (stored?.ckg_is_sekolah ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah" : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan");

        // Pastikan tab berada di halaman antrean (bukan detail-pemeriksaan atau form survey)
        // Dan jika user sudah pindah ke pendaftaran, hentikan loop agar tidak konflik!
        try {
          const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
          if (currentTab && currentTab.url) {
            if (currentTab.url.includes("pendaftaran")) {
              broadcast({ type: "AUTOMATION_LOG", message: `[Antrean Live] Terdeteksi tab aktif beralih ke modul Pendaftaran. Otomasi antrean live otomatis dihentikan agar tidak konflik.` });
              break;
            }
            const isAtQueue = (currentTab.url.includes("/ckg-pelayanan") || currentTab.url.includes("/ckg-pelayanan-sekolah")) && !currentTab.url.includes("detail-pemeriksaan") && !currentTab.url.includes("form.kemkes.go.id");
            if (!isAtQueue) {
              await chrome.tabs.update(tab.id, { url: targetQueueUrl });
              const navEnd = Date.now() + 10000;
              while (Date.now() < navEnd) {
                await new Promise(r => setTimeout(r, 400));
                const t = await chrome.tabs.get(tab.id).catch(() => null);
                if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
              }
              await new Promise(r => setTimeout(r, 1200));
            }
          }
        } catch (e) {}

        if (!isTableQueueLoopRunning || isTablePatientCancelled) break;

        // Pastikan filter tanggal atau sekolah tetap diterapkan setelah kembali dari pemeriksaan pasien sebelumnya
        try {
          const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
          const isSekolahQueue = stored?.ckg_is_sekolah || (currentTab?.url && currentTab.url.includes("sekolah"));
          if (isSekolahQueue) {
            await ensureQueuePageSchoolFilter(tab.id, stored?.ckg_saved_school_name, stored?.ckg_saved_school_class, activeFilter);
            await new Promise(r => setTimeout(r, 1500));
          } else if (stored?.ckg_saved_pelayanan_date_filter) {
            broadcast({
              type: "AUTOMATION_LOG",
              message: `[Antrean Live] Menjaga filter tanggal (${stored.ckg_saved_pelayanan_date_filter}) tetap aktif & sinkronisasi tab ${activeFilter}...`
            });
            let dRes = await ensureQueuePageDateFilter(tab.id, stored.ckg_saved_pelayanan_date_filter, activeFilter);
            if (!dRes?.matched) {
              await new Promise(r => setTimeout(r, 1000));
              dRes = await ensureQueuePageDateFilter(tab.id, stored.ckg_saved_pelayanan_date_filter, activeFilter);
            }
            await ensureQueuePageTab(tab.id, activeFilter);
            await new Promise(r => setTimeout(r, 2500));

            // CRITICAL SAFETY GUARD: Jangan pernah mengambil pasien hari ini jika target backdate belum match!
            if (!dRes?.matched) {
              broadcast({
                type: "AUTOMATION_LOG",
                message: `⚠️ [Proteksi] Filter tanggal halaman (${dRes?.finalValue || 'unknown'}) BELUM sesuai filter target (${stored.ckg_saved_pelayanan_date_filter}). Mencoba sinkronisasi ulang...`
              });
              dRes = await ensureQueuePageDateFilter(tab.id, stored.ckg_saved_pelayanan_date_filter, activeFilter);
              await ensureQueuePageTab(tab.id, activeFilter);
              await new Promise(r => setTimeout(r, 2000));

              if (!dRes?.matched) {
                broadcast({
                  type: "AUTOMATION_LOG",
                  message: `🛑 [Stop Proteksi] Tanggal di portal CKG (${dRes?.finalValue}) tidak berhasil disinkronkan ke tanggal target (${stored.ckg_saved_pelayanan_date_filter}). Otomasi dihentikan untuk melindungi data pasien hari ini.`
                });
                break;
              }
            }
          } else {
            await ensureQueuePageTab(tab.id, activeFilter);
            await new Promise(r => setTimeout(r, 1200));
          }
        } catch (e) {}

        // Ambil data antrean live yang BELUM selesai (punya aksi Mulai)
        const patients = await (async () => {
          const [res] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: async (tabType) => {
              const wait = ms => new Promise(r => setTimeout(r, ms));
              let rows = [];
              for (let t = 0; t < 15; t++) {
                rows = Array.from(document.querySelectorAll('tbody tr, .table-individu-terdaftar table tbody tr, table tbody tr')).filter(r => {
                  const txt = (r.innerText || '').trim();
                  return txt.length > 5 && !txt.includes('Tidak ditemukan') && !txt.includes('Belum ada data') && !txt.includes('Nama Peserta') && !txt.includes('Lakukan Pencarian') && !txt.includes('pencarian terlebih dahulu');
                });
                if (rows.length > 0) break;
                await wait(200);
              }

              return rows.map((tr, index) => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const rowTxt = tr.innerText || tr.textContent || '';
                
                // Verifikasi agar tidak tertukar baris antara Sedang vs Belum jika tabel baru render
                const isSedangRow = /sedang\s*(pemeriksaan|diperiksa)/i.test(rowTxt);
                const isBelumRow = /belum\s*(pemeriksaan|diperiksa)/i.test(rowTxt);
                if (tabType === "SEDANG" && isBelumRow && !isSedangRow) return null;
                if (tabType === "BELUM" && isSedangRow && !isBelumRow) return null;

                // Cari nomor tiket berformat CKG (e.g. GGF-9T4, FQ2-QWZ, atau TKT-...)
                const rawTiket = cells[3] ? (cells[3].innerText || cells[3].textContent || '').trim() : '';
                const tiketMatch = rawTiket.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                                  rawTiket.match(/\bTKT-[A-Z0-9-]+\b/i) ||
                                  rowTxt.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                                  rowTxt.match(/\bTKT-[A-Z0-9-]+\b/i);
                let nomorTiket = tiketMatch ? tiketMatch[0].toUpperCase() : (rawTiket && rawTiket !== '-' && rawTiket !== '—' && rawTiket.length >= 4 && !/^(laki|perempuan|belum|sedang|sudah)/i.test(rawTiket) ? rawTiket.toUpperCase() : '—');

                // Ekstraksi NIK & Jenis Kelamin jika tertera di baris tabel
                const nikMatch = rowTxt.match(/\b\d{16}\b/);
                const nik = nikMatch ? nikMatch[0] : '—';
                const jkMatch = rowTxt.match(/\b(laki-laki|perempuan|pria|wanita)\b/i);
                const gender = jkMatch ? jkMatch[0] : '';

                // Ekstraksi nama lengkap peserta yang valid (hindari terambil nomor tiket atau nomor antrean)
                let nama = '—';
                for (const cell of cells) {
                  const cLines = (cell.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
                  for (const line of cLines) {
                    if (/^\d+$/.test(line)) continue;
                    if (/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(line)) continue;
                    if (/^(laki-laki|perempuan|pria|wanita)$/i.test(line)) continue;
                    if (/^(belum|sedang|sudah)\s*(pemeriksaan|diperiksa)/i.test(line)) continue;
                    if (/^08\d{8,13}$/.test(line)) continue;
                    if (nomorTiket !== '—' && line.toUpperCase() === nomorTiket) continue;
                    if (line.length >= 3) {
                      nama = line;
                      break;
                    }
                  }
                  if (nama !== '—') break;
                }
                if (nama === '—') {
                  nama = (cells[1]?.innerText || cells[0]?.innerText || '').split('\n')[0].trim();
                }

                const tglMatch = rowTxt.match(/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/);
                const tglLahir = tglMatch ? tglMatch[0] : '—';
                const targetCells = tr.querySelectorAll('td');
                const cellAction = targetCells[8] || targetCells[targetCells.length - 2] || tr;
                const btnMulai = cellAction.querySelector('button:not([disabled]), a.cursor-pointer, [role="button"]') ||
                                Array.from(tr.querySelectorAll('button, a, [role="button"], div.cursor-pointer')).find(b => {
                                  if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
                                  const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                                  return /^(mulai|mulai pemeriksaan|lanjut|lanjutkan|periksa)$/i.test(t) || t.startsWith('mulai') || t.startsWith('lanjut');
                                }) || tr.querySelector('button:not([disabled])');
                const hasAction = !!btnMulai || (!window.location.href.includes("sekolah") && (nama !== '—' || nomorTiket !== '—'));
                return { index, nama, nik, nomorTiket, tglLahir, gender, status: tabType, hasAction };
              }).filter(p => p && p.hasAction);
            },
            args: [activeFilter]
          });
          return res?.result || [];
        })();

        // Filter pasien yang belum melebihi batas retry (maksimal 2x gagal per sesi loop)
        const eligiblePatients = (patients || []).filter(p => {
          const key = (p.nomorTiket && p.nomorTiket !== "—") ? p.nomorTiket : p.nama;
          return (failedAttemptsMap.get(key) || 0) < 2;
        });

        if (!eligiblePatients || eligiblePatients.length === 0) {
          consecutiveEmptyCount++;
          if (consecutiveEmptyCount >= 2) {
            if (activeFilter === "BELUM") {
              broadcast({ type: "AUTOMATION_LOG", message: `Antrean 'Belum Pemeriksaan' kosong/selesai. Mencoba memeriksa tab 'Sedang Pemeriksaan'...` });
              activeFilter = "SEDANG";
              consecutiveEmptyCount = 0;
              await ensureQueuePageTab(tab.id, "SEDANG");
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }

            broadcast({ type: "AUTOMATION_LOG", message: `✓ Seluruh antrean pasien di web CKG telah selesai dilayani! Total: ${processedCount} pasien.` });
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        consecutiveEmptyCount = 0;
        const currentPatient = eligiblePatients[0];
        const patientKey = (currentPatient.nomorTiket && currentPatient.nomorTiket !== "—") ? currentPatient.nomorTiket : currentPatient.nama;
        processedCount++;
        broadcast({ type: "AUTOMATION_LOG", message: `[Antrean Live #${processedCount}] Memproses: ${currentPatient.nama} (Tiket: ${currentPatient.nomorTiket || '—'})...` });

        try {
          const examRes = await executeSingleTablePatientExam(tab.id, currentPatient, activeFilter);
          if (examRes?.stopped || isTablePatientCancelled) {
            break;
          }
          failedAttemptsMap.delete(patientKey);
        } catch (pErr) {
          const count = (failedAttemptsMap.get(patientKey) || 0) + 1;
          failedAttemptsMap.set(patientKey, count);
          broadcast({ type: "AUTOMATION_LOG", message: `⚠️ Peringatan pasien ${currentPatient.nama} (Percobaan ${count}/2): ${pErr.message}` });
        }

        // Tunggu sebentar agar antrean di portal ter-update
        await new Promise(r => setTimeout(r, 2500));
      }
    } catch (err) {
      broadcast({ type: "AUTOMATION_LOG", message: `❌ Error otomasi antrean live: ${err.message}` });
    } finally {
      await unattendedMgr.disable();
      isTableQueueLoopRunning = false;
      broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: false });
      broadcast({ type: "AUTOMATION_LOG", message: `Otomasi antrean live dihentikan / selesai.` });
    }
  })();

  return { ok: true, started: true };
}

function stopTableQueueLoop() {
  isTableQueueLoopRunning = false;
  isTablePatientCancelled = true;
  currentActiveTablePatient = null;
  broadcast({ type: "TABLE_ACTIVE_PATIENT", patient: null });
  if (currentAutomationInstance?.stop) {
    try { currentAutomationInstance.stop(); } catch(e) {}
  }
  if (currentPelayananRunner?.stop) {
    try { currentPelayananRunner.stop(); } catch(e) {}
  }
  for (const [wTabId, workerInfo] of activeTableWorkers.entries()) {
    try { workerInfo?.runner?.stop?.(); } catch(e) {}
    if (workerInfo?.isDedicatedTab) {
      chrome.tabs.remove(wTabId).catch(() => {});
    }
  }
  activeTableWorkers.clear();
  broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: false });
  broadcast({ type: "AUTOMATION_LOG", message: `⏹ Menghentikan otomasi pelayanan antrean pasien...` });
  return { ok: true, stopped: true };
}

// Long-lived keepalive port listener from SidePanel
let keepAlivePort = null;
chrome.runtime.onConnect.addListener(port => {
  if (port.name === "CKG_KEEPALIVE_PORT") {
    keepAlivePort = port;
    port.onDisconnect.addListener(() => {
      keepAlivePort = null;
    });
  }
});

// Listener Pesan dari UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "RECOVER_WALI_INVALID_PARTICIPANTS": {
        const bId = message.batchId || activeBatchId;
        if (bId) {
          const allItems = await getQueueByBatch(bId);
          for (const item of allItems) {
            if (item.status === "INVALID" && String(item.errorMsg || "").toLowerCase().includes("wali")) {
              await updateParticipantStatus(item.id, { status: "READY", errorMsg: null });
            }
          }
          const stats = await getQueueStats(bId);
          broadcast({ type: "QUEUE_STATS_UPDATE", stats });
        }
        return { ok: true };
      }

      case "START_QUEUE": {
        activeBatchId = message.batchId;
        isQueueRunning = true;
        isQueuePaused = false;
        isProcessingQueue = false;
        if (activeBatchId) {
          await resetInProgressToReady(activeBatchId);
          await resetErrorsToReady(activeBatchId);
          // Auto-recover peserta yang sempat ter-flag INVALID karena wali jika Hardlock Wali kini sudah tersedia!
          try {
            const allItems = await getQueueByBatch(activeBatchId);
            const hlCheck = await chrome.storage.local.get(["ckg_hardlock_wali", "ckg_config"]);
            const hlWaliObj = hlCheck?.ckg_hardlock_wali || {};
            const cleanHlNik = String(hlWaliObj.nikWali || hlWaliObj.nik || hlCheck?.ckg_config?.defaultNikWali || "").replace(/\D/g, "");
            const cleanHlNama = String(hlWaliObj.namaWali || hlWaliObj.nama || hlCheck?.ckg_config?.defaultNamaWali || "").trim();
            for (const item of allItems) {
              if (item.status === "INVALID" && String(item.errorMsg || "").toLowerCase().includes("wali") && (cleanHlNik.length === 16 || cleanHlNama.length >= 2)) {
                await updateParticipantStatus(item.id, { status: "READY", errorMsg: null });
              }
            }
          } catch(e) {}
          const stats = await getQueueStats(activeBatchId);
          broadcast({ type: "QUEUE_STATS_UPDATE", stats });
        }
        await unattendedMgr.enable();
        await setCheckpoint("ACTIVE_BATCH_ID", activeBatchId);
        await setCheckpoint("CURRENT_BATCH_RUNNING", true);
        processNextQueueItem();
        return { ok: true };
      }

      case "PAUSE_QUEUE": {
        isQueuePaused = true;
        if (currentAutomationInstance && currentAutomationInstance.pause) {
          currentAutomationInstance.pause();
        }
        return { ok: true };
      }

      case "RESUME_QUEUE": {
        isQueuePaused = false;
        if (currentAutomationInstance && currentAutomationInstance.resume) {
          currentAutomationInstance.resume();
        }
        processNextQueueItem();
        return { ok: true };
      }

      case "STOP_QUEUE": {
        isQueueRunning = false;
        isQueuePaused = false;
        if (currentAutomationInstance && currentAutomationInstance.stop) {
          currentAutomationInstance.stop();
        }
        if (activeBatchId) {
          await resetInProgressToReady(activeBatchId);
          const stats = await getQueueStats(activeBatchId);
          broadcast({ type: "QUEUE_STATS_UPDATE", stats });
        }
        await unattendedMgr.disable();
        await setCheckpoint("CURRENT_BATCH_RUNNING", false);
        return { ok: true };
      }

      case "RUN_SINGLE_PARTICIPANT": {
        const tab = await getOrCreateCkgTab();
        (async () => {
          try {
            await processParticipantPipeline(message.participant, tab.id);
          } catch (e) {
            broadcast({ type: "AUTOMATION_LOG", message: `❌ Error proses peserta ${message.participant?.nik}: ${e.message}` });
          }
        })();
        return { ok: true, started: true };
      }

      case "RETRY_ERROR_PARTICIPANTS": {
        const batchId = message.batchId || activeBatchId || await getCheckpoint("ACTIVE_BATCH_ID");
        if (!batchId) return { ok: false, error: "Tidak ada antrean aktif" };
        if (currentAutomationInstance) {
          try { currentAutomationInstance.stop(); } catch (e) {}
        }
        isProcessingQueue = false;
        const resetCount = await resetErrorsToReady(batchId);
        const stats = await getQueueStats(batchId);
        broadcast({ type: "QUEUE_STATS_UPDATE", stats });
        broadcast({ type: "AUTOMATION_LOG", message: `Memulai ulang ${resetCount} peserta berstatus error...` });
        activeBatchId = batchId;
        isQueueRunning = true;
        isQueuePaused = false;
        await unattendedMgr.enable();
        await setCheckpoint("ACTIVE_BATCH_ID", activeBatchId);
        await setCheckpoint("CURRENT_BATCH_RUNNING", true);
        processNextQueueItem();
        return { ok: true, resetCount, stats };
      }

      case "GET_QUEUE_STATE": {
        const lastBatchId = activeBatchId || await getCheckpoint("ACTIVE_BATCH_ID");
        const stats = lastBatchId ? await getQueueStats(lastBatchId) : null;
        return {
          isRunning: isQueueRunning,
          isPaused: isQueuePaused,
          batchId: lastBatchId,
          stats
        };
      }

      case "FETCH_PELAYANAN_DATA": {
        const tab = await getDetailPemeriksaanTab();
        if (!tab || !tab.id) {
          return { ok: false, error: "Tab Sehat Indonesiaku (CKG) tidak ditemukan. Silakan buka halaman pemeriksaan pasien di browser." };
        }
        currentTabId = tab.id;
        const skriningRunner = new SkriningAutomation({
          tabId: tab.id,
          onProgress: () => {},
          onDone: () => {}
        });
        await skriningRunner.ensureAllAccordionsExpanded().catch(() => {});
        await new Promise(r => setTimeout(r, 400));
        const items = await skriningRunner.getItems().catch((e) => {
          console.error("[FETCH_PELAYANAN_DATA] getItems error:", e);
          return [];
        });
        console.log(`[FETCH_PELAYANAN_DATA] Tab ${tab.id} -> ${items.length} items ditemukan:`, items.map(x => x.title));

        // Ambil info pasien dari DOM CKG Pelayanan
        let infoRes = {};
        try {
          const [scriptRes] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: () => {
              const getVal = (labels) => {
                const labelList = Array.isArray(labels) ? labels : [labels];
                const allEls = Array.from(document.querySelectorAll('div, span, td, p, label, dt, th, b, strong'));
                for (const el of allEls) {
                  if (el.children.length > 2) continue;
                  const txt = (el.innerText || el.textContent || '').trim().replace(/:$/, '').trim();
                  if (labelList.some(l => l.toLowerCase() === txt.toLowerCase())) {
                    const next = el.nextElementSibling;
                    if (next) {
                      const val = (next.innerText || next.textContent || '').trim();
                      if (val && !labelList.some(l => l.toLowerCase() === val.toLowerCase())) return val;
                    }
                    const parent = el.parentElement;
                    if (parent) {
                      const children = Array.from(parent.children);
                      const idx = children.indexOf(el);
                      if (idx >= 0 && idx + 1 < children.length) {
                        const val = (children[idx + 1].innerText || children[idx + 1].textContent || '').trim();
                        if (val && !labelList.some(l => l.toLowerCase() === val.toLowerCase())) return val;
                      }
                    }
                  }
                }
                return null;
              };

              let nikVal = getVal(["NIK", "No. KTP", "Nomor Induk Kependudukan"]);
              if (!nikVal) {
                const nikMatch = (document.body?.innerText || "").match(/\b\d{16}\b/);
                if (nikMatch) nikVal = nikMatch[0];
              }

              let tglLahirVal = getVal(["Tanggal Lahir", "Tgl Lahir", "Tgl. Lahir"]);
              if (!tglLahirVal) {
                const tglMatch = (document.body?.innerText || "").match(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agt|Sep|Okt|Nov|Des)[a-z]*\s+\d{4}\b/i);
                if (tglMatch) tglLahirVal = tglMatch[0];
              }

              let jkVal = getVal(["Jenis Kelamin", "JK", "Gender"]);
              if (!jkVal) {
                if (/\bperempuan\b/i.test(document.body?.innerText || "")) jkVal = "Perempuan";
                else if (/\blaki-laki\b/i.test(document.body?.innerText || "")) jkVal = "Laki-laki";
              }

              let tiketVal = getVal(["Nomor Tiket", "No. Tiket", "No Tiket", "Tiket"]);
              if (!tiketVal) {
                const tMatch = (document.body?.innerText || "").match(/No\.?\s*Tiket\s*:\s*([A-Za-z0-9-]+)/i);
                if (tMatch) tiketVal = tMatch[1].trim();
              }

              // Validasi nama orang (mencegah teks usia seperti "30 Tahun 8 Bulan 12 Hari" atau judul/tombol sistem)
              const isValidPersonName = (str) => {
                if (!str || typeof str !== 'string') return false;
                const clean = str.replace(/\s+/g, ' ').trim();
                if (clean.length < 2 || clean.length > 60) return false;
                // Nama tidak boleh mengandung angka (seperti usia "30 Tahun", "12 Hari", dsb.)
                if (/\d/.test(clean)) return false;
                // Tolak satuan waktu / umur
                if (/\b(tahun|thn|bulan|bln|hari|hr|minggu|usia|umur)\b/i.test(clean)) return false;
                // Tolak kata kunci sistem, tombol header, atau status UI
                const invalidWords = [
                  "cek kesehatan gratis", "satusehat", "kemenkes", "kementerian", "pelayanan",
                  "pemeriksaan", "mandiri", "nakes", "skrining", "dashboard", "antrean", "antrian",
                  "sedang", "belum", "selesai", "laki-laki", "perempuan", "pria", "wanita",
                  "nik", "tiket", "tanggal lahir", "tgl lahir", "jenis kelamin", "status", "raport",
                  "tatalaksana", "mulai tatalaksana", "detail data", "selesaikan layanan",
                  "tanggal pemeriksaan", "panduan pemeriksaan", "kirim rapor", "lihat rapor",
                  "jumlah pemeriksaan", "pemeriksaan mandiri", "pelayanan oleh nakes", "dewasa",
                  "informasi bpjs", "puskesmas", "sedang pemeriksaan", "tidak diperiksa",
                  "selesai diperiksa", "dalam pemeriksaan", "umur saat pemeriksaan"
                ];
                if (invalidWords.some(w => clean.toLowerCase().includes(w))) return false;
                // Harus memuat alfabet minimal 2 huruf
                return /[a-zA-Z]{2,}/.test(clean);
              };

              let nameVal = null;

              // 1. Ambil nama dari elemen di sebelah ikon gender pada kartu pasien (PALING SPESIFIK & AKURAT)
              const genderIcons = Array.from(document.querySelectorAll('img')).filter(img => {
                const src = img.getAttribute('src') || img.src || '';
                return src.includes('icon-gender') || src.includes('gender');
              });
              for (const gIcon of genderIcons) {
                const parent = gIcon.parentElement;
                if (parent) {
                  const targetEl = parent.querySelector('.text-\\[18px\\], div[class*="text-[18px]"], .font-bold, div, span') || gIcon.nextElementSibling;
                  const candidate = (targetEl?.innerText || targetEl?.textContent || '').trim();
                  if (isValidPersonName(candidate)) {
                    nameVal = candidate;
                    break;
                  }
                }
              }

              // 2. Cek label eksplisit jika ada
              if (!nameVal) {
                const labeledName = getVal(["Nama", "Nama Pasien", "Nama Lengkap"]);
                if (isValidPersonName(labeledName)) {
                  nameVal = labeledName;
                }
              }

              // 3. Cari di dalam kartu data pasien berdasarkan NIK
              if (!nameVal && nikVal) {
                const allLeafEls = Array.from(document.querySelectorAll('div, span, p, td, b, strong, h1, h2, h3, h4')).filter(e => e.children.length === 0);
                const nikLeaf = allLeafEls.find(el => (el.innerText || el.textContent || '').includes(nikVal));
                const card = nikLeaf ? nikLeaf.closest('div.border-1, div.border, div.rounded-xl, div.rounded-lg, div.shadow, div.bg-white, div[class*="p-6"], div[class*="p-4"]') : null;
                if (card) {
                  const candidateEls = Array.from(card.querySelectorAll('div[class*="text-[18px]"], .text-\\[18px\\], div.font-bold, span.font-bold'));
                  for (const cand of candidateEls) {
                    const cText = (cand.innerText || cand.textContent || '').trim();
                    if (isValidPersonName(cText)) {
                      nameVal = cText;
                      break;
                    }
                  }
                }
              }

              const isSekolah = window.location.href.includes("sekolah");
              let category = isSekolah ? "SEKOLAH" : null;
              if (!category) {
                category = Array.from(document.querySelectorAll("span, div")).find(e => {
                  const cls = typeof e.className === "string" ? e.className : '';
                  return (cls.includes("border-rd-full") || cls.includes("rounded-full") || cls.includes("badge"))
                    && e.innerText && e.innerText.trim().length < 30;
                })?.innerText?.trim() || "UMUM";
              }

              // Deteksi status skrining mandiri langsung dari DOM
              let mandiriDone = false;
              const cleanTxt = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
              const mandiriHeader = Array.from(document.querySelectorAll("button, [role='button'], div, span, p")).find(el => {
                if (el.closest("#tableLayanan")) return false;
                const t = cleanTxt(el.innerText || el.textContent || '');
                return t.includes("pemeriksaan mandiri") || t.includes("skrining mandiri") || t.includes("jumlah pemeriksaan");
              });
              if (mandiriHeader) {
                const mTxt = cleanTxt(mandiriHeader.innerText || mandiriHeader.textContent || '');
                const mMatch = mTxt.match(/(\d+)\s*\/\s*(\d+)/);
                if (mMatch && parseInt(mMatch[1], 10) > 0 && parseInt(mMatch[1], 10) === parseInt(mMatch[2], 10)) {
                  mandiriDone = true;
                } else if (/(sudah selesai|semua selesai|selesai diperiksa|sudah dilakukan)/i.test(mTxt)) {
                  mandiriDone = true;
                }
              }
              const mandiriTbl = document.querySelector(".table-pemeriksaan-mandiri, table");
              if (mandiriTbl && !mandiriDone) {
                const rows = Array.from(mandiriTbl.querySelectorAll("tbody tr, tr"));
                if (rows.length > 0) {
                  const hasInput = rows.some(r => {
                    const btns = Array.from(r.querySelectorAll("button, a")).map(b => cleanTxt(b.innerText || ''));
                    return btns.some(b => b.includes("input") && !b.includes("lihat"));
                  });
                  if (!hasInput) mandiriDone = true;
                }
              }

              return {
                name: nameVal,
                category,
                nik: nikVal,
                tanggalLahir: tglLahirVal,
                jenisKelamin: jkVal,
                nomorTiket: tiketVal,
                mandiriDone,
                mandiriStatus: mandiriDone ? "Selesai" : "Belum"
              };
            }
          });
          infoRes = scriptRes || {};
        } catch (scrapeErr) {
          console.warn("Error scraping patient info:", scrapeErr);
          infoRes = { result: {} };
        }

        const patientData = infoRes?.result || {};
        if (!patientData.name && (patientData.nik || patientData.nomorTiket)) {
          try {
            const { ckg_registered_patients = [] } = await chrome.storage.local.get("ckg_registered_patients");
            const foundReg = ckg_registered_patients.find(p => 
              (patientData.nik && p.nik === patientData.nik) ||
              (patientData.nomorTiket && (p.ticketNumber === patientData.nomorTiket || p.tiket === patientData.nomorTiket))
            );
            if (foundReg?.nama) {
              patientData.name = foundReg.nama;
            }
          } catch (e) {}
        }

        return {
          ok: true,
          patientInfo: patientData,
          items: items || [],
          message: items?.length ? `Berhasil memuat ${items.length} item formulir` : "Tidak ada item formulir ditemukan. Pastikan Anda membuka halaman detail pemeriksaan pasien."
        };
      }

      case "RUN_PELAYANAN_ACTIVE_AUTO": {
        const tab = await getDetailPemeriksaanTab();
        if (!tab || !tab.id) {
          return { ok: false, error: "Tab pemeriksaan CKG tidak ditemukan. Pastikan Anda membuka halaman CKG di browser." };
        }
        const { patientInfo, items: pelItems, customFieldRules, customValues, manualOverrides } = message;

        const { ckg_config: userConfig } = await chrome.storage.local.get("ckg_config");
        const delayMs = Math.round(1000 * (userConfig?.delay ?? 0.8));

        let fieldRules = customFieldRules;
        if (!fieldRules || !fieldRules.length) {
          try {
            const cfg = await getFieldConfig();
            if (customValues && Object.keys(customValues).length > 0) {
              const mapVals = new Map(Object.entries(customValues));
              fieldRules = buildFieldRules(mapVals, patientInfo || {}, cfg);
              fieldRules.patientProfile = {
                bb: parseFloat(customValues["berat-badan"]) || 60,
                tb: parseFloat(customValues["tinggi-badan"]) || 160,
                lp: parseFloat(customValues["lingkar-perut"]) || 75,
                sistol: parseFloat(customValues["tekanan-darah-sistolik"]) || 120,
                diastol: parseFloat(customValues["tekanan-darah-diastolik"]) || 80,
                gds: parseFloat(customValues["gula-darah"]) || 100,
                gender: patientInfo?.jenisKelamin || "perempuan",
                statusNikah: customValues["status-menikah"] || "menikah",
                isSmoker: customValues["merokok"] === "ya"
              };
            } else {
              fieldRules = await recordToFieldRules({
                tanggal_lahir: patientInfo?.tanggalLahir,
                jenis_kelamin: patientInfo?.jenisKelamin,
                status_pernikahan: "menikah"
              });
            }
          } catch (frErr) {
            console.warn("Error building fieldRules:", frErr);
            fieldRules = [];
          }
        }

        // Jalankan otomasi di background tanpa blocking respons
        (async () => {
          try {
            // Cek apakah skrining mandiri sudah selesai di halaman aktif
            const isMandiriDoneInDom = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: "MAIN",
              func: () => {
                const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
                const headers = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, span, div, p, button")).filter(el => {
                  const t = clean(el.innerText || el.textContent || "");
                  return t.includes("pemeriksaan mandiri") || t.includes("skrining mandiri") || t.includes("jumlah pemeriksaan");
                });
                for (const h of headers) {
                  const t = clean(h.innerText || h.textContent || "");
                  const m = t.match(/(\d+)\s*\/\s*(\d+)/);
                  if (m && parseInt(m[1], 10) > 0 && parseInt(m[1], 10) === parseInt(m[2], 10)) return true;
                  if (/(sudah selesai|semua selesai|selesai diperiksa|sudah dilakukan)/i.test(t)) return true;
                }
                const mandiriRows = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tbody tr, .table-pemeriksaan-mandiri tr"));
                if (mandiriRows.length > 0) {
                  const hasPending = mandiriRows.some(r => {
                    const btns = Array.from(r.querySelectorAll("button, a")).map(b => clean(b.innerText || ""));
                    return btns.some(bt => bt.includes("input") && !bt.includes("lihat"));
                  });
                  if (!hasPending) return true;
                }
                return false;
              }
            }).then(([r]) => r?.result).catch(() => false);

            const isMandiriDoneActive = Boolean(
              isMandiriDoneInDom ||
              patientInfo?.mandiriDone ||
              (patientInfo?.mandiriStatus && /^(selesai|sudah|terisi|lengkap)/i.test(String(patientInfo.mandiriStatus).trim())) ||
              (patientInfo?.pelayananStatus && /sedang pemeriksaan/i.test(String(patientInfo.pelayananStatus).trim()))
            );

            // 1. Jalankan uncheck HANYA jika mandiri belum selesai / bukan sedang pemeriksaan
            if (!isMandiriDoneActive) {
              broadcast({ type: "AUTOMATION_LOG", message: "[Pelayanan] Menjalankan uncheck form yang tidak relevan..." });
              const uncheckFieldValues = {};
              if (customValues) {
                if (customValues["merokok"]) uncheckFieldValues["merokok"] = customValues["merokok"];
                if (customValues["pernah-merokok"]) uncheckFieldValues["pernah-merokok"] = customValues["pernah-merokok"];
              }
              try {
                const uncheckPromise = runUncheckAll(tab.id, uncheckFieldValues, patientInfo);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout uncheck 3.5 detik")), 3500));
                const uncheckRes = await Promise.race([uncheckPromise, timeoutPromise]);
                broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan] Uncheck selesai: ${uncheckRes.processed}/${uncheckRes.total} form di-skip.` });
                if (uncheckRes?.skippedKeywords?.length) {
                  for (const kw of uncheckRes.skippedKeywords) {
                    broadcast({ type: "PELAYANAN_TAB_PROGRESS", status: "skipped", title: kw });
                  }
                }
              } catch (uncheckErr) {
                broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan] Peringatan uncheck: ${uncheckErr.message}` });
              }
              await new Promise(r => setTimeout(r, 1200));
            }

            const detailUrl = (tab.url && tab.url.includes("detail-pemeriksaan")) ? tab.url : null;
            if (detailUrl) {
              await chrome.storage.local.set({ ckg_active_patient_detail_url: detailUrl });
            }

            const runner = new SkriningAutomation({
              tabId: tab.id,
              patientDetailUrl: detailUrl,
              statusMenikah: customValues?.["status-menikah"] || "menikah",
              delay: delayMs,
              testMode: userConfig?.testMode || false,
              fieldRules: fieldRules || [],
              patientProfile: fieldRules?.patientProfile || null,
              patientInfo: {
                ...(patientInfo || {}),
                mandiriAlreadyDone: isMandiriDoneActive,
                mandiriStatus: isMandiriDoneActive ? "Selesai" : (patientInfo?.mandiriStatus || "")
              },
              mandiriAlreadyDone: isMandiriDoneActive,
              items: (pelItems && pelItems.length > 0) ? pelItems : null,
              manualOverrides: manualOverrides || {},
              onProgress: (idx, status, title) => {
                broadcast({ type: "PELAYANAN_TAB_PROGRESS", idx, status, title });
                broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan] Form ${title}: ${status}` });
              },
              onDone: () => {
                broadcast({ type: "AUTOMATION_LOG", message: "[Pelayanan] Semua form selesai diproses." });
              }
            });

            currentAutomationInstance = runner;
            currentPelayananRunner = runner;
            await runner.run();

            // Verifikasi dan Selesaikan Layanan HANYA jika seluruh pemeriksaan telah tuntas terisi
            await new Promise(r => setTimeout(r, 600));
            const vRes = await runner.verifyAllDone().catch(() => null);
            let selesRes = null;
            const isVResDone = vRes ? (vRes.allDone || vRes.remainingCount === 0 || vRes.remaining === 0) : (runner.failedItems.length === 0);
            if (!isVResDone) {
              broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan] Masih ada ${vRes?.remainingCount ?? '?'} formulir yang belum diisi. Pelayanan TIDAK diselesaikan agar data tidak terkunci prematur.` });
            } else if (userConfig?.autoSelesaiLayanan !== false) {
              try {
                selesRes = await selesaikanLayanan(tab.id, {
                  report: msg => broadcast({ type: "AUTOMATION_LOG", message: `[SelesaiLayanan] ${msg}` })
                });
              } catch (e) {
                selesRes = { ok: false, reason: e.message };
                broadcast({ type: "AUTOMATION_LOG", message: `[SelesaiLayanan] Error: ${e.message}` });
              }
            }

            // Pulihkan filter sekolah / tanggal tersimpan di halaman antrean
            try {
              const stored = await chrome.storage.local.get(["ckg_saved_pelayanan_date_filter", "ckg_is_sekolah", "ckg_saved_school_name", "ckg_saved_school_class"]);
              if (stored?.ckg_is_sekolah && stored?.ckg_saved_school_name) {
                broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan Selesai] Memulihkan filter sekolah: ${stored.ckg_saved_school_name} (${stored.ckg_saved_school_class})...` });
                await ensureQueuePageSchoolFilter(tab.id, stored.ckg_saved_school_name, stored.ckg_saved_school_class);
                await new Promise(r => setTimeout(r, 1500));
              } else if (stored?.ckg_saved_pelayanan_date_filter) {
                broadcast({ type: "AUTOMATION_LOG", message: `[Pelayanan Selesai] Jeda & memulihkan filter tanggal antrean: ${stored.ckg_saved_pelayanan_date_filter}...` });
                await ensureQueuePageDateFilter(tab.id, stored.ckg_saved_pelayanan_date_filter);
                await new Promise(r => setTimeout(r, 2500));
              }
            } catch (e) {}

            // Catat ke Tab Ekspor Laporan
            try {
              const ageObj = calculateAge(patientInfo?.tanggalLahir || patientInfo?.tanggal_lahir);
              const lifecycle = getLifeCycleCategory(ageObj.years);
              let keterangan = "Selesai Lengkap (Daftar, Hadir, Pelayanan)";
              if (runner.failedItems.length > 0) {
                keterangan = `${runner.failedItems.length} form gagal diproses`;
              } else if (!selesRes || !selesRes.ok) {
                keterangan = selesRes?.reason ? `Belum Selesai Pemeriksaan (${selesRes.reason})` : "Belum Selesai Pemeriksaan (Belum Konfirmasi Akhir)";
              }

              await recordServiceHistory({
                id: "HIST-" + Date.now(),
                timestamp: new Date().toLocaleString("id-ID"),
                nik: patientInfo?.nik || "—",
                nama: patientInfo?.name || "—",
                usia: ageObj.text,
                gender: patientInfo?.jenisKelamin || "—",
                siklusHidup: lifecycle,
                statusSkrining: `Selesai (${(pelItems || []).length} Formulir)`,
                statusRaport: (selesRes && selesRes.ok) ? "Selesai Pelayanan" : "Belum Selesai",
                keterangan,
                kategori: patientInfo?.category || "UMUM"
              });
            } catch (histErr) {
              console.warn("Gagal catat riwayat layanan:", histErr);
            }

            broadcast({ type: "AUTOMATION_LOG", message: "✓ Otomasi pelayanan selesai." });
            broadcast({ type: "SERVICE_COMPLETED", nik: patientInfo?.nik, nama: patientInfo?.name });
          } catch (runErr) {
            broadcast({ type: "AUTOMATION_LOG", message: `❌ Error otomasi pelayanan: ${runErr.message}` });
          }
        })();

        return { ok: true };
      }

      case "GET_REGISTERED_PATIENTS": {
        const patients = await getAllRegisteredPatients();
        return { ok: true, patients };
      }

      case "DELETE_COMPLETED_REGISTERED_PATIENTS": {
        const count = await deleteCompletedRegisteredPatients(message.ids);
        return { ok: true, count };
      }

      case "CLEAR_ALL_REGISTERED_PATIENTS": {
        const count = await clearAllRegisteredPatients(message.ids);
        return { ok: true, count };
      }

      case "PAUSE_PELAYANAN_AUTO": {
        if (currentPelayananRunner?.pause) currentPelayananRunner.pause();
        return { ok: true };
      }

      case "RESUME_PELAYANAN_AUTO": {
        if (currentPelayananRunner?.resume) currentPelayananRunner.resume();
        return { ok: true };
      }

      case "STOP_PELAYANAN_AUTO": {
        isTableQueueLoopRunning = false;
        isTablePatientCancelled = true;
        currentActiveTablePatient = null;
        broadcast({ type: "TABLE_ACTIVE_PATIENT", patient: null });
        if (currentPelayananRunner?.stop) {
          try { currentPelayananRunner.stop(); } catch(e) {}
        }
        if (currentAutomationInstance?.stop) {
          try { currentAutomationInstance.stop(); } catch(e) {}
        }
        currentPelayananRunner = null;
        currentAutomationInstance = null;
        broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: false });
        return { ok: true };
      }

      case "RUN_SINGLE_PELAYANAN_FORM": {
        const { title, overrideVal } = message;
        try {
          const tab = await getOrCreateCkgTab("https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan");
          const { ckg_config: userCfg } = await chrome.storage.local.get("ckg_config");
          const delayMs = Math.round(1000 * (userCfg?.delay ?? 0.8));

          const singleRunner = new SkriningAutomation({
            tabId: tab.id,
            delayMs,
            onProgress: (msg) => broadcast({ type: "AUTOMATION_LOG", message: `[Form Tunggal] ${msg}` }),
            onDone: () => {}
          });

          const result = await singleRunner.runSingleItem(title, overrideVal);
          return { ok: true, result };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }

      case "RUN_PELAYANAN_PATIENT": {
        isTablePatientCancelled = false;
        isBatchPelayananCancelled = false;
        const { patientId, customValues } = message;
        const patient = await getPatientById(patientId);
        if (!patient) return { ok: false, error: "Pasien tidak ditemukan di database" };

        let isSekolah = patient.category === "SEKOLAH" || (patient.kategori || '').toUpperCase() === 'SEKOLAH' || !!patient.sekolah || !!patient.namaSekolah;
        if (!isSekolah) {
          const stored = await chrome.storage.local.get(["ckg_is_sekolah", "ckg_saved_school_name"]);
          if (stored?.ckg_is_sekolah || stored?.ckg_saved_school_name) isSekolah = true;
        }
        const targetUrl = isSekolah
          ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
          : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

        const tab = await getOrCreateCkgTab(targetUrl);
        (async () => {
          try {
            broadcast({
              type: "BATCH_PELAYANAN_STATE",
              running: true,
              total: 1,
              current: 1,
              patient
            });
            const isMandiriDonePatient = Boolean(
              (patient.mandiriStatus && /^(selesai|sudah|terisi|lengkap)/i.test(String(patient.mandiriStatus).trim())) ||
              (patient.pelayananStatus && /sedang pemeriksaan/i.test(String(patient.pelayananStatus).trim())) ||
              patient.status === "Sedang Pemeriksaan" ||
              patient.stage === "IN_PROGRESS"
            );
            const targetFilter = isMandiriDonePatient ? "SEDANG" : (patient.currentTab || "BELUM");
            const patientToExec = {
              id: patient.id,
              nama: patient.nama,
              nomorTiket: patient.ticketNumber || patient.nomorTiket || patient.ticket || "—",
              nik: patient.nik || "—",
              tglLahir: patient.tglLahir || patient.tanggalLahir || patient.tanggal_lahir || "—",
              gender: patient.gender || patient.jenisKelamin || patient.jenis_kelamin || "",
              index: 0,
              category: patient.category || (patient.sekolah ? "SEKOLAH" : "UMUM"),
              sekolah: patient.sekolah || patient.namaSekolah || "",
              kelas: patient.kelas || patient.tingkatKelas || "",
              mandiriStatus: patient.mandiriStatus || (isMandiriDonePatient ? "Selesai" : "—"),
              pelayananStatus: patient.pelayananStatus || (isMandiriDonePatient ? "Sedang Pemeriksaan" : "—"),
              currentTab: targetFilter
            };

            const examRes = await executeSingleTablePatientExam(
              tab.id,
              patientToExec,
              targetFilter,
              customValues || null,
              { openInNewTab: false, closeTabWhenDone: false }
            ).catch(e => ({ ok: false, error: e.message }));

            if (examRes?.ok && examRes?.submitted) {
              await updateParticipantStatus(patient.id, {
                status: "COMPLETED",
                stage: "COMPLETED",
                completedAt: new Date().toISOString()
              }).catch(() => {});
              broadcast({
                type: "PARTICIPANT_PROGRESS",
                id: patient.id,
                nik: patient.nik,
                nama: patient.nama,
                stage: "COMPLETED",
                status: "COMPLETED",
                message: `✓ Pasien ${patient.nama} selesai pelayanan.`
              });
              broadcast({
                type: "SERVICE_COMPLETED",
                participantId: patient.id,
                nik: patient.nik,
                nama: patient.nama
              });
            } else if (!examRes?.stopped) {
              await updateParticipantStatus(patient.id, {
                status: "ERROR",
                errorMsg: examRes?.error || "Gagal pelayanan"
              }).catch(() => {});
              broadcast({
                type: "PARTICIPANT_PROGRESS",
                id: patient.id,
                nik: patient.nik,
                nama: patient.nama,
                stage: "START_EXAM",
                status: "ERROR",
                message: `❌ ${patient.nama}: ${examRes?.error || 'Gagal pelayanan'}`
              });
            }
          } catch (e) {
            broadcast({ type: "AUTOMATION_LOG", message: `❌ Error pelayanan pasien ${patient.nik}: ${e.message}` });
          } finally {
            broadcast({ type: "BATCH_PELAYANAN_STATE", running: false, patient: null });
          }
        })();
        return { ok: true, started: true };
      }

      case "CKG_USER_ME": {
        const userData = message.data || {};
        const puskesmasName = userData.health_facility?.name || userData.faskes?.name || userData.organization?.name || userData.unit?.name || userData.puskesmas || "Puskesmas";
        const operatorName = userData.name || userData.username || "";
        const profile = {
          raw: userData,
          puskesmas: puskesmasName,
          operator: operatorName,
          updatedAt: Date.now()
        };
        await chrome.storage.local.set({ ckg_user_me: profile });
        broadcast({ type: "USER_ME_UPDATED", profile });
        return { ok: true, profile };
      }

      case "RUN_PELAYANAN_ALL_PATIENTS": {
        const patients = await getAllRegisteredPatients();
        // Pasien yang belum selesai skrining/layanan penuh
        const pending = patients.filter(p => p.stage !== "COMPLETED" && p.status !== "COMPLETED");
        if (!pending.length) return { ok: false, error: "Semua pasien terdaftar sudah selesai pelayanan (COMPLETED)" };

        isBatchPelayananRunning = true;
        isBatchPelayananCancelled = false;
        isTablePatientCancelled = false;

        broadcast({
          type: "BATCH_PELAYANAN_STATE",
          running: true,
          total: pending.length,
          current: 0
        });

        (async () => {
          try {
            await unattendedMgr.enable();
            let firstIsSekolah = pending[0].category === "SEKOLAH" || (pending[0].kategori || '').toUpperCase() === 'SEKOLAH' || !!pending[0].sekolah || !!pending[0].namaSekolah;
            if (!firstIsSekolah) {
              const stored = await chrome.storage.local.get(["ckg_is_sekolah", "ckg_saved_school_name"]);
              if (stored?.ckg_is_sekolah || stored?.ckg_saved_school_name) firstIsSekolah = true;
            }
            const initialUrl = firstIsSekolah
              ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
              : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

            let tab = await getOrCreateCkgTab(initialUrl);

            for (let i = 0; i < pending.length; i++) {
              if (isBatchPelayananCancelled) {
                broadcast({ type: "AUTOMATION_LOG", message: "⏹ Otomasi batch pasien terdaftar dihentikan pengguna." });
                break;
              }

              // Pastikan tab masih hidup dan aktif
              const curT = tab?.id ? await chrome.tabs.get(tab.id).catch(() => null) : null;
              if (!curT) {
                tab = await getOrCreateCkgTab(initialUrl);
              }

              const p = pending[i];
              broadcast({
                type: "BATCH_PELAYANAN_STATE",
                running: true,
                total: pending.length,
                current: i + 1,
                patient: p
              });

              broadcast({
                type: "AUTOMATION_LOG",
                message: `[Batch Pasien ${i + 1}/${pending.length}] Memulai proses: ${p.nama} (${p.nik || p.ticketNumber || 'Tanpa NIK'})`
              });

              const isMandiriDoneP = Boolean(
                (p.mandiriStatus && /^(selesai|sudah|terisi|lengkap)/i.test(String(p.mandiriStatus).trim())) ||
                (p.pelayananStatus && /sedang pemeriksaan/i.test(String(p.pelayananStatus).trim())) ||
                p.status === "Sedang Pemeriksaan" ||
                p.stage === "IN_PROGRESS"
              );
              const targetFilter = isMandiriDoneP ? "SEDANG" : (p.currentTab || "BELUM");
              const patientToExec = {
                id: p.id,
                nama: p.nama,
                nomorTiket: p.ticketNumber || p.nomorTiket || p.ticket || "—",
                nik: p.nik || "—",
                tglLahir: p.tglLahir || p.tanggalLahir || p.tanggal_lahir || "—",
                gender: p.gender || p.jenisKelamin || p.jenis_kelamin || "",
                index: i,
                category: p.category || (p.sekolah ? "SEKOLAH" : "UMUM"),
                sekolah: p.sekolah || p.namaSekolah || "",
                kelas: p.kelas || p.tingkatKelas || "",
                mandiriStatus: p.mandiriStatus || (isMandiriDoneP ? "Selesai" : "—"),
                pelayananStatus: p.pelayananStatus || (isMandiriDoneP ? "Sedang Pemeriksaan" : "—"),
                currentTab: targetFilter
              };

              const examRes = await executeSingleTablePatientExam(
                tab.id,
                patientToExec,
                targetFilter,
                message.customValues || null,
                { openInNewTab: false, closeTabWhenDone: false }
              ).catch(e => ({ ok: false, error: e.message }));

              if (examRes?.ok && examRes?.submitted) {
                await updateParticipantStatus(p.id, {
                  status: "COMPLETED",
                  stage: "COMPLETED",
                  completedAt: new Date().toISOString()
                }).catch(() => {});
                broadcast({
                  type: "PARTICIPANT_PROGRESS",
                  id: p.id,
                  nik: p.nik,
                  nama: p.nama,
                  stage: "COMPLETED",
                  status: "COMPLETED",
                  message: `✓ Pasien ${p.nama} selesai pelayanan.`
                });
                broadcast({
                  type: "SERVICE_COMPLETED",
                  participantId: p.id,
                  nik: p.nik,
                  nama: p.nama
                });
              } else if (!isBatchPelayananCancelled && !examRes?.stopped) {
                await updateParticipantStatus(p.id, {
                  status: "ERROR",
                  errorMsg: examRes?.error || "Gagal menyelesaikan pelayanan"
                }).catch(() => {});
                broadcast({
                  type: "PARTICIPANT_PROGRESS",
                  id: p.id,
                  nik: p.nik,
                  nama: p.nama,
                  stage: "START_EXAM",
                  status: "ERROR",
                  message: `❌ ${p.nama}: ${examRes?.error || 'Gagal pelayanan'}`
                });
              }

              if (isBatchPelayananCancelled) break;
              // Jeda stabilisasi antar pasien
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch (batchErr) {
            broadcast({ type: "AUTOMATION_LOG", message: `❌ Error batch pasien: ${batchErr.message}` });
          } finally {
            await unattendedMgr.disable();
            isBatchPelayananRunning = false;
            broadcast({ type: "BATCH_PELAYANAN_STATE", running: false, patient: null });
            broadcast({ type: "AUTOMATION_LOG", message: `✓ Seluruh antrean pasien terdaftar selesai diproses.` });
          }
        })();

        return { ok: true };
      }

      case "STOP_PELAYANAN_ALL_PATIENTS": {
        isBatchPelayananCancelled = true;
        isBatchPelayananRunning = false;
        isTablePatientCancelled = true;
        if (currentAutomationInstance) {
          try { currentAutomationInstance.stop(); } catch(e) {}
        }
        broadcast({ type: "BATCH_PELAYANAN_STATE", running: false, patient: null });
        broadcast({ type: "AUTOMATION_LOG", message: "⏹ Menghentikan otomasi batch pasien terdaftar..." });
        return { ok: true };
      }

      case "GET_SERVICE_HISTORY": {
        const { ckg_service_history = [] } = await chrome.storage.local.get("ckg_service_history");
        return { ok: true, history: ckg_service_history };
      }

      case "CLEAR_SERVICE_HISTORY": {
        await chrome.storage.local.set({ ckg_service_history: [] });
        broadcast({ type: "SERVICE_HISTORY_UPDATED", history: [] });
        return { ok: true };
      }

      case "FETCH_TATALAKSANA_DATA": {
        const tab = await getOrCreateCkgTab("https://sehatindonesiaku.kemkes.go.id/ckg-tatalaksana");
        const tatalaksanaRunner = new TatalaksanaAutomation({
          tabId: tab.id,
          onLog: msg => broadcast({ type: "AUTOMATION_LOG", message: `[Tatalaksana] ${msg}` })
        });
        const queuePatients = await tatalaksanaRunner.scrapeTatalaksanaQueue().catch(() => []);
        const activeFormAudit = await tatalaksanaRunner.scrapeActiveTatalaksanaFormFields().catch(() => null);

        return {
          ok: true,
          patients: queuePatients || [],
          formAudit: activeFormAudit || null
        };
      }

      case "INJECT_TATALAKSANA_VALUES": {
        const tab = await getOrCreateCkgTab("https://sehatindonesiaku.kemkes.go.id/ckg-tatalaksana");
        const { values, formSettings } = message;
        const tatalaksanaRunner = new TatalaksanaAutomation({
          tabId: tab.id,
          onLog: msg => broadcast({ type: "AUTOMATION_LOG", message: `[Tatalaksana] ${msg}` })
        });
        const result = await tatalaksanaRunner.injectTatalaksanaValues(values, formSettings);
        return { ok: true, result };
      }

      case "FETCH_PELAYANAN_TABLE_PATIENTS": {
        const { tabType = "BELUM", activeTabId, isUserInitiated = false } = message;
        const tab = await getPelayananQueueTab(activeTabId);
        
        // Jika tab sedang membuka detail-pemeriksaan, arahkan kembali ke halaman antrean pelayanan
        const curTabCheck = await chrome.tabs.get(tab.id).catch(() => null);
        if (curTabCheck?.url && curTabCheck.url.includes("detail-pemeriksaan")) {
          const isSekolah = curTabCheck.url.includes("sekolah");
          const queueUrl = isSekolah
            ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
            : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";
          console.log(`[QueueFetch] Tab sedang di detail-pemeriksaan, mengembalikan tab ke antrean: ${queueUrl}`);
          await chrome.tabs.update(tab.id, { url: queueUrl, active: true });
          
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 400));
            const t = await chrome.tabs.get(tab.id).catch(() => null);
            if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
          }
          await new Promise(r => setTimeout(r, 1200));
        }

        // Jika bukan pemicu manual user dan tersimpan backdate filter, pulihkan filter backdate sebelum scrape
        const existingFilters = await chrome.storage.local.get(["ckg_saved_pelayanan_date_filter", "ckg_saved_school_name", "ckg_saved_school_class"]);
        if (!isUserInitiated) {
          if (curTabCheck?.url?.includes("sekolah")) {
            if (existingFilters?.ckg_saved_school_name || existingFilters?.ckg_saved_school_class) {
              await ensureQueuePageSchoolFilter(tab.id, existingFilters.ckg_saved_school_name, existingFilters.ckg_saved_school_class, tabType);
              await new Promise(r => setTimeout(r, 1200));
            }
          } else if (existingFilters?.ckg_saved_pelayanan_date_filter) {
            await ensureQueuePageDateFilter(tab.id, existingFilters.ckg_saved_pelayanan_date_filter, tabType);
            await new Promise(r => setTimeout(r, 1200));
          }
        }

        // Pindah tab di CKG jika perlu (Belum Pemeriksaan vs Sedang Pemeriksaan) & Scrape data + filter tanggal
        const scrapeTask = (async () => {
          const [res] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: async (type) => {
              const wait = ms => new Promise(r => setTimeout(r, ms));
              const clean = s => (s || "").replace(/\s+/g, " ").trim();

              // Jika masih di halaman detail pemeriksaan, jangan scrape modul sebagai pasien
              if (window.location.href.includes("detail-pemeriksaan")) {
                return { patients: [], dateFilter: "", schoolName: "", className: "", isSekolah: false, currentUrl: window.location.href };
              }

              const targetTabName = type === "SEDANG" ? "Sedang Pemeriksaan" : "Belum Pemeriksaan";
              
              // 0. Bersihkan input pencarian nama jika terkontaminasi teks tanggal
              const searchInput = document.querySelector('input#searchNik, input[placeholder*="nama" i], input[placeholder*="tiket" i]');
              if (searchInput && (/\d{4}/.test(searchInput.value || '') || (searchInput.value || '').includes('-'))) {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) nativeSetter.call(searchInput, '');
                else searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                const clearBtn = searchInput.parentElement?.querySelector('button, svg, [class*="clear"], [class*="close"]');
                if (clearBtn) clearBtn.click();
                await wait(600);
              }

              // 1. Deteksi Filter (Tanggal jika CKG Umum, Sekolah + Kelas jika CKG Sekolah)
              let activeDateFilter = "";
              let activeSchoolName = "";
              let activeClassName = "";
              const isSekolahPage = window.location.href.includes("sekolah");

              if (isSekolahPage) {
                // Temukan tombol 'Tampilkan Pencarian'
                const btnCari = Array.from(document.querySelectorAll('button, a, div[role="button"], div.cursor-pointer, .btn')).find(b => {
                  const t = clean(b.innerText || b.textContent || '').toLowerCase();
                  return t.includes('tampilkan pencarian') || t === 'cari';
                });

                const filterContainer = btnCari ? (btnCari.closest('form, div.flex, div.grid, div.row') || btnCari.parentElement) : document;
                const schoolKeywords = /(smp|sd|sma|smk|mi|mts|ma|sekolah|islam|negeri|swasta|yayasan|pesantren|tk|paud|al\s+|darul|nurul)/i;

                // 1. Ekstraksi Kelas
                const classCandidates = Array.from(filterContainer.querySelectorAll('div, span, button, [role="combobox"], select, input')).filter(el => {
                  if (el.children.length > 3 || el === btnCari || btnCari?.contains(el)) return false;
                  const t = clean(el.innerText || el.textContent || el.value || '').toLowerCase();
                  return t.startsWith('kelas') || /kelas\s*\d+/i.test(t) || t.includes('pilih kelas');
                });
                if (classCandidates.length > 0) {
                  activeClassName = clean(classCandidates[0].innerText || classCandidates[0].textContent || classCandidates[0].value || '').split('\n')[0].trim();
                }

                // 2. Ekstraksi Sekolah
                if (filterContainer) {
                  const interactiveBoxes = Array.from(filterContainer.querySelectorAll('.cursor-pointer, [role="combobox"], div.relative, select, button, input')).filter(el => {
                    if (el === btnCari || btnCari?.contains(el)) return false;
                    const t = clean(el.innerText || el.textContent || el.value || '').toLowerCase();
                    return !t.includes('tampilkan pencarian') && !t.startsWith('kelas') && !/kelas\s*\d+/i.test(t);
                  });

                  for (const box of interactiveBoxes) {
                    const t = clean(box.innerText || box.textContent || box.value || '');
                    if (schoolKeywords.test(t) && !/^(sekolah|pilih sekolah|semua sekolah|\*)$/i.test(t)) {
                      activeSchoolName = t.split('\n')[0].trim();
                      break;
                    }
                  }

                  if (!activeSchoolName && interactiveBoxes.length > 0) {
                    const firstTxt = clean(interactiveBoxes[0].innerText || interactiveBoxes[0].textContent || interactiveBoxes[0].value || '');
                    if (firstTxt && !/^(sekolah|pilih sekolah|semua sekolah|\*)$/i.test(firstTxt) && !firstTxt.toLowerCase().includes('kelas')) {
                      activeSchoolName = firstTxt.split('\n')[0].trim();
                    }
                  }
                }

                // Fallback ekstraksi jika belum dapat
                if (!activeSchoolName) {
                  const allLabels = Array.from(document.querySelectorAll('label, div.font-semibold, div.font-500, span.font-semibold, p'));
                  const schoolLabel = allLabels.find(el => {
                    const t = clean(el.innerText || el.textContent || '').toLowerCase();
                    return t === 'sekolah' || t === 'sekolah *' || t === 'pilih sekolah' || t === 'nama sekolah';
                  });
                  if (schoolLabel) {
                    const container = schoolLabel.closest('.flex, .grid, .mb-4, div') || schoolLabel.parentElement;
                    const trig = container?.querySelector('.cursor-pointer, input, button, select, span.line-clamp-2') || schoolLabel.nextElementSibling;
                    const txt = clean(trig?.innerText || trig?.textContent || trig?.value || "");
                    if (txt && !/^(sekolah|pilih sekolah|semua sekolah|\*)$/i.test(txt)) {
                      activeSchoolName = txt.split('\n')[0].trim();
                    }
                  }
                }

                // 3. Otomatis klik Tampilkan Pencarian jika tabel masih kosong (Gambar 1 & Gambar 3)
                const existingRows = Array.from(document.querySelectorAll('tbody tr')).filter(r => {
                  const txt = clean(r.innerText || '');
                  return txt.length > 5 && !txt.includes('tidak ditemukan') && !txt.includes('belum ada data') && !txt.includes('silakan lakukan filter');
                });

                if (existingRows.length === 0 && btnCari) {
                  const triggerClick = el => {
                    if (!el) return;
                    const target = el.closest("button, a, [role='button'], div.cursor-pointer, .btn") || el;
                    target.focus?.();
                    const opts = { bubbles: true, cancelable: true, view: window };
                    target.dispatchEvent(new PointerEvent('pointerdown', opts));
                    target.dispatchEvent(new MouseEvent('mousedown', opts));
                    target.dispatchEvent(new PointerEvent('pointerup', opts));
                    target.dispatchEvent(new MouseEvent('mouseup', opts));
                    target.dispatchEvent(new MouseEvent('click', opts));
                    if (typeof target.click === "function") {
                      try { target.click(); } catch(e) {}
                    }
                  };
                  triggerClick(btnCari);
                  await wait(1200);
                }
              } else {
                // Deteksi tanggal pelayanan pada CKG Umum dari elemen datepicker
                const datepicker = document.querySelector('.mx-datepicker, [class*="datepicker"]');
                if (datepicker) {
                  const inp = datepicker.querySelector('input.mx-input, input');
                  if (inp && inp.value) activeDateFilter = clean(inp.value);
                  if (!activeDateFilter) {
                    const m = clean(datepicker.innerText || datepicker.textContent || "").match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/);
                    if (m) activeDateFilter = m[0];
                  }
                }
                if (!activeDateFilter) {
                  const dateEls = Array.from(document.querySelectorAll('div, button, span, p')).filter(el => {
                    if (el.children.length > 2 || el.closest('#searchNik, form, table, tbody')) return false;
                    const t = clean(el.innerText || el.textContent || '');
                    return /\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(t);
                  });
                  if (dateEls.length > 0) {
                    const m = clean(dateEls[0].innerText || '').match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/);
                    if (m) activeDateFilter = m[0];
                  }
                }
              }

              // 2. Cari tombol tab dengan regex adaptif
              const isSedangTab = type === "SEDANG";
              const targetTabRegex = isSedangTab
                ? /(sedang\s*(pemeriksaan|diperiksa|pelayanan)?)/i
                : /(belum\s*(pemeriksaan|diperiksa|pelayanan|dilakukan)?)/i;

              const tabs = Array.from(document.querySelectorAll('div, span, button, a, [role="tab"]')).filter(el => {
                if (el.closest('.mx-datepicker, #searchNik, form, table, tbody') || el.children.length > 3) return false;
                const t = clean(el.innerText || el.textContent || '').toLowerCase();
                return targetTabRegex.test(t);
              });
              const tabBtn = tabs.find(el => el.classList.contains('cursor-pointer') || el.closest('.cursor-pointer') || el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') || tabs[0];
              if (tabBtn) {
                // Jangan klik ulang jika tab sudah aktif
                const isAlreadySelected = tabBtn.classList.contains('active') || tabBtn.getAttribute('aria-selected') === 'true';
                if (!isAlreadySelected) {
                  const clickTarget = tabBtn.closest('.cursor-pointer') || tabBtn;
                  clickTarget.click();
                  await wait(800);
                }
              }

              // 3. Scrape data baris pasien dari tabel dengan retry loop (HANYA tabel antrean pasien)
              let rows = [];
              for (let t = 0; t < 15; t++) {
                const allTables = Array.from(document.querySelectorAll('table')).filter(tbl => {
                  if (tbl.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
                  const fullTblText = clean(tbl.innerText || '').toLowerCase();
                  return (fullTblText.includes('nama') || fullTblText.includes('tiket') || fullTblText.includes('lahir') || fullTblText.includes('wali')) && tbl.querySelectorAll('tr').length > 1;
                });

                const targetTable = allTables[0] || document.querySelector('table:has(tbody tr), table') || document;
                rows = Array.from(targetTable.querySelectorAll('tbody tr')).filter(r => {
                  if (r.closest('.table-pemeriksaan-mandiri, #tableLayanan')) return false;
                  const txt = (r.innerText || '').trim();
                  return txt.length > 5 && !txt.includes('Tidak ditemukan') && !txt.includes('Belum ada data') && !txt.includes('Nama Peserta') && !txt.includes('Status Imunisasi') && !txt.includes('Silakan lakukan filter');
                });
                if (rows.length > 0) break;
                await wait(200);
              }

              const patients = rows.map((tr, idx) => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const txts = cells.map(c => (c.innerText || c.textContent || '').trim());
                const fullText = (tr.innerText || tr.textContent || '').trim();
                
                // Ambil tombol aksi jika ada
                const btnMulai = tr.querySelector('button:not([disabled]), a.cursor-pointer, [role="button"]');
                const btnTxt = (btnMulai?.innerText || btnMulai?.textContent || '').trim();

                // Cari NIK & Nomor Tiket menggunakan regex & indeks kolom (hindari nama uppercase tertangkap)
                const nikMatch = fullText.match(/\b\d{16}\b/);
                const rawTiket = txts[3] || "";
                const tiketMatch = rawTiket.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                                  rawTiket.match(/\bTKT-[A-Z0-9-]+\b/i) ||
                                  fullText.match(/\b[A-Z0-9]{2,6}-[A-Z0-9]{2,6}\b/i) ||
                                  fullText.match(/\bTKT-[A-Z0-9-]+\b/i);
                let nomorTiket = tiketMatch ? tiketMatch[0].toUpperCase() : (rawTiket && rawTiket !== "—" && rawTiket !== "-" && rawTiket.length >= 4 && !/^(laki|perempuan|belum|sedang|sudah)/i.test(rawTiket) ? rawTiket.trim().toUpperCase() : "—");
                const tglMatch = fullText.match(/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/);

                let nama = "—";
                if (cells.length > 1) {
                  nama = (cells[1].innerText || cells[1].textContent || '').split('\n')[0].trim();
                }
                if (!nama || nama === "—" || /^\d+$/.test(nama)) {
                  nama = (cells[0]?.innerText || '').split('\n')[0].trim();
                }

                const hasAction = !!btnMulai || (!isSekolahPage && (nama !== "—" || nomorTiket !== "—"));
                const actionText = btnTxt || (hasAction ? "Mulai" : "—");

                return {
                  rowId: tr.id || `row_${idx}`,
                  index: idx,
                  no: txts[0] || String(idx + 1),
                  nama: nama || "—",
                  nik: nikMatch ? nikMatch[0] : "—",
                  tglLahir: tglMatch ? tglMatch[0] : (txts[2] || "—"),
                  nomorTiket: nomorTiket || (tiketMatch ? tiketMatch[0] : (txts[3] || "—")),
                  wali: txts[4] || "—",
                  unit: txts[5] || "—",
                  mandiriStatus: txts[6] || "—",
                  pelayananStatus: txts[7] || "—",
                  actionText,
                  hasAction,
                  currentTab: type
                };
              });

              return {
                patients,
                dateFilter: activeDateFilter,
                schoolName: activeSchoolName,
                className: activeClassName,
                isSekolah: isSekolahPage,
                currentUrl: window.location.href
              };
            },
            args: [tabType]
          });
          return res?.result || { patients: [], dateFilter: "", schoolName: "", className: "", currentUrl: "" };
        })();

        const timeoutFallback = new Promise(r => setTimeout(() => r({
          patients: [],
          dateFilter: existingFilters?.ckg_saved_pelayanan_date_filter || "",
          schoolName: existingFilters?.ckg_saved_school_name || "",
          className: existingFilters?.ckg_saved_school_class || "",
          currentUrl: curTabCheck?.url || tab?.url || "",
          timedOut: true
        }), 8500));

        const scrapedResult = await Promise.race([scrapeTask, timeoutFallback]);

        const currentUrl = scrapedResult?.currentUrl || tab?.url || "";
        const isSekolah = currentUrl.includes("ckg-pelayanan-sekolah") || currentUrl.includes("sekolah");
        const originUrl = isSekolah
          ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah"
          : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

        const toStore = {
          ckg_origin_pelayanan_url: originUrl,
          ckg_is_sekolah: isSekolah
        };

        if (isSekolah) {
          if (scrapedResult?.schoolName) toStore.ckg_saved_school_name = scrapedResult.schoolName;
          if (scrapedResult?.className) toStore.ckg_saved_school_class = scrapedResult.className;
        } else {
          // Hanya timpa date filter jika aksi ini dipicu manual oleh klik tombol user 'Ambil Antrean Web CKG',
          // ATAU jika belum pernah ada date filter yang tersimpan.
          // Ini sangat krusial agar entri backdate TIDAK tertimpa oleh tanggal default hari ini.
          if (isUserInitiated && scrapedResult?.dateFilter) {
            toStore.ckg_saved_pelayanan_date_filter = scrapedResult.dateFilter;
          } else if (!existingFilters?.ckg_saved_pelayanan_date_filter && scrapedResult?.dateFilter) {
            toStore.ckg_saved_pelayanan_date_filter = scrapedResult.dateFilter;
          }
        }

        await chrome.storage.local.set(toStore);
        broadcast({
          type: "AUTOMATION_LOG",
          message: isSekolah
            ? `[Antrean CKG] Mode: Sekolah${scrapedResult?.schoolName ? " | " + scrapedResult.schoolName : ""}${scrapedResult?.className ? " (" + scrapedResult.className + ")" : ""}`
            : `[Antrean CKG] Mode: Umum${scrapedResult?.dateFilter ? " | Filter Tanggal: " + scrapedResult.dateFilter : ""}`
        });

        return {
          ok: true,
          patients: scrapedResult?.patients || [],
          dateFilter: scrapedResult?.dateFilter || "",
          schoolName: scrapedResult?.schoolName || "",
          className: scrapedResult?.className || "",
          tabType,
          isSekolah,
          originUrl
        };
      }

      case "RUN_TABLE_PATIENT_PELAYANAN": {
        const { patient, activeTabId, tabFilter, customValues, openInNewTab, closeTabWhenDone } = message;
        isTablePatientCancelled = false;
        broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: true });
        const tab = await getPelayananQueueTab(activeTabId);
        try {
          const res = await executeSingleTablePatientExam(tab.id, patient, tabFilter, customValues, {
            openInNewTab: !!openInNewTab,
            closeTabWhenDone: closeTabWhenDone !== false
          });
          if (res?.stopped || isTablePatientCancelled) {
            broadcast({ type: "AUTOMATION_LOG", message: `⏹ Pelayanan pasien ${patient.nama} dihentikan.` });
          } else if (res?.ok && res?.submitted) {
            broadcast({ type: "AUTOMATION_LOG", message: `✓ Pasien ${patient.nama} berhasil selesai diproses dari tabel CKG!` });
          }
          return res;
        } finally {
          if (activeTableWorkers.size === 0) {
            broadcast({ type: "TABLE_QUEUE_LOOP_STATE", running: false });
          }
        }
      }

      case "CHECK_SELESAI_PEMERIKSAAN_BY_TICKETS": {
        const { activeTabId, tickets = [], names = [] } = message;
        return await checkSelesaiPemeriksaanByTickets(activeTabId, tickets, names);
      }

      case "REFRESH_PELAYANAN_QUEUE_TAB_TOGGLE": {
        const { tabFilter = "BELUM", activeTabId } = message;
        return await refreshPelayananQueueByTabToggle(activeTabId, tabFilter);
      }

      case "START_TABLE_QUEUE_LOOP": {
        return await startTableQueueLoop(message.tabFilter || "BELUM", message.activeTabId);
      }

      case "STOP_TABLE_QUEUE_LOOP": {
        return stopTableQueueLoop();
      }

      default:
        return { ok: false, error: "Tipe pesan tidak dikenali" };
    }
  })().then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
  return true;
});

