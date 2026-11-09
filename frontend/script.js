// script.js - Frontend Controller & PyWebView Two-Way Bridge
let currentPatients = [];
let masterModules = {};
let selectedModuleIds = new Set();
let isPipelineRunning = false;
let isPipelinePaused = false;
let auditedErrors = [];
let activeErrorFilter = "ALL";

// Global Frontend Error Interceptor (Reports any UI JS crashes to Backend Auditor)
window.onerror = function(message, source, lineno, colno, error) {
  const errPayload = {
    message: String(message),
    source: source || "script.js",
    lineno: lineno || 0,
    colno: colno || 0,
    stack: error && error.stack ? error.stack : ""
  };
  console.error("Caught Frontend UI Error:", errPayload);
  if (window.pywebview && window.pywebview.api && window.pywebview.api.record_frontend_error) {
    window.pywebview.api.record_frontend_error(errPayload);
  }
  return false;
};

window.addEventListener("unhandledrejection", function(event) {
  const errPayload = {
    message: event.reason ? String(event.reason.message || event.reason) : "Unhandled Promise Rejection",
    source: "Promise",
    stack: event.reason && event.reason.stack ? event.reason.stack : ""
  };
  if (window.pywebview && window.pywebview.api && window.pywebview.api.record_frontend_error) {
    window.pywebview.api.record_frontend_error(errPayload);
  }
});

// Initialize when DOM and PyWebView are ready
document.addEventListener("DOMContentLoaded", () => {
  setupNavigationTabs();
  setupEventListeners();
  setupErrorAuditListeners();

  // Wait for pywebviewready event
  if (window.pywebview) {
    onPyWebViewReady();
  } else {
    window.addEventListener("pywebviewready", onPyWebViewReady);
  }
});

function onPyWebViewReady() {
  console.log("PyWebView Bridge is ready.");
  addTerminalLog("INFO", "Terhubung dengan Python Backend Architecture.");

  // Fetch initial master modules catalog
  if (window.pywebview.api.get_master_modules_catalog) {
    window.pywebview.api.get_master_modules_catalog().then(catalog => {
      masterModules = catalog;
      renderModulesGrid(masterModules);
    });
  }

  // Fetch existing error audits if any
  if (window.pywebview.api.get_error_audits) {
    window.pywebview.api.get_error_audits().then(errors => {
      auditedErrors = errors || [];
      updateErrorBadge();
      renderErrorAuditList(activeErrorFilter);
    });
  }

  // Check login status on launch
  checkLoginStatus();
}

