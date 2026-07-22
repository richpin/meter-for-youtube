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

  // Today's totals (seconds): baseline loaded from storage + this session's accumulation.
  let baseline = { focus: 0, watch: 0 };
  let session = { focus: 0, watch: 0 }; // accumulated since this page opened
  let flushed = { focus: 0, watch: 0 }; // portion already sent to storage

  let valueEls = null; // { focus, watch } — the number spans inside the overlay
  let tickCount = 0;

  // ---- (1) Metric checks ----------------------------------------------------

  function isUsing() {
    // Tab is visible on screen and the browser window itself is focused
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function isWatching() {
    const video = document.querySelector("video");
    if (!video) return false;
    return !video.paused && !video.ended && video.readyState > 2;
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
    valueEls.focus.textContent = fmt(baseline.focus + session.focus);
    valueEls.watch.textContent = fmt(baseline.watch + session.watch);
  }

  // ---- (3) Build overlay (Shadow DOM) ---------------------------------------

  function buildOverlay() {
    if (document.getElementById(HOST_ID)) return; // skip if already present

    const host = document.createElement("div");
    host.id = HOST_ID;
    // The host only handles positioning; actual styling lives inside the shadow root.
    host.style.cssText =
      "position:fixed;top:64px;right:16px;z-index:2147483647;";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .box {
          font-family: "Roboto", Arial, sans-serif;
          background: rgba(15, 15, 15, 0.85);
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          user-select: none;
          line-height: 1.35;
          font-size: 13px;
          min-width: 96px;
        }
        .row { display: flex; justify-content: space-between; gap: 12px; }
        .row + .row { margin-top: 2px; }
        .label { opacity: 0.7; }
        .value { font-variant-numeric: tabular-nums; font-weight: 600; }
        .watch .value { color: #7ecbff; }
      </style>
      <div class="box">
        <div class="row use">
          <span class="label">▶ 이용</span>
          <span class="value" id="focus">--</span>
        </div>
        <div class="row watch">
          <span class="label">👁 시청</span>
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

  function tick() {
    if (isUsing()) session.focus += 1;
    if (isWatching()) session.watch += 1;
    render();

    tickCount += 1;
    if (tickCount % FLUSH_INTERVAL_SEC === 0) flush();
  }

  function flush() {
    const focusDelta = session.focus - flushed.focus;
    const watchDelta = session.watch - flushed.watch;
    if (focusDelta === 0 && watchDelta === 0) return;

    chrome.runtime.sendMessage(
      { type: "ADD_TIME", focus: focusDelta, watch: watchDelta },
      () => {
        // Only advance `flushed` after a successful save; otherwise the next flush retries.
        if (chrome.runtime.lastError) return;
        flushed.focus = session.focus;
        flushed.watch = session.watch;
      }
    );
  }

  // ---- Init -----------------------------------------------------------------

  function init() {
    chrome.runtime.sendMessage({ type: "GET_TODAY" }, (day) => {
      if (chrome.runtime.lastError || !day) return;
      baseline = { focus: day.focus || 0, watch: day.watch || 0 };
      render();
    });

    buildOverlay();

    // 1-second tracking tick
    setInterval(tick, 1000);

    // (2) SPA navigation: check the overlay each time YouTube swaps the page
    document.addEventListener("yt-navigate-finish", ensureOverlay);

    // Safety net: re-attach if the overlay host gets removed entirely
    const observer = new MutationObserver(ensureOverlay);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Final save when leaving or right before the tab closes
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }

  init();
})();
