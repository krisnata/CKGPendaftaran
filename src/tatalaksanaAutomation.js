// Otomasi Modul Tatalaksana Portal CKG (Kemenkes)
// Menangani navigasi ke menu Tatalaksana, audit baris pasien, deteksi rekomendasi tindakan/rujukan,
// deep scraping seluruh sub-input tatalaksana, dan injeksi data riil pilihan nakes.

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function execInTab(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func,
    args
  });
  return res?.result;
}

export class TatalaksanaAutomation {
  constructor({ tabId, patient = null, delay = 800, onProgress = () => {}, onDone = () => {}, onLog = () => {} } = {}) {
    this.tabId = tabId;
    this.patient = patient;
    this.delay = delay;
    this.onProgress = onProgress;
    this.onDone = onDone;
    this.onLog = onLog;
    this._stopped = false;
    this._paused = false;
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

  async _waitPause() {
    while (this._paused && !this._stopped) {
      await sleep(200);
    }
  }

  // Navigasi ke Halaman Tatalaksana jika belum terbuka
  async navigateToTatalaksana() {
    this.onLog("Memeriksa halaman Tatalaksana...");
    const currentUrl = await execInTab(this.tabId, () => window.location.href);
    if (!currentUrl || !currentUrl.includes("tatalaksana")) {
      this.onLog("Navigasi ke menu Tatalaksana melalui sidebar...");
      const navSuccess = await execInTab(this.tabId, () => {
        const buttons = Array.from(document.querySelectorAll("button, a, div[role='button']"));
        const btnTatalaksana = buttons.find(b => {
          const txt = (b.textContent || b.innerText || "").trim().toLowerCase();
          return txt === "tatalaksana" || txt.startsWith("tatalaksana");
        });
        if (btnTatalaksana) {
          btnTatalaksana.click();
          return true;
        }
        return false;
      });

      if (!navSuccess) {
        // Fallback langsung update URL
        this.onLog("Mengarahkan URL langsung ke portal Tatalaksana...");
        await chrome.tabs.update(this.tabId, { url: "https://sehatindonesiaku.kemkes.go.id/ckg-tatalaksana" });
      }

      // Tunggu hingga halaman selesai termuat
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (this._stopped) return false;
        const isLoaded = await execInTab(this.tabId, () => {
          return document.readyState === "complete" && !!document.querySelector("table, tbody, input, button");
        });
        if (isLoaded) break;
        await sleep(500);
      }
    }
    await sleep(1000);
    return true;
  }

  // Scrape daftar pasien yang membutuhkan tatalaksana dari tabel
  async scrapeTatalaksanaQueue() {
    await this.navigateToTatalaksana();
    this.onLog("Mengambil data antrean pasien Tatalaksana...");

    const patients = await execInTab(this.tabId, () => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      if (!rows.length) return [];

      return rows.map((tr, idx) => {
        const cells = Array.from(tr.querySelectorAll("td"));
        if (cells.length < 5) return null;

        const cellTexts = cells.map(c => (c.innerText || c.textContent || "").trim());
        const actionBtn = tr.querySelector("button, a.btn, [role='button']");
        const btnText = (actionBtn?.innerText || actionBtn?.textContent || "").trim();

        return {
          index: idx,
          no: cellTexts[0] || (idx + 1),
          nama: cellTexts[1] || "",
          nik: cellTexts[2] || "",
          tglLahir: cellTexts[3] || "",
          nomorTiket: cellTexts[4] || "",
          statusTatalaksana: cellTexts[5] || cellTexts[cells.length - 2] || "Perlu Tatalaksana",
          actionText: btnText || "Mulai",
          canExecute: !!actionBtn && !actionBtn.disabled
        };
      }).filter(Boolean);
    });

