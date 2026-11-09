window.addEventListener("message", e => {
  try {
    if (e.source !== window || !e.data?.__ckg) return;
    const { type: a, data: t } = e.data;
    if ("CKG_USER_ME" === a) {
      if (typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id && typeof chrome.runtime.sendMessage === "function") {
        try {
          const p = chrome.runtime.sendMessage({ type: a, data: t });
          if (p && typeof p.catch === "function") p.catch(() => {});
        } catch (_) {}
      }
    }
  } catch (_) {}
});
