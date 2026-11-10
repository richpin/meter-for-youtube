// Injected into YouTube pages: renders a time overlay in the top-right corner
// and, every second, tracks usage time (tab focus) and watch time (video playing).
//
// All three core design decisions live here:
//   (1) Metrics: usage = time the tab is visible and focused;
//       watch = time the <video> is playing
//   (2) SPA handling: keep the overlay alive via yt-navigate-finish + MutationObserver
//   (3) Overlay: fixed top-right, isolated from YouTube CSS with a Shadow DOM

(() => {
  const HOST_ID = "meter-for-youtube-host";
  const FLUSH_INTERVAL_SEC = 5; // how often to persist to storage (limits loss on tab close)
  const THEME_KEY = "__theme"; // "auto" | "light" | "dark", shared with the popup

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let themeMode = "auto";

  const { todayKey, LIMIT_KEY, DEFAULT_LIMIT, limitReached } = Meter;
  const ledgers = new Map();
  let ledger;
  let limit = DEFAULT_LIMIT;
  let ready = false;
  let initialChanges = {};
  let blocking = false;
  let redirecting = false;
  let changingDay = false;
  let valueEls = null;
  let tickCount = 0;
  document.documentElement.setAttribute("data-meter-checking", "");

  // ---- (1) Metric checks ----------------------------------------------------

  function isUsing() {
    // Tab is visible on screen and the browser window itself is focused
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function isWatching() {
    // Shorts keep several <video> elements mounted at once (the active short
    // plus preloaded neighbors), and the first in DOM order is usually paused.
    // Count the tick if ANY video is actively playing so both /watch and
    // /shorts are tracked.
    const videos = document.querySelectorAll("video");
    for (const video of videos) {
      if (!video.paused && !video.ended && video.readyState > 2) return true;
    }
    return false;
  }

  // ---- Display formatting ---------------------------------------------------

  function fmt(totalSec) {
    const s = Math.floor(totalSec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s % 60}s`;
  }

  function render() {
    if (!valueEls) return;
    if (!ledger) return;
    const { focus: curFocus, watch: curWatch } = ledger.total;
    valueEls.focus.textContent = fmt(curFocus);
    valueEls.watch.textContent = fmt(curWatch);
  }

  // ---- Theme ----------------------------------------------------------------

  // The overlay follows the same preference as the popup rather than YouTube's
  // own theme, so both surfaces always agree.
  function effectiveTheme() {
    if (themeMode === "light" || themeMode === "dark") return themeMode;
    return darkQuery.matches ? "dark" : "light";
  }

  function applyTheme() {
    const host = document.getElementById(HOST_ID);
    if (host) host.dataset.theme = effectiveTheme();
  }

  // ---- (3) Build overlay (Shadow DOM) ---------------------------------------

  function buildOverlay() {
    if (!ready || blocking || !document.body || document.getElementById(HOST_ID)) return;

    const host = document.createElement("div");
    host.id = HOST_ID;
    // The host only handles positioning; actual styling lives inside the shadow root.
    host.style.cssText =
      "position:fixed;top:64px;right:16px;z-index:2147483647;";
    host.dataset.theme = effectiveTheme();

    // Localized labels (falls back to default_locale when the browser locale is absent).
    const usageLabel = chrome.i18n.getMessage("usageLabel");
    const watchLabel = chrome.i18n.getMessage("watchLabel");

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        /* Light is the base; the dark steps are chosen for the dark surface.
           :host([data-theme]) is stamped from the shared preference. */
        :host {
          --bg: rgba(252, 252, 251, 0.92);
          --text: #0b0b0b;
          --text-2: #52514e;
          --watch: #eb6834;
          --shadow: rgba(11, 11, 11, 0.18);
        }
        :host([data-theme="dark"]) {
          --bg: rgba(15, 15, 15, 0.85);
          --text: #ffffff;
          --text-2: #c3c2b7;
          --watch: #d95926;
          --shadow: rgba(0, 0, 0, 0.4);
        }
        .box {
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          background: var(--bg);
          color: var(--text);
          border-radius: 10px;
          padding: 8px 12px;
          box-shadow: 0 2px 12px var(--shadow);
          backdrop-filter: blur(4px);
          user-select: none;
          line-height: 1.35;
          font-size: 13px;
          min-width: 96px;
        }
        .row { display: flex; justify-content: space-between; gap: 12px; }
        .row + .row { margin-top: 2px; }
        .label { color: var(--text-2); }
        .value { font-variant-numeric: tabular-nums; font-weight: 600; }
        .watch .value { color: var(--watch); }
      </style>
      <div class="box">
        <div class="row use">
          <span class="label">👀 ${usageLabel}</span>
          <span class="value" id="focus">--</span>
        </div>
        <div class="row watch">
          <span class="label">🎬 ${watchLabel}</span>
          <span class="value" id="watch">--</span>
        </div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(host);
    valueEls = {
      focus: shadow.getElementById("focus"),
      watch: shadow.getElementById("watch"),
    };
    render();
  }

  // ---- (2) SPA handling: re-attach the overlay if it disappears -------------

  function ensureOverlay() {
    if (!document.getElementById(HOST_ID)) {
      valueEls = null;
      buildOverlay();
    }
  }

  // ---- Tracking loop --------------------------------------------------------

  async function flushAll() {
    for (const [date, entry] of ledgers) {
      await entry.flush((message) => chrome.runtime.sendMessage(message));
      if (entry !== ledger && !entry.pending.focus && !entry.pending.watch) ledgers.delete(date);
    }
  }

  function save() {
    // Retain pending seconds on failure; the next tick/visibility change retries.
    void flushAll().catch((error) => console.warn("Meter: could not save usage", error));
  }

  function pauseVideos() {
    for (const video of document.querySelectorAll("video, audio")) video.pause();
  }

  async function enforceLimit() {
    if (!ready || changingDay) return;
    const reached = limitReached(limit, ledger.total.focus);
    if (!reached) {
      blocking = false;
      document.documentElement.removeAttribute("data-meter-blocking");
      ensureOverlay();
      return;
    }
    blocking = true;
    document.documentElement.setAttribute("data-meter-blocking", "");
    pauseVideos();
    if (redirecting) return;
    redirecting = true;
    try {
      await flushAll();
      // Settings may have changed, or midnight passed, while saving.
      if (todayKey() === ledger.date && limitReached(limit, ledger.total.focus)) {
        location.replace(chrome.runtime.getURL("src/blocked.html") + "#" + encodeURIComponent(location.href));
      }
    } catch (error) {
      console.warn("Meter: retrying final usage save", error);
    } finally {
      redirecting = false;
    }
  }

  async function tick(accrue = true) {
    if (!ready || changingDay) return;
    const date = todayKey();
    if (date !== ledger.date) {
      changingDay = true;
      try {
        const stored = await chrome.storage.local.get(date);
        ledger = new UsageLedger(date, stored[date]);
        ledgers.set(date, ledger);
        blocking = false;
        save();
      } catch (error) {
        console.warn("Meter: could not load today's usage", error);
        return;
      } finally {
        changingDay = false;
      }
    }
    if (!blocking && accrue) {
      if (isUsing()) ledger.pending.focus += 1;
      if (document.visibilityState === "visible" && isWatching()) ledger.pending.watch += 1;
    }
    render();
    await enforceLimit();
    tickCount += 1;
    if (tickCount % FLUSH_INTERVAL_SEC === 0) save();
  }

  async function init() {
    // Subscribe before the initial read; refreshes use the current date, including
    // on visibility changes after a suspended tab wakes up on a different day.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!ready) {
        Object.assign(initialChanges, changes);
        return;
      }
      if (changes[THEME_KEY]) {
        themeMode = changes[THEME_KEY].newValue || "auto";
        applyTheme();
      }
      if (changes[LIMIT_KEY]) limit = changes[LIMIT_KEY].newValue || DEFAULT_LIMIT;
      for (const [date, entry] of ledgers) {
        if (changes[date]) entry.update(changes[date].newValue || { focus: 0, watch: 0 });
      }
      render();
      if (todayKey() !== ledger.date) void tick(false);
      else void enforceLimit();
    });

    try {
      const date = todayKey();
      const stored = await chrome.storage.local.get([date, THEME_KEY, LIMIT_KEY]);
      // Include notifications delivered while the initial snapshot was loading.
      for (const [key, change] of Object.entries(initialChanges)) stored[key] = change.newValue;
      initialChanges = null;
      ledger = new UsageLedger(date, stored[date]);
      ledgers.set(date, ledger);
      limit = stored[LIMIT_KEY] || DEFAULT_LIMIT;
      themeMode = stored[THEME_KEY] || "auto";
      ready = true;
      await enforceLimit();
    } finally {
      document.documentElement.removeAttribute("data-meter-checking");
    }

    const attach = () => {
      ensureOverlay();
      const observer = new MutationObserver(() => {
        ensureOverlay();
        if (blocking) pauseVideos();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach, { once: true });
    else attach();

    darkQuery.addEventListener("change", () => {
      if (themeMode === "auto") applyTheme();
    });
    setInterval(() => { void tick(); }, 1000);
    document.addEventListener("yt-navigate-finish", ensureOverlay);
    document.addEventListener("play", (event) => {
      if (blocking && event.target instanceof HTMLMediaElement) event.target.pause();
    }, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") save();
      else void tick(false);
    });
    window.addEventListener("pagehide", save);
  }

  void init().catch((error) => console.warn("Meter: initialization failed", error));
})();