    this.onLog(`Ditemukan ${patients.length} data pasien pada antrean Tatalaksana.`);
    return patients || [];
  }

  // Deep Scrape semua sub-input formulir tatalaksana yang sedang aktif terbuka di layar
  async scrapeActiveTatalaksanaFormFields() {
    this.onLog("Menganalisis sub-input, diagnosis, dan pertanyaan formulir Tatalaksana...");
    
    const formAudit = await execInTab(this.tabId, () => {
      const results = {
        title: "",
        patientInfo: {},
        questions: []
      };

      // 1. Ambil Judul Form
      const titleEl = document.querySelector("h1, h2, h3, .text-xl, .text-lg, .font-bold");
      results.title = (titleEl?.innerText || titleEl?.textContent || "Formulir Tatalaksana").trim();

      // Cek SurveyJS model jika tersedia
      const surveyModel = (() => {
        let el = document.querySelector("[data-name]") || document.querySelector('[data-rendered="r"]') || document.querySelector(".sd-element--with-frame");
        for (let i = 0; i < 25 && el; i++) {
          const comp = el.__vueParentComponent ?? el.__vue__;
          if (comp) {
            const state = comp.setupState ?? comp.ctx ?? comp;
            if (state?.survey?.getQuestionByName) return state.survey;
            if (state?.question?.survey?.getQuestionByName) return state.question.survey;
            if (state?.question?.getType && state?.question?.survey?.getQuestionByName) return state.question.survey;
            let parent = comp.parent ?? comp.$parent;
            for (let j = 0; j < 20 && parent; j++) {
              const pState = parent.setupState ?? parent.ctx ?? parent;
              if (pState?.survey?.getQuestionByName) return pState.survey;
              parent = parent.parent ?? parent.$parent;
            }
          }
          el = el.parentElement;
        }
        for (const k of Object.keys(window)) {
          try {
            if (window[k]?.getQuestionByName && window[k]?.getAllQuestions) return window[k];
          } catch (e) {}
        }
        return null;
      })();

      // 2. Ambil Pertanyaan & Sub-input SurveyJS (.sd-element--with-frame)
      const frames = Array.from(document.querySelectorAll(".sd-element--with-frame, [data-name], .form-group, fieldset"));

      const seenIds = new Set();

      // Definisi standar 4 komponen utama Tatalaksana sesuai hasil audit (laporan_audit_tatalaksana_20260926_173135.txt)
      const auditStandardFields = [
        {
          key: "tgl_pelaksanaan",
          dataName: "PROTA0000258-PROTAPRM0000303-general",
          id: "sq_100",
          title: "Tanggal pelaksanaan",
          type: "date",
          defaultVal: new Date().toISOString().split("T")[0]
        },
        {
          key: "apakah_diagnosis",
          dataName: "PROTA0000259-PROTAPRM0000304-diagnosis",
          id: "sq_101",
          title: "Apakah pasien diberikan diagnosis ?",
          type: "radio",
          options: ["Ya", "Tidak"],
          defaultVal: "Ya"
        },
        {
          key: "pilihan_diagnosis",
          dataName: "diagnosis_list",
          id: "sq_104i",
          title: "Pilihan Diagnosis (ICD-10)",
          type: "dropdown",
          options: [
            "E66 - Obesity (Obesitas)",
            "E66.0 - Obesity due to excess calories (Obesitas akibat kelebihan kalori)",
            "E66.1 - Drug-induced obesity (Obesitas akibat induksi obat)",
            "E66.9 - Obesity, unspecified (Obesitas, tidak terspesifikasi)",
            "I10 - Essential (primary) hypertension (Hipertensi)",
            "E11 - Non-insulin-dependent diabetes mellitus (Diabetes Melitus)",
            "Z00.0 - General medical examination (Pemeriksaan umum normal)",
            "Lainnya"
          ],
          defaultVal: "E66 - Obesity (Obesitas)"
        },
        {
          key: "apakah_edukasi",
          dataName: "PROTA0000260-PROTAPRM0000308-edukasi",
          id: "sq_106",
          title: "Apakah pasien sudah diberikan edukasi ?",
          type: "radio",
          options: ["Ya", "Tidak"],
          defaultVal: "Ya"
        },
        {
          key: "apakah_rujuk_fktl",
          dataName: "PROTA0000261-PROTAPRM0000311-tindak_lanjut",
          id: "sq_109",
          title: "Apakah pasien perlu kontrol rutin atau rujuk FKTL ?",
          type: "radio",
          options: ["Ya", "Tidak"],
          defaultVal: "Tidak"
        },
        {
          key: "alasan_tindak_lanjut",
          dataName: "alasan_rujukan",
          id: "sq_114i",
          title: "Alasan Tindak Lanjut / Rujukan",
          type: "dropdown",
          options: [
            "Pengobatan tuntas",
            "Tidak masuk dalam skema pembiayaan Puskesmas",
            "Pasien menolak",
            "Lainnya"
          ],
          defaultVal: "Pengobatan tuntas"
        }
      ];

      if (frames.length > 0) {
        frames.forEach((frame, fIdx) => {
          const qTitleEl = frame.querySelector(".sd-question__title span.sv-string-viewer, .sd-title, label, h5, .font-semibold");
          const ariaLabel = frame.querySelector("[aria-label]")?.getAttribute("aria-label");
          let rawQTitle = (qTitleEl?.innerText || qTitleEl?.textContent || ariaLabel || "").trim().replace(/\s+/g, " ");
          
          const frameId = frame.id || frame.getAttribute("data-name") || `sq_${fIdx}`;
          const qName = frame.getAttribute("data-name") || (frame.id ? frame.id.replace(/^sq_/, '') : '');

          // Filter elemen duplikat atau kontainer kosong
          if (!rawQTitle && !qName) return;
          if (seenIds.has(frameId)) return;

          // Bersihkan penomoran awal seperti "1. Tanggal..." atau "2. Apakah..."
          const cleanTitle = rawQTitle.replace(/^\d+[\.\s\xa0]+/, '').replace(/\s*\*\s*$/, '').trim();

          // Cek tipe elemen
          const radios = Array.from(frame.querySelectorAll('input[type="radio"], .sd-radio__control, .sd-item__control-label'));
          const dropdownWrapper = frame.querySelector(".sd-dropdown, .sd-tagbox, select, [role='combobox']");
          const textInputs = Array.from(frame.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], textarea, input.sd-input'));

          let qType = "text";
          let options = [];
          let currentVal = "";

          // Cek opsi dari SurveyJS model pertanyaan
          if (surveyModel) {
            try {
              const qObj = surveyModel.getQuestionByName(qName) || surveyModel.getAllQuestions?.().find(q => q.title === rawQTitle || q.name === qName);
              if (qObj) {
                if (qObj.choices && qObj.choices.length > 0) {
                  options = qObj.choices.map(c => typeof c === "object" ? (c.text || c.value) : String(c));
                }
                if (qObj.value !== undefined && qObj.value !== null) {
                  currentVal = String(qObj.value);
                }
              }
            } catch (err) {}
          }

          // Cek opsi dari DOM listbox (.sv-list atau popup terkait)
          if (!options.length && (dropdownWrapper || frame.querySelector('.sv-list, ul[role="listbox"]'))) {
            const listItems = Array.from(frame.querySelectorAll('.sv-list__item, li[role="option"], option'));
            if (listItems.length > 0) {
              options = listItems.map(li => {
                return (li.getAttribute("title") || li.innerText || li.textContent || "").trim();
              }).filter(Boolean);
            }
          }

          // Cek kontainer popup terhubung
          if (!options.length && dropdownWrapper) {
            const listId = dropdownWrapper.getAttribute("aria-controls") || (dropdownWrapper.id ? `${dropdownWrapper.id}_list` : null);
            if (listId) {
              const popupUl = document.getElementById(listId);
              if (popupUl) {
                options = Array.from(popupUl.querySelectorAll('li[role="option"], .sv-list__item')).map(li => {
                  return (li.getAttribute("title") || li.innerText || li.textContent || "").trim();
                }).filter(Boolean);
              }
            }
          }

          if (radios.length > 0) {
            qType = "radio";
            if (!options.length) {
              const rawOpts = radios.map(r => {
                const labelEl = r.closest("label") || r.parentElement;
                return (labelEl?.innerText || labelEl?.textContent || "").trim();
              }).filter(Boolean);
              // Deduplicate teks "Ya", "Ya", "Tidak", "Tidak" akibat pembungkus SurveyJS
              options = Array.from(new Set(rawOpts));
            }
            if (options.length === 0) options = ["Ya", "Tidak"];
          } else if (dropdownWrapper) {
            qType = "dropdown";
            const curValEl = frame.querySelector(".sd-dropdown__value, .sd-tagbox__value, select");
            if (curValEl) {
              const valText = (curValEl.innerText || curValEl.textContent || curValEl.value || "").trim();
              if (valText && valText !== "Pilih...") currentVal = valText;
            }

            // Fallback cerdas sesuai temuan audit tatalaksana CKG
            if (!options.length) {
              const lower = (cleanTitle + " " + qName).toLowerCase();
              if (lower.includes("diagnosis")) {
                options = [
                  "E66 - Obesity (Obesitas)",
                  "E66.0 - Obesity due to excess calories (Obesitas akibat kelebihan kalori)",
                  "E66.1 - Drug-induced obesity (Obesitas akibat induksi obat)",
                  "E66.9 - Obesity, unspecified (Obesitas, tidak terspesifikasi)",
                  "I10 - Essential (primary) hypertension (Hipertensi)",
                  "E11 - Non-insulin-dependent diabetes mellitus (Diabetes Melitus)",
                  "Z00.0 - General medical examination (Pemeriksaan umum normal)",
                  "Lainnya"
                ];
              } else if (lower.includes("alasan") || lower.includes("tindak") || lower.includes("rujuk")) {
                options = [
                  "Pengobatan tuntas",
                  "Tidak masuk dalam skema pembiayaan Puskesmas",
                  "Pasien menolak",
                  "Lainnya"
                ];
              }
            }
          } else if (textInputs.length > 0) {
            const firstInp = textInputs[0];
            qType = firstInp.type || "text";
            if (!currentVal) currentVal = firstInp.value || "";
          }

          seenIds.add(frameId);
          results.questions.push({
            id: frameId,
            name: qName,
            title: cleanTitle || rawQTitle,
            type: qType,
            options: Array.from(new Set(options)),
            currentValue: currentVal
          });
        });
      }

      // Pastikan semua 6 field standar dari laporan audit selalu ada di daftar pertanyaan
      // agar nakes dapat mengatur nilainya di UI bahkan sebelum sub-form terbuka secara dinamis
      auditStandardFields.forEach(std => {
        const existing = results.questions.find(q => {
          return q.id === std.id || 
                 q.name === std.dataName || 
                 (std.title && q.title.toLowerCase().includes(std.title.toLowerCase()));
        });

        if (!existing) {
          results.questions.push({
            id: std.id,
            name: std.dataName,
            title: std.title,
            type: std.type,
            options: std.options || [],
            currentValue: std.defaultVal || ""
          });
        } else {
          // Lengkapi opsi jika kosong
          if (std.options && (!existing.options || !existing.options.length)) {
            existing.options = std.options;
          }
          if (!existing.currentValue && std.defaultVal) {
            existing.currentValue = std.defaultVal;
          }
        }
      });

      return results;
    });

    this.onLog(`Scraping tatalaksana selesai. Terdeteksi ${formAudit?.questions?.length || 0} sub-input.`);
    return formAudit;
  }

  // Injeksi data tatalaksana otomatis berdasarkan temuan riil laporan_audit_tatalaksana_20260926_173135.txt
  async injectTatalaksanaValues(selectedValues = {}, formSettings = {}) {
    this.onLog("Menyuntikkan nilai tatalaksana pilihan nakes...");

    const injectResult = await execInTab(this.tabId, async (values, settings) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const nativeValSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      const clickOpts = { bubbles: true, cancelable: true, view: window };
      let successCount = 0;

      // SurveyJS Vue Model helper jika tersedia
      const surveyModel = (() => {
        let el = document.querySelector("[data-name]") || document.querySelector('[data-rendered="r"]') || document.querySelector(".sd-element--with-frame");
        for (let i = 0; i < 25 && el; i++) {
          const comp = el.__vueParentComponent ?? el.__vue__;
          if (comp) {
            const state = comp.setupState ?? comp.ctx ?? comp;
            if (state?.survey?.getQuestionByName) return state.survey;
            if (state?.question?.survey?.getQuestionByName) return state.question.survey;
            if (state?.question?.getType && state?.question?.survey?.getQuestionByName) return state.question.survey;
            let parent = comp.parent ?? comp.$parent;
            for (let j = 0; j < 20 && parent; j++) {
              const pState = parent.setupState ?? parent.ctx ?? parent;
              if (pState?.survey?.getQuestionByName) return pState.survey;
              parent = parent.parent ?? parent.$parent;
            }
          }
          el = el.parentElement;
        }
        for (const k of Object.keys(window)) {
          try {
            if (window[k]?.getQuestionByName && window[k]?.getAllQuestions) return window[k];
          } catch (e) {}
        }
        return null;
      })();

      // Helper mencari nilai pengguna berdasarkan kata kunci
      const getUserVal = (keywords, fallback = "") => {
        for (const [k, v] of Object.entries(values)) {
          const lk = k.toLowerCase();
          for (const kw of keywords) {
            if (lk.includes(kw.toLowerCase())) return v;
          }
        }
        return fallback;
      };

      // Helper klik elemen dengan event sintetis lengkap
      const triggerClick = (el) => {
        if (!el) return false;
        el.dispatchEvent(new PointerEvent("pointerdown", clickOpts));
        el.dispatchEvent(new MouseEvent("mousedown", clickOpts));
        el.dispatchEvent(new MouseEvent("mouseup", clickOpts));
        el.click();
        return true;
      };

      // Helper memilih radio button di dalam frame/parent tertentu
      const selectRadioInFrame = (frameOrSelector, targetValue) => {
        const frame = typeof frameOrSelector === "string" ? document.querySelector(frameOrSelector) : frameOrSelector;
        if (!frame) return false;
        const labels = Array.from(frame.querySelectorAll("label, .sd-item, .sd-radio, input[type='radio']"));
        const targetClean = String(targetValue).toLowerCase().trim();
        for (const lbl of labels) {
          const txt = (lbl.innerText || lbl.textContent || "").toLowerCase().trim();
          if (txt === targetClean || txt.startsWith(targetClean)) {
            const clickTarget = lbl.querySelector("input[type='radio']") || lbl;
            triggerClick(clickTarget);
            return true;
          }
        }
        return false;
      };

      // Helper menyuntikkan pilihan tagbox / dropdown SurveyJS
      const selectSurveyDropdown = async (wrapperSelector, valToSelect) => {
        if (!valToSelect) return false;
        const wrapper = document.querySelector(wrapperSelector) || 
                        document.querySelector(`[aria-controls*="${wrapperSelector.replace('#', '')}"]`) ||
                        document.querySelector(".sd-tagbox, .sd-dropdown");
        if (!wrapper) return false;

        // Buka dropdown
        const filterInput = wrapper.querySelector(".sd-tagbox__filter-string-input, .sd-dropdown__filter-string-input, input");
        const clickTrigger = filterInput || wrapper;
        triggerClick(clickTrigger);
        await wait(350);

        // Jika input filter bisa diketik, bantu cari opsi
        if (filterInput && !filterInput.readOnly) {
          filterInput.focus();
          const keyword = String(valToSelect).split("-")[0].trim();
          if (nativeValSetter) nativeValSetter.call(filterInput, keyword);
          else filterInput.value = keyword;
          filterInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
          await wait(200);
        }

        // Cari item di listbox / popup
        const listId = wrapper.getAttribute("aria-controls") || (wrapper.id ? `${wrapper.id}_list` : null);
        let container = listId ? document.getElementById(listId) : null;
        if (!container) {
          container = document.querySelector(".sv-popup--dropdown:not([style*='display: none']), .sv-popup:not([style*='display: none'])") || document;
        }

        const items = Array.from(container.querySelectorAll(".sv-list__item, [role='option'], li"));
        const cleanTarget = String(valToSelect).toLowerCase().trim();
        let targetItem = items.find(it => {
          const t = (it.getAttribute("title") || it.innerText || it.textContent || "").toLowerCase().trim();
          return t === cleanTarget || t.includes(cleanTarget) || cleanTarget.includes(t);
        });

        // Fallback jika tidak cocok persis: cari berdasarkan kode (misal E66 atau kata kunci pertama)
        if (!targetItem && cleanTarget.includes(" ")) {
          const firstWord = cleanTarget.split(/[\s\-]/)[0];
          targetItem = items.find(it => {
            const t = (it.getAttribute("title") || it.innerText || it.textContent || "").toLowerCase().trim();
            return t.includes(firstWord);
          });
        }

        if (targetItem) {
          const itemBody = targetItem.querySelector(".sv-list__item-body") || targetItem;
          triggerClick(itemBody);
          await wait(200);
          return true;
        } else if (items.length > 0) {
          // Opsi pertama
          const firstBody = items[0].querySelector(".sv-list__item-body") || items[0];
          triggerClick(firstBody);
          await wait(200);
          return true;
        }

        // Tutup jika gagal
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return false;
      };

      // =========================================================================
      // EKSEKUSI SEKUENSIAL TEPAT SESUAI LAPORAN AUDIT CKG
      // =========================================================================

      // 1. TANGGAL PELAKSANAAN (#sq_100, PROTA0000258-PROTAPRM0000303-general)
      const tglInput = document.querySelector("#sq_100i, input[type='date'], #sq_100 input");
      const targetTgl = getUserVal(["tanggal", "tgl", "pelaksanaan", "sq_100"], new Date().toISOString().split("T")[0]);
      if (tglInput) {
        tglInput.focus();
        if (nativeValSetter) nativeValSetter.call(tglInput, targetTgl);
        else tglInput.value = targetTgl;
        tglInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
        tglInput.dispatchEvent(new Event("change", { bubbles: true }));
        tglInput.blur();
        successCount++;
        await wait(150);
      }

      // 2. PERTANYAAN DIAGNOSIS (#sq_101, PROTA0000259-PROTAPRM0000304-diagnosis)
      // "Apakah pasien diberikan diagnosis ?" -> Radio Ya / Tidak
      const valApakahDiagnosis = getUserVal(["diberikan diagnosis", "apakah diagnosis", "sq_101", "PROTA0000259"], "Ya");
      const diagFrame = document.querySelector("#sq_101, [data-name*='PROTA0000259'], [data-name*='diagnosis']") || document.getElementById("sq_101");
      if (diagFrame) {
        selectRadioInFrame(diagFrame, valApakahDiagnosis);
        successCount++;
        await wait(350); // Tunggu render conditional SurveyJS untuk tagbox diagnosis #sq_104i
      }

      // 2b. SUB-INPUT TAGBOX DIAGNOSIS (#sq_104i) jika dipilih "Ya"
      if (String(valApakahDiagnosis).toLowerCase() === "ya") {
        const valDiagChoice = getUserVal(["pilihan diagnosis", "icd", "e66", "sq_104", "diagnosis"], "E66 - Obesity (Obesitas)");
        const tagboxOk = await selectSurveyDropdown("#sq_104i", valDiagChoice);
        if (tagboxOk) successCount++;
        await wait(250);
      }

      // 3. PERTANYAAN EDUKASI (#sq_106, PROTA0000260-PROTAPRM0000308-edukasi)
      // "Apakah pasien sudah diberikan edukasi ?" -> Radio Ya / Tidak
      const valApakahEdukasi = getUserVal(["diberikan edukasi", "sudah edukasi", "sq_106", "PROTA0000260"], "Ya");
      const eduFrame = document.querySelector("#sq_106, [data-name*='PROTA0000260'], [data-name*='edukasi']") || document.getElementById("sq_106");
      if (eduFrame) {
        selectRadioInFrame(eduFrame, valApakahEdukasi);
        successCount++;
        await wait(200);
      }

      // 4. PERTANYAAN TINDAK LANJUT / RUJUK (#sq_109, PROTA0000261-PROTAPRM0000311-tindak_lanjut)
      // "Apakah pasien perlu kontrol rutin atau rujuk FKTL ?" -> Radio Ya / Tidak
      const valApakahRujuk = getUserVal(["kontrol rutin", "rujuk fktl", "tindak lanjut", "sq_109", "PROTA0000261"], "Tidak");
      const rujukFrame = document.querySelector("#sq_109, [data-name*='PROTA0000261'], [data-name*='tindak_lanjut']") || document.getElementById("sq_109");
      if (rujukFrame) {
        selectRadioInFrame(rujukFrame, valApakahRujuk);
        successCount++;
        await wait(350); // Tunggu render conditional dropdown alasan jika ada
      }

      // 4b. SUB-INPUT ALASAN RUJUKAN / TINDAK LANJUT (#sq_114i) jika muncul
      const valAlasan = getUserVal(["alasan", "sq_114", "pengobatan tuntas"], "Pengobatan tuntas");
      const alasanDropdown = document.querySelector("#sq_114i, [aria-controls*='sq_114']");
      if (alasanDropdown) {
        const alasanOk = await selectSurveyDropdown("#sq_114i", valAlasan);
        if (alasanOk) successCount++;
        await wait(200);
      }

      // Model SurveyJS fallback langsung jika terdeteksi
      if (surveyModel) {
        try {
          for (const [k, v] of Object.entries(values)) {
            const q = surveyModel.getQuestionByName(k);
            if (q) {
              q.value = Array.isArray(q.value) ? [v] : v;
            }
          }
        } catch (e) {}
      }

      // 5. TOMBOL SELESAI / KIRIM TATALAKSANA
      // Class: sd-btn sd-btn--action sd-navigation__complete-btn
      if (settings?.autoSubmit) {
        await wait(600);
        const submitBtn = document.querySelector("input.sd-navigation__complete-btn, input[value='Kirim'], input.sd-btn--action, button.sd-navigation__complete-btn");

        if (submitBtn && !submitBtn.disabled) {
          submitBtn.scrollIntoView({ block: "center" });
          triggerClick(submitBtn);
          await wait(1200);
          return { ok: true, injected: successCount, submitted: true };
        }
      }

      return { ok: true, injected: successCount, submitted: false };
    }, [selectedValues, formSettings]);

    this.onLog(`Injeksi data tatalaksana selesai: ${injectResult?.injected || 0} field berhasil disuntikkan.`);
    return injectResult;
  }
}
