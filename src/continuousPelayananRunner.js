/**
 * CONTINUOUS PELAYANAN RUNNER (CKG)
 * Mode: Mandiri, Terus-Menerus (Continuous), Tanpa Ambil Antrean Manual, Lock Tanggal, Paginasi Halaman
 * Meniru keunggulan FAB Start Android CKG V2 & Universal Pelayanan Runner
 */

(function () {
  if (window.__ckgContinuousRunnerLoaded) return;
  window.__ckgContinuousRunnerLoaded = true;

  const INDO_MONTHS = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7, agt: 7, aug: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function log(msg, color = "#16B3AC") {
    const timestamp = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    console.log(`%c[Continuous Runner ${timestamp}] ${msg}`, `color: ${color}; font-weight: bold;`);
    try {
      chrome.runtime.sendMessage({
        type: "AUTO_RUNNER_LOG",
        message: msg
      }).catch(() => {});
    } catch (e) {}
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function safeClick(el) {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const events = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    events.forEach(evName => {
      el.dispatchEvent(new MouseEvent(evName, { bubbles: true, cancelable: true, view: window }));
    });
    return true;
  }

  function setInputValue(input, value) {
    if (!input) return;
    input.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  async function waitFor(predicate, timeout = 10000, interval = 250, errorMsg = "Timeout") {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (window.__ckgRunnerStopRequested) throw new Error("Runner dihentikan oleh pengguna");
      try {
        const res = predicate();
        if (res) return res;
      } catch (e) {}
      await sleep(interval);
    }
    throw new Error(errorMsg);
  }

  // ===========================================================================
  // 1. SIKLUS HIDUP & GENERATOR NILAI NORMAL (STANDAR KEMENKES)
  // ===========================================================================
  function parseAgeInYears(str) {
    if (!str) return null;
    const cleanStr = str.replace(/\s+/g, " ").trim().toLowerCase();
    const directAge = cleanStr.match(/(\d+)\s*th/);
    if (directAge) return parseInt(directAge[1], 10);

    let birthDate = null;
    const dmy = cleanStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      birthDate = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    } else {
      const namedMonth = cleanStr.match(/(\d{1,2})\s*([a-z]+)\s*(\d{4})/);
      if (namedMonth) {
        const d = parseInt(namedMonth[1], 10);
        const mKey = namedMonth[2].toLowerCase();
        const y = parseInt(namedMonth[3], 10);
        const m = INDO_MONTHS[mKey] ?? 0;
        birthDate = new Date(y, m, d);
      } else {
        const parsed = Date.parse(cleanStr);
        if (!Number.isNaN(parsed)) birthDate = new Date(parsed);
      }
    }

    if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      years--;
    }
    return Math.max(0, years);
  }

  function detectPatientLifeCycle(knownTglLahir = null) {
    const bodyText = (document.body.innerText || "").toLowerCase();
    const headerEl = document.querySelector(".header-identitas, .identitas-pasien, .card-pasien, header, .content-header") || document.body;
    const headerText = (headerEl.innerText || "").toLowerCase();

    let gender = "L";
    if (/perempuan|\bwanita\b|\bpr\b/i.test(headerText)) gender = "P";
    else if (/laki-laki|\bpria\b|\blk\b/i.test(headerText)) gender = "L";
    else if (/perempuan|\bwanita\b/i.test(bodyText)) gender = "P";

    let cycle = null;
    let detectedAge = null;
    if (/balita|bayi|baduta/i.test(headerText)) cycle = "BALITA";
    else if (/lansia|geriatri/i.test(headerText)) cycle = "LANSIA";
    else if (/remaja|sekolah|\bsd\b|\bsmp\b|\bsma\b/i.test(headerText)) cycle = "REMAJA";
    else if (/dewasa|produktif/i.test(headerText)) cycle = "DEWASA";

    const tglToParse = knownTglLahir || headerText;
    const age = parseAgeInYears(tglToParse);
    if (age !== null) {
      detectedAge = age;
      if (age < 6) cycle = "BALITA";
      else if (age < 18) cycle = "REMAJA";
      else if (age < 60) cycle = "DEWASA";
      else cycle = "LANSIA";
    }

    if (!cycle) cycle = "DEWASA";
    return { cycle, gender, age: detectedAge };
  }

  function generateNormalData(cycle, gender) {
    const isFemale = gender === "P";
    if (cycle === "BALITA") {
      const tb = Math.floor(Math.random() * (105 - 75 + 1)) + 75;
      const bb = parseFloat((Math.random() * (16.0 - 9.5) + 9.5).toFixed(1));
      const lk = parseFloat((Math.random() * (50.0 - 45.0) + 45.0).toFixed(1));
      const lila = parseFloat((Math.random() * (16.0 - 13.0) + 13.0).toFixed(1));
      return { tb, bb, lk, lila, gender: isFemale ? "P" : "L", cycle };
    }
    if (cycle === "REMAJA") {
      const tb = Math.floor(Math.random() * (165 - 145 + 1)) + 145;
      const imt = Math.random() * (21.0 - 16.5) + 16.5;
      const bb = parseFloat((imt * Math.pow(tb / 100, 2)).toFixed(1));
      const lp = isFemale ? Math.floor(Math.random() * (72 - 58 + 1)) + 58 : Math.floor(Math.random() * (78 - 62 + 1)) + 62;
      const sistolik = Math.floor(Math.random() * (118 - 100 + 1)) + 100;
      const diastolik = Math.floor(Math.random() * (78 - 64 + 1)) + 64;
      const gds = Math.floor(Math.random() * (120 - 85 + 1)) + 85;
      return { tb, bb, lp, sistolik, diastolik, gds, gender: isFemale ? "P" : "L", cycle };
    }
    if (cycle === "LANSIA") {
      const tb = Math.floor(Math.random() * (165 - 150 + 1)) + 150;
      const imt = Math.random() * (24.5 - 20.0) + 20.0;
      const bb = parseFloat((imt * Math.pow(tb / 100, 2)).toFixed(1));
      const lp = isFemale ? Math.floor(Math.random() * (77 - 65 + 1)) + 65 : Math.floor(Math.random() * (86 - 72 + 1)) + 72;
      const sistolik = Math.floor(Math.random() * (128 - 110 + 1)) + 110;
      const diastolik = Math.floor(Math.random() * (82 - 70 + 1)) + 70;
      const gds = Math.floor(Math.random() * (135 - 95 + 1)) + 95;
      return { tb, bb, lp, sistolik, diastolik, gds, gender: isFemale ? "P" : "L", cycle };
    }
    // DEWASA
    const tb = isFemale ? Math.floor(Math.random() * (163 - 148 + 1)) + 148 : Math.floor(Math.random() * (175 - 158 + 1)) + 158;
    const imt = Math.random() * (24.0 - 19.5) + 19.5;
    const bb = parseFloat((imt * Math.pow(tb / 100, 2)).toFixed(1));
    const lp = isFemale ? Math.floor(Math.random() * (78 - 65 + 1)) + 65 : Math.floor(Math.random() * (88 - 75 + 1)) + 75;
    const sistolik = Math.floor(Math.random() * (125 - 110 + 1)) + 110;
    const diastolik = Math.floor(Math.random() * (82 - 70 + 1)) + 70;
    const gds = Math.floor(Math.random() * (130 - 85 + 1)) + 85;
    return { tb, bb, lp, sistolik, diastolik, gds, gender: isFemale ? "P" : "L", cycle };
  }

  // ===========================================================================
  // 2. MODAL FORM & ACCORDION HELPERS
  // ===========================================================================
  function findActiveModal() {
    const candidates = Array.from(document.querySelectorAll("div, section, form, [role='dialog']")).filter(el => {
      if (!isVisible(el)) return false;
      const cls = el.className || "";
      const style = window.getComputedStyle(el);
      const isOverlay = /modal|dialog|popup|z-2000|z-1000|fixed|absolute/i.test(cls) || (style.position === "fixed" && parseInt(style.zIndex, 10) > 50);
      const hasSimpan = Array.from(el.querySelectorAll("button")).some(b => /simpan|kirim|konfirmasi/i.test(b.textContent || ""));
      return isOverlay && hasSimpan;
    });
    return candidates.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0] || null;
  }

  function findModalInput(modal, keywords) {
    const inputs = Array.from(modal.querySelectorAll("input:not([type='hidden']):not([type='radio']):not([type='checkbox'])"));
    for (const kw of keywords) {
      const match = inputs.find(i => {
        const id = (i.id || "").toLowerCase();
        const name = (i.name || "").toLowerCase();
        const placeholder = (i.placeholder || "").toLowerCase();
        return id.includes(kw) || name.includes(kw) || placeholder.includes(kw);
      });
      if (match) return match;
    }
    const formGroups = Array.from(modal.querySelectorAll(".form-group, .mb-4, div"));
    for (const kw of keywords) {
      const grp = formGroups.find(g => {
        const label = g.querySelector("label, .form-label, span");
        return label && label.textContent.toLowerCase().includes(kw);
      });
      if (grp) {
        const inp = grp.querySelector("input:not([type='hidden'])");
        if (inp) return inp;
      }
    }
    return null;
  }

  async function expandAllAccordions() {
    const headers = Array.from(document.querySelectorAll(".accordion-header, [class*='accordion'] [class*='header'], [id^='heading']"));
    for (const h of headers) {
      if (isVisible(h) && (h.classList.contains("collapsed") || h.getAttribute("aria-expanded") === "false")) {
        safeClick(h);
        await sleep(150);
      }
    }
  }

  async function closeActiveModal(modal) {
    if (!modal) return;
    const btnSimpan = Array.from(modal.querySelectorAll("button")).find(b => {
      if (!isVisible(b) || b.disabled) return false;
      const txt = (b.textContent || "").trim().toLowerCase();
      return /simpan|kirim|konfirmasi/i.test(txt) && !txt.includes("kembali") && !txt.includes("batal");
    });
    if (btnSimpan) {
      safeClick(btnSimpan);
      await sleep(1200);
    }
  }

  // ===========================================================================
  // 3. PENGISIAN FORMULIR PEMERIKSAAN & FINALISASI LAYANAN
  // ===========================================================================
  async function fillAllPatientForms(knownTglLahir = null) {
    log("Mendeteksi identitas pasien & siklus hidup...");
    const { cycle, gender, age } = detectPatientLifeCycle(knownTglLahir);
    const data = generateNormalData(cycle, gender);
    log(`Pasien: Siklus=${cycle} (Usia ~${age !== null ? age : '?'} thn), Gender=${gender}`);
    log(`Nilai Normal Fisiologis: TB=${data.tb}cm, BB=${data.bb}kg, LP=${data.lp || '-'}cm, TD=${data.sistolik ? `${data.sistolik}/${data.diastolik}` : '-'}`);

    await expandAllAccordions();
    await sleep(600);

    const getPendingRows = () => {
      const allRows = Array.from(document.querySelectorAll("tr, div[id^='rowfrm'], div.w-full.grid"));
      return allRows.filter(row => {
        if (!isVisible(row)) return false;
        const txt = (row.textContent || "").toLowerCase();
        if (txt.includes("sudah pemeriksaan") || txt.includes("selesai")) return false;
        const btn = Array.from(row.querySelectorAll("button")).find(b =>
          /input\s*data/i.test(b.textContent || "") && isVisible(b) && !b.disabled && !b.classList.contains("cursor-not-allowed")
        );
        return !!btn;
      });
    };

    let pendingRows = getPendingRows();
    log(`Ditemukan ${pendingRows.length} form pemeriksaan yang belum terisi.`);

    for (let i = 0; i < pendingRows.length; i++) {
      if (window.__ckgRunnerStopRequested) throw new Error("Runner dihentikan");
      const rowsNow = getPendingRows();
      if (!rowsNow.length) break;

      const currentRow = rowsNow[0];
      const rowTitle = (currentRow.textContent || "").replace(/\s+/g, " ").trim().slice(0, 45);
      const btnInput = Array.from(currentRow.querySelectorAll("button")).find(b => /input\s*data/i.test(b.textContent || ""));
      if (!btnInput) continue;

      log(`[Form ${i + 1}] Membuka: "${rowTitle}"...`);
      safeClick(btnInput);

      const modal = await waitFor(findActiveModal, 8000, 250).catch(() => null);
      if (!modal) {
        log(`Modal untuk "${rowTitle}" tidak muncul, lewati.`);
        continue;
      }
      await sleep(500);

      const mText = (modal.textContent || "").toLowerCase();
      const inputs = Array.from(modal.querySelectorAll("input:not([type='hidden']):not([type='radio']):not([type='checkbox'])"));

      // 1. Antropometri / Gizi
      if (mText.includes("berat badan") || mText.includes("tinggi badan") || mText.includes("lingkar") || mText.includes("gizi")) {
        const inpBB = findModalInput(modal, ["berat badan", "bb", "weight", "65"]) || inputs[0];
        const inpTB = findModalInput(modal, ["tinggi badan", "panjang badan", "tb", "pb", "height", "170"]) || inputs[1];
        const inpLP = findModalInput(modal, ["lingkar perut", "lp", "85"]);
        const inpLK = findModalInput(modal, ["lingkar kepala", "lk"]);
        const inpLILA = findModalInput(modal, ["lingkar lengan", "lila"]);

        if (inpBB && data.bb) { setInputValue(inpBB, data.bb); await sleep(120); }
        if (inpTB && data.tb) { setInputValue(inpTB, data.tb); await sleep(120); }
        if (inpLP && data.lp) { setInputValue(inpLP, data.lp); await sleep(120); }
        if (inpLK && data.lk) { setInputValue(inpLK, data.lk); await sleep(120); }
        if (inpLILA && data.lila) { setInputValue(inpLILA, data.lila); await sleep(120); }
      }
      // 2. Tekanan Darah
      else if (mText.includes("sistol") || mText.includes("diastol") || mText.includes("tekanan darah")) {
        const inpSistol = findModalInput(modal, ["sistol", "systol", "120"]) || inputs[0];
        const inpDiastol = findModalInput(modal, ["diastol", "80"]) || inputs[1];
        if (inpSistol && data.sistolik) { setInputValue(inpSistol, data.sistolik); await sleep(120); }
        if (inpDiastol && data.diastolik) { setInputValue(inpDiastol, data.diastolik); await sleep(120); }
      }
      // 3. Gula Darah / Laboratorium
      else if (mText.includes("gula darah") || mText.includes("gds") || mText.includes("glukosa")) {
        const inpGDS = findModalInput(modal, ["gula darah", "gds", "sewaktu", "100"]) || inputs[0];
        if (inpGDS && data.gds) { setInputValue(inpGDS, data.gds); await sleep(120); }
      }

      // 4. Kuesioner Radio / Default SurveyJS
      const radioLabels = Array.from(modal.querySelectorAll(".sd-item__control-label, label, span")).filter(el => isVisible(el));
      const normalRadio = radioLabels.find(el => {
        const t = (el.textContent || "").trim().toLowerCase();
        return t === "tidak" || t === "normal" || t === "mandiri" || t === "benar semua" || t === "sesuai" || t === "cukup";
      });
      if (normalRadio) {
        safeClick(normalRadio);
        await sleep(150);
      }

      await closeActiveModal(modal);
      await sleep(500);
    }

    log("Seluruh formulir pemeriksaan selesai diisi.");
    return { ok: true, data };
  }

  async function finalizeLayanan() {
    log("Memulai finalisasi: Selesaikan Layanan...");
    await sleep(800);

    const findBtnSelesaikan = () => {
      const byClass = Array.from(document.querySelectorAll("button.btn-outline-error, [class*='btn-outline-error'], button.border-red-500, button[class*='error']"));
      const hitClass = byClass.find(b => {
        const txt = (b.textContent || "").trim().toLowerCase();
        return /selesai\w*\s*layanan/i.test(txt) && !txt.includes("tata") && !txt.includes("laksana") && isVisible(b) && !b.disabled;
      });
      if (hitClass) return hitClass;

      const allEls = Array.from(document.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, div"));
      return allEls.find(b => {
        if (!isVisible(b) || b.disabled) return false;
        const txt = (b.textContent || "").trim().toLowerCase();
        if (/selesai\w*\s*layanan/i.test(txt) && !txt.includes("tata") && !txt.includes("laksana")) {
          return b.children.length <= 3;
        }
        return false;
      }) || null;
    };

    const btnSelesaikan = await waitFor(findBtnSelesaikan, 15000, 300, "Tombol 'Selesaikan Layanan' tidak ditemukan");
    log("Mengklik 'Selesaikan Layanan'...");
    const targetSelesai = btnSelesaikan.closest("button") || btnSelesaikan;
    safeClick(targetSelesai);

    log("Menunggu konfirmasi simpan...");
    const btnKonfirmasi = await waitFor(() => {
      const allBtns = Array.from(document.querySelectorAll("button.btn-fill-primary, button[class*='btn-fill-primary'], .btn-fill-primary, button"));
      return allBtns.find(b => {
        if (!isVisible(b) || b.disabled || b.classList.contains("disabled")) return false;
        const t = (b.textContent || "").trim().toLowerCase();
        return (t === "konfirmasi" || t.startsWith("konfirmasi") || t.includes("ya") || /selesai\w*\s*layanan/i.test(t)) && !t.includes("kembali") && !t.includes("batal");
      }) || null;
    }, 12000, 250, "Tombol 'Konfirmasi' modal kunci tidak ditemukan");

    safeClick(btnKonfirmasi);
    log("Konfirmasi penguncian data berhasil diklik. Menunggu penyelesaian...");
    await sleep(2500);

    return { ok: true };
  }

  async function executePatientDetailPipeline(knownTglLahir = null) {
    log("Menunggu halaman detail pemeriksaan termuat...");
    await sleep(1000);

    // Cek jika ada tombol "Mulai Pemeriksaan" di detail
    const btnMulai = Array.from(document.querySelectorAll("button")).find(b => {
      if (!isVisible(b) || b.disabled) return false;
      const txt = (b.textContent || "").trim();
      return /mulai\s*pemeriksaan/i.test(txt);
    });

    if (btnMulai) {
      log("Menekan tombol 'Mulai Pemeriksaan' di detail...");
      safeClick(btnMulai);
      await sleep(800);

      const modal = await waitFor(() => {
        return Array.from(document.querySelectorAll("div, section, [role='dialog']")).find(el => {
          if (!isVisible(el)) return false;
          const txt = (el.textContent || "").toLowerCase();
          return txt.includes("konfirmasi tanggal pemeriksaan") && (txt.includes("sebelum mulai") || (el.className || "").includes("shadow"));
        });
      }, 5000, 250).catch(() => null);

      if (modal) {
        const selectedDateBtn = modal.querySelector("button.bg-theme, button[class*='bg-theme']")
          || Array.from(modal.querySelectorAll("button")).find(b => !b.classList.contains("cursor-not-allowed") && !b.disabled && b.querySelector(".font-bold"));
        if (selectedDateBtn) {
          safeClick(selectedDateBtn);
          await sleep(300);
        }

        const btnSimpan = Array.from(modal.querySelectorAll("button")).find(b => {
          if (!isVisible(b) || b.disabled) return false;
          const txt = (b.textContent || "").trim().toLowerCase();
          return /simpan/i.test(txt) && !txt.includes("kembali") && !txt.includes("batal");
        });
        if (btnSimpan) {
          safeClick(btnSimpan);
          await sleep(2000);
        }
      }
    }

    await waitFor(() => {
      return document.querySelector("#rowfrm000093") ||
        document.querySelector(".btn-sent-report") ||
        Array.from(document.querySelectorAll("button")).some(b => /selesai\w*\s*layanan|kirim\s*rapor|input\s*data/i.test(b.textContent || ""));
    }, 15000, 400, "Halaman detail tidak termuat tepat waktu");

    await fillAllPatientForms(knownTglLahir);
    await sleep(800);

    const finalRes = await finalizeLayanan();
    return finalRes;
  }

  // ===========================================================================
  // 4. SISTEM TAB ANTREAN & PENGUNCIAN TANGGAL
  // ===========================================================================
  function findQueueTabElement(tabName) {
    const norm = (tabName || "").toLowerCase();
    const isBelum = norm.includes("belum");
    const isSedang = norm.includes("sedang");

    const candidates = Array.from(document.querySelectorAll("div, button, a, [role='tab'], li")).filter(el => {
      if (el.closest(".table-individu-terdaftar, table, .mx-datepicker, header, nav, aside")) return false;
      if (!isVisible(el)) return false;
      const txt = (el.textContent || "").trim().toLowerCase();
      if (!txt.includes("pemeriksaan")) return false;

      if (isBelum) {
        return txt.includes("belum") && !txt.includes("sedang") && !txt.includes("selesai");
      } else if (isSedang) {
        return txt.includes("sedang") && !txt.includes("belum") && !txt.includes("selesai");
      }
      return false;
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    return candidates[0];
  }

  function isQueueTabActive(tabEl) {
    if (!tabEl) return false;
    const cls = ((tabEl.className || "") + " " + (tabEl.getAttribute("class") || "")).toLowerCase();
    if (cls.includes("16b3ac") || cls.includes("text-teal") || cls.includes("active") || cls.includes("border-teal")) return true;
    if (tabEl.querySelector("[class*='16B3AC'], [class*='teal']")) return true;
    return false;
  }

  async function activateQueueTab(tabName) {
    const tabEl = findQueueTabElement(tabName);
    if (tabEl) {
      if (!isQueueTabActive(tabEl)) {
        safeClick(tabEl);
        log(`Beralih ke tab "${tabName}"...`);
        await sleep(1500);
        for (let w = 0; w < 10; w++) {
          const spinner = document.querySelector(".spinner_ajPY, [class*='Memuat data']");
          if (!spinner) break;
          await sleep(250);
        }
      }
      return true;
    }
    return false;
  }

  // Penguncian tanggal di portal web CKG
  function lockQueueDate(dateStr) {
    if (!dateStr) return;
    try {
      localStorage.setItem("ckg_is_queue_locked", "true");
      sessionStorage.setItem("ckg_is_queue_locked", "true");
      localStorage.setItem("ckg_target_service_date", dateStr);
      sessionStorage.setItem("ckg_target_service_date", dateStr);
      localStorage.setItem("ckg_saved_pelayanan_date_filter", dateStr);
      sessionStorage.setItem("ckg_saved_pelayanan_date_filter", dateStr);
    } catch (e) {}
  }

  // ===========================================================================
  // 5. SISTEM PAGINASI TABEL CKG (DETEKSI & NAVIGASI HALAMAN)
  // ===========================================================================
  function detectPaginationInfo() {
    // 1. Deteksi teks status: "Menampilkan 1-10 dari 45 data"
    const infoEls = Array.from(document.querySelectorAll("div, p, span")).filter(el => {
      const txt = (el.textContent || "").trim();
      return /menampilkan\s+\d+\s*[-–—]\s*\d+\s+dari\s+\d+/i.test(txt);
    });

    let start = 1, end = 10, total = 0, pageSize = 10, currentPage = 1, totalPages = 1;

    if (infoEls.length > 0) {
      const m = infoEls[0].textContent.match(/menampilkan\s+(\d+)\s*[-–—]\s*(\d+)\s+dari\s+(\d+)/i);
      if (m) {
        start = parseInt(m[1], 10);
        end = parseInt(m[2], 10);
        total = parseInt(m[3], 10);
        pageSize = Math.max(1, end - start + 1);
        if (pageSize < 5) pageSize = 10; // Default CKG standard
        currentPage = Math.floor((start - 1) / pageSize) + 1;
        totalPages = Math.max(1, Math.ceil(total / pageSize));
        return { start, end, total, pageSize, currentPage, totalPages, found: true };
      }
    }

    // Fallback: cari elemen pagination aktif
    const activeBtn = document.querySelector(".vpagination li.page-item.active, [aria-current='page'], .pagination .active, [class*='bg-[#16B3AC]'], [class*='bg-teal-500']");
    const parsedCur = parseInt(activeBtn?.textContent?.trim(), 10);
    if (!isNaN(parsedCur) && parsedCur >= 1) {
      currentPage = parsedCur;
    }

    return { start, end, total, pageSize, currentPage, totalPages, found: false };
  }

  async function goToPage(targetPage) {
    const target = parseInt(targetPage, 10);
    if (isNaN(target) || target < 1) return { ok: false, error: "Halaman tidak valid" };

    const currentInfo = detectPaginationInfo();
    if (currentInfo.currentPage === target) {
      log(`Tabel sudah berada di Halaman ${target}.`);
      return { ok: true, page: target };
    }

    log(`Navigasi ke Halaman ${target} (saat ini: Halaman ${currentInfo.currentPage})...`);

    // 1. Coba klik langsung tombol angka halaman target
    const allPageButtons = Array.from(document.querySelectorAll(".vpagination a, .vpagination button, [class*='pagination'] button, [class*='pagination'] a, nav button, div.flex.justify-end button, div.flex.justify-end a, div.flex.justify-end div.cursor-pointer"));
    const directBtn = allPageButtons.find(b => {
      if (!isVisible(b) || b.disabled || b.classList.contains("disabled")) return false;
      return (b.textContent || "").trim() === String(target);
    });

    if (directBtn) {
      safeClick(directBtn);
      await sleep(1500);
      for (let w = 0; w < 12; w++) {
        const spinner = document.querySelector(".spinner_ajPY, [class*='Memuat data']");
        if (!spinner) break;
        await sleep(250);
      }
      const newInfo = detectPaginationInfo();
      log(`✓ Berhasil membuka Halaman ${newInfo.currentPage}.`);
      return { ok: true, page: newInfo.currentPage };
    }

    // 2. Jika tombol angka tidak langsung terlihat, klik Next atau Prev bertahap
    let cur = currentInfo.currentPage;
    let stepCount = 0;
    while (cur !== target && stepCount < 30) {
      stepCount++;
      if (cur < target) {
        const nextBtn = allPageButtons.find(b => {
          if (!isVisible(b) || b.disabled || b.classList.contains("disabled") || b.classList.contains("cursor-not-allowed")) return false;
          const t = (b.textContent || "").trim().toLowerCase();
          return t === ">" || t === "›" || t === "»" || t.includes("next") || t.includes("berikutnya");
        }) || document.querySelector("button[aria-label*='Next' i], button[aria-label*='Berikutnya' i]");

        if (!nextBtn) break;
        safeClick(nextBtn);
        await sleep(1200);
      } else {
        const prevBtn = allPageButtons.find(b => {
          if (!isVisible(b) || b.disabled || b.classList.contains("disabled") || b.classList.contains("cursor-not-allowed")) return false;
          const t = (b.textContent || "").trim().toLowerCase();
          return t === "<" || t === "‹" || t === "«" || t.includes("prev") || t.includes("sebelumnya");
        }) || document.querySelector("button[aria-label*='Prev' i], button[aria-label*='Sebelumnya' i]");

        if (!prevBtn) break;
        safeClick(prevBtn);
        await sleep(1200);
      }

      for (let w = 0; w < 10; w++) {
        const spinner = document.querySelector(".spinner_ajPY, [class*='Memuat data']");
        if (!spinner) break;
        await sleep(250);
      }
      cur = detectPaginationInfo().currentPage;
    }

    log(`Navigasi halaman berakhir di Halaman ${cur}.`);
    return { ok: true, page: cur };
  }

  // ===========================================================================
  // 6. PEMBACAAN BARIS PASIEN DI HALAMAN AKTIF
  // ===========================================================================
  function getQueueRowsFromCurrentPage() {
    const table = document.querySelector(".table-individu-terdaftar table, table");
    const ths = Array.from(table?.querySelectorAll("thead tr th") || []);
    let pemeriksaanColIdx = -1;
    ths.forEach((th, idx) => {
      const txt = (th.textContent || "").trim().toLowerCase();
      if (txt === "pemeriksaan" || (txt.includes("pemeriksaan") && !txt.includes("mandiri") && !txt.includes("tata"))) {
        pemeriksaanColIdx = idx;
      }
    });

    const rows = Array.from(document.querySelectorAll(".table-individu-terdaftar table tbody tr, table tbody tr"));
    const list = [];

    rows.forEach((tr, idx) => {
      const rowTxt = (tr.textContent || "").trim();
      if (!rowTxt || rowTxt.includes("Tidak ditemukan") || rowTxt.includes("Belum ada data") || rowTxt.includes("Memuat")) return;

      const cells = Array.from(tr.querySelectorAll("td"));
      const nama = tr.querySelector("td:nth-child(2)")?.textContent?.trim() || "";
      const tglLahir = tr.querySelector("td:nth-child(3)")?.textContent?.trim() || "";
      const noTiket = tr.querySelector("td:nth-child(4)")?.textContent?.trim() || "";

      let btnAction = null;
      if (pemeriksaanColIdx >= 0 && cells[pemeriksaanColIdx]) {
        const b = cells[pemeriksaanColIdx].querySelector("button, a, div[role='button']");
        if (b && isVisible(b) && !b.disabled && !b.classList.contains("cursor-not-allowed")) {
          btnAction = b;
        }
      }

      if (!btnAction) {
        // Fallback: cari tombol dengan teks mulai/lanjut di seluruh baris
        btnAction = Array.from(tr.querySelectorAll("button, a, div[role='button']")).find(b => {
          if (!isVisible(b) || b.disabled || b.classList.contains("cursor-not-allowed")) return false;
          const t = (b.textContent || "").trim().toLowerCase();
          return /^(mulai|lanjut|lanjutkan|periksa|catat)$/i.test(t) || t.startsWith("mulai") || t.startsWith("lanjut");
        });
      }

      if (btnAction) {
        list.push({ idx, nama, tglLahir, noTiket, btnAction, tr });
      }
    });

    return list;
  }

  // ===========================================================================
  // 7. ORKESTRASI LOOP TERUS MENERUS (CONTINUOUS RUNNER WORKFLOW)
  // ===========================================================================
  async function runContinuousWorkflow(options = {}) {
    const {
      tabTarget = "BELUM",       // "BELUM", "SEDANG", "BOTH"
      startPage = 1,             // Halaman awal (default: 1)
      lockedDate = "",           // Tanggal yang dikunci
      autoSwitchTab = true       // Jika true, setelah Belum habis lanjut ke Sedang
    } = options;

    window.__ckgRunnerStopRequested = false;
    log("===============================================================");
    log("MEMULAI CONTINUOUS PELAYANAN RUNNER (FULL UNATTENDED)");
    log(`Konfigurasi: Tab Target=${tabTarget} | Start Page=${startPage} | Tanggal Kunci=${lockedDate || 'Sesuai Web'}`);
    log("===============================================================");

    if (lockedDate) {
      lockQueueDate(lockedDate);
    }

    const tabsToProcess = [];
    if (tabTarget === "SEDANG") {
      tabsToProcess.push("Sedang Pemeriksaan");
    } else if (tabTarget === "BOTH") {
      tabsToProcess.push("Belum Pemeriksaan", "Sedang Pemeriksaan");
    } else {
      tabsToProcess.push("Belum Pemeriksaan");
      if (autoSwitchTab) tabsToProcess.push("Sedang Pemeriksaan");
    }

    let totalCompleted = 0;

    for (const tabLabel of tabsToProcess) {
      if (window.__ckgRunnerStopRequested) break;

      log(`---------------------------------------------------------------`);
      log(`[Tab Antrean] Membuka tab "${tabLabel}"...`);
      await activateQueueTab(tabLabel);
      await sleep(1500);

      // Mulai dari halaman yang ditentukan (startPage untuk tab pertama, halaman 1 untuk tab berikutnya)
      let targetPage = (tabLabel === tabsToProcess[0]) ? Math.max(1, parseInt(startPage, 10) || 1) : 1;
      if (targetPage > 1) {
        log(`Membuka Halaman Awal ${targetPage} di tab "${tabLabel}"...`);
        await goToPage(targetPage);
        await sleep(1500);
      }

      let tabHasMorePatients = true;

      while (tabHasMorePatients && !window.__ckgRunnerStopRequested) {
        const pagInfo = detectPaginationInfo();
        const currentPage = pagInfo.currentPage || targetPage;
        log(`[Halaman ${currentPage}${pagInfo.totalPages ? ` dari ${pagInfo.totalPages}` : ''}] Memindai antrean pasien...`);

        let queue = getQueueRowsFromCurrentPage();
        log(`Ditemukan ${queue.length} pasien yang siap dilayani di Halaman ${currentPage}.`);

        // Layani seluruh pasien di halaman ini
        while (queue.length > 0 && !window.__ckgRunnerStopRequested) {
          const patient = queue[0];
          log(`=============================================================`);
          log(`[Halaman ${currentPage}] (#${totalCompleted + 1}) Pasien: ${patient.nama || '-'} | Tiket: ${patient.noTiket || '-'} | Lahir: ${patient.tglLahir || '-'}`);

          safeClick(patient.btnAction);
          log(`Tombol '${patient.btnAction.textContent.trim()}' diklik. Menunggu...`);
          await sleep(1500);

          // Cek jika muncul modal konfirmasi tanggal
          if (!window.location.href.includes("detail-pemeriksaan")) {
            const modalTgl = await waitFor(() => {
              return Array.from(document.querySelectorAll("div, section, form, [role='dialog']")).find(el => {
                if (!isVisible(el)) return false;
                const txt = (el.textContent || "").toLowerCase();
                return txt.includes("konfirmasi tanggal") || txt.includes("pilih tanggal");
              });
            }, 2500, 200).catch(() => null);

            if (modalTgl) {
              log("Modal konfirmasi tanggal muncul. Memilih tanggal & klik Simpan...");
              const btnSimpanTgl = Array.from(modalTgl.querySelectorAll("button")).find(b => {
                if (!isVisible(b) || b.disabled) return false;
                const txt = (b.textContent || "").toLowerCase();
                return /simpan|konfirmasi|lanjut|ya/i.test(txt) && !txt.includes("batal") && !txt.includes("tata");
              });
              if (btnSimpanTgl) {
                safeClick(btnSimpanTgl);
                await sleep(2000);
              }
            }
          }

          // Tunggu redirect ke detail pemeriksaan
          await sleep(2000);
          if (window.location.href.includes("ckg-tatalaksana/detail")) {
            try {
              const u = new URL(window.location.href);
              const d = u.searchParams.get("q_pelayanan") || u.searchParams.get("_d");
              if (d) {
                log("[Auto-Redirect] Mengalihkan dari tatalaksana ke detail-pemeriksaan...");
                window.location.href = `https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan/detail-pemeriksaan?_d=${encodeURIComponent(d)}`;
                await sleep(3000);
              }
            } catch (e) {}
          }

          try {
            await executePatientDetailPipeline(patient.tglLahir);
            totalCompleted++;
            log(`✓ SUKSES: Pasien ${patient.nama} berhasil diselesaikan! (Total: ${totalCompleted})`, "#10b981");

            chrome.runtime.sendMessage({
              type: "AUTO_RUNNER_STATE",
              running: true,
              stats: { completed: totalCompleted, current: patient.nama }
            }).catch(() => {});
          } catch (err) {
            console.error(`❌ Gagal pada pasien ${patient.nama}:`, err);
            log(`⚠️ Gagal pada pasien ${patient.nama}: ${err.message}`, "#ef4444");
          }

          // Kembali ke halaman antrean
          if (window.location.pathname.includes("detail-pemeriksaan") || window.location.pathname.includes("tatalaksana")) {
            log("Navigasi kembali ke halaman antrean /ckg-pelayanan...");
            window.location.href = "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan?back=true";
            await sleep(3500);
          } else {
            await sleep(2000);
          }

          // Pulihkan tab & pastikan tetap di halaman aktif
          await activateQueueTab(tabLabel);
          const curPag = detectPaginationInfo();
          if (curPag.currentPage !== currentPage) {
            log(`Mengembalikan posisi tabel ke Halaman ${currentPage}...`);
            await goToPage(currentPage);
            await sleep(1200);
          }

          queue = getQueueRowsFromCurrentPage();
        }

        if (window.__ckgRunnerStopRequested) break;

        // Semua baris di halaman aktif ini telah selesai. Cek apakah ada halaman berikutnya!
        const latestPag = detectPaginationInfo();
        if (latestPag.totalPages && currentPage < latestPag.totalPages) {
          const nextPageNum = currentPage + 1;
          log(`✓ Halaman ${currentPage} selesai. Berpindah ke Halaman ${nextPageNum}...`, "#3b82f6");
          await goToPage(nextPageNum);
          await sleep(2000);
          targetPage = nextPageNum;
        } else {
          log(`✓ Seluruh halaman pada tab "${tabLabel}" telah tuntas dilayani!`);
          tabHasMorePatients = false;
        }
      }
    }

    log(`🎉 SELESAI: Total ${totalCompleted} pasien berhasil dilayani dan diselesaikan secara terus-menerus!`, "#10b981");
    chrome.runtime.sendMessage({
      type: "AUTO_RUNNER_STATE",
      running: false,
      stats: { completed: totalCompleted }
    }).catch(() => {});

    return { ok: true, totalCompleted };
  }

  function stopWorkflow() {
    window.__ckgRunnerStopRequested = true;
    log("Permintaan penghentian runner diterima. Menghentikan aktivitas...");
  }

  window.__ckgContinuousRunner = {
    start: runContinuousWorkflow,
    stop: stopWorkflow,
    goToPage,
    detectPagination: detectPaginationInfo,
    activateTab: activateQueueTab
  };

  log("Continuous Pelayanan Runner siap digunakan via window.__ckgContinuousRunner.");
})();
