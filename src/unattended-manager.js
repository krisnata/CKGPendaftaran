// Pengatur Ketahanan Otomasi Mandiri (Full Automation Unattended Mode)
// Mencegah sleep, menjaga service worker aktif, mengatasi tab discarding Chrome,
// dan pemulihan otomatis jika browser macet / koneksi terputus.

export class UnattendedManager {
  constructor() {
    this.isActive = false;
    this.alarmName = "CKG_UNATTENDED_HEARTBEAT";
  }

  // Mengaktifkan pencegah sleep CPU pada OS melalui chrome.power
  async enable() {
    this.isActive = true;
    try {
      if (chrome.power && chrome.power.requestKeepAwake) {
        chrome.power.requestKeepAwake("system");
      }
    } catch (e) {
      console.warn("chrome.power tidak didukung atau dibatasi:", e);
    }

    // Buat alarm periodik 1 menit agar Service Worker MV3 tidak dimatikan Chrome
    chrome.alarms.create(this.alarmName, { periodInMinutes: 1 });
    console.log("[Unattended] Mode Berjalan Sendiri AKTIF (Power keep-awake & Heartbeat alarm diaktifkan).");
  }

  // Melepaskan kunci daya saat dihentikan
  async disable() {
    this.isActive = false;
    try {
      if (chrome.power && chrome.power.releaseKeepAwake) {
        chrome.power.releaseKeepAwake();
      }
    } catch (e) {}

    chrome.alarms.clear(this.alarmName);
    console.log("[Unattended] Mode Berjalan Sendiri NONAKTIF.");
  }

  // Memastikan tab target tetap aktif dan tidak dibekukan (Discarded)
  static async ensureTabHealthy(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) return false;

      // Cegah discarding pada tab aktif jika API didukung
      if (chrome.tabs.update) {
        await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Deteksi jika pengguna ter-logout atau diarahkan ke halaman login
  static async checkSessionStatus(tabId) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const path = window.location.pathname.toLowerCase();
          const hasLoginBtn = Array.from(document.querySelectorAll("button, a")).some(el => {
            const txt = (el.textContent || "").toLowerCase().trim();
            return txt === "masuk" || txt === "login" || txt === "masuk dengan satusehat";
          });
          const isLoginPage = path.includes("login") || path.includes("auth") || hasLoginBtn;
          return {
            isLoggedIn: !isLoginPage,
            currentUrl: window.location.href
          };
        }
      });
      return res?.result ?? { isLoggedIn: true };
    } catch (e) {
      return { isLoggedIn: true }; // Jangan asumsikan logout jika tab belum siap
    }
  }
}

