export function waitForTabComplete(tabId, timeout = 15000) {
  return new Promise(resolve => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    }, timeout);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// src/dateFilterHelper.js
// Helper sinkronisasi & manipulasi filter rentang tanggal pada halaman /ckg-pelayanan (vue2-datepicker)

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const MONTHS_MAP = {
  jan: "01", januari: "01",
  feb: "02", februari: "02",
  mar: "03", maret: "03",
  apr: "04", april: "04",
  mei: "05", may: "05",
  jun: "06", juni: "06",
  jul: "07", juli: "07",
  agt: "08", agu: "08", agustus: "08", aug: "08",
  sep: "09", september: "09",
  okt: "10", oktober: "10", oct: "10",
  nov: "11", november: "11",
  des: "12", desember: "12", dec: "12"
};

export function formatToIndoDate(isoDateStr) {
  if (!isoDateStr) return "";
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  const y = parts[0];
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return `${d} ${MONTHS_ID[m] || parts[1]} ${y}`;
}

export function parseIndoDate(str) {
  if (!str) return null;
  str = str.trim();
  const m1 = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (m1) {
    const d = m1[1].padStart(2, "0");
    const m = MONTHS_MAP[m1[2].toLowerCase()] || "01";
    return `${m1[3]}-${m}-${d}`;
  }
  const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) {
    return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  const m3 = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m3) {
    return `${m3[1]}-${m3[2].padStart(2, "0")}-${m3[3].padStart(2, "0")}`;
  }
  return null;
}

