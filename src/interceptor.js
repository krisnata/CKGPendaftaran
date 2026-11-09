// Interceptor CKG untuk Auto-Capture Pendaftaran, Tiket, Validasi, dan Pelayanan
(function() {
  if (window.__ckgInterceptorInstalled) return;
  window.__ckgInterceptorInstalled = true;

  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
      let reqPayload = null;
      if (args[1] && args[1].body) {
        try {
          reqPayload = typeof args[1].body === "string" ? JSON.parse(args[1].body) : args[1].body;
        } catch (e) {
          reqPayload = args[1].body;
        }
      }

      // 1. Intercept Detail Screening Caching (diperlukan oleh automation.js)
      if (url.includes("detail-screening") || url.includes("get-screening")) {
        window.__ckgDetailScreeningAt = Date.now();
        res.clone().json().then(data => {
          window.__ckgCache = window.__ckgCache ?? {};
          window.__ckgCache.detailScreening = data;
          window.__ckgDetailScreeningBody = data;
          window.__ckgDetailScreeningBodyAt = Date.now();
        }).catch(() => {});
      }

      // 2. Intercept User Info
      if (url.includes("user-management/me")) {
        res.clone().json().then(data => {
          if (typeof data?._d === "string") {
            window.postMessage({ type: "CKG_USER_ME", encrypted: data, __ckg: true }, "*");
          } else if (data?.statusCode === 200 && data?.data) {
            window.postMessage({ type: "CKG_USER_ME", data: data.data, __ckg: true }, "*");
          }
        }).catch(() => {});
      }

      // 3. Intercept Pendaftaran Sukses & Terbit Tiket (/api/pkg/ssi/register-ckg)
      if (url.includes("/api/pkg/ssi/register-ckg")) {
        res.clone().json().then(data => {
          window.postMessage({
            type: "CKG_CAPTURED_REGISTRATION",
            __ckg: true,
            url,
            status: res.status,
            requestPayload: reqPayload,
            responseBody: data,
            timestamp: Date.now()
          }, "*");
        }).catch(() => {});
      }

      // 4. Intercept Validasi Pra-Daftar (/api/pkg/ssi/register-pre atau /api/pkg/validasi/data-pasien)
      if (url.includes("/api/pkg/ssi/register-pre") || url.includes("/api/pkg/validasi/data-pasien")) {
        res.clone().json().then(data => {
          window.postMessage({
            type: "CKG_CAPTURED_VALIDATION",
            __ckg: true,
            url,
            status: res.status,
            requestPayload: reqPayload,
            responseBody: data,
            timestamp: Date.now()
          }, "*");
        }).catch(() => {});
      }

      // 5. Intercept Check NIK
      if (url.includes("/api/pkg/ssi/check-nik")) {
        res.clone().json().then(data => {
          window.postMessage({
            type: "CKG_CAPTURED_CHECK_NIK",
            __ckg: true,
            url,
            status: res.status,
            requestPayload: reqPayload,
            responseBody: data,
            timestamp: Date.now()
          }, "*");
        }).catch(() => {});
      }

      // 6. Intercept Pelayanan Selesai / Submit Skrining
      if (url.includes("/api/pkg/ssi/finish-layanan") ||
          url.includes("/api/pkg/ssi/selesaikan-layanan") ||
          (url.includes("submit") && url.includes("skrining-layanan"))) {
        res.clone().json().then(data => {
          window.postMessage({
            type: "CKG_CAPTURED_PELAYANAN",
            __ckg: true,
            url,
            status: res.status,
            requestPayload: reqPayload,
            responseBody: data,
            timestamp: Date.now()
          }, "*");
        }).catch(() => {});
      }
    } catch (e) {}

    return res;
  };

  // Patch XMLHttpRequest jika CKG memakai Axios / XHR
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__ckgUrl = typeof url === "string" ? url : "";
    return origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(body) {
    let reqPayload = null;
    if (body) {
      try {
        reqPayload = typeof body === "string" ? JSON.parse(body) : body;
      } catch (e) {
        reqPayload = body;
      }
    }

    this.addEventListener("load", () => {
      try {
        const url = this.__ckgUrl || "";
        if (!url) return;

        let responseBody = null;
        try {
          responseBody = JSON.parse(this.responseText);
        } catch (e) {}

        if ((url.includes("detail-screening") || url.includes("get-screening")) && responseBody) {
          window.__ckgDetailScreeningAt = Date.now();
          window.__ckgCache = window.__ckgCache ?? {};
          window.__ckgCache.detailScreening = responseBody;
          window.__ckgDetailScreeningBody = responseBody;
          window.__ckgDetailScreeningBodyAt = Date.now();
        } else if (url.includes("/api/pkg/ssi/register-ckg") && responseBody) {
          window.postMessage({
            type: "CKG_CAPTURED_REGISTRATION",
            __ckg: true,
            url,
            status: this.status,
            requestPayload: reqPayload,
            responseBody,
            timestamp: Date.now()
          }, "*");
        } else if ((url.includes("/api/pkg/ssi/register-pre") || url.includes("/api/pkg/validasi/data-pasien")) && responseBody) {
          window.postMessage({
            type: "CKG_CAPTURED_VALIDATION",
            __ckg: true,
            url,
            status: this.status,
            requestPayload: reqPayload,
            responseBody,
            timestamp: Date.now()
          }, "*");
        } else if (url.includes("/api/pkg/ssi/check-nik") && responseBody) {
          window.postMessage({
            type: "CKG_CAPTURED_CHECK_NIK",
            __ckg: true,
            url,
            status: this.status,
            requestPayload: reqPayload,
            responseBody,
            timestamp: Date.now()
          }, "*");
        } else if ((url.includes("finish-layanan") || (url.includes("submit") && url.includes("skrining-layanan"))) && responseBody) {
          window.postMessage({
            type: "CKG_CAPTURED_PELAYANAN",
            __ckg: true,
            url,
            status: this.status,
            requestPayload: reqPayload,
            responseBody,
            timestamp: Date.now()
          }, "*");
        }
      } catch (e) {}
    });

    return origXhrSend.call(this, body);
  };

  // 7. Watchdog Otomatis: Deteksi Popup 'Memuat data..' (spinner_ajPY / bg-blackSoft) yang macet
  (function initLoadingStuckWatchdog() {
    if (window.__ckgLoadingWatchdogInstalled) return;
    window.__ckgLoadingWatchdogInstalled = true;

    let stuckStartTime = null;
    let isReloading = false;
    let lastReloadTime = 0;

    function findMemuatDataElement() {
      // 1. Selector via class .spinner_ajPY pada SVG / Path
      const spinner = document.querySelector(".spinner_ajPY, path.spinner_ajPY, svg.spinner_ajPY");
      if (spinner) {
        const box = spinner.closest(".bg-blackSoft, [class*='bg-blackSoft'], .z-110, [class*='z-110'], div");
        if (box && (box.textContent || "").toLowerCase().includes("memuat data")) {
          return box;
        }
      }

      // 2. Selector via container .bg-blackSoft
      const blackBoxes = Array.from(document.querySelectorAll(".bg-blackSoft, [class*='bg-blackSoft']"));
      for (const box of blackBoxes) {
        if ((box.textContent || "").toLowerCase().includes("memuat data")) {
          return box;
        }
      }

      // 3. Selector via teks langsung 'Memuat data..' di dalam container floating
      const candidates = Array.from(document.querySelectorAll("div, span, p"));
      for (const el of candidates) {
        const txt = (el.textContent || "").trim().toLowerCase();
        if (txt === "memuat data.." || txt === "memuat data..." || txt === "memuat data") {
          const parent = el.closest(".z-110, [class*='z-110'], .bg-blackSoft, [class*='bg-blackSoft'], .backdrop-blur-sm, div");
          if (parent && (parent.querySelector("svg") || (parent.className || "").includes("blackSoft") || (parent.className || "").includes("z-110"))) {
            return parent;
          }
        }
      }

      return null;
    }

    window.__ckgCheckMemuatData = findMemuatDataElement;

    // Polling setiap 500ms untuk memonitor keberadaan popup spinner
    setInterval(() => {
      if (isReloading) return;

      const loader = findMemuatDataElement();
      const isVisible = !!(loader && (loader.offsetWidth > 0 || loader.offsetHeight > 0 || loader.getClientRects().length > 0));

      if (isVisible) {
        if (!stuckStartTime) {
          stuckStartTime = Date.now();
        } else {
          const elapsed = Date.now() - stuckStartTime;
          // Ambang batas toleransi:
          // Pada halaman detail pemeriksaan atau saat proses form berlangsung, respons server Kemkes wajar butuh 5-10 detik.
          // Jadi batas macet ditetapkan 18 detik pada detail-pemeriksaan dan 12 detik pada antrean, agar tidak memotong loading normal!
          const timeoutLimit = window.location.href.includes("detail-pemeriksaan") ? 18000 : 12000;

          if (elapsed >= timeoutLimit) {
            const now = Date.now();
            if (now - lastReloadTime < 30000) {
              return;
            }

            isReloading = true;
            lastReloadTime = now;
            console.log(`[CKG-Watchdog] Terdeteksi popup 'Memuat data..' macet selama ${elapsed}ms (melebihi ${timeoutLimit}ms). Me-refresh halaman otomatis...`);
            window.postMessage({
              type: "CKG_LOADING_REFRESH",
              __ckg: true,
              elapsed,
              url: window.location.href,
              timestamp: now
            }, "*");
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }
      } else {
        stuckStartTime = null;
      }
    }, 500);
  })();
})();