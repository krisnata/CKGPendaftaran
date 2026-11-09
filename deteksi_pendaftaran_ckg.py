# -*- coding: utf-8 -*-
"""
Detektor & Diagnostik Khusus Formulir Pendaftaran CKG (Kemenkes)
================================================================
Alat Python mandiri (Standalone) untuk mendeteksi:
1. Elemen web yang sedang terbuka di portal CKG (Step 1 atau Step 2 Pendaftaran).
2. Membedah penyebab popup kegagalan:
   "Pendaftaran Gagal. Data pendaftaran gagal disimpan. Silakan coba beberapa saat lagi."
3. Memeriksa respons API Network (XHR / Fetch status 400, 422, 500) saat tombol "Daftarkan" diklik.
4. Mendeteksi field wajib yang belum terisi (Alamat, Pekerjaan, Disabilitas, Status Pernikahan, Wilayah Domisili).
5. Memeriksa error validasi form merah (aria-invalid, invalid-feedback, pesan error di bawah input).
"""

import sys
import os
import time
import json
from datetime import datetime
from playwright.sync_api import sync_playwright

CKG_URLS = [
    "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu",
    "https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-anak-sekolah",
    "https://sehatindonesiaku.kemkes.go.id/dashboard"
]

def log(msg, symbol="[INFO]"):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] {symbol} {msg}")

