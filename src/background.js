// Service worker responsible for aggregating time.
// Accumulates the per-second deltas sent by the content script, keyed by date.
//
// storage shape:
//   { "2026-07-16": { focus: 1234, watch: 567 }, ... }   (values in seconds)
//   focus = usage time (tab focused), watch = watch time (video playing)

const RETENTION_DAYS = 90; // entries older than this are pruned automatically

function todayKey() {
  // toISOString() is UTC-based and rolls the day near midnight. Use the local date.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function addTime(focusDelta, watchDelta) {
  const key = todayKey();
  const stored = await chrome.storage.local.get(key);
  const day = stored[key] || { focus: 0, watch: 0 };
  day.focus += focusDelta;
  day.watch += watchDelta;
  await chrome.storage.local.set({ [key]: day });
  return day;
}

async function getToday() {
  const key = todayKey();
  const stored = await chrome.storage.local.get(key);
  return stored[key] || { focus: 0, watch: 0 };
}

async function pruneOldEntries() {
  const all = await chrome.storage.local.get(null);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const stale = Object.keys(all).filter((k) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false; // only date keys
    return new Date(k) < cutoff;
  });

  if (stale.length) await chrome.storage.local.remove(stale);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ADD_TIME") {
    addTime(msg.focus || 0, msg.watch || 0).then((day) => sendResponse(day));
    return true; // keep the channel open for the async response
  }
  if (msg.type === "GET_TODAY") {
    getToday().then((day) => sendResponse(day));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(pruneOldEntries);
chrome.runtime.onStartup.addListener(pruneOldEntries);
