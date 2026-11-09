# -*- coding: utf-8 -*-
"""
Audit & Deep Scraper Khusus Modul Tatalaksana Portal CKG Kemenkes
================================================================
File ini berdiri sendiri (stand-alone Python script) dan TIDAK mengubah file ekstensi sama sekali.
Fungsi:
1. Menghubungkan ke browser Chrome (via Playwright atau CDP port yang sedang berjalan, atau membuka sesi browser tersendiri).
2. Melakukan audit dan bedah mendalam terhadap seluruh struktur formulir Tatalaksana di portal CKG:
   - URL: /ckg-tatalaksana dan formulir skrining terkait
   - Seluruh elemen SurveyJS (#sq_104i, #sq_114i, dsb.)
   - Dropdown bertingkat, Tagbox, Listbox, Popup opsi (.sv-list, .sv-popup--dropdown)
   - Pertanyaan, label, diagnosis ICD-10, alasan rujukan, edukasi
   - Tombol submit/kirim (<input class="sd-navigation__complete-btn">)
3. Menyimpan hasil audit lengkap ke file JSON dan TXT terstruktur agar data tidak melenceng.
"""

import os
import sys
import time
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

CHROME_USER_DATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA", "C:\\"), "Google", "Chrome", "User Data")
DEFAULT_CKG_URL = "https://sehatindonesiaku.kemkes.go.id/ckg-tatalaksana"

