// Otomasi Alur Pelayanan Instan (Pencarian NIK, Sekolah/Kelas, Buka Pemeriksaan & Set Kalender via Chrome Debugger)

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function getMonthIndex(monthStr) {
  const norm = (monthStr || "").trim().toLowerCase();
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === norm);
  if (idx >= 0) return idx;
  if (norm === "agu" || norm === "agt" || norm === "aug") return 7;
  return -1;
}

function sendDebuggerCommand(target, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, result => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

async function evalExpression(target, expression) {
  const { result, exceptionDetails } = await sendDebuggerCommand(target, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text || "Runtime evaluate error");
  }
  return result?.value;
}

async function getElementCenter(target, elementFinderExpression) {
  return await evalExpression(target, `
    (() => {
      const el = (${elementFinderExpression})();
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()
  `);
}

async function waitForElementCenter(target, elementFinderExpression, timeout = 15000, interval = 300, signal) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (signal?.aborted) throw new Error("Automation was stopped");
    const center = await getElementCenter(target, elementFinderExpression);
    if (center) return center;
    await sleep(interval);
  }
  throw new Error("Timeout menunggu elemen: " + elementFinderExpression.slice(0, 60));
}

async function dispatchClick(target, { x, y }) {
  const point = { x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 };
  await sendDebuggerCommand(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await sendDebuggerCommand(target, "Input.dispatchMouseEvent", { type: "mousePressed", ...point });
  await sendDebuggerCommand(target, "Input.dispatchMouseEvent", { type: "mouseReleased", ...point });
}

async function clickElement(target, elementFinderExpression) {
  const center = await waitForElementCenter(target, elementFinderExpression);
  await dispatchClick(target, center);
  await sleep(300);
}

const SELECTORS = {
  dropdownTrigger: `() => {
    const isCriteria = s => /^(nama|nomor\\s*tiket|no\\.?\\s*tiket|tiket|nik|mitra)$/i.test((s || '').trim().toLowerCase().replace(/\\s+/g, ' '));
    const baseInp = document.querySelector('input#searchNik, input#nik, input[placeholder*="Masukkan"], input[placeholder*="Cari" i], input[type="search"]');
    if (baseInp) {
      let curr = baseInp.parentElement;
      for (let lvl = 0; lvl < 5 && curr && curr !== document.body; lvl++) {
        const cands = Array.from(curr.querySelectorAll('button, [role="combobox"], [role="button"], div.cursor-pointer, span.line-clamp-2')).filter(el => {
          if (el.contains(baseInp) || el === baseInp || el.tagName === 'INPUT') return false;
          if (el.closest('table, tbody, thead, .mx-datepicker, nav, aside, header')) return false;
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return isCriteria(t);
        });
        if (cands.length > 0) return cands[0].closest('button, [role="combobox"], div.cursor-pointer') || cands[0];
        curr = curr.parentElement;
      }
    }
    const lineClamps = Array.from(document.querySelectorAll('span.line-clamp-2')).filter(el => {
      if (el.closest('table, thead, tbody, .mx-datepicker, aside, header, nav')) return false;
      return isCriteria(el.innerText || el.textContent || '');
    });
    if (lineClamps.length > 0) return lineClamps[0].closest('.cursor-pointer, button') || lineClamps[0];
    return Array.from(document.querySelectorAll('.cursor-pointer, button')).find(el => {
      if (el.closest('table, thead, tbody, .mx-datepicker, aside, header, nav')) return false;
      return isCriteria(el.innerText || el.textContent || '');
    }) || null;
  }`,
  opsiNIK: `() => (
    Array.from(document.querySelectorAll('div, li, span')).find(d => (d.textContent || '').trim() === 'NIK' && (d.children.length === 0 || d.classList.contains('cursor-pointer'))) ||
    Array.from(document.querySelectorAll('div.cursor-pointer')).find(d => (d.textContent || '').trim() === 'NIK')
  )`,
  opsiNomorTiket: `() => (
    Array.from(document.querySelectorAll('div, li, span, [role="option"]')).find(d => {
      const t = (d.textContent || '').trim().toLowerCase();
      return (t.includes('nomor tiket') || t.includes('tiket') || t.includes('ticket')) && (d.children.length === 0 || d.classList.contains('cursor-pointer'));
    }) ||
    Array.from(document.querySelectorAll('div.cursor-pointer')).find(d => (d.textContent || '').trim().toLowerCase().includes('tiket'))
  )`,
  searchInput: `() => document.querySelector('input[placeholder*="Masukkan"], input[placeholder*="Cari" i], input[type="search"], input[type="text"]')`,
  btnMulaiBaris: `() => {
    const tr = document.querySelector('tbody tr');
    return tr ? Array.from(tr.querySelectorAll('button, a')).find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return (t === 'mulai' || t === 'pemeriksaan' || t.includes('mulai')) && !b.disabled;
    }) : null;
  }`,
  btnMulaiPemeriksaan: `() => Array.from(document.querySelectorAll('button')).find(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    return (t === 'mulai pemeriksaan' || t.includes('mulai pemeriksaan')) && !b.disabled;
  })`,
  modalKonfirmasi: `() => Array.from(document.querySelectorAll('div')).find(el => (el.textContent || '').includes('Konfirmasi Tanggal Pemeriksaan'))`,
  btnSimpan: `() => Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().toLowerCase() === 'simpan' && !b.disabled)`,
  calHeaderText: `() => {
    const el = Array.from(document.querySelectorAll('div.flex.items-center')).find(e =>
      e.children.length === 2 && /^(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Ag[tu]|Sep|Okt|Nov|Des)\\d{4}$/.test((e.textContent || '').replace(/\\s+/g, ''))
    );
    if (!el) return '';
    const m = (el.textContent || '').replace(/\\s+/g, '').match(/^([A-Za-z]{3})(\\d{4})$/);
    return m ? (m[1] + ' ' + m[2]) : '';
  }`,
  navContainer: `() => {
    const el = Array.from(document.querySelectorAll('div.flex.items-center')).find(e =>
      e.children.length === 2 && /^(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Ag[tu]|Sep|Okt|Nov|Des)\\d{4}$/.test((e.textContent || '').replace(/\\s+/g, ''))
    );
    return el ? el.parentElement.querySelector('div.flex.items-center.justify-center') : null;
  }`,
  sekolahDropdownTrigger: `() => {
    // 1. Cari label / teks bertuliskan 'Sekolah'
    const label = Array.from(document.querySelectorAll('label, div.font-semibold, div.font-500, span.font-semibold, p')).find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      return t === 'sekolah' || t === 'sekolah *' || t === 'pilih sekolah' || t === 'nama sekolah';
    });
    if (label) {
      const container = label.closest('.flex, .grid, .mb-4, div') || label.parentElement;
      const trig = container?.querySelector('.cursor-pointer, input, button, select') || label.nextElementSibling?.querySelector('.cursor-pointer, input, button') || label.nextElementSibling;
      if (trig) return trig;
    }

    // 2. Cari input / elemen dengan placeholder Sekolah
    const ph = document.querySelector('input[placeholder*="Sekolah" i], [aria-label*="Sekolah" i], [name="sekolah"], #sekolah');
    if (ph) return ph.closest('.cursor-pointer') || ph;

    // 3. Cari dari card filter
    const card = Array.from(document.querySelectorAll('div.bg-white, form, div.border')).find(d => {
      const t = (d.textContent || '').toLowerCase();
      return t.includes('filter sekolah') || t.includes('pilih sekolah');
    });
    if (card) {
      const cols = Array.from(card.querySelectorAll('div.cursor-pointer, input, button')).filter(el => {
        const txt = (el.innerText || el.textContent || el.placeholder || '').toLowerCase();
        return !txt.includes('tampilkan') && !txt.includes('cari');
      });
      if (cols.length > 0) return cols[0];
    }

    return document.querySelector('#sekolah, [name="sekolah"], [placeholder*="Sekolah" i]');
  }`,
  kelasDropdownTrigger: `() => {
    // 0. Tombol / elemen dengan teks 'Pilih Kelas', 'Kelas', 'Tingkat'
    const trigText = Array.from(document.querySelectorAll('div.cursor-pointer, span.cursor-pointer, button, [role="combobox"]')).find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      return t === 'pilih kelas' || t.startsWith('pilih kelas') || t === 'kelas' || t.startsWith('kelas ');
    });
    if (trigText) return trigText;

    // 1. Cari label / teks bertuliskan 'Kelas'
    const label = Array.from(document.querySelectorAll('label, div.font-semibold, div.font-500, span.font-semibold, p')).find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      return t === 'kelas' || t === 'kelas *' || t === 'pilih kelas' || t === 'tingkat / kelas' || t === 'jenjang / kelas';
    });
    if (label) {
      const container = label.closest('.form-group, .mb-4, .space-y-2, .grid, .flex, div') || label.parentElement;
      const trig = container?.querySelector('.cursor-pointer, input, button, select') || label.nextElementSibling?.querySelector('.cursor-pointer, input, button') || label.nextElementSibling;
      if (trig) return trig;
    }

    // 2. Cari input / elemen dengan placeholder Kelas
    const ph = document.querySelector('input[placeholder*="Kelas" i], [aria-label*="Kelas" i], [name="kelas"], #kelas');
    if (ph) return ph.closest('.cursor-pointer') || ph;

    // 3. Cari dari card filter
    const card = Array.from(document.querySelectorAll('div.bg-white, form, div.border')).find(d => {
      const t = (d.textContent || '').toLowerCase();
      return t.includes('filter sekolah') || t.includes('pilih sekolah');
    });
    if (card) {
      const cols = Array.from(card.querySelectorAll('div.cursor-pointer, input, button')).filter(el => {
        const txt = (el.innerText || el.textContent || el.placeholder || '').toLowerCase();
        return !txt.includes('tampilkan') && !txt.includes('cari');
      });
      if (cols.length > 1) return cols[1];
    }

    return document.querySelector('#kelas, [name="kelas"], [placeholder*="Kelas" i]');
  }`,
  btnTampilkanPencarian: `() => Array.from(document.querySelectorAll('button, div.cursor-pointer')).find(b => {
    const t = (b.textContent || b.innerText || '').trim().toLowerCase();
    return (t.includes('tampilkan pencarian') || t.includes('cari')) && !b.disabled;
  })`
};

function tabItemSelector(tabName) {
  return `() => Array.from(document.querySelectorAll('div.cursor-pointer.px-3, div.cursor-pointer, [role="tab"]')).find(d =>
    (d.textContent || '').trim().toLowerCase().startsWith('${tabName.toLowerCase()}')
  )`;
}

async function selectSekolahDanKelas(debuggerSession, { sekolah, kelas }, onLog, signal) {
  const selectDropdownOption = async (triggerFinder, targetValue, fieldName) => {
    onLog(`Pilih ${fieldName} (${targetValue || "Otomatis"})...`);

    try {
      await clickElement(debuggerSession, triggerFinder);
    } catch (e) {
      onLog(`Peringatan: Gagal klik dropdown ${fieldName}: ${e.message}`);
      return;
    }
    await sleep(700);

    const targetNorm = targetValue ? String(targetValue).trim().toLowerCase() : "";
    const targetDigits = targetNorm.replace(/[^0-9]/g, '');

    const optionFinderExpr = `
      (() => {
        const want = "${targetNorm}";
        const wantDigits = "${targetDigits}";

        const candidates = Array.from(document.querySelectorAll(
          'li, div.cursor-pointer, [role="option"], div[class*="option"], div[class*="dropdown-item"], span.cursor-pointer, div.px-3'
        )).filter(el => {
          if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
          const txt = (el.textContent || '').trim().toLowerCase();
          return txt.length > 0 && txt.length < 80;
        });

        const norm = s => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();

        let matched = null;
        if (want) {
          // 1. Exact match
          matched = candidates.find(el => norm(el.textContent) === want);

          // 2. Prefiks "Kelas " atau "Tingkat "
          if (!matched) {
            matched = candidates.find(el => {
              const txt = norm(el.textContent);
              return txt === ("kelas " + want) || ("kelas " + txt) === want || txt === ("tingkat " + want);
            });
          }

          // 3. Match digit / angka kelas
          if (!matched && wantDigits) {
            matched = candidates.find(el => {
              const txt = norm(el.textContent);
              const digits = txt.replace(/[^0-9]/g, '');
              return digits === wantDigits;
            });
          }

          // 3b. Match angka Romawi (contoh: 11 <-> XI, Kelas 11 <-> Kelas XI)
          const romanMap = { "1":"i","2":"ii","3":"iii","4":"iv","5":"v","6":"vi","7":"vii","8":"viii","9":"ix","10":"x","11":"xi","12":"xii" };
          const wantRom = romanMap[wantDigits] || "";
          if (!matched && wantRom) {
            matched = candidates.find(el => {
              const txt = norm(el.textContent);
              const r = romanMap[txt.replace(/[^0-9]/g, '')] || txt.replace(/[^a-z]/g, '');
              return txt === wantRom || txt === ("kelas " + wantRom) || r === wantRom;
            });
          }

          // 4. StartsWith atau includes (dengan batas kata jika digit)
          if (!matched) {
            matched = candidates.find(el => {
              const txt = norm(el.textContent);
              if (wantDigits && new RegExp('\\\\b' + wantDigits + '\\\\b').test(txt)) return true;
              return (want.length >= 3 && txt.includes(want)) || (txt.length >= 3 && want.includes(txt));
            });
          }
        }

        // 5. Fallback HANYA jika memang TIDAK ADA target kelas (jangan paksa Kelas 10 jika user minta kelas lain)
        if (!matched && !want && candidates.length > 0) {
          matched = candidates.find(el => {
            const txt = norm(el.textContent);
            return !txt.includes("pilih") && !txt.includes("batal");
          }) || candidates[0];
        }

        if (!matched) return null;

        matched.scrollIntoView({ block: 'center', inline: 'center' });
        const r = matched.getBoundingClientRect();
        return (r.width > 0 && r.height > 0) ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      })()
    `;

    let optionCoord = null;
    for (let poll = 0; poll < 8; poll++) {
      if (signal?.aborted) return;
      optionCoord = await evalExpression(debuggerSession, optionFinderExpr);
      if (optionCoord) break;
      await sleep(350);
    }

    if (optionCoord) {
      await dispatchClick(debuggerSession, optionCoord);
      await sleep(500);
    } else {
      onLog(`⚠️ Opsi untuk ${fieldName} tidak ditemukan langsung, menutup dropdown.`);
      try { await clickElement(debuggerSession, triggerFinder); } catch (e) {}
      await sleep(300);
    }
  };

  // 0. Ambil sekolah dan kelas tersimpan dari storage jika parameter belum terisi
  let targetSekolah = sekolah;
  let targetKelas = kelas;
  try {
    const stored = await chrome.storage.local.get(["ckg_saved_school", "ckg_saved_class"]);
    if (!targetSekolah && stored.ckg_saved_school) targetSekolah = stored.ckg_saved_school;
    if (!targetKelas && stored.ckg_saved_class) targetKelas = stored.ckg_saved_class;
  } catch (e) {}

  // 1. Pilih Sekolah jika ada
  if (targetSekolah) {
    onLog(`Memilih sekolah: ${targetSekolah}...`);
    await selectDropdownOption(SELECTORS.sekolahDropdownTrigger, targetSekolah, "Sekolah");
    onLog("Menunggu data kelas sekolah dimuat...");
    await sleep(1500);
  }

  // 2. Selalu Pilih Kelas (agar tabel antrean sekolah memuat siswa)
  await selectDropdownOption(SELECTORS.kelasDropdownTrigger, targetKelas, "Kelas");
  await sleep(600);

  // Simpan pilihan nama sekolah dan kelas ke chrome.storage.local
  try {
    const detectedNames = await evalExpression(debuggerSession, `
      (() => {
        const clean = s => (s || "").replace(/\\s+/g, " ").trim();
        const sEl = (${SELECTORS.sekolahDropdownTrigger})();
        const kEl = (${SELECTORS.kelasDropdownTrigger})();
        return {
          sekolah: sEl ? clean(sEl.innerText || sEl.textContent || sEl.value || "") : "",
          kelas: kEl ? clean(kEl.innerText || kEl.textContent || kEl.value || "") : ""
        };
      })()
    `);
    const finalSchool = targetSekolah || detectedNames?.sekolah;
    const finalClass = targetKelas || detectedNames?.kelas;
    if (finalSchool || finalClass) {
      await chrome.storage.local.set({
        ckg_saved_school: finalSchool,
        ckg_saved_class: finalClass
      });
      onLog(`✓ Filter tersimpan: ${finalSchool || "-"} | ${finalClass || "-"}`);
    }
  } catch (e) {}

  // 3. Klik Tampilkan Pencarian
  onLog("Klik Tampilkan Pencarian & memuat daftar siswa...");
  try {
    const searchBtnCoord = await getElementCenter(debuggerSession, SELECTORS.btnTampilkanPencarian);
    if (searchBtnCoord) {
      await dispatchClick(debuggerSession, searchBtnCoord);
      await sleep(800);
      // Pantau indikator loading halaman sampai selesai termuat (gaya Android V2)
      for (let w = 0; w < 25; w++) {
        const isLoading = await evalExpression(debuggerSession, `
          (() => {
            const tbody = document.querySelector("tbody");
            const rows = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
            const hasLoadingText = rows.some(tr => (tr.innerText || "").toLowerCase().includes("memuat")) ||
                                   (document.body && (document.body.innerText || "").toLowerCase().includes("memuat data"));
            const spinner = document.querySelector(".animate-spin, [role='status'], .loading");
            return hasLoadingText || !!spinner;
          })()
        `);
        if (!isLoading) break;
        await sleep(350);
      }
      onLog("✓ Daftar siswa berhasil dimuat.");
    }
  } catch (e) {
    onLog("Peringatan: Tombol Tampilkan Pencarian tidak perlu diklik.");
  }
}

// Helper cerdas penanganan modal konfirmasi tanggal (gaya CKG Android V2)
async function handleModalTanggalDirect(targetSession, targetHari = null) {
  return await evalExpression(targetSession, `
    (() => {
      const clean = s => (s || "").toLowerCase().replace(/[ \\t\\r\\n]+/g, " ").trim();
      const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, p, span, div")).find(el => {
        if (el.children.length > 3) return false;
        const txt = clean(el.innerText || el.textContent || "");
        return txt.includes("konfirmasi tanggal") || txt.includes("sebelum mulai") || txt.includes("tanggal pemeriksaan");
      });

      let modal = heading ? (heading.closest("div.fixed, div[role='dialog'], .modal, div[class*='z-50'], div.relative.z-50, div.z-2000, div.bg-white, div.rounded-xl, div.rounded-lg, div.shadow-xl") || heading.parentElement?.parentElement) : null;
      if (!modal) {
        modal = Array.from(document.querySelectorAll("div.fixed, [role='dialog'], .modal, div[class*='z-50'], div.relative.z-50, div.z-2000, .swal2-popup")).find(m => {
          const txt = clean(m.innerText || m.textContent || "");
          const isDateModal = txt.includes("konfirmasi tanggal") || txt.includes("sebelum mulai") || (txt.includes("tanggal pemeriksaan") && m.querySelector(".mx-datepicker, .mx-calendar, input"));
          return isDateModal && m.querySelector("button, a, div[role='button']");
        });
      }
      if (!modal) {
        const bodyTxt = clean(document.body?.innerText || "");
        if (bodyTxt.includes("konfirmasi tanggal") || bodyTxt.includes("sebelum mulai input data")) {
          modal = document;
        }
      }
      if (!modal) return false;

      const searchRoot = modal || document;
      const wantDay = ${targetHari ? targetHari : 'new Date().getDate()'};
      const dayCells = Array.from(searchRoot.querySelectorAll(".grid button, button.relative.h-auto, .mx-table-date td.cell:not(.not-current-month), td.today, td.current, td.active, span, button")).filter(cell =>
        clean(cell.textContent) === String(wantDay) && !cell.classList.contains("text-gray-300") && !cell.classList.contains("text-[#D1D5DB]") && !cell.disabled
      );
      if (dayCells.length > 0) {
        const target = dayCells[0];
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
          try { target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        });
        if (typeof target.click === "function") try { target.click(); } catch(e) {}
      }

      function isInsideCalendar(el) {
        return !!(el && el.closest && el.closest(".mx-datepicker, .mx-calendar, .mx-datepicker-popup, .mx-calendar-header, .mx-calendar-content, .mx-table, table"));
      }

      function isSimpanButton(b) {
        if (!b || b.disabled || b.classList.contains("disabled") || b.classList.contains("cursor-not-allowed")) return false;
        if (isInsideCalendar(b)) return false;
        const txt = clean(b.textContent || b.innerText || b.value || "");
        if (/batal|cancel|kembali|tutup/i.test(txt)) return false;
        return txt === "simpan" ||
               txt === "ya, simpan" ||
               txt === "ya" ||
               txt === "konfirmasi" ||
               txt === "mulai pemeriksaan" ||
               txt === "mulai" ||
               txt === "lanjut" ||
               txt === "ok" ||
               /^simpan\\b/i.test(txt) ||
               /^konfirmasi\\b/i.test(txt) ||
               /^mulai\\b/i.test(txt);
      }

      let simpanBtn = Array.from(searchRoot.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, .btn, input[type='button'], input[type='submit']")).find(isSimpanButton);
      if (!simpanBtn && searchRoot.parentElement) {
        simpanBtn = Array.from(searchRoot.parentElement.querySelectorAll("button, a, div[role='button'], div.cursor-pointer, .btn")).find(isSimpanButton);
      }
      if (!simpanBtn) {
        simpanBtn = Array.from(document.querySelectorAll("button, div[role='button'], a.btn")).find(b => isSimpanButton(b) && (b.offsetParent !== null || b.offsetHeight > 0));
      }

      if (simpanBtn) {
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
          try { simpanBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch(e) {}
        });
        if (typeof simpanBtn.click === "function") try { simpanBtn.click(); } catch(e) {}
        return true;
      }
      return false;
    })()
  `);
}

export async function runFlow(tabId, { nik, ticketNumber, nomorTiket, nama, tahun, bulan, hari, category, sekolah, kelas }, onLog, signal, onNavigateStart) {
  const target = { tabId };
  if (signal?.aborted) throw new Error("Automation was stopped");

  try {
    await chrome.debugger.detach(target).catch(() => {});
    await sleep(200);
  } catch (e) {}

  try {
    await chrome.debugger.attach(target, "1.3");
  } catch (e) {
    if (!/already attached/i.test(e.message)) throw e;
    await chrome.debugger.detach(target).catch(() => {});
    await sleep(200);
    await chrome.debugger.attach(target, "1.3");
  }

  try {
    await sendDebuggerCommand(target, "Runtime.enable");
    await sendDebuggerCommand(target, "DOM.enable");
    await sendDebuggerCommand(target, "Page.bringToFront");

    // Jika Kategori Sekolah, pilih Sekolah dan Kelas terlebih dahulu
    const isSekolah = category === "SEKOLAH" || !!sekolah;
    if (isSekolah) {
      await selectSekolahDanKelas(target, { sekolah, kelas }, onLog, signal);
    }

    const ticketToUse = (ticketNumber || nomorTiket || "").trim();
    if (ticketToUse && ticketToUse !== "—") {
      // Ubah dropdown pencarian ke Nomor Tiket
      onLog("Mengubah kriteria pencarian ke Nomor Tiket...");
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const cur = await evalExpression(target, `(${SELECTORS.dropdownTrigger})()?.textContent.trim().toLowerCase()`);
          if ((cur || "").includes("tiket")) break;

          await clickElement(target, SELECTORS.dropdownTrigger);
          await sleep(500);
          await clickElement(target, SELECTORS.opsiNomorTiket);
          await sleep(600);
        } catch (err) {
          await sleep(500);
        }
      }

      // Ketik Nomor Tiket di input pencarian
      onLog(`Memasukkan Nomor Tiket [${ticketToUse}]...`);
      await clickElement(target, SELECTORS.searchInput);
      for (const char of String(ticketToUse)) {
        await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyDown", text: char });
        await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyUp", text: char });
        await sleep(25);
      }
      await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sleep(1000);
    } else {
      // Ubah dropdown pencarian ke NIK jika belum NIK
      onLog("Memeriksa dropdown filter pencarian...");
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const cur = await evalExpression(target, `(${SELECTORS.dropdownTrigger})()?.textContent.trim()`);
          if (cur === "NIK" || (cur || "").includes("NIK")) break;

          await clickElement(target, SELECTORS.dropdownTrigger);
          await sleep(500);
          await clickElement(target, SELECTORS.opsiNIK);
          await sleep(600);
        } catch (err) {
          await sleep(500);
        }
      }

      // Ketik NIK di input pencarian
      onLog("Memasukkan NIK...");
      await clickElement(target, SELECTORS.searchInput);
      for (const char of String(nik)) {
        await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyDown", text: char });
        await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyUp", text: char });
        await sleep(25);
      }
      await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sendDebuggerCommand(target, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sleep(1000);
    }

    // Cari pasien di tab Belum / Sedang / Selesai Pemeriksaan
    onLog("Mencari pasien di antrean...");
    const tabList = ["Belum Pemeriksaan", "Sedang Pemeriksaan", "Selesai Pemeriksaan"];
    let matchedTab = null;

    for (const tabName of tabList) {
      try {
        await clickElement(target, tabItemSelector(tabName));
        await sleep(600);

        const hasPatientRow = await evalExpression(target, `
          (() => {
            const tbody = document.querySelector('tbody');
            if (!tbody) return false;
            const txt = (tbody.textContent || '');
            if (/Tidak ditemukan|Belum ada data/i.test(txt)) return false;
            const tr = tbody.querySelector('tr');
            if (!tr) return false;
            return !!Array.from(tr.querySelectorAll('button, a')).find(b => {
              const t = (b.textContent || '').trim().toLowerCase();
              return t === 'mulai' || t === 'pemeriksaan' || t.includes('mulai');
            });
          })()
        `);

        if (hasPatientRow) {
          matchedTab = tabName;
          break;
        }
      } catch (e) {}
    }

    if (!matchedTab) {
      onLog("Pasien tidak ditemukan di antrean Belum, Sedang, maupun Selesai.");
      return { earlyStatus: "MISSING" };
    }

    if (matchedTab === "Selesai Pemeriksaan") {
      onLog("Pasien ini sudah selesai pemeriksaan sebelumnya.");
      return { earlyStatus: "DONE_PELAYANAN" };
    }

    onLog(`Pasien ditemukan di tab [${matchedTab}]. Membuka pemeriksaan...`);
    await clickElement(target, SELECTORS.btnMulaiBaris);
    onNavigateStart?.();
    await sleep(1000);

    // 1. Cek langsung apakah modal konfirmasi tanggal muncul di antrean
    for (let c = 0; c < 8; c++) {
      const handled = await handleModalTanggalDirect(target, hari);
      if (handled) {
        onLog("✓ Konfirmasi tanggal langsung di antrean berhasil.");
        await sleep(1200);
        break;
      }
      await sleep(250);
    }

    // Verifikasi detail pemeriksaan termuat
    let loadedDetail = false;
    for (let i = 0; i < 15; i++) {
      loadedDetail = await evalExpression(target, `
        !!(document.querySelector("#tableLayanan") ||
           document.querySelector(".table-pemeriksaan-mandiri") ||
           Array.from(document.querySelectorAll('*')).find(e => (e.textContent || '').trim() === 'Pemeriksaan Mandiri'))
      `);
      if (loadedDetail) break;
      // Jika modal tanggal masih muncul, tangani lagi
      await handleModalTanggalDirect(target, hari);
      await sleep(400);
    }

    if (!loadedDetail) {
      throw new Error("Halaman detail pemeriksaan tidak termuat (timeout)");
    }

    // 2. Cek apakah tombol "Mulai Pemeriksaan" muncul di halaman detail
    const hasMulaiPemeriksaan = await evalExpression(target, `
      (() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').trim().toLowerCase() === 'mulai pemeriksaan');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        return !b.disabled && r.width > 0 && r.height > 0;
      })()
    `);

    if (hasMulaiPemeriksaan) {
      onLog("Klik Mulai Pemeriksaan & konfirmasi tanggal...");
      await sendDebuggerCommand(target, "Page.bringToFront");
      await clickElement(target, SELECTORS.btnMulaiPemeriksaan);
      await sleep(800);

      // Konfirmasi tanggal instan
      let dateDone = false;
      for (let c = 0; c < 12; c++) {
        dateDone = await handleModalTanggalDirect(target, hari);
        if (dateDone) {
          onLog("✓ Tanggal pemeriksaan berhasil dikonfirmasi.");
          await sleep(1000);
          break;
        }
        await sleep(300);
      }
    } else {
      onLog("Pasien sudah berstatus Sedang Pemeriksaan.");
    }

    onLog("✓ Berhasil membuka pemeriksaan untuk NIK " + nik);
    return { earlyStatus: "OK" };
  } catch (err) {
    if (err.message === "Automation was stopped") {
      onLog("❌ Otomasi dihentikan");
      return { earlyStatus: "STOPPED" };
    }
    throw err;
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}