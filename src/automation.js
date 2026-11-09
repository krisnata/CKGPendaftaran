import {
  itemsFromDetailScreening,
  readDetailScreening,
  normalizeTitle,
  applySkip
} from "./detailScreening.js";
import { isExamEnabled, loadExamToggles, applyTogglesToUncheckKeywords } from "./examToggleConfig.js";
import { UNCHECK_KEYWORDS, UNCHECK_PARTIAL } from "./uncheckConfig.js";
import { runUncheckAll } from "./uncheckUtils.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function execInTab(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func,
    args
  });
  return res?.result;
}

const CKG_ORIGIN = "https://sehatindonesiaku.kemkes.go.id";
const isTabError = err => /No tab with id/i.test(err?.message ?? "");

async function waitForNav(tabId, predicate, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (predicate(tab.url) && tab.status === "complete") return;
    } catch (e) {}
    await sleep(400);
  }
  throw new Error("Navigation timeout");
}

async function waitForCondition(tabId, checkFn, timeoutMs = 15000, intervalMs = 350) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await execInTab(tabId, checkFn).catch(e => {
      if (isTabError(e)) throw e;
      return false;
    })) return;
    await sleep(intervalMs);
  }
  throw new Error("Timeout: condition not met");
}

/**
 * Mencari baris item pemeriksaan di DOM dan mengklik tombol "Input Data".
 * Mendukung ID resmi baris, Grid Pelayanan Nakes, dan Tabel Pemeriksaan Mandiri.
 */
const locateAndClickItemButton = (targetTitle, targetCode = null) => {
  const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const cleanTarget = clean(targetTitle);

  // 1. Cek via ID resmi elemen jika ada
  if (targetCode) {
    const codeStr = String(targetCode);
    const row = document.getElementById("row-" + codeStr) ||
                document.getElementById("row" + codeStr.toLowerCase()) ||
                document.getElementById("row-" + codeStr.toLowerCase()) ||
                document.getElementById("row" + codeStr);
    if (row) {
      const btn = row.querySelector("button, a, div[role='button']");
      if (btn && !btn.disabled) {
        btn.click();
        return "clicked";
      }
      if (row.querySelector(".cursor-not-allowed") || row.classList.contains("cursor-not-allowed")) {
        return "locked";
      }
    }
  }

  // 2. Scan SEMUA tombol 'Input Data' / 'Mulai' di halaman dan periksa ancestor yang memuat cleanTarget
  const allInputBtns = Array.from(document.querySelectorAll("button, a, [role='button'], div.cursor-pointer")).filter(b => {
    if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
    const txt = clean(b.innerText || b.textContent || "");
    return (txt === "input data" || txt === "mulai" || txt === "isi" || txt === "periksa" || txt.includes("input data")) && !txt.includes("lihat") && !txt.includes("ubah");
  });

  for (const btn of allInputBtns) {
    let curr = btn;
    let matched = false;
    for (let depth = 0; depth < 6 && curr && curr !== document.body; depth++) {
      const p = curr.parentElement;
      if (!p) break;
      const pTxt = clean(p.innerText || p.textContent || "");
      if (pTxt.includes(cleanTarget)) {
        matched = true;
        break;
      }
      curr = p;
    }
    if (matched) {
      btn.scrollIntoView({ block: "center", inline: "center" });
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(ev => {
        try { btn.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window })); } catch(e) {}
      });
      if (typeof btn.click === "function") try { btn.click(); } catch(e) {}
      return "clicked";
    }
  }

  // 3. Scan dari elemen Judul Pemeriksaan di DOM lalu cari tombol Input Data di container-nya
  const allTextEls = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, span, p, div, td")).filter(el => {
    if (el.children.length > 3) return false;
    const t = clean(el.innerText || el.textContent || "");
    return t === cleanTarget || (t.includes(cleanTarget) && t.length < cleanTarget.length + 30);
  });

  for (const tEl of allTextEls) {
    let container = tEl;
    for (let depth = 0; depth < 5 && container && container !== document.body; depth++) {
      const p = container.parentElement;
      if (!p) break;
      const btn = Array.from(p.querySelectorAll("button, a, [role='button']")).find(b => {
        if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
        const bt = clean(b.innerText || b.textContent || "");
        return (bt === "input data" || bt === "mulai" || bt.includes("input")) && !bt.includes("lihat");
      });
      if (btn) {
        btn.scrollIntoView({ block: "center", inline: "center" });
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(ev => {
          try { btn.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        });
        if (typeof btn.click === "function") try { btn.click(); } catch(e) {}
        return "clicked";
      }
      container = p;
    }
  }

  // 4. Jika baris berada di dalam accordion yang sedang tertutup, buka accordion
  const accordions = Array.from(document.querySelectorAll("div.cursor-pointer, button, [role='button'], div.border")).filter(acc => {
    const txt = clean(acc.innerText || acc.textContent || "");
    return txt.includes(cleanTarget) && (txt.includes("skrining") || txt.includes("layanan") || txt.includes("pemeriksaan"));
  });

  for (const acc of accordions) {
    try { acc.click(); } catch(e) {}
    const container = acc.closest(".border, div.rounded-lg, section") || acc.parentElement;
    const btn = Array.from(container?.querySelectorAll("button, a, [role='button']") || []).find(b => {
      const bt = clean(b.innerText || b.textContent || "");
      return bt.includes("input data") || bt === "mulai";
    });
    if (btn && !btn.disabled) {
      btn.scrollIntoView({ block: "center", inline: "center" });
      try { btn.click(); } catch(e) {}
      return "clicked";
    }
  }

  // 4. Fallback tabel / grid lama
  const allRows = Array.from(document.querySelectorAll(
    "#tableLayanan [id^='rowfrm'], [id^='rowfrm'], .w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5), .grid.grid-cols-5, .grid.grid-cols-4, .table-pemeriksaan-mandiri tr, table tr"
  ));

  for (const row of allRows) {
    const titleEl = row.querySelector(".col-span-2, [class*='font-semibold'], [class*='font-500'], td:not(:last-child)") || row.firstElementChild;
    const titleTxt = clean(titleEl?.innerText || titleEl?.textContent || "");
    if (!titleTxt || titleTxt.length < 3) continue;

    if (titleTxt === cleanTarget || titleTxt.includes(cleanTarget) || cleanTarget.includes(titleTxt)) {
      const allRowBtns = Array.from(row.querySelectorAll("button, a, div[role='button'], div.cursor-pointer")).filter(b => !b.disabled && !b.classList.contains("cursor-not-allowed"));
      const inputBtn = allRowBtns.find(b => {
        const bt = clean(b.innerText || b.textContent || "");
        return (bt === "input data" || bt === "mulai" || bt.includes("input")) && !bt.includes("lihat");
      });
      if (inputBtn) {
        inputBtn.scrollIntoView({ block: "center", inline: "center" });
        try { inputBtn.click(); } catch(e) {}
        return "clicked";
      }
      return "no-button";
    }
  }

  return "no-row";
};

export class Automation {
  constructor({
    tabId,
    patientDetailUrl = null,
    statusMenikah = "menikah",
    delay = 350,
    testMode = false,
    fieldRules = [],
    patientProfile = null,
    patientInfo = null,
    examToggles = null,
    items = null,
    skipConfig = null,
    manualOverrides = {},
    autoSelesai = false,
    onProgress,
    onDone
  }) {
    this.tabId = tabId;
    this.patientDetailUrl = patientDetailUrl;
    this.statusMenikah = statusMenikah || "menikah";
    this.delay = delay ?? 350;
    this.testMode = testMode ?? false;
    this.fieldRules = fieldRules ?? [];
    this.patientProfile = patientProfile || fieldRules?.patientProfile || null;
    this.patientInfo = patientInfo || null;
    this.examToggles = examToggles || null;
    this.items = items ?? null;
    this.skipConfig = skipConfig ?? null;
    this.manualOverrides = manualOverrides || {};
    this.autoSelesai = autoSelesai ?? false;
    this.onProgress = onProgress || (() => {});
    this.onDone = onDone || (() => {});

    this._paused = false;
    this._stopped = false;
    this._itemsCache = null;
    this.failedItems = [];
    this.processedCount = 0;
    this.completedFormTitles = [];
    this.collectedFormAnswers = {};
    this._detail = null;
    this._lastSubmitAt = 0;
    this._mainUrl = null;
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
  }

  stop() {
    this._stopped = true;
    this._paused = false;
  }

  async _waitResume() {
    while (this._paused && !this._stopped) {
      await sleep(200);
    }
  }

