// Popup dashboard: reads the per-date totals written by background.js and draws
// a line chart of usage vs watch time so trends across days are visible.
//
// Storage is read directly (the popup runs in the extension context and the
// manifest already grants "storage"), so no background message is needed.

(() => {
  const DEFAULT_RANGE = 30;
  const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

  // Chart geometry (viewBox units; the SVG scales to the popup width)
  const W = 360, H = 180;
  const PAD = { left: 38, right: 8, top: 10, bottom: 24 };
  const INNER_W = W - PAD.left - PAD.right;
  const INNER_H = H - PAD.top - PAD.bottom;

  let history = {}; // { "2026-07-22": { focus, watch }, ... }
  let rangeDays = DEFAULT_RANGE;

  // ---- Helpers --------------------------------------------------------------

  function dateKey(d) {
    // Local date, matching how background.js keys its records.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function fmtDuration(totalSec) {
    const s = Math.floor(totalSec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  // Adaptive axis unit: hours once the range is large enough, minutes below that.
  function fmtAxis(sec, maxY) {
    if (maxY >= 3600) {
      const h = sec / 3600;
      return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
    }
    return `${Math.round(sec / 60)}m`;
  }

  // Round the axis top up to a readable duration instead of a raw maximum.
  function niceMax(v) {
    if (v <= 0) return 600;
    const steps = [60, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200];
    for (const s of steps) if (v <= s) return s;
    return Math.ceil(v / 3600) * 3600;
  }

  function shortDate(d) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // Build a continuous day series so gaps render as zero rather than collapsing.
  function buildSeries() {
    const today = new Date();
    const series = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const rec = history[dateKey(d)] || {};
      series.push({ date: d, focus: rec.focus || 0, watch: rec.watch || 0 });
    }
    return series;
  }

  // ---- Rendering ------------------------------------------------------------

  function renderSummary(series) {
    const today = series[series.length - 1];
    document.getElementById("today-usage").textContent = fmtDuration(today.focus);
    document.getElementById("today-watch").textContent = fmtDuration(today.watch);

    // Average over active days only — inactive days would drag the number to zero.
    const active = series.filter((d) => d.focus > 0);
    const avg = active.length
      ? active.reduce((sum, d) => sum + d.focus, 0) / active.length
      : 0;
    document.getElementById("avg-usage").textContent = active.length ? fmtDuration(avg) : "--";
  }

  function renderChart(series) {
    const wrap = document.getElementById("chart-wrap");

    if (series.every((d) => d.focus === 0 && d.watch === 0)) {
      wrap.innerHTML = `<div class="empty">${chrome.i18n.getMessage("noData")}</div>`;
      return;
    }

    const n = series.length;
    const maxY = niceMax(Math.max(...series.map((d) => d.focus)));
    const x = (i) => (n === 1 ? PAD.left + INNER_W / 2 : PAD.left + (i / (n - 1)) * INNER_W);
    const y = (v) => PAD.top + INNER_H - (v / maxY) * INNER_H;

    const points = (key) =>
      series.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

    const grid = [0, maxY / 2, maxY]
      .map(
        (v) => `
        <line class="grid-line" x1="${PAD.left}" y1="${y(v).toFixed(1)}" x2="${W - PAD.right}" y2="${y(v).toFixed(1)}" />
        <text class="axis" x="${PAD.left - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtAxis(v, maxY)}</text>`
      )
      .join("");

    // Only first / middle / last dates, so labels never collide on a 90-day range.
    const labelIdx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
    const xLabels = labelIdx
      .map((i) => {
        const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        return `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}">${shortDate(series[i].date)}</text>`;
      })
      .join("");

    // Point markers only on short ranges; at 30+ days they turn into noise.
    const dots =
      n <= 14
        ? series
            .map(
              (d, i) => `
        <circle class="dot-usage" cx="${x(i).toFixed(1)}" cy="${y(d.focus).toFixed(1)}" r="2.5" />
        <circle class="dot-watch" cx="${x(i).toFixed(1)}" cy="${y(d.watch).toFixed(1)}" r="2.5" />`
            )
            .join("")
        : "";

    wrap.innerHTML = `
      <svg id="chart" viewBox="0 0 ${W} ${H}">
        ${grid}
        <polyline class="line usage" points="${points("focus")}" />
        <polyline class="line watch" points="${points("watch")}" />
        ${dots}
        ${xLabels}
      </svg>`;
  }

  function render() {
    const series = buildSeries();
    renderSummary(series);
    renderChart(series);
  }

  // ---- Init -----------------------------------------------------------------

  function localize() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
    });
  }

  function bindRanges() {
    document.getElementById("ranges").addEventListener("click", (e) => {
      const btn = e.target.closest(".range-btn");
      if (!btn) return;
      rangeDays = Number(btn.dataset.days);
      document
        .querySelectorAll(".range-btn")
        .forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  }

  async function init() {
    localize();
    bindRanges();

    const all = await chrome.storage.local.get(null);
    history = {};
    for (const [k, v] of Object.entries(all)) {
      if (DATE_KEY.test(k)) history[k] = v; // ignore any non-date keys
    }
    render();
  }

  init();
})();