// -------------------------------------------------------------
// NAVIGATION TABS
// -------------------------------------------------------------
function setupNavigationTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      navItems.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTabId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// -------------------------------------------------------------
// EVENT LISTENERS
// -------------------------------------------------------------
function setupEventListeners() {
  // File Dialog
  document.getElementById("btn-select-file").addEventListener("click", () => {
    const formatType = document.querySelector('input[name="format-type"]:checked')?.value || "AUTO";
    if (window.pywebview && window.pywebview.api.select_excel_dialog) {
      addTerminalLog("INFO", `Membuka dialog file Excel (Kategori: ${formatType})...`);
      window.pywebview.api.select_excel_dialog(formatType).then(handleExcelResponse);
    }
  });

  // Clear Queue
  document.getElementById("btn-clear-queue").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.clear_queue) {
      window.pywebview.api.clear_queue().then(() => {
        currentPatients = [];
        renderPatientsTable([]);
        updateStats({ total: 0, completed: 0, ready: 0, balita: 0, dewasa: 0, lansia: 0 });
        document.getElementById("stat-file-name").textContent = "Belum ada file Excel";
        document.getElementById("selected-path-text").textContent = "Antrean berhasil dibersihkan.";
      });
    }
  });

  // Table Search Filter
  document.getElementById("search-patient").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderPatientsTable(currentPatients);
      return;
    }
    const filtered = currentPatients.filter(p =>
      (p.nama || "").toLowerCase().includes(q) ||
      (p.nik || "").toLowerCase().includes(q) ||
      (p.tiket || "").toLowerCase().includes(q)
    );
    renderPatientsTable(filtered);
  });

  // Module Category Filter Pills
  document.querySelectorAll("#category-filter-pills .pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#category-filter-pills .pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const filter = pill.getAttribute("data-filter");
      renderModulesGrid(masterModules, filter);
    });
  });

  // Select / Deselect All Modules
  document.getElementById("btn-select-all-modules").addEventListener("click", () => {
    Object.keys(masterModules).forEach(id => selectedModuleIds.add(id));
    updateModuleCheckboxes();
  });

  document.getElementById("btn-deselect-all-modules").addEventListener("click", () => {
    selectedModuleIds.clear();
    updateModuleCheckboxes();
  });

  // Browser Controls
  document.getElementById("btn-open-browser").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.launch_stealth_browser) {
      window.pywebview.api.launch_stealth_browser().then(res => {
        if (res.success) addTerminalLog("SUCCESS", res.message);
        else addTerminalLog("ERROR", res.error);
      });
    }
  });

  document.getElementById("btn-goto-login").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.open_portal_login) {
      window.pywebview.api.open_portal_login().then(res => {
        addTerminalLog("INFO", res.message);
      });
    }
  });

  document.getElementById("btn-check-login").addEventListener("click", checkLoginStatus);

  // Pipeline Execution Controls
  document.getElementById("btn-run-all").addEventListener("click", () => {
    if (!currentPatients.length) {
      alert("Antrean pasien masih kosong! Silakan pilih file Excel terlebih dahulu.");
      return;
    }
    const moduleList = Array.from(selectedModuleIds);
    if (window.pywebview && window.pywebview.api.start_automation_pipeline) {
      window.pywebview.api.start_automation_pipeline(moduleList).then(res => {
        if (res.success) {
          isPipelineRunning = true;
          isPipelinePaused = false;
          updateControlButtonsState();
          addTerminalLog("SUCCESS", "Pipeline otomatisasi dijalankan.");
        } else {
          alert(res.error);
        }
      });
    }
  });

  document.getElementById("btn-pause-pipeline").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.pause_pipeline) {
      window.pywebview.api.pause_pipeline().then(() => {
        isPipelinePaused = true;
        updateControlButtonsState();
      });
    }
  });

  document.getElementById("btn-resume-pipeline").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.resume_pipeline) {
      window.pywebview.api.resume_pipeline().then(() => {
        isPipelinePaused = false;
        updateControlButtonsState();
      });
    }
  });

  document.getElementById("btn-stop-pipeline").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.stop_pipeline) {
      window.pywebview.api.stop_pipeline().then(() => {
        isPipelineRunning = false;
        isPipelinePaused = false;
        updateControlButtonsState();
      });
    }
  });

  // Clear Terminal Logs
  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    const screen = document.getElementById("terminal-screen");
    screen.innerHTML = "";
    if (window.pywebview && window.pywebview.api.clear_logs) {
      window.pywebview.api.clear_logs();
    }
  });
}

function updateControlButtonsState() {
  const btnRun = document.getElementById("btn-run-all");
  const btnPause = document.getElementById("btn-pause-pipeline");
  const btnResume = document.getElementById("btn-resume-pipeline");
  const btnStop = document.getElementById("btn-stop-pipeline");

  if (!isPipelineRunning) {
    btnRun.style.display = "inline-flex";
    btnPause.style.display = "none";
    btnResume.style.display = "none";
    btnStop.style.display = "none";
  } else if (isPipelinePaused) {
    btnRun.style.display = "none";
    btnPause.style.display = "none";
    btnResume.style.display = "inline-flex";
    btnStop.style.display = "inline-flex";
  } else {
    btnRun.style.display = "none";
    btnPause.style.display = "inline-flex";
    btnResume.style.display = "none";
    btnStop.style.display = "inline-flex";
  }
}

// -------------------------------------------------------------
// EXCEL INGESTION HANDLER
// -------------------------------------------------------------
function handleExcelResponse(res) {
  if (!res || res.cancelled) return;
  if (!res.success) {
    alert("Gagal membaca Excel: " + res.error);
    addTerminalLog("ERROR", res.error);
    return;
  }

  currentPatients = res.patients || [];
  document.getElementById("stat-file-name").textContent = res.file_name;
  document.getElementById("selected-path-text").textContent = `File aktif: ${res.file_name} (${res.patients.length} baris data)`;

  updateStats(res.stats);
  renderPatientsTable(currentPatients);
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById("stat-total").textContent = stats.total || 0;
  document.getElementById("stat-completed").textContent = stats.completed || 0;
  document.getElementById("stat-ready").textContent = stats.ready || 0;
  document.getElementById("stat-balita").textContent = `Balita: ${stats.balita || 0}`;
  document.getElementById("stat-dewasa").textContent = `Dewasa: ${stats.dewasa || 0}`;
  document.getElementById("stat-lansia").textContent = `Lansia: ${stats.lansia || 0}`;
}

