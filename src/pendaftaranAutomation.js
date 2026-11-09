import { decryptIfEncrypted, isEncryptedBody } from "./hpkeDecryptor.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function exec(tabId, func, args = [], maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func,
        args
      });
      return res?.result;
    } catch (err) {
      lastErr = err;
      const msg = err?.message || "";
      const isTransient = /frame with id 0 was removed|execution context was destroyed|cannot access contents|tab was closed/i.test(msg);
      if (isTransient && attempt < maxRetries - 1) {
        await sleep(350);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function decryptResult(result) {
  if (!result || !isEncryptedBody(result.body)) return result;
  const decrypted = await decryptIfEncrypted(result.body);
  const out = { ...result, body: decrypted, data: decrypted?.data ?? null };
  if ("bodyStatusCode" in result) {
    out.bodyStatusCode = decrypted?.statusCode ?? null;
  }
  if ("found" in result) {
    out.found = 200 === result.status && (null == decrypted?.statusCode || 200 === decrypted.statusCode);
  }
  return out;
}

// -------------------------------------------------------------
// Input & Form Interceptor Functions (Main World)
// -------------------------------------------------------------

function isBelumBekerjaText(s) {
  const txt = String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  return /belum\s*\/?\s*tidak\s*bekerja|tidak\s*\/?\s*belum\s*bekerja|tidak\s*bekerja|belum\s*bekerja/i.test(txt) ||
    (txt.includes("belum") && txt.includes("bekerja")) ||
    (txt.includes("tidak") && txt.includes("bekerja"));
}

function inputNik(nik) {
  const el = document.getElementById("nik") || document.querySelector('input[placeholder*="NIK"]');
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, nik);
  else el.value = nik;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function clickCekNik() {
  const btn = Array.from(document.querySelectorAll("button")).find(b => "Cek NIK" === b.textContent.trim());
  return !!btn && (btn.click(), true);
}

function installNikInterceptor() {
  if (window.__nikInterceptorInstalled) return true;
  window.__nikInterceptorInstalled = true;
  window.__nikCheckResult = null;
  const isMatch = url => (url || "").includes("/api/pkg/ssi/check-nik");
  const save = (status, body) => {
    window.__nikCheckResult = {
      status,
      bodyStatusCode: body?.statusCode ?? null,
      found: 200 === status && (null == body?.statusCode || 200 === body.statusCode),
      body: body ?? null
    };
  };

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    const res = await origFetch.apply(this, args);
    if (isMatch(url)) {
      try {
        const clone = res.clone();
        save(res.status, await clone.json());
      } catch (e) {
        save(res.status, null);
      }
    }
    return res;
  };

  const origXHR = window.XMLHttpRequest;
  if (origXHR && !window.__nikXhrPatched) {
    window.__nikXhrPatched = true;
    const origOpen = origXHR.prototype.open;
    const origSend = origXHR.prototype.send;
    origXHR.prototype.open = function(method, url, ...rest) {
      this.__nikUrl = typeof url === "string" ? url : "";
      return origOpen.call(this, method, url, ...rest);
    };
    origXHR.prototype.send = function(...args) {
      this.addEventListener("load", () => {
        if (isMatch(this.__nikUrl)) {
          try {
            save(this.status, JSON.parse(this.responseText));
          } catch (e) {
            save(this.status, null);
          }
        }
      });
      return origSend.apply(this, args);
    };
  }
  return true;
}

function dismissErrorModal() {
  const isDismissBtn = b => {
    if (!b || b.disabled) return false;
    const t = (b.textContent || b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
    return /^(ok|oke|tutup|kembali|periksa kembali|batal|mengerti|lanjutkan|isi manual|cari individu|ya,\s*lanjutkan|x|✕|×)$/i.test(t) ||
           /^(periksa kembali|kembali|tutup|cari individu|batal|isi manual)/i.test(t);
  };
  const errorContainers = Array.from(document.querySelectorAll("[role='dialog'], .modal, .swal2-popup, div.fixed, div.z-50, div.z-2000, div, section"))
    .filter(d => {
      const txt = (d.textContent || "");
      return /terjadi kesalahan|gagal memproses|tidak ditemukan|tidak terdaftar|tidak sesuai|tidak valid|perbaiki data|sudah mendapatkan|sudah terdaftar|kuota|perhatian|peringatan/i.test(txt);
    })
    .filter(d => Array.from(d.querySelectorAll("button, [role='button']")).some(isDismissBtn))
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
  const target = errorContainers[0];
  const btn = target
    ? Array.from(target.querySelectorAll("button, [role='button']")).find(isDismissBtn)
    : Array.from(document.querySelectorAll("[role='dialog'] button, .modal button, .swal2-popup button, div.fixed button")).find(isDismissBtn);
  if (btn && !btn.disabled) {
    try { btn.click(); } catch (e) {}
    return true;
  }
  const closeIcon = document.querySelector("[role='dialog'] button[aria-label*='close' i], .modal button.close, .swal2-close, div.fixed button svg.lucide-x");
  if (closeIcon) {
    const closeTarget = closeIcon.closest("button, [role='button']") || closeIcon;
    try { closeTarget.click(); return true; } catch (e) {}
  }
  return false;
}

function checkGunakanDataOrManualModal() {
  const btns = Array.from(document.querySelectorAll("button, [role='button']"));
  const btnGunakan = btns.find(b => /gunakan data/i.test((b.textContent || "").trim()));
  const btnManual = btns.find(b => /isi manual/i.test((b.textContent || "").trim()));
  if (btnGunakan) return { found: true, hasManual: !!btnManual, fromModal: true };
  if (btnManual) return { found: false, hasManual: true, fromModal: true };
  return null;
}

function getNikCheckResult() {
  return window.__nikCheckResult ?? null;
}

function clearNikCheckResult() {
  window.__nikCheckResult = null;
}

function clickGunakanData() {
  const btn = Array.from(document.querySelectorAll("button")).find(b => "Gunakan Data" === b.textContent.trim());
  return !!btn && (btn.click(), true);
}

function installValidasiInterceptor() {
  if (window.__validasiInterceptorInstalled) return true;
  window.__validasiInterceptorInstalled = true;
  window.__validasiResult = null;
  const endpoints = ["/api/pkg/ssi/register-pre", "/api/pkg/validasi/data-pasien"];
  const isMatch = url => endpoints.some(ep => (url || "").includes(ep));
  const save = (status, body) => {
    window.__validasiResult = {
      status,
      data: body?.data ?? null,
      body: body ?? null
    };
  };

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    const res = await origFetch.apply(this, args);
    if (isMatch(url)) {
      try {
        const clone = res.clone();
        save(res.status, await clone.json());
      } catch (e) {
        save(res.status, null);
      }
    }
    return res;
  };

  const origXHR = window.XMLHttpRequest;
  if (origXHR && !window.__validasiXhrPatched) {
    window.__validasiXhrPatched = true;
    const origOpen = origXHR.prototype.open;
    const origSend = origXHR.prototype.send;
    origXHR.prototype.open = function(method, url, ...rest) {
      this.__validasiUrl = typeof url === "string" ? url : "";
      return origOpen.call(this, method, url, ...rest);
    };
    origXHR.prototype.send = function(...args) {
      this.addEventListener("load", () => {
        if (isMatch(this.__validasiUrl)) {
          try {
            save(this.status, JSON.parse(this.responseText));
          } catch (e) {
            save(this.status, null);
          }
        }
      });
      return origSend.apply(this, args);
    };
  }
  return true;
}

function getValidasiResult() {
  return window.__validasiResult ?? null;
}

function clearValidasiResult() {
  window.__validasiResult = null;
}

function getValidasiModalResult() {
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const bodyText = norm(document.body?.innerText || "");

  // 1. Cek apakah ada tombol "Lanjutkan" pada modal "Data peserta valid"
  const allBtns = Array.from(document.querySelectorAll("button, div[role='button'], a.btn, div.bg-primaryColor, div.btn-primary, div[class*='primary'], div[class*='#16B3AC']"));
  const lanjutBtn = allBtns.find(b => {
    const t = norm(b.textContent || b.innerText);
    return t.includes("lanjutkan") || t === "lanjut" || t.includes("ya, lanjutkan");
  });
  if (lanjutBtn && (bodyText.includes("data peserta valid") || bodyText.includes("peserta valid") || bodyText.includes("valid") || bodyText.includes("konfirmasi"))) {
    return { status: 200, data: { validation_code: "VALID", reason: "modal: Data peserta valid" }, fromModal: true };
  }

  // 2. Cek apakah halaman SUDAH berada di Step 2 ("Isi data pendukung")
  if (bodyText.includes("isi data pendukung") || bodyText.includes("data pendukung") || !!document.querySelector("#detail-domisili") || (bodyText.includes("nama sekolah") && bodyText.includes("jenjang")) || bodyText.includes("status pernikahan") || bodyText.includes("pilih pekerjaan")) {
    return { status: 200, data: { validation_code: "VALID", reason: "already on step 2" }, fromModal: true };
  }

  // 3. Cek modal error atau sudah terdaftar
  if (/sudah menerima layanan|sudah pernah|sudah terdaftar|already screened|sudah melakukan|selesai diperiksa/i.test(bodyText)) {
    return { status: 200, data: { validation_code: "ALREADY_SCREENED", reason: "modal: sudah menerima layanan" }, fromModal: true };
  }
  if (/nik tidak valid|data tidak valid|tidak ditemukan di dukcapil|perbaiki data yang dimasukkan|nik tidak ditemukan/i.test(bodyText)) {
    return { status: 200, data: { validation_code: "INVALID_DATA", reason: "modal: data tidak valid" }, fromModal: true };
  }
  if (/pendaftaran gagal|gagal disimpan|silakan coba beberapa saat lagi/i.test(bodyText)) {
    return { status: 400, data: { validation_code: "REGISTRATION_FAILED", reason: "modal: pendaftaran gagal" }, fromModal: true };
  }

  return null;
}

function installRegisterInterceptor() {
  if (window.__registerInterceptorInstalled) return true;
  window.__registerInterceptorInstalled = true;
  window.__registerResult = null;
  const isMatch = url => (url || "").includes("/api/pkg/ssi/register-ckg");
  const save = (status, body) => {
    window.__registerResult = {
      status,
      data: body?.data ?? null,
      body: body ?? null
    };
  };

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    const res = await origFetch.apply(this, args);
    if (isMatch(url)) {
      try {
        const clone = res.clone();
        save(res.status, await clone.json());
      } catch (e) {
        save(res.status, null);
      }
    }
    return res;
  };

  const origXHR = window.XMLHttpRequest;
  if (origXHR && !window.__registerXhrPatched) {
    window.__registerXhrPatched = true;
    const origOpen = origXHR.prototype.open;
    const origSend = origXHR.prototype.send;
    origXHR.prototype.open = function(method, url, ...rest) {
      this.__registerUrl = typeof url === "string" ? url : "";
      return origOpen.call(this, method, url, ...rest);
    };
    origXHR.prototype.send = function(...args) {
      this.addEventListener("load", () => {
        if (isMatch(this.__registerUrl)) {
          try {
            save(this.status, JSON.parse(this.responseText));
          } catch (e) {
            save(this.status, null);
          }
        }
      });
      return origSend.apply(this, args);
    };
  }
  return true;
}

function getRegisterResult() {
  return window.__registerResult ?? null;
}

function clearRegisterResult() {
  window.__registerResult = null;
}

function installListSekolahInterceptor() {
  if (window.__listSekolahInterceptorInstalled) return true;
  window.__listSekolahInterceptorInstalled = true;
  window.__listSekolahResults = [];
  const endpoint = "/api/pkg/ssi/list-kunjungan-sekolah";
  const save = (status, body) => {
    (window.__listSekolahResults ||= []).push({ status, body: body ?? null });
  };

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    const res = await origFetch.apply(this, args);
    if (url.includes(endpoint)) {
      try {
        save(res.status, await res.clone().json());
      } catch (e) {
        save(res.status, null);
      }
    }
    return res;
  };

  const origXHR = window.XMLHttpRequest;
  if (origXHR && !window.__listSekolahXhrPatched) {
    window.__listSekolahXhrPatched = true;
    const origOpen = origXHR.prototype.open;
    const origSend = origXHR.prototype.send;
    origXHR.prototype.open = function(method, url, ...rest) {
      this.__listSekolahUrl = typeof url === "string" ? url : "";
      return origOpen.call(this, method, url, ...rest);
    };
    origXHR.prototype.send = function(...args) {
      this.addEventListener("load", () => {
        if ((this.__listSekolahUrl || "").includes(endpoint)) {
          try {
            save(this.status, JSON.parse(this.responseText));
          } catch (e) {
            save(this.status, null);
          }
        }
      });
      return origSend.apply(this, args);
    };
  }
  return true;
}

function getListSekolahResults() {
  return window.__listSekolahResults ?? [];
}

function clearListSekolahResults() {
  window.__listSekolahResults = [];
}

function setNamedInput(name, value) {
  let el = document.querySelector(`input[name="${name}"]`) || document.getElementById(name);
  if (!el) {
    const inputs = Array.from(document.querySelectorAll("input"));
    el = inputs.find(i => (i.placeholder && i.placeholder.toLowerCase().includes(name.toLowerCase())) ||
                          (i.name && i.name.toLowerCase().includes(name.toLowerCase())));
  }
  if (!el && name.toLowerCase().includes("whatsapp")) {
    el = document.querySelector('input[placeholder*="Whatsapp" i], input[id*="whatsapp" i], input[type="tel"]');
  }
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function clickPilih() {
  const btn = Array.from(document.querySelectorAll("button")).find(b => "Pilih" === b.textContent.trim());
  return !!btn && (btn.click(), true);
}

function clickLanjutkan() {
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const bodyText = norm(document.body?.innerText || "");
  if (bodyText.includes("isi data pendukung") || bodyText.includes("data pendukung") || !!document.querySelector("#detail-domisili") || (bodyText.includes("nama sekolah") && bodyText.includes("jenjang")) || bodyText.includes("status pernikahan") || bodyText.includes("pilih pekerjaan")) {
    return true;
  }
  const btns = Array.from(document.querySelectorAll("button, div[role='button'], a.btn, div.bg-primaryColor, div.btn-primary, div[class*='primary'], div[class*='#16B3AC']"));
  const btn = btns.reverse().find(b => {
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || b.disabled) return false;
    const cls = (b.className || "").toString().toLowerCase();
    if (cls.includes("disabled") || cls.includes("cursor-not-allowed") || cls.includes("opacity-50")) return false;
    const t = norm(b.textContent || b.innerText);
    return t === "lanjutkan" || t.startsWith("lanjutkan") || t.includes("lanjutkan") || t.includes("ya, lanjutkan") || t === "lanjut";
  });
  if (!btn) return false;
  try {
    btn.scrollIntoView({ block: "center" });
    const rect = btn.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.x + (rect.width > 0 ? rect.width / 2 : 10), clientY: rect.y + (rect.height > 0 ? rect.height / 2 : 10) };
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(evt => btn.dispatchEvent(new MouseEvent(evt, opts)));
  } catch (e) {}
  btn.click();
  return true;
}

function clickSelanjutnya() {
  const btns = Array.from(document.querySelectorAll("button, div[role='button'], a.btn")).filter(b => {
    const r = b.getBoundingClientRect();
    const cls = (b.className || "").toString().toLowerCase();
    return r.width > 0 && r.height > 0 && !b.disabled && !cls.includes("disabled") && !cls.includes("cursor-not-allowed") && !cls.includes("opacity-50");
  });
  const btn = btns.find(b => {
    const t = (b.textContent || b.innerText || "").trim().toLowerCase();
    return t === "selanjutnya" || t.startsWith("selanjutnya");
  });
  if (!btn) return false;
  try {
    const rect = btn.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.x + (rect.width > 0 ? rect.width / 2 : 10), clientY: rect.y + (rect.height > 0 ? rect.height / 2 : 10) };
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(evt => btn.dispatchEvent(new MouseEvent(evt, opts)));
  } catch (e) {}
  btn.click();
  return true;
}

function clickDaftarkan() {
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const btns = Array.from(document.querySelectorAll("button, div[role='button'], a.btn, div.bg-primaryColor, div.btn-primary"));
  const btn = btns.find(b => {
    const t = norm(b.textContent || b.innerText);
    return t === "daftarkan" || t === "daftarkan dengan nik" || t === "ya, daftarkan" || t.startsWith("daftarkan") ||
           ("submit" === b.type && /^daftarkan\b/.test(t));
  });
  if (!btn) return false;
  try { btn.scrollIntoView({ block: "center" }); } catch (err) {}
  const rect = btn.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: Math.round(rect.x + (rect.width > 0 ? rect.width / 2 : 10)),
    clientY: Math.round(rect.y + (rect.height > 0 ? rect.height / 2 : 10))
  };
  ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(evt => {
    try { btn.dispatchEvent(new MouseEvent(evt, opts)); } catch (err) {}
  });
  if (typeof btn.click === "function") {
    try { btn.click(); } catch (err) {}
  } else {
    try { btn.dispatchEvent(new MouseEvent("click", opts)); } catch (err) {}
  }
  return true;
}

function clickPilihJenisKelamin() {
  const el = Array.from(document.querySelectorAll("*")).find(e => "Pilih jenis kelamin" === e.textContent.trim() && 0 === e.children.length);
  return !!el && (el.click(), true);
}

function selectJenisKelaminOption(gender) {
  const container = document.querySelector('[class*="absolute"][class*="z-2000"], [class*="absolute"][class*="shadow"]');
  if (container) {
    const opt = Array.from(container.querySelectorAll("div")).find(e => 0 === e.children.length && e.textContent.trim() === gender);
    if (opt) return opt.click(), true;
  }
  const fallback = Array.from(document.querySelectorAll("div")).find(e => 0 === e.children.length && e.textContent.trim() === gender);
  return !!fallback && (fallback.click(), true);
}

// -------------------------------------------------------------
// Datepicker & Quota Helpers
// -------------------------------------------------------------

async function selectDateInPicker(dateInfo, isWali = false) {
  if (!dateInfo) return "no-date-info";
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = el => {
    if (!el) return;
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt =>
      el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
    );
    if (typeof el.click === "function") el.click();
  };

  const getPopup = () => document.querySelector(".mx-datepicker-popup, .mx-datepicker-main, .v-popper__popper");

  const monthIdxMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
    Jul: 6, Agt: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11
  };
  const monthIdx = monthIdxMap[dateInfo.bulan] ??
    (parseInt(dateInfo.bulan, 10) > 0 ? parseInt(dateInfo.bulan, 10) - 1 : 0);

  const targetYear = parseInt(dateInfo.tahun, 10);
  const targetDay = String(parseInt(dateInfo.tanggal, 10));

  // Temukan wrapper datepicker yang tepat (isolasi ketat peserta vs wali)
  const getWaliSection = () => {
    const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
    if (nikWali) {
      const sec = nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3, div.flex-col');
      if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
      return nikWali.parentElement?.parentElement?.parentElement || null;
    }
    const allHeadings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, p, span"));
    const h = allHeadings.find(el => el.children.length <= 2 && (el.textContent || "").trim().toLowerCase() === "isi data wali");
    if (h) {
      const sec = h.closest('.form-data-individu') || h.parentElement;
      if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
    }
    return null;
  };

  const findWrapper = () => {
    const allWrappers = Array.from(document.querySelectorAll(".mx-input-wrapper, .mx-datepicker")).filter(w => !w.closest("#Tanggal\\ Pemeriksaan"));
    const waliSec = getWaliSection();

    if (isWali) {
      if (!waliSec) return null; // Jika form wali tidak ada, JANGAN sentuh peserta!
      return waliSec.querySelector(".mx-input-wrapper, .mx-datepicker");
    } else {
      // Untuk peserta: ambil wrapper yang BUKAN di dalam waliSec
      const pWrapper = allWrappers.find(w => !waliSec || !waliSec.contains(w));
      return pWrapper ? (pWrapper.classList.contains("mx-input-wrapper") ? pWrapper : (pWrapper.querySelector(".mx-input-wrapper") || pWrapper)) : null;
    }
  };

  const wrapper = findWrapper();
  if (!wrapper) return "no-birth-wrapper";

  // Proteksi cerdas: Jika sudah ada data dari Dukcapil / Cek NIK (ada tombol clear X atau sudah ada isi), jangan dibuka!
  const hasClear = !!wrapper.querySelector(".mx-icon-clear, [class*='clear'], i.mx-clear-wrapper");
  const curVal = (wrapper.querySelector("input")?.value || "").trim();
  const curTxt = (wrapper.textContent || "").trim();
  if (hasClear || (curVal && !/^pilih/i.test(curVal)) || (curTxt && !/^pilih/i.test(curTxt) && /\d{4}/.test(curTxt))) {
    return "ok-already-filled";
  }

  // Klik input dan wrapper untuk membuka kalender
  const inp = wrapper.querySelector("input, .mx-icon-calendar, .mx-input") || wrapper;
  inp.scrollIntoView({ block: "center" });
  click(inp);
  click(wrapper);

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (getPopup()) break;
    await wait(120);
  }
  const popup = getPopup();
  if (!popup) return "no-popup";

  await wait(120);

  // Beralih ke tampilan dekade tahun
  let curYearBtn = popup.querySelector(".mx-btn-current-year") ||
                   Array.from(popup.querySelectorAll(".mx-calendar-header .mx-btn-text, .mx-calendar-header button")).find(b => /^\d{4}$/.test((b.textContent || "").trim()));
  if (curYearBtn) click(curYearBtn);
  await wait(120);
  if (!popup.querySelector(".mx-table-year") && curYearBtn) {
    click(curYearBtn);
    await wait(120);
  }

  // Cari sel tahun target
  const findYear = () => Array.from(popup.querySelectorAll(".mx-table-year td.cell, .mx-calendar-content .cell")).find(c => c.textContent.trim() === String(targetYear));
  let tries = 0;
  while (!findYear() && tries++ < 35) {
    const firstCell = popup.querySelector(".mx-table-year td.cell, .mx-calendar-content .cell");
    const visibleYear = parseInt(firstCell?.textContent ?? "9999", 10);
    const prevBtn = popup.querySelector(".mx-btn-icon-double-left, .mx-icon-double-left, i[class*='double-left']");
    const nextBtn = popup.querySelector(".mx-btn-icon-double-right, .mx-icon-double-right, i[class*='double-right']");
    const navBtn = visibleYear > targetYear ? (prevBtn?.closest("button") || prevBtn) : (nextBtn?.closest("button") || nextBtn);
    if (!navBtn) break;
    click(navBtn);
    await wait(150);
  }
  const yCell = findYear();
  if (yCell) {
    click(yCell);
    await wait(150);
  }

  // Pilih bulan
  const months = Array.from(popup.querySelectorAll(".mx-table-month td.cell, .mx-calendar-content .cell"));
  if (months[monthIdx]) {
    click(months[monthIdx]);
    await wait(150);
  }

  // Pilih tanggal
  const days = Array.from(popup.querySelectorAll(".mx-table-date td.cell, .mx-calendar-content .cell"))
    .filter(c => !c.classList.contains("not-current-month"));
  const day = days.find(c => c.textContent.trim() === targetDay);
  if (day) {
    click(day);
    await wait(200);
  }

  // Fallback pengisian input langsung bila value masih kosong
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const formattedIndo = `${targetDay} ${monthNames[monthIdx] || "Jan"} ${targetYear}`;
  const inputEl = wrapper.querySelector("input");
  if (inputEl && (!inputEl.value || !inputEl.value.trim())) {
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(inputEl, formattedIndo);
      else inputEl.value = formattedIndo;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {}
  }

  // Pastikan popup datepicker tertutup rapi agar tidak menghalangi dropdown jenis kelamin
  try {
    const pop = getPopup();
    if (pop && window.getComputedStyle(pop).display !== "none") {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      await wait(100);
    }
  } catch (e) {}

  return "ok";
}

async function pickQuotaDate() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = el => {
    if (!el) return;
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt =>
      el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
    );
  };

  const getCells = () => {
    const grid = [...document.querySelectorAll("div")].find(d =>
      (d.className || "").toString().includes("grid-cols-7") && d.children.length >= 30
    );
    if (!grid) return [];
    return [...grid.children].map((cell, idx) => {
      const daySpan = [...cell.querySelectorAll("span")].find(s => (s.className || "").toString().includes("font-bold"));
      if (!daySpan) return null;
      const quotaSpan = daySpan.nextElementSibling;
      const quotaText = quotaSpan ? quotaSpan.textContent.trim() : "";
      if (/^\d+$/.test(quotaText)) {
        return {
          i: idx,
          cell,
          day: parseInt(daySpan.textContent.trim(), 10),
          quota: parseInt(quotaText, 10),
          isToday: (cell.className || "").toString().includes("bg-theme")
        };
      }
      return null;
    }).filter(Boolean);
  };

  const getNextMonthBtn = () =>
    [...document.querySelectorAll("button, span, div, svg")].filter(
      el => 0 === el.children.length && ("›" === el.textContent.trim() || ">" === el.textContent.trim())
    )[0] || null;

  for (let m = 0; m < 3; m++) {
    const cells = getCells();
    if (cells.length) {
      const todayIdx = cells.findIndex(c => c.isToday);
      const startIdx = todayIdx >= 0 ? todayIdx : 0;
      if (todayIdx >= 0 && cells[todayIdx].quota > 0) {
        click(cells[todayIdx].cell);
        return true;
      }
      const available = cells.slice(startIdx).find(c => c.quota > 0);
      if (available) {
        click(available.cell);
        return true;
      }
    }
    const nextBtn = getNextMonthBtn();
    if (!nextBtn) break;
    click(nextBtn);
    await wait(600);
  }
  return false;
}

// -------------------------------------------------------------
// Step 2 Form Detail (UMUM from 4.1.1_0)
// -------------------------------------------------------------