export async function readDateRangeFromCkgPage(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async () => {
        if (window.location.href.includes("ckg-pelayanan-sekolah") || window.location.href.includes("sekolah")) {
          return { ok: true, isSekolah: true, rawText: "CKG Sekolah (Tanpa Filter Tanggal)" };
        }
        const clean = s => (s || "").replace(/\s+/g, " ").trim();

        const MONTHS_MAP = {
          jan: "01", januari: "01",
          feb: "02", februari: "02",
          mar: "03", maret: "03",
          apr: "04", april: "04",
          mei: "05", may: "05",
          jun: "06", juni: "06",
          jul: "07", juli: "07",
          agt: "08", agu: "08", agustus: "08", aug: "08",
          sep: "09", september: "09",
          okt: "10", oktober: "10", oct: "10",
          nov: "11", november: "11",
          des: "12", desember: "12", dec: "12"
        };

        function parseStr(str) {
          if (!str) return null;
          str = str.trim();
          const m1 = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
          if (m1) {
            const d = m1[1].padStart(2, "0");
            const m = MONTHS_MAP[m1[2].toLowerCase()] || "01";
            return `${m1[3]}-${m}-${d}`;
          }
          const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (m2) {
            return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
          }
          const m3 = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
          if (m3) {
            return `${m3[1]}-${m3[2].padStart(2, "0")}-${m3[3].padStart(2, "0")}`;
          }
          return null;
        }

        // Cari tanggal langsung dari DOM
        let rawText = "";
        const datepicker = document.querySelector(".mx-datepicker-range, .mx-datepicker, [class*='datepicker']");
        if (datepicker) {
          const inp = datepicker.querySelector("input.mx-input, input");
          if (inp && inp.value) rawText = clean(inp.value);
          if (!rawText) {
            const m = clean(datepicker.innerText || datepicker.textContent || "").match(/\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/);
            if (m) rawText = m[0];
          }
        }
        if (!rawText) {
          const m = clean(document.body?.innerText || "").match(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/);
          if (m) rawText = m[0];
        }

        const parts = rawText.split(/\s*[-~–—]\s*/);
        let startDate = null;
        let endDate = null;

        if (parts.length >= 2) {
          startDate = parseStr(parts[0]);
          endDate = parseStr(parts[1]);
        } else if (parts.length === 1) {
          startDate = parseStr(parts[0]);
          endDate = startDate;
        }

        const today = new Date().toISOString().split("T")[0];
        return {
          ok: true,
          rawText: rawText || `${today} - ${today}`,
          startDate: startDate || today,
          endDate: endDate || startDate || today
        };
      }
    });
    return res?.result || { ok: false, error: "Gagal membaca tanggal dari CKG" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function setDateRangeOnCkgPage(tabId, startDateStr, endDateStr) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [startDateStr, endDateStr],
      func: async (startStr, endStr) => {
        if (window.location.href.includes("detail-pemeriksaan")) {
          return { ok: false, error: "Halaman saat ini adalah detail-pemeriksaan, bukan antrean pelayanan." };
        }
        if (window.location.href.includes("ckg-pelayanan-sekolah") || window.location.href.includes("sekolah")) {
          return { ok: true, isSekolah: true, after: "CKG Sekolah (Tanpa Filter Tanggal)" };
        }
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const isVisible = el => !!(el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0));
        const click = el => {
          if (!el) return;
          ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
          });
        };

        let picker = null;
        for (let i = 0; i < 15; i++) {
          picker = document.querySelector(".mx-datepicker-range, .mx-datepicker");
          if (picker) break;
          await sleep(200);
        }
        if (!picker) return { ok: false, error: "Datepicker tidak ditemukan di halaman" };

        const wrapper = picker.querySelector(".mx-input-wrapper") || picker;
        const textEl = wrapper.querySelector(".ml-4") || wrapper.querySelector("div") || wrapper.querySelector("input");
        const curText = (textEl?.value || textEl?.textContent || "").trim();

        const [sYStr, sMStr, sDStr] = startStr.split("-");
        const [eYStr_early, eMStr_early, eDStr_early] = endStr.split("-");
        const sM_early = parseInt(sMStr, 10) - 1;
        const eM_early = parseInt(eMStr_early, 10) - 1;
        const sD_early = parseInt(sDStr, 10);
        const eD_early = parseInt(eDStr_early, 10);
        const sY_early = parseInt(sYStr, 10);
        const eY_early = parseInt(eYStr_early, 10);

        const MONTHS_LIST = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        const normCurEarly = (curText || "").toLowerCase().replace(/\s+/g, " ");
        const expS1 = `${sD_early} ${MONTHS_LIST[sM_early] || sMStr} ${sY_early}`.toLowerCase();
        const expS2 = `${String(sD_early).padStart(2, '0')} ${MONTHS_LIST[sM_early] || sMStr} ${sY_early}`.toLowerCase();
        const expE1 = `${eD_early} ${MONTHS_LIST[eM_early] || eMStr_early} ${eY_early}`.toLowerCase();
        const expE2 = `${String(eD_early).padStart(2, '0')} ${MONTHS_LIST[eM_early] || eMStr_early} ${eY_early}`.toLowerCase();

        if ((normCurEarly.includes(expS1) || normCurEarly.includes(expS2)) &&
            (normCurEarly.includes(expE1) || normCurEarly.includes(expE2))) {
          return { ok: true, matched: true, before: curText, after: curText, startDate: startStr, endDate: endStr };
        }
        const [eYStr, eMStr, eDStr] = endStr.split("-");
        const sYear = parseInt(sYStr, 10);
        const sMonth = parseInt(sMStr, 10) - 1; // 0-indexed (0 = Jan, 8 = Sep, 9 = Okt)
        const sDay = parseInt(sDStr, 10);
        const eYear = parseInt(eYStr, 10);
        const eMonth = parseInt(eMStr, 10) - 1;
        const eDay = parseInt(eDStr, 10);

        function getMonthIdx(txt) {
          if (!txt) return null;
          const t = txt.trim().toLowerCase();
          if (/^jan/i.test(t)) return 0;
          if (/^feb/i.test(t)) return 1;
          if (/^mar/i.test(t)) return 2;
          if (/^apr/i.test(t)) return 3;
          if (/^me|^may/i.test(t)) return 4;
          if (/^jun/i.test(t)) return 5;
          if (/^jul/i.test(t)) return 6;
          if (/^ag|^au/i.test(t)) return 7;
          if (/^sep/i.test(t)) return 8;
          if (/^ok|^oc/i.test(t)) return 9;
          if (/^no/i.test(t)) return 10;
          if (/^de/i.test(t)) return 11;
          const n = parseInt(t, 10);
          if (!isNaN(n) && n >= 1 && n <= 12) return n - 1;
          return null;
        }

        function getPanelYear(panel) {
          const yBtn = panel.querySelector(".mx-btn-current-year");
          if (yBtn) {
            const v = parseInt(yBtn.textContent.trim(), 10);
            if (!isNaN(v) && v > 1900 && v < 2100) return v;
          }
          const header = panel.querySelector(".mx-calendar-header, .mx-calendar-header-label") || panel;
          const m = (header.textContent || "").match(/\b(20\d\d|19\d\d)\b/);
          if (m) return parseInt(m[1], 10);
          return null;
        }

        function getPanelMonth(panel) {
          const mBtn = panel.querySelector(".mx-btn-current-month");
          if (mBtn) {
            const idx = getMonthIdx(mBtn.textContent);
            if (idx !== null) return idx;
          }
          const header = panel.querySelector(".mx-calendar-header, .mx-calendar-header-label") || panel;
          const elements = Array.from(header.querySelectorAll("button, span"));
          for (const el of elements) {
            const idx = getMonthIdx(el.textContent);
            if (idx !== null) return idx;
          }
          return null;
        }

        async function navigatePanel(panel, targetYear, targetMonth) {
          for (let step = 0; step < 40; step++) {
            const curY = getPanelYear(panel);
            const curM = getPanelMonth(panel);
            if (curY === null || curM === null) break;
            if (curY === targetYear && curM === targetMonth) return true;

            const diff = (targetYear - curY) * 12 + (targetMonth - curM);

            // Loncat tahun jika selisih >= 12 bulan
            if (diff <= -12) {
              const btn = panel.querySelector(".mx-btn-icon-double-left");
              if (btn && isVisible(btn)) {
                click(btn);
                await sleep(120);
                continue;
              }
            } else if (diff >= 12) {
              const btn = panel.querySelector(".mx-btn-icon-double-right");
              if (btn && isVisible(btn)) {
                click(btn);
                await sleep(120);
                continue;
              }
            }

            // Geser 1 bulan
            if (diff < 0) {
              const btn = panel.querySelector(".mx-btn-icon-left");
              if (btn && isVisible(btn)) {
                click(btn);
                await sleep(120);
              } else {
                break;
              }
            } else if (diff > 0) {
              const btn = panel.querySelector(".mx-btn-icon-right");
              if (btn && isVisible(btn)) {
                click(btn);
                await sleep(120);
              } else {
                break;
              }
            }
          }
          return false;
        }

        function findDayCell(panel, day) {
          const cells = Array.from(panel.querySelectorAll(".mx-table-date td.cell:not(.not-current-month), .mx-table td.cell:not(.not-current-month)"));
          return cells.find(c => parseInt(c.textContent.trim(), 10) === day) || null;
        }

        // Buka kalender popup dengan klik wrapper, input, dan icon
        const inpEl = picker.querySelector("input");
        const iconEl = picker.querySelector("i, svg, [class*='icon']");
        try { if (inpEl) inpEl.focus(); } catch(e) {}
        click(wrapper);
        if (inpEl) { click(inpEl); try { inpEl.click(); } catch(e) {} }
        if (iconEl) click(iconEl);
        try { picker.click(); } catch(e) {}
        await sleep(350);

        // Tunggu hingga popup muncul di DOM
        let popup = null;
        for (let i = 0; i < 20; i++) {
          popup = document.querySelector(".mx-datepicker-popup, .mx-datepicker-main, .mx-range-wrapper, [class*='datepicker-popup']");
          if (popup && isVisible(popup)) break;
          const anyPop = Array.from(document.querySelectorAll("div.mx-datepicker-popup, div[class*='datepicker'], div.fixed, div.absolute, div.z-50")).find(el => {
            return isVisible(el) && el.querySelector(".mx-table-date, .mx-calendar, td.cell");
          });
          if (anyPop) { popup = anyPop; break; }
          await sleep(100);
        }

        if (!popup) {
          popup = Array.from(document.querySelectorAll("[class*='mx-datepicker-']")).find(el => isVisible(el) && el.querySelector(".mx-table-date, .mx-calendar"));
        }

        if (!popup) {
          return { ok: false, error: "Popup kalender tidak terbuka saat diklik" };
        }

        // Panel kalender
        let panels = Array.from(popup.querySelectorAll(".mx-calendar, .mx-calendar-panel-date"));
        if (!panels.length) panels = [popup];

        const leftPanel = panels[0];
        const rightPanel = panels.length > 1 ? panels[1] : null;

        // 1. Arahkan leftPanel ke bulan & tahun tanggal awal (sYear, sMonth)
        await navigatePanel(leftPanel, sYear, sMonth);
        await sleep(150);

        // 2. Klik tanggal awal pada leftPanel
        const sCell = findDayCell(leftPanel, sDay);
        if (!sCell) {
          return { ok: false, error: `Sel tanggal awal (${sDay}) tidak ditemukan di panel kalender bulan target` };
        }
        click(sCell);
        await sleep(250);

        // 3. Klik tanggal akhir
        if (sYear === eYear && sMonth === eMonth) {
          // Tanggal awal dan akhir berada di bulan & tahun yang sama (misal 10 Sep - 14 Sep)
          const eCell = findDayCell(leftPanel, eDay);
          if (eCell) {
            click(eCell);
            await sleep(250);
          } else {
            click(sCell);
            await sleep(250);
          }
        } else {
          // Tanggal akhir beda bulan
          let targetPanel = rightPanel;
          if (targetPanel) {
            await navigatePanel(targetPanel, eYear, eMonth);
            await sleep(150);
          } else {
            targetPanel = leftPanel;
            await navigatePanel(targetPanel, eYear, eMonth);
            await sleep(150);
          }

          const eCell = findDayCell(targetPanel, eDay);
          if (eCell) {
            click(eCell);
            await sleep(250);
          }
        }

        // 4. Tombol konfirmasi jika ada
        const confirmBtn = popup.querySelector(".mx-datepicker-btn-confirm, button.mx-btn-confirm, .mx-datepicker-footer button");
        if (confirmBtn && isVisible(confirmBtn)) {
          click(confirmBtn);
          await sleep(250);
        }

        // Tutup popup jika masih terbuka
        if (document.body.contains(popup) && isVisible(popup)) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
          await sleep(200);
        }

        // Tunggu rendering ulang data antrean
        await sleep(1500);

        const afterTextEl = picker.querySelector(".mx-input-wrapper .ml-4") || picker.querySelector(".mx-input-wrapper div") || picker.querySelector(".mx-input-wrapper input");
        const afterText = (afterTextEl?.value || afterTextEl?.textContent || "").trim();

        return {
          ok: true,
          before: curText,
          after: afterText,
          startDate: startStr,
          endDate: endStr
        };
      }
    });
    return res?.result || { ok: false, error: "Gagal mengeksekusi pengaturan tanggal" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const syncDateFilterFromWeb = readDateRangeFromCkgPage;
export const applyDateRangeToWeb = setDateRangeOnCkgPage;