  /**
   * Deteksi & Pemulihan Otomatis Error Server (Service Unavailable / 409 / 500 / 502 / 503 / 504 / Bad Gateway)
   * serta Stuck "Memuat data..." di detail-pemeriksaan atau form.kemkes.go.id (Adopsi penuh CKG_Puskesmas_Android_V2).
   * Refresh halaman di tempat dan lanjutkan pemeriksaan TANPA kembali ke antrian /ckg-pelayanan!
   */
  async _checkAndRecoverPageErrorOrStuckLoading(maxReloadAttempts = 3) {
    for (let attempt = 0; attempt < maxReloadAttempts && !this._stopped; attempt++) {
      const pageState = await execInTab(this.tabId, () => {
        try {
          if (!document.body) return { hasError: false, isLoading: true, hasItems: false, url: location.href };
          const rawTxt = (document.body.innerText || "").trim();
          const txt = rawTxt.toLowerCase();
          const titleTxt = (document.title || "").toLowerCase();

          const isHttpError =
            /service\s*unavailable|bad\s*gateway|internal\s*server\s*error|gateway\s*timeout|502\s*bad|503\s*service|504\s*gateway|409\s*conflict/i.test(txt) ||
            /service\s*unavailable|502|503|504|bad\s*gateway/i.test(titleTxt) ||
            (rawTxt.length > 0 && rawTxt.length < 180 && /\b(409|500|502|503|504)\b|service\s*unavailable|bad\s*gateway|error/i.test(txt)) ||
            /gagal\s*memuat\s*data|terjadi\s*kesalahan\s*(pada|saat)|silakan\s*coba\s*beberapa\s*saat|koneksi\s*terputus/i.test(txt);

          if (isHttpError) {
            const retryBtn = Array.from(document.querySelectorAll("button, a, [role='button']")).find(b =>
              /coba\s*lagi|muat\s*ulang|refresh|reload|kembali/i.test((b.innerText || b.textContent || "").trim())
            );
            if (retryBtn) {
              try { retryBtn.click(); } catch (e) {}
            }
            return { hasError: true, reason: rawTxt.slice(0, 80) || "Service Unavailable / HTTP Error", url: location.href };
          }

          const hasItems =
            document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)").length > 0 ||
            document.querySelectorAll(".table-pemeriksaan-mandiri tr").length > 1 ||
            document.querySelectorAll("#tableLayanan [id^='rowfrm'], [id^='rowfrm']").length > 0 ||
            document.querySelectorAll(".sd-body, .sd-question, input.sd-input, fieldset[role='radiogroup']").length > 0;

          const isLoading =
            !hasItems && (
              /memuat\s*data|sedang\s*memuat|mohon\s*tunggu|loading/i.test(txt) ||
              !!document.querySelector(".animate-spin, [role='status'], .loading, [class*='skeleton']")
            );

          return { hasError: false, isLoading, hasItems, url: location.href };
        } catch (e) {
          return { hasError: false, isLoading: false, hasItems: false, url: "" };
        }
      }).catch(() => ({ hasError: false, isLoading: false, hasItems: false, url: "" }));

      if (!pageState.hasError) {
        return false; // Tidak ada error HTTP, halaman normal
      }

      console.warn(`[Automation] Terdeteksi ${pageState.reason} di ${pageState.url}. Melakukan refresh halaman (percobaan ${attempt + 1}/${maxReloadAttempts})...`);
      try {
        await chrome.tabs.reload(this.tabId);
      } catch (e) {
        if (this._mainUrl || this.patientDetailUrl) {
          await chrome.tabs.update(this.tabId, { url: this._mainUrl || this.patientDetailUrl }).catch(() => {});
        }
      }
      await sleep(1800);
      await waitForNav(this.tabId, u => !!u, 20000).catch(() => {});
      await sleep(1000);
      this._itemsCache = null;
    }
    return true;
  }

  async _ensureOnMainPage() {
    const tab = await chrome.tabs.get(this.tabId);
    if (tab.url?.startsWith(CKG_ORIGIN)) {
      if (tab.url.includes("detail-pemeriksaan")) {
        this._mainUrl = tab.url;
      }
      const hadErr = await this._checkAndRecoverPageErrorOrStuckLoading(3);
      if (hadErr) {
        await this._waitForItemsRendered(12000);
      }
      return true;
    }
    if (this._mainUrl || this.patientDetailUrl) {
      const targetUrl = this._mainUrl || this.patientDetailUrl;
      await chrome.tabs.update(this.tabId, { url: targetUrl });
      await waitForNav(this.tabId, u => u.startsWith(CKG_ORIGIN));
      await this._checkAndRecoverPageErrorOrStuckLoading(3);
      await this._waitForItemsRendered();
      this._itemsCache = null;
      return true;
    }
    return false;
  }

  async _waitForItemsRendered(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let lastCount = -1;
    let stableAt = 0;
    let loadingSince = Date.now();
    let reloadCount = 0;

    while (Date.now() < deadline && !this._stopped) {
      const info = await execInTab(this.tabId, () => {
        const rawTxt = (document.body?.innerText || "").trim();
        const txt = rawTxt.toLowerCase();
        const titleTxt = (document.title || "").toLowerCase();

        const isHttpError =
          /service\s*unavailable|bad\s*gateway|internal\s*server\s*error|gateway\s*timeout|502\s*bad|503\s*service|504\s*gateway|409\s*conflict/i.test(txt) ||
          /service\s*unavailable|502|503|504|bad\s*gateway/i.test(titleTxt) ||
          (rawTxt.length > 0 && rawTxt.length < 180 && /\b(409|500|502|503|504)\b|service\s*unavailable|bad\s*gateway/i.test(txt)) ||
          /gagal\s*memuat\s*data|terjadi\s*kesalahan\s*(pada|saat)|silakan\s*coba\s*beberapa\s*saat|koneksi\s*terputus/i.test(txt);

        const gridRows = Array.from(document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)")).filter(el => {
          const children = Array.from(el.children);
          const col2Idx = children.findIndex(c => c.className.includes("col-span-2"));
          return col2Idx >= 0 && children[col2Idx + 1] &&
                 Array.from(children[col2Idx + 1].querySelectorAll("div")).some(d => d.children.length === 0 && (d.innerText || "").trim().length > 0);
        }).length;

        const mandiriRows = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tr")).filter(r =>
          r.querySelector("button") || r.querySelector("img")
        ).length;

        const rowFrmCount = document.querySelectorAll("#tableLayanan [id^='rowfrm'], [id^='rowfrm']").length;
        const totalCount = Math.max(gridRows + mandiriRows, rowFrmCount);

        const isStuckLoading =
          totalCount === 0 && (
            /memuat\s*data|sedang\s*memuat|mohon\s*tunggu|loading/i.test(txt) ||
            !!document.querySelector(".animate-spin, [role='status'], .loading, [class*='skeleton']") ||
            rawTxt.length < 40
          );

        return {
          count: totalCount,
          isHttpError,
          isStuckLoading,
          apiAt: window.__ckgDetailScreeningAt ?? 0
        };
      }).catch(() => ({ count: 0, isHttpError: false, isStuckLoading: false, apiAt: 0 }));

      // 1. Jika halaman menampilkan Service Unavailable / 409 / 502 / 503 / 504 -> langsung refresh di tempat!
      if (info.isHttpError && reloadCount < 3) {
        reloadCount++;
        console.warn(`[Automation] Halaman error saat menunggu daftar pemeriksaan. Refresh cepat #${reloadCount}...`);
        await chrome.tabs.reload(this.tabId).catch(() => {});
        await sleep(1600);
        await waitForNav(this.tabId, u => !!u, 15000).catch(() => {});
        loadingSince = Date.now();
        continue;
      }

      if (info.count > 0) {
        if (info.count === lastCount) {
          if (Date.now() - stableAt >= 800) return true;
        } else {
          lastCount = info.count;
          stableAt = Date.now();
        }
      } else if (info.isStuckLoading && Date.now() - loadingSince >= 6000 && reloadCount < 2) {
        // 2. Jika loading "Memuat data..." terlalu lama (>= 6 detik belum render baris) -> langsung refresh cepat!
        reloadCount++;
        console.warn(`[Automation] "Memuat data..." lebih dari 6 detik. Refresh cepat #${reloadCount} untuk lanjutkan pemeriksaan...`);
        await chrome.tabs.reload(this.tabId).catch(() => {});
        await sleep(1500);
        await waitForNav(this.tabId, u => !!u, 15000).catch(() => {});
        loadingSince = Date.now();
      }
      await sleep(300);
    }
    return lastCount > 0;
  }

  async _freshDetail() {
    try {
      this._detail = await readDetailScreening(this.tabId, this._detail);
    } catch (e) {
      return null;
    }
    if (!this._detail || this._detail.at <= this._lastSubmitAt) return null;
    return this._detail;
  }

  async getItems() {
    await this._waitForItemsRendered();
    const fresh = await this._freshDetail();
    if (fresh) {
      return itemsFromDetailScreening(fresh.data);
    }

    await this.ensureAllAccordionsExpanded().catch(() => {});
    return execInTab(this.tabId, () => {
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      const isRowCompleted = row => {
        if (!row) return false;
        const btns = Array.from(row.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, [class*='btn']"));
        const hasViewOrEdit = btns.some(b => {
          const txt = clean(b.innerText || b.textContent || "");
          return (/ubah|lihat|detail|hasil/i.test(txt)) && !/input|mulai|lanjut|isi/i.test(txt);
        });
        if (hasViewOrEdit) return true;

        const imgs = Array.from(row.querySelectorAll("img"));
        const hasSuccessImg = imgs.some(img => {
          const src = (img.src || "").toLowerCase();
          return (src.includes("icon-success") || src.includes("success") || src.includes("check")) &&
                 !src.includes("gray") && !src.includes("disabled") && !src.includes("abu");
        });
        if (hasSuccessImg) return true;

        const icons = Array.from(row.querySelectorAll("svg, i, [class*='icon'], span.rounded-full, div.rounded-full, [class*='rounded-full']"));
        const hasGreenIcon = icons.some(ic => {
          const cls = (ic.className && typeof ic.className === "string") ? ic.className.toLowerCase() : "";
          if (cls.includes("gray") || cls.includes("slate") || cls.includes("disabled")) return false;
          return cls.includes("green") || cls.includes("emerald") || cls.includes("teal") || cls.includes("success") || cls.includes("16b3ac");
        });
        if (hasGreenIcon) return true;

        const badges = Array.from(row.querySelectorAll(".border-rd-full, [class*='border-rd-full'], [class*='rounded-full'], [class*='badge'], div, span"));
        for (const bg of badges) {
          if (bg.children.length > 1) continue;
          const bTxt = clean(bg.innerText || bg.textContent || "");
          if (!bTxt || bTxt.includes("belum") || bTxt.includes("tidak") || bTxt.includes("dalam")) continue;
          if (
            bTxt === "selesai" || bTxt === "sudah selesai" || bTxt === "sudah diperiksa" ||
            bTxt === "sudah pemeriksaan" || bTxt === "selesai diperiksa" || bTxt === "selesai pemeriksaan" ||
            bTxt.includes("selesai diperiksa") || bTxt.includes("selesai pemeriksaan") ||
            bTxt.includes("sudah diperiksa") || bTxt.includes("sudah pemeriksaan") ||
            bTxt === "terisi" || bTxt === "lengkap" || bTxt === "done"
          ) return true;
        }

        const hasActiveInputBtn = btns.some(b => {
          if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
          const txt = clean(b.innerText || b.textContent || "");
          return txt === "input data" || txt === "mulai" || txt === "lanjut" || txt === "isi" || txt.startsWith("input");
        });
        const rowTxt = clean(row.innerText || row.textContent || "");
        if (!hasActiveInputBtn && !rowTxt.includes("belum") && !rowTxt.includes("tidak") &&
            (/sudah\s*(pemeriksaan|diperiksa|dilakukan|selesai)|selesai\s*(pemeriksaan|diperiksa|dilakukan)|\bselesai\b|\bsudah\b/i.test(rowTxt))) {
          return true;
        }
        return false;
      };

      // Mandiri items dari table
      const mandiriList = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tr")).filter(r => r.querySelector("button") || r.querySelector("svg") || r.querySelector("img")).map((r, idx) => {
        const td = Array.from(r.querySelectorAll("td")).find(c => !c.querySelector("button") && c.innerText.trim().length > 0);
        return {
          title: td?.innerText.trim() ?? `Item Mandiri ${idx + 1}`,
          index: idx,
          done: isRowCompleted(r),
          source: "table",
          code: null
        };
      });

      // Nakes items dari grid
      const gridList = Array.from(document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)")).filter(el => el.querySelector(".col-span-2")).map((row, gIdx) => {
        const titleEl = row.querySelector(".col-span-2");
        return {
          title: titleEl?.innerText.trim() || `Grid Item ${gIdx + 1}`,
          index: mandiriList.length + gIdx,
          done: isRowCompleted(row),
          source: "grid",
          code: null
        };
      });

      return [...mandiriList, ...gridList];
    });
  }

  async _handleInitialMulaiModal() {
    const deadline = Date.now() + 25000;
    let waitingStart = Date.now();
    let reloadCount = 0;
    while (Date.now() < deadline) {
      if (this._stopped) return;
      const res = await execInTab(this.tabId, async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const clean = s => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();

        const rawBody = (document.body?.innerText || "").trim();
        const bodyTxt = clean(rawBody);
        const titleTxt = clean(document.title || "");

        // 0. Deteksi Service Unavailable / 409 / 500 / 502 / 503 / 504 di halaman detail-pemeriksaan
        if (
          /service\s*unavailable|bad\s*gateway|internal\s*server\s*error|gateway\s*timeout|502\s*bad|503\s*service|504\s*gateway|409\s*conflict/i.test(bodyTxt) ||
          /service\s*unavailable|502|503|504|bad\s*gateway/i.test(titleTxt) ||
          (rawBody.length > 0 && rawBody.length < 180 && /\b(409|500|502|503|504)\b|service\s*unavailable|bad\s*gateway/i.test(bodyTxt)) ||
          /gagal\s*memuat\s*data|terjadi\s*kesalahan\s*(pada|saat)|silakan\s*coba\s*beberapa\s*saat|koneksi\s*terputus/i.test(bodyTxt)
        ) {
          return "http-error";
        }

        const triggerClick = el => {
          if (!el) return;
          try { el.scrollIntoView({ block: "center", inline: "center" }); } catch(e) {}
          try { if (typeof el.focus === "function") el.focus({ preventScroll: true }); } catch(e) {}
          const r = el.getBoundingClientRect();
          const cx = Math.round(r.left + (r.width > 0 ? r.width / 2 : 10));
          const cy = Math.round(r.top + (r.height > 0 ? r.height / 2 : 10));
          const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
          ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
            try { el.dispatchEvent(new MouseEvent(type, opts)); } catch(e) {}
          });
          if (typeof el.click === "function") {
            try { el.click(); } catch(e) {}
          }
        };

        const isInsideCalendar = el => !!(el && el.closest && el.closest(".mx-datepicker, .mx-calendar, .mx-datepicker-popup, .mx-calendar-header, .mx-calendar-content, .mx-table, table"));

        const isSimpanButton = b => {
          if (!b || b.disabled || b.classList.contains("disabled") || b.classList.contains("cursor-not-allowed")) return false;
          if (isInsideCalendar(b)) return false;
          const txt = clean(b.innerText || b.textContent || b.value || "");
          if (/batal|cancel|kembali|tutup/i.test(txt)) return false;
          return txt === "simpan" ||
                 txt === "ya, simpan" ||
                 txt === "ya" ||
                 txt === "konfirmasi" ||
                 txt === "mulai pemeriksaan" ||
                 txt === "mulai" ||
                 txt === "lanjut" ||
                 txt === "ok" ||
                 /^simpan\b/i.test(txt) ||
                 /^konfirmasi\b/i.test(txt) ||
                 /^mulai\b/i.test(txt);
        };

        // 1. Cek apakah ada Modal Konfirmasi Tanggal Pemeriksaan di halaman (Pendekatan Global Android V2)
        const isDateModalOnPage = bodyTxt.includes("konfirmasi tanggal") || bodyTxt.includes("sebelum mulai input data");

        let modalBox = null;
        if (isDateModalOnPage) {
          modalBox = Array.from(document.querySelectorAll("div.fixed, [role='dialog'], .modal, div[class*='z-50'], div.relative.z-50, section.fixed, div.z-2000")).find(m => {
            const txt = clean(m.innerText || m.textContent || "");
            return txt.includes("konfirmasi tanggal") || txt.includes("sebelum mulai") || txt.includes("tanggal pemeriksaan");
          }) || document;
        }

        if (isDateModalOnPage && modalBox) {
          // A. Tutup popup kalender melayang jika ada agar tidak menutupi tombol Simpan
          try {
            document.querySelectorAll(".mx-datepicker-popup").forEach(p => { p.style.display = "none"; });
          } catch(e) {}

          // B. Cari dan klik tanggal hari ini jika kalender belum aktif
          const now = new Date();
          const targetDay = String(now.getDate());
          const activeCell = modalBox.querySelector(".mx-table-date td.cell.active, .mx-table-date td.cell.actived, .mx-table-date td.cell.current, button.bg-theme, button[class*='bg-theme']");
          if (!activeCell) {
            const dayCell = Array.from(modalBox.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, button")).find(cell => {
              const txt = (cell.innerText || cell.textContent || "").trim();
              return txt === targetDay && !cell.classList.contains("text-gray-300") && !cell.classList.contains("disabled") && !cell.disabled;
            });
            if (dayCell) {
              triggerClick(dayCell);
              await wait(250);
            }
          }

          // C. Cari tombol Simpan (di dalam modal atau fallback document)
          let btnSimpan = Array.from(modalBox.querySelectorAll("button, a, [role='button'], div.cursor-pointer, .btn, input[type='button'], input[type='submit']")).find(isSimpanButton);
          if (!btnSimpan && modalBox.parentElement) {
            btnSimpan = Array.from(modalBox.parentElement.querySelectorAll("button, a, [role='button'], div.cursor-pointer, .btn, input[type='button'], input[type='submit']")).find(isSimpanButton);
          }
          if (!btnSimpan) {
            btnSimpan = Array.from(document.querySelectorAll("button, div[role='button'], a.btn")).find(b => isSimpanButton(b) && (b.offsetParent !== null || b.offsetHeight > 0));
          }

          if (btnSimpan) {
            triggerClick(btnSimpan);
            await wait(600);
            return "simpan-clicked";
          }
          // JIKA MODAL ADA, JANGAN PERNAH RETURN READY! TETAP TUNGGU SIMPAN
          return "modal-open-waiting-simpan";
        }

        // 2. Cek tombol Mulai Pemeriksaan jika modal belum terbuka
        const btnMulai = Array.from(document.querySelectorAll("button, a, div[role='button']")).find(b => {
          const t = clean(b.innerText || b.textContent || "");
          const r = b.getBoundingClientRect();
          return (t === "mulai pemeriksaan" || t.includes("mulai pemeriksaan")) && !b.disabled && r.width > 0 && r.height > 0;
        });
        if (btnMulai) {
          triggerClick(btnMulai);
          await wait(600);
          return "mulai-clicked";
        }

        // 3. Hanya return ready jika TIDAK ADA modal tanggal DAN ADA tombol pemeriksaan yang siap
        const hasReadyExamButton = Array.from(document.querySelectorAll('button, a.btn, [role="button"]')).some(b => {
          const t = clean(b.innerText || b.textContent || "");
          return (t === "input data" || t === "lihat data" || t === "ubah data" || t === "isi formulir") &&
                 !b.disabled && !b.classList.contains("disabled") && !b.classList.contains("cursor-not-allowed");
        });

        if (hasReadyExamButton) return "ready";

        const isStuckLoading =
          /memuat\s*data|sedang\s*memuat|mohon\s*tunggu|loading/i.test(bodyTxt) ||
          !!document.querySelector(".animate-spin, [role='status'], .loading, [class*='skeleton']");
        return isStuckLoading ? "loading" : "waiting";
      }).catch(() => null);

      if (res === "http-error" && reloadCount < 3) {
        reloadCount++;
        console.warn(`[Automation] Terdeteksi Service Unavailable / Error saat menunggu Mulai Pemeriksaan. Refresh halaman #${reloadCount}...`);
        await chrome.tabs.reload(this.tabId).catch(() => {});
        await sleep(1600);
        await waitForNav(this.tabId, u => !!u, 15000).catch(() => {});
        waitingStart = Date.now();
        continue;
      }

      if ((res === "loading" || res === "waiting") && Date.now() - waitingStart >= 6500 && reloadCount < 2) {
        reloadCount++;
        console.warn(`[Automation] Loading "Memuat data..." terlalu lama (>6.5 detik). Refresh cepat #${reloadCount} untuk lanjutkan pemeriksaan...`);
        await chrome.tabs.reload(this.tabId).catch(() => {});
        await sleep(1500);
        await waitForNav(this.tabId, u => !!u, 15000).catch(() => {});
        waitingStart = Date.now();
        continue;
      }

      if (res === "simpan-clicked") {
        await sleep(800);
        // Tunggu hingga modal benar-benar hilang dari DOM
        let isClosed = false;
        for (let c = 0; c < 15; c++) {
          const stillThere = await execInTab(this.tabId, () => {
            const clean = s => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
            const bodyTxt = clean(document.body?.innerText || "");
            return bodyTxt.includes("konfirmasi tanggal") || bodyTxt.includes("sebelum mulai input data");
          }).catch(() => false);
          if (!stillThere) {
            isClosed = true;
            break;
          }
          // Klik ulang tombol simpan jika masih tertinggal
          await execInTab(this.tabId, () => {
            const clean = s => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
            const isInsideCal = el => !!(el && el.closest && el.closest(".mx-datepicker, .mx-calendar, .mx-datepicker-popup, table"));
            const b = Array.from(document.querySelectorAll("button, [role='button'], a.btn")).find(el => {
              if (el.disabled || el.classList.contains("disabled") || isInsideCal(el)) return false;
              const txt = clean(el.innerText || el.textContent || "");
              if (/batal|cancel|kembali|tutup/i.test(txt)) return false;
              return txt === "simpan" || txt === "ya, simpan" || /^simpan\b/i.test(txt);
            });
            if (b) {
              try { b.scrollIntoView({ block: "center" }); } catch(e) {}
              try { b.click(); } catch(e) {}
            }
          }).catch(() => {});
          await sleep(500);
        }
        if (isClosed) break;
      } else if (res === "mulai-clicked") {
        waitingStart = Date.now();
        await sleep(800);
      } else if (res === "ready") {
        break;
      } else {
        await sleep(400);
      }
    }
  }

  async run() {
    try {
      this.failedItems = [];
      await this._ensureOnMainPage().catch(() => {});
      await this._handleInitialMulaiModal();

      // Selalu muat ulang examToggles terbaru dari storage agar sinkron 100% dengan Pengaturan
      const freshToggles = await loadExamToggles().catch(() => null);
      if (freshToggles) {
        this.examToggles = freshToggles;
      }
      const activePatientCtx = {
        ...(this.patientProfile || {}),
        ...(this.patientInfo || {})
      };
      const uncheckKws = applyTogglesToUncheckKeywords(UNCHECK_KEYWORDS, activePatientCtx, this.examToggles);
      this.skipConfig = { keywords: uncheckKws, partial: UNCHECK_PARTIAL };

      // Uncheck otomatis layanan yang di-OFF-kan pada tabel/grid di halaman detail-pemeriksaan
      await runUncheckAll(this.tabId, {}, activePatientCtx).catch(() => {});

      if (this.items || this._itemsCache) {
        await this._waitForItemsRendered();
      }

      let allItems = applySkip(this.items ?? this._itemsCache ?? await this.getItems(), this.skipConfig);
      if (!this.items) this._itemsCache = allItems;

      if (allItems.length === 0) {
        await sleep(1500);
        await this._checkAndRecoverPageErrorOrStuckLoading(2);
        await this._handleInitialMulaiModal();
        const fresh = await this.getItems().catch(() => []);
        if (fresh.length > 0) {
          allItems = applySkip(fresh, this.skipConfig);
          if (!this.items) this._itemsCache = allItems;
        }
      }

      for (let t = 0; t < allItems.length && !this._stopped; t++) {
        await this._waitResume();
        const item = allItems[t];

        // 1. Cek jika item di-override "skip"
        if (this.manualOverrides[item.title] === "skip") {
          await this.onProgress(t, "skipped", item.title);
          continue;
        }

        // 2. Skrining Mandiri WAJIB 100% diproses (TIDAK PERNAH DI-SKIP)
        const isMandiri = item.source === "mandiri" || item.source === "table";
        const isEnabledInSettings = isMandiri || isExamEnabled(item.title, item.source, activePatientCtx, this.examToggles, item.layanan || "");

        if (!isEnabledInSettings) {
          await this.onProgress(t, "skipped", `${item.title} [OFF di Pengaturan]`);
          continue;
        }

        // 3. Proses item jika aktif atau belum selesai
        const shouldRun = isMandiri || (!item.skip && isEnabledInSettings);
        if (shouldRun || item.done) {
          if (this.testMode || !item.done) {
            this.processedCount++;
            await this._processItem(item, t);
          } else {
            if (item.title && !this.completedFormTitles.includes(item.title)) {
              this.completedFormTitles.push(item.title);
            }
            await this.onProgress(t, "done", item.title);
          }
        } else {
          await this.onProgress(t, "skipped", item.title);
        }
      }

      // 4. Pass Pemulihan Otomatis: jika ada item yang belum selesai karena sempat Service Unavailable / reload halaman,
      // refresh & proses ulang item yang tersisa di halaman detail-pemeriksaan tanpa keluar ke antrian!
      for (let recoveryPass = 0; recoveryPass < 2 && !this._stopped && !this.items; recoveryPass++) {
        await this._ensureOnMainPage().catch(() => {});
        await this._handleInitialMulaiModal().catch(() => {});
        await runUncheckAll(this.tabId, {}, activePatientCtx).catch(() => {});
        const latestRaw = await this.getItems().catch(() => []);
        const latestItems = applySkip(latestRaw, this.skipConfig);
        const remainingItems = latestItems.filter(it => {
          if (it.done) return false;
          if (this.manualOverrides[it.title] === "skip") return false;
          const isMandiri = it.source === "mandiri" || it.source === "table";
          if (isMandiri) return true;
          if (it.skip) return false;
          return isExamEnabled(it.title, it.source, activePatientCtx, this.examToggles, it.layanan || "");
        });

        if (remainingItems.length === 0) {
          this.failedItems = [];
          break;
        }

        console.log(`[Automation] Pass pemulihan #${recoveryPass + 1}: melanjutkan ${remainingItems.length} pemeriksaan yang belum selesai...`);
        this.failedItems = [];
        for (let rIdx = 0; rIdx < remainingItems.length && !this._stopped; rIdx++) {
          await this._waitResume();
          const remItem = remainingItems[rIdx];
          // Izinkan 1 kesempatan lagi pada pass pemulihan
          if (this._itemAttempts && (this._itemAttempts[remItem.title] || 0) >= 2) {
            this._itemAttempts[remItem.title] = 1;
          }
          this.processedCount++;
          await this._processItem(remItem, rIdx);
        }
      }
    } finally {
      await this.onDone();
    }
  }

  async runSingleItem(title, overrideVal = null) {
    if (overrideVal) {
      this.manualOverrides[title] = overrideVal;
    }
    await this._ensureOnMainPage().catch(() => {});
    await this._handleInitialMulaiModal();
    const items = await this.getItems().catch(() => []);
    const targetItem = items.find(it => (it.title || '').toLowerCase().includes((title || '').toLowerCase())) || { title, source: 'table' };
    return await this._processItem(targetItem, 0);
  }

  async verifyAllDone() {
    await this._ensureOnMainPage().catch(() => {});
    const fresh = await this._freshDetail();
    if (fresh) {
      const processed = applySkip(itemsFromDetailScreening(fresh.data), this.skipConfig);
      const activeCtx = this.patientInfo || this.patientProfile;
      const relevant = processed.filter(it => {
        if (it.skip) return false;
        if (this.examToggles && it.source === "grid") {
          return isExamEnabled(it.title, it.source, activeCtx, this.examToggles);
        }
        return true;
      });
      const doneCount = relevant.filter(it => it.done).length;
      return {
        total: relevant.length,
        done: doneCount,
        remaining: relevant.length - doneCount,
        allDone: relevant.length > 0 && doneCount === relevant.length,
        pending: relevant.filter(it => !it.done).map(it => it.title),
        source: "api"
      };
    }

    return execInTab(this.tabId, () => {
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      const isRowCompleted = row => {
        if (!row) return false;
        const btns = Array.from(row.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, [class*='btn']"));
        const hasViewOrEdit = btns.some(b => {
          const txt = clean(b.innerText || b.textContent || "");
          return (/ubah|lihat|detail|hasil/i.test(txt)) && !/input|mulai|lanjut|isi/i.test(txt);
        });
        if (hasViewOrEdit) return true;

        const imgs = Array.from(row.querySelectorAll("img"));
        const hasSuccessImg = imgs.some(img => {
          const src = (img.src || "").toLowerCase();
          return (src.includes("icon-success") || src.includes("success") || src.includes("check")) &&
                 !src.includes("gray") && !src.includes("disabled") && !src.includes("abu");
        });
        if (hasSuccessImg) return true;

        const icons = Array.from(row.querySelectorAll("svg, i, [class*='icon'], span.rounded-full, div.rounded-full, [class*='rounded-full']"));
        const hasGreenIcon = icons.some(ic => {
          const cls = (ic.className && typeof ic.className === "string") ? ic.className.toLowerCase() : "";
          if (cls.includes("gray") || cls.includes("slate") || cls.includes("disabled")) return false;
          return cls.includes("green") || cls.includes("emerald") || cls.includes("teal") || cls.includes("success") || cls.includes("16b3ac");
        });
        if (hasGreenIcon) return true;

        const badges = Array.from(row.querySelectorAll(".border-rd-full, [class*='border-rd-full'], [class*='rounded-full'], [class*='badge'], div, span"));
        for (const bg of badges) {
          if (bg.children.length > 1) continue;
          const bTxt = clean(bg.innerText || bg.textContent || "");
          if (!bTxt || bTxt.includes("belum") || bTxt.includes("tidak") || bTxt.includes("dalam")) continue;
          if (
            bTxt === "selesai" || bTxt === "sudah selesai" || bTxt === "sudah diperiksa" ||
            bTxt === "sudah pemeriksaan" || bTxt === "selesai diperiksa" || bTxt === "selesai pemeriksaan" ||
            bTxt.includes("selesai diperiksa") || bTxt.includes("selesai pemeriksaan") ||
            bTxt.includes("sudah diperiksa") || bTxt.includes("sudah pemeriksaan") ||
            bTxt === "terisi" || bTxt === "lengkap" || bTxt === "done"
          ) return true;
        }

        const hasActiveInputBtn = btns.some(b => {
          if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
          const txt = clean(b.innerText || b.textContent || "");
          return txt === "input data" || txt === "mulai" || txt === "lanjut" || txt === "isi" || txt.startsWith("input");
        });
        const rowTxt = clean(row.innerText || row.textContent || "");
        if (!hasActiveInputBtn && !rowTxt.includes("belum") && !rowTxt.includes("tidak") &&
            (/sudah\s*(pemeriksaan|diperiksa|dilakukan|selesai)|selesai\s*(pemeriksaan|diperiksa|dilakukan)|\bselesai\b|\bsudah\b/i.test(rowTxt))) {
          return true;
        }
        return false;
      };

      const mandiriDone = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tr")).filter(r =>
        r.querySelector("button") || r.querySelector("img") || r.querySelector("svg")
      ).map(r => isRowCompleted(r));

      const gridDone = Array.from(document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)")).filter(el =>
        el.querySelector(".col-span-2")
      ).map(el => {
        const titleEl = el.querySelector(".col-span-2, [class*='font-semibold'], [class*='font-600']");
        const title = (titleEl?.innerText || titleEl?.textContent || "").trim();
        const checker = window.__ckgExamToggleChecker;
        if (typeof checker === "function" && title.length > 2) {
          const isEnabled = checker(title, "nakes");
          if (!isEnabled) return "skipped"; // Pemeriksaan ini di-OFF-kan di Pengaturan
        }
        return isRowCompleted(el);
      }).filter(x => x !== null && x !== "skipped");

      const all = [...mandiriDone, ...gridDone];
      const done = all.filter(Boolean).length;
      return {
        total: all.length,
        done,
        remaining: all.length - done,
        allDone: all.length > 0 && done === all.length
      };
    });
  }

  async runSingle(item, index) {
    await this._processItem(item, index);
    await this.onDone();
  }

  async ensureAllAccordionsExpanded() {
    return execInTab(this.tabId, async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      const mainArea = document.querySelector("section.relative.ml-64, main section:not(.fixed), div.w-full.mb-25") || document.querySelector("main") || document.body;

      const isSidebarOrNav = el => {
        if (!el) return true;
        if (el.closest("section.fixed, aside, nav, header, [class*='sidebar'], .fixed.left-0, div.transition-all.text-sm")) return true;
        const t = clean(el.innerText || el.textContent || "");
        if (/^(keluar|logout|ganti password|pusat bantuan|kebijakan|ketentuan|notifikasi|klaster|ckg umum|ckg sekolah|tatalaksana|sarana puskesmas|profil)/i.test(t)) return true;
        return false;
      };

      // 1. Accordion Pemeriksaan Mandiri (Buka jika belum semua selesai)
      try {
        const mandiriAccordion = Array.from(mainArea.querySelectorAll("button, [role='button'], div.cursor-pointer, div.flex.items-center.justify-between")).find(b => {
          if (isSidebarOrNav(b)) return false;
          if (b.closest("table, tbody, tr, td, #tableLayanan")) return false;
          const t = clean(b.innerText || b.textContent || "");
          return (t.includes("pemeriksaan mandiri") || t.includes("jumlah pemeriksaan") || t.includes("skrining mandiri") || /\/\s*\d+\s*selesai/i.test(t)) &&
                 (b.querySelector("svg, img") || b.hasAttribute("aria-expanded") || b.classList.contains("flex"));
        });
        if (mandiriAccordion) {
          const accTxt = clean(mandiriAccordion.innerText || mandiriAccordion.textContent || "");
          const countMatch = accTxt.match(/(\d+)\s*\/\s*(\d+)/);
          const isAccDone = countMatch && parseInt(countMatch[1], 10) > 0 && parseInt(countMatch[1], 10) === parseInt(countMatch[2], 10);
          const hasVisibleTable = !!mainArea.querySelector(".table-pemeriksaan-mandiri tbody tr");
          if (!isAccDone && !hasVisibleTable) {
            mandiriAccordion.click();
            await wait(400);
          }
        }
      } catch (e) {}

      // 2. Accordion Modul Pelayanan Nakes (Buka semua modul yang tertutup)
      try {
        const nonHeaderRegex = /^(input|lihat|detail|edit|panduan|simpan|kirim|batal|kembali|tutup|selesaikan|ckg|tatalaksana|mulai|periksa|layanan|status|aksi|keluar|logout|sarana|klaster|rapor|report|cetak|bantuan)/i;
        const nakesRoot = mainArea.querySelector("#tableLayanan") || mainArea;
        const candidateHeaders = Array.from(nakesRoot.querySelectorAll("button, [role='button'], div.cursor-pointer, div.flex.items-center.justify-between.p-6, div.flex.items-center.justify-between")).filter(el => {
          if (isSidebarOrNav(el)) return false;
          if (el.closest(".table-pemeriksaan-mandiri, .mx-datepicker, table tbody, [id^='rowfrm']")) return false;
          const txt = clean(el.innerText || el.textContent || "");
          if (!txt || txt.length < 3 || nonHeaderRegex.test(txt)) return false;
          if (/rapor|report|lihat rapor|kirim rapor|panduan|selesaikan|pemeriksaan mandiri|skrining mandiri|cetak|tatalaksana/i.test(txt)) return false;

          const hasSvgOrImg = !!el.querySelector("svg, img[src*='arrow']");
          const hasAccordionAttr = el.hasAttribute("aria-expanded") || el.hasAttribute("data-accordion-target");
          const isFlexHeader = el.classList.contains("flex") && (el.classList.contains("w-full") || el.classList.contains("items-center") || el.classList.contains("justify-between"));
          return hasSvgOrImg || hasAccordionAttr || isFlexHeader;
        });

        for (const btn of candidateHeaders) {
          const moduleBox = btn.closest("div.border-1, div.border-b, div.border-t, div.rounded-lg, div.rounded-xl, div.py-2, div.py-3, div.py-4, div.border") ||
                            (btn.parentElement?.parentElement !== document.body ? btn.parentElement?.parentElement : null) ||
                            btn.parentElement;
          if (!moduleBox) continue;

          const hasCollapsedRotate = !!btn.querySelector("svg[class*='-rotate-180'], img[class*='-rotate-180'], [class*='-rotate-180']");
          const isAriaCollapsed = btn.getAttribute("aria-expanded") === "false";

          const hasVisibleAction = Array.from(moduleBox.querySelectorAll("button, a, [id^='rowfrm']")).some(b => {
            if (b === btn || btn.contains(b)) return false;
            const r = b.getBoundingClientRect();
            if (b.offsetParent === null || r.height === 0 || r.width === 0) return false;
            if (b.id && b.id.startsWith("rowfrm")) return true;
            const bt = clean(b.innerText || b.textContent || "");
            return bt === "input data" || bt === "lihat data" || bt === "mulai" || bt === "detail";
          });

          if (!hasCollapsedRotate && !isAriaCollapsed && hasVisibleAction) {
            continue;
          }

          try {
            btn.scrollIntoView({ block: "nearest" });
            btn.click();
            await wait(180);
          } catch (e) {}
        }
      } catch (e) {}

      return true;
    });
  }

  async detectFormTitle() {
    return execInTab(this.tabId, () => {
      return `${[
        document.querySelector(".sd-title.sd-container-modern__title"),
        document.querySelector(".sd-page__title"),
        document.querySelector(".sd-header__text .sd-title"),
        document.querySelector(".sd-title"),
        document.querySelector("h1"),
        document.querySelector("h2")
      ].map(el => el?.innerText?.trim() ?? "").join(" ")} ${document.querySelector(".sd-body")?.innerText ?? ""}`.trim();
    });
  }

  async _waitForDetailScreening(afterTime, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const info = await execInTab(this.tabId, () => ({
        at: window.__ckgDetailScreeningAt ?? 0,
        rendered: document.querySelectorAll(".table-pemeriksaan-mandiri tbody tr").length > 0 ||
                  document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)").length > 0
      })).catch(() => ({ at: 0, rendered: false }));

      if (info.at && info.at > afterTime) {
        await sleep(400);
        return true;
      }
      if (info.rendered) return true;
      await sleep(250);
    }
    return false;
  }

  async getItemStatus(title, code = null) {
    const fresh = await this._freshDetail();
    if (fresh) {
      const items = itemsFromDetailScreening(fresh.data);
      const match = (code && items.find(it => it.code === code)) || items.find(it => normalizeTitle(it.title) === normalizeTitle(title));
      if (match) return match.done ? "done" : "not-done";
    }

    return execInTab(this.tabId, target => {
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const targetClean = clean(target);

      const isRowCompleted = row => {
        if (!row) return false;
        const btns = Array.from(row.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, [class*='btn']"));
        const hasViewOrEdit = btns.some(b => {
          const txt = clean(b.innerText || b.textContent || "");
          return (/ubah|lihat|detail|hasil/i.test(txt)) && !/input|mulai|lanjut|isi/i.test(txt);
        });
        if (hasViewOrEdit) return true;

        const imgs = Array.from(row.querySelectorAll("img"));
        const hasSuccessImg = imgs.some(img => {
          const src = (img.src || "").toLowerCase();
          return (src.includes("icon-success") || src.includes("success") || src.includes("check")) &&
                 !src.includes("gray") && !src.includes("disabled") && !src.includes("abu");
        });
        if (hasSuccessImg) return true;

        const icons = Array.from(row.querySelectorAll("svg, i, [class*='icon'], span.rounded-full, div.rounded-full, [class*='rounded-full']"));
        const hasGreenIcon = icons.some(ic => {
          const cls = (ic.className && typeof ic.className === "string") ? ic.className.toLowerCase() : "";
          if (cls.includes("gray") || cls.includes("slate") || cls.includes("disabled")) return false;
          return cls.includes("green") || cls.includes("emerald") || cls.includes("teal") || cls.includes("success") || cls.includes("16b3ac");
        });
        if (hasGreenIcon) return true;

        const badges = Array.from(row.querySelectorAll(".border-rd-full, [class*='border-rd-full'], [class*='rounded-full'], [class*='badge'], div, span"));
        for (const bg of badges) {
          if (bg.children.length > 1) continue;
          const bTxt = clean(bg.innerText || bg.textContent || "");
          if (!bTxt || bTxt.includes("belum") || bTxt.includes("tidak") || bTxt.includes("dalam")) continue;
          if (
            bTxt === "selesai" || bTxt === "sudah selesai" || bTxt === "sudah diperiksa" ||
            bTxt === "sudah pemeriksaan" || bTxt === "selesai diperiksa" || bTxt === "selesai pemeriksaan" ||
            bTxt.includes("selesai diperiksa") || bTxt.includes("selesai pemeriksaan") ||
            bTxt.includes("sudah diperiksa") || bTxt.includes("sudah pemeriksaan") ||
            bTxt === "terisi" || bTxt === "lengkap" || bTxt === "done"
          ) return true;
        }

        const hasActiveInputBtn = btns.some(b => {
          if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
          const txt = clean(b.innerText || b.textContent || "");
          return txt === "input data" || txt === "mulai" || txt === "lanjut" || txt === "isi" || txt.startsWith("input");
        });
        const rowTxt = clean(row.innerText || row.textContent || "");
        if (!hasActiveInputBtn && !rowTxt.includes("belum") && !rowTxt.includes("tidak") &&
            (/sudah\s*(pemeriksaan|diperiksa|dilakukan|selesai)|selesai\s*(pemeriksaan|diperiksa|dilakukan)|\bselesai\b|\bsudah\b/i.test(rowTxt))) {
          return true;
        }
        return false;
      };

      const mandiriRow = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tr")).find(tr =>
        Array.from(tr.querySelectorAll("td")).some(td => clean(td.innerText) === targetClean)
      );
      if (mandiriRow) {
        return isRowCompleted(mandiriRow) ? "done" : "not-done";
      }

      const gridRow = Array.from(document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)")).find(el =>
        clean(el.querySelector(".col-span-2")?.innerText) === targetClean
      );
      if (gridRow) {
        return isRowCompleted(gridRow) ? "done" : "not-done";
      }
      return "unknown";
    }, [title]);
  }

  async _processItem(item, index) {
    const { title, source, code = null } = item;
    let submitConfirmed = false;
    this._itemAttempts = this._itemAttempts || {};
    this._itemAttempts[title] = (this._itemAttempts[title] || 0) + 1;
    if (this._itemAttempts[title] > 2) {
      await this.onProgress(index, "error", title, "Dilewati setelah 2x gagal agar tidak looping");
      this.failedItems.push({ title, error: "Max retries reached" });
      return;
    }
    await this.onProgress(index, "in-progress", title);

    try {
      await this._ensureOnMainPage();
      await this._handleInitialMulaiModal();
      await this.ensureAllAccordionsExpanded();

      // Cek dan klik tombol pemeriksaan
      let clickStatus = await execInTab(this.tabId, locateAndClickItemButton, [title, code]);

      if (clickStatus === "no-row") {
        for (let i = 0; i < 3 && clickStatus === "no-row" && !this._stopped; i++) {
          await sleep(250);
          clickStatus = await execInTab(this.tabId, locateAndClickItemButton, [title, code]).catch(e => {
            if (isTabError(e)) throw e;
            return "no-row";
          });
        }
      }

      // Jika tombol terkunci, tangani modal "Konfirmasi Tanggal Pemeriksaan" atau klik "Mulai Pemeriksaan"
      if (clickStatus === "locked") {
        await this._handleInitialMulaiModal();
        for (let i = 0; i < 10 && clickStatus === "locked"; i++) {
          await sleep(500);
          clickStatus = await execInTab(this.tabId, locateAndClickItemButton, [title, code]);
        }
      }

      if (clickStatus === "no-button" || clickStatus === "no-row" || clickStatus === "locked") {
        const curStatus = await this.getItemStatus(title, code);
        if (curStatus === "done") {
          await this.onProgress(index, "done", title);
        } else {
          const errMsg = clickStatus === "locked"
            ? 'Layanan masih terkunci (tombol "Input Data" tidak aktif) — "Mulai Pemeriksaan" kemungkinan belum dikonfirmasi'
            : `Tombol input tidak ditemukan (${clickStatus}) dan status di halaman belum selesai`;
          await this.onProgress(index, "error", title, errMsg);
          this.failedItems.push({ title, error: errMsg });
        }
        return;
      }

      if (clickStatus !== "clicked") {
        throw new Error(`Tombol gagal diklik (${clickStatus})`);
      }

      // Tunggu Navigasi ke Form Kemkes dalam tab yang sama (Preserve Referer, 0% 403 Forbidden)
      await waitForNav(this.tabId, u => u.includes("form.kemkes.go.id"));

      // Tunggu elemen form SurveyJS muncul di DOM
      await waitForCondition(this.tabId, () => {
        return document.querySelectorAll(".sd-item__control-label").length > 0 ||
               document.querySelectorAll('input[type="radio"]').length > 0 ||
               document.querySelectorAll('input[type="checkbox"]').length > 0 ||
               document.querySelectorAll(".sd-dropdown__filter-string-input").length > 0 ||
               document.querySelectorAll("input.sd-input").length > 0 ||
               null !== document.querySelector(".sd-body");
      });

      await sleep(300);

      // Isi form sesuai kuesioner / pemeriksaan (Deteksi Cerdas Tingkat Aktivitas Fisik)
      // PENTING: Hanya aktif jika judul form memang secara spesifik Aktivitas Fisik (bukan karena sidebar memuat teks tersebut!)
      const isAktivitas = /aktivitas\s*fisik|kuesioner\s*aktivitas/i.test(title);

      if (isAktivitas) {
        await this._clickAktivitasDropdowns();
        await sleep(400);
        await this._fillByLabels(this.fieldRules);
        await sleep(400);
        await this._fillTingkatAktivitasFisik();
      } else {
        await this._fillByLabels(this.fieldRules);
      }

      await sleep(300);

      // Rekam jawaban aktual dari form SurveyJS sebelum klik Kirim untuk Laporan Lengkap
      try {
        const scrapedQA = await this._scrapeCurrentFormAnswers();
        if (Array.isArray(scrapedQA) && scrapedQA.length > 0) {
          this.collectedFormAnswers[title] = scrapedQA;
        }
        if (title && !this.completedFormTitles.includes(title)) {
          this.completedFormTitles.push(title);
        }
      } catch (e) {}

      this._lastSubmitAt = Date.now();

      // Intercept submit result & klik Kirim
      await execInTab(this.tabId, () => {
        window.__ckgSubmitResult = undefined;
        const origFetch = window.fetch;
        window.__ckgRestoreFetch = () => { window.fetch = origFetch; };
        window.fetch = async function(...args) {
          const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
          try {
            const res = await origFetch.apply(this, args);
            if (/submit/i.test(url) && /skrining|form/i.test(url)) {
              window.__ckgSubmitResult = res.status;
            }
            return res;
          } catch (err) {
            if (/submit/i.test(url) && /skrining|form/i.test(url)) {
              window.__ckgSubmitResult = 0;
            }
            throw err;
          }
        };

        const expander = document.querySelector(".sv-components-column.sv-components-column--expandable");
        if (expander) {
          expander.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          expander.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          expander.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }

        // Sanitasi akhir sebelum kirim (Persis modul CKG_Puskesmas_Android_V2):
        // Pastikan TIDAK ADA input gula darah bernilai 0-39 atau GD2PP/GDP/CO yang terisi salah!
        try {
          const nativeValSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          const allFormInputs = Array.from(document.querySelectorAll("input.sd-input, input")).filter(inp =>
            (inp.type === "number" || inp.type === "text" || inp.inputMode === "numeric") && !inp.disabled && !inp.readOnly
          );
          for (const inp of allFormInputs) {
            const pEl = inp.closest(".sd-element--with-frame, .sd-question, [data-name]") || inp.parentElement;
            const parentText = clean(pEl?.innerText || "");
            const combText = clean(parentText + " " + (inp.placeholder || ""));

            // 1. GD 2 Jam PP: Wajib KOSONG TOTAL agar tidak kena validasi SurveyJS < 40!
            if (/2\s*jam|post\s*prandial|gd2pp|gd\s*2\s*pp|beban\s*glukosa/i.test(combText)) {
              if (nativeValSetter) nativeValSetter.call(inp, "");
              else inp.value = "";
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              setSurveyQuestionValue(inp, undefined);
              continue;
            }

            // 2. Gula Darah Puasa (GDP): Jika bernilai < 40 atau <= 0, kosongkan!
            if (/gula.*puasa|gdp\b/i.test(combText)) {
              const rawGdp = (inp.value || "").trim();
              if (rawGdp !== "") {
                const numGdp = parseFloat(rawGdp);
                if (isNaN(numGdp) || numGdp < 40) {
                  if (nativeValSetter) nativeValSetter.call(inp, "");
                  else inp.value = "";
                  inp.dispatchEvent(new Event("input", { bubbles: true }));
                  inp.dispatchEvent(new Event("change", { bubbles: true }));
                  setSurveyQuestionValue(inp, undefined);
                }
              }
              continue;
            }

            // 3. Gula Darah Sewaktu (GDS 1) / Umum: Wajib minimal 40 mg/dL (Default aman: 105)
            if (/gula|gds|glukosa|sewaktu/i.test(combText)) {
              const rawVal = (inp.value || "").trim();
              const num = parseFloat(rawVal);
              if (rawVal === "" || isNaN(num) || num < 40) {
                const safeSugar = "105";
                if (nativeValSetter) nativeValSetter.call(inp, safeSugar);
                else inp.value = safeSugar;
                inp.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: safeSugar }));
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                inp.dispatchEvent(new Event("change", { bubbles: true }));
                setSurveyQuestionValue(inp, 105);
              }
              continue;
            }

            // 4. Durasi Diabetes Melitus (Bulan): Jika kosong dan ditanyakan, isi 12
            if (/bulan.*diagnosis|diagnosis.*bulan|berapa bulan/i.test(combText)) {
              const rawM = (inp.value || "").trim();
              if (!rawM || rawM === "0") {
                if (nativeValSetter) nativeValSetter.call(inp, "12");
                else inp.value = "12";
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                inp.dispatchEvent(new Event("change", { bubbles: true }));
                setSurveyQuestionValue(inp, 12);
              }
              continue;
            }

            // 5. Kadar CO Pernapasan: Wajib kosongkan
            if (/kadar\s*co|analisis\s*co|co\s*napas|co\s*pernapasan|\bco\b|ppm/i.test(combText)) {
              if (nativeValSetter) nativeValSetter.call(inp, "");
              else inp.value = "";
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              setSurveyQuestionValue(inp, undefined);
              continue;
            }
          }
        } catch(e) {}

        const btnKirim = document.querySelector(".sd-navigation__complete-btn") ||
                         Array.from(document.querySelectorAll("button")).find(b => "Kirim" === b.innerText.trim());
        btnKirim?.click();
      });

      // Tunggu konfirmasi submit (tombol "Kembali ke Halaman Utama" muncul)
      const submitTimeoutMs = 20000;
      const submitDeadline = Date.now() + submitTimeoutMs;
      let submitSuccess = false;

      while (Date.now() < submitDeadline) {
        // Cek apakah ada validasi error SurveyJS "Response required." atau range error (mis. min 40 - max 600)
        const hasRequiredError = await execInTab(this.tabId, () => {
          const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const erboxes = Array.from(document.querySelectorAll(".sd-question__erbox, .sv-string-viewer--error, [role='alert'], .sd-question--error")).filter(
            el => el.offsetParent !== null && (
              /response required|wajib diisi|harus diisi|at least|at most|should be|minimal|maksimal|tidak valid|invalid/i.test(el.innerText || "") ||
              el.classList.contains("sd-question--error") || el.classList.contains("sd-question__erbox")
            )
          );
          if (erboxes.length === 0) return false;

          // Ekstraksi survey (Next.js React / Vue / Window)
          const survey = (() => {
            for (const k of Object.keys(window)) {
              try {
                if (window[k]?.getQuestionByName && window[k]?.getAllQuestions) return window[k];
              } catch (e) {}
            }
            const root = document.querySelector(".sd-root-modern, .sd-body, [data-rendered='r'], form, main");
            if (root) {
              let curr = root;
              for (let i = 0; i < 25 && curr; i++) {
                for (const key of Object.keys(curr)) {
                  if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
                    let fiber = curr[key];
                    for (let d = 0; d < 15 && fiber; d++) {
                      const p = fiber.memoizedProps;
                      if (p?.survey?.getAllQuestions) return p.survey;
                      if (p?.model?.getAllQuestions) return p.model;
                      if (p?.question?.survey?.getAllQuestions) return p.question.survey;
                      fiber = fiber.return;
                    }
                  }
                  if (key.startsWith("__reactProps$")) {
                    const p = curr[key];
                    if (p?.survey?.getAllQuestions) return p.survey;
                    if (p?.model?.getAllQuestions) return p.model;
                    if (p?.question?.survey?.getAllQuestions) return p.question.survey;
                  }
                }
                curr = curr.parentElement;
              }
            }
            return null;
          })();

          if (survey && survey.getAllQuestions) {
            try {
              const allQ = survey.getAllQuestions();
              for (const q of allQ) {
                const qType = q.getType ? q.getType() : "";
                if (qType === "matrix" && q.rows && q.columns) {
                  const valObj = {};
                  const defaultCol = q.columns.find(c => /tidak|normal|0|mandiri/i.test(c.text || c.value || "")) || q.columns[0];
                  for (const row of q.rows) valObj[row.value] = defaultCol.value;
                  q.value = valObj;
                } else if (q.choices && q.choices.length > 0) {
                  // DILARANG KERAS MEMILIH REAKTIF!
                  // Pada rapid test (HIV, Sifilis, Hepatitis/HBsAg, Malaria), Choice 0 adalah Reaktif dan Choice 1 adalah Non Reaktif!
                  const getChoiceTxt = c => {
                    if (!c) return "";
                    let v = c.text ?? c.locText?.text ?? c.title ?? c.value;
                    if (typeof v === "object" && v !== null) v = v.default || v.id || Object.values(v)[0] || "";
                    return String(v || "").toLowerCase().trim();
                  };
                  const qTitleTxt = (() => {
                    let v = q.title ?? q.locTitle?.text ?? q.name;
                    if (typeof v === "object" && v !== null) v = v.default || v.id || Object.values(v)[0] || "";
                    return String(v || "").toLowerCase().trim();
                  })();

                  const isRapidTest = /hiv|sifilis|hbsag|hepatitis|hcv|malaria/i.test(q.name || qTitleTxt || "");
                  let safeChoice = null;
                  if (isRapidTest) {
                    safeChoice = q.choices.find(c => {
                      const t = getChoiceTxt(c);
                      return t.includes("non reaktif") || t.includes("non-reaktif") || t.includes("negatif");
                    }) || q.choices[1] || q.choices[q.choices.length - 1]; // PASTI Non Reaktif, DILARANG index 0!
                  } else {
                    safeChoice = q.choices.find(c => {
                      const t = getChoiceTxt(c);
                      return t.includes("non reaktif") || t.includes("negatif") || t.startsWith("tidak") || t.startsWith("normal");
                    }) || q.choices.find(c => {
                      const t = getChoiceTxt(c);
                      const hasBad = /(^|\s)(reaktif|positif|ya)(\s|$)/i.test(t);
                      return !hasBad && !t.includes("reaktif");
                    }) || q.choices[q.choices.length - 1];
                  }
                  if (safeChoice) q.value = safeChoice.value;
                } else if (qType === "text" || qType === "comment") {
                  const qTitleTxt = (() => {
                    let v = q.title ?? q.locTitle?.text ?? q.name;
                    if (typeof v === "object" && v !== null) v = v.default || v.id || Object.values(v)[0] || "";
                    return String(v || "").toLowerCase().trim();
                  })();

                  // Penanganan cerdas tipe text/angka agar tidak kena error validasi range SurveyJS
                  if (/2\s*jam|post\s*prandial|gd2pp|gd\s*2\s*pp|beban\s*glukosa/i.test(qTitleTxt)) {
                    q.value = undefined;
                    if (typeof survey.clearValue === "function") {
                      try { survey.clearValue(q.name); } catch(e) {}
                    }
                  } else if (/gula.*puasa|gdp\b/i.test(qTitleTxt)) {
                    q.value = undefined;
                    if (typeof survey.clearValue === "function") {
                      try { survey.clearValue(q.name); } catch(e) {}
                    }
                  } else if (/gula|gds|glukosa|sewaktu/i.test(qTitleTxt)) {
                    // GDS wajib minimal 40
                    q.value = 105;
                  } else if (/kadar\s*co|analisis\s*co|co\s*napas|co\s*pernapasan|\bco\b|ppm/i.test(qTitleTxt)) {
                    q.value = undefined;
                    if (typeof survey.clearValue === "function") {
                      try { survey.clearValue(q.name); } catch(e) {}
                    }
                  } else if (/bulan.*diagnosis|diagnosis.*bulan|berapa bulan/i.test(qTitleTxt)) {
                    q.value = 12;
                  } else if (/sistol/i.test(qTitleTxt)) {
                    q.value = 118;
                  } else if (/diastol/i.test(qTitleTxt)) {
                    q.value = 76;
                  } else if (/hari.*aktif|aktif.*fisik/i.test(qTitleTxt)) {
                    q.value = 3;
                  }
                }
              }
            } catch(e) {}
          }

          // Cari frame pertanyaan error dan pulihkan jawaban (Radio & Input Angka/Text)
          for (const eb of erboxes) {
            const qFrame = eb.closest(".sd-question, .sd-element--with-frame") || eb.parentElement;
            if (qFrame) {
              const qText = (qFrame.textContent || "").toLowerCase();
              const isRapid = /hiv|sifilis|hbsag|hepatitis|hcv|malaria/i.test(qText);

              // 1. Pulihkan jika ada input text / number yang error (mis. range < 40 gula darah)
              const errInput = qFrame.querySelector("input.sd-input, input");
              if (errInput && !errInput.disabled && !errInput.readOnly) {
                const isSugarField = /gula|gds|glukosa|mg\/dl|sewaktu|puasa|2\s*jam/i.test(qText + " " + (errInput.placeholder || ""));
                if (isSugarField) {
                  if (/2\s*jam|post\s*prandial|gd2pp|gd\s*2\s*pp/i.test(qText)) {
                    errInput.value = "";
                    errInput.dispatchEvent(new Event("input", { bubbles: true }));
                    errInput.dispatchEvent(new Event("change", { bubbles: true }));
                    continue;
                  }
                  if (/gula.*puasa|gdp\b/i.test(qText)) {
                    errInput.value = "";
                    errInput.dispatchEvent(new Event("input", { bubbles: true }));
                    errInput.dispatchEvent(new Event("change", { bubbles: true }));
                    continue;
                  }
                  // GDS 1: Wajib minimal 40
                  errInput.value = "105";
                  errInput.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: "105" }));
                  errInput.dispatchEvent(new Event("input", { bubbles: true }));
                  errInput.dispatchEvent(new Event("change", { bubbles: true }));
                  continue;
                }
                if (/bulan.*diagnosis|diagnosis.*bulan|berapa bulan/i.test(qText)) {
                  errInput.value = "12";
                  errInput.dispatchEvent(new Event("input", { bubbles: true }));
                  errInput.dispatchEvent(new Event("change", { bubbles: true }));
                  continue;
                }
                if (/kadar\s*co|co\s*napas|co\s*pernapasan/i.test(qText)) {
                  errInput.value = "";
                  errInput.dispatchEvent(new Event("input", { bubbles: true }));
                  errInput.dispatchEvent(new Event("change", { bubbles: true }));
                  continue;
                }
              }

              // 2. Pulihkan jika ada radio / checkbox yang error
              const labels = Array.from(qFrame.querySelectorAll(".sd-selectbase__label, .sd-item__control-label, label"));
              let opt = null;
              const isImmunization = /tetanus|imunisasi|vaksin|status t/i.test(qText);
              if (isRapid) {
                opt = labels.find(l => /non\s*reaktif|non-reaktif|negatif/i.test(l.innerText || l.textContent || "")) || labels[labels.length - 1];
              } else if (isImmunization) {
                opt = labels.find(l => {
                  const t = (l.innerText || l.textContent || "").toLowerCase().trim();
                  return (t.includes("minimal dua kali") || t.includes("dua kali") || t.includes("lengkap") || t.startsWith("sudah") || t.startsWith("pernah")) && !t.includes("tidak") && !t.includes("belum");
                }) || labels[0];
              } else {
                opt = labels.find(l => /tidak|normal|non\s*reaktif|negatif|bukan/i.test(l.innerText || l.textContent || "")) ||
                      labels.find(l => {
                        const t = (l.innerText || l.textContent || "").toLowerCase().trim();
                        return !t.includes("ya") && !t.includes("positif") && (!t.includes("reaktif") || t.includes("non"));
                      }) ||
                      labels[labels.length - 1];
              }
              if (opt) {
                const labelEl = opt.tagName === "LABEL" ? opt : (opt.closest("label") || opt);
                const rInp = labelEl.querySelector('input[type="radio"]') || labelEl.closest('.sd-item, .sd-radio')?.querySelector('input[type="radio"]');
                labelEl.click();
                if (rInp) {
                  rInp.checked = true;
                  rInp.dispatchEvent(new Event("input", { bubbles: true }));
                  rInp.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }
            }
          }
          const btnKirim = document.querySelector(".sd-navigation__complete-btn") ||
                           Array.from(document.querySelectorAll("button")).find(b => "Kirim" === b.innerText.trim());
          btnKirim?.click();
          return true;
        }).catch(() => false);

        if (hasRequiredError) {
          await sleep(500);
        }

        const status = await execInTab(this.tabId, () => ({
          hasBack: Array.from(document.querySelectorAll("button")).some(b => "Kembali ke Halaman Utama" === b.innerText.trim()),
          submitStatus: window.__ckgSubmitResult
        })).catch(e => {
          if (isTabError(e)) throw e;
          return { hasBack: false, submitStatus: undefined };
        });

        if (status.hasBack) {
          submitSuccess = true;
          break;
        }

        if (status.submitStatus !== undefined && status.submitStatus !== 200 && status.submitStatus !== 201) {
          throw new Error(`Submit gagal — server merespons ${status.submitStatus || "network error"}`);
        }
        await sleep(300);
      }

      await execInTab(this.tabId, () => {
        window.__ckgRestoreFetch?.();
      }).catch(() => {});

      if (!submitSuccess) {
        throw new Error('Submit tidak terkonfirmasi (tombol "Kembali ke Halaman Utama" tidak muncul) — kemungkinan server tidak merespons');
      }

      submitConfirmed = true;
      const submitAt = Date.now();

      // Klik "Kembali ke Halaman Utama" dan tunggu kembali ke portal CKG
      await execInTab(this.tabId, () => {
        const btnBack = Array.from(document.querySelectorAll("button")).find(b => "Kembali ke Halaman Utama" === b.innerText.trim());
        btnBack?.click();
      });

      await waitForNav(this.tabId, u => u.includes("sehatindonesiaku.kemkes.go.id"));
      await this._waitForDetailScreening(submitAt);

      try {
        await waitForCondition(this.tabId, () =>
          document.querySelectorAll(".table-pemeriksaan-mandiri tr").length > 1 ||
          document.querySelectorAll(".w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5)").length > 0,
          20000
        );
      } catch (e) {}

      await sleep(this.delay);
      this._itemsCache = null;

      // Verifikasi status item di halaman detail menjadi "done" secara instan
      let finalStatus = "unknown";
      for (let attempt = 0; attempt < 5; attempt++) {
        finalStatus = await this.getItemStatus(title, code).catch(() => "unknown");
        if (finalStatus !== "not-done") break;
        await sleep(150);
      }

      if (finalStatus === "not-done" && !submitConfirmed) {
        const warnMsg = "Submit terkonfirmasi tapi status di halaman masih belum selesai";
        await this.onProgress(index, "error", title, warnMsg);
        this.failedItems.push({ title, error: warnMsg });
      } else {
        await this.onProgress(index, "done", title);
      }
    } catch (err) {
      if (err.message?.includes("No tab with id")) {
        this._stopped = true;
      }

      await execInTab(this.tabId, () => {
        window.__ckgRestoreFetch?.();
      }).catch(() => {});

      if (!this._stopped) {
        await this._ensureOnMainPage().catch(() => {});
      }

      let isEffectivelyDone = submitConfirmed;
      if (submitConfirmed) {
        const chk = await this.getItemStatus(title, code).catch(() => "unknown");
        if (chk === "not-done") isEffectivelyDone = false;
      }

      await this.onProgress(index, isEffectivelyDone ? "done" : "error", title, isEffectivelyDone ? undefined : err.message);
      if (!isEffectivelyDone) {
        this.failedItems.push({ title, error: err.message });
      }
    }
  }

  async _clickAktivitasDropdowns() {
    await execInTab(this.tabId, () => {
      Array.from(document.querySelectorAll(".sd-dropdown__filter-string-input")).forEach(el => {
        el.click();
        const wrapper = el.closest(".sv-dropdown_select-wrapper");
        const opt = wrapper?.querySelector("[role='option']");
        opt?.click();
      });
    });
  }

  async _fillTingkatAktivitasFisik() {
    await execInTab(this.tabId, async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      // Guard: Pastikan halaman yang aktif benar-benar Tingkat Aktivitas Fisik agar tidak mengganggu form lain
      const pageTitle = clean(document.querySelector(".sd-header, .sd-title, h1, h2, h3, h4, h5")?.innerText || "");
      if (!pageTitle.includes("aktivitas fisik") && !pageTitle.includes("kegiatan fisik")) {
        return;
      }

      // 1. Ekstraksi instance SurveyJS dari Next.js (React) / Vue / Window
      const survey = (() => {
        for (const k of Object.keys(window)) {
          try {
            if (window[k]?.getQuestionByName && window[k]?.getAllQuestions) return window[k];
          } catch (e) {}
        }
        const root = document.querySelector(".sd-root-modern, .sd-body, [data-rendered='r'], form, main");
        if (root) {
          let curr = root;
          for (let i = 0; i < 30 && curr; i++) {
            for (const key of Object.keys(curr)) {
              if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
                let fiber = curr[key];
                for (let depth = 0; depth < 20 && fiber; depth++) {
                  const p = fiber.memoizedProps;
                  if (p?.survey?.getAllQuestions) return p.survey;
                  if (p?.model?.getAllQuestions) return p.model;
                  if (p?.question?.survey?.getAllQuestions) return p.question.survey;
                  fiber = fiber.return;
                }
              }
              if (key.startsWith("__reactProps$")) {
                const p = curr[key];
                if (p?.survey?.getAllQuestions) return p.survey;
                if (p?.model?.getAllQuestions) return p.model;
                if (p?.question?.survey?.getAllQuestions) return p.question.survey;
              }
            }
            curr = curr.parentElement;
          }
        }
        return null;
      })();

      // Kumpulan nama & value radio "Tidak" untuk Tingkat Aktivitas Fisik CKG
      const tidakValues = new Set(["PPV00001258", "PPV00001260", "PPV00001262", "PPV00001264", "PPV00001266", "PPV00001268"]);

      // 2. Set langsung seluruh model pertanyaan SurveyJS ke "Tidak" / value "PPV00001258" dsb.
      if (survey && survey.getAllQuestions) {
        try {
          const allQ = survey.getAllQuestions();
          for (const q of allQ) {
            const qType = q.getType ? q.getType() : "";
            if (qType === "radiogroup" || q.choices) {
              const tidakChoice = q.choices?.find(c => {
                const t = clean(c.text || c.title || c.value);
                return t === "tidak" || t.startsWith("tidak") || tidakValues.has(c.value);
              }) || q.choices?.[1] || q.choices?.[0];
              if (tidakChoice) {
                q.value = tidakChoice.value;
              }
            } else if (qType === "text" || qType === "comment") {
              const qTitle = clean(q.title || q.name || "");
              if (/hari|berapa hari|minggu|aktivitas/i.test(qTitle)) {
                q.value = 3;
              }
            }
          }
        } catch(e) {}
      }

      // 3. Set pada elemen DOM untuk SETIAP sd-question (Pertanyaan 1 s.d 6 unik)
      const questions = Array.from(document.querySelectorAll('.sd-question, fieldset[role="radiogroup"], .sd-selectbase, div.sd-element')).filter(el => {
        return el.querySelectorAll('input[type="radio"]').length > 0;
      });

      for (const qEl of questions) {
        const radios = Array.from(qEl.querySelectorAll('input[type="radio"]'));
        if (radios.length === 0) continue;

        const tidakRadio = radios.find(inp => {
          if (tidakValues.has(inp.value)) return true;
          const lbl = inp.closest("label") || inp.parentElement;
          const t = clean(lbl?.innerText || lbl?.textContent || inp.value || "");
          return t.includes("tidak") && !t.includes("ya");
        }) || radios[1] || radios[radios.length - 1];

        if (tidakRadio) {
          const lbl = tidakRadio.closest("label") || tidakRadio;
          try { lbl.scrollIntoView({ block: "center" }); } catch(e) {}
          const opts = { bubbles: true, cancelable: true, view: window };
          ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
            try { lbl.dispatchEvent(new MouseEvent(type, opts)); } catch(e) {}
          });
          if (typeof lbl.click === "function") try { lbl.click(); } catch(e) {}

          const nativeCheckedSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
          if (nativeCheckedSetter) nativeCheckedSetter.call(tidakRadio, true);
          else tidakRadio.checked = true;

          tidakRadio.dispatchEvent(new InputEvent("input", { bubbles: true }));
          tidakRadio.dispatchEvent(new Event("input", { bubbles: true }));
          tidakRadio.dispatchEvent(new Event("change", { bubbles: true }));
          for (const k of Object.keys(tidakRadio)) {
            if (k.startsWith("__reactProps$")) {
              try { tidakRadio[k]?.onChange?.({ target: tidakRadio }); } catch(e) {}
            }
          }

          // Sinkronisasi ke model SurveyJS jika pertanyaan memiliki atribut data-name
          const qName = qEl.getAttribute("data-name") || qEl.closest("[data-name]")?.getAttribute("data-name");
          if (qName && survey && survey.getQuestionByName) {
            try {
              const sq = survey.getQuestionByName(qName);
              if (sq) sq.value = tidakRadio.value;
            } catch(e) {}
          }

          await wait(30);
        }
      }

      // Bersihkan pesan error 'Response required.' jika ada
      document.querySelectorAll(".sd-question__erbox, .sd-question__erbox--num-0").forEach(el => {
        try { el.remove(); } catch(e) {}
      });

      // 4. Set hanya input angka hari jika ada (HANYA jika bertanya tentang jumlah hari aktivitas fisik, BUKAN gula darah/tensi/lab!)
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      const actInputs = Array.from(document.querySelectorAll("input.sd-input, input")).filter(i => {
        if ((i.type !== "number" && i.type !== "text" && i.inputMode !== "numeric") || i.disabled || i.readOnly || i.type === "radio" || i.type === "checkbox") return false;
        const qContainer = i.closest(".sd-element--with-frame, .sd-question, [data-name]") || i.parentElement;
        const qText = clean(qContainer?.innerText || "");
        if (/gula|glukosa|gds|gdp|mg\/dl|sistol|diastol|tensi|tekanan|darah|berat|tinggi|lingkar|co\b|karbon/i.test(qText)) return false;
        return /hari|dalam\s*satu\s*minggu|berapa\s*hari|durasi|menit/i.test(qText);
      });
      for (const inp of actInputs) {
        inp.focus();
        if (nativeSetter) nativeSetter.call(inp, "3");
        else inp.value = "3";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        inp.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
        await wait(30);
      }
    });
  }

    async _fillByLabels(rules) {
    await execInTab(this.tabId, async rulesList => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      // Ekstraksi SurveyJS model dari Next.js (React) / Vue / Window
      const survey = (() => {
        for (const k of Object.keys(window)) {
          try {
            if (window[k]?.getQuestionByName && window[k]?.getAllQuestions) return window[k];
          } catch (e) {}
        }
        const root = document.querySelector(".sd-root-modern, .sd-body, [data-rendered='r'], form, main");
        if (root) {
          let curr = root;
          for (let i = 0; i < 30 && curr; i++) {
            for (const key of Object.keys(curr)) {
              if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
                let fiber = curr[key];
                for (let depth = 0; depth < 20 && fiber; depth++) {
                  const p = fiber.memoizedProps;
                  if (p?.survey?.getAllQuestions) return p.survey;
                  if (p?.model?.getAllQuestions) return p.model;
                  if (p?.question?.survey?.getAllQuestions) return p.question.survey;
                  fiber = fiber.return;
                }
              }
              if (key.startsWith("__reactProps$")) {
                const p = curr[key];
                if (p?.survey?.getAllQuestions) return p.survey;
                if (p?.model?.getAllQuestions) return p.model;
                if (p?.question?.survey?.getAllQuestions) return p.question.survey;
              }
            }
            curr = curr.parentElement;
          }
        }
        return null;
      })();

      const setSurveyQuestionValue = (el, val) => {
        if (!el || !survey) return false;
        const dName = el.closest("[data-name]")?.dataset?.name || el.name || el.getAttribute("name");
        if (!dName) return false;
        const baseName = dName.replace(/\|[^|]+$/, "").replace(/_sq_\d+$/, "");
        const q = survey.getQuestionByName(baseName) || survey.getQuestionByName(dName);
        if (q) {
          if (q.choices && q.choices.length > 0) {
            const strVal = String(val).toLowerCase().trim();
            const matchedChoice = q.choices.find(c => {
              const cVal = String(c.value).toLowerCase().trim();
              const cTxt = String(c.text || c.title || "").toLowerCase().trim();
              if (cVal === strVal || cTxt === strVal) return true;
              if (strVal.includes("non") && (cVal.includes("non") || cTxt.includes("non"))) return true;
              if (strVal.startsWith("tidak") && (cVal.startsWith("tidak") || cTxt.startsWith("tidak"))) return true;
              if (strVal.startsWith("normal") && (cVal.startsWith("normal") || cTxt.startsWith("normal"))) return true;
              return false;
            });
            if (matchedChoice) {
              q.value = matchedChoice.value;
              return true;
            }
          }
          q.value = val;
          return true;
        }
        return false;
      };

      const sortedRules = [...rulesList].sort((a, b) => {
        const pDiff = (b.priority || 0) - (a.priority || 0);
        if (pDiff !== 0) return pDiff;
        return (b.keyword?.length || 0) - (a.keyword?.length || 0);
      });

      const matchAgeRange = (text, age) => {
        const norm = (text || "").replace(/\s+/g, "").replace(/[–—]/g, "-");
        let m = norm.match(/^(\d+)-(\d+)/);
        if (m) return age >= +m[1] && age <= +m[2];
        m = norm.match(/^(?:=>|>=|≥)(\d+)/) || norm.match(/^(\d+)(?:\+|tahunkeatas|keatas|ataulebih)/i);
        if (m) return age >= +m[1];
        m = norm.match(/^>(\d+)/);
        if (m) return age > +m[1];
        m = norm.match(/^(?:=<|<=|≤)(\d+)/);
        if (m) return age <= +m[1];
        m = norm.match(/^<(\d+)/);
        return m ? age < +m[1] : false;
      };

      let passCount = 0;
      do {
        passCount++;
        if (passCount > 6) break;

        // 1. ISI SETIAP PERTANYAAN FIELDSET RADIO GROUP SECARA EKSKLUSIF
        const fieldsets = Array.from(document.querySelectorAll('fieldset[role="radiogroup"], .sd-selectbase'));
        for (const fs of fieldsets) {
          if (fs.offsetParent === null && window.getComputedStyle(fs).display === "none") continue;

          // Periksa apakah sudah tercentang
          const checkedRadio = fs.querySelector('input[type="radio"]:checked');
          const checkedLabel = checkedRadio ? checkedRadio.closest("label")?.textContent?.trim() : "";
          // Jika sudah tercentang dan bukan Reaktif yang salah, lewati
          if (checkedRadio && checkedLabel && !/^(reaktif|positif)$/i.test(checkedLabel.toLowerCase())) {
            continue;
          }

          const qContainer = fs.closest(".sd-element--with-frame, .sd-question, [data-name]") || fs.parentElement;
          const titleEl = qContainer?.querySelector(
            ".sv-title-actions span.sv-string-viewer.sv-string-viewer--multiline, .sd-question__title span.sv-string-viewer, h5 span.sv-string-viewer, .sd-question__title, .sd-title, h5"
          );
          const titleText = (titleEl?.innerText || titleEl?.textContent || "").trim();
          const normTitle = clean(titleText);

          // Cari rule yang cocok
          let rule = sortedRules.find(r => (r.type === "radio" || !r.type) && normTitle.includes(clean(r.keyword)));

          // Aturan Medis Khusus CKG
          if (/apakah\s*dilakukan.*(tekanan darah|tensi|skrining telinga dan mata|pemeriksaan mata|pemeriksaan telinga)/i.test(normTitle)) {
            rule = { type: "radio", label: "Ya", keyword: normTitle };
          } else if (/\b(obat|antihipertensi|riwayat hipertensi)\b/i.test(normTitle)) {
            rule = { type: "radio", label: "Tidak", keyword: normTitle };
          } else if (/\b(tetanus|imunisasi|vaksin|status t)\b/i.test(normTitle)) {
            rule = { type: "radio", label: "Pernah imunisasi tetanus minimal dua kali", keyword: normTitle };
          } else if (/\b(hiv|sifilis|rdt malaria|malaria|hepatitis|hbsag|anti hcv)\b/i.test(normTitle)) {
            if (/hepatitis b|hbsag/i.test(normTitle)) rule = { type: "radio", label: "HBsAg Non Reaktif", keyword: normTitle };
            else if (/hepatitis c|anti hcv|anti-hcv/i.test(normTitle)) rule = { type: "radio", label: "Anti HCV Non Reaktif", keyword: normTitle };
            else rule = { type: "radio", label: "Non Reaktif", keyword: normTitle };
          } else if (/\b(aktivitas fisik|domestik|kegiatan rumah tangga|tempat kerja|olahraga)\b/i.test(normTitle)) {
            rule = { type: "radio", label: "Tidak", keyword: normTitle };
          } else if (!rule) {
            rule = { type: "radio", label: "Tidak", keyword: normTitle };
          }

          const isRapid = /\b(hiv|sifilis|rdt malaria|malaria|hepatitis|hbsag|anti hcv)\b/i.test(normTitle);
          const isImmunization = /\b(tetanus|imunisasi|vaksin|status t)\b/i.test(normTitle);
          const options = Array.from(fs.querySelectorAll(".sd-selectbase__label, .sd-item, label"));
          const cleanOpt = s => (s || "").trim().toLowerCase().replace(/[<>‹›«»]/g, "").replace(/\s+/g, " ");

          let chosen = null;
          if (isRapid) {
            // EKSKLUSIF RAPID TEST: WAJIB NON REAKTIF / NEGATIF! DILARANG KERAS MEMILIH REAKTIF!
            chosen = options.find(sp => {
              const oTxt = cleanOpt(sp.innerText || sp.textContent);
              return oTxt.includes("non reaktif") || oTxt.includes("non-reaktif") || oTxt.includes("negatif");
            }) || options[options.length - 1]; // Index terakhir adalah Non Reaktif!
          } else if (isImmunization) {
            // EKSKLUSIF IMUNISASI / STATUS T: WAJIB LENGKAP / MINIMAL DUA KALI (DILARANG "TIDAK TAHU")
            chosen = options.find(sp => {
              const oTxt = cleanOpt(sp.innerText || sp.textContent);
              return (oTxt.includes("minimal dua kali") || oTxt.includes("dua kali") || oTxt.includes("lengkap") || oTxt.startsWith("sudah") || oTxt.startsWith("pernah")) && !oTxt.includes("tidak") && !oTxt.includes("belum");
            }) || options[0];
          } else if (typeof rule.age === "number") {
            chosen = options.find(sp => matchAgeRange(sp.innerText, rule.age));
          } else {
            chosen = options.find(sp => {
              const oTxt = cleanOpt(sp.innerText || sp.textContent);
              const rTxt = cleanOpt(rule.label);
              if (oTxt === rTxt) return true;
              // DILARANG KERAS: rule non reaktif mencocokkan reaktif
              if (rTxt.includes("non") && !oTxt.includes("non") && !oTxt.includes("negatif")) return false;
              if (!rTxt.includes("non") && !rTxt.includes("negatif") && oTxt.includes("non")) return false;

              if (rTxt.includes("non reaktif") && (oTxt.includes("non reaktif") || oTxt.includes("non-reaktif") || oTxt.includes("negatif"))) return true;
              if (rTxt.startsWith("normal") && oTxt.startsWith("normal")) return true;
              if (rTxt.startsWith("tidak") && oTxt.startsWith("tidak")) return true;
              if (rTxt.includes("tidak ada") && oTxt.includes("tidak ada")) return true;
              if (rTxt === "ya" || rTxt === "iya") return oTxt === "ya" || oTxt === "iya";
              return oTxt === rTxt || oTxt.startsWith(rTxt);
            });
          }

          if (!chosen) {
            // Safe Fallback: cari opsi aman (Normal / Tidak / Non Reaktif). DILARANG KERAS MEMILIH REAKTIF!
            chosen = options.find(sp => {
              const oTxt = cleanOpt(sp.innerText || sp.textContent);
              return oTxt.includes("non reaktif") || oTxt.includes("negatif") || oTxt === "tidak" || oTxt.startsWith("tidak") || oTxt === "normal" || oTxt.includes("tidak ada") || oTxt.includes("tidak pernah") || oTxt.includes("bukan") || oTxt.includes("mandiri") || oTxt.includes("f0-f1");
            }) || options.find(sp => {
              const oTxt = cleanOpt(sp.innerText || sp.textContent);
              return !oTxt.includes("reaktif") && !oTxt.includes("positif") && oTxt !== "ya";
            }) || options[options.length - 1];
          }

          if (chosen) {
            const labelEl = chosen.tagName === "LABEL" ? chosen : (chosen.querySelector("label") || chosen.closest("label") || chosen);
            const rInp = labelEl.querySelector('input[type="radio"]') || chosen.querySelector('input[type="radio"]') || chosen.closest('.sd-item, .sd-radio')?.querySelector('input[type="radio"]');

            const opts = { bubbles: true, cancelable: true, view: window };
            ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
              try { labelEl.dispatchEvent(new MouseEvent(type, opts)); } catch(e) {}
            });
            if (typeof labelEl.click === "function") try { labelEl.click(); } catch(e) {}

            if (rInp) {
              const nativeCheckedSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
              if (nativeCheckedSetter) nativeCheckedSetter.call(rInp, true);
              else rInp.checked = true;
              rInp.dispatchEvent(new Event("input", { bubbles: true }));
              rInp.dispatchEvent(new Event("change", { bubbles: true }));
              for (const k of Object.keys(rInp)) {
                if (k.startsWith("__reactProps$")) {
                  try { rInp[k]?.onChange?.({ target: rInp }); } catch(e) {}
                }
              }
              setSurveyQuestionValue(rInp, rInp.value);
            } else {
              setSurveyQuestionValue(labelEl, chosen.innerText.trim());
            }
            await wait(25);
          }
        }

        // 2. ISI SETIAP DROPDOWN
        const dropdowns = Array.from(document.querySelectorAll(".sd-dropdown"));
        for (const dd of dropdowns) {
          const selectedText = dd.querySelector(".sd-dropdown__value, .sd-dropdown__filter-string-input")?.innerText || "";
          if (selectedText && !selectedText.toLowerCase().includes("pilih")) continue;

          const qContainer = dd.closest(".sd-element--with-frame, .sd-question, [data-name]") || dd.parentElement;
          const titleEl = qContainer?.querySelector(".sd-question__title, .sd-title, h5");
          const normTitle = clean(titleEl?.innerText || "");

          let rule = sortedRules.find(r => (r.type === "dropdown" || !r.type) && normTitle.includes(clean(r.keyword)));
          if (!rule) rule = { type: "dropdown", label: "Normal", keyword: normTitle };

          dd.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          dd.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          dd.click();
          await wait(300);

          let opts = Array.from(document.querySelectorAll("[role='option']"));
          const cleanOpt = s => (s || "").trim().toLowerCase();
          let chosen = opts.find(o => {
            const oTxt = cleanOpt(o.textContent);
            const rTxt = cleanOpt(rule.label);
            if (oTxt === rTxt) return true;
            if (rTxt.includes("non") && !oTxt.includes("non") && !oTxt.includes("negatif")) return false;
            return oTxt.includes(rTxt) || rTxt.includes(oTxt);
          }) || opts.find(o => {
            const oTxt = cleanOpt(o.textContent);
            return oTxt.includes("normal") || oTxt.includes("non reaktif") || oTxt.includes("tidak");
          }) || opts[0];

          if (chosen) {
            const target = chosen.querySelector(".sv-list__item-body") ?? chosen;
            target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
            target.click();
          } else {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          }
          await wait(150);
        }

        // 3. ISI SETIAP INPUT NUMBER / TEXT (Sesuai Logika Teruji CKG_Puskesmas_Android_V2)
        const nativeValSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const inputs = Array.from(document.querySelectorAll("input.sd-input")).filter(i => !i.disabled && !i.readOnly);
        for (const inp of inputs) {
          const qContainer = inp.closest(".sd-element--with-frame, .sd-question, [data-name]") || inp.parentElement;
          const titleEl = qContainer?.querySelector(".sd-question__title, .sd-title, h5");
          const normTitle = clean(titleEl?.innerText || "");
          const isSugarOrLab = /gula|glukosa|gds|gdp|mg\/dl|post\s*prandial|2\s*jam/i.test(normTitle + " " + (inp.placeholder || ""));

          if (isSugarOrLab) {
            // 1. GD 2 Jam PP (GD2PP): Wajib SELALU KOSONG TOTAL sesuai instruksi user agar tidak terkena validasi < 40!
            if (/2\s*jam|post\s*prandial|gd2pp|gd\s*2\s*pp|beban\s*glukosa/i.test(normTitle)) {
              if (nativeValSetter) nativeValSetter.call(inp, "");
              else inp.value = "";
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              setSurveyQuestionValue(inp, undefined);
              continue;
            }

            // 2. GDP (Gula Darah Puasa): Selalu kosongkan kecuali ada nilai eksplisit >= 70
            if (/gula.*puasa|gdp\b/i.test(normTitle)) {
              let ruleGdp = sortedRules.find(r => r.type === "input" && clean(r.keyword).includes("puasa") && r.value && parseFloat(r.value) >= 70);
              const gdpVal = ruleGdp ? String(ruleGdp.value) : "";
              if (nativeValSetter) nativeValSetter.call(inp, gdpVal);
              else inp.value = gdpVal;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              setSurveyQuestionValue(inp, gdpVal || undefined);
              continue;
            }

            // 3. GDS 1 (Gula Darah Sewaktu): Wajib minimal 40 mg/dL (Default aman: 105)
            let ruleGds = sortedRules.find(r => r.type === "input" && (clean(r.keyword).includes("sewaktu") || clean(r.keyword) === "gds" || clean(r.keyword).includes("gula")));
            let validGds = ruleGds?.value ? parseFloat(ruleGds.value) : 105;
            if (isNaN(validGds) || validGds < 40) validGds = 105;

            if (nativeValSetter) nativeValSetter.call(inp, String(validGds));
            else inp.value = String(validGds);
            inp.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: String(validGds) }));
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            setSurveyQuestionValue(inp, validGds);
            continue;
          }

          // Kadar CO Pernapasan (ppm) - Jangan diisi sesuai permintaan user
          if (/kadar\s*co|analisis\s*co|co\s*napas|co\s*pernapasan|\bco\b|ppm|karbon\s*monoksida/i.test(normTitle)) {
            if (nativeValSetter) nativeValSetter.call(inp, "");
            else inp.value = "";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            setSurveyQuestionValue(inp, undefined);
            continue;
          }

          // Jika input lain sudah terisi valid, lewati
          if (inp.value && inp.value.trim().length > 0) continue;

          let rule = sortedRules.find(r => r.type === "input" && normTitle.includes(clean(r.keyword)));
          if (rule && rule.value === "") continue;

          let numVal = rule?.value ?? (
            normTitle.includes("sistol") ? 118 :
            normTitle.includes("diastol") ? 76 :
            /bulan.*diagnosis|diagnosis.*bulan|berapa bulan/i.test(normTitle) ? 12 :
            /hari.*aktif|aktif.*fisik/i.test(normTitle) ? 3 :
            normTitle.includes("berat") ? 60 :
            normTitle.includes("tinggi") ? 160 :
            normTitle.includes("perut") ? 78 : ""
          );

          if (numVal === "") continue;
          inp.focus();
          if (nativeValSetter) nativeValSetter.call(inp, String(numVal));
          else inp.value = String(numVal);
          inp.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: String(numVal) }));
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
          setSurveyQuestionValue(inp, numVal);
          await wait(25);
        }

        // 4. MATRIX / TABEL
        const matrixTables = Array.from(document.querySelectorAll("table.sd-matrix"));
        for (const mat of matrixTables) {
          const rows = Array.from(mat.querySelectorAll("tbody tr"));
          for (const row of rows) {
            const radios = Array.from(row.querySelectorAll("input[type='radio']"));
            if (radios.some(r => r.checked)) continue;
            const labels = Array.from(row.querySelectorAll("label"));
            const safeLabel = labels.find(l => /tidak|normal|0|mandiri/i.test(l.innerText || "")) || labels[labels.length - 1];
            if (safeLabel) {
              safeLabel.click();
              const rInp = safeLabel.querySelector("input[type='radio']");
              if (rInp) {
                const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
                if (s) s.call(rInp, true);
                else rInp.checked = true;
                rInp.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }
        }

        await wait(120);
      } while (passCount < 3);

      // Sweeping akhir pada instance model SurveyJS jika ada (Hanya untuk pertanyaan yang visible)
      if (survey && survey.getAllQuestions) {
        try {
          const allQ = survey.getAllQuestions();
          for (const q of allQ) {
            if (q.isVisible === false) continue;
            const qType = q.getType ? q.getType() : "";
            if (q.value === undefined || q.value === null || q.value === "") {
              const getChoiceTxt = c => {
                if (!c) return "";
                let v = c.text ?? c.locText?.text ?? c.title ?? c.value;
                if (typeof v === "object" && v !== null) v = v.default || v.id || Object.values(v)[0] || "";
                return String(v || "").toLowerCase().trim();
              };
              const qTitleTxt = (() => {
                let v = q.title ?? q.locTitle?.text ?? q.name;
                if (typeof v === "object" && v !== null) v = v.default || v.id || Object.values(v)[0] || "";
                return String(v || "").toLowerCase().trim();
              })();
              const isRapid = /hiv|sifilis|hbsag|hepatitis|hcv|malaria/i.test(q.name || qTitleTxt || "");
              const isImmunization = /tetanus|imunisasi|vaksin|status t/i.test(q.name || qTitleTxt || "");

              if (qType === "radiogroup" || q.choices) {
                let safeChoice = null;
                if (isRapid) {
                  safeChoice = q.choices?.find(c => {
                    const t = getChoiceTxt(c);
                    return t.includes("non reaktif") || t.includes("non-reaktif") || t.includes("negatif");
                  }) || q.choices?.[1] || q.choices?.[q.choices.length - 1];
                } else if (isImmunization) {
                  safeChoice = q.choices?.find(c => {
                    const t = getChoiceTxt(c);
                    return (t.includes("minimal dua kali") || t.includes("dua kali") || t.includes("lengkap") || t.startsWith("sudah") || t.startsWith("pernah")) && !t.includes("tidak") && !t.includes("belum");
                  }) || q.choices?.[0];
                } else {
                  safeChoice = q.choices?.find(c => {
                    const t = getChoiceTxt(c);
                    return t.includes("non reaktif") || t.includes("negatif") || t.startsWith("tidak") || t.startsWith("normal");
                  }) || q.choices?.find(c => {
                    const t = getChoiceTxt(c);
                    const hasBad = /(^|\s)(reaktif|positif|ya)(\s|$)/i.test(t);
                    return !hasBad && !t.includes("reaktif");
                  }) || q.choices?.[q.choices.length - 1];
                }
                if (safeChoice) q.value = safeChoice.value;
              } else if (qType === "dropdown") {
                const safeChoice = q.choices?.find(c => {
                  const t = getChoiceTxt(c);
                  return t.includes("normal") || t.includes("non reaktif") || t.includes("tidak");
                }) || q.choices?.[0];
                if (safeChoice) q.value = safeChoice.value;
              } else if (qType === "text" || qType === "comment") {
                const isSugarQ = /gula|gds|glukosa|mg\/dl|sewaktu|puasa/i.test(qTitleTxt);
                if (isSugarQ) {
                  if (/2\s*jam|post\s*prandial|gd2pp|gd\s*2\s*pp|beban\s*glukosa/i.test(qTitleTxt)) {
                    q.value = undefined;
                    if (typeof survey.clearValue === "function") {
                      try { survey.clearValue(q.name); } catch(e) {}
                    }
                    continue;
                  }
                  if (/gula.*puasa|gdp\b/i.test(qTitleTxt)) {
                    const ruleGdp = sortedRules.find(r => r.type === "input" && clean(r.keyword).includes("puasa") && r.value && parseFloat(r.value) >= 70);
                    if (ruleGdp) {
                      q.value = parseFloat(ruleGdp.value);
                    } else {
                      q.value = undefined;
                      if (typeof survey.clearValue === "function") {
                        try { survey.clearValue(q.name); } catch(e) {}
                      }
                    }
                    continue;
                  }
                  // GDS 1 (wajib minimal 40)
                  const ruleGds = sortedRules.find(r => r.type === "input" && (clean(r.keyword).includes("sewaktu") || clean(r.keyword) === "gds" || clean(r.keyword).includes("gula")));
                  let validSugar = ruleGds?.value ? parseFloat(ruleGds.value) : 105;
                  if (isNaN(validSugar) || validSugar < 40) validSugar = 105;
                  q.value = validSugar;
                  continue;
                }

                if (/kadar\s*co|analisis\s*co|co\s*napas|co\s*pernapasan|\bco\b|ppm|karbon\s*monoksida/i.test(qTitleTxt)) {
                  q.value = undefined;
                  if (typeof survey.clearValue === "function") {
                    try { survey.clearValue(q.name); } catch(e) {}
                  }
                  continue;
                }

                if (/bulan.*diagnosis|diagnosis.*bulan|berapa bulan/i.test(qTitleTxt)) q.value = 12;
                else if (/sistol/i.test(qTitleTxt)) q.value = 118;
                else if (/diastol/i.test(qTitleTxt)) q.value = 76;
                else if (/hari.*aktif|aktif.*fisik/i.test(qTitleTxt)) q.value = 3;
                else if (/berat|bb\b/i.test(qTitleTxt)) q.value = 60;
                else if (/tinggi|tb\b/i.test(qTitleTxt)) q.value = 160;
                else if (/perut/i.test(qTitleTxt)) q.value = 78;
                // Jangan set apapun jika tidak dikenali agar tidak melanggar validator
              }
            }
          }
        } catch(e) {}
      }

      await wait(100);
    }, [rules]);
  }

  async _scrapeCurrentFormAnswers() {
    return execInTab(this.tabId, () => {
      const results = [];
      const seenQuestions = new Set();
      const cleanStr = s => (s || "").replace(/\s+/g, " ").replace(/^\*\s*|\s*\*$/g, "").trim();

      const qFrames = Array.from(document.querySelectorAll(".sd-question, .sd-element--with-frame, [data-name]"));
      for (const qEl of qFrames) {
        if (qEl.offsetParent === null && window.getComputedStyle(qEl).display === "none") continue;
        const titleEl = qEl.querySelector(
          ".sv-title-actions span.sv-string-viewer.sv-string-viewer--multiline, .sd-question__title span.sv-string-viewer, h5 span.sv-string-viewer, .sd-question__title, .sd-title, h5"
        );
        const qTitle = cleanStr(titleEl?.innerText || titleEl?.textContent || "");
        if (!qTitle || qTitle.length < 2 || seenQuestions.has(qTitle)) continue;

        let answer = "";
        // 1. Cek radio button yang terpilih
        const checkedRadio = qEl.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
          const lbl = checkedRadio.closest("label") || qEl.querySelector(`label[for="${checkedRadio.id}"]`);
          answer = cleanStr(lbl?.innerText || lbl?.textContent || checkedRadio.value || "");
        }
        // 2. Cek checkbox yang terpilih
        if (!answer) {
          const checkedBoxes = Array.from(qEl.querySelectorAll('input[type="checkbox"]:checked'));
          if (checkedBoxes.length > 0) {
            answer = checkedBoxes.map(cb => {
              const lbl = cb.closest("label") || qEl.querySelector(`label[for="${cb.id}"]`);
              return cleanStr(lbl?.innerText || lbl?.textContent || cb.value || "");
            }).filter(Boolean).join(", ");
          }
        }
        // 3. Cek dropdown SurveyJS
        if (!answer) {
          const ddVal = qEl.querySelector(".sd-dropdown__value, .sd-dropdown__filter-string-input");
          if (ddVal) {
            const txt = cleanStr(ddVal.innerText || ddVal.value || "");
            if (txt && !/^pilih/i.test(txt)) answer = txt;
          }
        }
        // 4. Cek input angka/teks
        if (!answer) {
          const inp = qEl.querySelector("input.sd-input, textarea.sd-input");
          if (inp && inp.type !== "radio" && inp.type !== "checkbox" && inp.value && inp.value.trim() !== "") {
            answer = cleanStr(inp.value);
          }
        }

        if (answer) {
          seenQuestions.add(qTitle);
          results.push({ question: qTitle, answer });
        }
      }
      return results;
    }).catch(() => []);
  }
}
