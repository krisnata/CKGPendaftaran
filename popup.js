document.getElementById("btn-open-sidepanel")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && chrome.sidePanel && chrome.sidePanel.open) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  }
});

document.getElementById("btn-donate-popup")?.addEventListener("click", (e) => {
  e.preventDefault();
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL("donate.html") });
  } else {
    window.open("donate.html", "_blank");
  }
});