def inspect_ckg_pendaftaran():
    print("=" * 80)
    print("      DIAGNOSTIK & DETEKTOR WEB PENDAFTARAN CKG (STEP 2 / GAGAL SIMPAN)      ")
    print("=" * 80)

    captured_requests = []
    captured_responses = []

    with sync_playwright() as p:
        browser = None
        context = None
        page = None
        is_cdp = False

        # 1. Coba hubungkan ke browser Chrome yang sedang aktif via CDP 9222
        try:
            log("Mencoba menghubungkan ke browser Chrome aktif via CDP (localhost:9222)...")
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            for pg in context.pages:
                if "sehatindonesiaku.kemkes.go.id" in pg.url or "ckg" in pg.url:
                    page = pg
                    log(f"Terhubung ke tab CKG aktif: {page.url}", "✓")
                    is_cdp = True
                    break
        except Exception as e:
            log("CDP localhost:9222 tidak aktif.", "!")

        # 2. Jika tidak ada CDP, buka browser Chromium/Chrome dengan URL pendaftaran individu yang benar
        if not page:
            log("Membuka browser Chrome baru untuk navigasi ke pendaftaran...")
            target_url = CKG_URLS[0]
            browser = p.chromium.launch(
                headless=False,
                channel="chrome",
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(viewport=None)
            page = context.new_page()
            log(f"Navigasi ke {target_url} ...")
            try:
                page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                log(f"Peringatan navigasi: {e}", "!")

        # Pasang Network Listener untuk menangkap payload POST saat tombol Daftar diklik
        def on_request(req):
            if any(kw in req.url for kw in ["pendaftaran", "participant", "register", "pasien", "skrining", "individu", "api"]):
                captured_requests.append({
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "method": req.method,
                    "url": req.url,
                    "post_data": req.post_data
                })

        def on_response(res):
            if any(kw in res.url for kw in ["pendaftaran", "participant", "register", "pasien", "skrining", "individu", "api"]):
                try:
                    body = res.text()
                except Exception:
                    body = "<binary/unreadable>"
                captured_responses.append({
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "status": res.status,
                    "url": res.url,
                    "body": body[:500] if body else ""
                })
                if res.status >= 400:
                    log(f"TERDETEKSI ERROR API [{res.status}]: {res.url}", "❌")
                    log(f"Payload respons: {body[:300]}", "  ↳")

        page.on("request", on_request)
        page.on("response", on_response)

        log("Menunggu halaman termuat dan menganalisis...")
        time.sleep(3)

        # 3. Analisis State DOM Web secara realtime
        def analyze_dom():
            try:
                return page.evaluate("""() => {
                    const res = {
                        url: window.location.href,
                        title: document.title,
                        bodySnippet: (document.body ? document.body.innerText : "").slice(0, 1500),
                        popupError: null,
                        activeFormStep: "Unknown",
                        step2Fields: [],
                        missingFields: [],
                        visibleButtons: [],
                        validationErrors: []
                    };

                    const bodyText = document.body ? document.body.innerText : "";

                    // Deteksi popup gagal simpan
                    if (bodyText.includes("Pendaftaran Gagal") || bodyText.includes("gagal disimpan") || bodyText.includes("Silakan coba beberapa saat lagi")) {
                        const modal = document.querySelector(".modal, [class*='modal'], [role='dialog'], [class*='popup'], [class*='alert']");
                        res.popupError = {
                            detected: true,
                            message: "Terdeteksi popup: 'Pendaftaran Gagal - Data pendaftaran gagal disimpan. Silakan coba beberapa saat lagi.'",
                            modalText: modal ? modal.innerText.trim() : "Teks popup ada di dalam body"
                        };
                    }

                    // Deteksi Step form
                    if (document.querySelector("#detail-domisili") || bodyText.includes("Status Pernikahan") || bodyText.includes("Data Pendukung") || bodyText.includes("Alamat Domisili")) {
                        res.activeFormStep = "Step 2: Data Pendukung & Domisili Pasien";
                    } else if (bodyText.includes("Masukkan NIK") || bodyText.includes("Tanggal Pemeriksaan") || bodyText.includes("Cek Data")) {
                        res.activeFormStep = "Step 1: Validasi NIK & Tanggal Pemeriksaan";
                    }

                    // Inspeksi field-field di Step 2
                    const checkField = (name, selector) => {
                        const el = document.querySelector(selector);
                        const isVisible = el && el.offsetParent !== null;
                        const val = el ? (el.value || el.innerText || el.textContent || "").trim() : "";
                        return { name, found: !!el, isVisible, value: val };
                    };

                    res.step2Fields.push(checkField("Alamat Detail (Textarea)", "#detail-domisili, textarea[placeholder*='domisili' i], textarea"));
                    
                    // Periksa dropdown di Step 2
                    const dropdownLabels = ["Status Pernikahan", "Pekerjaan", "Penyandang disabilitas", "Alamat Domisili", "Provinsi", "Kabupaten", "Kecamatan", "Kelurahan"];
                    dropdownLabels.forEach(lbl => {
                        const labelEl = Array.from(document.querySelectorAll("label, div, span")).find(e => {
                            const t = (e.textContent || "").trim();
                            return t === lbl || t === lbl + " *" || t.startsWith(lbl);
                        });
                        if (labelEl) {
                            const parent = labelEl.closest(".relative, .flex-col, .form-group, div") || labelEl.parentElement;
                            const trigger = parent ? parent.querySelector(".cursor-pointer, [role='combobox'], [class*='select']") : null;
                            const currentTxt = trigger ? trigger.innerText.trim() : "";
                            const isPlaceholder = /pilih/i.test(currentTxt) || !currentTxt;
                            res.step2Fields.push({
                                name: lbl,
                                found: true,
                                currentSelection: currentTxt,
                                isFilled: !isPlaceholder
                            });
                            if (isPlaceholder) {
                                res.missingFields.push(lbl);
                            }
                        }
                    });

                    // Periksa pesan error merah di bawah input
                    const errEls = Array.from(document.querySelectorAll(".text-red-500, .text-danger, [class*='error'], [aria-invalid='true']"));
                    errEls.forEach(err => {
                        const txt = (err.innerText || err.textContent || "").trim();
                        if (txt && txt.length > 2 && txt.length < 200 && !txt.includes("Silakan coba beberapa saat lagi")) {
                            res.validationErrors.push(txt);
                        }
                    });

                    // Periksa tombol-tombol yang aktif
                    const btns = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"));
                    res.visibleButtons = btns.map(b => {
                        const t = (b.innerText || b.value || b.textContent || "").trim().replace(/\\s+/g, " ");
                        return {
                            text: t,
                            disabled: b.disabled || b.classList.contains("disabled"),
                            type: b.type || "button",
                            visible: b.offsetParent !== null
                        };
                    }).filter(b => b.visible && b.text.length > 0);

                    return res;
                }""")
            except Exception as eval_err:
                return {"error": str(eval_err)}

        dom_analysis = analyze_dom()

        # Tampilkan Hasil Analisis di Konsol
        print("\n" + "=" * 80)
        print("HASIL DIAGNOSIS WEB PENDAFTARAN:")
        print("=" * 80)
        print(f"URL Halaman          : {dom_analysis.get('url', 'N/A')}")
        print(f"Tahap Formulir Aktif : {dom_analysis.get('activeFormStep', 'Unknown')}")
        
        if dom_analysis.get("popupError"):
            print(f"\n[⚠️ POPUP TERDETEKSI] : {dom_analysis['popupError']['message']}")
            print(f"Detail Isi Popup     : {dom_analysis['popupError']['modalText']}")

        print("\nSTATUS FIELD STEP 2:")
        for f in dom_analysis.get("step2Fields", []):
            if "currentSelection" in f:
                status_icon = "✓" if f["isFilled"] else "❌ KOSONG / BELUM DIPILIH"
                print(f"  - {f['name']:<25}: {f['currentSelection']} [{status_icon}]")
            else:
                status_icon = "✓ Terisi" if f["value"] else "❌ Belum Terisi"
                print(f"  - {f['name']:<25}: {f['value'][:30]} [{status_icon}]")

        if dom_analysis.get("missingFields"):
            print(f"\n[!] FIELD WAJIB YANG MASIH KOSONG:")
            for mf in dom_analysis["missingFields"]:
                print(f"  ❌ {mf}")

        if dom_analysis.get("validationErrors"):
            print(f"\n[!] VALIDASI MERAH DI BAWAH FIELD:")
            for ve in dom_analysis["validationErrors"]:
                print(f"  ⚠️ {ve}")

        print("\nTOMBOL YANG DITEMUKAN DI HALAMAN:")
        for btn in dom_analysis.get("visibleButtons", []):
            dis = " [DISABLED]" if btn["disabled"] else " [AKTIF]"
            print(f"  - [{btn['type']}] '{btn['text']}'{dis}")

        # Panduan bagi Pengguna
        print("\n" + "=" * 80)
        print("PENYEBAB UTAMA POPUP 'Data pendaftaran gagal disimpan':")
        print("1. KELURAHAN / DOMISILI TIDAK TUNTAS:")
        print("   - Pemilihan wilayah harus tuntas 4 tingkat: Provinsi -> Kota -> Kecamatan -> Kelurahan.")
        print("2. FIELD PEKERJAAN ATAU STATUS PERNIKAHAN BELUM TERCATAT:")
        print("   - Pada usia dewasa, field Pekerjaan dan Status Pernikahan wajib diisi.")
        print("3. KETIDAKCOCOKAN DUKCAPIL ATAU DUPLIKASI JADWAL:")
        print("   - NIK sudah pernah didaftarkan pada tanggal yang sama.")
        print("=" * 80)

        report_filename = f"laporan_deteksi_pendaftaran_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "analysis": dom_analysis,
                "captured_requests": captured_requests,
                "captured_responses": captured_responses
            }, f, indent=2, ensure_ascii=False)

        print(f"\n[✓] Laporan diagnostik lengkap disimpan ke: {report_filename}")
        print("\n[INFO] Detektor tetap aktif memantau klik di browser. Anda bisa melakukan interaksi langsung.")
        print("[INFO] Tekan Ctrl+C di terminal ini jika sudah selesai.")
        
        try:
            while True:
                time.sleep(2)
        except KeyboardInterrupt:
            print("\nDiagnostik dihentikan oleh pengguna.")
        finally:
            try:
                if not is_cdp and browser:
                    browser.close()
            except Exception:
                pass

if __name__ == "__main__":
    inspect_ckg_pendaftaran()
