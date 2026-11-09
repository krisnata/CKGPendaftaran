// sidepanel.js - CKG Auto Importer & Pendaftaran Otomatis

import { parseExcelBuffer, parseMultipleFiles } from "./src/excel-importer.js";
import {
  addParticipantsBatch,
  getQueueByBatch,
  getQueueStats,
  clearBatch,
  resetErrorsToReady
} from "./src/db.js";
import {
  downloadTemplate,
  downloadMasterUmum,
  downloadMasterSekolah,
  exportPatientsToZip,
  exportPatientsToMasterUmum,
  exportPatientsToMasterSekolah
} from "./src/template-generator.js";
import {
  getDeviceId,
  getAuthSession,
  clearAuthSession,
  isSessionValid,
  verifyLicenseWithServer
} from "./src/auth.js";
import { showSantaiCelebration } from "./src/santai.js";

let currentBatchId = null;
let currentItems = [];
let currentFilter = "ALL";
let isQueueRunning = false;

// 1. Keepalive Port ke Service Worker (Mencegah background tidur saat unattended)
let keepAlivePort = null;
function ensureKeepAlive() {
  try {
    if (!keepAlivePort) {
      keepAlivePort = chrome.runtime.connect({ name: "CKG_KEEPALIVE_PORT" });
      keepAlivePort.onDisconnect.addListener(() => {
        keepAlivePort = null;
        setTimeout(ensureKeepAlive, 1000);
      });
    }
  } catch (e) {}
}
ensureKeepAlive();
setInterval(ensureKeepAlive, 20000);

// 2. DOM Elements
const fileInput = document.getElementById("file-input");
const btnBrowse = document.getElementById("btn-browse");
const dropzone = document.getElementById("dropzone");
const detectedCatBadge = document.getElementById("detected-cat-badge");

const spClinicalDetected = document.getElementById("sp-clinical-detected");
const spPillAnthro = document.getElementById("sp-pill-anthro");
const spPillTensi = document.getElementById("sp-pill-tensi");
const spPillLab = document.getElementById("sp-pill-lab");
const spPillSensory = document.getElementById("sp-pill-sensory");
const spPillSpecial = document.getElementById("sp-pill-special");

const btnDlMasterUmum = document.getElementById("btn-dl-master-umum");
const btnDlMasterSekolah = document.getElementById("btn-dl-master-sekolah");
const btnDlBalita = document.getElementById("btn-dl-balita");
const btnDlZipAll = document.getElementById("btn-dl-zip-all");
const btnExportCurrentZip = document.getElementById("btn-export-current-zip");

const btnStartQueue = document.getElementById("btn-start-queue");
const btnPauseQueue = document.getElementById("btn-pause-queue");
const btnResumeQueue = document.getElementById("btn-resume-queue");
const btnStopQueue = document.getElementById("btn-stop-queue");
const btnStepOne = document.getElementById("btn-step-one");
const btnClearQueue = document.getElementById("btn-clear-queue");
const btnRestartError = document.getElementById("btn-restart-error");

const statTotal = document.getElementById("stat-total");
const statCompleted = document.getElementById("stat-completed");
const statAlreadyScreened = document.getElementById("stat-already-screened");
const statReady = document.getElementById("stat-ready");
const statProgress = document.getElementById("stat-progress");
const statInvalid = document.getElementById("stat-invalid");
const statError = document.getElementById("stat-error");
const progressFill = document.getElementById("progress-fill");
const currentBatchName = document.getElementById("current-batch-name");

const pActiveName = document.getElementById("p-active-name");
const pActiveNik = document.getElementById("p-active-nik");
const pActiveTicket = document.getElementById("p-active-ticket");
const pActiveCategory = document.getElementById("p-active-category");
const activeStageBadge = document.getElementById("active-participant-stage");

const stepReg = document.getElementById("step-reg");
const stepHadir = document.getElementById("step-hadir");
const stepExam = document.getElementById("step-exam");
const stepDone = document.getElementById("step-done");

const queueItemsContainer = document.getElementById("queue-items-container");
const terminalLogs = document.getElementById("terminal-logs");
const btnClearLogs = document.getElementById("btn-clear-logs");

// Auth & License Elements
const loginScreen = document.getElementById("login-screen");
const formLogin = document.getElementById("form-login");
const loginEmailInput = document.getElementById("login-email");
const loginAlert = document.getElementById("login-alert");
const btnDoLogin = document.getElementById("btn-do-login");
const btnLoginSpinner = document.getElementById("btn-login-spinner");
const btnLoginText = document.getElementById("btn-login-text");
const loginDeviceIdSpan = document.getElementById("login-device-id");
const btnCopyDeviceLogin = document.getElementById("btn-copy-device-login");

const userChipBox = document.getElementById("user-chip-box");
const userChipName = document.getElementById("user-chip-name");
const btnReplaySantai = document.getElementById("btn-replay-santai");
const btnLogoutAccount = document.getElementById("btn-logout-account");