def banner():
    print("=" * 80)
    print("   AUDIT & DEEP SCRAPER KHUSUS MODUL TATALAKSANA CKG (STANDALONE PYTHON)   ")
    print("=" * 80)
    print("[INFO] Script ini berdiri sendiri dan tidak mengubah file ekstensi Chrome.")
    print("[INFO] Waktu mulai:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("-" * 80)

def connect_or_launch_browser(playwright):
    """
    Coba menghubungkan ke Chrome yang sedang berjalan via CDP (port 9222),
    atau luncurkan browser Chromium/Chrome dengan profile.
    """
    print("[1/4] Menghubungkan ke browser...")
    try:
        browser = playwright.chromium.connect_over_cdp("http://localhost:9222")
        print("  ✓ Berhasil terhubung ke Chrome yang sedang berjalan via CDP (port 9222).")
        context = browser.contexts[0]
        # Cari tab tatalaksana atau tab sehatindonesiaku
        page = None
        for p in context.pages:
            if "sehatindonesiaku.kemkes.go.id" in p.url or "form.kemkes.go.id" in p.url:
                page = p
                print(f"  ✓ Menemukan tab CKG aktif: {p.url[:60]}...")
                break
        if not page:
            page = context.new_page()
            page.goto(DEFAULT_CKG_URL)
        return browser, context, page, False
    except Exception as e:
        print("  ! CDP localhost:9222 tidak aktif, membuka browser Chrome baru...")
        browser = playwright.chromium.launch(
            headless=False,
            channel="chrome",
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(viewport=None)
        page = context.new_page()
        page.goto(DEFAULT_CKG_URL)
        return browser, context, page, True

def audit_tatalaksana(page):
    """
    Melakukan deep audit seluruh komponen DOM, SurveyJS model, dropdown, dan tombol tatalaksana.
    """
    print("[2/4] Menunggu halaman dan memeriksa struktur modul Tatalaksana...")
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)

    print("[3/4] Menjalankan pembedahan elemen Tatalaksana...")
    audit_script = """
    (() => {
        const report = {
            url: window.location.href,
            pageTitle: document.title,
            timestamp: new Date().toISOString(),
            surveyJsDetected: false,
            surveyJsModelQuestions: [],
            domForms: [],
            buttons: [],
            dropdownsAndTagboxes: [],
            tableRows: [],
            completeSubmitButtons: []
        };

        // 1. Deteksi Model Vue / SurveyJS Global
        const surveyModel = (() => {
            let el = document.querySelector("[data-name]") || document.querySelector('[data-rendered="r"]') || document.querySelector(".sd-element--with-frame");
            for (let i = 0; i < 25 && el; i++) {
                const comp = el.__vueParentComponent ?? el.__vue__;
                if (comp) {
                    const state = comp.setupState ?? comp.ctx ?? comp;
                    if (state?.survey?.getQuestionByName) return state.survey;
                    if (state?.question?.survey?.getQuestionByName) return state.question.survey;
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

        if (surveyModel && surveyModel.getAllQuestions) {
            report.surveyJsDetected = true;
            try {
                const qs = surveyModel.getAllQuestions();
                report.surveyJsModelQuestions = qs.map(q => ({
                    name: q.name || '',
                    title: q.title || q.name || '',
                    type: q.getType ? q.getType() : 'unknown',
                    value: q.value,
                    isRequired: !!q.isRequired,
                    choices: (q.choices || []).map(c => typeof c === 'object' ? (c.text || c.value) : String(c))
                }));
            } catch (e) {
                report.surveyJsModelError = e.message;
            }
        }

        // 2. Audit Elemen DOM Form (.sd-element--with-frame & form controls)
        const frames = Array.from(document.querySelectorAll(".sd-element--with-frame, .sd-question, .form-group, fieldset"));
        frames.forEach((f, idx) => {
            const titleEl = f.querySelector(".sd-question__title span.sv-string-viewer, .sd-title, label, h5, .font-semibold");
            const ariaLabel = f.querySelector("[aria-label]")?.getAttribute("aria-label");
            const qTitle = (titleEl?.innerText || titleEl?.textContent || ariaLabel || `Question_${idx}`).trim();

            const frameId = f.id || f.getAttribute("data-name") || `elem_${idx}`;
            const dataName = f.getAttribute("data-name") || '';

            // Periksa dropdown / tagbox
            const dd = f.querySelector(".sd-dropdown, .sd-tagbox, select, [role='combobox']");
            let ddInfo = null;
            if (dd) {
                const listId = dd.getAttribute("aria-controls") || (dd.id ? `${dd.id}_list` : null);
                let optElements = [];
                if (listId) {
                    const listEl = document.getElementById(listId);
                    if (listEl) {
                        optElements = Array.from(listEl.querySelectorAll("[role='option'], .sv-list__item, li"));
                    }
                }
                if (!optElements.length) {
                    optElements = Array.from(f.querySelectorAll("[role='option'], .sv-list__item, option"));
                }

                ddInfo = {
                    id: dd.id || '',
                    className: dd.className || '',
                    role: dd.getAttribute("role") || '',
                    ariaLabel: dd.getAttribute("aria-label") || '',
                    listId: listId || '',
                    optionsFound: optElements.map(o => (o.getAttribute("title") || o.innerText || o.textContent || "").trim()).filter(Boolean)
                };
            }

            // Periksa radios
            const radios = Array.from(f.querySelectorAll("input[type='radio'], .sd-item__control-label")).map(r => {
                const l = r.closest("label") || r;
                return (l.innerText || l.textContent || "").trim();
            }).filter(Boolean);

            // Periksa text/number inputs
            const inputs = Array.from(f.querySelectorAll("input.sd-input, input[type='text'], input[type='number'], textarea")).map(i => ({
                id: i.id || '',
                name: i.name || '',
                type: i.type || '',
                placeholder: i.placeholder || '',
                value: i.value || ''
            }));

            report.domForms.push({
                index: idx,
                id: frameId,
                dataName: dataName,
                title: qTitle,
                hasDropdown: !!dd,
                dropdownDetail: ddInfo,
                radioOptions: radios,
                inputs: inputs
            });
        });

        // 3. Audit Seluruh Tombol Aksi di Layar
        const allButtons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn, [role='button']"));
        allButtons.forEach((b, idx) => {
            const txt = (b.innerText || b.value || b.textContent || b.title || '').trim();
            const cls = b.className || '';
            const isSubmit = b.classList.contains("sd-navigation__complete-btn") ||
                             txt.toLowerCase() === "kirim" ||
                             txt.toLowerCase() === "selesaikan tatalaksana" ||
                             txt.toLowerCase() === "simpan";

            const btnData = {
                index: idx,
                tagName: b.tagName,
                text: txt,
                className: cls,
                disabled: !!b.disabled,
                isSubmitCandidate: isSubmit
            };
            report.buttons.push(btnData);

            if (isSubmit) {
                report.completeSubmitButtons.push(btnData);
            }
        });

        // 4. Audit Tabel Pasien Tatalaksana jika ada
        const rows = Array.from(document.querySelectorAll("tbody tr, .table-individu-terdaftar table tbody tr"));
        report.tableRows = rows.map((tr, idx) => {
            const cells = Array.from(tr.querySelectorAll("td")).map(td => (td.innerText || td.textContent || "").trim());
            const actBtn = tr.querySelector("button, a");
            return {
                rowIndex: idx,
                cells: cells,
                actionBtnText: (actBtn?.innerText || actBtn?.textContent || "").trim(),
                hasAction: !!actBtn
            };
        });

        return report;
    })()
    """

    results = page.evaluate(audit_script)
    return results

def save_report(results):
    print("[4/4] Menyimpan laporan audit tatalaksana...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(out_dir, f"laporan_audit_tatalaksana_{timestamp}.json")
    txt_path = os.path.join(out_dir, f"laporan_audit_tatalaksana_{timestamp}.txt")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("LAPORAN AUDIT & BEDAH KHUSUS MODUL TATALAKSANA CKG\n")
        f.write("=" * 80 + "\n")
        f.write(f"Waktu Audit    : {results.get('timestamp')}\n")
        f.write(f"URL Diperiksa  : {results.get('url')}\n")
        f.write(f"Judul Halaman  : {results.get('pageTitle')}\n")
        f.write(f"SurveyJS Model : {'Terdeteksi ✓' if results.get('surveyJsDetected') else 'Tidak Terdeteksi (DOM Mode)'}\n")
        f.write("-" * 80 + "\n\n")

        f.write("A. PERTANYAAN MODEL SURVEYJS:\n")
        survey_qs = results.get("surveyJsModelQuestions", [])
        if survey_qs:
            for i, q in enumerate(survey_qs, 1):
                f.write(f"  {i}. [{q.get('type')}] {q.get('title')} (Name: {q.get('name')})\n")
                if q.get("choices"):
                    f.write(f"     Opsi: {', '.join(q.get('choices')[:8])}\n")
        else:
            f.write("  (Tidak ada model SurveyJS global atau form belum terbuka)\n")

        f.write("\nB. SUB-INPUT & DROPDOWN DOM FORM:\n")
        dom_forms = results.get("domForms", [])
        for i, df in enumerate(dom_forms, 1):
            f.write(f"  {i}. {df.get('title')} (ID: {df.get('id')}, DataName: {df.get('dataName')})\n")
            if df.get("dropdownDetail"):
                dd = df["dropdownDetail"]
                f.write(f"     [DROPDOWN/TAGBOX] ID: {dd.get('id')}, Role: {dd.get('role')}\n")
                if dd.get("optionsFound"):
                    f.write(f"     Opsi Terbaca: {', '.join(dd.get('optionsFound'))}\n")
            if df.get("radioOptions"):
                f.write(f"     [RADIO] Opsi: {', '.join(df.get('radioOptions'))}\n")
            if df.get("inputs"):
                f.write(f"     [INPUT TEXT/NUMBER]: {len(df.get('inputs'))} field\n")

        f.write("\nC. TOMBOL SELESAI / KIRIM TATALAKSANA:\n")
        submits = results.get("completeSubmitButtons", [])
        if submits:
            for s in submits:
                f.write(f"  ✓ Tombol: '{s.get('text')}' (Class: {s.get('className')})\n")
        else:
            f.write("  ! Tidak ditemukan tombol kirim spesifik (cek daftar semua tombol)\n")

        f.write("\nD. TABEL ANTREAN PASIEN TATALAKSANA:\n")
        rows = results.get("tableRows", [])
        f.write(f"  Total baris pasien di tabel: {len(rows)}\n")
        for r in rows[:10]:
            f.write(f"  Row {r.get('rowIndex') + 1}: {r.get('cells')[:5]} | Aksi: {r.get('actionBtnText')}\n")

        f.write("\n" + "=" * 80 + "\n")
        f.write("REKOMENDASI UNTUK AUTOMATION:\n")
        f.write("1. Pastikan tagbox diagnosis (#sq_104i) menyuntikkan value melalui SurveyJS question value atau klik item body.\n")
        f.write("2. Pastikan alasan rujukan/tatalaksana (#sq_114i) memilih opsi yang cocok ('Pengobatan tuntas' / 'Lainnya').\n")
        f.write("3. Gunakan selector 'input.sd-navigation__complete-btn' untuk submit akhir.\n")
        f.write("=" * 80 + "\n")

    print(f"\n[SELESAI] Hasil audit berhasil disimpan ke:")
    print(f"  - {json_path}")
    print(f"  - {txt_path}")
    print("\nRingkasan:")
    print(f"  - Pertanyaan SurveyJS Model : {len(results.get('surveyJsModelQuestions', []))}")
    print(f"  - Form & Sub-Input DOM      : {len(results.get('domForms', []))}")
    print(f"  - Tombol Submit Terdeteksi  : {len(results.get('completeSubmitButtons', []))}")
    print(f"  - Baris Pasien Tabel        : {len(results.get('tableRows', []))}")

def main():
    banner()
    with sync_playwright() as playwright:
        browser, context, page, is_launched = connect_or_launch_browser(playwright)
        try:
            print("\nInstruksi:")
            print("1. Pastikan Anda sudah login di portal CKG Kemenkes pada browser yang terbuka.")
            print("2. Buka menu 'Tatalaksana' atau buka formulir tatalaksana pasien yang ingin diaudit.")
            input("\nTekan [ENTER] jika halaman Tatalaksana sudah siap di layar browser...")

            results = audit_tatalaksana(page)
            save_report(results)
        finally:
            if is_launched:
                print("\nMenutup browser sementara...")
                browser.close()

if __name__ == "__main__":
    main()