// -------------------------------------------------------------
// PATIENT TABLE RENDERING
// -------------------------------------------------------------
function renderPatientsTable(patients) {
  const tbody = document.getElementById("patients-tbody");
  tbody.innerHTML = "";

  if (!patients || !patients.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Tidak ada data pasien yang cocok.</td></tr>';
    return;
  }

  patients.forEach((p, idx) => {
    const tr = document.createElement("tr");

    // Lifecycle chip
    const chipClass = `chip-${(p.siklus_hidup || "dewasa").toLowerCase()}`;

    // Clinical measurements string
    const klinisParts = [];
    if (p.bb) klinisParts.push(`${p.bb}kg`);
    if (p.tb) klinisParts.push(`${p.tb}cm`);
    if (p.td_sistolik && p.td_diastolik) klinisParts.push(`${p.td_sistolik}/${p.td_diastolik}`);
    const klinisText = klinisParts.length ? klinisParts.join(" • ") : "—";

    // Status Pill
    const statusLower = (p.status || "ready").toLowerCase();
    const statusPillClass = `status-${statusLower}`;

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <strong style="color: #0f172a;">${p.nama || "—"}</strong>
        <div style="font-size: 11px; color: #64748b;">NIK: ${p.nik || "—"}</div>
      </td>
      <td>
        <div>${p.tanggal_lahir || "—"}</div>
        <div style="font-size: 11px; color: #64748b;">${p.usia_teks || ""}</div>
      </td>
      <td><code>${p.tiket || "—"}</code></td>
      <td>${p.nama_wali || "—"}</td>
      <td><span class="chip ${chipClass}">${p.siklus_hidup}</span></td>
      <td><span style="font-size: 11px; font-weight: 500;">${klinisText}</span></td>
      <td><span style="font-size: 11px; color: #64748b;">${p.status_mandiri || "Belum"}</span></td>
      <td><span class="status-pill ${statusPillClass}">${p.status}</span></td>
      <td>
        <button class="btn btn-sm btn-outline btn-run-single" data-index="${idx}" title="Suntik Pasien Ini">
          ▶ Suntik
        </button>
      </td>
    `;

    // Single run event
    tr.querySelector(".btn-run-single")?.addEventListener("click", () => {
      runSinglePatientByIndex(idx);
    });

    tbody.appendChild(tr);
  });
}

function runSinglePatientByIndex(patientIndex) {
  if (isPipelineRunning) {
    alert("Pipeline sedang berjalan.");
    return;
  }
  const moduleList = Array.from(selectedModuleIds);
  if (window.pywebview && window.pywebview.api.run_single_patient) {
    window.pywebview.api.run_single_patient(patientIndex, moduleList).then(res => {
      if (res.success) {
        isPipelineRunning = true;
        updateControlButtonsState();
        addTerminalLog("INFO", res.message);
      } else {
        alert(res.error);
      }
    });
  }
}

// -------------------------------------------------------------
// MODULES GRID & SELECTION
// -------------------------------------------------------------
function renderModulesGrid(catalog, categoryFilter = "ALL") {
  const container = document.getElementById("modules-container");
  container.innerHTML = "";

  Object.values(catalog).forEach(mod => {
    if (categoryFilter !== "ALL" && mod.category !== categoryFilter) return;

    if (mod.default_checked && !selectedModuleIds.has(mod.id)) {
      selectedModuleIds.add(mod.id);
    }

    const card = document.createElement("div");
    card.className = "module-card";
    const isChecked = selectedModuleIds.has(mod.id) ? "checked" : "";
    const catClass = `chip-${mod.category.toLowerCase()}`;

    card.innerHTML = `
      <input type="checkbox" id="chk-${mod.id}" ${isChecked} data-id="${mod.id}">
      <div class="module-info">
        <label for="chk-${mod.id}" style="cursor: pointer;">
          <h4>${mod.name}</h4>
        </label>
        <p>${mod.description}</p>
        <span class="chip ${catClass}">${mod.category}</span>
      </div>
    `;

    card.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
      if (e.target.checked) selectedModuleIds.add(mod.id);
      else selectedModuleIds.delete(mod.id);
    });

    container.appendChild(card);
  });
}

function updateModuleCheckboxes() {
  document.querySelectorAll('.module-card input[type="checkbox"]').forEach(chk => {
    const id = chk.getAttribute("data-id");
    chk.checked = selectedModuleIds.has(id);
  });
}

// -------------------------------------------------------------
// STEPPER PROGRESS UPDATER
// -------------------------------------------------------------
function updateStepper(stage) {
  const steps = [
    document.getElementById("step-node-1"),
    document.getElementById("step-node-2"),
    document.getElementById("step-node-3"),
    document.getElementById("step-node-4")
  ];

  steps.forEach(s => {
    if (s) {
      s.classList.remove("active");
      s.classList.remove("completed");
    }
  });

  const stageOrder = {
    "START": 1,
    "STEP_1_TABLE": 1,
    "STEP_2_CALENDAR": 2,
    "STEP_3_INJECTION": 3,
    "STEP_4_FINALIZE": 4,
    "DONE": 5
  };

  const currentLevel = stageOrder[stage] || 1;

  steps.forEach((node, idx) => {
    if (!node) return;
    const stepIdx = idx + 1;
    if (stepIdx < currentLevel) {
      node.classList.add("completed");
    } else if (stepIdx === currentLevel) {
      node.classList.add("active");
    }
  });
}

// -------------------------------------------------------------
// BROWSER & LOGIN STATUS
// -------------------------------------------------------------
function checkLoginStatus() {
  if (window.pywebview && window.pywebview.api.check_login_status) {
    window.pywebview.api.check_login_status().then(res => {
      const icon = document.getElementById("login-status-icon");
      const title = document.getElementById("login-status-title");
      const desc = document.getElementById("login-status-desc");

      if (res.logged_in) {
        icon.textContent = "🔓";
        title.textContent = "Status Login: Terverifikasi (Nakes Aktif)";
        desc.textContent = "Sesi aktif di portal Sehat Indonesiaku. Pipeline siap menyuntikkan data.";
        addTerminalLog("SUCCESS", "Sesi login terverifikasi aktif.");
      } else {
        icon.textContent = "🔒";
        title.textContent = "Status Login: Belum Login";
        desc.textContent = "Buka browser dan login manual di sehatindonesiaku.kemkes.go.id terlebih dahulu.";
      }
    });
  }
}

// -------------------------------------------------------------
// REAL-TIME TERMINAL LOGS & DOM DISPATCHER
// -------------------------------------------------------------
window.onBackendLog = function(logEntry) {
  addTerminalLog(logEntry.level, logEntry.message, logEntry.time);
};

window.onPipelineUpdate = function(updateData) {
  const patient = updateData.patient;
  const stage = updateData.stage;

  if (patient) {
    // Find patient in list and update status
    const target = currentPatients.find(p => p.id === patient.id || p.nik === patient.nik);
    if (target) {
      target.status = patient.status;
      renderPatientsTable(currentPatients);
    }
  }

  updateStepper(stage);

  if (stage === "DONE" && !updateData.is_running) {
    // Check if entire queue finished
    const allDone = currentPatients.every(p => p.status === "COMPLETED" || p.status === "ERROR");
    if (allDone) {
      isPipelineRunning = false;
      updateControlButtonsState();
      addTerminalLog("SUCCESS", "Semua antrean pasien dalam batch telah selesai diproses.");
    }
  }
};

function addTerminalLog(level, message, timeStr = null) {
  const screen = document.getElementById("terminal-screen");
  if (!screen) return;

  const now = timeStr || new Date().toLocaleTimeString();
  const row = document.createElement("div");
  const levelClass = (level || "info").toLowerCase();
  row.className = `log-row ${levelClass}`;

  row.innerHTML = `
    <span class="log-time">[${now}]</span>
    <span class="log-badge ${levelClass}">${level}</span>
    <span class="log-text">${escapeHtml(message)}</span>
  `;

  screen.appendChild(row);
  screen.scrollTop = screen.scrollHeight;
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -------------------------------------------------------------
// ERROR AUDITING & SMART DIAGNOSTIC READER UI LOGIC
// -------------------------------------------------------------
function setupErrorAuditListeners() {
  // Error Filter Pills
  document.querySelectorAll("#error-filter-pills .pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#error-filter-pills .pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeErrorFilter = pill.getAttribute("data-filter");
      renderErrorAuditList(activeErrorFilter);
    });
  });

  // Export Error Audit Report
  document.getElementById("btn-export-errors")?.addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api.export_error_audit_report) {
      window.pywebview.api.export_error_audit_report().then(res => {
        if (res.success) {
          alert("Laporan audit berhasil diekspor ke:\n" + res.file_path);
          addTerminalLog("SUCCESS", "Laporan audit error diekspor: " + res.file_path);
        } else {
          alert("Gagal mengekspor laporan: " + res.error);
        }
      });
    }
  });

  // Clear Error Audits
  document.getElementById("btn-clear-error-audits")?.addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin membersihkan seluruh rekaman audit error?")) {
      if (window.pywebview && window.pywebview.api.clear_error_audits) {
        window.pywebview.api.clear_error_audits().then(() => {
          auditedErrors = [];
          updateErrorBadge();
          renderErrorAuditList(activeErrorFilter);
          addTerminalLog("INFO", "Seluruh riwayat audit error telah dibersihkan.");
        });
      }
    }
  });
}

// Real-Time Callback from Python Backend
window.onErrorAudited = function(errorEntry) {
  auditedErrors.unshift(errorEntry); // Newest first
  updateErrorBadge();
  renderErrorAuditList(activeErrorFilter);

  // Also print an error log entry in terminal
  addTerminalLog("ERROR", `[AUDIT ${errorEntry.id}][${errorEntry.source}] ${errorEntry.message}`);
};

function updateErrorBadge() {
  const badge = document.getElementById("error-badge-count");
  const countEl = document.getElementById("count-all-errors");
  const count = auditedErrors.length;

  if (countEl) countEl.textContent = count;
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
}

function renderErrorAuditList(filter = "ALL") {
  const container = document.getElementById("error-audit-list");
  if (!container) return;

  const filtered = auditedErrors.filter(err => {
    if (filter === "ALL") return true;
    if (filter === "BROWSER") return err.source.includes("BROWSER");
    if (filter === "PYTHON") return err.source.includes("PYTHON");
    return err.source === filter;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-error-state">
        <div class="empty-icon">✓</div>
        <h4>Tidak Ada Error Tercatat (${filter})</h4>
        <p>Seluruh subsistem yang dipantau berjalan dengan normal tanpa galat terdeteksi.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(err => {
    const diag = err.diagnosis || {};
    const sourceClass = `source-${err.source.toLowerCase()}`;

    let techTraceHtml = "";
    if (err.trace) {
      techTraceHtml = `
        <details class="trace-details">
          <summary>🔍 Lihat Stack Trace Teknis & Konteks Sistem</summary>
          <pre>${escapeHtml(err.trace)}</pre>
        </details>
      `;
    }

    return `
      <div class="error-item-card">
        <div class="error-item-header">
          <div class="error-header-left">
            <span class="error-id-tag">${err.id}</span>
            <span class="error-source-badge ${sourceClass}">${err.source}</span>
          </div>
          <span class="error-timestamp">${err.timestamp}</span>
        </div>

        <div class="error-message-text">${escapeHtml(err.message)}</div>

        <!-- Pembaca Error (Diagnosa Cerdas) -->
        <div class="diagnostic-reader-box">
          <div class="diag-row">
            <span class="diag-icon">📍</span>
            <span class="diag-title">Lokasi Terjadinya:</span>
            <span class="diag-desc">${escapeHtml(diag.lokasi || "Sistem CKG")}</span>
          </div>
          <div class="diag-row">
            <span class="diag-icon">🔍</span>
            <span class="diag-title">Akar Masalah:</span>
            <span class="diag-desc">${escapeHtml(diag.akar_masalah || "Kesalahan teknis internal")}</span>
          </div>
          <div class="diag-row solusi">
            <span class="diag-icon">💡</span>
            <span class="diag-title">Rekomendasi Tindakan:</span>
            <span class="diag-desc">${escapeHtml(diag.solusi || "Periksa konfigurasi data dan jaringan")}</span>
          </div>
        </div>

        ${techTraceHtml}
      </div>
    `;
  }).join("");
}
