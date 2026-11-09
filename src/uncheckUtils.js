import { getUncheckConfig } from "./remoteConfig.js";
import { loadExamToggles, applyTogglesToUncheckKeywords } from "./examToggleConfig.js";

export async function runUncheckAll(tabId, fieldValues = {}, patientInfo = null) {
  const { keywords = [], partial = {}, conditionalExclusions = [] } = await getUncheckConfig();
  const examToggles = await loadExamToggles();

  // Filter keywords yang tidak boleh di-uncheck berdasarkan kondisi custom
  const baseKeywords = keywords.filter(kw => {
    const cond = conditionalExclusions.find(c => c.keyword === kw);
    if (!cond) return true;
    const exclusions = Array.isArray(cond.excludeWhen) ? cond.excludeWhen : [cond.excludeWhen];
    return !exclusions.some(({ field, in: vals }) => vals.includes(fieldValues[field]));
  });

  // Proteksi ganda: kata kunci skrining mandiri TIDAK BOLEH di-uncheck (wajib 100% diisi semua!)
  const MANDIRI_PROTECTED = [
    "pemeriksaan mandiri", "skrining mandiri", "jumlah pemeriksaan mandiri", "mandiri"
  ];
  const sanitizedBase = baseKeywords.filter(kw => 
    !MANDIRI_PROTECTED.some(p => String(kw).toLowerCase().includes(p))
  );

  // Sinkronkan dengan pengaturan ON/OFF pemeriksaan per siklus hidup (hanya berlaku untuk nakes)
  const activeKeywords = applyTogglesToUncheckKeywords(sanitizedBase, patientInfo || fieldValues, examToggles)
    .filter(kw => !MANDIRI_PROTECTED.some(p => String(kw).toLowerCase().includes(p)));

  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (keywordsToUncheck, partialConfig) => {
      const wait = ms => new Promise(resolve => {
        const start = performance.now();
        const ch = new MessageChannel();
        ch.port1.onmessage = () => {
          if (performance.now() - start >= ms) resolve();
          else ch.port2.postMessage(null);
        };
        ch.port2.postMessage(null);
      });

      // Pastikan semua accordion Pelayanan Nakes terbuka agar checkbox di dalamnya dapat diakses
      try {
        const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const mainArea = document.querySelector("section.relative.ml-64, main section:not(.fixed), div.w-full.mb-25") || document.querySelector("main") || document.body;
        const nakesRoot = mainArea.querySelector("#tableLayanan") || mainArea;
        const nakesHeaders = Array.from(nakesRoot.querySelectorAll("div.flex.items-center.justify-between.p-6, div.cursor-pointer")).filter(h => {
          if (h.closest(".table-pemeriksaan-mandiri, header, nav, aside")) return false;
          const t = clean(h.innerText || h.textContent || "");
          return t.includes("jumlah pemeriksaan") || /\/\s*\d+\s*selesai/i.test(t) || h.querySelector("img[src*='arrow-down'], svg[class*='-rotate-180'], svg[class*='rotate-180']");
        });
        for (const hdr of nakesHeaders) {
          const isCollapsed = !!hdr.querySelector("svg[class*='-rotate-180'], img[class*='-rotate-180'], [class*='-rotate-180']");
          if (isCollapsed) {
            try { hdr.click(); } catch (e) {}
            await wait(120);
          }
        }
      } catch (e) {}

      async function uncheckRow(checkbox) {
        if (!checkbox || !checkbox.checked) return;
        checkbox.click();
        await wait(250);

        // Cari tombol konfirmasi modal jika ada modal yang muncul
        const modalLimit = Date.now() + 1500;
        let confirmBtn = null;
        while (Date.now() < modalLimit) {
          const modals = Array.from(document.querySelectorAll(".fixed, div[role='dialog'], .modal, div.z-50, div.swal2-container"));
          for (const m of modals) {
            const btns = Array.from(m.querySelectorAll("button, div[role='button'], div.tracking-wide, a"));
            confirmBtn = btns.find(b => {
              const t = (b.innerText || b.textContent || '').trim().toLowerCase();
              return /^(ya|ya,\s*lewati|lewati|konfirmasi|ya,\s*simpan|simpan)$/i.test(t) || t.includes("lewati");
            }) || (m.querySelectorAll("div.tracking-wide").length >= 2 ? m.querySelectorAll("div.tracking-wide")[1] : null);
            if (confirmBtn) break;
          }
          if (confirmBtn) break;
          await wait(150);
        }

        if (confirmBtn) {
          try { confirmBtn.click(); } catch (e) {}
          await wait(400);

          // Klik tombol "Ok" / "Tutup" pada dialog sukses jika muncul
          const okBtn = Array.from(document.querySelectorAll("button, div[role='button']")).find(b => {
            const t = (b.textContent || b.innerText || '').trim().toLowerCase();
            return t === "ok" || t === "tutup" || t === "selesai";
          });
          if (okBtn) {
            try { okBtn.click(); } catch (e) {}
            await wait(250);
          }
        }
      }

      // Cari elemen judul/header pemeriksaan secara fleksibel
      const headerEls = Array.from(document.querySelectorAll(
        "[id^='rowfrm'] [class*='font-600'], [id^='rowfrm'] [class*='font-semibold'], [id^='rowfrm'] .col-span-2, .grid.grid-cols-5 .col-span-2, [class*='font-600'], [class*='font-semibold'], [class*='font-bold'], .col-span-2"
      )).filter(el => !el.closest("header, nav, aside, footer"));

      const matchedKeywords = headerEls
        .map(el => ({
          el,
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        }))
        .filter(({ text }) => keywordsToUncheck.some(kw => text.toLowerCase().includes(kw.toLowerCase())));

      const matchedPartial = headerEls
        .map(el => ({
          el,
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        }))
        .filter(({ text }) =>
          Object.keys(partialConfig).some(k => text.toLowerCase().includes(k.toLowerCase())) &&
          !keywordsToUncheck.some(kw => text.toLowerCase().includes(kw.toLowerCase()))
        );

      let processedCount = 0;
      const actuallyUnchecked = [];

      // Uncheck form penuh
      for (const { el, text } of matchedKeywords) {
        const row = el.closest('[id^="rowfrm"], .grid.grid-cols-5, .w-full.grid, tr') || el.parentElement;
        let cbs = row ? Array.from(row.querySelectorAll('input[type="checkbox"]')) : [];
        if (!cbs.length) {
          let parent = el.parentElement;
          while (parent && parent !== document.body && parent.tagName !== "MAIN") {
            const found = parent.querySelectorAll('input[type="checkbox"]');
            if (found.length > 0) {
              cbs = Array.from(found);
              break;
            }
            parent = parent.parentElement;
          }
        }

        const checkedBoxes = cbs.filter(cb => cb.checked);
        if (checkedBoxes.length > 0) {
          for (const cb of checkedBoxes) {
            await uncheckRow(cb);
          }
          processedCount++;
          if (text && !actuallyUnchecked.includes(text)) actuallyUnchecked.push(text);
        }
      }

      // Uncheck form parsial
      for (const { el, text } of matchedPartial) {
        const partialSubKeywords = Object.entries(partialConfig)
          .find(([k]) => text.toLowerCase().includes(k.toLowerCase()))?.[1] ?? [];

        let container = el.parentElement;
        while (container && container !== document.body && container.tagName !== "MAIN") {
          const spaceEl = container.querySelector(".space-y-2");
          if (spaceEl) {
            container = spaceEl;
            break;
          }
          container = container.parentElement;
        }

        const gridItems = Array.from(container.querySelectorAll(".grid.grid-cols-5"));
        for (const grid of gridItems) {
          const colEl = grid.querySelector(".col-span-2");
          const subText = (colEl?.innerText || colEl?.textContent || '').replace(/\s+/g, ' ').trim();
          if (!partialSubKeywords.some(sk => subText.toLowerCase().includes(sk.toLowerCase()))) continue;

          const cb = grid.querySelector('input[type="checkbox"]');
          if (cb && cb.checked) {
            await uncheckRow(cb);
            if (subText && !actuallyUnchecked.includes(subText)) actuallyUnchecked.push(subText);
          }
        }
        processedCount++;
      }

      return {
        total: matchedKeywords.length + matchedPartial.length,
        processed: processedCount,
        actuallyUnchecked
      };
    },
    args: [activeKeywords, partial]
  });

  const { total = 0, processed = 0, actuallyUnchecked = [] } = res?.result ?? {};
  return { total, processed, skippedKeywords: actuallyUnchecked };
}