// 3. Logger UI
function appendLogToUI(text, isError = false) {
  if (!terminalLogs) return;
  const line = document.createElement("div");
  line.className = isError ? "log-line text-danger" : "log-line";
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${text}`;
  terminalLogs.appendChild(line);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

// Helper Alert Box Login
function showLoginAlert(msg, type = "error") {
  if (!loginAlert) return;
  loginAlert.className = `login-alert alert-${type}`;
  loginAlert.textContent = msg;
  loginAlert.style.display = "block";
}

function hideLoginAlert() {
  if (!loginAlert) return;
  loginAlert.style.display = "none";
  loginAlert.textContent = "";
}

// Status Sesi & UI Sidepanel (Bebas Akses Tanpa Kunci / Login)
async function syncAuthUI() {
  return true;
}

// 4. File Processing, Cross-File Merging & Clinical Extraction
async function handleFiles(files) {
  if (!files || !files.length) return;
  // Snapshot array secara sinkron SEBELUM await agar tidak terhapus saat fileInput.value di-reset!
  const fileArray = Array.from(files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
  if (!fileArray.length) {
    alert("Silakan pilih file berekstensi .xlsx, .xls, atau .csv!");
    return;
  }

  // Bebas akses tanpa kunci login

  appendLogToUI(`📥 Memulai proses pembacaan ${fileArray.length} berkas data...`);

  try {
    const fileBuffers = [];
    for (let i = 0; i < fileArray.length; i++) {
      const f = fileArray[i];
      appendLogToUI(`[${i + 1}/${fileArray.length}] Membaca "${f.name}" (${(f.size / 1024).toFixed(1)} KB)...`);
      const buffer = await f.arrayBuffer();
      fileBuffers.push({ name: f.name, buffer });
    }

    const selectedRadio = document.querySelector('input[name="data-category"]:checked')?.value;
    const forceCat = selectedRadio !== "AUTO" ? selectedRadio : null;

    appendLogToUI(`🔄 Menggabungkan data & menyelaraskan kolom pemeriksaan klinis (tanpa duplikat)...`);
    const defaultWali = (typeof getHardlockWaliFromUI === 'function') ? getHardlockWaliFromUI() : null;
    const parsed = parseMultipleFiles(fileBuffers, forceCat, { defaultWali });
    if (detectedCatBadge) detectedCatBadge.textContent = parsed.category;

    currentBatchId = `BATCH-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900 + 100)}`;
    if (currentBatchName) currentBatchName.textContent = currentBatchId;
    chrome.storage.local.set({ activeBatchId: currentBatchId }).catch(() => {});

    // Perbarui banner rincian berkas yang digabungkan
    const spMultiFileSummary = document.getElementById("sp-multi-file-summary");
    const multiFileTitle = document.getElementById("multi-file-title");
    const multiFileDetails = document.getElementById("multi-file-details");
    if (spMultiFileSummary && multiFileDetails) {
      spMultiFileSummary.style.display = "block";
      if (multiFileTitle) multiFileTitle.textContent = `📂 ${parsed.totalFiles} Berkas Berhasil Digabungkan:`;
      const fileSummaryList = parsed.fileSummaries.map(s => `• <strong>${s.fileName}</strong> (${s.rowsCount} baris)`).join("<br>");
      multiFileDetails.innerHTML = `
        ${fileSummaryList}
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #99f6e4; font-weight: 700; color: #047857;">
          ✨ Total Raw: ${parsed.totalRawRows} baris ➔ Hasil Bersih: ${parsed.totalCleanPatients} Pasien Unik (${parsed.duplicatesMerged} data ganda disatukan).
        </div>
      `;
    }

    // Deteksi kelengkapan hasil pemeriksaan di file
    if (spClinicalDetected) {
      spClinicalDetected.style.display = "block";
      const hasAnthro = parsed.patients.some(p => p.bb || p.tb);
      const hasTensi = parsed.patients.some(p => p.tdSistolik || p.tdDiastolik || p.lp);
      const hasLab = parsed.patients.some(p => p.gulaDarah || p.gulaDarahPuasa || p.kolesterolTotal || p.hemoglobin);
      const hasSensory = parsed.patients.some(p => p.telinga || p.mata || p.gigi || p.katarak || p.karies);
      const hasSpecial = parsed.patients.some(p => p.sadanis || p.iva || p.kpsp || p.mchat || p.barthelIndexAdl || p.skilasKognitif || p.riwayatDiabetes || p.riwayatHipertensi || p.skabies || p.gejalaTbc);

      if (spPillAnthro) spPillAnthro.style.opacity = hasAnthro ? "1" : "0.35";
      if (spPillTensi) spPillTensi.style.opacity = hasTensi ? "1" : "0.35";
      if (spPillLab) spPillLab.style.opacity = hasLab ? "1" : "0.35";
      if (spPillSensory) spPillSensory.style.opacity = hasSensory ? "1" : "0.35";
      if (spPillSpecial) spPillSpecial.style.opacity = hasSpecial ? "1" : "0.35";
    }

    // Sinkronisasi data sekolah jika terdeteksi
    if (parsed.category === "SEKOLAH" || parsed.patients.some(p => p.sekolah || p.namasekolah)) {
      const firstSchool = parsed.patients.find(p => p.sekolah || p.namasekolah);
      const schoolName = firstSchool?.sekolah || firstSchool?.namasekolah || "";
      const schoolClass = firstSchool?.kelas || firstSchool?.rombel || "";
      if (schoolName) {
        chrome.storage.local.set({
          ckg_saved_school_name: schoolName,
          ckg_saved_school_class: schoolClass,
          ckg_is_sekolah: true
        }).catch(() => {});
        appendLogToUI(`🏷 Sinkronisasi identitas sekolah: ${schoolName} (${schoolClass || '-'})`);
      }
    }

    // Masukkan ke IndexedDB
    await addParticipantsBatch(currentBatchId, parsed.category, parsed.patients);
    currentItems = await getQueueByBatch(currentBatchId);
    renderQueueList(currentItems);
    await refreshStats();

    appendLogToUI(`✓ Berhasil menyatukan ${parsed.totalFiles} berkas menjadi ${currentItems.length} pasien unik (${parsed.duplicatesMerged} duplikat disatukan).`);
    appendLogToUI(`👉 Klik tombol "▶ MULAI SUNTIK DATA KE CKG" untuk memulai pendaftaran otomatis.`);
  } catch (err) {
    appendLogToUI(`Gagal memproses file: ${err.message}`, true);
    alert(`Gagal memproses file: ${err.message}`);
  }
}

async function handleFile(file) {
  return handleFiles([file]);
}

// 5. Render Daftar Antrean Peserta
function renderQueueList(items) {
  if (!queueItemsContainer) return;
  queueItemsContainer.innerHTML = "";

  if (!items || !items.length) {
    queueItemsContainer.innerHTML = '<li class="empty-list-placeholder">Belum ada file Excel yang diunggah.</li>';
    return;
  }

  // Terapkan Filter
  const filtered = items.filter(it => {
    if (currentFilter === "ALL") return true;
    if (currentFilter === "READY") return it.status === "READY";
    if (currentFilter === "COMPLETED") return it.status === "COMPLETED" || it.status === "VALID" || it.status === "ALREADY_SCREENED";
    if (currentFilter === "ERROR") return it.status === "ERROR";
    if (currentFilter === "INVALID") return it.status === "INVALID" || it._status === "invalid-nik";
    return true;
  });

  if (!filtered.length) {
    queueItemsContainer.innerHTML = '<li class="empty-list-placeholder">Tidak ada data untuk filter ini.</li>';
    return;
  }

  filtered.forEach((p, idx) => {
    const li = document.createElement("li");
    li.className = "queue-item";
    li.id = `item-patient-${p.id}`;

    let statusBadgeHtml = '<span class="badge badge-primary">Siap Entri</span>';
    if (p.status === "IN_PROGRESS") {
      statusBadgeHtml = '<span class="badge badge-warning">⏳ Proses</span>';
    } else if (p.status === "COMPLETED" || p.status === "VALID") {
      statusBadgeHtml = `<span class="badge badge-success">✓ Selesai ${p.ticketNumber ? `(${p.ticketNumber})` : ''}</span>`;
    } else if (p.status === "ALREADY_SCREENED") {
      statusBadgeHtml = '<span class="badge" style="background:#e0e7ff; color:#4338ca;">Sudah di CKG</span>';
    } else if (p.status === "ERROR") {
      statusBadgeHtml = `<span class="badge badge-danger" title="${p.errorMsg || 'Error'}">⚠️ Error</span>`;
    } else if (p.status === "INVALID" || p._status === "invalid-nik") {
      statusBadgeHtml = '<span class="badge badge-danger">Tidak Valid</span>';
    }

    // Format info hasil pemeriksaan / pendaftaran yang ada di pasien ini
    const isSekolahPatient = p.category === "SEKOLAH" || p.detailedCategory === "SEKOLAH_SD" || p.detailedCategory === "REMAJA" || Boolean(p.sekolah || p.namasekolah);
    let examSummary = "";
    if (isSekolahPatient) {
      examSummary = `🏫 ${p.sekolah || p.namasekolah || "Sekolah"} • Kelas: ${p.kelas || p.jenjang || "-"}`;
    } else {
      const examParts = [];
      if (p.bb && p.tb) examParts.push(`BB:${p.bb} TB:${p.tb}`);
      if (p.tdSistolik && p.tdDiastolik) examParts.push(`TD:${p.tdSistolik}/${p.tdDiastolik}`);
      if (p.gulaDarah) examParts.push(`GDS:${p.gulaDarah}`);
      if (p.kolesterolTotal) examParts.push(`Kol:${p.kolesterolTotal}`);
      if (p.hemoglobin) examParts.push(`Hb:${p.hemoglobin}`);
      examSummary = examParts.length > 0 ? `✓ Pemeriksaan: ${examParts.join(" • ")}` : "Standar Fisiologis Normal";
    }

    li.innerHTML = `
      <div class="queue-item-meta">
        <span class="queue-num">${idx + 1}</span>
        <div class="queue-info">
          <div class="queue-name">
            <strong>${p.nama || "Tanpa Nama"}</strong>
            <span class="badge badge-secondary" style="font-size: 10px; margin-left: 4px;">${p.detailedCategory || p.category}</span>
          </div>
          <div class="queue-sub" style="font-family: monospace; font-size: 11px;">
            NIK: ${p.nik || '<span style="color:#ef4444;">KOSONG</span>'}
            ${p.ticketNumber ? ` • <strong style="color:#0284c7;">Tiket: ${p.ticketNumber}</strong>` : ''}
          </div>
          <div class="queue-exam-indicator">${examSummary}</div>
          ${p.errorMsg ? `<div style="font-size: 10.5px; color: #dc2626; margin-top: 2px;">⚠️ ${p.errorMsg}</div>` : ''}
        </div>
      </div>
      <div class="queue-actions">
        ${statusBadgeHtml}
        <button class="btn-icon btn-run-one" data-id="${p.id}" title="Entri Pasien Ini Saja" ${(p.status === "COMPLETED" || p.status === "VALID") ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    `;

    queueItemsContainer.appendChild(li);
  });

  // Bind individual run buttons
  document.querySelectorAll(".btn-run-one").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id, 10);
      const participant = currentItems.find(it => it.id === id);
      if (participant) {
        appendLogToUI(`Menjalankan entri untuk: ${participant.nama}`);
        chrome.runtime.sendMessage({
          type: "RUN_SINGLE_PARTICIPANT",
          participant
        }).catch(() => {});
      }
    });
  });
}

// 6. Refresh Statistik
function updateStatsUI(stats) {
  if (!stats) return;
  if (statTotal) statTotal.textContent = stats.total ?? 0;
  if (statCompleted) statCompleted.textContent = stats.completed ?? 0;
  if (statAlreadyScreened) statAlreadyScreened.textContent = stats.alreadyScreened ?? 0;
  if (statReady) statReady.textContent = stats.ready ?? 0;
  if (statProgress) statProgress.textContent = stats.inProgress ?? 0;
  if (statInvalid) statInvalid.textContent = stats.invalid ?? 0;
  if (statError) statError.textContent = stats.error ?? 0;

  if (btnRestartError) {
    btnRestartError.style.display = stats.error > 0 ? "inline-flex" : "none";
  }

  const doneCount = (stats.completed || 0) + (stats.alreadyScreened || 0);
  const pct = stats.total > 0 ? Math.round((doneCount / stats.total) * 100) : 0;
  if (progressFill) progressFill.style.width = `${pct}%`;
}

async function refreshStats() {
  if (!currentBatchId) return;
  const stats = await getQueueStats(currentBatchId);
  updateStatsUI(stats);
}

// 7. Update Peserta Aktif & Visual Stepper
function updateActiveParticipantUI(p, stage) {
  if (!p) {
    if (pActiveName) pActiveName.textContent = "—";
    if (pActiveNik) pActiveNik.textContent = "—";
    if (pActiveTicket) pActiveTicket.textContent = "—";
    if (pActiveCategory) pActiveCategory.textContent = "—";
    if (activeStageBadge) {
      activeStageBadge.textContent = "STANDBY";
      activeStageBadge.className = "active-badge";
    }
    resetStepper();
    return;
  }

  if (pActiveName) pActiveName.textContent = p.nama || "—";
  if (pActiveNik) pActiveNik.textContent = p.nik || "—";
  if (pActiveTicket) pActiveTicket.textContent = p.ticketNumber || p.nomorTiket || "—";
  if (pActiveCategory) pActiveCategory.textContent = p.detailedCategory || p.category || "—";
  if (activeStageBadge) {
    activeStageBadge.textContent = stage || "PROSES";
    activeStageBadge.className = "active-badge active";
  }

  updateStepper(stage);
}

function resetStepper() {
  [stepReg, stepHadir, stepExam, stepDone].forEach(node => {
    if (node) node.className = "step-node";
  });
}

function updateStepper(stage) {
  resetStepper();
  const s = String(stage || "").toUpperCase();

  if (s.includes("REGISTRATION") || s.includes("DAFTAR") || s.includes("NIK")) {
    if (stepReg) stepReg.className = "step-node active";
  } else if (s.includes("HADIR") || s.includes("TIKET")) {
    if (stepReg) stepReg.className = "step-node done";
    if (stepHadir) stepHadir.className = "step-node active";
  } else if (s.includes("EXAM") || s.includes("SCREENING") || s.includes("PERIKSA") || s.includes("PELAYANAN")) {
    if (stepReg) stepReg.className = "step-node done";
    if (stepHadir) stepHadir.className = "step-node done";
    if (stepExam) stepExam.className = "step-node active";
  } else if (s.includes("COMPLETED") || s.includes("SELESAI")) {
    if (stepReg) stepReg.className = "step-node done";
    if (stepHadir) stepHadir.className = "step-node done";
    if (stepExam) stepExam.className = "step-node done";
    if (stepDone) stepDone.className = "step-node done";
  }
}

// 8. Event Listeners Dropzone & Pickers
if (btnBrowse) {
  btnBrowse.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInput) fileInput.click();
  });
}

if (dropzone) {
  dropzone.addEventListener("click", (e) => {
    if (e.target !== btnBrowse && !btnBrowse?.contains(e.target)) {
      if (fileInput) fileInput.click();
    }
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--primary)";
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "#cbd5e1";
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#cbd5e1";
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) handleFiles(files);
  });
}

if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length > 0) {
      fileInput.value = "";
      handleFiles(selectedFiles);
    }
  });
}

// 8b. Event Listeners (Fitur Login & Lisensi telah dinonaktifkan - Bebas Akses)

// 9. Tombol Kontrol Eksekusi Utama (Mulai Suntik Data ke CKG)
if (btnStartQueue) {
  btnStartQueue.addEventListener("click", async () => {
    // Bebas akses tanpa kunci login

    if (!currentBatchId || !currentItems.length) {
      alert("Harap unggah file Excel data mentah Anda terlebih dahulu!");
      return;
    }

    isQueueRunning = true;
    btnStartQueue.hidden = true;
    if (btnPauseQueue) btnPauseQueue.hidden = false;
    if (btnStopQueue) btnStopQueue.hidden = false;
    appendLogToUI("🚀 Memulai proses pendaftaran & entri otomatis ke SehatIndonesiaku...");

    chrome.runtime.sendMessage({
      type: "START_QUEUE",
      batchId: currentBatchId
    }).catch(() => {});
  });
}

if (btnPauseQueue) {
  btnPauseQueue.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PAUSE_QUEUE" }).catch(() => {});
    btnPauseQueue.hidden = true;
    if (btnResumeQueue) btnResumeQueue.hidden = false;
    appendLogToUI("⏸ Otomasi dijeda.");
  });
}

if (btnResumeQueue) {
  btnResumeQueue.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "RESUME_QUEUE" }).catch(() => {});
    btnResumeQueue.hidden = true;
    if (btnPauseQueue) btnPauseQueue.hidden = false;
    appendLogToUI("▶ Melanjutkan otomasi...");
  });
}

if (btnStopQueue) {
  btnStopQueue.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_QUEUE" }).catch(() => {});
    isQueueRunning = false;
    if (btnStartQueue) btnStartQueue.hidden = false;
    if (btnPauseQueue) btnPauseQueue.hidden = true;
    if (btnResumeQueue) btnResumeQueue.hidden = true;
    btnStopQueue.hidden = true;
    appendLogToUI("⏹ Otomasi dihentikan oleh pengguna.");
  });
}

if (btnStepOne) {
  btnStepOne.addEventListener("click", async () => {
    // Bebas akses tanpa kunci login

    if (!currentItems.length) {
      alert("Antrean kosong!");
      return;
    }
    const readyItem = currentItems.find(it => it.status === "READY");
    if (!readyItem) {
      alert("Tidak ada peserta berstatus Siap Entri!");
      return;
    }
    appendLogToUI(`Menjalankan 1 peserta: ${readyItem.nama}`);
    chrome.runtime.sendMessage({
      type: "RUN_SINGLE_PARTICIPANT",
      participant: readyItem
    }).catch(() => {});
  });
}

if (btnClearQueue) {
  btnClearQueue.addEventListener("click", async () => {
    if (!currentBatchId) return;
    if (!confirm("Hapus antrean saat ini?")) return;
    await clearBatch(currentBatchId);
    currentBatchId = null;
    currentItems = [];
    if (currentBatchName) currentBatchName.textContent = "Belum ada batch";
    renderQueueList([]);
    await refreshStats();
    updateActiveParticipantUI(null, "STANDBY");
    appendLogToUI("Antrean berhasil dibersihkan.");
  });
}

if (btnRestartError) {
  btnRestartError.addEventListener("click", async () => {
    // Bebas akses tanpa kunci login

    if (!currentBatchId) {
      alert("Belum ada antrean batch aktif.");
      return;
    }
    const resetCount = await resetErrorsToReady(currentBatchId);
    currentItems = await getQueueByBatch(currentBatchId);
    renderQueueList(currentItems);
    await refreshStats();

    if (resetCount > 0) {
      appendLogToUI(`🔄 Mengembalikan ${resetCount} peserta Error ke Siap Entri.`);
      isQueueRunning = true;
      if (btnStartQueue) btnStartQueue.hidden = true;
      if (btnPauseQueue) btnPauseQueue.hidden = false;
      if (btnStopQueue) btnStopQueue.hidden = false;
      chrome.runtime.sendMessage({
        type: "START_QUEUE",
        batchId: currentBatchId
      }).catch(() => {});
    } else {
      appendLogToUI("Tidak ada peserta berstatus Error untuk diulang.");
      alert("Tidak ada peserta berstatus Error untuk diulang.");
    }
  });
}

if (btnClearLogs) {
  btnClearLogs.addEventListener("click", () => {
    if (terminalLogs) terminalLogs.innerHTML = "";
  });
}

// 10. Filter Queue Tabs
document.querySelectorAll(".btn-filter-queue").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn-filter-queue").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderQueueList(currentItems);
  });
});

// 11. Download Templates Excel Listeners
if (btnDlMasterUmum) btnDlMasterUmum.addEventListener("click", () => downloadMasterUmum());
if (btnDlMasterSekolah) btnDlMasterSekolah.addEventListener("click", () => downloadMasterSekolah());
if (btnDlBalita) btnDlBalita.addEventListener("click", () => downloadTemplate("BALITA"));
if (btnDlZipAll) {
  btnDlZipAll.addEventListener("click", async () => {
    if (currentItems && currentItems.length > 0) {
      await exportPatientsToZip(currentItems);
    } else {
      await downloadMasterUmum();
      await downloadMasterSekolah();
    }
  });
}
if (btnExportCurrentZip) {
  btnExportCurrentZip.addEventListener("click", async () => {
    if (!currentItems || !currentItems.length) {
      alert("Belum ada data untuk diekspor.");
      return;
    }
    await exportPatientsToZip(currentItems);
  });
}

// 12. Background Message Listener (Real-time updates)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "QUEUE_STATS_UPDATE") {
    if (message.stats) updateStatsUI(message.stats);
  } else if (message.type === "PARTICIPANT_PROGRESS") {
    updateActiveParticipantUI({
      nama: message.nama,
      nik: message.nik,
      ticketNumber: message.ticketNumber
    }, message.stage || message.status);

    // Update status badge baris peserta di DOM tanpa me-render ulang seluruh antrean
    if (message.id) {
      const itemEl = document.getElementById(`item-patient-${message.id}`);
      if (itemEl) {
        const badge = itemEl.querySelector(".queue-actions .badge");
        if (badge) {
          if (message.status === "COMPLETED" || message.status === "VALID") {
            badge.className = "badge badge-success";
            badge.textContent = `✓ Selesai ${message.ticketNumber ? `(${message.ticketNumber})` : ''}`;
          } else if (message.status === "ALREADY_SCREENED") {
            badge.className = "badge";
            badge.style.background = "#e0e7ff";
            badge.style.color = "#4338ca";
            badge.textContent = "Sudah di CKG";
          } else if (message.status === "ERROR") {
            badge.className = "badge badge-danger";
            badge.textContent = "⚠️ Error";
          } else if (message.status === "INVALID") {
            badge.className = "badge badge-danger";
            badge.textContent = "Tidak Valid";
          } else if (message.status === "IN_PROGRESS") {
            badge.className = "badge badge-warning";
            badge.textContent = "⏳ Proses";
          }
        }
      }
    }

    if (message.message) {
      appendLogToUI(message.message, message.status === "ERROR" || message.status === "INVALID");
    }
  } else if (message.type === "QUEUE_UPDATE") {
    refreshStats();
  } else if (message.type === "STAGE_CHANGE") {
    updateActiveParticipantUI(message.participant, message.stage);
  } else if (message.type === "LOG" || message.type === "AUTOMATION_LOG") {
    appendLogToUI(message.message || message.text, message.isError);
  } else if (message.type === "QUEUE_FINISHED") {
    isQueueRunning = false;
    btnStartQueue.hidden = false;
    btnPauseQueue.hidden = true;
    btnResumeQueue.hidden = true;
    btnStopQueue.hidden = true;
    updateActiveParticipantUI(null, "SELESAI");
    appendLogToUI("🎉 Seluruh antrean pendaftaran CKG telah selesai diproses!");
    alert("🎉 Seluruh antrean pendaftaran CKG berhasil diselesaikan!");
    if (currentBatchId) {
      getQueueByBatch(currentBatchId).then(items => {
        currentItems = items;
        renderQueueList(currentItems);
        refreshStats();
      });
    }
  } else if (message.type === "QUEUE_STOPPED") {
    isQueueRunning = false;
    btnStartQueue.hidden = false;
    btnPauseQueue.hidden = true;
    btnResumeQueue.hidden = true;
    btnStopQueue.hidden = true;
    updateActiveParticipantUI(null, "STANDBY");
  }
});

// 13. Muat State Terakhir saat Side Panel dibuka
(async () => {
  try {
    const { activeBatchId } = await chrome.storage.local.get("activeBatchId");
    if (activeBatchId) {
      currentBatchId = activeBatchId;
      if (currentBatchName) currentBatchName.textContent = currentBatchId;
      currentItems = await getQueueByBatch(currentBatchId);
      renderQueueList(currentItems);
      await refreshStats();
      if (currentItems.length > 0) {
        appendLogToUI(`Memuat antrean aktif (${currentItems.length} peserta). Siap dilanjutkan.`);
      }
    }
  } catch (e) {}
})();

// ==========================================
// HARDLOCK DATA WALI (CADANGAN BALITA JIKA DI EXCEL KOSONG)
// ==========================================
const hardlockWaliNik = document.getElementById("hardlock-wali-nik");
const hardlockWaliNama = document.getElementById("hardlock-wali-nama");
const hardlockWaliTglLahir = document.getElementById("hardlock-wali-tgllahir");
const hardlockWaliJk = document.getElementById("hardlock-wali-jk");
const hardlockWaliHp = document.getElementById("hardlock-wali-hp");
const btnSaveHardlockWali = document.getElementById("btn-save-hardlock-wali");
const hardlockWaliSavedBadge = document.getElementById("hardlock-wali-saved-badge");

function getHardlockWaliFromUI() {
  return {
    nikWali: (hardlockWaliNik?.value || "").replace(/\D/g, "").slice(0, 16),
    namaWali: (hardlockWaliNama?.value || "").trim(),
    tglLahirWali: (hardlockWaliTglLahir?.value || "").trim(),
    jkWali: (hardlockWaliJk?.value || "").trim(),
    noHpWali: (hardlockWaliHp?.value || "").replace(/\D/g, "")
  };
}

function updateHardlockWaliBadge(hasData) {
  if (!hardlockWaliSavedBadge) return;
  if (hasData) {
    hardlockWaliSavedBadge.textContent = "Aktif";
    hardlockWaliSavedBadge.style.background = "#fef3c7";
    hardlockWaliSavedBadge.style.color = "#b45309";
  } else {
    hardlockWaliSavedBadge.textContent = "Opsional";
    hardlockWaliSavedBadge.style.background = "#f3f4f6";
    hardlockWaliSavedBadge.style.color = "#6b7280";
  }
}

async function loadHardlockWaliFromStorage() {
  try {
    const { ckg_hardlock_wali } = await chrome.storage.local.get("ckg_hardlock_wali");
    // Bersihkan jika masih menyimpan data default Nurhasanah lama
    if (ckg_hardlock_wali && (
      ckg_hardlock_wali.namaWali === "NURHASANAH" ||
      ckg_hardlock_wali.nikWali === "5201095109900005" ||
      ckg_hardlock_wali.nikWali === "5201015807780005"
    )) {
      await chrome.storage.local.remove("ckg_hardlock_wali");
      if (hardlockWaliNik) hardlockWaliNik.value = "";
      if (hardlockWaliNama) hardlockWaliNama.value = "";
      if (hardlockWaliTglLahir) hardlockWaliTglLahir.value = "";
      if (hardlockWaliJk) hardlockWaliJk.value = "";
      if (hardlockWaliHp) hardlockWaliHp.value = "";
      updateHardlockWaliBadge(false);
      return;
    }

    if (ckg_hardlock_wali && typeof ckg_hardlock_wali === "object") {
      if (hardlockWaliNik) hardlockWaliNik.value = ckg_hardlock_wali.nikWali || "";
      if (hardlockWaliNama) hardlockWaliNama.value = ckg_hardlock_wali.namaWali || "";
      if (hardlockWaliTglLahir) hardlockWaliTglLahir.value = ckg_hardlock_wali.tglLahirWali || "";
      if (hardlockWaliJk) hardlockWaliJk.value = ckg_hardlock_wali.jkWali || "";
      if (hardlockWaliHp) hardlockWaliHp.value = ckg_hardlock_wali.noHpWali || "";
      const hasData = Boolean(ckg_hardlock_wali.nikWali || ckg_hardlock_wali.namaWali);
      updateHardlockWaliBadge(hasData);
    } else {
      updateHardlockWaliBadge(false);
    }
  } catch (e) {}
}

async function saveHardlockWaliToStorage(showToast = false) {
  const data = getHardlockWaliFromUI();
  const hasData = Boolean(data.nikWali || data.namaWali);
  
  const curCfg = await chrome.storage.local.get("ckg_config").then(r => r.ckg_config || {}).catch(() => ({}));
  curCfg.defaultNikWali = data.nikWali || "";
  curCfg.defaultNamaWali = data.namaWali || "";
  curCfg.defaultTanggalLahirWali = data.tglLahirWali || "";
  curCfg.defaultJenisKelaminWali = data.jkWali || "";
  curCfg.defaultNoHpWali = data.noHpWali || "";
  
  await chrome.storage.local.set({ ckg_hardlock_wali: data, ckg_config: curCfg }).catch(() => {});
  if (hardlockWaliSavedBadge) {
    hardlockWaliSavedBadge.textContent = "✓ Tersimpan";
    hardlockWaliSavedBadge.style.background = "#fde68a";
    setTimeout(() => {
      updateHardlockWaliBadge(hasData);
    }, 800);
  }
  if (showToast) {
    if (hasData) {
      appendLogToUI(`✓ Hardlock Data Wali disimpan: ${data.namaWali || '?'} (NIK: ${data.nikWali || '?'}, Tgl: ${data.tglLahirWali || '?'}, HP: ${data.noHpWali || '?'})`);
    } else {
      appendLogToUI(`ℹ Hardlock Data Wali dikosongkan (Wali diisi jika ada di file Excel / manual)`);
    }
  }

  // Jika ada antrean aktif, minta background pulihkan peserta yang sempat INVALID karena wali
  if (hasData && currentBatchId) {
    chrome.runtime.sendMessage({
      type: "RECOVER_WALI_INVALID_PARTICIPANTS",
      batchId: currentBatchId
    }).catch(() => {});
  }
}

[hardlockWaliNik, hardlockWaliNama, hardlockWaliTglLahir, hardlockWaliJk, hardlockWaliHp].forEach(el => {
  if (el) {
    el.addEventListener("change", () => saveHardlockWaliToStorage(false));
    el.addEventListener("input", () => {
      if (hardlockWaliSavedBadge) hardlockWaliSavedBadge.textContent = "⏳ Belum disimpan...";
    });
  }
});

btnSaveHardlockWali?.addEventListener("click", () => saveHardlockWaliToStorage(true));
loadHardlockWaliFromStorage();

// ==========================================
// HARDLOCK PEKERJAAN (CADANGAN OTOMATIS JIKA EXCEL KOSONG)
// ==========================================
const hardlockPekerjaanDefault = document.getElementById("hardlock-pekerjaan-default");
const hardlockPekerjaanPerempuan = document.getElementById("hardlock-pekerjaan-perempuan");
const hardlockPekerjaanAutoSmart = document.getElementById("hardlock-pekerjaan-auto-smart");
const btnSaveHardlockPekerjaan = document.getElementById("btn-save-hardlock-pekerjaan");
const hardlockPekerjaanSavedBadge = document.getElementById("hardlock-pekerjaan-saved-badge");

function getHardlockPekerjaanFromUI() {
  return {
    defaultPekerjaan: hardlockPekerjaanDefault?.value || "Belum/Tidak Bekerja",
    perempuanPekerjaan: hardlockPekerjaanPerempuan?.value || "Ibu Rumah Tangga",
    autoSmart: hardlockPekerjaanAutoSmart ? hardlockPekerjaanAutoSmart.checked : true
  };
}

async function loadHardlockPekerjaanFromStorage() {
  try {
    const { ckg_hardlock_pekerjaan } = await chrome.storage.local.get("ckg_hardlock_pekerjaan");
    if (ckg_hardlock_pekerjaan && typeof ckg_hardlock_pekerjaan === "object") {
      if (hardlockPekerjaanDefault && ckg_hardlock_pekerjaan.defaultPekerjaan) {
        hardlockPekerjaanDefault.value = ckg_hardlock_pekerjaan.defaultPekerjaan;
      }
      if (hardlockPekerjaanPerempuan && ckg_hardlock_pekerjaan.perempuanPekerjaan) {
        hardlockPekerjaanPerempuan.value = ckg_hardlock_pekerjaan.perempuanPekerjaan;
      }
      if (hardlockPekerjaanAutoSmart && typeof ckg_hardlock_pekerjaan.autoSmart === "boolean") {
        hardlockPekerjaanAutoSmart.checked = ckg_hardlock_pekerjaan.autoSmart;
      }
    } else {
      await chrome.storage.local.set({ ckg_hardlock_pekerjaan: getHardlockPekerjaanFromUI() });
    }
  } catch (e) {}
}

async function saveHardlockPekerjaanToStorage(showToast = false) {
  const data = getHardlockPekerjaanFromUI();
  await chrome.storage.local.set({ ckg_hardlock_pekerjaan: data }).catch(() => {});
  if (hardlockPekerjaanSavedBadge) {
    hardlockPekerjaanSavedBadge.textContent = "✓ Tersimpan";
    hardlockPekerjaanSavedBadge.style.background = "#bbf7d0";
    setTimeout(() => {
      if (hardlockPekerjaanSavedBadge) hardlockPekerjaanSavedBadge.style.background = "#dcfce7";
    }, 800);
  }
  if (showToast) {
    appendLogToUI(`💼 Hardlock Pekerjaan disimpan: Utama = ${data.defaultPekerjaan}, Perempuan = ${data.perempuanPekerjaan}`);
  }
}

[hardlockPekerjaanDefault, hardlockPekerjaanPerempuan, hardlockPekerjaanAutoSmart].forEach(el => {
  if (el) {
    el.addEventListener("change", () => saveHardlockPekerjaanToStorage(false));
    el.addEventListener("input", () => {
      if (hardlockPekerjaanSavedBadge) hardlockPekerjaanSavedBadge.textContent = "⏳ Belum disimpan...";
    });
  }
});

btnSaveHardlockPekerjaan?.addEventListener("click", () => saveHardlockPekerjaanToStorage(true));
loadHardlockPekerjaanFromStorage();

// Inisialisasi pengecekan lisensi saat sidepanel dimuat
syncAuthUI();


// Handler Buy Me Seblak -> Donate Here
document.querySelectorAll("#btn-donate-header, #btn-donate-link").forEach(el => {
  el?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL("donate.html") });
    } else {
      window.open("donate.html", "_blank");
    }
  });
});
