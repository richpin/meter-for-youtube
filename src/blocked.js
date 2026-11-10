(() => {
  const { LIMIT_KEY, DEFAULT_LIMIT, todayKey, limitReached } = Meter;
  let checking = false;
  let checkAgain = false;
  let returning = false;

  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
  });
  document.title = `${chrome.i18n.getMessage("blockedTitle")} — Meter for YouTube`;

  function originalURL() {
    try {
      const url = new URL(decodeURIComponent(location.hash.slice(1)));
      if ((url.protocol === "https:" || url.protocol === "http:") &&
          (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"))) return url.href;
    } catch { /* A direct visit without a return address stays on this page. */ }
    return null;
  }

  async function check() {
    if (returning) return;
    if (checking) {
      checkAgain = true;
      return;
    }
    checking = true;
    try {
      do {
        checkAgain = false;
        const date = todayKey();
        const stored = await chrome.storage.local.get([date, LIMIT_KEY, "__theme"]);
        const theme = stored.__theme || "auto";
        if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
        else delete document.documentElement.dataset.theme;
        if (date !== todayKey()) { checkAgain = true; continue; }
        const url = originalURL();
        if (url && !limitReached(stored[LIMIT_KEY] || DEFAULT_LIMIT, stored[date]?.focus || 0)) {
          returning = true;
          location.replace(url);
        }
      } while (checkAgain && !returning);
    } catch (error) {
      console.warn("Meter: could not check daily limit", error);
    } finally {
      checking = false;
    }
  }

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") void check();
  });
  // Page timers can be suspended; recheck on focus/visibility as well as ticks.
  document.addEventListener("visibilitychange", () => { void check(); });
  window.addEventListener("focus", () => { void check(); });
  window.addEventListener("pageshow", () => { void check(); });
  setInterval(() => { void check(); }, 1000);
  void check();
})();
