// Modul Penyelesaian Pelayanan CKG (Direct Flow tanpa reload mengganggu state)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function execInTab(tabId, func, args = [], maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) throw new Error("Tab tidak ditemukan atau telah ditutup");

      if (tab.status === "loading") {
        await sleep(800);
        continue;
      }

      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func,
        args
      });
      return res?.result;
    } catch (err) {
      const msg = err.message || "";
      const isNavError = /context|frame|navigat|loading|target closed|pre-rendering/i.test(msg);
      if (isNavError && attempt < maxRetries - 1) {
        await sleep(1000);
        continue;
      }
      throw err;
    }
  }
}

export async function selesaikanLayanan(tabId, { report = () => {}, requireAllCompleted = false, patientInfo = null } = {}) {
  report("Mencari tombol Selesaikan Layanan / Pelayanan di halaman pasien...");

  let res = null;
  try {
    res = await execInTab(tabId, async (requireAllCompleted, patientInfo) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const clean = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

    const triggerClick = el => {
      if (!el) return;
      const target = el.closest("button, a, [role='button'], input[type='button'], div.cursor-pointer, .btn") || el;
      target.focus?.();
      const opts = { bubbles: true, cancelable: true, view: window };
      try { target.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch(e) {}
      try { target.dispatchEvent(new MouseEvent("mousedown", opts)); } catch(e) {}
      try { target.dispatchEvent(new PointerEvent("pointerup", opts)); } catch(e) {}
      try { target.dispatchEvent(new MouseEvent("mouseup", opts)); } catch(e) {}
      try { target.dispatchEvent(new MouseEvent("click", opts)); } catch(e) {}
      if (typeof target.click === "function") {
        try { target.click(); } catch(e) {}
      }
    };

    const isSekolah = window.location.href.includes("sekolah");
    const targetQueue = isSekolah
      ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah?back=true"
      : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan";

    // 0. Sinkronisasi & backup filter Nuxt sebelum penyelesaian agar antrean tidak ter-reset
    if (isSekolah) {
      try {
        const backupFilter = localStorage.getItem("ckg_backup_filter_pelayanan") || sessionStorage.getItem("ckg_backup_filter_pelayanan");
        const backupTab = localStorage.getItem("ckg_backup_active_tab") || sessionStorage.getItem("ckg_backup_active_tab");
        if (backupFilter && backupFilter.includes("school")) {
          localStorage.setItem("currentFilterPelayanan", backupFilter);
          localStorage.setItem("filterPelayanan", backupFilter);
          if (backupTab) localStorage.setItem("activeTab", backupTab);
        }
      } catch (e) {}
    } else {
      try {
        const backupFilterUmum = localStorage.getItem("ckg_backup_filter_pelayanan_umum") || sessionStorage.getItem("ckg_backup_filter_pelayanan_umum");
        const backupTabUmum = localStorage.getItem("ckg_backup_active_tab_umum") || sessionStorage.getItem("ckg_backup_active_tab_umum");
        if (backupFilterUmum) {
          localStorage.setItem("currentFilterPelayanan", backupFilterUmum);
          localStorage.setItem("filterPelayanan", backupFilterUmum);
        }
        if (backupTabUmum) localStorage.setItem("activeTab", backupTabUmum);
      } catch (e) {}
    }

    // 1. Tunggu sejenak agar request simpan form terakhir tuntas diproses oleh Vue
    await wait(600);

    // 2. Tutup modal konfirmasi tanggal jika masih terbuka (hanya modal fixed/dialog asli)
    try {
      const dateModal = Array.from(document.querySelectorAll("div.fixed, div[role='dialog'], .modal, .swal2-popup, div.z-2000, div.z-50")).find(m => {
        return clean(m.innerText || "").includes("konfirmasi tanggal pemeriksaan");
      });
      if (dateModal) {
        const wantDay = String(new Date().getDate());
        const dayCells = Array.from(dateModal.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, button")).filter(cell => {
          const txt = clean(cell.innerText || cell.textContent || "");
          return txt === wantDay && !cell.classList.contains("text-gray-300");
        });
        if (dayCells.length > 0) {
          triggerClick(dayCells[0]);
          await wait(200);
        } else {
          const todayCell = dateModal.querySelector("td.today, td.current, td.active, .mx-date-row td.today, button.relative.h-auto");
          if (todayCell) triggerClick(todayCell);
        }
        const simpanBtn = Array.from(dateModal.querySelectorAll("button, a, [role='button']")).find(b => {
          if (b.disabled || b.classList.contains("cursor-not-allowed")) return false;
          const t = clean(b.innerText || "");
          return t.includes("simpan") && !t.includes("batal");
        });
        if (simpanBtn) {
          triggerClick(simpanBtn);
          await wait(600);
        }
      }
    } catch(e) {}

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

    // 2.5. Verifikasi Pemeriksaan Mandiri & Nakes (Advisory, tidak memblokir tombol Selesaikan Layanan jika sudah aktif)
    try {
      const mandiriRows = Array.from(document.querySelectorAll(".table-pemeriksaan-mandiri tr")).filter(r => r.querySelector("button, a"));
      const uncompletedMandiri = mandiriRows.filter(r => {
        if (isRowCompleted(r)) return false;
        const cb = r.querySelector("input[type='checkbox']");
        if (cb && !cb.checked) return false;
        return true;
      });
      if (uncompletedMandiri.length > 0) {
        console.warn(`[SelesaiLayanan] Info: ${uncompletedMandiri.length} formulir mandiri belum terisi penuh.`);
      }
    } catch(e) {}

    // 3. Cari tombol Selesaikan Layanan / Pelayanan
    const findFinishBtn = () => {
      // Ambil semua button dan elemen interaktif
      const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], a.btn, a[role='button']"));

      // 3a. Prioritas Utama: <button> dengan teks persis "selesaikan layanan", "selesaikan pelayanan", dll
      const exactBtn = buttons.find(b => {
        if (b.closest(".mx-datepicker, .mx-calendar, tbody tr, ol, ul")) return false;
        const txt = clean(b.innerText || b.textContent || "");
        return (
          txt === "selesaikan layanan" ||
          txt === "selesaikan pelayanan" ||
          txt === "selesaikan pemeriksaan" ||
          txt === "selesai layanan" ||
          txt === "selesai pelayanan" ||
          txt === "selesai pemeriksaan" ||
          txt === "simpan pelayanan" ||
          txt === "simpan pemeriksaan" ||
          txt === "simpan & selesai" ||
          txt === "simpan dan selesai" ||
          txt === "selesaikan"
        );
      });
      if (exactBtn) return exactBtn;

      // 3b. Prioritas Kedua: <button> yang mengandung frasa selesaikan
      const phraseBtn = buttons.find(b => {
        if (b.closest(".mx-datepicker, .mx-calendar, tbody tr, ol, ul, nav[aria-label='breadcrumb']")) return false;
        const txt = clean(b.innerText || b.textContent || "");
        if (/^(keluar|logout|batal|cancel|kembali|tutup|panduan|lihat|detail|cetak|ckg|klaster|sarana)/i.test(txt)) return false;
        return (
          txt.includes("selesaikan layanan") ||
          txt.includes("selesaikan pelayanan") ||
          txt.includes("selesai layanan") ||
          txt.includes("selesai pelayanan") ||
          txt.includes("selesaikan pemeriksaan") ||
          txt.includes("selesai pemeriksaan") ||
          (/(selesai|selesaikan|simpan)\s+(layanan|pelayanan|pemeriksaan)/i.test(txt))
        );
      });
      if (phraseBtn) return phraseBtn;

      // 3c. Prioritas Ketiga: Button dengan gaya red / danger / primary outline yang bertuliskan selesai
      const styledBtn = buttons.find(b => {
        if (b.closest(".mx-datepicker, .mx-calendar, tbody tr, ol, ul")) return false;
        const txt = clean(b.innerText || b.textContent || "");
        if (/^(keluar|logout|batal|cancel|kembali|tutup|panduan|lihat|detail|cetak|ckg)/i.test(txt)) return false;
        const hasStyled = b.className.includes("red") || b.className.includes("danger") ||
                          b.className.includes("primary") || b.className.includes("#009b90");
        return hasStyled && (txt.includes("selesai") || txt.includes("selesaikan"));
      });
      if (styledBtn) return styledBtn;

      // 3d. Fallback: Cari elemen leaf apapun yang memiliki teks persis "selesaikan layanan"
      const leafMatch = Array.from(document.querySelectorAll("div, span, p, a")).find(el => {
        if (el.children.length > 2) return false;
        if (el.closest(".mx-datepicker, .mx-calendar, tbody tr, ol, ul, [class*='stepper']")) return false;
        const txt = clean(el.innerText || el.textContent || "");
        return (
          txt === "selesaikan layanan" ||
          txt === "selesaikan pelayanan" ||
          txt === "selesaikan pemeriksaan"
        );
      });
      if (leafMatch) {
        return leafMatch.closest("button, a, [role='button']") || leafMatch;
      }

      return null;
    };

    let finishBtn = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (attempt % 2 === 1) {
        window.scrollTo(0, document.body.scrollHeight || 10000);
      } else {
        window.scrollTo(0, 0);
      }
      await wait(150);
      finishBtn = findFinishBtn();
      if (finishBtn) break;
      await wait(250);
    }

    if (!finishBtn) {
      return { ok: false, reason: "Tombol 'Selesaikan Layanan' tidak ditemukan pada halaman" };
    }

    // PENTING: Jangan pernah memaksa membuka status disabled pada tombol Selesaikan Layanan!
    // Jika tombol masih disabled dari server/Vue (misal request simpan form terakhir masih in-flight
    // atau ada pemeriksaan Nakes yang di-skip namun checkbox-nya belum ter-uncheck),
    // tunggu 3 detik, lalu otomatis uncheck baris Nakes yang belum selesai & masih tercentang.
    const isBtnDisabled = btn => !btn || btn.disabled || btn.getAttribute("disabled") !== null || btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("cursor-not-allowed");

    if (isBtnDisabled(finishBtn)) {
      for (let w = 0; w < 6; w++) {
        await wait(500);
        finishBtn = findFinishBtn() || finishBtn;
        if (!isBtnDisabled(finishBtn)) break;
      }

      if (isBtnDisabled(finishBtn)) {
        // Buka semua accordion Pelayanan Nakes dan uncheck baris Nakes yang belum selesai namun masih tercentang
        try {
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
              await wait(150);
            }
          }

          const nakesRows = Array.from(nakesRoot.querySelectorAll("[id^='rowfrm'], .w-full.grid.gap-2:is(.grid-cols-4, .grid-cols-5), tbody tr")).filter(r => {
            if (r.closest(".table-pemeriksaan-mandiri, header, nav, aside")) return false;
            return !!r.querySelector("input[type='checkbox']");
          });

          for (const row of nakesRows) {
            if (isRowCompleted(row)) continue;
            const cb = row.querySelector("input[type='checkbox']");
            if (!cb || !cb.checked || cb.disabled) continue;

            try { cb.scrollIntoView({ block: "center", behavior: "instant" }); } catch (e) {}
            await wait(100);
            cb.click();
            await wait(300);

            // Konfirmasi modal lewati/uncheck jika muncul
            for (let mPoll = 0; mPoll < 10; mPoll++) {
              const modals = Array.from(document.querySelectorAll(".fixed, div[role='dialog'], .modal, div.z-50, div.swal2-container"));
              let uncheckConfirm = null;
              for (const m of modals) {
                const btns = Array.from(m.querySelectorAll("button, div[role='button'], div.tracking-wide, a"));
                uncheckConfirm = btns.find(b => {
                  const t = clean(b.innerText || b.textContent || "");
                  return /^(ya|ya,\s*lewati|lewati|konfirmasi|ya,\s*simpan|simpan)$/i.test(t) || t.includes("lewati");
                }) || (m.querySelectorAll("div.tracking-wide").length >= 2 ? m.querySelectorAll("div.tracking-wide")[1] : null);
                if (uncheckConfirm) break;
              }
              if (uncheckConfirm) {
                triggerClick(uncheckConfirm);
                await wait(450);
                const okBtn = Array.from(document.querySelectorAll("button, div[role='button']")).find(b => {
                  const t = clean(b.textContent || b.innerText || "");
                  return t === "ok" || t === "tutup" || t === "selesai";
                });
                if (okBtn) {
                  triggerClick(okBtn);
                  await wait(250);
                }
                break;
              }
              await wait(150);
            }
          }
        } catch (e) {}

        for (let w = 0; w < 10; w++) {
          await wait(500);
          finishBtn = findFinishBtn() || finishBtn;
          if (!isBtnDisabled(finishBtn)) break;
        }
      }

      if (isBtnDisabled(finishBtn)) {
        return { ok: false, reason: "Tombol 'Selesaikan Layanan' masih nonaktif (disabled) karena ada pemeriksaan yang belum lengkap" };
      }
    }

    // 4. Klik tombol Selesaikan Layanan
    finishBtn.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    await wait(350);
    triggerClick(finishBtn);
    await wait(700);

    // 5. Konfirmasi modal ("Yakin ingin menyelesaikan pelayanan?", "Data pemeriksaan akan dikunci")
    let confirmBtn = null;
    let clickedConfirm = false;
    let blockingErrorMessage = null;

    for (let attempt = 0; attempt < 35; attempt++) {
      await wait(250);

      if (!window.location.href.includes("detail-pemeriksaan")) {
        clickedConfirm = true;
        break;
      }

      // Jika di percobaan ke-8 atau ke-18 modal belum muncul, klik ulang finishBtn
      if ((attempt === 8 || attempt === 18) && !confirmBtn) {
        const retryFinish = findFinishBtn();
        if (retryFinish && !isBtnDisabled(retryFinish)) {
          try { retryFinish.scrollIntoView({ block: "center", behavior: "instant" }); } catch (e) {}
          triggerClick(retryFinish);
          await wait(400);
        }
      }

      // 5a. Cek apakah ada popup peringatan validasi SweetAlert2 ("Ada data yang belum diisi")
      const swalTextEl = document.querySelector(".swal2-html-container, .swal2-content, div[role='dialog'] .text-sm, div[role='dialog'] p");
      const alertMsg = clean(swalTextEl?.innerText || swalTextEl?.textContent || "");
      if (alertMsg.includes("belum diisi") || alertMsg.includes("wajib diisi") || alertMsg.includes("tidak lengkap") || alertMsg.includes("harus diisi")) {
        blockingErrorMessage = alertMsg;
        const closeAlertBtn = document.querySelector(".swal2-confirm, .swal2-close, button.btn-fill-primary");
        if (closeAlertBtn) triggerClick(closeAlertBtn);
        await wait(500);
        break;
      }

      // 5b. SweetAlert2 confirm button
      const swalConfirm = document.querySelector(".swal2-confirm, button.swal2-confirm");
      if (swalConfirm && swalConfirm.offsetParent !== null) {
        triggerClick(swalConfirm);
        clickedConfirm = true;
        await wait(1500);
        break;
      }

      // 5c. Cari dialog/modal yang sedang terbuka di layar
      const modalContainers = Array.from(document.querySelectorAll("div.fixed, div[role='dialog'], div[aria-modal='true'], .modal, div.swal2-popup, div[class*='z-']")).filter(m => {
        if (m === document.body || m.closest("aside, [class*='sidebar'], header, nav")) return false;
        try {
          const style = window.getComputedStyle(m);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        } catch(e) {
          return true;
        }
      });

      for (const modal of modalContainers) {
        const modalButtons = Array.from(modal.querySelectorAll("button, a, [role='button'], div.cursor-pointer, div.tracking-wide")).filter(b => {
          if (b === finishBtn) return false;
          const t = clean(b.innerText || b.textContent || "");
          if (!t) return false;
          // Abaikan tombol batal / tutup / tidak
          if (/^(batal|cancel|tidak|kembali|tutup|close|x)$/i.test(t)) return false;
          return true;
        });

        // Cari tombol aksi konfirmasi: "Ya, Selesaikan", "Selesaikan Layanan", "Konfirmasi", dll
        const foundConfirm = modalButtons.find(b => {
          const t = clean(b.innerText || b.textContent || "");
          return (
            t === "ya, selesaikan" ||
            t === "ya, selesaikan layanan" ||
            t === "ya, selesaikan pelayanan" ||
            t === "selesaikan layanan" ||
            t === "selesaikan pelayanan" ||
            t === "selesaikan" ||
            t === "ya, simpan" ||
            t === "ya, lanjutkan" ||
            t === "ya, konfirmasi" ||
            t === "ya, yakin" ||
            t === "ya, kunci" ||
            t === "konfirmasi" ||
            t === "simpan" ||
            t === "yakin" ||
            t === "ya" ||
            t.startsWith("ya,") ||
            t.startsWith("ya ") ||
            t.includes("selesaikan") ||
            t.includes("konfirmasi") ||
            b.classList.contains("btn-fill-primary") ||
            b.classList.contains("bg-primary") ||
            b.classList.contains("bg-[#009b90]") ||
            b.className.includes("danger") ||
            b.className.includes("red")
          );
        }) || (modalButtons.length === 1 ? modalButtons[0] : null);

        if (foundConfirm) {
          confirmBtn = foundConfirm;
          break;
        }
      }

      if (confirmBtn) {
        triggerClick(confirmBtn);
        clickedConfirm = true;
        await wait(600);
        break;
      }
    }

    if (blockingErrorMessage) {
      return { ok: false, reason: `Pemeriksaan belum dapat diselesaikan: ${blockingErrorMessage}` };
    }

    if (!clickedConfirm) {
      return { ok: false, reason: "Dialog konfirmasi 'Selesaikan Layanan' tidak muncul atau gagal diklik" };
    }

    // 6. Tunggu request API penyelesaian pelayanan tuntas di server Kemkes (minimal ~1.8 detik, maksimal ~6 detik)
    // Jangan langsung navigasi kembali ke antrean sebelum server selesai mengunci pelayanan!
    const postConfirmStart = Date.now();
    for (let okPoll = 0; okPoll < 20; okPoll++) {
      if (!window.location.href.includes("detail-pemeriksaan")) break;

      const okBtns = Array.from(document.querySelectorAll("button, a, div[role='button'], .swal2-confirm")).filter(b => {
        const t = clean(b.innerText || b.textContent || "");
        const isInModal = !!b.closest("div.fixed, div[role='dialog'], .modal, div.swal2-popup, div[class*='z-']");
        return isInModal && /^(ok|tutup|kembali|selesai|mengerti|ya)$/i.test(t);
      });
      if (okBtns.length > 0) {
        for (const ok of okBtns) {
          try { triggerClick(ok); } catch(e) {}
        }
        await wait(600);
        break;
      }

      const elapsed = Date.now() - postConfirmStart;
      if (elapsed >= 1800) {
        const stillHasFinishBtn = findFinishBtn();
        const activeModal = Array.from(document.querySelectorAll("div.fixed, div[role='dialog'], .modal, div.swal2-popup")).some(m => {
          if (m === document.body || m.closest("aside, header, nav")) return false;
          const txt = clean(m.innerText || "");
          return txt.includes("yakin ingin menyelesaikan") || txt.includes("dikunci");
        });
        if (!stillHasFinishBtn || !activeModal) {
          await wait(400);
          break;
        }
      }
      await wait(300);
    }

    // 7. Coba kembali ke antrean secara SPA jika tombol navigasi breadcrumb / header tersedia
    if (window.location.href.includes("detail-pemeriksaan")) {
      const backBtn = Array.from(document.querySelectorAll("nav a, .breadcrumb a, a, button, div.cursor-pointer, span.cursor-pointer")).find(el => {
        const t = clean(el.innerText || el.textContent || "");
        const h = (el.getAttribute("href") || "").toLowerCase();
        return h.includes("ckg-pelayanan") || t === "pelayanan" || (t.includes("cek kesehatan gratis") && el.closest("header, nav, div.flex")) || t.startsWith("<");
      });
      if (backBtn) {
        triggerClick(backBtn);
        for (let i = 0; i < 6; i++) {
          if (!window.location.href.includes("detail-pemeriksaan")) break;
          await wait(150);
        }
      }
    }

    // Kembalikan status ke caller di background script agar tab dinavigasikan dengan cepat & aman
    return {
      ok: true,
      clickedConfirm: true,
      isAtQueue: !window.location.href.includes("detail-pemeriksaan"),
      targetQueue
    };
  }, [requireAllCompleted, patientInfo]);

  } catch (err) {
    const msg = err.message || "";
    if (/context|navigat|destroy|target closed/i.test(msg)) {
      await sleep(400);
      const curTab = await chrome.tabs.get(tabId).catch(() => null);
      if (curTab && !curTab.url.includes("detail-pemeriksaan")) {
        report(`✓ Pelayanan berhasil diselesaikan (halaman kembali ke antrean).`);
        return { ok: true, status: "completed", clickedConfirm: true };
      }
    }
    report(`⚠️ Selesaikan layanan: ${err.message}`);
    return { ok: false, reason: err.message };
  }

  // Jika execInTab berhasil mengonfirmasi penyelesaian pelayanan
  if (res?.ok || res?.clickedConfirm) {
    report(`✓ Pelayanan berhasil diselesaikan!`);

    // Jika tab masih di halaman detail pemeriksaan, kembalikan ke antrean via chrome.tabs.update
    const curTab = await chrome.tabs.get(tabId).catch(() => null);
    if (curTab?.url && curTab.url.includes("detail-pemeriksaan")) {
      report("Mengalihkan tab kembali ke halaman antrean pelayanan...");
      const isSek = Boolean(curTab.url.includes("sekolah"));
      const targetUrl = res?.targetQueue || (isSek
        ? "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan-sekolah?back=true"
        : "https://sehatindonesiaku.kemkes.go.id/ckg-pelayanan");
      await chrome.tabs.update(tabId, { url: targetUrl });
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await sleep(200);
        const t = await chrome.tabs.get(tabId).catch(() => null);
        if (t?.status === "complete" && !t.url.includes("detail-pemeriksaan")) break;
      }
      await sleep(200);
    }

    return { ok: true, status: "completed", clickedConfirm: true };
  } else {
    report(`⚠️ Selesaikan layanan: ${res?.reason || "Gagal mengonfirmasi"}`);
    return { ok: false, reason: res?.reason };
  }
}