async function fillDetailForm(form) {
  const e = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  // Mouse event click yang andal persis ckg-queue-assistant (dispatch tunggal untuk trigger dropdown)
  const n = el => {
    if (!el) return;
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (err) {}
    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.x + (rect.width > 0 ? rect.width / 2 : 10)),
      clientY: Math.round(rect.y + (rect.height > 0 ? rect.height / 2 : 10))
    };
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
      try { el.dispatchEvent(new MouseEvent(evt, opts)); } catch (err) {}
    });
  };

  // Helper klik item di dalam sub-modal (Pilih Pekerjaan / Pilih Lokasi) agar Vue handler pasti tereksekusi
  const clickModalItem = el => {
    if (!el) return;
    const clickable = el.closest("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, div.py-2") || el;
    n(clickable);
    if (typeof clickable.click === "function") {
      try { clickable.click(); } catch (err) {}
    }
  };

  const setInp = (inp, val) => {
    if (!inp) return;
    try { inp.focus(); } catch (err) {}
    const proto = inp instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(inp, val);
    else inp.value = val;
    try { inp.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: val })); } catch (err) {}
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Tutup sub-modal (Pilih Pekerjaan / Pilih Lokasi) yang menggantung agar tidak menghalangi field berikutnya
  const closeStuckSubModal = async (onlyType = "") => {
    const subInps = Array.from(document.querySelectorAll(
      '.modal-content input[placeholder*="Cari" i], [role="dialog"] input[placeholder*="Cari" i], input[placeholder*="Cari pekerjaan" i], input[placeholder*="Provinsi" i], input[placeholder*="Kabupaten" i], input[placeholder*="Kota" i], input[placeholder*="Kecamatan" i], input[placeholder*="Kelurahan" i]'
    )).filter(inp => {
      const r = inp.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      if (onlyType === "pekerjaan") {
        return /pekerjaan/i.test(inp.placeholder || "");
      }
      return true;
    });
    if (!subInps.length) return false;

    for (const inp of subInps) {
      const dlg = inp.closest(".modal-content, [role='dialog'], .modal, div.fixed") || document;
      const closeBtn = Array.from(dlg.querySelectorAll("button, [role='button'], svg, span.cursor-pointer")).find(b => {
        if (b.tagName === "SVG") return !!b.closest("button, [role='button'], .cursor-pointer");
        const t = norm(b.textContent);
        const aria = norm(b.getAttribute("aria-label") || "");
        return t === "✕" || t === "×" || t === "x" || t === "tutup" || t === "batal" || aria.includes("close") || aria.includes("tutup") ||
               (b.querySelector("svg") && t === "" && b.getBoundingClientRect().top <= inp.getBoundingClientRect().top);
      });
      if (closeBtn) {
        const targetClose = closeBtn.closest("button, [role='button'], .cursor-pointer") || closeBtn;
        clickModalItem(targetClose);
        await e(250);
      } else {
        try { document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape", keyCode: 27 })); } catch (err) {}
        await e(200);
      }
    }
    return true;
  };

  // Helper deteksi apakah modal Pilih Lokasi (Provinsi/Kab/Kec/Kel) sedang terbuka
  const findOpenLocInp = () => {
    const inps = Array.from(document.querySelectorAll(
      '.modal-content input[placeholder^="Cari" i], [role="dialog"] input[placeholder^="Cari" i], input[placeholder*="Provinsi" i], input[placeholder*="Kabupaten" i], input[placeholder*="Kota" i], input[placeholder*="Kecamatan" i], input[placeholder*="Kelurahan" i], input[placeholder*="Desa" i]'
    ));
    return inps.find(inp => {
      const r = inp.getBoundingClientRect();
      const ph = (inp.placeholder || "").toLowerCase();
      return r.width > 0 && r.height > 0 && !/pekerjaan|sekolah|jenjang|nik|nama/i.test(ph);
    }) || null;
  };

  const isNonAddressValue = s => {
    const txt = norm(s);
    if (!txt || txt === "-" || txt === "0") return true;
    return /^(belum|tidak)\s*\/?\s*(belum|tidak)?\s*bekerja$|^tidak bekerja$|^belum bekerja$|ibu rumah tangga|\birt\b|mengurus rumah|wiraswasta|wirausaha|pedagang|petani|pekebun|nelayan|buruh|karyawan|pegawai|swasta|\bpns\b|\basn\b|\btni\b|\bpolri\b|pelajar|mahasiswa|pensiunan|menikah|belum menikah|kawin|belum kawin|cerai hidup|cerai mati|tidak memiliki disabilitas|disabilitas|\bpbi\b|bpjs|mandiri/i.test(txt);
  };

  // Helper mencari trigger field berdasarkan label eksak maupun placeholder (prioritas struktur CKG v3.2.1)
  const a = (label, placeholder) => {
    const wantLabel = norm(label.replace(/[*:]/g, ""));
    const defaultPhMap = {
      "status pernikahan": "pilih status pernikahan",
      "penyandang disabilitas": "pilih penyandang disabilitas",
      "pekerjaan": "pilih pekerjaan",
      "alamat domisili": "pilih alamat domisili"
    };
    const wantPh = norm(placeholder || defaultPhMap[wantLabel] || "");

    // 1. Prioritas utama persis CKG v3.2.1: div.font-semibold, label -> nextElementSibling.querySelector(".cursor-pointer") || nextElementSibling
    const primaryLbls = Array.from(document.querySelectorAll("div.font-semibold, label, div.text-sm, div.font-medium, p.font-semibold, span.font-semibold"));
    const primaryMatch = primaryLbls.find(el => {
      if (el.children.length > 2) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const txt = norm((el.textContent || "").replace(/[*:]/g, ""));
      return txt === wantLabel;
    });

    if (primaryMatch) {
      const sib = primaryMatch.nextElementSibling;
      if (sib && norm(sib.textContent) !== "*") {
        return sib.querySelector(".cursor-pointer") || sib;
      }
      const parentSib = primaryMatch.parentElement ? primaryMatch.parentElement.nextElementSibling : null;
      if (parentSib && norm(parentSib.textContent) !== "*") {
        return parentSib.querySelector(".cursor-pointer") || parentSib;
      }
    }

    // 2. Fallback: cari berdasarkan teks placeholder langsung pada box trigger
    if (wantPh) {
      const triggers = Array.from(document.querySelectorAll("div.cursor-pointer, div[role='combobox'], div[role='button'], button, span.line-clamp-2"));
      for (const trg of triggers) {
        const txt = norm(trg.textContent || "");
        if (txt === wantPh || (txt.includes(wantPh) && txt.length < 55)) {
          const r = trg.getBoundingClientRect();
          if (r.width > 0 && r.height > 10) {
            return trg.closest(".cursor-pointer, [role='combobox'], [role='button'], button") || trg;
          }
        }
      }
    }

    return null;
  };

  const isBelumBekerjaText = s => {
    const txt = norm(s);
    return /belum\s*\/?\s*tidak\s*bekerja|tidak\s*\/?\s*belum\s*bekerja|tidak\s*bekerja|belum\s*bekerja/i.test(txt) ||
      (txt.includes("belum") && txt.includes("bekerja")) ||
      (txt.includes("tidak") && txt.includes("bekerja"));
  };

  // Helper dropdown untuk Status Pernikahan, Penyandang disabilitas, & Pekerjaan
  const selectDropdown = async (label, val) => {
    if (!val) return false;
    // JANGAN PERNAH menjalankan selectDropdown jika modal Pilih Lokasi sedang terbuka!
    if (findOpenLocInp()) return true;

    const trig = a(label);
    if (!trig) return false;

    const span = trig.querySelector("span.line-clamp-2") || trig;
    const cur = norm(span.textContent || "");
    const want = norm(val);

    // JIKA FIELD SUDAH TERPILIH DI FORM (bukan "Pilih ..."), JANGAN PERNAH DITIMPA ATAU DIBUKA LAGI!
    if (cur && !cur.startsWith("pilih") && cur !== "-" && cur !== "—") {
      return true;
    }

    // Klik trigger untuk membuka dropdown / modal
    n(trig);
    await e(350);

    // Jika yang terbuka ternyata modal lokasi, batalkan segera!
    if (findOpenLocInp()) return false;

    const matchOpt = el => {
      if (!el || el === trig || trig.contains(el)) return false;
      if (el.tagName === "INPUT" || el.querySelector("input") || el.tagName === "TEXTAREA" || el.children.length > 2) return false;
      const t = norm(el.innerText || el.textContent);
      if (!t || t.length > 60 || /^pilih\b/.test(t) || /^(tutup|batal|kembali|x|✕|×|simpan|selanjutnya)$/i.test(t)) return false;

      if (label === "Status Pernikahan") {
        if (want.includes("belum")) return t.includes("belum menikah") || t.includes("belum kawin") || t === "belum";
        if (want === "menikah" || want === "kawin") return (t === "menikah" || t === "kawin") && !t.includes("belum");
        if (want.includes("cerai hidup")) return t.includes("cerai hidup");
        if (want.includes("cerai mati")) return t.includes("cerai mati");
      }
      if (label === "Penyandang disabilitas") {
        if (want.includes("tidak")) return t.includes("tidak memiliki disabilitas") || t.includes("tidak ada") || t === "tidak";
      }
      if (label === "Pekerjaan") {
        if (isBelumBekerjaText(want)) return isBelumBekerjaText(t);
        if (want.includes("ibu rumah") || want === "irt" || want.includes("mengurus rumah")) {
          return t.includes("ibu rumah tangga") || t.includes("mengurus rumah tangga") || t === "irt" || t.includes("rumah tangga");
        }
        if (want.includes("wiraswasta") || want.includes("pedagang")) {
          return t.includes("wiraswasta") || t.includes("pedagang") || t.includes("wirausaha");
        }
        if (want.includes("petani") || want.includes("nelayan") || want.includes("buruh")) {
          return t.includes("petani") || t.includes("pekebun") || t.includes("nelayan") || t.includes("buruh");
        }
        if (want.includes("swasta") || want.includes("karyawan")) {
          return t.includes("swasta") || t.includes("karyawan");
        }
        if (want.includes("asn") || want.includes("pns") || want.includes("pemerintah")) {
          return t.includes("pegawai negeri") || t.includes("pns") || t.includes("asn");
        }
        if (want.includes("pelajar") || want.includes("mahasiswa") || want.includes("siswa")) {
          return t.includes("pelajar") || t.includes("mahasiswa") || t.includes("siswa");
        }
        if (want.length >= 4 && (t.includes(want) || want.includes(t))) return true;
      }
      return t === want || (want.length >= 4 && t.includes(want));
    };

    const trySearchPekerjaan = async () => {
      if (label !== "Pekerjaan") return;
      // HANYA cari input yang eksplisit memiliki placeholder "pekerjaan" — JANGAN PERNAH memakai placeholder*="cari"!
      const inp = document.querySelector('.modal-content input[placeholder*="pekerjaan" i], [role="dialog"] input[placeholder*="pekerjaan" i], input[placeholder*="pekerjaan" i]');
      if (!inp) return;
      let q = val;
      if (isBelumBekerjaText(want)) q = "Belum";
      else if (want.includes("ibu rumah") || want === "irt") q = "Rumah Tangga";
      else if (want.includes("wiraswasta") || want.includes("pedagang")) q = "Wiraswasta";
      else if (want.includes("petani") || want.includes("nelayan") || want.includes("buruh")) q = "Petani";
      else if (want.includes("swasta") || want.includes("karyawan")) q = "Swasta";
      else if (want.includes("asn") || want.includes("pns")) q = "Pegawai";
      else if (want.includes("pelajar") || want.includes("mahasiswa")) q = "Pelajar";
      setInp(inp, q);
      await e(300);
    };

    let opt = null;
    for (let k = 0; k < 18; k++) {
      if (findOpenLocInp()) return false;
      if (k === 2 && label === "Pekerjaan") {
        await trySearchPekerjaan();
      }
      // 1. Opsi div langsung seperti ckg-queue-assistant
      const zeroChildDivs = Array.from(document.querySelectorAll("div")).filter(el =>
        0 === el.children.length && matchOpt(el) && el.getBoundingClientRect().height > 8
      );
      if (zeroChildDivs.length > 0) { opt = zeroChildDivs[0]; break; }

      // 2. Opsi berkelas cursor-pointer, button modal, atau role option
      const candidates = Array.from(document.querySelectorAll(".modal-content button, [role='dialog'] button, div.cursor-pointer, [role='option'], li, button")).filter(el =>
        matchOpt(el) && el.getBoundingClientRect().height > 8
      );
      if (candidates.length > 0) { opt = candidates[0]; break; }

      await e(150);
    }

    if (opt) {
      const clickable = opt.closest(".cursor-pointer, [role='option'], button, li") || opt;
      clickable.scrollIntoView({ block: "center" });
      if (label === "Pekerjaan" || clickable.closest(".modal-content, [role='dialog']")) {
        clickModalItem(clickable);
      } else {
        n(clickable);
      }
      await e(350);
      if (label === "Pekerjaan") {
        await closeStuckSubModal("pekerjaan");
      }
      return true;
    }

    if (label === "Pekerjaan" && !findOpenLocInp()) {
      const inp = document.querySelector('.modal-content input[placeholder*="pekerjaan" i], [role="dialog"] input[placeholder*="pekerjaan" i], input[placeholder*="pekerjaan" i]');
      if (inp) {
        setInp(inp, "");
        await e(300);
      }
      const allJobOpts = Array.from(document.querySelectorAll(".modal-content button.py-4, .modal-content button, [role='dialog'] button, .modal-content div.cursor-pointer, div.cursor-pointer, [role='option'], li")).filter(el => {
        if (!el || el === trig || trig.contains(el) || el.tagName === "INPUT" || el.querySelector("input")) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height < 12) return false;
        const t = norm(el.textContent);
        if (!t || t.length > 55 || /^pilih\b/.test(t) || /^(tutup|batal|kembali|x|✕|×|simpan|selanjutnya)$/i.test(t)) return false;
        return el.children.length <= 2;
      });
      const fallbackBelum = allJobOpts.find(el => isBelumBekerjaText(el.textContent)) || allJobOpts[0];
      if (fallbackBelum) {
        clickModalItem(fallbackBelum);
        await e(350);
      }
      await closeStuckSubModal("pekerjaan");
      return !!fallbackBelum;
    }

    return false;
  };

  // Helper pemilihan Alamat Domisili 4 tingkat (Provinsi -> Kab/Kota -> Kecamatan -> Kelurahan) — Presisi Sesuai Excel
  const selectAlamat = async (alamatParts, detailText = "") => {
    let raw4 = [
      (alamatParts && alamatParts[0]) || "",
      (alamatParts && alamatParts[1]) || "",
      (alamatParts && alamatParts[2]) || "",
      (alamatParts && alamatParts[3]) || ""
    ].map(s => String(s || "").trim());

    // Jika slot pertama (provinsi) tidak sengaja berisi pekerjaan/status akibat pergeseran kolom template, geser balik ke [prov, kab, kec, kel]
    if (raw4[0] && isNonAddressValue(raw4[0])) {
      raw4 = [
        raw4[1] || "",
        raw4[2] || "",
        raw4[3] || "",
        (!isNonAddressValue(detailText) ? String(detailText || "").trim() : "")
      ];
    }

    // Bersihkan semua slot dari nilai non-alamat (pekerjaan, status kawin, asuransi, dll.)
    const parts4 = raw4.map(s => (isNonAddressValue(s) ? "" : s));

    if (!parts4.some(Boolean)) return false;

    // Pastikan modal Pilih Pekerjaan tidak menghalangi
    await closeStuckSubModal("pekerjaan");

    const findLocInp = findOpenLocInp;

    // Normalisasi nama wilayah (mendukung angka Romawi <-> kata angka: "Ilir Barat Dua" === "Ilir Barat II" === "Ilir Barat 2")
    const normWil = s => {
      return norm(s)
        .replace(/^[•·\-\*]+\s*/, "")
        .replace(/^(prov\.?|provinsi|kab\.?|kabupaten|kota|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/i, "")
        .replace(/\b(kesatu|pertama|satu|i)\b/g, "1")
        .replace(/\b(kedua|dua|ii)\b/g, "2")
        .replace(/\b(ketiga|tiga|iii)\b/g, "3")
        .replace(/\b(keempat|empat)\b/g, "4")
        .replace(/\b(kelima|lima|v)\b/g, "5")
        .replace(/\b(keenam|enam|vi)\b/g, "6")
        .replace(/\b(ketujuh|tujuh|vii)\b/g, "7")
        .replace(/\b(kedelapan|delapan|viii)\b/g, "8")
        .replace(/\b(kesembilan|sembilan|ix)\b/g, "9")
        .replace(/\b(kesepuluh|sepuluh|x)\b/g, "10")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const toRoman = s => {
      return String(s || "")
        .replace(/\b(kesatu|pertama|satu)\b/gi, "I")
        .replace(/\b(kedua|dua)\b/gi, "II")
        .replace(/\b(ketiga|tiga)\b/gi, "III")
        .replace(/\b(keempat|empat)\b/gi, "IV")
        .replace(/\b(kelima|lima)\b/gi, "V")
        .replace(/\b(keenam|enam)\b/gi, "VI")
        .replace(/\b(ketujuh|tujuh)\b/gi, "VII")
        .replace(/\b(kedelapan|delapan)\b/gi, "VIII")
        .replace(/\b(kesembilan|sembilan)\b/gi, "IX")
        .replace(/\b(kesepuluh|sepuluh)\b/gi, "X");
    };

    const trigAddr = a("Alamat Domisili", "Pilih alamat domisili") || a("Domisili") || a("Alamat");

    // Jika modal Pilih Lokasi belum terbuka, cek apakah sudah terisi atau klik trigger untuk membuka
    if (!findLocInp()) {
      if (!trigAddr) return false;

      const spanAddr = trigAddr.querySelector("span.line-clamp-2") || trigAddr;
      const curAddr = normWil(spanAddr.textContent || "");
      const nonEmptyParts = parts4.filter(Boolean);
      const lastPart = nonEmptyParts.length ? normWil(nonEmptyParts[nonEmptyParts.length - 1]) : "";

      if (curAddr && !curAddr.startsWith("pilih") && lastPart && curAddr.includes(lastPart)) {
        return true;
      }

      n(trigAddr);
      await e(600);

      if (!findLocInp()) {
        const innerClick = trigAddr.querySelector(".cursor-pointer, span.line-clamp-2, span, div") || trigAddr;
        clickModalItem(innerClick);
        await e(600);
      }
    }

    // Ambil HANYA tombol opsi di bawah "Daftar Provinsi/Kabupaten/Kecamatan/Kelurahan"
    // JANGAN PERNAH mengambil pill breadcrumb ("• Aceh" / "• Sumatera Selatan") di bawah "Pilih Lokasi"!
    const getAllModalBtns = () => {
      const inp = findLocInp();
      const root = inp ? (inp.closest(".modal-content, [role='dialog'], .modal, div.fixed") || document) : document;
      const inpRect = inp ? inp.getBoundingClientRect() : null;

      const rawBtns = Array.from(root.querySelectorAll(
        ".modal-content button.py-4, [role='dialog'] button.py-4, button.py-4, .modal-content button, [role='dialog'] button, .modal-content div.cursor-pointer, [role='dialog'] div.cursor-pointer, div.cursor-pointer, [role='button'], [role='option'], li"
      ));
      return rawBtns.filter(b => {
        if (b.disabled || b.tagName === "INPUT" || b.querySelector("input") || b.tagName === "TEXTAREA") return false;
        const rawTxt = (b.textContent || "").trim();
        const txt = norm(rawTxt);
        if (!txt || txt.length > 65) return false;
        // Abaikan huruf abjad tunggal pembagi kelompok ("A", "B", "C", "S", dll) & tombol navigasi/breadcrumb ("• ...")
        if (txt.length <= 1 || /^[•·]/.test(rawTxt)) return false;
        if (/^(tutup|batal|kembali|x|✕|×|simpan|selanjutnya|pilih alamat domisili|pilih lokasi|daftar provinsi|daftar kabupaten|daftar kecamatan|daftar kelurahan)$/i.test(txt)) return false;
        const r = b.getBoundingClientRect();
        if (r.width <= 0 || r.height < 14) return false;
        if (inpRect && r.top < inpRect.bottom + 5) return false;
        return true;
      });
    };

    const findModalBtn = targetAddr => {
      if (!targetAddr || isNonAddressValue(targetAddr)) return null;
      const wantRaw = norm(targetAddr);
      const wantWil = normWil(targetAddr);
      if (!wantWil) return null;
      const btns = getAllModalBtns();

      // 1. Exact match (termasuk prefix Kab/Kota penuh, misal "kota palembang" === "kota palembang" atau "sumatera selatan" === "sumatera selatan")
      let match = btns.find(b => norm(b.textContent) === wantRaw);
      if (match) return match;

      // 2. Exact match setelah normalisasi wilayah & angka Romawi ("ilir barat dua" === "ilir barat ii")
      match = btns.find(b => {
        const bWil = normWil(b.textContent);
        return bWil === wantWil;
      });
      if (match) return match;

      // 3. Partial match (tetap mempertahankan spasi antar kata!)
      match = btns.find(b => {
        const bRaw = norm(b.textContent);
        const bWil = normWil(b.textContent);
        return (wantWil.length >= 3 && (bWil.includes(wantWil) || wantWil.includes(bWil))) || bRaw.includes(wantRaw);
      });
      return match || null;
    };

    // Buat daftar kata kunci pencarian PERSIS SESUAI EXCEL (SPASI TETAP UTUH, JANGAN PERNAH DIGABUNG!)
    const buildSearchQueries = addr => {
      if (!addr || isNonAddressValue(addr)) return [];
      const clean = addr.replace(/^(prov\.?|provinsi|kab\.?|kabupaten|kota|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/i, "").trim();
      const roman = toRoman(clean);
      const list = [clean, addr];
      if (roman && roman !== clean) list.push(roman);
      return Array.from(new Set(list.filter(s => s && s.length >= 2 && !isNonAddressValue(s))));
    };

    for (let idx = 0; idx < 4; idx++) {
      const addr = parts4[idx];
      if (!addr && idx < 3) break;

      for (let w = 0; w < 12; w++) {
        if (findLocInp() || getAllModalBtns().length > 0) break;
        await e(150);
      }

      let btn = null;

      if (addr && !isNonAddressValue(addr)) {
        const queries = buildSearchQueries(addr);
        for (const q of queries) {
          const inp = findLocInp();
          if (inp) {
            setInp(inp, q);
            await e(400);
          }
          // Beri waktu bagi pencarian CKG untuk menyelesaikan debounce dan menampilkan hasil
          for (let k = 0; k < 15; k++) {
            btn = findModalBtn(addr);
            if (btn) break;
            await e(200);
          }
          if (btn) break;
        }

        // Jika dengan filter belum ketemu, kosongkan filter agar semua daftar pada tingkat ini muncul lalu cari lagi
        if (!btn) {
          const inp = findLocInp();
          if (inp && inp.value) {
            setInp(inp, "");
            await e(400);
          }
          for (let k = 0; k < 12; k++) {
            btn = findModalBtn(addr);
            if (btn) break;
            await e(200);
          }
        }
      }

      // HANYA fallback ke item pertama pada tingkat terakhir (Kelurahan/Desa, idx === 3) jika nama desa/dusun di Excel tidak terdaftar di CKG
      if (!btn && idx === 3) {
        const inp = findLocInp();
        if (inp && inp.value) {
          setInp(inp, "");
          await e(350);
        }
        const btns = getAllModalBtns();
        btn = btns[0] || null;
      }

      if (!btn) break;
      btn.scrollIntoView({ block: "center" });
      btn.click();
      await e(800);
    }

    await e(250);
    return true;
  };

  let jobVal = form.pekerjaan || form.job || "Belum/Tidak Bekerja";
  if (/^(pbi\b|non[\s-]*pbi|bpjs|kis\b|jamkesmas|jamsostek|asuransi\b|pasien\s*umum\b|^umum$|^mandiri$|apbn\b|apbd\b)/i.test(jobVal) || /\bpbi\b/i.test(jobVal)) {
    jobVal = "Belum/Tidak Bekerja";
  }

  const rawAlamat = Array.isArray(form.alamat) ? form.alamat : [];
  let resolvedAlamat = [
    form.prov || rawAlamat[0] || "",
    form.kab || rawAlamat[1] || "",
    form.kec || rawAlamat[2] || "",
    form.kel || rawAlamat[3] || ""
  ];

  // Jika slot pertama adalah pekerjaan/status (akibat kolom bergeser), geser balik ke [prov, kab, kec, kel]
  if (resolvedAlamat[0] && isNonAddressValue(resolvedAlamat[0])) {
    resolvedAlamat = [
      resolvedAlamat[1] || "",
      resolvedAlamat[2] || "",
      resolvedAlamat[3] || "",
      (!isNonAddressValue(form.detail || form.detailAlamat) ? String(form.detail || form.detailAlamat || "").trim() : "")
    ];
  }
  resolvedAlamat = resolvedAlamat.map(s => (isNonAddressValue(s) ? "" : s));

  const nonEmptyAddr = resolvedAlamat.filter(Boolean);
  const rawDetail = String(form.detail || form.detailAlamat || "").trim();
  const cleanDetail = (!isNonAddressValue(rawDetail) && rawDetail) ? rawDetail : (nonEmptyAddr[nonEmptyAddr.length - 1] || "-");

  const data = {
    status: form.status || form.statusPernikahan || "Menikah",
    disabilitas: form.disabilitas || "Tidak memiliki disabilitas",
    pekerjaan: jobVal,
    alamat: resolvedAlamat,
    detail: cleanDetail
  };

  await e(300);

  // Jika saat fillDetailForm dipanggil modal Pilih Lokasi SUDAH terbuka (misal dibuka oleh CDP di verifyRound),
  // LANGSUNG isi Alamat Domisili terlebih dahulu tanpa menyentuh Pekerjaan/Status Pernikahan!
  if (findOpenLocInp()) {
    await selectAlamat(data.alamat, data.detail);
    await e(350);
  }

  // 1. Status Pernikahan
  await selectDropdown("Status Pernikahan", data.status);
  await e(300);

  // 2. Penyandang Disabilitas
  await selectDropdown("Penyandang disabilitas", data.disabilitas);
  await e(300);

  // 3. Pekerjaan
  await selectDropdown("Pekerjaan", data.pekerjaan);
  await e(350);

  // 4. Alamat Domisili (4 Tingkat: Provinsi -> Kab/Kota -> Kecamatan -> Kelurahan)
  await selectAlamat(data.alamat, data.detail);
  await e(350);

  // 5. Detail Alamat Domisili
  const txtArea = document.querySelector("#detail-domisili") || document.querySelector('textarea[name="detail-domisili"]') || document.querySelector("textarea");
  if (txtArea && (!txtArea.value || !txtArea.value.trim())) {
    const curAddrTxt = norm((a("Alamat Domisili")?.querySelector("span.line-clamp-2") || a("Alamat Domisili"))?.textContent || "");
    const fallbackDetail = (data.detail && data.detail !== "-")
      ? data.detail
      : (curAddrTxt && !curAddrTxt.startsWith("pilih") ? curAddrTxt.split(",").pop().trim() : "-");
    setInp(txtArea, fallbackDetail.slice(0, 60));
    await e(200);
  }

  // Pengaman retry jika ada field yang masih belum terpilih
  const trigPernikahan = a("Status Pernikahan");
  if (trigPernikahan) {
    const cur = norm((trigPernikahan.querySelector("span.line-clamp-2") || trigPernikahan).textContent || "");
    if (!cur || cur.startsWith("pilih")) {
      await selectDropdown("Status Pernikahan", data.status);
      await e(300);
    }
  }

  const trigPekerjaan = a("Pekerjaan");
  if (trigPekerjaan) {
    const cur = norm((trigPekerjaan.querySelector("span.line-clamp-2") || trigPekerjaan).textContent || "");
    if (!cur || cur.startsWith("pilih")) {
      await selectDropdown("Pekerjaan", data.pekerjaan);
      await e(300);
    }
  }

  const trigAlamat = a("Alamat Domisili");
  if (trigAlamat) {
    const cur = norm((trigAlamat.querySelector("span.line-clamp-2") || trigAlamat).textContent || "");
    if (!cur || cur.startsWith("pilih")) {
      await selectAlamat(data.alamat, data.detail);
      await e(300);
    }
  }

  return true;
}

const fillDetailFormUmum = fillDetailForm;

// -------------------------------------------------------------
// Step 2 Form Detail (SEKOLAH)
// -------------------------------------------------------------

async function fillDetailFormSekolah(form) {
  try {
    const e = ms => new Promise(r => setTimeout(r, ms));
    const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

    // Mouse event click yang andal persis CKG Umum (dispatch event lengkap + native click)
    const n = el => {
      if (!el) return;
      try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (err) {}
      const rect = el.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: Math.round(rect.x + (rect.width > 0 ? rect.width / 2 : 10)),
        clientY: Math.round(rect.y + (rect.height > 0 ? rect.height / 2 : 10))
      };
      ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(evt => {
        try { el.dispatchEvent(new MouseEvent(evt, opts)); } catch (err) {}
      });
      if (typeof el.click === "function") {
        try { el.click(); } catch (err) {}
      } else {
        try { el.dispatchEvent(new MouseEvent("click", opts)); } catch (err) {}
      }
    };

    // Helper klik baris kandidat yang sangat presisi (multi-target: daun teks, row container, & elementFromPoint)
    const clickCandidateRow = async el => {
      if (!el) return false;
      const clickable = el.closest("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, div.py-2") || el;
      try { clickable.scrollIntoView({ block: "center", inline: "center" }); } catch (err) {}
      await e(60);

      const rect = clickable.getBoundingClientRect();
      const x = Math.round(rect.x + (rect.width > 0 ? rect.width / 2 : 10));
      const y = Math.round(rect.y + (rect.height > 0 ? rect.height / 2 : 10));
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

      const hitEl = (x > 0 && y > 0) ? document.elementFromPoint(x, y) : null;
      const targets = [hitEl, clickable, el].filter((t, idx, arr) => t && arr.indexOf(t) === idx);

      for (const tgt of targets) {
        ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
          try { tgt.dispatchEvent(new MouseEvent(evt, opts)); } catch (err) {}
        });
      }

      if (hitEl && typeof hitEl.click === "function") {
        try { hitEl.click(); } catch (err) {}
      }
      if (typeof clickable.click === "function") {
        try { clickable.click(); } catch (err) {}
      }
      if (el !== clickable && typeof el.click === "function") {
        try { el.click(); } catch (err) {}
      }

      await e(350);
      return true;
    };

    // Helper mencari trigger field berdasarkan placeholder atau teks label
    const a = (label, placeholder) => {
      const wantLabel = norm(label);
      const wantPh = placeholder ? norm(placeholder) : "";

      // 1. Cari berdasarkan placeholder di dalam elemen box langsung
      if (wantPh) {
        const triggers = Array.from(document.querySelectorAll("div.cursor-pointer, div[role='combobox'], div[role='button'], button, div.border"));
        for (const trg of triggers) {
          const txt = norm(trg.textContent);
          if (txt === wantPh || (txt.includes(wantPh) && txt.length < 50)) {
            const r = trg.getBoundingClientRect();
            if (r.width > 0 && r.height > 10) return trg;
          }
        }
      }

      // 2. Cari berdasarkan label heading di atas box
      const lbls = Array.from(document.querySelectorAll("div.font-semibold, label, div.text-sm, div.font-medium, p.font-semibold, p, span.font-semibold, span, h4, h5"));
      const match = lbls.find(el => {
        if (el.children.length > 2) return false;
        const txt = norm(el.textContent.replace(/[*:]/g, ""));
        return txt === wantLabel ||
               txt.startsWith(wantLabel) ||
               wantLabel.startsWith(txt) ||
               ((wantLabel.includes("pernikahan") || wantLabel.includes("kawin") || wantLabel.includes("perkawinan")) && (txt.includes("pernikahan") || txt.includes("kawin") || txt.includes("perkawinan") || txt.includes("status"))) ||
               (wantLabel.includes("disabilitas") && (txt.includes("disabilitas") || txt.includes("penyandang"))) ||
               ((wantLabel.includes("alamat") || wantLabel.includes("domisili")) && (txt.includes("alamat") || txt.includes("domisili") || txt.includes("lokasi"))) ||
               ((wantLabel.includes("pekerjaan") || wantLabel.includes("profesi")) && (txt.includes("pekerjaan") || txt.includes("profesi"))) ||
               ((wantLabel.includes("sekolah") || wantLabel.includes("pendidikan")) && txt.includes("sekolah"));
      });
      if (!match) return null;
      let container = match.nextElementSibling;
      if (!container && match.parentElement) {
        container = match.parentElement.nextElementSibling;
      }
      if (!container) return null;
      return container.querySelector(".cursor-pointer, [role='combobox'], [role='button'], div.border, button") ||
             (container.classList.contains("cursor-pointer") ? container : null) ||
             container;
    };

    const extractClassNum = s => {
      if (!s) return null;
      const str = String(s).trim().toLowerCase();
      const m = str.match(/\b\d+\b/) || str.match(/\d+/);
      if (m) return parseInt(m[0], 10);
      if (/\bxii\b/.test(str)) return 12;
      if (/\bxi\b/.test(str)) return 11;
      if (/\bx\b/.test(str)) return 10;
      if (/\bix\b/.test(str)) return 9;
      if (/\bviii\b/.test(str)) return 8;
      if (/\bvii\b/.test(str)) return 7;
      if (/\bvi\b/.test(str)) return 6;
      if (/\bv\b/.test(str)) return 5;
      if (/\biv\b/.test(str)) return 4;
      if (/\biii\b/.test(str)) return 3;
      if (/\bii\b/.test(str)) return 2;
      if (/\bi\b/.test(str)) return 1;
      return null;
    };

    const setInp = (inp, val) => {
      if (!inp) return;
      try { inp.focus(); } catch (err) {}
      const proto = inp instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(inp, val);
      else inp.value = val;
      inp.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: val }));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      try { inp.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", keyCode: 13 })); } catch (err) {}
      try { inp.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", keyCode: 13 })); } catch (err) {}
    };

    // Helper dropdown yang tangguh untuk Status Pernikahan & Penyandang Disabilitas
    const selectDropdown = async (label, val, placeholder) => {
      if (!val) return false;
      const trig = a(label, placeholder);
      if (!trig) return false;

      const cur = norm(trig.textContent || "");
      const want = norm(val);

      if (cur && !cur.startsWith("pilih")) {
        if (label === "Status Pernikahan" && cur.includes(want)) return true;
        if (label === "Penyandang disabilitas" && cur.includes("tidak") && want.includes("tidak")) return true;
        if (label === "Pekerjaan" && (cur.includes("pelajar") || cur.includes("mahasiswa") || cur.includes("belum"))) return true;
        if (cur === want) return true;
      }

      n(trig);
      await e(350);

      const matchOpt = el => {
        if (!el || el === trig || trig.contains(el)) return false;
        if (el.tagName === "INPUT" || el.querySelector("input") || el.tagName === "TEXTAREA") return false;
        const t = norm(el.innerText || el.textContent);
        if (!t || t.length > 50 || /^pilih\b/.test(t) || /^(tutup|batal|kembali|x|✕)$/i.test(t)) return false;
        if (el.children.length > 1) return false;

        if (label === "Status Pernikahan") {
          if (want.includes("belum")) return t.includes("belum menikah") || t.includes("belum kawin") || t === "belum";
          if (want === "menikah" || want === "kawin") return (t === "menikah" || t === "kawin") && !t.includes("belum");
          if (want.includes("cerai hidup")) return t.includes("cerai hidup");
          if (want.includes("cerai mati")) return t.includes("cerai mati");
        }
        if (label === "Penyandang disabilitas") {
          if (want.includes("tidak")) return t.includes("tidak memiliki disabilitas") || (t.includes("tidak") && !t.includes("memiliki disablilitas") && !t.includes("memiliki disabilitas"));
          return t.includes("memiliki disabilitas") || t.includes("memiliki disablilitas");
        }
        if (label === "Pekerjaan") {
          if (want.includes("pelajar") || want.includes("siswa") || want.includes("mahasiswa")) {
            return t.includes("pelajar") || t.includes("mahasiswa") || t.includes("siswa");
          }
          if (want.includes("belum") || want.includes("tidak")) {
            return (/belum|tidak/i.test(t) && /bekerja/i.test(t)) || t === "belum";
          }
          return t === want || (want.length >= 4 && t.includes(want));
        }
        return t === want || (want.length >= 4 && t.includes(want));
      };

      let opt = null;
      for (let k = 0; k < 20; k++) {
        const popperOpts = Array.from(document.querySelectorAll(".v-popper__popper div, .v-popper__popper li, [role='listbox'] [role='option'], div.cursor-pointer, [role='option'], li, div")).filter(matchOpt);
        if (popperOpts.length > 0) {
          opt = popperOpts.find(o => norm(o.textContent) === want) || popperOpts[0];
          break;
        }
        await e(150);
      }

      if (opt) {
        await clickCandidateRow(opt);
        return true;
      }

      return false;
    };

    const data = {
      status: "Belum Menikah",
      disabilitas: "Tidak memiliki disabilitas",
      pekerjaan: form.pekerjaan || "Pelajar/Mahasiswa",
      sekolah: form.sekolah || form.namasekolah || form.namaSekolah || "",
      kelas: form.kelas || form.tingkat || form.jenjang || "",
      alamat: (form.alamat && form.alamat.length) ? form.alamat : [],
      detail: form.detail || form.detailAlamat || ""
    };

    await e(300);

    // =========================================================
    // 0. PEKERJAAN (Jika muncul di form CKG Sekolah, default: Pelajar/Mahasiswa)
    // =========================================================
    const trigPek = a("Pekerjaan", "Pilih pekerjaan");
    if (trigPek) {
      const curP = norm((trigPek.querySelector("span.line-clamp-2") || trigPek).textContent || "");
      if (!curP || curP.startsWith("pilih")) {
        await selectDropdown("Pekerjaan", data.pekerjaan, "Pilih pekerjaan");
        await e(300);
      }
    }

    // =========================================================
    // 1. STATUS PERNIKAHAN (Default: Belum Menikah)
    // =========================================================
    await selectDropdown("Status Pernikahan", data.status, "Pilih status pernikahan");
    await e(300);

    // =========================================================
    // 2. PENYANDANG DISABILITAS (Default: Tidak memiliki disabilitas)
    // =========================================================
    await selectDropdown("Penyandang disabilitas", data.disabilitas, "Pilih penyandang disabilitas");
    await e(300);

    // =========================================================
    // 3. NAMA SEKOLAH (Modal "Pilih Sekolah")
    // =========================================================
    const trigSek = a("Nama Sekolah", "Pilih nama sekolah") || a("Sekolah", "Pilih sekolah");
    if (trigSek) {
      const cur = norm(trigSek.textContent || "");
      const want = norm(data.sekolah);
      const needsSelectSekolah = !cur || cur.startsWith("pilih") || (want && !cur.includes(want) && !want.includes(cur));

      if (needsSelectSekolah) {
        n(trigSek);
        await e(600);

        const findSchoolInp = () => {
          return document.querySelector('.modal-content input[placeholder*="sekolah" i], .modal-content input[placeholder*="cari" i], [role="dialog"] input[placeholder*="sekolah" i], [role="dialog"] input[placeholder*="cari" i], input[placeholder*="Cari nama sekolah" i], input[placeholder*="sekolah" i], input[placeholder*="nama sekolah" i]');
        };

        const getSchoolRoot = () => {
          const inp = findSchoolInp();
          if (inp) {
            return inp.closest(".modal-content, [role='dialog'], .modal, div.fixed") || document;
          }
          return document.querySelector(".modal-content, [role='dialog'], .modal, div.fixed") || document;
        };

        const normalizeSchoolTokens = str => {
          return norm(str)
            .replace(/\b(sd|smp|sma|smk|mi|mts|ma)n\b/g, "$1 negeri")
            .replace(/\bsds\b/g, "sd swasta")
            .replace(/\bsmps\b/g, "smp swasta")
            .replace(/\bsmas\b/g, "sma swasta")
            .replace(/\bsmks\b/g, "smk swasta")
            .replace(/\b0+(\d+)\b/g, "$1")
            .replace(/[^a-z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        };

        const scoreSchoolMatch = (rowEl, targetWant) => {
          const tClean = normalizeSchoolTokens(rowEl.textContent);
          const wClean = normalizeSchoolTokens(targetWant);
          if (!wClean || !tClean) return 0;
          if (tClean === wClean) return 1000;
          if (wClean.length >= 5 && tClean.includes(wClean)) return 800 + wClean.length;
          if (tClean.length >= 5 && wClean.includes(tClean)) return 750 + tClean.length;

          const wTokens = wClean.split(/\s+/).filter(x => x.length >= 1);
          const tTokens = tClean.split(/\s+/).filter(x => x.length >= 1);
          if (wTokens.length === 0 || tTokens.length === 0) return 0;

          // Cek kecocokan angka sekolah (misal SDN 1 vs SDN 2 jangan sampai salah pilih!)
          const wNums = wTokens.filter(x => /^\d+$/.test(x));
          const tNums = tTokens.filter(x => /^\d+$/.test(x));
          if (wNums.length > 0 && tNums.length > 0 && !wNums.some(n => tNums.includes(n))) {
            return 0;
          }

          let matchedWords = 0;
          let strongWords = 0;
          const genericStop = new Set(["sekolah", "negeri", "swasta", "islam", "terpadu", "unggulan"]);
          for (const wt of wTokens) {
            if (tTokens.includes(wt) || (wt.length >= 4 && tClean.includes(wt))) {
              matchedWords++;
              if (!genericStop.has(wt)) strongWords++;
            }
          }

          if (matchedWords === wTokens.length && wTokens.length >= 2) {
            return 600 + matchedWords * 25;
          }
          const ratio = matchedWords / wTokens.length;
          if (matchedWords >= 2 && strongWords >= 1 && ratio >= 0.5) {
            return Math.round(ratio * 400) + strongWords * 30;
          }
          return 0;
        };

        const matchSchool = (rowEl, targetWant) => scoreSchoolMatch(rowEl, targetWant) > 0;

        const findSchoolCandidate = targetWant => {
          const root = getSchoolRoot();
          const inp = findSchoolInp();
          const inpRect = inp ? inp.getBoundingClientRect() : null;

          const allEls = Array.from(root.querySelectorAll("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, div.py-2, span, p")).filter(el => {
            if (el.tagName === "INPUT" || el.querySelector("input") || el.tagName === "TEXTAREA") return false;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height < 10) return false;
            if (inpRect && r.top < inpRect.bottom - 5) return false;
            const t = norm(el.textContent);
            if (!t || t.length > 95 || t.length < 2) return false;
            if (/^(pilih sekolah|cari nama sekolah|tutup|batal|kembali|x|✕|tidak ada data|data tidak ditemukan)$/i.test(t)) return false;
            return true;
          });

          if (targetWant) {
            const scored = allEls
              .map(el => ({ el, score: scoreSchoolMatch(el, targetWant) }))
              .filter(item => item.score > 0)
              .sort((a, b) => b.score - a.score);
            if (scored.length > 0) {
              const bestScore = scored[0].score;
              const topGroup = scored.filter(item => item.score >= bestScore - 15).map(item => item.el);
              const leaf = topGroup.find(el => !Array.from(el.children).some(c => topGroup.includes(c)));
              return leaf || topGroup[0];
            }
          }

          if (inpRect) {
            const below = allEls.filter(el => {
              const r = el.getBoundingClientRect();
              return r.top >= inpRect.bottom - 5 && r.height >= 15;
            });
            const row = below.find(el => el.matches("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3")) || below[0];
            if (row) return row;
          }

          return allEls[0] || null;
        };

        let optSek = null;

        if (want) {
          const inp = findSchoolInp();
          if (inp) {
            const expandedQuery = data.sekolah
              .replace(/\b(sd|smp|sma|smk|mi|mts|ma)n\b/gi, "$1 negeri ")
              .replace(/\s+/g, " ")
              .trim();
            setInp(inp, expandedQuery);
            await e(400);
          }

          const startSek = Date.now();
          while (Date.now() - startSek < 1200) {
            optSek = findSchoolCandidate(want);
            if (optSek) break;
            await e(100);
          }

          // Query 2: Jika belum ketemu, coba cari berdasarkan kata kunci inti nama sekolah (misal "Sesela")
          if (!optSek) {
            const inp2 = findSchoolInp();
            const coreName = data.sekolah
              .replace(/^(sd|smp|sma|smk|mi|mts|ma|sdn|smpn|sman|smkn)\s*(negeri|swasta|islam)?\s*/i, "")
              .trim();
            if (inp2 && coreName && coreName.length >= 3) {
              setInp(inp2, coreName);
              await e(400);
              for (let k = 0; k < 8; k++) {
                optSek = findSchoolCandidate(want);
                if (optSek) break;
                await e(100);
              }
            }
          }
        }

        // Fallback: Jika tidak ketemu dalam 1.2 detik atau sekolah kosong di Excel,
        // KOSONGKAN input filter agar seluruh daftar sekolah di Puskesmas muncul kembali, lalu pilih baris pertama!
        if (!optSek) {
          const inp = findSchoolInp();
          if (inp) {
            setInp(inp, "");
            await e(300);
          }
          for (let k = 0; k < 10; k++) {
            optSek = findSchoolCandidate("");
            if (optSek) break;
            await e(150);
          }
        }

        if (optSek) {
          await clickCandidateRow(optSek);
        }

        // Tunggu hingga modal Pilih Sekolah benar-benar tertutup
        for (let m = 0; m < 25; m++) {
          const stillOpen = !!document.querySelector('input[placeholder*="Cari nama sekolah" i], input[placeholder*="sekolah" i]');
          if (!stillOpen) break;
          // Retry klik jika masih terbuka
          if (m % 3 === 0) {
            const retryOpt = findSchoolCandidate(want) || optSek;
            if (retryOpt) await clickCandidateRow(retryOpt);
          }
          await e(150);
        }

        // JEDA 1.5 DETIK: Sangat penting agar server memuat kelas dan mengaktifkan field Jenjang Pendidikan!
        await e(1500);
      }
    }

    // =========================================================
    // 4. JENJANG PENDIDIKAN / KELAS (Modal "Pilih jenjang pendidikan")
    // =========================================================
    let trigKel = null;
    for (let waitTrig = 0; waitTrig < 15; waitTrig++) {
      trigKel = a("Jenjang Pendidikan", "Pilih jenjang pendidikan") || a("Tingkat Pendidikan") || a("Kelas");
      if (trigKel) break;
      await e(200);
    }

    if (trigKel) {
      const cur = norm(trigKel.textContent || "");
      const targetNum = extractClassNum(data.kelas);

      let needSelectKelas = !cur || cur.startsWith("pilih");
      if (!needSelectKelas && targetNum) {
        needSelectKelas = extractClassNum(cur) !== targetNum;
      }

      if (needSelectKelas) {
        n(trigKel);
        await e(600);

        const findKelasInp = () => {
          return document.querySelector('input[placeholder*="Cari jenjang pendidikan" i], input[placeholder*="jenjang" i], input[placeholder*="kelas" i]');
        };

        const getKelasRoot = () => {
          const inp = findKelasInp();
          if (inp) {
            return inp.closest(".modal-content, [role='dialog'], .modal, div.fixed") || document;
          }
          return document.querySelector(".modal-content, [role='dialog'], .modal, div.fixed") || document;
        };

        const findKelasCandidate = num => {
          const root = getKelasRoot();
          const inp = findKelasInp();
          const inpRect = inp ? inp.getBoundingClientRect() : null;

          const allEls = Array.from(root.querySelectorAll("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, div.py-2, span, p")).filter(el => {
            if (el.tagName === "INPUT" || el.querySelector("input") || el.tagName === "TEXTAREA") return false;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height < 10) return false;
            if (inpRect && r.top < inpRect.bottom - 5) return false;
            const t = norm(el.textContent);
            if (!t || t.length > 50 || t.length < 2) return false;
            if (/^(pilih jenjang pendidikan|cari jenjang pendidikan|tutup|batal|kembali|x|✕)$/i.test(t)) return false;
            return true;
          });

          if (num) {
            const matched = allEls.filter(r => extractClassNum(r.textContent) === num);
            if (matched.length > 0) {
              const leaf = matched.find(el => !Array.from(el.children).some(c => extractClassNum(c.textContent) === num));
              return leaf || matched[matched.length - 1];
            }
          }

          if (inpRect) {
            const below = allEls.filter(el => {
              const r = el.getBoundingClientRect();
              return r.top >= inpRect.bottom - 5 && r.height >= 15;
            });
            const row = below.find(el => el.matches("button, [role='option'], [role='button'], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3")) || below[0];
            if (row) return row;
          }

          return allEls[0] || null;
        };

        let optKel = null;

        if (targetNum) {
          const inp = findKelasInp();
          if (inp) {
            setInp(inp, String(targetNum));
            await e(300);
          }

          const startKel = Date.now();
          while (Date.now() - startKel < 1000) {
            optKel = findKelasCandidate(targetNum);
            if (optKel) break;
            await e(100);
          }
        }

        // Fallback: jika kelas tidak ketemu atau kosong di Excel, kosongkan filter dan ambil opsi pertama (misal Kelas 7)
        if (!optKel) {
          const inp = findKelasInp();
          if (inp) {
            setInp(inp, "");
            await e(250);
          }
          for (let k = 0; k < 10; k++) {
            optKel = findKelasCandidate(null);
            if (optKel) break;
            await e(150);
          }
        }

        if (optKel) {
          await clickCandidateRow(optKel);
        }

        // Tunggu modal kelas tertutup
        for (let m = 0; m < 25; m++) {
          const stillOpen = !!document.querySelector('input[placeholder*="Cari jenjang pendidikan" i], input[placeholder*="jenjang" i]');
          if (!stillOpen) break;
          if (m % 3 === 0) {
            const retryOpt = findKelasCandidate(targetNum) || optKel;
            if (retryOpt) await clickCandidateRow(retryOpt);
          }
          await e(150);
        }
        await e(500);
      }
    }

    // =========================================================
    // 5. ALAMAT DOMISILI (Modal "Pilih Lokasi" 4 Tingkat Presisi Sesuai Excel)
    // =========================================================
    const selectAlamat = async (alamatParts, detailText = "") => {
      const parts4 = [
        (alamatParts && alamatParts[0]) || form.prov || "",
        (alamatParts && alamatParts[1]) || form.kab || "",
        (alamatParts && alamatParts[2]) || form.kec || "",
        (alamatParts && alamatParts[3]) || form.kel || ""
      ].map(s => String(s || "").trim());

      const nonEmpty = parts4.filter(Boolean);
      if (!nonEmpty.length) return false;

      const findLocInp = () => {
        const inps = Array.from(document.querySelectorAll(
          '.modal-content input[placeholder^="Cari" i], [role="dialog"] input[placeholder^="Cari" i], input[placeholder*="Provinsi" i], input[placeholder*="Kabupaten" i], input[placeholder*="Kota" i], input[placeholder*="Kecamatan" i], input[placeholder*="Kelurahan" i], input[placeholder*="Desa" i]'
        ));
        return inps.find(inp => {
          const r = inp.getBoundingClientRect();
          const ph = (inp.placeholder || "").toLowerCase();
          return r.width > 0 && r.height > 0 && !/pekerjaan|sekolah|jenjang|nik|nama/i.test(ph);
        }) || null;
      };

      const normWil = s => {
        return norm(s)
          .replace(/^[•·\-\*]+\s*/, "")
          .replace(/^(prov\.?|provinsi|kab\.?|kabupaten|kota|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/i, "")
          .replace(/\b(kesatu|pertama|satu|i)\b/g, "1")
          .replace(/\b(kedua|dua|ii)\b/g, "2")
          .replace(/\b(ketiga|tiga|iii)\b/g, "3")
          .replace(/\b(keempat|empat|iv)\b/g, "4")
          .replace(/\b(kelima|lima|v)\b/g, "5")
          .replace(/\b(keenam|enam|vi)\b/g, "6")
          .replace(/\b(ketujuh|tujuh|vii)\b/g, "7")
          .replace(/\b(kedelapan|delapan|viii)\b/g, "8")
          .replace(/\b(kesembilan|sembilan|ix)\b/g, "9")
          .replace(/\b(kesepuluh|sepuluh|x)\b/g, "10")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const toRoman = s => {
        return String(s || "")
          .replace(/\b(kesatu|pertama|satu)\b/gi, "I")
          .replace(/\b(kedua|dua)\b/gi, "II")
          .replace(/\b(ketiga|tiga)\b/gi, "III")
          .replace(/\b(keempat|empat)\b/gi, "IV")
          .replace(/\b(kelima|lima)\b/gi, "V")
          .replace(/\b(keenam|enam)\b/gi, "VI")
          .replace(/\b(ketujuh|tujuh)\b/gi, "VII")
          .replace(/\b(kedelapan|delapan)\b/gi, "VIII")
          .replace(/\b(kesembilan|sembilan)\b/gi, "IX")
          .replace(/\b(kesepuluh|sepuluh)\b/gi, "X");
      };

      const trigAddr = a("Alamat Domisili", "Pilih alamat domisili") || a("Domisili") || a("Alamat");

      if (!findLocInp()) {
        if (!trigAddr) return false;

        const curAddr = normWil(trigAddr.textContent || "");
        const lastPart = nonEmpty.length ? normWil(nonEmpty[nonEmpty.length - 1]) : "";

        if (curAddr && !curAddr.startsWith("pilih") && lastPart && curAddr.includes(lastPart)) {
          return true;
        }

        n(trigAddr);
        await e(600);
      }

      const getAllModalBtns = () => {
        const inp = findLocInp();
        const root = inp ? (inp.closest(".modal-content, [role='dialog'], .modal, div.fixed") || document) : document;
        const inpRect = inp ? inp.getBoundingClientRect() : null;

        const daftarHeading = Array.from(root.querySelectorAll("div, p, span, h4, h5")).find(el => {
          if (el.children.length > 1) return false;
          const t = norm(el.textContent);
          return /^daftar\s+(provinsi|kabupaten|kota|kecamatan|kelurahan|desa|lokasi)/i.test(t) && el.getBoundingClientRect().height > 0;
        });
        const minTop = daftarHeading
          ? daftarHeading.getBoundingClientRect().bottom - 4
          : (inpRect ? inpRect.bottom + 45 : 0);

        const rawBtns = Array.from(root.querySelectorAll(".modal-content button.py-4, [role='dialog'] button.py-4, button.py-4, .modal-content button, [role='dialog'] button"));
        return rawBtns.filter(b => {
          if (b.disabled || b.tagName === "INPUT" || b.querySelector("input")) return false;
          const rawTxt = (b.textContent || "").trim();
          const txt = norm(rawTxt);
          if (!txt || txt.length > 65) return false;
          if (txt.length <= 1 || /^[•·]/.test(rawTxt)) return false;
          if (/^(tutup|batal|kembali|x|✕|×|simpan|selanjutnya|pilih alamat domisili|pilih lokasi|daftar provinsi|daftar kabupaten|daftar kecamatan|daftar kelurahan)$/i.test(txt)) return false;
          const r = b.getBoundingClientRect();
          if (r.width <= 0 || r.height < 16) return false;
          if (minTop > 0 && r.top < minTop) return false;
          return true;
        });
      };

      const findModalBtn = targetAddr => {
        if (!targetAddr) return null;
        const wantRaw = norm(targetAddr);
        const wantWil = normWil(targetAddr);
        if (!wantWil) return null;

        const btns = getAllModalBtns();

        // 1. Exact match (termasuk prefix Kab/Kota penuh, misal "kota palembang" === "kota palembang" atau "sumatera selatan" === "sumatera selatan")
        let match = btns.find(b => norm(b.textContent) === wantRaw);
        if (match) return match;

        // 2. Exact match setelah normalisasi wilayah & angka Romawi ("ilir barat dua" === "ilir barat ii")
        match = btns.find(b => {
          const bWil = normWil(b.textContent);
          return bWil === wantWil;
        });
        if (match) return match;

        // 3. Partial match (tetap mempertahankan spasi antar kata!)
        match = btns.find(b => {
          const bRaw = norm(b.textContent);
          const bWil = normWil(b.textContent);
          return (wantWil.length >= 3 && (bWil.includes(wantWil) || wantWil.includes(bWil))) || bRaw.includes(wantRaw);
        });
        return match || null;
      };

      // Buat daftar kata kunci pencarian PERSIS SESUAI EXCEL (SPASI TETAP UTUH, JANGAN PERNAH DIGABUNG!)
      const buildSearchQueries = addr => {
        if (!addr) return [];
        const clean = addr.replace(/^(prov\.?|provinsi|kab\.?|kabupaten|kota|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/i, "").trim();
        const roman = toRoman(clean);
        const list = [clean, addr];
        if (roman && roman !== clean) list.push(roman);
        return Array.from(new Set(list.filter(s => s && s.length >= 2)));
      };

      for (let idx = 0; idx < 4; idx++) {
        const addr = parts4[idx];
        if (!addr && idx < 3) break;

        for (let w = 0; w < 12; w++) {
          if (findLocInp() || getAllModalBtns().length > 0) break;
          await e(150);
        }

        let btn = null;

        if (addr) {
          const queries = buildSearchQueries(addr);
          for (const q of queries) {
            const inp = findLocInp();
            if (inp) {
              setInp(inp, q);
              await e(400);
            }
            // Beri waktu bagi pencarian CKG untuk menyelesaikan debounce dan menampilkan hasil
            for (let k = 0; k < 15; k++) {
              btn = findModalBtn(addr);
              if (btn) break;
              await e(200);
            }
            if (btn) break;
          }

          if (!btn) {
            const inp = findLocInp();
            if (inp && inp.value) {
              setInp(inp, "");
              await e(400);
            }
            for (let k = 0; k < 12; k++) {
              btn = findModalBtn(addr);
              if (btn) break;
              await e(200);
            }
          }
        }

        if (!btn && idx === 3) {
          const inp = findLocInp();
          if (inp && inp.value) {
            setInp(inp, "");
            await e(350);
          }
          const btns = getAllModalBtns();
          btn = btns[0] || null;
        }

        if (!btn) break;

        btn.scrollIntoView({ block: "center" });
        btn.click();
        await e(800);
      }

      return true;
    };

    if ((data.alamat && data.alamat.some(Boolean)) || form.prov || form.kab) {
      await selectAlamat(data.alamat, data.detail);
      await e(350);
    }

    // Checkbox "Alamat domisili sama dengan alamat sekolah" jika belum ada alamat atau alamat masih "Pilih"
    const trigDom = a("Alamat Domisili", "Pilih alamat domisili") || a("Domisili") || a("Alamat");
    const curDom = trigDom ? norm(trigDom.textContent || "") : "";
    if (!curDom || curDom.startsWith("pilih")) {
      const cb = Array.from(document.querySelectorAll("input[type='checkbox']")).find(el => {
        return norm(el.closest("label, div")?.textContent || "").includes("sama dengan alamat sekolah");
      }) || Array.from(document.querySelectorAll("label, span, div")).find(el => {
        return el.children.length <= 3 && norm(el.textContent).includes("sama dengan alamat sekolah");
      });
      if (cb) {
        const clickable = cb.closest("label") || cb;
        clickable.scrollIntoView({ block: "center" });
        n(clickable);
        await e(300);
      }
    }

    // =========================================================
    // 6. DETAIL ALAMAT DOMISILI
    // =========================================================
    const txtArea = document.querySelector("#detail-domisili") || document.querySelector('textarea[name="detail-domisili"]') || document.querySelector("textarea");
    if (txtArea && !txtArea.value.trim()) {
      const val = data.detail || (data.sekolah ? ("Siswa " + data.sekolah) : "-");
      setInp(txtArea, val.slice(0, 60));
      await e(200);
    }

    // =========================================================
    // 7. VERIFIKASI RETRY STATUS PERNIKAHAN & DISABILITAS
    // =========================================================
    const trigP = a("Status Pernikahan", "Pilih status pernikahan");
    if (trigP) {
      const curP = norm((trigP.querySelector("span.line-clamp-2") || trigP).textContent || "");
      if (!curP || curP.startsWith("pilih")) {
        await selectDropdown("Status Pernikahan", data.status, "Pilih status pernikahan");
        await e(300);
      }
    }

    const trigD = a("Penyandang disabilitas", "Pilih penyandang disabilitas");
    if (trigD) {
      const curD = norm((trigD.querySelector("span.line-clamp-2") || trigD).textContent || "");
      if (!curD || curD.startsWith("pilih")) {
        await selectDropdown("Penyandang disabilitas", data.disabilitas, "Pilih penyandang disabilitas");
        await e(300);
      }
    }

    return true;
  } catch (err) {
    console.error("[Pendaftaran] Error fillDetailFormSekolah:", err);
    return false;
  }
}


async function dispatchKey(cmd, key, vk) {
  const p = { key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await cmd("Input.dispatchKeyEvent", { type: "keyDown", ...p });
  await cmd("Input.dispatchKeyEvent", { type: "keyUp", ...p });
}

// -------------------------------------------------------------
// Konfirmasi Kehadiran SEKOLAH (CDP implementation from 4.1.1_0)
// -------------------------------------------------------------

async function konfirmasiHadirSekolah(tabId, debuggerCmd, student, isStopped) {
  const checkStopped = async () => {
    if (await isStopped()) {
      const err = new Error("Automation was stopped");
      err.stopped = true;
      throw err;
    }
  };

  const evaluate = async expr => {
    const { result, exceptionDetails } = await debuggerCmd("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (exceptionDetails) throw new Error("evaluate: " + (exceptionDetails.exception?.description || exceptionDetails.text));
    return result.value;
  };

  const clickPoint = async ({ x, y }) => {
    x = Math.round(x);
    y = Math.round(y);
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  };

  const getElementCenter = selectorExpr => evaluate(`(() => {
    const el = (${selectorExpr})();
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

  const waitForCenter = async (selectorExpr, timeout = 15000, label = "") => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await checkStopped();
      const pt = await getElementCenter(selectorExpr);
      if (pt) return pt;
      await sleep(300);
    }
    throw new Error(`${label} tidak ditemukan setelah ${Math.round(timeout / 1000)} detik.`);
  };

  const waitAndClick = async (selectorExpr, timeout = 15000, label = "") => {
    const pt = await waitForCenter(selectorExpr, timeout, label);
    await clickPoint(pt);
    await sleep(300);
  };

  const typeIntoActiveElement = async text => {
    await evaluate("(() => { const el = document.activeElement; if (el && el.select) el.select(); })()");
    await dispatchKey(debuggerCmd, "Delete", 46);
    await debuggerCmd("Input.insertText", { text });
  };

  const getLabelSelector = labelName => `() => {
    const lbl = Array.from(document.querySelectorAll('div.font-semibold'))
      .find(d => d.nextElementSibling && (d.textContent || '').replace(/\\*/g, '').trim() === ${JSON.stringify(labelName)});
    return lbl ? lbl.nextElementSibling.querySelector('div.cursor-pointer') : null;
  }`;

  const searchNikInputSelector = `() => document.querySelector('label[for="searchNik"] input') || document.querySelector('#searchNik')`;

  const searchTypeSelector = `() => {
    let n = (${searchNikInputSelector})();
    while (n && !(n.querySelector && n.querySelector('span.line-clamp-2'))) n = n.parentElement;
    return n ? n.querySelector('div.cursor-pointer') : null;
  }`;

  const getDropdownPanelSelector = targetExpr => `(() => {
    const t = (${targetExpr})();
    const box = t && t.closest('.relative');
    return box ? box.querySelector('div.absolute') : null;
  })()`;

  const selectFilterOption = async (targetSelector, optionValue, labelName, timeout = 8000) => {
    const panelOpen = await evaluate(`!!${getDropdownPanelSelector(targetSelector)}`);
    if (!panelOpen) {
      await waitAndClick(targetSelector, 15000, `Dropdown ${labelName}`);
    }
    await sleep(450);

    const optionFinder = `() => {
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const canonSchool = s => (s || '')
        .toLowerCase()
        .replace(/[.,\\/#!$%\\^&\\*;:{}=\\-_~\`()]/g, ' ')
        .replace(/\\bsdn(?:\\s+negeri)?\\b/g, 'sd negeri')
        .replace(/\\bsd\\s+n(?:\\s+negeri)?\\b/g, 'sd negeri')
        .replace(/\\bsmpn(?:\\s+negeri)?\\b/g, 'smp negeri')
        .replace(/\\bsmp\\s+n(?:\\s+negeri)?\\b/g, 'smp negeri')
        .replace(/\\bsman(?:\\s+negeri)?\\b/g, 'sma negeri')
        .replace(/\\bsma\\s+n(?:\\s+negeri)?\\b/g, 'sma negeri')
        .replace(/\\bsmkn(?:\\s+negeri)?\\b/g, 'smk negeri')
        .replace(/\\bsmk\\s+n(?:\\s+negeri)?\\b/g, 'smk negeri')
        .replace(/\\bmin(?:\\s+negeri)?\\b/g, 'mi negeri')
        .replace(/\\bmtsn(?:\\s+negeri)?\\b/g, 'mts negeri')
        .replace(/\\bman(?:\\s+negeri)?\\b/g, 'ma negeri')
        .replace(/\\bsds(?:\\s+swasta)?\\b/g, 'sd swasta')
        .replace(/\\bsmps(?:\\s+swasta)?\\b/g, 'smp swasta')
        .replace(/\\bsmas(?:\\s+swasta)?\\b/g, 'sma swasta')
        .replace(/\\bsmks(?:\\s+swasta)?\\b/g, 'smk swasta')
        .replace(/\\bsd\\s+it\\b/g, 'sdit')
        .replace(/\\b(negeri|swasta)(?:\\s+\\1)+\\b/g, '$1')
        .replace(/\\b0+(\\d+)\\b/g, '$1')
        .replace(/\\s+/g, ' ')
        .trim();
      const canonCore = s => canonSchool(s).replace(/\\b(negeri|swasta)\\b/g, ' ').replace(/\\s+/g, ' ').trim();
      const extractClassNum = s => {
        if (!s) return null;
        const str = String(s).trim().toLowerCase();
        const m = str.match(/\\b(1[0-2]|[1-9])\\b/) || str.match(/\\d+/);
        if (m) return parseInt(m[0], 10);
        if (/\\bxii\\b/.test(str)) return 12;
        if (/\\bxi\\b/.test(str)) return 11;
        if (/\\bx\\b/.test(str)) return 10;
        if (/\\bix\\b/.test(str)) return 9;
        if (/\\bviii\\b/.test(str)) return 8;
        if (/\\bvii\\b/.test(str)) return 7;
        if (/\\bvi\\b/.test(str)) return 6;
        if (/\\bv\\b/.test(str)) return 5;
        if (/\\biv\\b/.test(str)) return 4;
        if (/\\biii\\b/.test(str)) return 3;
        if (/\\bii\\b/.test(str)) return 2;
        if (/\\bi\\b/.test(str)) return 1;
        return null;
      };
      const want = norm(${JSON.stringify(String(optionValue))});
      const wantCan = canonSchool(${JSON.stringify(String(optionValue))});
      const wantCore = canonCore(${JSON.stringify(String(optionValue))});
      const isClass = ${JSON.stringify(labelName)}.toLowerCase().includes('kelas') || ${JSON.stringify(labelName)}.toLowerCase().includes('jenjang');
      const panel = ${getDropdownPanelSelector(targetSelector)};
      if (!panel) return null;
      const opts = Array.from(panel.querySelectorAll('div.cursor-pointer, [role="option"], li, button')).filter(o => {
        const t = norm(o.textContent);
        return t && t !== 'data tidak ditemukan' && !o.querySelector('input');
      });

      const exact = opts.find(o => norm(o.textContent) === want || canonSchool(o.textContent) === wantCan);
      if (exact) return exact;

      if (isClass) {
        const wantNum = extractClassNum(want);
        const classMatch = opts.find(o => {
          const t = norm(o.textContent);
          if (t === want || t === ("kelas " + want) || ("kelas " + t) === want) return true;
          const optNum = extractClassNum(t);
          return wantNum !== null && optNum !== null && wantNum === optNum;
        });
        if (classMatch) return classMatch;
      }

      const coreMatch = opts.find(o => {
        const c = canonCore(o.textContent);
        return c && wantCore && (c === wantCore || c.includes(wantCore) || (wantCore.length >= 5 && wantCore.includes(c)));
      });
      if (coreMatch) return coreMatch;

      const pref = opts.find(o => norm(o.textContent) === ('kelas ' + want) || ('kelas ' + norm(o.textContent)) === want);
      if (pref) return pref;

      const partial = opts.filter(o => norm(o.textContent).includes(want) || canonSchool(o.textContent).includes(wantCan));
      return partial.length >= 1 ? partial[0] : null;
    }`;

    // LANGKAH 1: Cek langsung pada daftar opsi dropdown sebelum mengetik (agar tidak terkena "Data tidak ditemukan" akibat singkatan SDN NEGERI)
    let optPt = await getElementCenter(optionFinder);
    if (optPt) {
      await clickPoint(optPt);
      await sleep(500);
      return;
    }

    // LANGKAH 2: Jika belum ketemu di daftar awal, ketik nama yang sudah dinormalisasi ("SD NEGERI 2 SESELA")
    const searchInDropdown = `() => { const p = ${getDropdownPanelSelector(targetSelector)}; return p ? p.querySelector('input') : null; }`;
    const hasSearchInp = await getElementCenter(searchInDropdown);
    if (hasSearchInp) {
      const normalizedQuery = String(optionValue)
        .replace(/\bsdn(?:\s+negeri)?\b/gi, "SD NEGERI")
        .replace(/\bsmpn(?:\s+negeri)?\b/gi, "SMP NEGERI")
        .replace(/\bsman(?:\s+negeri)?\b/gi, "SMA NEGERI")
        .replace(/\bsmkn(?:\s+negeri)?\b/gi, "SMK NEGERI")
        .replace(/\b0+(\d+)\b/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      await waitAndClick(searchInDropdown, 2000, `Pencarian ${labelName}`);
      await typeIntoActiveElement(normalizedQuery);
      await sleep(500);

      optPt = await getElementCenter(optionFinder);
      if (!optPt) {
        // Fallback: ketik kata kunci lokasi/nomor saja tanpa prefix SD/SMP/SMA/NEGERI
        const coreQuery = normalizedQuery.replace(/^(sd|smp|sma|smk|mi|mts|ma|negeri|swasta|\s)+/gi, "").trim();
        if (coreQuery && coreQuery !== normalizedQuery) {
          await waitAndClick(searchInDropdown, 2000, `Pencarian ${labelName}`);
          await typeIntoActiveElement(coreQuery);
          await sleep(500);
        }
      }
    }

    optPt = await waitForCenter(optionFinder, timeout, `${labelName} "${optionValue}"`);
    await clickPoint(optPt);
    await sleep(500);
  };

  // 1. Filter Sekolah & Kelas
  await waitForCenter(getLabelSelector("Sekolah"), 15000, "Filter Sekolah");
  if (student.sekolah) await selectFilterOption(getLabelSelector("Sekolah"), student.sekolah, "Sekolah");
  await checkStopped();
  if (student.kelas) await selectFilterOption(getLabelSelector("Kelas"), student.kelas, "Kelas");
  await checkStopped();

  // 2. Jenis Pencarian
  let searchVal = student.nik;
  let searchType = "NIK";
  try {
    await selectFilterOption(searchTypeSelector, "NIK", "Jenis pencarian", 3000);
  } catch (e) {
    if (e.stopped || !student.ticket) throw e;
    await dispatchKey(debuggerCmd, "Escape", 27);
    searchVal = student.ticket;
    searchType = "Nomor Tiket";
  }
  if (!searchVal) throw new Error("Tidak ada NIK / nomor tiket untuk mencari pasien.");

  // 3. Ketik dan Enter
  await exec(tabId, installListSekolahInterceptor);
  await waitAndClick(searchNikInputSelector, 5000, "Kolom pencarian");
  await typeIntoActiveElement(String(searchVal));
  await sleep(100);
  await exec(tabId, clearListSekolahResults);
  await dispatchKey(debuggerCmd, "Enter", 13);

  // 4. Verifikasi lewat interceptor list-kunjungan-sekolah
  const matchesSearch = item => {
    const str = JSON.stringify(item ?? "");
    return (!!student.nik && str.includes(String(student.nik))) ||
           (!!student.ticket && str.includes(String(student.ticket)));
  };

  let foundInList = null;
  let resultIndex = 0;
  let deadlineList = Date.now() + 15000;
  while (Date.now() < deadlineList && true !== foundInList) {
    await checkStopped();
    const results = await exec(tabId, getListSekolahResults) ?? [];
    for (; resultIndex < results.length; resultIndex++) {
      const dec = await decryptResult(results[resultIndex]);
      const list = dec?.body?.data?.list;
      if (Array.isArray(list)) {
        if (list.some(matchesSearch)) {
          foundInList = true;
          break;
        }
        foundInList = false;
        deadlineList = Math.min(deadlineList, Date.now() + 2000);
      }
    }
    if (true !== foundInList) await sleep(300);
  }
  if (false === foundInList) {
    throw new Error(`Pasien (${searchType} ${searchVal}) tidak ada di hasil list-kunjungan-sekolah.`);
  }

  // 5. Tombol Konfirmasi Hadir baris pasien
  const rowHadirBtn = `() => {
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const nama = norm(${JSON.stringify(student.nama ?? "")});
    const rows = Array.from(document.querySelectorAll('tbody tr')).filter(tr =>
      Array.from(tr.querySelectorAll('button')).some(b => norm(b.textContent) === 'konfirmasi hadir')
    );
    const row = (nama && rows.find(tr => norm(tr.textContent).includes(nama))) ||
                (rows.length === 1 ? rows[0] : null);
    return row ? Array.from(row.querySelectorAll('button')).find(b => norm(b.textContent) === 'konfirmasi hadir') : null;
  }`;

  await waitAndClick(rowHadirBtn, foundInList ? 10000 : 5000, "Tombol Konfirmasi Hadir pada baris pasien");

  // 6. Modal Konfirmasi Kehadiran
  const modalForm = `() => Array.from(document.querySelectorAll('form'))
    .find(f => (f.textContent || '').includes('Konfirmasi Kehadiran'))`;
  await waitForCenter(modalForm, 10000, "Modal Konfirmasi Kehadiran");
  await sleep(500);

  const fillInputIfEmpty = async (selector, val, label) => {
    if (!val) return;
    const shouldFill = await evaluate(`(() => {
      const f = (${modalForm})();
      const el = f && f.querySelector(${JSON.stringify(selector)});
      return !!el && !el.value.trim();
    })()`);
    if (shouldFill) {
      await waitAndClick(`() => { const f = (${modalForm})(); return f && f.querySelector(${JSON.stringify(selector)}); }`, 3000, label);
      await typeIntoActiveElement(val);
      await sleep(200);
    }
  };

  await fillInputIfEmpty('input[id="No Whatsapp"]', student.wa, "No. Whatsapp");
  await fillInputIfEmpty('#detail-domisili', student.detailAlamat ? student.detailAlamat.slice(0, 60) : "", "Detail Alamat Domisili");

  // 7. Checkbox persetujuan #verify
  const isConsentChecked = () => evaluate(`(() => {
    const f = (${modalForm})();
    const cb = f && f.querySelector('input#verify');
    return !!cb && (cb.checked || cb.value === 'true');
  })()`);

  const checkboxTrigger = `() => {
    const f = (${modalForm})();
    return f && (f.querySelector('div#verify.check') || f.querySelector('div.check') || f.querySelector('input#verify'));
  }`;

  for (let i = 0; i < 5 && !(await isConsentChecked()); i++) {
    await waitAndClick(checkboxTrigger, 5000, "Checkbox persetujuan");
    await sleep(300);
  }
  if (!(await isConsentChecked())) throw new Error("Checkbox persetujuan tidak tercentang setelah 5 percobaan.");

  // 8. Klik tombol "Hadir"
  const btnHadirActive = `() => {
    const f = (${modalForm})();
    if (!f) return null;
    const el = Array.from(f.querySelectorAll('button, div'))
      .filter(e => (e.textContent || '').trim() === 'Hadir' &&
        !Array.from(e.children).some(c => (c.textContent || '').trim() === 'Hadir'))[0];
    if (!el || el.disabled) return null;
    const cls = el.className || '';
    return cls.includes('cursor-not-allowed') || cls.includes('bg-disabled') ? null : el;
  }`;

  try {
    await waitAndClick(btnHadirActive, 5000, "Tombol Hadir (aktif)");
  } catch (err) {
    if (err.stopped) throw err;
    const emptyFields = await evaluate(`(() => {
      const f = (${modalForm})();
      if (!f) return [];
      return Array.from(f.querySelectorAll('input[type="text"], textarea'))
        .filter(el => !el.value.trim()).map(el => el.id || el.name);
    })()`).catch(() => []);
    throw new Error("Tombol Hadir tetap nonaktif. Field kosong: " + (emptyFields.join(", ") || "(tidak ada)"));
  }

  // 9. Tombol Tutup
  const closeBtn = "() => Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Tutup')";
  const deadlineClose = Date.now() + 15000;
  while (Date.now() < deadlineClose) {
    await checkStopped();
    const tutupPt = await getElementCenter(closeBtn);
    if (tutupPt) {
      await clickPoint(tutupPt);
      return;
    }
    if (!(await evaluate(`!!(${modalForm})()`))) return;
    await sleep(300);
  }
  throw new Error("Konfirmasi hadir tidak selesai: modal masih terbuka 15 detik setelah Hadir diklik.");
}

// -------------------------------------------------------------
// Konfirmasi Kehadiran UMUM (from 4.1.1_0)
// -------------------------------------------------------------

async function konfirmasiHadirUmum(tabId, debuggerCmd, ticketNumber) {
  if (!ticketNumber) return;

  await debuggerCmd("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector('#searchNik');
      if (!el) return false;
      el.focus();
      el.setSelectionRange(0, el.value.length);
      return true;
    })()`
  });
  await dispatchKey(debuggerCmd, "Delete", 46);
  await debuggerCmd("Input.insertText", { text: ticketNumber });
  await sleep(100);
  await dispatchKey(debuggerCmd, "Enter", 13);
  await sleep(800);

  const evaluate = async expr => {
    const { result } = await debuggerCmd("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return result.value;
  };

  const clickAt = async (x, y) => {
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  };

  const waitForExpr = async (expr, timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await evaluate(expr);
      if (res) return res;
      await sleep(200);
    }
    throw new Error("Timeout: " + expr);
  };

  const getElementCenter = expr => evaluate(`(() => {
    const el = ${expr};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);

  await waitForExpr("!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Konfirmasi Hadir')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Konfirmasi Hadir')?.click()");
  await waitForExpr("!!(document.querySelector('div.check') || document.querySelector('input#verify'))");

  const getCheckboxPoint = () => evaluate(`(() => {
    const styled = document.querySelector('div#verify.check') || document.querySelector('div.check');
    if (!styled) return null;
    styled.scrollIntoView({ block: 'center', inline: 'center' });
    const r = styled.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const ok = hit && (hit === styled || styled.contains(hit) || hit.id === 'verify');
    const inView = y >= 0 && y <= window.innerHeight && x >= 0 && x <= window.innerWidth;
    return ok && inView ? { x, y } : null;
  })()`);

  const isHadirReady = () => evaluate(`(() => {
    const cb = document.querySelector('input#verify');
    const h = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Hadir');
    return !!(cb && cb.checked && cb.value === 'true' && h && !h.disabled);
  })()`);

  const clickCheckbox = async (x, y) => {
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  };

  for (let t = 1; t <= 5 && !(await isHadirReady()); t++) {
    let pt = null;
    for (let e = 0; e < 10 && !pt; e++) {
      pt = await getCheckboxPoint();
      if (!pt) await sleep(150);
    }
    if (!pt) throw new Error("Consent checkbox not visible/hittable");
    await clickCheckbox(pt.x, pt.y);
    await sleep(200);
  }
  if (!(await isHadirReady())) throw new Error("Consent checkbox did not register after 5 attempts");

  let hadirPt = await getElementCenter("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Hadir' && !b.disabled)");
  if (hadirPt) await clickAt(hadirPt.x, hadirPt.y);

  await waitForExpr("!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Tutup')", 15000);
  let tutupPt = await getElementCenter("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Tutup')");
  if (tutupPt) await clickAt(tutupPt.x, tutupPt.y);
}

// -------------------------------------------------------------
// BALITA Specialized Helper Functions (Preserved from CKG Revisi)
// -------------------------------------------------------------


async function injectWaliData(data) {
  const cleanNik = String(data?.nik || "").replace(/\D/g, "");
  if (cleanNik.length !== 16) return false;

  const effectiveWali = {
    nik: cleanNik,
    nama: (data?.nama && String(data.nama).trim().length > 1) ? String(data.nama).trim() : "",
    lahir: (data?.lahir?.tahun && data?.lahir?.tanggal) ? data.lahir : null,
    jenisKelamin: (data?.jenisKelamin && String(data.jenisKelamin).trim()) ? data.jenisKelamin : "Perempuan",
    noWa: (data?.noWa && String(data.noWa).replace(/\D/g, "").length >= 8) ? String(data.noWa).replace(/\D/g, "").replace(/^(62|0)+/, "") : ""
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  const setInput = (el, val) => {
    if (!el) return false;
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: String(val) }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  };

  // Pastikan form wali ada dan terisolasi secara ketat dari form peserta
  const getWaliSection = () => {
    const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
    if (nikWali) {
      const sec = nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3, div.flex-col');
      if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
      return nikWali.parentElement?.parentElement?.parentElement || null;
    }
    const allHeadings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, p, span"));
    const h = allHeadings.find(el => el.children.length <= 2 && clean(el.textContent) === "isi data wali");
    if (h) {
      const sec = h.closest('.form-data-individu') || h.parentElement;
      if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
    }
    return null;
  };

  const waliSection = getWaliSection();
  if (!waliSection) {
    console.warn("[injectWaliData] Section Wali tidak ditemukan di halaman. Membatalkan agar tidak menimpa data peserta.");
    return false;
  }

  // Jika checkbox 'Daftarkan Tanpa Wali' tidak sengaja tercentang, uncheck
  const noWaliCb = document.getElementById("noWali") || document.querySelector('input#noWali');
  if (noWaliCb && noWaliCb.checked) {
    noWaliCb.click();
    await sleep(250);
  }

  // 0. JIKA DATA WALI SUDAH ADA DARI SISTEM CKG (misal setelah klik Gunakan Data), JANGAN GANTI APAPUN! BIARKAN SAJA!
  const curNikInForm = (waliSection.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]')?.value || "").replace(/\D/g, "");
  const curNamaInForm = (waliSection.querySelector('input[name="Nama Lengkap Wali"], input[placeholder*="Nama Lengkap" i], input[placeholder*="nama" i]')?.value || "").trim();
  const curTglInForm = (waliSection.querySelector('.mx-datepicker input, .mx-input-wrapper input')?.value || waliSection.querySelector('.mx-datepicker, .mx-input-wrapper')?.textContent || "").trim();

  const isExistingWaliPresent = (curNikInForm.length === 16) || (curNamaInForm.length >= 2 && curTglInForm.length >= 4 && !/^pilih/i.test(curTglInForm));
  if (isExistingWaliPresent && !data?.forceOverwrite) {
    console.log("[injectWaliData] Data wali sudah ada dari sistem CKG (" + (curNamaInForm || curNikInForm) + "), mempertahankan data wali asli tanpa mengubahnya.");
    return { ok: true, preserved: true };
  }

  // 1. Suntikkan NIK Wali (16 digit) - HANYA di dalam waliSection jika belum terisi
  const nikInput = waliSection.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
  if (nikInput) {
    const curVal = (nikInput.value || "").replace(/\D/g, "");
    if (curVal.length !== 16) {
      setInput(nikInput, effectiveWali.nik);
      await sleep(300);
    }
  }

  // 2. Suntikkan Nama Lengkap Wali - HANYA di dalam waliSection jika belum terisi
  const namaInput = waliSection.querySelector('input[name="Nama Lengkap Wali"], input[placeholder*="Nama Lengkap" i], input[placeholder*="nama" i]');
  if (namaInput) {
    const curNama = (namaInput.value || "").trim();
    if (!curNama || curNama.length < 2) {
      setInput(namaInput, effectiveWali.nama);
      await sleep(300);
    }
  }

  // 3. Suntikkan Tanggal Lahir Wali - HANYA di dalam waliSection
  if (effectiveWali.lahir && effectiveWali.lahir.tahun && effectiveWali.lahir.tanggal) {
    const targetWrapper = waliSection.querySelector('.mx-datepicker, .mx-input-wrapper');

    if (targetWrapper) {
      const clickSingle = el => {
        if (!el) return;
        try { el.scrollIntoView({ block: "center" }); } catch(err) {}
        if (typeof el.click === "function") el.click();
        else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      };

      const hasVal = (targetWrapper.querySelector("input")?.value || "").trim();
      const hasTxt = (targetWrapper.textContent || "").trim();
      const isAlreadyFilled = (hasVal && !/^pilih/i.test(hasVal)) || (hasTxt && !/^pilih/i.test(hasTxt) && /\d{4}/.test(hasTxt));

      if (!isAlreadyFilled) {
        const triggerInp = targetWrapper.querySelector(".mx-icon-calendar, i, svg, .truncate") || targetWrapper.querySelector("input") || targetWrapper;
        clickSingle(triggerInp);
        const getPopup = () => document.querySelector(".mx-datepicker-popup, .mx-datepicker-main");
        for (let i = 0; i < 15 && !getPopup(); i++) await sleep(120);

        const popup = getPopup();
        if (popup) {
          // Buka panel tahun
          const yearBtn = popup.querySelector(".mx-btn-current-year") ||
                          Array.from(popup.querySelectorAll(".mx-calendar-header .mx-btn-text, .mx-calendar-header button")).find(b => /^\d{4}$/.test((b.textContent || "").trim()));
          if (yearBtn) {
            clickSingle(yearBtn);
            await sleep(200);
            if (!popup.querySelector(".mx-table-year")) {
              clickSingle(yearBtn);
              await sleep(200);
            }
          }

          const targetYear = parseInt(effectiveWali.lahir.tahun, 10);
          const findYearCell = () => Array.from(popup.querySelectorAll(".mx-table-year td.cell, .mx-calendar-content .cell") ?? [])
            .find(c => c.textContent.trim() === String(targetYear));

          let retries = 0;
          while (!findYearCell() && retries++ < 30) {
            const firstY = parseInt(popup.querySelector(".mx-table-year td.cell, .mx-calendar-content .cell")?.textContent ?? "9999", 10);
            const prevBtn = popup.querySelector(".mx-btn-icon-double-left, .mx-icon-double-left, i[class*='double-left']");
            const nextBtn = popup.querySelector(".mx-btn-icon-double-right, .mx-icon-double-right, i[class*='double-right']");
            const navBtn = firstY > targetYear ? (prevBtn?.closest("button") || prevBtn) : (nextBtn?.closest("button") || nextBtn);
            if (!navBtn) break;
            clickSingle(navBtn);
            await sleep(150);
          }

          const yearCell = findYearCell();
          if (yearCell) {
            clickSingle(yearCell);
            await sleep(200);
          }

          // Pilih Bulan
          const mIdxMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agt: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
          const mIdx = mIdxMap[effectiveWali.lahir.bulan] ?? (parseInt(effectiveWali.lahir.bulan, 10) > 0 ? parseInt(effectiveWali.lahir.bulan, 10) - 1 : 8);
          const mCells = Array.from(popup.querySelectorAll(".mx-table-month td.cell, .mx-calendar-content .cell") ?? []);
          if (mCells[mIdx]) {
            clickSingle(mCells[mIdx]);
            await sleep(200);
          }

          // Pilih Tanggal
          const targetDay = String(parseInt(effectiveWali.lahir.tanggal, 10));
          const dCells = Array.from(popup.querySelectorAll(".mx-table-date td.cell, .mx-calendar-content .cell") ?? []).filter(c => !c.classList.contains("not-current-month"));
          const dCell = dCells.find(c => c.textContent.trim() === targetDay);
          if (dCell) {
            clickSingle(dCell);
            await sleep(250);
          }

          // Fallback input langsung
          const mNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
          const formattedWaliIndo = `${effectiveWali.lahir.tanggal} ${mNames[mIdx] || "Sep"} ${effectiveWali.lahir.tahun}`;
          const inpEl = targetWrapper.querySelector("input");
          if (inpEl && (!inpEl.value || !inpEl.value.trim() || /^pilih/i.test(inpEl.value))) {
            setInput(inpEl, formattedWaliIndo);
          }

          // Tutup popup datepicker agar bersih
          try { document.body.click(); } catch(e) {}
          await sleep(200);
        }
      }
    }
  }

  // 4. Suntikkan Jenis Kelamin Wali - HANYA di dalam waliSection
  if (effectiveWali.jenisKelamin) {
    const rawTarget = String(effectiveWali.jenisKelamin).trim().toLowerCase();
    const isMale = rawTarget.startsWith("l") || rawTarget === "1" || rawTarget.includes("laki");
    const targetText = isMale ? "Laki-laki" : "Perempuan";

    const jkTrigger = waliSection.querySelector('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"]');
    if (jkTrigger) {
      const curTxt = clean(jkTrigger.textContent);
      // HANYA pilih jenis kelamin jika dropdown wali masih kosong / "Pilih jenis kelamin"!
      if (!curTxt || curTxt.includes("pilih")) {
        try { jkTrigger.scrollIntoView({ block: "center" }); } catch(e) {}
        await sleep(250);

        const compRoot = (jkTrigger.parentElement && jkTrigger.parentElement.parentElement) ||
                         jkTrigger.parentElement?.closest('[data-v-cf5614bc]') ||
                         jkTrigger.closest('.w-full[data-v-cf5614bc]') ||
                         waliSection;

        const getCandidates = () => {
          let list = Array.from(compRoot.querySelectorAll("div, li, p, span, a, button")).filter(d => {
            if (jkTrigger.contains(d)) return false;
            const t = clean(d.textContent);
            return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan");
          });
          if (list.length > 0) return list;

          if (compRoot.parentElement) {
            list = Array.from(compRoot.parentElement.querySelectorAll("div, li, p, span, a, button")).filter(d => {
              if (jkTrigger.contains(d)) return false;
              const t = clean(d.textContent);
              return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan");
            });
            if (list.length > 0) return list;
          }

          list = Array.from(waliSection.querySelectorAll("div, li, p, span, a, button")).filter(d => {
            if (jkTrigger.contains(d)) return false;
            const t = clean(d.textContent);
            return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan");
          });
          return list;
        };

        let candidates = getCandidates();
        if (candidates.length === 0) {
          if (typeof jkTrigger.click === "function") jkTrigger.click();
          else jkTrigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          await sleep(400); // Santai!

          for (let w = 0; w < 10; w++) {
            candidates = getCandidates();
            if (candidates.length > 0) break;
            await sleep(150);
          }
        }

        // Pilih opsi: index 0 = Laki-laki, index 1 = Perempuan
        let opt = isMale
          ? (candidates.find(d => clean(d.textContent) === "laki-laki") || candidates[0])
          : (candidates.find(d => clean(d.textContent) === "perempuan") || candidates[1] || candidates[candidates.length - 1]);

        if (opt) {
          try { opt.scrollIntoView({ block: "nearest" }); } catch(err) {}
          await sleep(200);
          opt.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
          opt.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
          if (typeof opt.click === "function") opt.click();
          await sleep(400);
        }
      }
    }
  }

  // 5. Suntikkan No. Whatsapp Wali: Klik checkbox "Nomor sama dengan peserta"
  const phoneSamaCb = waliSection.querySelector('input#phone-sama, input[name="Nomor sama dengan peserta"], input[type="checkbox"]');
  if (phoneSamaCb) {
    if (!phoneSamaCb.checked) {
      const cbLabel = phoneSamaCb.closest("label") || phoneSamaCb.parentElement?.querySelector(".check") || phoneSamaCb;
      if (typeof cbLabel.click === "function") cbLabel.click();
      else cbLabel.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await sleep(300);
    }
  } else {
    const waWaliInp = waliSection.querySelector('input[name="Nomor whatsapp"], input[id="No whatsapp"], input[placeholder*="whatsapp" i]');
    if (waWaliInp && !waWaliInp.value) {
      setInput(waWaliInp, effectiveWali.noWa);
      await sleep(300);
    }
  }

  return { ok: true };
}

async function fillPesertaGender(targetGender) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const rawTarget = String(targetGender || "Laki-laki").trim().toLowerCase();
  const isMale = rawTarget.startsWith("l") || rawTarget === "1" || rawTarget.includes("laki");
  const targetText = isMale ? "Laki-laki" : "Perempuan";

  const getWaliSection = () => {
    const nikWali = document.querySelector('input[name="NIK wali"], input#nik-wali, input[id*="nik wali" i]');
    if (nikWali) return nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-2');
    const waliHeading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
      if (el.children.length > 2) return false;
      const txt = clean(el.textContent);
      return txt === "isi data wali" || txt.startsWith("isi data wali");
    });
    return waliHeading ? (waliHeading.closest('.form-data-individu') || waliHeading.parentElement) : null;
  };
  const waliSec = getWaliSection();
  const inWali = el => waliSec && waliSec.contains(el);

  const triggers = Array.from(document.querySelectorAll('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"]')).filter(el => {
    if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
    const txt = clean(el.textContent);
    return (txt.includes("pilih jenis kelamin") || txt === "laki-laki" || txt === "perempuan") && !inWali(el);
  });

  const trigger = triggers[0];
  if (!trigger) return false;

  const curVal = clean(trigger.textContent);
  if (curVal.includes(targetText.toLowerCase()) && !curVal.includes("pilih")) return true;

  try { trigger.scrollIntoView({ block: "center", inline: "center" }); } catch(e) {}
  if (typeof trigger.click === "function") trigger.click();
  else trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  const compBox = trigger.closest('[data-v-cf5614bc], .w-full, .relative') || trigger.parentElement?.parentElement;

  let candidates = [];
  for (let w = 0; w < 10; w++) {
    await wait(100);
    candidates = Array.from(compBox.querySelectorAll("div, li, p, span, a, button")).filter(d => {
      if (trigger.contains(d)) return false;
      const txt = clean(d.textContent);
      return d.children.length <= 1 && (txt === "laki-laki" || txt === "perempuan");
    });
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0 && compBox.parentElement) {
    candidates = Array.from(compBox.parentElement.querySelectorAll("div, li, p, span, a, button")).filter(d => {
      if (trigger.contains(d)) return false;
      const txt = clean(d.textContent);
      return d.children.length <= 1 && (txt === "laki-laki" || txt === "perempuan");
    });
  }

  let opt = isMale
    ? (candidates.find(d => clean(d.textContent) === "laki-laki") || candidates[0])
    : (candidates.find(d => clean(d.textContent) === "perempuan") || candidates[1] || candidates[candidates.length - 1]);

  if (opt) {
    const clickSingle = el => {
      if (!el) return;
      const opts = { bubbles: true, cancelable: true, view: window };
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
        try { el.dispatchEvent(new MouseEvent(type, opts)); } catch(err) {}
      });
      if (typeof el.click === "function") {
        try { el.click(); } catch(err) {}
      }
    };
    clickSingle(opt);
    await wait(250);
    return true;
  }
  return false;
}

function installGenderHelper() {
  window.getGenderTriggerElement = function(isWali = false) {
    const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

    // Cari heading atau penanda teks "Isi Data Wali"
    const waliHeading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label")).find(el => {
      if (el.children.length > 3) return false;
      const t = clean(el.innerText || el.textContent);
      return t === "isi data wali" || t.includes("data wali") || t.startsWith("isi data wali");
    });

    const isElementInWaliSection = el => {
      if (!waliHeading) return false;
      return (waliHeading.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;
    };

    // 1. Prioritas 1: Label "Jenis Kelamin"
    const allLabels = Array.from(document.querySelectorAll("div.font-semibold, label, div, p, span")).filter(el => {
      if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
      const t = clean((el.innerText || el.textContent || "").replace(/\*/g, ""));
      return t === "jenis kelamin" || t.startsWith("jenis kelamin");
    });

    const sectionLabels = allLabels.filter(lbl => {
      const inWali = isElementInWaliSection(lbl);
      return isWali ? inWali : !inWali;
    });

    for (const lbl of sectionLabels) {
      const next = lbl.nextElementSibling;
      if (next) {
        const box = next.querySelector(".cursor-pointer, [role='combobox'], div[class*='border'], button") || (next.classList?.contains("cursor-pointer") ? next : null);
        if (box && !box.closest(".mx-datepicker, .mx-input-wrapper")) return box;
      }
      const parent = lbl.closest(".relative, .flex-col, .form-group, div.w-full, div.mb-4, div.mb-3") || lbl.parentElement;
      if (parent) {
        const trg = parent.querySelector(".cursor-pointer, [role='combobox'], div[class*='border'], button");
        if (trg && !trg.closest(".mx-datepicker, .mx-input-wrapper")) return trg;
      }
    }

    // 2. Prioritas 2: Elemen "Pilih jenis kelamin"
    const allPilih = Array.from(document.querySelectorAll("div, span, button, [role='combobox']")).filter(el => {
      if (el.children.length > 2) return false;
      if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
      const t = clean(el.innerText || el.textContent);
      return t.includes("pilih jenis kelamin");
    });

    const sectionPilih = allPilih.filter(el => {
      const inWali = isElementInWaliSection(el);
      return isWali ? inWali : !inWali;
    });

    if (sectionPilih.length > 0) {
      return sectionPilih[0].closest(".cursor-pointer, [role='combobox'], div[class*='border'], button") || sectionPilih[0];
    }

    // 3. Fallback: Trigger pointer/combobox di seksi yang bersangkutan
    const allTriggers = Array.from(document.querySelectorAll(".cursor-pointer, [role='combobox'], div[class*='border']")).filter(el => {
      if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
      if (el.querySelector("input[type='checkbox']")) return false;
      const t = clean(el.innerText || el.textContent);
      if (t.includes("centang") || t.includes("daftarkan") || t.includes("cek nik") || t.includes("kembali") || t.includes("selanjutnya")) return false;
      return true;
    });

    const sectionTriggers = allTriggers.filter(el => {
      const inWali = isElementInWaliSection(el);
      return isWali ? inWali : !inWali;
    });

    if (sectionTriggers.length > 0) {
      return sectionTriggers[0];
    }

    if (isWali && allTriggers.length >= 2) return allTriggers[allTriggers.length - 1];
    if (!isWali && allTriggers.length >= 1) return allTriggers[0];

    return null;
  };

  window.openGenderDropdown = function(isWali = false) {
    const trg = typeof window.getGenderTriggerElement === "function" ? window.getGenderTriggerElement(isWali) : null;
    if (!trg) return false;
    try { trg.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {}

    // Cek apakah dropdown panel sudah benar-benar terbuka
    const relBox = trg.closest(".relative") || trg.parentElement?.closest(".relative") || trg.parentElement;
    const existingPanel = relBox ? relBox.querySelector("div.absolute") : null;
    if (existingPanel) {
      const r = existingPanel.getBoundingClientRect();
      if (r.height > 20 && r.width > 20 && window.getComputedStyle(existingPanel).display !== "none" && window.getComputedStyle(existingPanel).visibility !== "hidden") {
        return true;
      }
    }

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
      try { trg.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
    if (typeof trg.click === "function") {
      try { trg.click(); } catch (e) {}
    }
    return true;
  };

  window.selectGenderOption = async function(gender, isWali = false) {
    if (!gender) return false;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const raw = String(gender).trim().toLowerCase();
    const isMale = raw.startsWith("l") || raw === "1" || raw.includes("laki") || raw.includes("pria") || raw === "male";
    const targetMatch = isMale ? "laki" : "perem";
    const activeTrg = typeof window.getGenderTriggerElement === "function" ? window.getGenderTriggerElement(isWali) : null;
    const otherTrg = typeof window.getGenderTriggerElement === "function" ? window.getGenderTriggerElement(!isWali) : null;

    const fireClick = el => {
      if (!el) return;
      el.scrollIntoView({ block: "center", inline: "center" });
      const clickable = el.closest("button, li, [role='option'], div.cursor-pointer, div") || el;
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
        try { clickable.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
      });
      if (typeof clickable.click === "function") {
        try { clickable.click(); } catch (e) {}
      }
    };

    const isCandidateOption = el => {
      if (!el) return false;
      if (activeTrg && (el === activeTrg || activeTrg.contains(el))) return false;
      if (otherTrg && (el === otherTrg || otherTrg.contains(el))) return false;
      if (el.closest("label, h1, h2, h3, h4")) return false;
      const t = clean(el.innerText || el.textContent);
      if (!t.includes(targetMatch) || t.length > 25) return false;
      if (t.includes("pilih")) return false;
      if (el.offsetParent === null && window.getComputedStyle(el).display === "none") return false;
      return true;
    };

    const startTime = Date.now();
    while (Date.now() - startTime < 2500) {
      if (activeTrg) {
        const relBox = activeTrg.closest(".relative") || activeTrg.parentElement?.closest(".relative") || activeTrg.parentElement;
        const localPanel = relBox ? relBox.querySelector("div.absolute") : null;
        if (localPanel && (localPanel.offsetParent !== null || window.getComputedStyle(localPanel).display !== "none")) {
          const localCandidates = Array.from(localPanel.querySelectorAll("div.cursor-pointer, button, li, [role='option'], div, span")).filter(isCandidateOption);
          if (localCandidates.length > 0) {
            const chosen = localCandidates.find(c => c.children.length === 0) || localCandidates.find(c => c.classList.contains("cursor-pointer")) || localCandidates[0];
            fireClick(chosen);
            return true;
          }
        }
      }

      const popovers = Array.from(document.querySelectorAll(
        'div.absolute, .v-popper__popper, [data-popper-placement], [role="listbox"], [role="menu"], ul.dropdown-menu, div.dropdown-content, div.z-50, div.z-40, div.shadow-lg, div.shadow-md'
      )).filter(el => {
        if (el.tagName === "FORM" || el.tagName === "MAIN" || el.id === "app") return false;
        return el.offsetParent !== null || window.getComputedStyle(el).display !== 'none';
      });

      for (const pop of popovers) {
        const candidates = Array.from(pop.querySelectorAll("div.cursor-pointer, button, div, span, li, a, p, [role='option']")).filter(isCandidateOption);
        if (candidates.length > 0) {
          const chosen = candidates.find(c => c.children.length === 0) || candidates.find(c => c.classList.contains("cursor-pointer")) || candidates[0];
          fireClick(chosen);
          return true;
        }
      }

      const allMatches = Array.from(document.querySelectorAll("li, [role='option'], div.cursor-pointer, span.cursor-pointer, div, span, p, a")).filter(isCandidateOption);
      if (allMatches.length > 0) {
        const chosen = allMatches.find(c => c.children.length === 0) || (isWali ? allMatches[allMatches.length - 1] : allMatches[0]);
        fireClick(chosen);
        return true;
      }
      await wait(100);
    }
    return false;
  };
}

function getGenderTriggerElement(isWali = false) {
  if (typeof window.getGenderTriggerElement === "function") return window.getGenderTriggerElement(isWali);
  const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const waliHeading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label")).find(el => {
    if (el.children.length > 3) return false;
    const t = clean(el.innerText || el.textContent);
    return t === "isi data wali" || t.includes("data wali");
  });
  const inWali = el => waliHeading && (waliHeading.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;
  const trgs = Array.from(document.querySelectorAll(".cursor-pointer, [role='combobox'], div[class*='border']")).filter(el => {
    if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
    return isWali ? inWali(el) : !inWali(el);
  });
  return trgs[0] || null;
}

function openGenderDropdown(isWali = false) {
  if (typeof window.openGenderDropdown === "function") return window.openGenderDropdown(isWali);
  const trg = getGenderTriggerElement(isWali);
  if (!trg) return false;
  ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
    try { trg.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  });
  if (typeof trg.click === "function") try { trg.click(); } catch(e) {}
  return true;
}

async function selectGenderOption(gender, isWali = false) {
  if (typeof window.selectGenderOption === "function") return await window.selectGenderOption(gender, isWali);
  return false;
}

export class PendaftaranAutomation {
  async _ensureCheckTanpaWali(debuggerCmd = null) {
    const { tabId } = this;
    const res = await exec(tabId, () => {
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      const nikInp = document.getElementById("nik") || document.querySelector('input[placeholder*="nik" i]:not(#searchNik), input[name="NIK"], input[name="Nama"]');
      const scope = nikInp ? (nikInp.closest('.modal-content, [role="dialog"], .modal, div.fixed.inset-0, div.fixed, div.z-50') || nikInp.parentElement?.parentElement?.parentElement?.parentElement || document) : document;

      // Scroll modal jika konten di bawah belum masuk viewport
      try {
        if (scope && scope !== document && scope.scrollHeight > scope.clientHeight) {
          scope.scrollTop = Math.min(scope.scrollHeight, 400);
        }
      } catch(e) {}

      // 1. Selector ID langsung di modal
      const byId = scope.querySelector('#noWali, input#noWali, input[id*="noWali" i], input[id*="tanpa" i]');
      if (byId) {
        if (!byId.checked) {
          const box = byId.closest("label") || byId.parentElement || byId;
          try { byId.scrollIntoView({ block: "center" }); } catch(e) {}
          box.click();
          if (!byId.checked) byId.click();
          byId.checked = true;
          byId.dispatchEvent(new Event("input", { bubbles: true }));
          byId.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const r = byId.getBoundingClientRect();
        return {
          success: true,
          checked: byId.checked,
          coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
        };
      }

      // 2. Cari dari teks 'tanpa wali' di dalam modal
      const textNodes = Array.from(scope.querySelectorAll('label, span, p, div, h3, h4, h5')).filter(el => {
        if (el.children.length > 2) return false;
        const t = clean(el.textContent);
        return /tanpa\s*wali|daftarkan\s*tanpa\s*wali|tidak\s*ada\s*wali/i.test(t);
      });

      for (const node of textNodes) {
        const container = node.closest('label, div.flex, div.relative, fieldset, div.grid, div') || node.parentElement;
        if (container) {
          const cb = container.querySelector('input[type="checkbox"]');
          if (cb) {
            if (!cb.checked) {
              try { cb.scrollIntoView({ block: "center" }); } catch(e) {}
              const clickTarget = cb.closest("label") || node || cb;
              clickTarget.click();
              if (!cb.checked) cb.click();
              cb.checked = true;
              cb.dispatchEvent(new Event("input", { bubbles: true }));
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const r = cb.getBoundingClientRect();
            return {
              success: true,
              checked: cb.checked,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
          const customCb = container.querySelector('.cursor-pointer, [role="checkbox"]');
          if (customCb) {
            try { customCb.scrollIntoView({ block: "center" }); } catch(e) {}
            customCb.click();
            const r = customCb.getBoundingClientRect();
            return {
              success: true,
              checked: true,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
        }
      }

      // 3. Cari dari semua input[type="checkbox"] di modal
      const allCheckboxes = Array.from(scope.querySelectorAll('input[type="checkbox"]'));
      for (const cb of allCheckboxes) {
        let parent = cb.parentElement;
        for (let depth = 0; depth < 5 && parent; depth++) {
          const txt = clean(parent.textContent);
          if (/tanpa\s*wali|daftarkan\s*tanpa\s*wali|tidak\s*ada\s*wali/i.test(txt)) {
            if (!cb.checked) {
              try { cb.scrollIntoView({ block: "center" }); } catch(e) {}
              const clickTarget = cb.closest("label") || parent || cb;
              clickTarget.click();
              if (!cb.checked) cb.click();
              cb.checked = true;
              cb.dispatchEvent(new Event("input", { bubbles: true }));
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const r = cb.getBoundingClientRect();
            return {
              success: true,
              checked: cb.checked,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
          parent = parent.parentElement;
        }
      }

      return { success: false, checked: false };
    }).catch(() => ({ success: false, checked: false }));

    if (debuggerCmd && res && !res.checked && res.coords) {
      try {
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x: res.coords.x, y: res.coords.y, button: "left", clickCount: 1 });
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: res.coords.x, y: res.coords.y, button: "left", clickCount: 1 });
      } catch(e) {}
    }

    return res?.checked ?? false;
  }

  async _ensureUncheckTanpaWali(debuggerCmd = null) {
    const { tabId } = this;
    const res = await exec(tabId, () => {
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      const nikInp = document.getElementById("nik") || document.querySelector('input[placeholder*="nik" i]:not(#searchNik), input[name="NIK"], input[name="Nama"]');
      const scope = nikInp ? (nikInp.closest('.modal-content, [role="dialog"], .modal, div.fixed.inset-0, div.fixed, div.z-50') || nikInp.parentElement?.parentElement?.parentElement?.parentElement || document) : document;

      // 1. Selector ID langsung di modal
      const byId = scope.querySelector('#noWali, input#noWali, input[id*="noWali" i], input[id*="tanpa" i]');
      if (byId) {
        if (byId.checked) {
          const box = byId.closest("label") || byId.parentElement || byId;
          try { byId.scrollIntoView({ block: "center" }); } catch(e) {}
          box.click();
          if (byId.checked) byId.click();
          byId.checked = false;
          byId.dispatchEvent(new Event("input", { bubbles: true }));
          byId.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const r = byId.getBoundingClientRect();
        return {
          success: true,
          checked: byId.checked,
          coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
        };
      }

      // 2. Cari dari teks 'tanpa wali' di dalam modal
      const textNodes = Array.from(scope.querySelectorAll('label, span, p, div, h3, h4, h5')).filter(el => {
        if (el.children.length > 2) return false;
        const t = clean(el.textContent);
        return /tanpa\s*wali|daftarkan\s*tanpa\s*wali|tidak\s*ada\s*wali/i.test(t);
      });

      for (const node of textNodes) {
        const container = node.closest('label, div.flex, div.relative, fieldset, div.grid, div') || node.parentElement;
        if (container) {
          const cb = container.querySelector('input[type="checkbox"]');
          if (cb) {
            if (cb.checked) {
              try { cb.scrollIntoView({ block: "center" }); } catch(e) {}
              const clickTarget = cb.closest("label") || node || cb;
              clickTarget.click();
              if (cb.checked) cb.click();
              cb.checked = false;
              cb.dispatchEvent(new Event("input", { bubbles: true }));
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const r = cb.getBoundingClientRect();
            return {
              success: true,
              checked: cb.checked,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
          const customCb = container.querySelector('.cursor-pointer, [role="checkbox"]');
          if (customCb) {
            const isChecked = customCb.classList.contains("bg-theme") || customCb.classList.contains("bg-primary") || customCb.getAttribute("aria-checked") === "true";
            if (isChecked) {
              try { customCb.scrollIntoView({ block: "center" }); } catch(e) {}
              customCb.click();
            }
            const r = customCb.getBoundingClientRect();
            return {
              success: true,
              checked: false,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
        }
      }

      // 3. Cari dari semua input[type="checkbox"] di modal
      const allCheckboxes = Array.from(scope.querySelectorAll('input[type="checkbox"]'));
      for (const cb of allCheckboxes) {
        let parent = cb.parentElement;
        for (let depth = 0; depth < 5 && parent; depth++) {
          const txt = clean(parent.textContent);
          if (/tanpa\s*wali|daftarkan\s*tanpa\s*wali|tidak\s*ada\s*wali/i.test(txt)) {
            if (cb.checked) {
              try { cb.scrollIntoView({ block: "center" }); } catch(e) {}
              const clickTarget = cb.closest("label") || parent || cb;
              clickTarget.click();
              if (cb.checked) cb.click();
              cb.checked = false;
              cb.dispatchEvent(new Event("input", { bubbles: true }));
              cb.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const r = cb.getBoundingClientRect();
            return {
              success: true,
              checked: cb.checked,
              coords: { x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) }
            };
          }
          parent = parent.parentElement;
        }
      }

      return { success: false, checked: false };
    }).catch(() => ({ success: false, checked: false }));

    if (debuggerCmd && res && res.checked && res.coords) {
      try {
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x: res.coords.x, y: res.coords.y, button: "left", clickCount: 1 });
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: res.coords.x, y: res.coords.y, button: "left", clickCount: 1 });
      } catch(e) {}
    }

    return !res?.checked;
  }


  constructor({ tabId, patient, patientIndex, onStatus, delayMultiplier = 1, category = "UMUM" }) {
    this.tabId = tabId;
    this.patient = patient;
    this._patientIndex = patientIndex;
    this.onStatus = onStatus;
    this._stopped = false;
    this._reported = false;
    this._outcome = null;
    this._dm = Math.max(0.1, delayMultiplier);
    this.category = category;

    const isSekolah = "SEKOLAH" === category;
    this._timeoutNav = isSekolah ? 10000 : 20000;
    this._timeoutApi = isSekolah ? 5000 : 10000;
    this._timeoutTicket = isSekolah ? 8000 : 15000;
  }

  _sleep(ms) {
    return sleep(Math.round(ms * this._dm));
  }

  stop() {
    this._stopped = true;
    this._paused = false;
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
  }

  async _isStopped() {
    while (this._paused && !this._stopped) {
      await sleep(200);
    }
    if (this._stopped) return true;
    const key = `pendaftaranStop_${this._patientIndex}`;
    const stored = await chrome.storage.session.get(key);
    if (stored[key]) {
      this._stopped = true;
      return true;
    }
    return false;
  }

  _hasWaliData(p) {
    if (!p) return false;
    const norm = s => String(s || "").trim();
    const cleanNik = (
      norm(p.nikwali) || norm(p.nik_wali) || norm(p.nikWali) ||
      norm(p["NIK Wali"]) || norm(p["nik wali"]) || norm(p.nikibu) || norm(p.nik_ibu)
    ).replace(/\D/g, "");
    if (cleanNik.length >= 10) return true;

    const rawNama = (
      norm(p.namalengkapwali) || norm(p.namawali) || norm(p.nama_wali) ||
      norm(p.namaWali) || norm(p.namaLengkapWali) || norm(p["Nama Lengkap Wali"]) ||
      norm(p["nama lengkap wali"]) || norm(p.namaibu) || norm(p.nama_ibu)
    );
    if (rawNama.length >= 2 && !/^[-0\s]+$/.test(rawNama) && !/^pilih/i.test(rawNama)) return true;

    return false;
  }

  _isBalita(p) {
    if (!p) return false;

    // 1. Hitung umur berdasarkan tahun lahir jika tersedia
    const b = this._parseLahir(p);
    if (b?.tahun) {
      const birthYear = parseInt(b.tahun, 10);
      const currentYear = new Date().getFullYear();
      if (!isNaN(birthYear)) {
        const ageYears = currentYear - birthYear;
        // JIKA UMUR >= 7 TAHUN, MAKA 100% PASTI BUKAN BALITA!
        if (ageYears >= 7) return false;
        if (ageYears >= 0 && ageYears < 7) return true;
      }
    }

    // 2. Ekstrak umur dari digit NIK jika tanggal lahir belum terbaca
    const cleanNik = String(p.nik ?? p.NIK ?? "").replace(/\D/g, "");
    if (cleanNik.length === 16) {
      const yrTwo = parseInt(cleanNik.substring(10, 12), 10);
      const currentYrTwo = new Date().getFullYear() % 100;
      const fullYear = yrTwo <= currentYrTwo ? 2000 + yrTwo : 1900 + yrTwo;
      const ageYears = new Date().getFullYear() - fullYear;
      if (ageYears >= 7) return false;
      if (ageYears >= 0 && ageYears < 7) return true;
    }

    // 3. Indikator Sekolah & Pekerjaan/Pernikahan Dewasa
    if (p.sekolah || p.namasekolah || p.namaSekolah || p.kelas) return false;
    if (p.pekerjaan && !/belum|tidak\s*bekerja|anak|balita|siswa|pelajar/i.test(p.pekerjaan)) return false;
    if (p.statusPernikahan && /menikah|kawin|cerai/i.test(p.statusPernikahan)) return false;

    // 4. Kategori eksplisit
    if (p.category === "BALITA") return true;
    return false;
  }

  _parseDateString(raw) {
    if (!raw) return null;
    const monthMap = {
      1: "Jan", "01": "Jan", jan: "Jan", januari: "Jan", january: "Jan",
      2: "Feb", "02": "Feb", feb: "Feb", februari: "Feb", february: "Feb",
      3: "Mar", "03": "Mar", mar: "Mar", maret: "Mar", march: "Mar",
      4: "Apr", "04": "Apr", apr: "Apr", april: "Apr",
      5: "Mei", "05": "Mei", mei: "Mei", may: "Mei",
      6: "Jun", "06": "Jun", jun: "Jun", juni: "Jun", june: "Jun",
      7: "Jul", "07": "Jul", jul: "Jul", juli: "Jul", july: "Jul",
      8: "Agt", "08": "Agt", agt: "Agt", agustus: "Agt", aug: "Agt", august: "Agt",
      9: "Sep", "09": "Sep", sep: "Sep", september: "Sep",
      10: "Okt", "10": "Okt", okt: "Okt", oktober: "Okt", oct: "Okt", october: "Okt",
      11: "Nov", "11": "Nov", nov: "Nov", november: "Nov",
      12: "Des", "12": "Des", des: "Des", desember: "Des", dec: "Des", december: "Des"
    };

    const fromDate = d => ({
      tahun: String(d.getUTCFullYear()),
      bulan: monthMap[String(d.getUTCMonth() + 1)] ?? String(d.getUTCMonth() + 1),
      tanggal: String(d.getUTCDate())
    });

    if (raw instanceof Date) return fromDate(raw);

    const s = String(raw).trim();
    if (!s) return null;

    // Excel Serial Number
    const num = parseFloat(s);
    if (!isNaN(num) && num > 1000 && !/[/\.\-\s]/.test(s)) {
      const ms = (num - (num > 60 ? 25569 : 25568)) * 864e5;
      return fromDate(new Date(ms));
    }

    // Format Teks: "15 Januari 1995" atau "15-Jan-1995"
    const textMatch = s.match(/^(\d{1,2})[\s\-\/\.]*([a-zA-Z]+)[\s\-\/\.]*(\d{2,4})$/);
    if (textMatch) {
      let [, day, mStr, yr] = textMatch;
      let y = parseInt(yr, 10);
      if (y < 100) y += y <= 40 ? 2000 : 1900;
      const mKey = mStr.toLowerCase().slice(0, 3);
      const matchedMonth = monthMap[mKey] || monthMap[mStr.toLowerCase()];
      if (matchedMonth) {
        return {
          tahun: String(y),
          bulan: matchedMonth,
          tanggal: String(parseInt(day, 10))
        };
      }
    }

    // Format ISO: YYYY-MM-DD
    if (/^\d{4}[/\.\-]\d{1,2}[/\.\-]\d{1,2}$/.test(s.replace(/\s+/g, ""))) {
      const [y, m, d] = s.replace(/\s+/g, "").split(/[/\.\-]/);
      return {
        tahun: y,
        bulan: monthMap[String(parseInt(m, 10))] ?? m,
        tanggal: String(parseInt(d, 10))
      };
    }

    // Format Slash/Dash: DD/MM/YYYY
    const slashMatch = s.replace(/\s+/g, "").match(/^(\d{1,2})[/\.\-](\d{1,2})[/\.\-](\d{2,4})$/);
    if (slashMatch) {
      let [, p1, p2, yr] = slashMatch;
      let y = parseInt(yr, 10);
      if (y < 100) y += y <= 40 ? 2000 : 1900;
      let d = parseInt(p1, 10);
      let m = parseInt(p2, 10);
      if (p2 > 12) {
        m = parseInt(p1, 10);
        d = parseInt(p2, 10);
      }
      return {
        tahun: String(y),
        bulan: monthMap[String(m)] ?? String(m),
        tanggal: String(d)
      };
    }

    return null;
  }

  _parseLahir(t) {
    if (!t) return null;
    const y = String(t.tahunlahir ?? t.tahun ?? "").trim();
    const m = String(t.bulanlahir ?? t.bulan ?? "").trim();
    const d = String(t.tanggallahir ?? t.tanggal ?? "").trim();
    if (y && m && d && !d.includes("-") && !d.includes("/") && !d.includes(".")) {
      const monthMap = {
        1: "Jan", "01": "Jan", januari: "Jan", jan: "Jan",
        2: "Feb", "02": "Feb", februari: "Feb", feb: "Feb",
        3: "Mar", "03": "Mar", maret: "Mar", mar: "Mar",
        4: "Apr", "04": "Apr", april: "Apr", apr: "Apr",
        5: "Mei", "05": "Mei", mei: "Mei",
        6: "Jun", "06": "Jun", juni: "Jun", jun: "Jun",
        7: "Jul", "07": "Jul", juli: "Jul", jul: "Jul",
        8: "Agt", "08": "Agt", agustus: "Agt", agt: "Agt", aug: "Agt",
        9: "Sep", "09": "Sep", september: "Sep", sep: "Sep",
        10: "Okt", "10": "Okt", oktober: "Okt", okt: "Okt", oct: "Okt",
        11: "Nov", "11": "Nov", november: "Nov", nov: "Nov",
        12: "Des", "12": "Des", desember: "Des", des: "Des", dec: "Des"
      };
      return {
        tahun: y,
        bulan: monthMap[m.toLowerCase()] ?? m,
        tanggal: d
      };
    }

    const raw = t.tanggalLahir ?? t.tgllahir ?? t.tanggallahir ?? t.tgl_lahir ?? t.tanggal_lahir ??
      t.birthDate ?? t.birthdate ?? t.tglLahir ?? t["TANGGAL LAHIR"] ?? t["Tanggal Lahir"] ??
      t["TGL LAHIR"] ?? t["Tgl Lahir"] ?? t["tanggal lahir"] ?? t["tgl lahir"] ?? "";
    const parsed = this._parseDateString(raw);
    if (parsed) return parsed;

    // Fallback: Ekstrak Tanggal Lahir otomatis dari NIK (16 digit)
    const cleanNik = String(t.nik ?? t.NIK ?? "").replace(/\D/g, "");
    if (cleanNik.length === 16) {
      let dayVal = parseInt(cleanNik.substring(6, 8), 10);
      if (dayVal > 40) dayVal -= 40; // Perempuan: tgl + 40
      const monthVal = parseInt(cleanNik.substring(8, 10), 10);
      const yearTwo = parseInt(cleanNik.substring(10, 12), 10);
      const currentYearTwo = new Date().getFullYear() % 100;
      const fullYear = yearTwo <= currentYearTwo ? 2000 + yearTwo : 1900 + yearTwo;

      const monthMap = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Mei", 6: "Jun",
        7: "Jul", 8: "Agt", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Des"
      };

      if (dayVal >= 1 && dayVal <= 31 && monthVal >= 1 && monthVal <= 12) {
        return {
          tahun: String(fullYear),
          bulan: monthMap[monthVal] || String(monthVal),
          tanggal: String(dayVal)
        };
      }
    }

    return null;
  }

  _parseLahirWali(t) {
    const raw = t.tanggalLahirWali ?? t.tanggallahirwali ?? t.tgllahirwali ?? t.tgllhrwali ?? t.tglwali ??
      t.tgl_lahir_wali ?? t.tgllahir_wali ?? t.tanggal_lahir_wali ?? t["Tanggal Lahir Wali"] ?? t["TANGGAL LAHIR WALI"] ??
      t["Tgl Lahir Wali"] ?? t["TGL LAHIR WALI"] ?? "";
    const parsed = this._parseDateString(raw);
    if (parsed) return parsed;

    // Fallback cerdas: Ekstrak Tanggal Lahir otomatis dari NIK Wali (16 digit)
    const cleanNik = String(
      t.nikwali ?? t.nik_wali ?? t.nikWali ??
      t["NIK Wali"] ?? t["nik wali"] ??
      t.nikibu ?? t.nik_ibu ?? t.nikIbu ?? ""
    ).replace(/\D/g, "");

    if (cleanNik.length === 16) {
      let dayVal = parseInt(cleanNik.substring(6, 8), 10);
      if (dayVal > 40) dayVal -= 40; // Perempuan: tgl + 40
      const monthVal = parseInt(cleanNik.substring(8, 10), 10);
      const yearTwo = parseInt(cleanNik.substring(10, 12), 10);
      const currentYear = new Date().getFullYear();
      // Untuk wali (dewasa/orang tua), tahun lahir biasanya 19xx kecuali sangat muda (<18 tahun lalu)
      const fullYear = (yearTwo + 2000 <= currentYear - 17) ? 2000 + yearTwo : 1900 + yearTwo;

      const monthMap = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Mei", 6: "Jun",
        7: "Jul", 8: "Agt", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Des"
      };

      if (dayVal >= 1 && dayVal <= 31 && monthVal >= 1 && monthVal <= 12) {
        return {
          tahun: String(fullYear),
          bulan: monthMap[monthVal] || String(monthVal),
          tanggal: String(dayVal)
        };
      }
    }

    return null;
  }

  _parseJenisKelamin(t) {
    if (!t) return "Laki-laki";
    // 1. Prioritaskan ekstraksi pintar dari NIK 16 digit (digit 7-8: 41-71 = Perempuan, 01-31 = Laki-laki)
    const nik = String(t.nik ?? t.NIK ?? "").replace(/\D/g, "");
    if (nik.length === 16) {
      const dayVal = parseInt(nik.substring(6, 8), 10);
      const monthVal = parseInt(nik.substring(8, 10), 10);
      if (!isNaN(dayVal) && !isNaN(monthVal) && monthVal >= 1 && monthVal <= 12) {
        if (dayVal >= 41 && dayVal <= 71) return "Perempuan";
        if (dayVal >= 1 && dayVal <= 31) return "Laki-laki";
      }
    }

    const raw = String(
      t.jenisKelamin ?? t.jenis_kelamin ?? t.jeniskelamin ?? t.jeniskelaminpeserta ??
      t.jkpeserta ?? t.jk ?? t.gender ?? t.sex ?? t["JENIS KELAMIN"] ?? t["Jenis Kelamin"] ?? ""
    ).trim().toLowerCase();
    if (raw) {
      if (raw === "perempuan" || raw === "wanita" || raw === "female" || raw === "p" || raw === "w" || raw === "2" || raw.includes("perem") || raw.includes("wanita")) return "Perempuan";
      if (raw === "laki-laki" || raw === "laki - laki" || raw === "laki" || raw === "pria" || raw === "male" || raw === "l" || raw === "1" || raw.includes("laki") || raw.includes("pria")) return "Laki-laki";
    }

    // Fallback NIK >= 8 digit
    if (nik.length >= 8) {
      const dayVal = parseInt(nik.substring(6, 8), 10);
      if (dayVal > 40) return "Perempuan";
      if (dayVal >= 1 && dayVal <= 31) return "Laki-laki";
    }
    return "Laki-laki";
  }

  _parseJenisKelaminWali(t) {
    if (!t) return "Perempuan";
    // 1. Prioritaskan ekstraksi pintar dari NIK Wali 16 digit
    const nikWali = String(t.nikwali ?? t.nik_wali ?? t.nikWali ?? t["NIK Wali"] ?? t["nik wali"] ?? "").replace(/\D/g, "");
    if (nikWali.length === 16) {
      const dayVal = parseInt(nikWali.substring(6, 8), 10);
      const monthVal = parseInt(nikWali.substring(8, 10), 10);
      if (!isNaN(dayVal) && !isNaN(monthVal) && monthVal >= 1 && monthVal <= 12) {
        if (dayVal >= 41 && dayVal <= 71) return "Perempuan";
        if (dayVal >= 1 && dayVal <= 31) return "Laki-laki";
      }
    }

    const raw = String(
      t.jenisKelaminWali ?? t.jenis_kelamin_wali ?? t.jeniskelaminwali ??
      t.jkwali ?? t.jk_wali ?? t.genderwali ?? t.jkibu ?? t["Jenis Kelamin Wali"] ?? ""
    ).trim().toLowerCase();
    if (raw) {
      if (raw === "perempuan" || raw === "wanita" || raw === "female" || raw === "p" || raw === "w" || raw === "2" || raw.includes("perem") || raw.includes("wanita")) return "Perempuan";
      if (raw === "laki-laki" || raw === "laki - laki" || raw === "laki" || raw === "pria" || raw === "male" || raw === "l" || raw === "1" || raw.includes("laki") || raw.includes("pria")) return "Laki-laki";
    }

    if (nikWali.length >= 8) {
      const dayVal = parseInt(nikWali.substring(6, 8), 10);
      if (dayVal > 40) return "Perempuan";
      if (dayVal >= 1 && dayVal <= 31) return "Laki-laki";
    }
    return "Perempuan";
  }

  async _setGenderWithFallback(debuggerCmd, genderStr, isWali = false) {
    const { tabId } = this;
    if (!genderStr) return false;

    // 1. Eksekusi via DOM Selection (menggunakan pola single-click Vue combobox seperti injectWaliData)
    const domRes = await exec(tabId, async (genderTarget, forWali) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!genderTarget) return { success: false };
      const normGender = String(genderTarget).trim().toLowerCase();
      const isMale = normGender.startsWith("l") || normGender === "1" || normGender.includes("laki") || normGender.includes("pria");
      const targetText = isMale ? "Laki-laki" : "Perempuan";

      const getWaliHeading = () => {
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label")).filter(el => {
          if (el.children.length > 2) return false;
          const t = clean(el.innerText || el.textContent || "");
          return t === "isi data wali" || t.startsWith("isi data wali");
        });
        return headings[0] || null;
      };

      const waliHeading = getWaliHeading();
      const inWali = el => {
        if (!waliHeading || !el) return false;
        return (waliHeading.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;
      };

      // Tutup datepicker jika terbuka agar tidak menghalangi
      try {
        const datepickerPopups = document.querySelectorAll(".mx-datepicker-popup, .mx-datepicker-main");
        if (datepickerPopups.length > 0) {
          document.body.click();
          await sleep(150);
        }
      } catch(e) {}

      // Fungsi mencari trigger combobox Jenis Kelamin
      const findGenderTrigger = () => {
        // 1. Berdasarkan teks leaf 'Pilih jenis kelamin'
        const allPilih = Array.from(document.querySelectorAll("*")).filter(el => {
          if (el.children.length !== 0) return false;
          if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
          const t = clean(el.textContent || "");
          return t === "pilih jenis kelamin" || t.includes("pilih jenis kelamin");
        });
        const targetPilih = forWali ? allPilih.find(el => inWali(el)) : allPilih.find(el => !inWali(el));
        if (targetPilih) {
          return targetPilih.closest('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"], [role="button"], div.border, button') || targetPilih;
        }

        // 2. Berdasarkan komponen Vue [data-v-cf5614bc] .cursor-pointer (persis seperti injectWaliData)
        const vueTriggers = Array.from(document.querySelectorAll('[data-v-cf5614bc] .cursor-pointer, [role="combobox"]')).filter(el => {
          if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
          const t = clean(el.textContent || "");
          return t.includes("pilih jenis kelamin") || t === "laki-laki" || t === "perempuan";
        });
        const targetVue = forWali ? vueTriggers.find(el => inWali(el)) : vueTriggers.find(el => !inWali(el));
        if (targetVue) return targetVue;

        // 3. Berdasarkan label 'Jenis Kelamin'
        const allLabels = Array.from(document.querySelectorAll("label, div.font-semibold, div.text-sm, div.font-medium, p, span")).filter(el => {
          if (el.children.length > 2) return false;
          if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
          const t = clean((el.textContent || "").replace(/[*:]/g, ""));
          return t === "jenis kelamin" || t.startsWith("jenis kelamin");
        });
        const targetLabel = forWali ? allLabels.find(l => inWali(l)) : allLabels.find(l => !inWali(l));
        if (targetLabel) {
          const parent = targetLabel.closest('.w-full, .relative, .flex-col, div.mb-4, div.mb-3') || targetLabel.parentElement;
          const trg = parent?.querySelector('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"], [role="button"], button');
          if (trg && !trg.closest(".mx-datepicker")) return trg;

          let next = targetLabel.nextElementSibling;
          if (next) {
            const nextTrg = next.querySelector('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"], [role="button"], button') || (next.classList?.contains("cursor-pointer") ? next : null);
            if (nextTrg && !nextTrg.closest(".mx-datepicker")) return nextTrg;
          }
        }

        // 4. Trigger yang sudah terisi 'Laki-laki' atau 'Perempuan'
        const allCombos = Array.from(document.querySelectorAll('.cursor-pointer, [role="combobox"], [role="button"], button')).filter(el => {
          if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
          if (el.tagName === "INPUT" || el.querySelector("input") || el.children.length > 3) return false;
          const t = clean(el.textContent || "");
          return t === "laki-laki" || t === "perempuan";
        });
        return forWali ? allCombos.find(c => inWali(c)) : allCombos.find(c => !inWali(c));
      };

      const isMatch = txt => {
        const s = clean(txt || "");
        return isMale ? (s === "laki-laki" || s === "laki - laki" || s === "pria") : (s === "perempuan" || s === "wanita");
      };

      let lastTrgCoords = null;
      let lastOptCoords = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const trigger = findGenderTrigger();
        if (!trigger) {
          await sleep(250);
          continue;
        }

        // Cek jika sudah terpilih sesuai target
        const curTxt = clean(trigger.textContent || "");
        if (curTxt.includes(targetText.toLowerCase()) && !curTxt.includes("pilih")) {
          return { success: true };
        }

        // PENTING: Scroll trigger ke tengah layar TERLEBIH DAHULU sebelum membaca getBoundingClientRect()!
        try { trigger.scrollIntoView({ block: "center", inline: "center" }); } catch(e) {}
        await sleep(250);

        const trgRect = trigger.getBoundingClientRect();
        if (trgRect.width > 0 && trgRect.height > 0) {
          lastTrgCoords = { x: trgRect.left + trgRect.width / 2, y: trgRect.top + trgRect.height / 2 };
        }

        const compRoot = (trigger.parentElement && trigger.parentElement.parentElement) ||
                         trigger.parentElement?.closest('[data-v-cf5614bc]') ||
                         trigger.closest('.w-full[data-v-cf5614bc], [data-v-cf5614bc]') ||
                         trigger.parentElement ||
                         document.body;

        const getCandidates = () => {
          // 1. Cari di dalam compRoot (persis seperti injectWaliData yang terbukti 100% sukses)
          let list = Array.from(compRoot.querySelectorAll("div, li, p, span, a, button, [role='option']")).filter(d => {
            if (trigger.contains(d) || d === trigger) return false;
            const t = clean(d.textContent);
            return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan" || isMatch(t));
          });
          if (list.length > 0) return list;

          if (compRoot.parentElement) {
            list = Array.from(compRoot.parentElement.querySelectorAll("div, li, p, span, a, button, [role='option']")).filter(d => {
              if (trigger.contains(d) || d === trigger) return false;
              const t = clean(d.textContent);
              return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan" || isMatch(t));
            });
            if (list.length > 0) return list;
          }

          // 2. Floating containers / poppers
          const poppers = Array.from(document.querySelectorAll(
            '[class*="absolute"][class*="z-2000"], [class*="absolute"][class*="shadow"], .v-popper__popper, [role="listbox"], ul, div.fixed, div.absolute'
          ));
          for (const pop of poppers) {
            const matched = Array.from(pop.querySelectorAll("div, li, span, button, [role='option']")).filter(d => {
              if (trigger.contains(d) || d === trigger) return false;
              if (d.children.length > 1) return false;
              const t = clean(d.innerText || d.textContent);
              return t === "laki-laki" || t === "perempuan" || isMatch(t);
            });
            if (matched.length > 0) return matched;
          }

          // 3. Seluruh dokumen sesuai scope (peserta vs wali)
          return Array.from(document.querySelectorAll("[role='option'], li, div.cursor-pointer, span, button, div")).filter(d => {
            if (trigger.contains(d) || d === trigger) return false;
            if (d.tagName === "INPUT" || d.querySelector("input")) return false;
            if (!forWali && inWali(d)) return false;
            if (forWali && !inWali(d)) return false;
            const t = clean(d.innerText || d.textContent);
            return d.children.length <= 1 && (t === "laki-laki" || t === "perempuan" || isMatch(t));
          });
        };

        let candidates = getCandidates();
        if (candidates.length === 0) {
          // Gunakan single-click bersih seperti injectWaliData agar tidak men-toggle buka-tutup sekaligus!
          if (attempt === 1 || attempt === 3) {
            if (typeof trigger.click === "function") trigger.click();
            else trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          } else {
            trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
            trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
            if (typeof trigger.click === "function") trigger.click();
          }
          await sleep(350);

          for (let w = 0; w < 10; w++) {
            candidates = getCandidates();
            if (candidates.length > 0) break;
            await sleep(150);
          }
        }

        let opt = isMale
          ? (candidates.find(d => isMatch(d.innerText || d.textContent)) || candidates[0])
          : (candidates.find(d => isMatch(d.innerText || d.textContent)) || candidates[1] || candidates[candidates.length - 1]);

        if (opt) {
          try { opt.scrollIntoView({ block: "nearest" }); } catch(err) {}
          await sleep(180);
          const optRect = opt.getBoundingClientRect();
          if (optRect.width > 0 && optRect.height > 0) {
            lastOptCoords = { x: optRect.left + optRect.width / 2, y: optRect.top + optRect.height / 2 };
          }
          const clickable = opt.closest("[role='option'], li, button, div.cursor-pointer") || opt;
          clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
          clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
          if (typeof clickable.click === "function") clickable.click();
          await sleep(380);

          const checkTxt = clean(trigger.textContent || "");
          if (checkTxt.includes(targetText.toLowerCase()) && !checkTxt.includes("pilih")) {
            return { success: true };
          }
        }

        await sleep(250);
      }

      return {
        success: false,
        needCdp: Boolean(lastTrgCoords),
        trgCoords: lastTrgCoords,
        optCoords: lastOptCoords
      };
    }, [genderStr, isWali]).catch(() => ({ success: false }));

    if (domRes?.success) return true;

    // 2. Dual Guarantee: Fallback via Chrome Debugger Protocol (CDP Mouse Hardware Touch)
    if (debuggerCmd && domRes?.needCdp && domRes?.trgCoords) {
      try {
        const tx = Math.round(domRes.trgCoords.x);
        const ty = Math.round(domRes.trgCoords.y);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: tx, y: ty });
        await this._sleep(30);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x: tx, y: ty, button: "left", clickCount: 1 });
        await this._sleep(50);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: tx, y: ty, button: "left", clickCount: 1 });
        await this._sleep(400);

        // Cari koordinat opsi 'Laki-laki' / 'Perempuan' yang sekarang terbuka di DOM setelah klik CDP
        let optCoords = await exec(tabId, (genderTarget, forWali) => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const normGender = String(genderTarget).trim().toLowerCase();
          const isMale = normGender.startsWith("l") || normGender === "1" || normGender.includes("laki") || normGender.includes("pria");
          const target = isMale ? "laki-laki" : "perempuan";

          const waliHeading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label")).find(el => {
            if (el.children.length > 2) return false;
            const t = clean(el.innerText || el.textContent || "");
            return t === "isi data wali" || t.startsWith("isi data wali");
          });
          const inWali = el => waliHeading && (waliHeading.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;

          const items = Array.from(document.querySelectorAll("[role='option'], li, div.cursor-pointer, span, button, p, div")).filter(d => {
            if (d.children.length > 1) return false;
            const r = d.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            if (!forWali && inWali(d)) return false;
            if (forWali && !inWali(d)) return false;
            const t = clean(d.innerText || d.textContent || "");
            return t === target;
          });
          const opt = items[items.length - 1] || items[0];
          if (!opt) return null;
          const r = opt.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, [genderStr, isWali]).catch(() => null);

        if (!optCoords) {
          if (domRes.optCoords) {
            optCoords = domRes.optCoords;
          } else {
            const normG = String(genderStr).trim().toLowerCase();
            const isMaleFallback = normG.startsWith("l") || normG === "1" || normG.includes("laki") || normG.includes("pria");
            optCoords = { x: tx, y: ty + (isMaleFallback ? 42 : 80) };
          }
        }

        const ox = Math.round(optCoords.x);
        const oy = Math.round(optCoords.y);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: ox, y: oy });
        await this._sleep(30);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x: ox, y: oy, button: "left", clickCount: 1 });
        await this._sleep(50);
        await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: ox, y: oy, button: "left", clickCount: 1 });
        await this._sleep(400);

        const isOk = await exec(tabId, (genderTarget, forWali) => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const normGender = String(genderTarget).trim().toLowerCase();
          const isMale = normGender.startsWith("l") || normGender === "1" || normGender.includes("laki") || normGender.includes("pria");
          const target = isMale ? "laki-laki" : "perempuan";

          const waliHeading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label")).find(el => {
            if (el.children.length > 2) return false;
            const t = clean(el.innerText || el.textContent || "");
            return t === "isi data wali" || t.startsWith("isi data wali");
          });
          const inWali = el => waliHeading && (waliHeading.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0;

          const allCombos = Array.from(document.querySelectorAll('[data-v-cf5614bc] .cursor-pointer, .cursor-pointer, [role="combobox"], [role="button"], button')).filter(el => {
            if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
            if (el.tagName === "INPUT" || el.querySelector("input") || el.children.length > 3) return false;
            const t = clean(el.textContent || "");
            return t === "pilih jenis kelamin" || t === "laki-laki" || t === "perempuan";
          });
          const trg = forWali ? allCombos.find(c => inWali(c)) : allCombos.find(c => !inWali(c));
          if (!trg) return false;
          const txt = clean(trg.textContent || "");
          return txt.includes(target) && !txt.includes("pilih");
        }, [genderStr, isWali]).catch(() => false);

        if (isOk) return true;
      } catch(e) {}
    }

    return false;
  }

  _resolveAlamatParts(t) {
    const cap = s => String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const isJobOrStatus = s => {
      const txt = String(s || "").trim().toLowerCase();
      if (!txt || txt === "-" || txt === "0") return false;
      return /^(belum|tidak)\s*\/?\s*(belum|tidak)?\s*bekerja$|^tidak bekerja$|^belum bekerja$|ibu rumah tangga|\birt\b|mengurus rumah|wiraswasta|wirausaha|pedagang|petani|pekebun|nelayan|buruh|karyawan|pegawai|swasta|\bpns\b|\basn\b|\btni\b|\bpolri\b|pelajar|mahasiswa|pensiunan|menikah|belum menikah|kawin|belum kawin|cerai hidup|cerai mati|tidak memiliki disabilitas|disabilitas|\bpbi\b|bpjs|mandiri/i.test(txt);
    };

    let prov = String(
      t.provinsi ?? t.province ?? t.prov ?? t.propinsi ??
      t["PROVINSI"] ?? t["Provinsi"] ?? t["PROV"] ?? ""
    ).trim();
    let kab = String(
      t.kabkota ?? t.kota ?? t.kabupaten ?? t.kabupatenKota ?? t.city ?? t.kab ??
      t["KAB/KOTA"] ?? t["KABUPATEN"] ?? t["KOTA"] ?? t["Kab/Kota"] ?? ""
    ).trim();
    let kec = String(
      t.kecamatan ?? t.district ?? t.kec ??
      t["KECAMATAN"] ?? t["Kecamatan"] ?? t["KEC"] ?? ""
    ).trim();
    let kel = String(
      t.kelurahan ?? t.desa ?? t.subdistrict ?? t.desaataukelurahan ?? t.kel ??
      t["KELURAHAN"] ?? t["DESA"] ?? t["Kelurahan"] ?? t["Desa"] ?? ""
    ).trim();
    let detail = String(
      t.detailalamat ?? t.detaildomisili ?? t.alamat ?? t.address ??
      t["DETAIL ALAMAT"] ?? t["ALAMAT"] ?? t["Alamat"] ?? ""
    ).trim();

    // Jika kolom PROVINSI tidak sengaja berisi pekerjaan (misal "Tidak Bekerja" akibat pergeseran kolom template 7-sheet vs Umum),
    // geser kembali [kab, kec, kel, detail] menjadi [prov, kab, kec, kel]!
    if (isJobOrStatus(prov)) {
      prov = kab;
      kab = kec;
      kec = kel;
      kel = (!isJobOrStatus(detail) ? detail : "");
    }

    // Sterilkan setiap slot wilayah agar TIDAK PERNAH kemasukan teks pekerjaan/status pernikahan/asuransi
    if (isJobOrStatus(prov)) prov = "";
    if (isJobOrStatus(kab)) kab = "";
    if (isJobOrStatus(kec)) kec = "";
    if (isJobOrStatus(kel)) kel = "";
    if (isJobOrStatus(detail)) detail = "";

    if (kec.toLowerCase().replace(/\s+/g, "") === "gunungsari") kec = "Gunungsari";
    if (kab.toLowerCase().replace(/[^a-z]/g, "") === "lombokbarat") kab = "Kab. Lombok Barat";
    if (prov.toLowerCase().replace(/[^a-z]/g, "") === "nusatenggarabarat" || prov.toLowerCase() === "ntb") prov = "Nusa Tenggara Barat";

    const allAddrText = [detail, kel, kec, kab, prov].join(" ").toLowerCase();

    // HANYA jalankan pemetaan kata kunci dusun jika kolom Provinsi, Kab/Kota, dan Kecamatan di Excel benar-benar kosong!
    // Jika di Excel sudah terisi (misal Sumatera Selatan / Kota Palembang / Ilir Barat Dua / 32 ILIR), gunakan 100% sesuai Excel!
    if (!prov && !kab && !kec) {
      if (
        allAddrText.includes("sesela") ||
        allAddrText.includes("bile tepung") ||
        allAddrText.includes("kebun indah") ||
        allAddrText.includes("kebun lauk") ||
        allAddrText.includes("kebun bawak") ||
        allAddrText.includes("johar pelita")
      ) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Sesela";
      } else if (allAddrText.includes("midang") || allAddrText.includes("belencong") || allAddrText.includes("gegutu")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Midang";
      } else if (allAddrText.includes("jatisela") || allAddrText.includes("montong pace") || allAddrText.includes("ireng")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Jatisela";
      } else if (allAddrText.includes("kekeri")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Kekeri";
      } else if (allAddrText.includes("penimbun") || allAddrText.includes("penimbung")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Penimbung";
      } else if (allAddrText.includes("mambalan")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Mambalan";
      } else if (allAddrText.includes("ranjok")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Ranjok";
      } else if (allAddrText.includes("dopang")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Dopang";
      } else if (allAddrText.includes("tamansari")) {
        prov = "Nusa Tenggara Barat";
        kab = "Kab. Lombok Barat";
        kec = "Gunungsari";
        if (!kel) kel = "Tamansari";
      } else if (allAddrText.includes("gunung manau")) {
        prov = "Kalimantan Selatan";
        kab = "Kab. Balangan";
        kec = "Batu Mandi";
        if (!kel) kel = "Gunung Manau";
      }
    }

    // Ekstraksi cerdas Desa/Kelurahan/Kecamatan/Kabupaten dari teks detail alamat jika kolom terpisah kosong (Universal se-Indonesia)
    if (detail) {
      if (!kel) {
        const mKel = detail.match(/\b(?:kel(?:urahan)?|desa|ds|amp|kampung|nagari|gampong|pekon|lembang)\.?\s+([a-zA-Z0-9\s\-]{3,25}?)(?=\s*(?:,|\b(?:kec|kab|kota|prov|rt|rw|no|blok|kode)\b|$))/i);
        if (mKel && mKel[1]) kel = mKel[1].trim();
      }
      if (!kec) {
        const mKec = detail.match(/\b(?:kec(?:amatan)?|distrik|kap(?:anewon)?|kem(?:antren)?)\.?\s+([a-zA-Z0-9\s\-]{3,25}?)(?=\s*(?:,|\b(?:kel|desa|kab|kota|prov|rt|rw|no|blok|kode)\b|$))/i);
        if (mKec && mKec[1]) kec = mKec[1].trim();
      }
      if (!kab) {
        const mKab = detail.match(/\b(kab(?:upaten)?\.?\s+[a-zA-Z\s]{3,25}?|kota\s+[a-zA-Z\s]{3,25}?)(?=\s*(?:,|\b(?:kec|kel|desa|prov|rt|rw)\b|$))/i);
        if (mKab && mKab[1]) kab = mKab[1].trim();
      }
    }

    // Fallback NIK (38 Provinsi & Kabupaten/Kota Seluruh Indonesia berdasarkan Kode Kemendagri/Dukcapil)
    const cleanNik = String(t.nik ?? t.NIK ?? "").replace(/\D/g, "");
    if (cleanNik.length >= 4 && (!prov || !kab || !kec)) {
      const nik2 = cleanNik.substring(0, 2);
      const nik4 = cleanNik.substring(0, 4);
      const nik6 = cleanNik.substring(0, 6);

      const nikProvMap = {
        "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
        "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Kepulauan Bangka Belitung", "21": "Kepulauan Riau",
        "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah", "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten",
        "51": "Bali", "52": "Nusa Tenggara Barat", "53": "Nusa Tenggara Timur",
        "61": "Kalimantan Barat", "62": "Kalimantan Tengah", "63": "Kalimantan Selatan", "64": "Kalimantan Timur", "65": "Kalimantan Utara",
        "71": "Sulawesi Utara", "72": "Sulawesi Tengah", "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "75": "Gorontalo", "76": "Sulawesi Barat",
        "81": "Maluku", "82": "Maluku Utara",
        "91": "Papua", "92": "Papua Barat", "93": "Papua Selatan", "94": "Papua Tengah", "95": "Papua Pegunungan", "96": "Papua Barat Daya"
      };

      const nikKabMap = {
        // Aceh (11)
        "1101": "Kab. Aceh Selatan", "1102": "Kab. Aceh Tenggara", "1103": "Kab. Aceh Timur", "1104": "Kab. Aceh Tengah", "1105": "Kab. Aceh Barat", "1106": "Kab. Aceh Besar", "1107": "Kab. Pidie", "1108": "Kab. Aceh Utara", "1109": "Kab. Simeulue", "1110": "Kab. Aceh Singkil", "1111": "Kab. Bireuen", "1112": "Kab. Aceh Barat Daya", "1113": "Kab. Gayo Lues", "1114": "Kab. Aceh Jaya", "1115": "Kab. Nagan Raya", "1116": "Kab. Aceh Tamiang", "1117": "Kab. Bener Meriah", "1118": "Kab. Pidie Jaya", "1171": "Kota Banda Aceh", "1172": "Kota Sabang", "1173": "Kota Lhokseumawe", "1174": "Kota Langsa", "1175": "Kota Subulussalam",
        // Sumut (12)
        "1201": "Kab. Tapanuli Tengah", "1202": "Kab. Tapanuli Utara", "1203": "Kab. Tapanuli Selatan", "1204": "Kab. Nias", "1205": "Kab. Langkat", "1206": "Kab. Karo", "1207": "Kab. Deli Serdang", "1208": "Kab. Simalungun", "1209": "Kab. Asahan", "1210": "Kab. Labuhanbatu", "1211": "Kab. Dairi", "1212": "Kab. Toba", "1213": "Kab. Mandailing Natal", "1214": "Kab. Nias Selatan", "1215": "Kab. Pakpak Bharat", "1216": "Kab. Humbang Hasundutan", "1217": "Kab. Samosir", "1218": "Kab. Serdang Bedagai", "1219": "Kab. Batu Bara", "1220": "Kab. Padang Lawas Utara", "1221": "Kab. Padang Lawas", "1222": "Kab. Labuhanbatu Selatan", "1223": "Kab. Labuhanbatu Utara", "1224": "Kab. Nias Utara", "1225": "Kab. Nias Barat", "1271": "Kota Medan", "1272": "Kota Pematangsiantar", "1273": "Kota Sibolga", "1274": "Kota Tanjungbalai", "1275": "Kota Binjai", "1276": "Kota Tebing Tinggi", "1277": "Kota Padangsidimpuan", "1278": "Kota Gunungsitoli",
        // Sumbar (13), Riau (14), Jambi (15), Sumsel (16), Bengkulu (17), Lampung (18), Babel (19), Kepri (21)
        "1301": "Kab. Pesisir Selatan", "1302": "Kab. Solok", "1303": "Kab. Sijunjung", "1304": "Kab. Tanah Datar", "1305": "Kab. Padang Pariaman", "1306": "Kab. Agam", "1307": "Kab. Lima Puluh Kota", "1308": "Kab. Pasaman", "1309": "Kab. Kepulauan Mentawai", "1310": "Kab. Dharmasraya", "1311": "Kab. Solok Selatan", "1312": "Kab. Pasaman Barat", "1371": "Kota Padang", "1372": "Kota Solok", "1373": "Kota Sawahlunto", "1374": "Kota Padang Panjang", "1375": "Kota Bukittinggi", "1376": "Kota Payakumbuh", "1377": "Kota Pariaman",
        "1401": "Kab. Kampar", "1402": "Kab. Indragiri Hulu", "1403": "Kab. Bengkalis", "1404": "Kab. Indragiri Hilir", "1405": "Kab. Pelalawan", "1406": "Kab. Rokan Hulu", "1407": "Kab. Rokan Hilir", "1408": "Kab. Siak", "1409": "Kab. Kuantan Singingi", "1410": "Kab. Kepulauan Meranti", "1471": "Kota Pekanbaru", "1472": "Kota Dumai",
        "1501": "Kab. Kerinci", "1502": "Kab. Merangin", "1503": "Kab. Sarolangun", "1504": "Kab. Batanghari", "1505": "Kab. Muaro Jambi", "1506": "Kab. Tanjung Jabung Barat", "1507": "Kab. Tanjung Jabung Timur", "1508": "Kab. Bungo", "1509": "Kab. Tebo", "1571": "Kota Jambi", "1572": "Kota Sungai Penuh",
        "1601": "Kab. Ogan Komering Ulu", "1602": "Kab. Ogan Komering Ilir", "1603": "Kab. Muara Enim", "1604": "Kab. Lahat", "1605": "Kab. Musi Rawas", "1606": "Kab. Musi Banyuasin", "1607": "Kab. Banyuasin", "1608": "Kab. OKU Timur", "1609": "Kab. OKU Selatan", "1610": "Kab. Ogan Ilir", "1611": "Kab. Empat Lawang", "1612": "Kab. PALI", "1613": "Kab. Musi Rawas Utara", "1671": "Kota Palembang", "1672": "Kota Pagar Alam", "1673": "Kota Lubuklinggau", "1674": "Kota Prabumulih",
        "1701": "Kab. Bengkulu Selatan", "1702": "Kab. Rejang Lebong", "1703": "Kab. Bengkulu Utara", "1704": "Kab. Kaur", "1705": "Kab. Seluma", "1706": "Kab. Mukomuko", "1707": "Kab. Lebong", "1708": "Kab. Kepahiang", "1709": "Kab. Bengkulu Tengah", "1771": "Kota Bengkulu",
        "1801": "Kab. Lampung Selatan", "1802": "Kab. Lampung Tengah", "1803": "Kab. Lampung Utara", "1804": "Kab. Lampung Barat", "1805": "Kab. Tulang Bawang", "1806": "Kab. Tanggamus", "1807": "Kab. Lampung Timur", "1808": "Kab. Way Kanan", "1809": "Kab. Pesawaran", "1810": "Kab. Pringsewu", "1811": "Kab. Mesuji", "1812": "Kab. Tulang Bawang Barat", "1813": "Kab. Pesisir Barat", "1871": "Kota Bandar Lampung", "1872": "Kota Metro",
        "1901": "Kab. Bangka", "1902": "Kab. Belitung", "1903": "Kab. Bangka Selatan", "1904": "Kab. Bangka Tengah", "1905": "Kab. Bangka Barat", "1906": "Kab. Belitung Timur", "1971": "Kota Pangkalpinang",
        "2101": "Kab. Bintan", "2102": "Kab. Karimun", "2103": "Kab. Natuna", "2104": "Kab. Lingga", "2105": "Kab. Kepulauan Anambas", "2171": "Kota Batam", "2172": "Kota Tanjungpinang",
        // DKI Jakarta (31), Jawa Barat (32), Jawa Tengah (33), DIY (34), Jawa Timur (35), Banten (36)
        "3101": "Kab. Kepulauan Seribu", "3171": "Kota Jakarta Pusat", "3172": "Kota Jakarta Utara", "3173": "Kota Jakarta Barat", "3174": "Kota Jakarta Selatan", "3175": "Kota Jakarta Timur",
        "3201": "Kab. Bogor", "3202": "Kab. Sukabumi", "3203": "Kab. Cianjur", "3204": "Kab. Bandung", "3205": "Kab. Garut", "3206": "Kab. Tasikmalaya", "3207": "Kab. Ciamis", "3208": "Kab. Kuningan", "3209": "Kab. Cirebon", "3210": "Kab. Majalengka", "3211": "Kab. Sumedang", "3212": "Kab. Indramayu", "3213": "Kab. Subang", "3214": "Kab. Purwakarta", "3215": "Kab. Karawang", "3216": "Kab. Bekasi", "3217": "Kab. Bandung Barat", "3218": "Kab. Pangandaran", "3271": "Kota Bogor", "3272": "Kota Sukabumi", "3273": "Kota Bandung", "3274": "Kota Cirebon", "3275": "Kota Bekasi", "3276": "Kota Depok", "3277": "Kota Cimahi", "3278": "Kota Tasikmalaya", "3279": "Kota Banjar",
        "3301": "Kab. Cilacap", "3302": "Kab. Banyumas", "3303": "Kab. Purbalingga", "3304": "Kab. Banjarnegara", "3305": "Kab. Kebumen", "3306": "Kab. Purworejo", "3307": "Kab. Wonosobo", "3308": "Kab. Magelang", "3309": "Kab. Boyolali", "3310": "Kab. Klaten", "3311": "Kab. Sukoharjo", "3312": "Kab. Wonogiri", "3313": "Kab. Karanganyar", "3314": "Kab. Sragen", "3315": "Kab. Grobogan", "3316": "Kab. Blora", "3317": "Kab. Rembang", "3318": "Kab. Pati", "3319": "Kab. Kudus", "3320": "Kab. Jepara", "3321": "Kab. Demak", "3322": "Kab. Semarang", "3323": "Kab. Temanggung", "3324": "Kab. Kendal", "3325": "Kab. Batang", "3326": "Kab. Pekalongan", "3327": "Kab. Pemalang", "3328": "Kab. Tegal", "3329": "Kab. Brebes", "3371": "Kota Magelang", "3372": "Kota Surakarta", "3373": "Kota Salatiga", "3374": "Kota Semarang", "3375": "Kota Pekalongan", "3376": "Kota Tegal",
        "3401": "Kab. Kulon Progo", "3402": "Kab. Bantul", "3403": "Kab. Gunungkidul", "3404": "Kab. Sleman", "3471": "Kota Yogyakarta",
        "3501": "Kab. Pacitan", "3502": "Kab. Ponorogo", "3503": "Kab. Trenggalek", "3504": "Kab. Tulungagung", "3505": "Kab. Blitar", "3506": "Kab. Kediri", "3507": "Kab. Malang", "3508": "Kab. Lumajang", "3509": "Kab. Jember", "3510": "Kab. Banyuwangi", "3511": "Kab. Bondowoso", "3512": "Kab. Situbondo", "3513": "Kab. Probolinggo", "3514": "Kab. Pasuruan", "3515": "Kab. Sidoarjo", "3516": "Kab. Mojokerto", "3517": "Kab. Jombang", "3518": "Kab. Nganjuk", "3519": "Kab. Madiun", "3520": "Kab. Magetan", "3521": "Kab. Ngawi", "3522": "Kab. Bojonegoro", "3523": "Kab. Tuban", "3524": "Kab. Lamongan", "3525": "Kab. Gresik", "3526": "Kab. Bangkalan", "3527": "Kab. Sampang", "3528": "Kab. Pamekasan", "3529": "Kab. Sumenep", "3571": "Kota Kediri", "3572": "Kota Blitar", "3573": "Kota Malang", "3574": "Kota Probolinggo", "3575": "Kota Pasuruan", "3576": "Kota Mojokerto", "3577": "Kota Madiun", "3578": "Kota Surabaya", "3579": "Kota Batu",
        "3601": "Kab. Pandeglang", "3602": "Kab. Lebak", "3603": "Kab. Tangerang", "3604": "Kab. Serang", "3671": "Kota Tangerang", "3672": "Kota Cilegon", "3673": "Kota Serang", "3674": "Kota Tangerang Selatan",
        // Bali (51), NTB (52), NTT (53)
        "5101": "Kab. Jembrana", "5102": "Kab. Tabanan", "5103": "Kab. Badung", "5104": "Kab. Gianyar", "5105": "Kab. Klungkung", "5106": "Kab. Bangli", "5107": "Kab. Karangasem", "5108": "Kab. Buleleng", "5171": "Kota Denpasar",
        "5201": "Kab. Lombok Barat", "5202": "Kab. Lombok Tengah", "5203": "Kab. Lombok Timur", "5204": "Kab. Sumbawa", "5205": "Kab. Dompu", "5206": "Kab. Bima", "5207": "Kab. Sumbawa Barat", "5208": "Kab. Lombok Utara", "5271": "Kota Mataram", "5272": "Kota Bima",
        "5301": "Kab. Kupang", "5302": "Kab. Timor Tengah Selatan", "5303": "Kab. Timor Tengah Utara", "5304": "Kab. Belu", "5305": "Kab. Alor", "5306": "Kab. Flores Timur", "5307": "Kab. Sikka", "5308": "Kab. Ende", "5309": "Kab. Ngada", "5310": "Kab. Manggarai", "5311": "Kab. Sumba Timur", "5312": "Kab. Sumba Barat", "5313": "Kab. Lembata", "5314": "Kab. Rote Ndao", "5315": "Kab. Manggarai Barat", "5316": "Kab. Nagekeo", "5317": "Kab. Sumba Tengah", "5318": "Kab. Sumba Barat Daya", "5319": "Kab. Manggarai Timur", "5320": "Kab. Sabu Raijua", "5321": "Kab. Malaka", "5371": "Kota Kupang",
        // Kalimantan (61-65)
        "6101": "Kab. Sambas", "6102": "Kab. Mempawah", "6103": "Kab. Sanggau", "6104": "Kab. Ketapang", "6105": "Kab. Sintang", "6106": "Kab. Kapuas Hulu", "6107": "Kab. Bengkayang", "6108": "Kab. Landak", "6109": "Kab. Sekadau", "6110": "Kab. Melawi", "6111": "Kab. Kayong Utara", "6112": "Kab. Kubu Raya", "6171": "Kota Pontianak", "6172": "Kota Singkawang",
        "6201": "Kab. Kotawaringin Barat", "6202": "Kab. Kotawaringin Timur", "6203": "Kab. Kapuas", "6204": "Kab. Barito Selatan", "6205": "Kab. Barito Utara", "6206": "Kab. Katingan", "6207": "Kab. Seruyan", "6208": "Kab. Sukamara", "6209": "Kab. Lamandau", "6210": "Kab. Gunung Mas", "6211": "Kab. Pulang Pisau", "6212": "Kab. Murung Raya", "6213": "Kab. Barito Timur", "6271": "Kota Palangka Raya",
        "6301": "Kab. Tanah Laut", "6302": "Kab. Kotabaru", "6303": "Kab. Banjar", "6304": "Kab. Barito Kuala", "6305": "Kab. Tapin", "6306": "Kab. Hulu Sungai Selatan", "6307": "Kab. Hulu Sungai Tengah", "6308": "Kab. Hulu Sungai Utara", "6309": "Kab. Tabalong", "6310": "Kab. Tanah Bumbu", "6311": "Kab. Balangan", "6371": "Kota Banjarmasin", "6372": "Kota Banjarbaru",
        "6401": "Kab. Paser", "6402": "Kab. Kutai Kartanegara", "6403": "Kab. Berau", "6407": "Kab. Kutai Barat", "6408": "Kab. Kutai Timur", "6409": "Kab. Penajam Paser Utara", "6411": "Kab. Mahakam Ulu", "6471": "Kota Balikpapan", "6472": "Kota Samarinda", "6474": "Kota Bontang",
        "6501": "Kab. Bulungan", "6502": "Kab. Malinau", "6503": "Kab. Nunukan", "6504": "Kab. Tana Tidung", "6571": "Kota Tarakan",
        // Sulawesi (71-76), Maluku (81-82), Papua (91-96)
        "7101": "Kab. Bolaang Mongondow", "7102": "Kab. Minahasa", "7103": "Kab. Kepulauan Sangihe", "7104": "Kab. Kepulauan Talaud", "7105": "Kab. Minahasa Selatan", "7106": "Kab. Minahasa Utara", "7107": "Kab. Minahasa Tenggara", "7108": "Kab. Bolaang Mongondow Utara", "7171": "Kota Manado", "7172": "Kota Bitung", "7173": "Kota Tomohon", "7174": "Kota Kotamobagu",
        "7201": "Kab. Banggai", "7202": "Kab. Poso", "7203": "Kab. Donggala", "7204": "Kab. Tolitoli", "7205": "Kab. Buol", "7206": "Kab. Morowali", "7207": "Kab. Banggai Kepulauan", "7208": "Kab. Parigi Moutong", "7209": "Kab. Tojo Una-Una", "7210": "Kab. Sigi", "7271": "Kota Palu",
        "7301": "Kab. Kepulauan Selayar", "7302": "Kab. Bulukumba", "7303": "Kab. Bantaeng", "7304": "Kab. Jeneponto", "7305": "Kab. Takalar", "7306": "Kab. Gowa", "7307": "Kab. Sinjai", "7308": "Kab. Bone", "7309": "Kab. Maros", "7310": "Kab. Pangkajene dan Kepulauan", "7311": "Kab. Barru", "7312": "Kab. Soppeng", "7313": "Kab. Wajo", "7314": "Kab. Sidenreng Rappang", "7315": "Kab. Pinrang", "7316": "Kab. Enrekang", "7317": "Kab. Luwu", "7318": "Kab. Tana Toraja", "7322": "Kab. Luwu Utara", "7324": "Kab. Luwu Timur", "7326": "Kab. Toraja Utara", "7371": "Kota Makassar", "7372": "Kota Parepare", "7373": "Kota Palopo",
        "7401": "Kab. Kolaka", "7402": "Kab. Konawe", "7403": "Kab. Muna", "7404": "Kab. Buton", "7405": "Kab. Konawe Selatan", "7406": "Kab. Bombana", "7407": "Kab. Wakatobi", "7408": "Kab. Kolaka Utara", "7471": "Kota Kendari", "7472": "Kota Baubau",
        "7501": "Kab. Gorontalo", "7502": "Kab. Boalemo", "7503": "Kab. Bone Bolango", "7504": "Kab. Pohuwato", "7505": "Kab. Gorontalo Utara", "7571": "Kota Gorontalo",
        "7601": "Kab. Pasangkayu", "7602": "Kab. Mamuju", "7603": "Kab. Mamasa", "7604": "Kab. Polewali Mandar", "7605": "Kab. Majene", "7606": "Kab. Mamuju Tengah",
        "8101": "Kab. Maluku Tengah", "8102": "Kab. Maluku Tenggara", "8103": "Kab. Kepulauan Tanimbar", "8104": "Kab. Buru", "8171": "Kota Ambon", "8172": "Kota Tual",
        "8201": "Kab. Halmahera Barat", "8202": "Kab. Halmahera Tengah", "8203": "Kab. Halmahera Utara", "8204": "Kab. Halmahera Selatan", "8271": "Kota Ternate", "8272": "Kota Tidore Kepulauan",
        "9101": "Kab. Merauke", "9102": "Kab. Jayawijaya", "9103": "Kab. Jayapura", "9104": "Kab. Nabire", "9106": "Kab. Biak Numfor", "9109": "Kab. Mimika", "9171": "Kota Jayapura",
        "9201": "Kab. Fakfak", "9202": "Kab. Manokwari", "9271": "Kota Sorong"
      };

      const wilMap6 = {
        // Balangan, Kalsel
        "631104": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Batu Mandi", kel: "Gunung Manau" },
        "631101": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Juai" },
        "631102": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Halong" },
        "631103": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Awayan" },
        "631105": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Lampihong" },
        "631106": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Paringin" },
        "631107": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Paringin Selatan" },
        "631108": { prov: "Kalimantan Selatan", kab: "Kab. Balangan", kec: "Tebing Tinggi" },
        // Lombok Barat, NTB
        "520101": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Gerung" },
        "520102": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Kediri" },
        "520103": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Narmada" },
        "520104": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Sekotong" },
        "520107": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Labuapi" },
        "520108": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Gunungsari", kel: "Sesela" },
        "520109": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Lingsar" },
        "520112": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Lembar" },
        "520113": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Batu Layar" },
        "520114": { prov: "Nusa Tenggara Barat", kab: "Kab. Lombok Barat", kec: "Kuripan" },
        // Kota Mataram, NTB
        "527101": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Ampenan" },
        "527102": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Mataram" },
        "527103": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Cakranegara" },
        "527104": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Sekarbela" },
        "527105": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Selaparang" },
        "527106": { prov: "Nusa Tenggara Barat", kab: "Kota Mataram", kec: "Sandubaya" }
      };

      const matched6 = wilMap6[nik6];
      if (matched6) {
        if (!prov) prov = matched6.prov;
        if (!kab) kab = matched6.kab;
        if (!kec) kec = matched6.kec;
        if (!kel && matched6.kel) kel = matched6.kel;
      } else {
        if (!prov && nikProvMap[nik2]) prov = nikProvMap[nik2];
        if (!kab && nikKabMap[nik4]) kab = nikKabMap[nik4];
      }
    }

    if (!kel && detail && !isJobOrStatus(detail) && detail.length < 25 && !/\d{2,}/.test(detail) && !/\b(dusun|dsn|rt|rw|jl|jalan|gg|gang|no|blok|lingk|btn|perum)\b/i.test(detail)) {
      kel = detail;
    }

    const fmt = p => (!p ? "" : (p === p.toUpperCase() && p.length > 3 ? cap(p) : p));
    prov = fmt(prov);
    kab = fmt(kab);
    kec = fmt(kec);
    kel = fmt(kel);

    // Tetap kembalikan struktur 4 slot [prov, kab, kec, kel] sesuai data nyata pengguna (tanpa memaksa ke daerah tertentu!)
    const parts = [prov, kab, kec, kel];

    return {
      prov,
      kab,
      kec,
      kel,
      detail: detail || kel || kec || kab || "-",
      parts
    };
  }

  _parseDetailForm(t) {
    const cap = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const statusMap = {
      menikah: "Menikah",
      kawin: "Menikah",
      married: "Menikah",
      "belum menikah": "Belum Menikah",
      "belum kawin": "Belum Menikah",
      belummenikah: "Belum Menikah",
      single: "Belum Menikah",
      lajang: "Belum Menikah",
      "cerai hidup": "Cerai Hidup",
      "cerai mati": "Cerai Mati",
      duda: "Cerai Mati",
      janda: "Cerai Mati"
    };

    // Deteksi usia & siklus hidup
    const lahirInfo = this._parseLahir(t);
    let ageYears = 25;
    if (lahirInfo?.tahun) {
      const by = parseInt(lahirInfo.tahun, 10);
      const cy = new Date().getFullYear();
      if (!isNaN(by)) ageYears = cy - by;
    }

    const isBayi = ageYears < 7 || this._isBalita(t);
    const isSekolahUsia = (this.category === "SEKOLAH" || t.category === "SEKOLAH" || !!t.sekolah || !!t.namasekolah || !!t.kelas || (ageYears >= 5 && ageYears <= 17));

    const rawStatus = String(
      t.statusPernikahan ??
      t.status_pernikahan ??
      t.statuspernikahan ??
      t.statusperkawinan ??
      t.status_perkawinan ??
      t.statusKawin ??
      t.status_kawin ??
      t.statuskawin ??
      t.statusnikah ??
      t.pernikahan ??
      t.perkawinan ??
      t.nikah ??
      ""
    ).trim().toLowerCase();

    let statusPernikahan = "Menikah";
    if (isBayi || isSekolahUsia) {
      statusPernikahan = "Belum Menikah";
    } else if (rawStatus) {
      statusPernikahan = statusMap[rawStatus] || (rawStatus.includes("belum") ? "Belum Menikah" : (rawStatus.includes("cerai") ? "Cerai Hidup" : "Menikah"));
    } else {
      statusPernikahan = "Menikah";
    }

    const rawDis = String(t.disabilitas ?? t.disability ?? "").trim().toLowerCase();
    let disabilitas = "Tidak memiliki disabilitas";
    if (rawDis && !["tidak", "no", "false", "0"].includes(rawDis)) {
      disabilitas = cap(rawDis);
    }

    const rawPekerjaan = String(
      t.pekerjaan ??
      t.job ??
      t.profesi ??
      t.work ??
      t.jenisPekerjaan ??
      t.jenis_pekerjaan ??
      t.jenispekerjaan ??
      t.pekerjaanProfesi ??
      t.pekerjaan_profesi ??
      t.pekerjaanprofesi ??
      t["PEKERJAAN"] ??
      t["Pekerjaan"] ??
      t["JENIS PEKERJAAN"] ??
      t["Jenis Pekerjaan"] ??
      t["Pekerjaan / Profesi"] ??
      t["PEKERJAAN / PROFESI"] ??
      t["Profesi"] ??
      t["PROFESI"] ??
      t["Mata Pencaharian"] ??
      t["MATA PENCAHARIAN"] ??
      ""
    ).trim();

    let pekerjaan = "";
    const isInsurance = /^(pbi\b|non[\s-]*pbi|bpjs|kis\b|jamkesmas|jamsostek|asuransi\b|pasien\s*umum\b|^umum$|^mandiri$|apbn\b|apbd\b)/i.test(rawPekerjaan) ||
      /\bpbi\b/i.test(rawPekerjaan);

    // Hardlock HANYA digunakan ketika kolom pekerjaan di Excel benar-benar kosong!
    const isExcelJobEmpty = !rawPekerjaan ||
      rawPekerjaan === "-" ||
      rawPekerjaan === "0" ||
      isInsurance;

    const hl = this._hardlockPekerjaan || {};
    const isWanitaDewasa = /perempuan|wanita|p/i.test(t.gender || t.jenisKelamin || t.jenis_kelamin || "") && ageYears >= 18;

    if (!isExcelJobEmpty) {
      if (/ibu rumah|irt|mengurus rumah/i.test(rawPekerjaan)) {
        pekerjaan = "Ibu Rumah Tangga";
      } else if (isBelumBekerjaText(rawPekerjaan)) {
        pekerjaan = "Belum/Tidak Bekerja";
      } else {
        pekerjaan = rawPekerjaan;
      }
    } else if (isBayi) {
      pekerjaan = "Belum/Tidak Bekerja";
    } else if (isSekolahUsia) {
      pekerjaan = "Pelajar/Mahasiswa";
    } else {
      if (hl.autoSmart && isWanitaDewasa) {
        pekerjaan = hl.perempuanPekerjaan || "Ibu Rumah Tangga";
      } else if (hl.defaultPekerjaan) {
        pekerjaan = hl.defaultPekerjaan;
      } else {
        pekerjaan = isWanitaDewasa ? "Ibu Rumah Tangga" : "Belum/Tidak Bekerja";
      }
    }

    const addr = this._resolveAlamatParts(t);

    return {
      status: statusPernikahan || "Menikah",
      statusPernikahan: statusPernikahan || "Menikah",
      disabilitas,
      pekerjaan,
      job: pekerjaan,
      sekolah: t.sekolah || t.namasekolah || t.namaSekolah || null,
      kelas: t.kelas || t.tingkat || t.jenjang || null,
      prov: addr.prov,
      kab: addr.kab,
      kec: addr.kec,
      kel: addr.kel,
      alamat: addr.parts,
      detail: addr.detail,
      detailAlamat: addr.detail
    };
  }

  _parseDetailFormSekolah(t) {
    const addr = this._resolveAlamatParts(t);

    let sekolah = String(
      t.sekolah ??
      t.namasekolah ??
      t.namaSekolah ??
      t.namasekolahasal ??
      t.asalsekolah ??
      t.sekolahasal ??
      t.namamadrasah ??
      t.madrasah ??
      t.unitsekolah ??
      t["SEKOLAH"] ??
      t["Sekolah"] ??
      t["NAMA SEKOLAH"] ??
      t["Nama Sekolah"] ??
      t["Asal Sekolah"] ??
      ""
    ).trim();

    let kelas = String(
      t.kelas ??
      t.tingkat ??
      t.jenjang ??
      t.tingkatkelas ??
      t.jenjangkelas ??
      t.kelasrombel ??
      t.kelassiswa ??
      t.jenjangpendidikan ??
      t.rombel ??
      t.kelasraw ??
      t.tingkatpendidikan ??
      t["KELAS"] ??
      t["Kelas"] ??
      t["JENJANG"] ??
      t["Jenjang"] ??
      t["TINGKAT"] ??
      t["Tingkat"] ??
      t["ROMBEL"] ??
      t["Rombel"] ??
      ""
    ).trim();

    if (!sekolah || !kelas) {
      for (const [k, v] of Object.entries(t)) {
        if (!v) continue;
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!sekolah && (cleanK.includes("sekolah") || cleanK.includes("madrasah") || cleanK.includes("satuanpendidikan"))) {
          sekolah = String(v).trim();
        }
        if (!kelas && (cleanK.includes("kelas") || cleanK.includes("jenjang") || cleanK.includes("tingkat") || cleanK.includes("rombel"))) {
          kelas = String(v).trim();
        }
      }
    }

    return {
      status: "Belum Menikah",
      statusPernikahan: "Belum Menikah",
      disabilitas: "Tidak memiliki disabilitas",
      pekerjaan: "Pelajar/Mahasiswa",
      job: "Pelajar/Mahasiswa",
      sekolah: sekolah || null,
      kelas: kelas || null,
      prov: addr.prov,
      kab: addr.kab,
      kec: addr.kec,
      kel: addr.kel,
      alamat: addr.parts,
      detail: addr.detail,
      detailAlamat: addr.detail
    };
  }

  async run() {
    const { tabId, patient, category } = this;
    await chrome.storage.session.remove(`pendaftaranStop_${this._patientIndex}`);

    const isBalita = this._isBalita(patient);
    let isSekolah = "SEKOLAH" === category || "SEKOLAH" === patient?.category || Boolean(patient?.sekolah || patient?.namasekolah || patient?.namaSekolah);

    const urlMap = {
      UMUM: "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu",
      BALITA: "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu",
      SEKOLAH: "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-anak-sekolah"
    };
    const targetUrl = isSekolah ? urlMap.SEKOLAH : (urlMap[category] ?? urlMap.UMUM);
    const pathSlug = targetUrl.split("/").pop();

    let debuggerCmd = null;
    let debuggerAttached = false;

    try {
      const curTab = await chrome.tabs.get(tabId).catch(() => null);
      const curTabUrl = curTab?.url || "";
      if (curTabUrl.includes("ckg-pendaftaran-anak-sekolah")) isSekolah = true;

      // Muat konfigurasi Hardlock Data Wali & Hardlock Pekerjaan dari chrome.storage.local (diatur user di Tab Pendaftaran)
      const storedSettings = await chrome.storage.local.get(["ckg_hardlock_wali", "ckg_hardlock_pekerjaan", "ckg_config"]).catch(() => ({}));
      const rawHardlock = storedSettings?.ckg_hardlock_wali || {};
      const rawCfg = storedSettings?.ckg_config || {};
      const rawHlPekerjaan = storedSettings?.ckg_hardlock_pekerjaan || {};
      this._hardlockPekerjaan = {
        defaultPekerjaan: rawHlPekerjaan.defaultPekerjaan || "Belum/Tidak Bekerja",
        perempuanPekerjaan: rawHlPekerjaan.perempuanPekerjaan || "Ibu Rumah Tangga",
        autoSmart: rawHlPekerjaan.autoSmart !== false
      };
      const cleanHlNik = String(rawHardlock.nikWali || rawHardlock.nik || rawCfg.defaultNikWali || "").replace(/\D/g, "");
      const hardlockWali = {
        nikWali: cleanHlNik.length === 16 ? cleanHlNik : "",
        namaWali: String(rawHardlock.namaWali || rawHardlock.nama || rawCfg.defaultNamaWali || "").trim(),
        tanggalLahirWali: String(rawHardlock.tanggalLahirWali || rawHardlock.tglLahirWali || rawHardlock.tanggalLahir || rawCfg.defaultTanggalLahirWali || "").trim(),
        jenisKelaminWali: String(rawHardlock.jenisKelaminWali || rawHardlock.jkWali || rawHardlock.jenisKelamin || rawCfg.defaultJenisKelaminWali || "").trim(),
        noHpWali: String(rawHardlock.noHpWali || rawHardlock.noHp || rawCfg.defaultNoHpWali || "").trim()
      };

      // FAST-FAIL 1: Penanganan data wali untuk Balita / Anak / Peserta yang butuh wali
      // (Prioritaskan data Excel jika ada; jika kosong di Excel, gunakan Hardlock Wali pengguna)
      const patientNeedsWaliMandatory = this._isBalita(patient) || !patient.nik || String(patient.nik).replace(/\D/g, "").length !== 16;
      if (!isSekolah && patientNeedsWaliMandatory && (!this._hasWaliData(patient) || !patient.nikWali) && (hardlockWali.nikWali || hardlockWali.namaWali)) {
        if (hardlockWali.nikWali) patient.nikWali = hardlockWali.nikWali;
        if (hardlockWali.namaWali) patient.namaWali = hardlockWali.namaWali;
        if (hardlockWali.tanggalLahirWali) patient.tanggalLahirWali = hardlockWali.tanggalLahirWali;
        if (hardlockWali.jenisKelaminWali) patient.jenisKelaminWali = hardlockWali.jenisKelaminWali;
        if (hardlockWali.noHpWali) patient.noHpWali = hardlockWali.noHpWali;
      }

      // FAST-FAIL 2: CKG Sekolah wajib memiliki Nama Sekolah dan Jenjang/Kelas
      if (isSekolah) {
        const schName = String(patient?.sekolah ?? patient?.namasekolah ?? patient?.namaSekolah ?? "").trim();
        const schClass = String(patient?.kelas ?? patient?.jenjang ?? patient?.jenjang_sekolah ?? patient?.tingkat ?? "").trim();
        if (!schName || !schClass) {
          const missingMsg = !schName && !schClass ? "Nama sekolah dan jenjang/kelas kosong" : (!schName ? "Nama sekolah kosong" : "Jenjang/kelas kosong");
          this._outcome = {
            status: "invalid-data",
            ticketNumber: null,
            errorMsg: `Data CKG Sekolah tidak valid: ${missingMsg} di Excel sumber`
          };
          return;
        }
      }

      // Helper pasang Chrome Debugger
      const attachDebugger = () => new Promise((resolve, reject) => {
        chrome.debugger.attach({ tabId }, "1.3", () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });

      const initDebugger = async () => {
        if (debuggerAttached) return;
        try {
          await attachDebugger();
          debuggerAttached = true;
        } catch (err) {
          if (!/already attached/i.test(err.message)) throw err;
          await chrome.debugger.detach({ tabId }).catch(() => {});
          await sleep(200);
          try {
            await attachDebugger();
            debuggerAttached = true;
          } catch (e2) {
            if (/already attached/i.test(e2.message)) {
              throw new Error("Tab masih dipakai debugger lain. Tutup DevTools pada tab CKG, lalu jalankan ulang.");
            }
            throw e2;
          }
        }

        debuggerCmd = (method, params = {}) => new Promise((resolve, reject) => {
          chrome.debugger.sendCommand({ tabId }, method, params, result => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(result);
          });
        });
      };

      // 0. Deteksi apakah tab saat ini SUDAH berada di Step 2 ("Isi data pendukung")
      const isAlreadyOnStep2 = await exec(tabId, () => {
        const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const bodyTxt = norm(document.body?.innerText || "");
        return bodyTxt.includes("isi data pendukung") ||
               bodyTxt.includes("data pendukung") ||
               !!document.querySelector("#detail-domisili") ||
               (bodyTxt.includes("nama sekolah") && bodyTxt.includes("jenjang"));
      }).catch(() => false);

      if (!isAlreadyOnStep2) {
        // Bersihkan popup modal yang mungkin tertinggal dari peserta sebelumnya (misal "Data peserta tidak valid" / "Periksa Kembali" / "Individu sudah menerima layanan")
        await exec(tabId, () => {
          const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const modals = Array.from(document.querySelectorAll('.modal-content, [role="dialog"], [role="alertdialog"], .swal2-container, .swal2-popup, .modal, div.fixed.inset-0, div.fixed, div.z-50')).filter(m => {
            const r = m.getBoundingClientRect();
            return r.width > 0 && r.height > 50 && window.getComputedStyle(m).display !== "none";
          });
          for (const m of modals) {
            const btn = Array.from(m.querySelectorAll("button, [role='button'], a, div")).find(b => {
              const t = norm(b.textContent || b.innerText);
              return t === "periksa kembali" || t.includes("periksa kembali") || t === "cari individu" || t === "kembali" || t === "tutup" || t === "ok" || t === "batal" || t === "✕" || t === "x";
            });
            if (btn) try { btn.click(); } catch(e) {}
          }
        }).catch(() => {});

        // Jika modal form pendaftaran peserta sebelumnya masih terbuka (#nik masih tampil), tutup modal form tersebut agar bersih
        const hadOpenFormModal = await exec(tabId, () => {
          const nikEl = document.getElementById("nik") || document.querySelector("input[placeholder*='nik' i]:not(#searchNik)");
          if (!nikEl || nikEl.getBoundingClientRect().height === 0) return false;
          const modal = nikEl.closest('.modal-content, [role="dialog"], .modal, div.fixed') || document;
          const closeBtn = Array.from(modal.querySelectorAll("button, [role='button'], div.cursor-pointer")).find(b => {
            const t = (b.textContent || b.innerText || b.getAttribute("aria-label") || "").trim().toLowerCase();
            if (t === "batal" || t === "tutup" || t === "✕" || t === "x" || t.includes("close")) return true;
            const svg = b.querySelector("svg");
            if (svg && !t) {
              const r = b.getBoundingClientRect();
              return r.width > 0 && r.width <= 48 && r.top < 180;
            }
            return false;
          });
          if (closeBtn) {
            try { closeBtn.click(); } catch (e) {}
          }
          return true;
        }).catch(() => false);
        if (hadOpenFormModal) await sleep(250);

        // Cek apakah tab saat ini SUDAH berada di halaman pendaftaran yang siap (ada tombol 'Daftar Baru' dan tidak ada modal kotor yang tersangkut)
        const isPageAlreadyReady = curTabUrl.includes(pathSlug) && await exec(tabId, () => {
          const hasBtnDaftar = Array.from(document.querySelectorAll("button, a, div[role='button']")).some(b => {
            const t = (b.innerText || b.textContent || "").trim().toLowerCase();
            return t === "daftar baru" || t.includes("daftar baru") || t === "tambah peserta";
          });
          const nikEl = document.getElementById("nik") || document.querySelector("input[placeholder*='Masukkan NIK' i]");
          const hasDirtyNik = !!(nikEl && nikEl.getBoundingClientRect().height > 0 && nikEl.value);
          return hasBtnDaftar && !hasDirtyNik;
        }).catch(() => false);

        if (!isPageAlreadyReady) {
          if (curTab?.url?.includes(pathSlug)) {
            await chrome.tabs.reload(tabId);
          } else {
            await chrome.tabs.update(tabId, { url: targetUrl });
          }
          await sleep(300);

          // 1. Tunggu navigasi halaman siap
          const navDeadline = Date.now() + this._timeoutNav;
          let navReady = false;
          while (Date.now() < navDeadline) {
            if (await this._isStopped()) return;
            try {
              const tab = await chrome.tabs.get(tabId);
              if (tab.url?.includes(pathSlug) && tab.status === "complete") {
                navReady = true;
                break;
              }
            } catch (e) {}
            await sleep(250);
          }
          if (!navReady) throw new Error("Navigation timeout");
          await sleep(300);

          // Tunggu DOM halaman pendaftaran siap (tombol 'Daftar Baru' / input pencarian NIK muncul)
          const domReadyDeadline = Date.now() + 10000;
          while (Date.now() < domReadyDeadline) {
            if (await this._isStopped()) return;
            const isDomReady = await exec(tabId, () => {
              const hasBtnDaftar = Array.from(document.querySelectorAll("button, a, div[role='button']")).some(b => {
                const t = (b.innerText || b.textContent || "").trim().toLowerCase();
                return t === "daftar baru" || t.includes("daftar baru") || t === "tambah peserta";
              });
              const hasSearchNik = !!document.querySelector("input#searchNik, input[placeholder*='nik' i]");
              return hasBtnDaftar || hasSearchNik;
            }).catch(() => false);
            if (isDomReady) break;
            await sleep(250);
          }
          if (await this._isStopped()) return;
        }

        // 2. Pasang Chrome Debugger
        await initDebugger();

      // 3. Buka Modal "Daftar Baru" (deteksi modal sudah terbuka terlebih dahulu)
      const modalDeadline = Date.now() + this._timeoutNav;
      let modalReady = false;
      while (Date.now() < modalDeadline) {
        if (await this._isStopped()) return;
        const opened = await exec(tabId, () => {
          const hasInput = !!document.getElementById("nik") || !!document.querySelector('input[placeholder*="NIK"]');
          if (hasInput) return true; // Modal sudah terbuka!
          const btn = Array.from(document.querySelectorAll("button, a, div[role='button']")).find(b => {
            const t = (b.textContent || b.innerText || "").trim();
            return t === "Daftar Baru" || t.includes("Daftar Baru");
          });
          if (!btn) return false;
          btn.click();
          return false;
        });
        if (opened) {
          modalReady = true;
          break;
        }
        await sleep(350);
      }
      if (!modalReady) throw new Error("Timeout: Modal pendaftaran belum muncul.");
      if (await this._isStopped()) return;

      await exec(tabId, installGenderHelper).catch(() => {});

      // 4. Injeksi & Cek NIK via API Interceptor (dengan dekripsi HPKE 4.1.1_0)
      const patientNik = String(patient.nik ?? patient.NIK ?? "").trim();
      let foundInDukcapil = false;
      if (patientNik) {
        await exec(tabId, installNikInterceptor);
        await exec(tabId, clearNikCheckResult);
        await exec(tabId, inputNik, [patientNik]);
        await sleep(250);
        await exec(tabId, clickCekNik);

        let checkRes = null;
        const apiDeadline = Date.now() + this._timeoutApi;
        while (Date.now() < apiDeadline) {
          if (await this._isStopped()) return;
          checkRes = await exec(tabId, getNikCheckResult);
          if (checkRes) break;

          // Deteksi dini popup 'Individu sudah menerima layanan' saat Cek NIK
          const earlyScreened = await exec(tabId, () => {
            const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const bodyText = norm(document.body ? document.body.innerText : "");
            if (bodyText.includes("sudah menerima layanan") || bodyText.includes("selesai diperiksa") || bodyText.includes("telah selesai diperiksa") || bodyText.includes("melihat rapor di ssm")) {
              const btns = Array.from(document.querySelectorAll("button, [role='button'], a, div"));
              const closeBtn = btns.find(b => {
                const t = norm(b.textContent || b.innerText);
                return t === "cari individu" || t === "kembali" || t === "tutup" || t === "ok" || t === "✕" || t === "x";
              });
              if (closeBtn) try { closeBtn.click(); } catch(e) {}
              return true;
            }
            return false;
          }).catch(() => false);

          if (earlyScreened) {
            await this._sleep(350);
            await chrome.tabs.reload(tabId).catch(() => {});
            this._outcome = { status: "already-screened", ticketNumber: null, errorMsg: "Peserta sudah menerima layanan di CKG" };
            return;
          }

          const domModal = await exec(tabId, checkGunakanDataOrManualModal).catch(() => null);
          if (domModal) {
            checkRes = { status: domModal.found ? 200 : 404, found: domModal.found, fromModal: true };
            break;
          }
          await sleep(200);
        }

        checkRes = await decryptResult(checkRes);
        let found = checkRes?.found ?? 200 === checkRes?.bodyStatusCode;
        if (!checkRes) {
          const modalCheck = await exec(tabId, checkGunakanDataOrManualModal).catch(() => null);
          if (modalCheck?.found) found = true;
        }
        foundInDukcapil = !!found;

        if (!found) {
          let dismissed = false;
          for (let i = 0; i < 8 && !dismissed; i++) {
            if (await this._isStopped()) return;
            dismissed = await exec(tabId, dismissErrorModal);
            if (!dismissed) await this._sleep(150);
          }
          await this._sleep(200);
          // Pastikan NIK tetap terisi jika sempat ter-reset saat modal ditutup
          await exec(tabId, inputNik, [patientNik]);
          await this._sleep(150);
        } else {
          await this._sleep(150);
          if (await this._isStopped()) return;
          let clicked = false;
          for (let i = 0; i < 8 && !clicked; i++) {
            if (await this._isStopped()) return;
            clicked = await exec(tabId, clickGunakanData);
            if (!clicked) await this._sleep(150);
          }
          await this._sleep(350);

          // Tunggu hingga data dari Dukcapil benar-benar terisi di form
          const settleDeadline = Date.now() + 2500;
          while (Date.now() < settleDeadline) {
            if (await this._isStopped()) return;
            const settled = await exec(tabId, () => {
              const nameInp = document.querySelector('input[name="Nama"], input[placeholder*="Nama" i], input[placeholder*="nama lengkap" i]');
              const dateWrapper = document.querySelector(".mx-datepicker:not([id*='Pemeriksaan']), .mx-input-wrapper:not([id*='Pemeriksaan'])");
              const hasClear = !!dateWrapper?.querySelector(".mx-icon-clear, [class*='clear']");
              const dVal = (dateWrapper?.querySelector("input")?.value || "").trim();
              return !!(nameInp?.value?.trim() || hasClear || (dVal && !/^pilih/i.test(dVal)));
            }).catch(() => false);
            if (settled) break;
            await this._sleep(180);
          }
          await this._sleep(150);
        }
      }

      if (await this._isStopped()) return;

      // Injeksi Cepat Nama & No WhatsApp sekaligus (persis CKG PC Update v2.1)
      let pName = String(patient.nama ?? patient.Nama ?? patient.NAMA ?? "").trim();
      pName = pName.replace(/[^a-zA-Z\s'.-]/g, " ").replace(/\s+/g, " ").trim();
      const rawPhone = String(
        patient.noWhatsapp ?? patient.no_whatsapp ?? patient.nowhatsapp ?? patient.wa ?? patient.nowa ??
        patient.nohp ?? patient.hp ?? patient.telp ?? patient.notelp ?? patient.telepon ??
        patient["NO WHATSAPP"] ?? patient["No Whatsapp"] ?? patient["Nomor Whatsapp"] ?? ""
      ).trim();

      let cleanPhone = rawPhone.replace(/\D/g, "");
      if (cleanPhone.startsWith("62")) cleanPhone = cleanPhone.substring(2);
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
      if (!cleanPhone || cleanPhone.length < 8 || /^0+$/.test(cleanPhone)) {
        cleanPhone = "81999578341"; // Kontak resmi default Puskesmas Sesela
      }

      await exec(tabId, (nameVal, phoneVal, preserveExisting) => {
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const getWaliSection = () => {
          const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
          if (nikWali) {
            const sec = nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3, div.flex-col');
            if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
            return nikWali.parentElement?.parentElement?.parentElement || null;
          }
          const allHeadings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, p, span"));
          const h = allHeadings.find(el => el.children.length <= 2 && clean(el.textContent) === "isi data wali");
          if (h) {
            const sec = h.closest('.form-data-individu') || h.parentElement;
            if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
          }
          return null;
        };

        const waliSection = getWaliSection();
        const inWali = el => {
          if (!waliSection || !el) return false;
          return waliSection === el || waliSection.contains(el);
        };

        if (nameVal) {
          const nameInputs = Array.from(document.querySelectorAll('input[name="Nama"], input[placeholder*="Nama" i], input[placeholder*="nama lengkap" i]')).filter(inp => !inWali(inp));
          for (const input of nameInputs) {
            if (input && (!preserveExisting || !input.value || !input.value.trim())) {
              const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
              if (s) s.call(input, nameVal); else input.value = nameVal;
              input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: nameVal }));
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            }
          }
        }

        if (phoneVal) {
          const isWaliEl = el => {
            if (!el) return false;
            if (inWali(el)) return true;
            const name = (el.name || "").toLowerCase();
            const id = (el.id || "").toLowerCase();
            const ph = (el.placeholder || "").toLowerCase();
            const parent = el.closest("[class*='wali' i], fieldset, div.border");
            const parentTxt = parent ? (parent.textContent || "").toLowerCase() : "";
            return name.includes("wali") || id.includes("wali") || ph.includes("wali") || (parentTxt.includes("data wali") && parentTxt.includes("wali"));
          };

          const phoneInputs = Array.from(document.querySelectorAll('input[name="Nomor Whatsapp"], #No\\ Whatsapp, input[placeholder*="Whatsapp" i], input[placeholder*="8123" i], input[placeholder*="+62" i], input[type="tel"]')).filter(inp => !inWali(inp) && !isWaliEl(inp));

          if (phoneInputs.length === 0) {
            const lbl = Array.from(document.querySelectorAll("label, div, p, span")).find(l => /whatsapp aktif|no\.\s*whatsapp/i.test(l.textContent) && !/wali/i.test(l.textContent));
            if (lbl) {
              const nearInp = lbl.closest("div")?.querySelector("input") || lbl.parentElement?.querySelector("input") || lbl.nextElementSibling?.querySelector("input");
              if (nearInp && !inWali(nearInp) && !isWaliEl(nearInp)) phoneInputs.push(nearInp);
            }
          }

          for (const input of phoneInputs) {
            if (input && (!preserveExisting || !input.value || input.value.trim().length < 8)) {
              const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
              if (s) s.call(input, phoneVal); else input.value = phoneVal;
              input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: phoneVal }));
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
              input.dispatchEvent(new Event("blur", { bubbles: true }));
              break;
            }
          }
        }
      }, [pName, cleanPhone, foundInDukcapil]);

      // Verifikasi dan fallback CDP jika No WhatsApp peserta masih kosong di layar
      if (await this._isStopped()) return;

      // Pastikan Tanggal Lahir Peserta terisi (HANYA jika belum terisi oleh Cek NIK / Dukcapil)
      const isPesertaTglFilled = foundInDukcapil && await exec(tabId, () => {
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const getWaliSection = () => {
          const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
          if (nikWali) {
            const sec = nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3, div.flex-col');
            if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
            return nikWali.parentElement?.parentElement?.parentElement || null;
          }
          const allHeadings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, p, span"));
          const h = allHeadings.find(el => el.children.length <= 2 && clean(el.textContent) === "isi data wali");
          if (h) {
            const sec = h.closest('.form-data-individu') || h.parentElement;
            if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
          }
          return null;
        };

        const waliSec = getWaliSection();
        const allWrappers = Array.from(document.querySelectorAll(".mx-input-wrapper, .mx-datepicker")).filter(w => !w.closest("#Tanggal\\ Pemeriksaan"));
        const wrapper = allWrappers.find(w => !waliSec || !waliSec.contains(w));
        if (!wrapper) return false;

        if (wrapper.querySelector(".mx-icon-clear, [class*='clear'], i.mx-clear-wrapper")) return true;
        const inp = wrapper.querySelector("input");
        const val = (inp?.value || "").trim();
        if (val && !/^pilih/i.test(val) && /\d/.test(val)) return true;
        const txt = (wrapper.textContent || "").trim();
        if (txt && !/^pilih/i.test(txt) && /\d{4}/.test(txt)) return true;
        return false;
      }).catch(() => false);

      if (!isPesertaTglFilled) {
        const pBirth = this._parseLahir(patient);
        if (pBirth) {
          await exec(tabId, selectDateInPicker, [pBirth, false]);
          await this._sleep(450); // Santai!
        }
      }

      if (await this._isStopped()) return;

      // Pastikan Jenis Kelamin Peserta terisi TEPAT SETELAH Tanggal Lahir Peserta
      // (Sebelum scroll ke Kalender Kuota atau seksi Wali agar posisi combobox masih di viewport)
      const pGender = this._parseJenisKelamin(patient) || "Laki-laki";
      await this._setGenderWithFallback(debuggerCmd, pGender, false);
      await this._sleep(400); // Santai!

      if (await this._isStopped()) return;

      // Di CKG: Wali wajib bagi Balita (< 7 tahun) dan peserta yang tidak memiliki NIK,
      // serta dapat diisi bagi peserta Umum/Lansia jika datanya disediakan di Excel / antrean.
      const isBalitaTarget = this._isBalita(patient);
      const cleanPatientNik = String(patient.nik ?? patient.NIK ?? "").replace(/\D/g, "");
      const hasNik = cleanPatientNik.length === 16;
      const isSekolahPendaftaran = this.category === "SEKOLAH" || patient?.category === "SEKOLAH" || patient?.category === "SEKOLAH_SD" || patient?.category === "REMAJA" || Boolean(patient?.sekolah || patient?.namasekolah || patient?.namaSekolah);
      
      const hasPatientWali = this._hasWaliData(patient);
      let needsWali = !isSekolahPendaftaran && (isBalitaTarget || !hasNik || hasPatientWali);

      // 5. Pilih Tanggal Kuota di Kalender
      await this._sleep(350);
      await exec(tabId, pickQuotaDate);
      await this._sleep(350);
      // Tutup popup kalender agar tidak menghalangi dropdown jenis kelamin atau form wali
      await exec(tabId, () => {
        try {
          document.body.click();
          if (typeof document.activeElement?.blur === "function") document.activeElement.blur();
        } catch(e) {}
      });
      await this._sleep(300);
      if (await this._isStopped()) return;

      // Centang 'Daftarkan tanpa wali' jika pasien dewasa/lansia tanpa wali.
      // Jika butuh wali (Balita / ada data wali di Excel), pastikan centang tanpa wali TIDAK aktif!
      if (!needsWali) {
        await this._ensureCheckTanpaWali(debuggerCmd);
        await this._sleep(300);
      } else {
        await this._ensureUncheckTanpaWali(debuggerCmd);
        await this._sleep(250);
      }

      // 6. Penanganan Wali vs Tanpa Wali
      if (needsWali) {
        // Polling hingga elemen/checkbox wali muncul
        let hasWaliOnPage = false;
        const waliCheckDeadline = Date.now() + 2500;
        while (Date.now() < waliCheckDeadline) {
          if (await this._isStopped()) return;
          hasWaliOnPage = await exec(tabId, () => {
            const cb = document.getElementById("noWali") || document.querySelector('input#noWali');
            if (cb) return true;
            const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
            if (nikWali && nikWali.getBoundingClientRect().height > 0) return true;
            const bodyTxt = (document.body?.innerText || "").toLowerCase();
            return (bodyTxt.includes("isi data wali") || bodyTxt.includes("data wali")) && (bodyTxt.includes("nik wali") || !!cb);
          });
          if (hasWaliOnPage) break;
          await this._sleep(200);
        }

        if (hasWaliOnPage) {
          // Pastikan checkbox #noWali tidak tercentang jika tidak sengaja aktif
          await this._ensureUncheckTanpaWali(debuggerCmd);
          await this._sleep(250);

          // Cek apakah data wali SUDAH terisi dari sistem CKG (misal setelah klik Gunakan Data)
          const isWaliAlreadyInForm = await exec(tabId, () => {
            const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const getWaliSection = () => {
              const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
              if (nikWali) {
                const sec = nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3, div.flex-col');
                if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
                return nikWali.parentElement?.parentElement?.parentElement || null;
              }
              const allHeadings = Array.from(document.querySelectorAll("div, h1, h2, h3, h4, p, span"));
              const h = allHeadings.find(el => el.children.length <= 2 && clean(el.textContent) === "isi data wali");
              if (h) {
                const sec = h.closest('.form-data-individu') || h.parentElement;
                if (sec && !sec.querySelector('input#nik, input[name="NIK"]')) return sec;
              }
              return null;
            };

            const waliSec = getWaliSection();
            if (!waliSec) return false;

            const nikWali = waliSec.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
            const namaWali = waliSec.querySelector('input[name="Nama Lengkap Wali"], input[placeholder*="Nama Lengkap" i], input[placeholder*="nama" i]');
            const tglWrapper = waliSec.querySelector('.mx-datepicker, .mx-input-wrapper');

            const curNik = (nikWali?.value || "").replace(/\D/g, "");
            const curNama = (namaWali?.value || "").trim();
            const curTgl = (tglWrapper?.querySelector("input")?.value || tglWrapper?.textContent || "").trim();

            const hasValidNik = curNik.length === 16;
            const hasValidNama = curNama.length >= 2;
            const hasValidTgl = curTgl.length >= 4 && !/^pilih/i.test(curTgl);

            return hasValidNik || (hasValidNama && hasValidTgl);
          }).catch(() => false);

          if (isWaliAlreadyInForm) {
            // Data wali sudah ada dari sistem CKG (Gunakan Data), JANGAN DIUBAH! Biarkan data wali apa adanya!
            await this._sleep(200);
          } else {
            // Hanya isi wali jika di form CKG memang belum ada data wali
            const rawNikWali = String(patient.nikwali ?? patient.nik_wali ?? patient.nikWali ?? patient["NIK Wali"] ?? "").trim().replace(/\D/g, "");
            const fallbackNik = hardlockWali?.nikWali || "";
            const nikWali = rawNikWali.length === 16 ? rawNikWali : fallbackNik;
            let namaWali = String(patient.namalengkapwali ?? patient.namawali ?? patient.nama_wali ?? patient.namaWali ?? patient["Nama Lengkap Wali"] ?? "").trim();
            if (!namaWali || !/[a-zA-Z]{2,}/.test(namaWali)) {
              const rawIbu = String(patient.namaibu ?? patient.nama_ibu ?? patient.namaIbu ?? "").trim();
              namaWali = (rawIbu && /[a-zA-Z]{2,}/.test(rawIbu)) ? rawIbu : (hardlockWali?.namaWali || (patient.nama ? `Wali ${patient.nama}` : "Wali Peserta"));
            }

            const tglWali = this._parseLahirWali(patient) || 
                            (hardlockWali?.tanggalLahirWali ? this._parseLahir({ tgllahir: hardlockWali.tanggalLahirWali, nik: nikWali }) : null) || 
                            this._parseLahirWali({ nikWali }) ||
                            this._parseLahir({ tgllahir: patient.tgllahirwali || patient.tgl_lahir_wali, nik: nikWali });
            const jkWali = this._parseJenisKelaminWali({ ...patient, nikWali }) || hardlockWali?.jenisKelaminWali || "Perempuan";
            const hpWali = String(patient.nohpwali ?? patient.nowawali ?? patient.nowhatsappwali ?? patient.hpwali ?? patient.noHpWali ?? hardlockWali?.noHpWali ?? patient.wa ?? "").replace(/\D/g, "").replace(/^(62|0)+/, "");

            if ((nikWali && nikWali.length === 16) || (namaWali && namaWali.length >= 2)) {
              await exec(tabId, injectWaliData, [{
                nik: nikWali,
                nama: namaWali,
                lahir: tglWali,
                jenisKelamin: jkWali,
                noWa: hpWali
              }]);
              await this._sleep(500); // Santai!
            }
          }
        }
      } else {
        // === PENANGANAN CEKLIS TANPA WALI (DEWASA, LANSIA, ANAK SEKOLAH >= 7 TAHUN) ===
        await this._ensureCheckTanpaWali(debuggerCmd);
        await this._sleep(350); // Santai!
      }

      // 7. Pemicu Validasi & Berpindah Step (Selanjutnya -> Validasi)
      await this._sleep(250);

      // Pastikan Tanggal Kuota di Kalender sudah terpilih
      const isQuotaSelected = await exec(tabId, () => {
        const grid = [...document.querySelectorAll("div")].find(d =>
          (d.className || "").toString().includes("grid-cols-7") && d.children.length >= 30
        );
        if (!grid) return true;
        return [...grid.children].some(c => {
          const cls = (c.className || "").toString();
          return cls.includes("bg-theme") || cls.includes("border-theme") || cls.includes("bg-primary") || cls.includes("ring");
        });
      }).catch(() => false);
      if (!isQuotaSelected) {
        await exec(tabId, pickQuotaDate);
        await this._sleep(400);
      }

      // Pastikan Jenis Kelamin Peserta tidak masih "Pilih jenis kelamin" sebelum klik Selanjutnya
      const jkPesertaFinal = this._parseJenisKelamin(patient) || "Laki-laki";
      const pesertaStillEmpty = await exec(tabId, () => {
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"]');
        const waliSec = nikWali ? (nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3')) : null;
        const inWali = el => waliSec && waliSec.contains(el);

        const getModalScope = () => {
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, p, div')).filter(h => {
            const t = clean(h.textContent);
            return t === "data peserta" || t.startsWith("data peserta");
          });
          for (const h of headings) {
            const m = h.closest('.modal-content, [role="dialog"], .fixed, form, div.z-50');
            if (m && m.querySelector('input')) return m;
          }
          return document.querySelector('.modal-content, [role="dialog"], form') || document.body;
        };

        const scope = getModalScope();
        const allCombos = Array.from(scope.querySelectorAll('.cursor-pointer, [role="combobox"], [role="button"], button, div.relative > div, div.border, div')).filter(el => {
          if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
          if (el.tagName === "INPUT" || el.querySelector("input") || el.children.length > 3) return false;
          const t = clean(el.textContent);
          return t === "pilih jenis kelamin" || (t.includes("pilih jenis kelamin") && t.length < 35) || t === "laki-laki" || t === "perempuan";
        });
        const trg = allCombos.find(t => !inWali(t));
        if (!trg) return false;
        const txt = clean(trg.textContent);
        return !txt || txt.includes("pilih");
      }).catch(() => false);

      if (pesertaStillEmpty) {
        await this._setGenderWithFallback(debuggerCmd, jkPesertaFinal, false);
        await this._sleep(450); // Santai!
      }

      // Pastikan Jenis Kelamin Wali tidak masih "Pilih jenis kelamin" sebelum klik Selanjutnya jika butuh wali
      if (needsWali) {
        const jkWaliFinal = this._parseJenisKelaminWali(patient) || "Perempuan";
        const waliStillEmpty = await exec(tabId, () => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"]');
          const waliSec = nikWali ? (nikWali.closest('.form-data-individu') || nikWali.closest('fieldset, form, div.mt-3')) : null;
          if (!waliSec) return false;
          const inWali = el => waliSec.contains(el);

          const allCombos = Array.from(waliSec.querySelectorAll('.cursor-pointer, [role="combobox"], [role="button"], button, div.relative > div, div.border, div')).filter(el => {
            if (el.closest(".mx-datepicker, .mx-input-wrapper")) return false;
            if (el.tagName === "INPUT" || el.querySelector("input") || el.children.length > 3) return false;
            const t = clean(el.textContent);
            return t === "pilih jenis kelamin" || (t.includes("pilih jenis kelamin") && t.length < 35) || t === "laki-laki" || t === "perempuan";
          });
          const trg = allCombos.find(t => inWali(t));
          if (!trg) return false;
          const txt = clean(trg.textContent);
          return !txt || txt.includes("pilih");
        }).catch(() => false);

        if (waliStillEmpty) {
          await this._setGenderWithFallback(debuggerCmd, jkWaliFinal, true);
          await this._sleep(450); // Santai!
        }
      }

      // Ceklis pengaman terakhir sebelum klik Selanjutnya
      if (!needsWali) {
        await this._ensureCheckTanpaWali(debuggerCmd);
        await this._sleep(250);
      } else {
        await this._ensureUncheckTanpaWali(debuggerCmd);
        await this._sleep(200);
      }

      // Tunggu hingga tombol "Selanjutnya" aktif dan tidak disabled
      const waitSelanjutnyaDeadline = Date.now() + 3500;
      while (Date.now() < waitSelanjutnyaDeadline) {
        if (await this._isStopped()) return;
        const isEnabled = await exec(tabId, () => {
          const btn = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).find(t => {
            const txt = (t.textContent || t.innerText || "").trim().toLowerCase();
            return txt === "selanjutnya" || txt.startsWith("selanjutnya");
          });
          return !!(btn && !btn.disabled && !btn.classList.contains("disabled") && !btn.classList.contains("cursor-not-allowed") && !btn.classList.contains("opacity-50"));
        });
        if (isEnabled) break;
        await this._sleep(200);
      }

      // FAST-FAIL / AUTO-RECOVER: Jika tombol Selanjutnya masih belum aktif, periksa apakah karena form wali web CKG
      let isSelanjutnyaReady = await exec(tabId, () => {
        const btn = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).find(t => {
          const txt = (t.textContent || t.innerText || "").trim().toLowerCase();
          return txt === "selanjutnya" || txt.startsWith("selanjutnya");
        });
        return !!(btn && !btn.disabled && !btn.classList.contains("disabled") && !btn.classList.contains("cursor-not-allowed") && !btn.classList.contains("opacity-50"));
      });

      if (!isSelanjutnyaReady) {
        // Cek apakah ada kolom data wali yang masih kosong dan menyebabkan validasi web CKG terkunci
        const hasActiveEmptyWali = await exec(tabId, () => {
          const nikWali = document.querySelector('input#nik-wali, input[id="nik wali"], input[name="NIK wali"], input[placeholder*="NIK Wali" i]');
          if (!nikWali) return false;
          const val = (nikWali.value || "").replace(/\D/g, "");
          return val.length < 16;
        }).catch(() => false);

        if (hasActiveEmptyWali && (hardlockWali?.nikWali || hardlockWali?.namaWali || hasPatientWali)) {
          console.log("[Pendaftaran] Tombol Selanjutnya terkunci oleh field Wali. Mengisi data Wali lalu mencentang Daftarkan Tanpa Wali...");
          await this._ensureUncheckTanpaWali(debuggerCmd);
          await this._sleep(200);
          const recNikWali = String(patient.nikWali || patient.nik_wali || hardlockWali?.nikWali || "").replace(/\D/g, "");
          const recNamaWali = String(patient.namaWali || patient.nama_wali || hardlockWali?.namaWali || "Pendamping").trim();
          const recTglWali = this._parseLahirWali(patient) ||
                             (hardlockWali?.tanggalLahirWali ? this._parseLahir({ tgllahir: hardlockWali.tanggalLahirWali, nik: recNikWali }) : null) ||
                             this._parseLahirWali({ nikWali: recNikWali });
          const recJkWali = this._parseJenisKelaminWali({ ...patient, nikWali: recNikWali }) || hardlockWali?.jenisKelaminWali || "Perempuan";
          await exec(tabId, injectWaliData, [{
            nik: recNikWali,
            nama: recNamaWali,
            lahir: recTglWali,
            jenisKelamin: recJkWali,
            noWa: hardlockWali?.noHpWali || patient.noHpWali || patient.wa || ""
          }]);
          await this._sleep(350);

          // Tetap centang 'Daftarkan tanpa data wali' sesuai instruksi user (diisi lalu klik centang daftarkan tanpa wali)
          await this._ensureCheckTanpaWali(debuggerCmd);
          await this._sleep(350);

          // Cek ulang apakah tombol Selanjutnya sekarang sudah aktif
          isSelanjutnyaReady = await exec(tabId, () => {
            const btn = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).find(t => {
              const txt = (t.textContent || t.innerText || "").trim().toLowerCase();
              return txt === "selanjutnya" || txt.startsWith("selanjutnya");
            });
            return !!(btn && !btn.disabled && !btn.classList.contains("disabled") && !btn.classList.contains("cursor-not-allowed") && !btn.classList.contains("opacity-50"));
          }).catch(() => false);
        } else if (!isBalitaTarget && hasNik) {
          // Jika data wali sudah diisi (misal Lansia dengan data wali dari Excel) namun tombol Selanjutnya masih terkunci,
          // klik centang 'Daftarkan tanpa data wali' setelah field terisi!
          await this._ensureCheckTanpaWali(debuggerCmd);
          await this._sleep(350);
          isSelanjutnyaReady = await exec(tabId, () => {
            const btn = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).find(t => {
              const txt = (t.textContent || t.innerText || "").trim().toLowerCase();
              return txt === "selanjutnya" || txt.startsWith("selanjutnya");
            });
            return !!(btn && !btn.disabled && !btn.classList.contains("disabled") && !btn.classList.contains("cursor-not-allowed") && !btn.classList.contains("opacity-50"));
          }).catch(() => false);
        }
      }

      if (!isSelanjutnyaReady) {
        const step1Err = await exec(tabId, () => {
          const el = Array.from(document.querySelectorAll('.text-danger, .text-red-500, div.text-sm.text-red-500, [role="alert"]')).find(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (e.textContent || "").trim().length > 3;
          });
          return el ? el.textContent.trim() : null;
        }).catch(() => null);

        this._outcome = {
          status: "invalid-data",
          ticketNumber: null,
          errorMsg: step1Err ? `Data pendaftaran tidak valid: ${step1Err}` : "Formulir Step 1 belum lengkap atau tombol Selanjutnya tidak aktif (Jika CKG menuntut data wali lansia, isi Hardlock Data Wali di UI)"
        };
        return;
      }

      await exec(tabId, installValidasiInterceptor);
      await exec(tabId, clearValidasiResult);

      let clickedSelanjutnya = false;
      if (debuggerCmd) {
        const clickPos = await (async cmd => {
          const { result } = await cmd("Runtime.evaluate", {
            expression: `(() => {
              const btns = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).filter(b => {
                const r = b.getBoundingClientRect();
                const cls = (b.className || "").toLowerCase();
                return r.width > 0 && r.height > 0 && !b.disabled && !cls.includes("disabled") && !cls.includes("cursor-not-allowed") && !cls.includes("opacity-50");
              });
              const btn = btns.find(b => {
                const t = (b.textContent || b.innerText || "").trim().toLowerCase();
                return t === "selanjutnya" || t.startsWith("selanjutnya");
              });
              if (!btn) return JSON.stringify({ found: false });
              btn.scrollIntoView({ block: "center" });
              const r = btn.getBoundingClientRect();
              return JSON.stringify({ found: true, x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)), y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10)) });
            })()`,
            returnByValue: true
          });
          return JSON.parse(result?.value || '{"found":false}');
        })(debuggerCmd).catch(() => ({ found: false }));

        if (clickPos.found) {
          await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: clickPos.x, y: clickPos.y });
          await sleep(30);
          await debuggerCmd("Input.dispatchMouseEvent", { type: "mousePressed", x: clickPos.x, y: clickPos.y, button: "left", clickCount: 1 });
          await sleep(50);
          await debuggerCmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: clickPos.x, y: clickPos.y, button: "left", clickCount: 1 });
          clickedSelanjutnya = true;
        }
      }
      if (!clickedSelanjutnya) {
        for (let i = 0; i < 6 && !clickedSelanjutnya; i++) {
          if (await this._isStopped()) return;
          clickedSelanjutnya = await exec(tabId, clickSelanjutnya);
          if (!clickedSelanjutnya) await this._sleep(250);
        }
      }

      // Loop transisi dari Step 1 ke Step 2 ("Isi data pendukung") dengan deteksi popup & modal lengkap
      let isPhase2Ready = false;
      const transDeadline = Date.now() + 25000;
      let transAttempt = 0;

      while (Date.now() < transDeadline) {
        if (await this._isStopped()) return;

        // 1. PRIORITAS UTAMA: Cek apakah sudah masuk ke Step 2 ("Isi data pendukung")
        const isStep2 = await exec(tabId, () => {
          const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const modals = Array.from(document.querySelectorAll('.modal-content, [role="dialog"], .modal, div.fixed.inset-0, div.fixed.z-50, form'));
          const visibleModal = modals.reverse().find(m => {
            const r = m.getBoundingClientRect();
            return r.width > 200 && r.height > 200 && window.getComputedStyle(m).display !== "none";
          });
          if (!visibleModal) return false;

          const modalTxt = norm(visibleModal.innerText || visibleModal.textContent || "");

          // Jika modal masih memuat "Data Peserta" dan input NIK, berarti MASIH di Step 1!
          const nikInp = visibleModal.querySelector('input#nik, input[placeholder*="nik" i]:not(#searchNik), input[name="NIK"]');
          if (nikInp && nikInp.getBoundingClientRect().height > 0 && modalTxt.includes("data peserta")) {
            return false;
          }

          // Modal sudah beralih ke Step 2 jika memuat "data pendukung", "detail-domisili", atau form sekolah/pernikahan di dalam modal
          return modalTxt.includes("isi data pendukung") ||
                 modalTxt.includes("data pendukung") ||
                 !!visibleModal.querySelector("#detail-domisili") ||
                 modalTxt.includes("status pernikahan") ||
                 modalTxt.includes("pilih pekerjaan") ||
                 (modalTxt.includes("nama sekolah") && modalTxt.includes("jenjang"));
        });

        if (isStep2) {
          isPhase2Ready = true;
          break;
        }

        // 2. PRIORITAS 2: Cek modal konfirmasi validasi dan klik tombol "Lanjutkan" / "Lanjutkan Pendaftaran"
        // PENTING: Jika tombol "Lanjutkan" muncul, ini artinya validasi berhasil! Klik dan JANGAN anggap error!
        const lanjutHandled = await exec(tabId, () => {
          const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const btns = Array.from(document.querySelectorAll('button, div.bg-primaryColor, div.btn-primary, div[class*="primary"], div[class*="#16B3AC"], [role="button"], a.btn, a'));
          const btnLanjutkan = btns.reverse().find(b => {
            const r = b.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || b.disabled) return false;
            const cls = (b.className || "").toString().toLowerCase();
            if (cls.includes("bg-disabled") || cls.includes("cursor-not-allowed") || cls.includes("opacity-50")) return false;
            const txt = norm(b.innerText || b.textContent);
            return txt === "lanjutkan" || txt.startsWith("lanjutkan") || txt.includes("lanjutkan") || txt.includes("ya, lanjutkan") || txt === "lanjut";
          });

          if (btnLanjutkan) {
            try { btnLanjutkan.scrollIntoView({ block: "center" }); } catch (e) {}
            const r = btnLanjutkan.getBoundingClientRect();
            const x = Math.round(r.x + (r.width > 0 ? r.width / 2 : 10));
            const y = Math.round(r.y + (r.height > 0 ? r.height / 2 : 10));
            const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
            ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(evt => {
              try { btnLanjutkan.dispatchEvent(new MouseEvent(evt, opts)); } catch (e) {}
            });
            if (typeof btnLanjutkan.click === "function") {
              try { btnLanjutkan.click(); } catch (e) {}
            } else {
              try { btnLanjutkan.dispatchEvent(new MouseEvent("click", opts)); } catch (e) {}
            }
            return true;
          }
          return false;
        });

        if (lanjutHandled) {
          await this._sleep(700);
          continue;
        }

        // 3. PRIORITAS 3: Respon API validasi dari interceptor (jika ada data pasti dari server)
        let rawVal = await exec(tabId, getValidasiResult);
        if (rawVal) {
          rawVal = await decryptResult(rawVal);
          const valCode = rawVal?.data?.validation_code;
          const msg = rawVal?.body?.message || rawVal?.data?.message || "";
          if (valCode === "ALREADY_SCREENED" || (/sudah menerima layanan/i.test(msg) && !/lanjutkan/i.test(msg))) {
            await exec(tabId, () => {
              const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
              const b = Array.from(document.querySelectorAll("button, [role='button'], a")).find(el => {
                const t = norm(el.textContent || el.innerText);
                return t === "cari individu" || t === "kembali" || t === "tutup" || t === "ok";
              });
              if (b) {
                try {
                  b.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                  b.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                  b.click();
                } catch(e) {}
              }
            });
            await this._sleep(350);
            await chrome.tabs.reload(tabId).catch(() => {});
            this._outcome = { status: "already-screened", ticketNumber: null, errorMsg: msg || "Peserta sudah menerima layanan di CKG" };
            return;
          }
          if (valCode === "INVALID_DATA" || /nik tidak valid|nik tidak ditemukan|data peserta tidak valid/i.test(msg)) {
            await exec(tabId, () => {
              const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
              const b = Array.from(document.querySelectorAll("button, [role='button'], a")).find(el => {
                const t = norm(el.textContent || el.innerText);
                return t === "periksa kembali" || t.includes("periksa kembali") || t === "kembali" || t === "tutup" || t === "ok" || t === "batal";
              });
              if (b) {
                try {
                  b.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                  b.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                  b.click();
                } catch(e) {}
              }
            });
            await this._sleep(350);
            await chrome.tabs.reload(tabId).catch(() => {});
            this._outcome = { status: "invalid-nik", ticketNumber: null, errorMsg: msg || "Data peserta tidak valid di Dukcapil/CKG" };
            return;
          }
        }

        // 4. PRIORITAS 4: Cek modal dialog error / sudah terdaftar
        const popupCheck = await exec(tabId, () => {
          const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const bodyText = norm(document.body ? document.body.innerText : "");

          const modals = Array.from(document.querySelectorAll('.modal-content, [role="dialog"], [role="alertdialog"], .swal2-container, .swal2-popup, .modal, div.fixed.inset-0, div.fixed, div.z-50')).filter(m => {
            const r = m.getBoundingClientRect();
            return r.width > 0 && r.height > 50 && window.getComputedStyle(m).display !== "none";
          });
          const activeModal = modals.length > 0 ? modals[modals.length - 1] : null;
          const modalText = activeModal ? norm(activeModal.innerText || activeModal.textContent || "") : "";

          // Jika di dalam modal masih ada tombol Lanjutkan, JANGAN anggap error!
          if (activeModal) {
            const hasBtnLanjut = Array.from(activeModal.querySelectorAll("button, [role='button'], a, div")).some(b => {
              const t = norm(b.textContent || b.innerText);
              return t === "lanjutkan" || t.startsWith("lanjutkan") || t.includes("lanjutkan") || t === "lanjut";
            });
            if (hasBtnLanjut) return { handled: false };
          }

          // Cek apakah terdeteksi "Individu sudah menerima layanan" atau "Sudah pernah diskrining"
          const isAlreadyScreened =
            modalText.includes("sudah menerima layanan") ||
            modalText.includes("selesai diperiksa") ||
            modalText.includes("telah selesai diperiksa") ||
            modalText.includes("melihat rapor di ssm") ||
            modalText.includes("sudah pernah diskrining") ||
            bodyText.includes("individu sudah menerima layanan") ||
            bodyText.includes("telah selesai diperiksa dengan detail puskesmas");

          if (isAlreadyScreened) {
            // TUTUP MODAL SECARA CEPAT DENGAN KLIK "Cari Individu" ATAU "Kembali" / "Tutup"
            const searchRoot = activeModal || document;
            const closeBtn = Array.from(searchRoot.querySelectorAll("button, [role='button'], a, div")).find(b => {
              const t = norm(b.textContent || b.innerText);
              return t === "cari individu" || t === "periksa kembali" || t === "kembali" || t === "tutup" || t === "ok" || t === "✕" || t === "x";
            });
            if (closeBtn) {
              try { closeBtn.click(); } catch(e) {}
            }
            return { handled: true, type: "already-screened", message: "Peserta sudah menerima layanan di CKG" };
          }

          // PRIORITAS PERIKSA KEMBALI: Jika modal "Data peserta tidak valid" / tombol "Periksa Kembali" muncul
          const btnPeriksaKembali = Array.from(document.querySelectorAll("button, [role='button'], a, div")).find(b => {
            const t = norm(b.textContent || b.innerText);
            return t === "periksa kembali" || t.includes("periksa kembali");
          });

          // Cek apakah data tidak valid
          const isInvalidNik =
            !!btnPeriksaKembali ||
            modalText.includes("data peserta tidak valid") ||
            modalText.includes("perbaiki data yang dimasukkan") ||
            modalText.includes("nik tidak ditemukan") ||
            modalText.includes("nik tidak valid") ||
            modalText.includes("tidak ditemukan di dukcapil") ||
            bodyText.includes("data peserta tidak valid");

          if (isInvalidNik) {
            const targetBtn = btnPeriksaKembali || Array.from(document.querySelectorAll("button, [role='button'], a, div")).find(b => {
              const t = norm(b.textContent || b.innerText);
              return t === "periksa kembali" || t.includes("periksa kembali") || t === "kembali" || t === "tutup" || t === "ok" || t === "batal" || t === "✕" || t === "x";
            });
            if (targetBtn) {
              ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(evt => {
                try { targetBtn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true })); } catch(e) {}
              });
              if (typeof targetBtn.click === "function") {
                try { targetBtn.click(); } catch(e) {}
              }
            }
            return { handled: true, type: "invalid-nik", message: "Data peserta tidak valid di Dukcapil/CKG" };
          }

          // Cek apakah pendaftaran gagal disimpan
          const isFailed =
            modalText.includes("pendaftaran gagal") ||
            modalText.includes("gagal disimpan") ||
            modalText.includes("silakan coba beberapa saat lagi") ||
            bodyText.includes("pendaftaran gagal: data gagal disimpan");

          if (isFailed) {
            const searchRoot = activeModal || document;
            const closeBtn = Array.from(searchRoot.querySelectorAll("button, [role='button'], a, div")).find(b => {
              const t = norm(b.textContent || b.innerText);
              return t === "kembali" || t === "tutup" || t === "ok" || t === "✕" || t === "x";
            });
            if (closeBtn) {
              try { closeBtn.click(); } catch(e) {}
            }
            return { handled: true, type: "error", message: "Pendaftaran Gagal: Data gagal disimpan oleh server CKG" };
          }

          return { handled: false };
        });

        if (popupCheck?.handled) {
          await this._sleep(350);
          await chrome.tabs.reload(tabId).catch(() => {});
          this._outcome = { status: popupCheck.type, ticketNumber: null, errorMsg: popupCheck.message };
          return;
        }

        // 5. Jika masih di step 1 dan belum ada modal/aksi, coba trigger klik "Selanjutnya" lagi setiap 5 cycle (~1.5 detik)
        transAttempt++;
        if (transAttempt % 5 === 0) {
          await exec(tabId, clickSelanjutnya);
        }

        await this._sleep(300);
      }

      if (!isPhase2Ready && !this._outcome) {
        const inlineErr = await exec(tabId, () => {
          const el = Array.from(document.querySelectorAll('.text-danger, .text-red-500, div.text-sm.text-red-500, [role="alert"]')).find(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (e.textContent || "").trim().length > 3;
          });
          return el ? el.textContent.trim() : null;
        }).catch(() => null);

        this._outcome = {
          status: "error",
          ticketNumber: null,
          errorMsg: inlineErr ? `Validasi gagal: ${inlineErr}` : "Gagal berpindah ke Step 2 setelah klik Selanjutnya (server tidak merespons atau form belum lengkap)"
        };
        return;
      }

      await this._sleep(400);
      if (await this._isStopped()) return;
    } else {
      // Tab SUDAH berada di Step 2 ("Isi data pendukung")
      // Langsung pasang debugger tanpa me-reload tab dan tanpa mengulang Step 1
      await initDebugger();
    }

    await exec(tabId, installRegisterInterceptor);
    await exec(tabId, clearRegisterResult);

      // Tunggu hingga form Step 2 ("Isi data pendukung") benar-benar muncul di DOM
      const step2Deadline = Date.now() + 8000;
      while (Date.now() < step2Deadline) {
        if (await this._isStopped()) return;
        const isStep2Ready = await exec(tabId, () => {
          const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const bodyTxt = norm(document.body?.innerText || "");
          return bodyTxt.includes("isi data pendukung") ||
                 bodyTxt.includes("data pendukung") ||
                 !!document.querySelector("#detail-domisili") ||
                 bodyTxt.includes("status pernikahan") ||
                 bodyTxt.includes("penyandang disabilitas") ||
                 bodyTxt.includes("nama sekolah") ||
                 bodyTxt.includes("sekolah") ||
                 bodyTxt.includes("jenjang");
        });
        if (isStep2Ready) break;
        await this._sleep(150);
      }
      if (await this._isStopped()) return;

      // 8. Step 2: Form Data Pendukung (Sekolah vs Umum/Balita)
      const pageIsSekolah = isSekolah || await exec(tabId, () => {
        const url = window.location.href.toLowerCase();
        if (url.includes("sekolah")) return true;
        const txt = (document.body?.innerText || "").toLowerCase();
        return txt.includes("nama sekolah") || txt.includes("jenjang pendidikan");
      }).catch(() => false);

      if (pageIsSekolah) {
        const formSekolah = this._parseDetailFormSekolah(patient);
        if (!formSekolah.sekolah || !formSekolah.kelas) {
          const storage = await chrome.storage.local.get(["ckg_saved_school_name", "ckg_saved_school_class"]).catch(() => ({}));
          if (!formSekolah.sekolah && storage.ckg_saved_school_name) formSekolah.sekolah = storage.ckg_saved_school_name;
          if (!formSekolah.kelas && storage.ckg_saved_school_class) formSekolah.kelas = storage.ckg_saved_school_class;
        }

        // FAST-FAIL: CKG Sekolah WAJIB memiliki Nama Sekolah dan Jenjang/Kelas
        if (!formSekolah.sekolah || !formSekolah.kelas) {
          this._outcome = {
            status: "invalid-data",
            ticketNumber: null,
            errorMsg: "Data CKG Sekolah tidak valid: Nama Sekolah atau Jenjang/Kelas tidak tersedia."
          };
          return;
        }

        this._selectedSekolah = formSekolah.sekolah;
        this._selectedKelas = formSekolah.kelas;
        await exec(tabId, fillDetailFormSekolah, [formSekolah]);

        // CDP Hardware Click Fallback jika modal Sekolah atau Jenjang masih terbuka
        if (debuggerCmd) {
          await (async cmd => {
            for (let retry = 0; retry < 5; retry++) {
              const { result } = await cmd("Runtime.evaluate", {
                expression: `(() => {
                  const inp = document.querySelector('input[placeholder*="Cari nama sekolah" i], input[placeholder*="sekolah" i]');
                  if (!inp) return JSON.stringify({ open: false });
                  const inpRect = inp.getBoundingClientRect();
                  const root = inp.closest('.modal-content, [role="dialog"], .modal, div.fixed') || document;
                  const candidates = Array.from(root.querySelectorAll('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, span, p')).filter(el => {
                    if (el.tagName === 'INPUT' || el.querySelector('input') || el.tagName === 'TEXTAREA') return false;
                    const r = el.getBoundingClientRect();
                    if (r.width <= 0 || r.height < 10) return false;
                    if (r.top < inpRect.bottom - 5) return false;
                    const txt = (el.textContent || '').trim();
                    if (!txt || /^(pilih|cari|tutup|batal|kembali|x|✕)/i.test(txt)) return false;
                    return true;
                  });
                  const targetEl = candidates.find(c => c.closest('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b')) || candidates[0];
                  if (!targetEl) return JSON.stringify({ open: true, found: false });
                  const clickable = targetEl.closest('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b') || targetEl;
                  clickable.scrollIntoView({ block: 'center' });
                  const r = clickable.getBoundingClientRect();
                  return JSON.stringify({
                    open: true,
                    found: true,
                    x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)),
                    y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10))
                  });
                })()`,
                returnByValue: true
              });
              const parsed = JSON.parse(result?.value || "{}");
              if (!parsed.open) break;
              if (parsed.found) {
                await cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: parsed.x, y: parsed.y });
                await sleep(40);
                await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
                await sleep(60);
                await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
                await sleep(700);
              } else {
                break;
              }
            }
          })(debuggerCmd).catch(() => {});

          await (async cmd => {
            for (let retry = 0; retry < 5; retry++) {
              const { result } = await cmd("Runtime.evaluate", {
                expression: `(() => {
                  const inp = document.querySelector('input[placeholder*="Cari jenjang pendidikan" i], input[placeholder*="jenjang" i], input[placeholder*="kelas" i]');
                  if (!inp) return JSON.stringify({ open: false });
                  const inpRect = inp.getBoundingClientRect();
                  const root = inp.closest('.modal-content, [role="dialog"], .modal, div.fixed') || document;
                  const candidates = Array.from(root.querySelectorAll('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b, div.py-4, div.py-3, span, p')).filter(el => {
                    if (el.tagName === 'INPUT' || el.querySelector('input') || el.tagName === 'TEXTAREA') return false;
                    const r = el.getBoundingClientRect();
                    if (r.width <= 0 || r.height < 10) return false;
                    if (r.top < inpRect.bottom - 5) return false;
                    const txt = (el.textContent || '').trim();
                    if (!txt || /^(pilih|cari|tutup|batal|kembali|x|✕)/i.test(txt)) return false;
                    return true;
                  });
                  const targetEl = candidates.find(c => c.closest('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b')) || candidates[0];
                  if (!targetEl) return JSON.stringify({ open: true, found: false });
                  const clickable = targetEl.closest('button, [role="option"], [role="button"], li, div.cursor-pointer, div.border-b') || targetEl;
                  clickable.scrollIntoView({ block: 'center' });
                  const r = clickable.getBoundingClientRect();
                  return JSON.stringify({
                    open: true,
                    found: true,
                    x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)),
                    y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10))
                  });
                })()`,
                returnByValue: true
              });
              const parsed = JSON.parse(result?.value || "{}");
              if (!parsed.open) break;
              if (parsed.found) {
                await cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: parsed.x, y: parsed.y });
                await sleep(40);
                await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
                await sleep(60);
                await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
                await sleep(700);
              } else {
                break;
              }
            }
          })(debuggerCmd).catch(() => {});

          // Jika jenjang pendidikan masih kosong setelah modal sekolah ditutup, jalankan sekali lagi
          const stillNeedsKelas = await exec(tabId, () => {
            const txt = (document.body?.innerText || "").toLowerCase();
            return txt.includes("pilih jenjang pendidikan") || txt.includes("pilih kelas");
          }).catch(() => false);
          if (stillNeedsKelas) {
            await exec(tabId, fillDetailFormSekolah, [formSekolah]);
          }
        }
      } else {
        const formUmum = this._parseDetailForm(patient);
        await exec(tabId, fillDetailForm, [formUmum]);
      }

      // Verifikasi Final Step 2 (Sekolah & Umum) sebelum klik Daftarkan
      const verifyStep2Complete = async (isSekolahForm) => {
        return await exec(tabId, (checkSekolah) => {
          const clean = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const findFieldValue = (labelText) => {
            const labels = Array.from(document.querySelectorAll(
              'div.font-semibold, label, div.text-sm, div.font-medium, p, span'
            )).filter(el => {
              if (el.children.length > 2) return false;
              return clean((el.textContent || '').replace(/\*/g, '')) === clean(labelText);
            });
            for (const lbl of labels) {
              let box = lbl.nextElementSibling || lbl.parentElement?.nextElementSibling;
              if (!box) continue;
              const txt = clean(box.textContent || box.value || '');
              if (txt && !txt.startsWith('pilih') && txt !== '—' && txt !== '-') {
                return { filled: true, value: txt };
              }
              return { filled: false, value: txt };
            }
            return { filled: null, notFound: true };
          };

          const fields = checkSekolah
            ? ['status pernikahan', 'penyandang disabilitas', 'nama sekolah', 'jenjang pendidikan', 'alamat domisili']
            : ['status pernikahan', 'pekerjaan', 'alamat domisili'];
          if (checkSekolah) {
            const pek = findFieldValue('pekerjaan');
            if (pek && !pek.notFound && pek.filled === false) fields.push('pekerjaan');
          }

          const missing = [];
          for (const f of fields) {
            const r = findFieldValue(f);
            if (r && r.filled === false) missing.push(f);
          }
          return { complete: missing.length === 0, missing };
        }, [isSekolahForm]).catch(() => ({ complete: true, missing: [] }));
      };

      for (let verifyRound = 0; verifyRound < 3; verifyRound++) {
        const check = await verifyStep2Complete(pageIsSekolah);
        if (check?.complete) break;

        if (check?.missing?.length) {
          if (debuggerCmd) {
            const miss = check.missing[0];
            const phMap = {
              'status pernikahan': 'pilih status pernikahan',
              'pekerjaan': 'pilih pekerjaan',
              'alamat domisili': 'pilih alamat domisili',
              'penyandang disabilitas': 'pilih penyandang disabilitas',
              'nama sekolah': 'pilih nama sekolah',
              'jenjang pendidikan': 'pilih jenjang pendidikan'
            };
            const targetPh = phMap[miss];
            if (targetPh) {
              await (async cmd => {
                const { result } = await cmd('Runtime.evaluate', {
                  expression: `(() => {
                    const openSubInp = document.querySelector('.modal-content input[placeholder*="Cari" i], input[placeholder*="Provinsi" i], input[placeholder*="Kabupaten" i], input[placeholder*="Kota" i], input[placeholder*="Kecamatan" i], input[placeholder*="Kelurahan" i]');
                    if (openSubInp && openSubInp.getBoundingClientRect().width > 0) return JSON.stringify({ found: false, alreadyOpen: true });
                    const els = Array.from(document.querySelectorAll('div, span, p, button')).filter(e => {
                      if (e.children.length > 1) return false;
                      const t = (e.textContent || '').trim().toLowerCase();
                      return t === ${JSON.stringify(targetPh)} || t.includes(${JSON.stringify(targetPh)});
                    });
                    if (!els.length) return JSON.stringify({ found: false });
                    const el = els[0];
                    const target = el.closest('.cursor-pointer, [role="combobox"], button, div.border') || el;
                    target.scrollIntoView({ block: 'center' });
                    const r = target.getBoundingClientRect();
                    return JSON.stringify({ found: true, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
                  })()`,
                  returnByValue: true
                });
                const pt = JSON.parse(result?.value || '{}');
                if (pt.found) {
                  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
                  await sleep(30);
                  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
                  await sleep(50);
                  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
                  await sleep(500);
                }
              })(debuggerCmd).catch(() => {});
            }
          }

          if (pageIsSekolah) {
            const formSekolah = this._parseDetailFormSekolah(patient);
            await exec(tabId, fillDetailFormSekolah, [formSekolah]);
          } else {
            const formUmum = this._parseDetailForm(patient);
            await exec(tabId, fillDetailForm, [formUmum]);
          }
          await this._sleep(800);
        }
      }

      if (await this._sleep(400), await this._isStopped()) return;

      // Klik "Selanjutnya" di Step 2 jika ada
      for (let i = 0; i < 3; i++) {
        const clicked = await exec(tabId, clickSelanjutnya);
        if (clicked) break;
        await this._sleep(150);
      }

      await this._sleep(250);
      if (await this._isStopped()) return;

      // Klik "Pilih" jika ada modal pilihan
      for (let i = 0; i < 3; i++) {
        const clicked = await exec(tabId, clickPilih);
        if (clicked) break;
        await this._sleep(150);
      }

      await this._sleep(300);
      if (await this._isStopped()) return;

      await exec(tabId, installRegisterInterceptor);
      await exec(tabId, clearRegisterResult);

      let submitClicked = false;
      for (let i = 0; i < 8; i++) {
        if (await this._isStopped()) return;
        submitClicked = await exec(tabId, clickDaftarkan);
        if (submitClicked) {
          await this._sleep(250);
          break;
        }
        await this._sleep(250);
      }

      // SELALU jalankan CDP Trusted Hardware Click untuk memastikan tombol Daftarkan benar-benar tertekan
      if (debuggerCmd) {
        await (async cmd => {
          const { result } = await cmd("Runtime.evaluate", {
            expression: `(() => {
              const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a.btn, div.bg-primaryColor, div.btn-primary')).filter(b => {
                const t = (b.textContent || b.innerText || '').trim().replace(/\\s+/g, ' ').toLowerCase();
                return t === 'daftarkan' || t.startsWith('daftarkan') || t === 'simpan';
              });
              const b = candidates.find(x => x.type === 'submit' || x.classList.contains('btn-fill-primary')) || candidates[0];
              if (!b || b.offsetParent === null) return JSON.stringify({ found: false });
              b.scrollIntoView({ block: 'center' });
              const r = b.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return JSON.stringify({ found: false });
              return JSON.stringify({
                found: true,
                x: Math.round(r.x + (r.width > 0 ? r.width / 2 : 10)),
                y: Math.round(r.y + (r.height > 0 ? r.height / 2 : 10))
              });
            })()`,
            returnByValue: true
          });
          const parsed = JSON.parse(result?.value || "{}");
          if (parsed.found) {
            await cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x: parsed.x, y: parsed.y });
            await sleep(40);
            await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
            await sleep(60);
            await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: parsed.x, y: parsed.y, button: "left", clickCount: 1 });
          }
        })(debuggerCmd).catch(() => {});
      }

      if (await this._isStopped()) return;

      // 9. Ambil Nomor Tiket
      let ticketNumber = null;
      let registrationFailed = false;
      let failureReason = "";
      const ticketDeadline = Date.now() + this._timeoutTicket;
      while (Date.now() < ticketDeadline) {
        if (await this._isStopped()) return;

        const checkRes = await exec(tabId, () => {
          const bodyText = document.body ? (document.body.innerText || document.body.textContent || "") : "";

          // Cek apakah ada popup kegagalan pendaftaran
          if (bodyText.includes("Pendaftaran Gagal") || bodyText.includes("gagal disimpan") || bodyText.includes("Silakan coba beberapa saat lagi")) {
            return {
              failed: true,
              reason: "Pendaftaran Gagal: Data pendaftaran gagal disimpan oleh server CKG"
            };
          }

          // Cek nomor tiket berhasil
          const m = bodyText.match(/(?:No|Nomor)\.?\s*Tiket\s*:\s*([A-Za-z0-9-]+)/i);
          if (m && m[1]) return { failed: false, ticket: m[1].trim() };

          const div = [...document.querySelectorAll("div, span, p, h3, h4")].find(
            d => /(?:No|Nomor)\.?\s*Tiket/i.test(d.textContent)
          );
          if (div) {
            const m2 = div.textContent.match(/(?:No|Nomor)\.?\s*Tiket\s*:\s*([A-Za-z0-9-]+)/i);
            if (m2 && m2[1]) return { failed: false, ticket: m2[1].trim() };
          }

          // Cek modal popup sukses / terbit tiket
          const modals = Array.from(document.querySelectorAll('.modal-content, [role="dialog"], div.fixed.inset-0, div.z-50'));
          for (const modal of modals) {
            const mTxt = (modal.textContent || "").trim();
            if (mTxt.includes("Pendaftaran Berhasil") || mTxt.includes("Nomor Tiket") || mTxt.includes("No. Tiket")) {
              const m3 = mTxt.match(/(?:No|Nomor)\.?\s*Tiket\s*:\s*([A-Za-z0-9-]+)/i) || mTxt.match(/([A-Z0-9]{3,}-[A-Z0-9-]+)/);
              return { failed: false, ticket: m3 ? m3[1].trim() : "TERDAFTAR" };
            }
          }

          return null;
        });

        if (checkRes?.failed) {
          registrationFailed = true;
          failureReason = checkRes.reason;
          break;
        }

        if (checkRes?.ticket) {
          ticketNumber = checkRes.ticket;
          break;
        }

        await sleep(150);
      }

      if (registrationFailed) {
        this._outcome = { status: "error", ticketNumber: null, errorMsg: failureReason || "Pendaftaran gagal disimpan oleh server CKG" };
        return;
      }

      if (!ticketNumber) {
        const errMsgs = await exec(tabId, () =>
          Array.from(document.querySelectorAll("*"))
            .filter(t => 0 === t.children.length)
            .map(t => (t.innerText || "").trim())
            .filter(t => t && /wajib|harus diisi|tidak boleh kosong|required|invalid/i.test(t))
            .slice(0, 8)
        ).catch(() => []);
        this._outcome = {
          status: "error",
          ticketNumber: null,
          errorMsg: "Nomor Tiket tidak muncul setelah pendaftaran disubmit" + (errMsgs?.length ? " — pesan: " + errMsgs.join(" | ") : "")
        };
        return;
      }

      this._ticketNumber = ticketNumber;

      // Begitu nomor tiket / notifikasi berhasil muncul di layar, langsung klik Tutup modal secara cepat
      await exec(tabId, () => {
        const btns = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, a"));
        const btn = btns.find(b => {
          const t = (b.textContent || b.innerText || "").trim().toLowerCase();
          return t === "tutup" || t === "ok" || t === "selesai" || t === "kembali" || t === "✕" || t === "x";
        });
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      // Quick non-blocking read of register result if available
      try {
        const quickReg = await exec(tabId, getRegisterResult);
        if (quickReg) await decryptResult(quickReg);
      } catch (e) {}

      await sleep(100);
      if (await this._isStopped()) return;

      // Pendaftaran selesai langsung begitu tiket terbit & modal ditutup
      this._outcome = { status: "done", ticketNumber: this._ticketNumber };
    } catch (err) {
      if (this._ticketNumber) {
        this._outcome = { status: "done", ticketNumber: this._ticketNumber };
      } else {
        this._outcome = { status: "error", ticketNumber: null, errorMsg: err.message };
      }
    } finally {
      if (this._outcome?.status !== "done") {
        // Pastikan semua pop up error ("Periksa Kembali" / "Data peserta tidak valid") DAN modal form pendaftaran tertutup bersih sebelum lanjut ke pasien berikutnya
        try {
          await exec(tabId, dismissErrorModal).catch(() => {});
          await sleep(250);
          await exec(tabId, () => {
            const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const alertBtns = Array.from(document.querySelectorAll("[role='dialog'] button, .modal button, .swal2-popup button, div.fixed button")).filter(b => {
              const t = norm(b.textContent || b.innerText);
              return /^(periksa kembali|tutup|kembali|batal|ok|oke|cari individu|x|✕|×)$/i.test(t) || t.includes("periksa kembali");
            });
            for (const b of alertBtns) {
              try { b.click(); } catch (e) {}
            }
          }).catch(() => {});
          await sleep(250);
          await exec(tabId, () => {
            const nikEl = document.getElementById("nik") || document.querySelector("input[placeholder*='nik' i]:not(#searchNik)");
            if (!nikEl || nikEl.getBoundingClientRect().height === 0) return;
            const modal = nikEl.closest('.modal-content, [role="dialog"], .modal, div.fixed') || document;
            const closeBtn = Array.from(modal.querySelectorAll("button, [role='button'], div.cursor-pointer")).find(b => {
              const t = (b.textContent || b.innerText || b.getAttribute("aria-label") || "").trim().toLowerCase();
              if (t === "batal" || t === "tutup" || t === "✕" || t === "x" || t.includes("close")) return true;
              const svg = b.querySelector("svg");
              if (svg && !t) {
                const r = b.getBoundingClientRect();
                return r.width > 0 && r.width <= 48 && r.top < 180;
              }
              return false;
            });
            if (closeBtn) {
              try { closeBtn.click(); } catch (e) {}
            }
          }).catch(() => {});
        } catch (e) {}
      }
      if (debuggerAttached) {
        await chrome.debugger.detach({ tabId }).catch(() => {});
      }
      const { status, ticketNumber, errorMsg } = this._outcome ?? { status: "stopped", ticketNumber: null, errorMsg: null };
      const extraData = {
        sekolah: this._selectedSekolah || patient.sekolah || patient.namasekolah || patient.namaSekolah || "",
        kelas: this._selectedKelas || patient.kelas || patient.tingkat || patient.jenjang || patient.tingkatKelas || ""
      };
      await this._report(status, ticketNumber, errorMsg, extraData);
    }
  }

  async _report(status, ticketNumber, errorMsg, extraData = {}) {
    if (!this._reported) {
      this._reported = true;
      await this.onStatus(status, ticketNumber, errorMsg, extraData);
    }
  }
}
