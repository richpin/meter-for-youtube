// Service worker responsible for aggregating time.
// Accumulates the per-second deltas sent by the content script, keyed by date.
//
// storage shape (both local and sync):
//   { "2026-07-16": { focus: 1234, watch: 567 }, ... }   (values in seconds)
//   focus = usage time (tab focused), watch = watch time (video playing)
//
// Two stores are used on purpose:
//   local — the hot store. Written on every flush; no meaningful write quota.
//   sync  — the durable copy. chrome.storage.local is destroyed when the
//           extension is uninstalled, while sync lives in the user's Google
//           account and comes back on reinstall. The published store build has
//           a permanent extension ID, so the account data still matches after
//           a reinstall.
// sync is only mirrored occasionally because it caps writes (1800/hour).

const RETENTION_DAYS = 90; // entries older than this are pruned automatically
const SYNC_THRESHOLD_SEC = 60; // mirror to sync once this much new time accrues
const LAST_SYNC_KEY = "__lastSync"; // local-only bookkeeping, not a date record
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function todayKey() {
  // toISOString() is UTC-based and rolls the day near midnight. Use the local date.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Sync can fail (offline, quota, sign-out). It is a backup, so never let a
// failure there break local tracking.
async function mirrorToSync(key, day) {
  try {
    await chrome.storage.sync.set({ [key]: day });
    await chrome.storage.local.set({
      [LAST_SYNC_KEY]: { date: key, focus: day.focus, watch: day.watch },
    });
  } catch (e) {
    // Keep going; the next threshold crossing retries.
  }
}

async function addTime(focusDelta, watchDelta, dateKeyOverride) {
  const key = dateKeyOverride || todayKey();
  const stored = await chrome.storage.local.get([key, LAST_SYNC_KEY]);
  const day = stored[key] || { focus: 0, watch: 0 };
  day.focus += focusDelta;
  day.watch += watchDelta;
  await chrome.storage.local.set({ [key]: day });

  // Throttle on accumulated seconds rather than call count, so extra YouTube
  // tabs (which all flush independently) cannot multiply the sync write rate.
  const last = stored[LAST_SYNC_KEY];
  const lastTotal =
    last && last.date === key ? (last.focus || 0) + (last.watch || 0) : 0;
  if (day.focus + day.watch - lastTotal >= SYNC_THRESHOLD_SEC) {
    await mirrorToSync(key, day);
  }

  return day;
}

async function getToday() {
  const key = todayKey();
  const stored = await chrome.storage.local.get(key);
  return stored[key] || { focus: 0, watch: 0 };
}

// Pull the account copy back into local — this is what restores history after
// a reinstall, when local starts empty.
async function restoreFromSync() {
  let synced;
  try {
    synced = await chrome.storage.sync.get(null);
  } catch (e) {
    return; // no sync available; local stays as-is
  }

  const local = await chrome.storage.local.get(null);
  const merged = {};

  for (const [key, remote] of Object.entries(synced)) {
    if (!DATE_KEY.test(key)) continue;
    const mine = local[key];
    // Take the larger side per metric: this device may have tracked time that
    // never made it to sync, and sync may hold days this device never saw.
    const focus = Math.max(remote.focus || 0, (mine && mine.focus) || 0);
    const watch = Math.max(remote.watch || 0, (mine && mine.watch) || 0);
    if (!mine || mine.focus !== focus || mine.watch !== watch) {
      merged[key] = { focus, watch };
    }
  }

  if (Object.keys(merged).length) await chrome.storage.local.set(merged);
}

async function pruneOldEntries() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const isStale = (k) => DATE_KEY.test(k) && new Date(k) < cutoff;

  const local = await chrome.storage.local.get(null);
  const staleLocal = Object.keys(local).filter(isStale);
  if (staleLocal.length) await chrome.storage.local.remove(staleLocal);

  try {
    const synced = await chrome.storage.sync.get(null);
    const staleSync = Object.keys(synced).filter(isStale);
    if (staleSync.length) await chrome.storage.sync.remove(staleSync);
  } catch (e) {
    // sync unavailable; local pruning already happened
  }
}

// Only transient work coordination lives in memory. All totals remain in storage.
// Queue every read/modify/write, including restore, so concurrent tabs cannot
// overwrite one another's seconds. A failed operation must not poison the queue.
let work = Promise.resolve();
function enqueue(operation) {
  const result = (async () => {
    await work;
    return operation();
  })();
  work = (async () => {
    try { await result; } catch { /* caller receives the error */ }
  })();
  return result;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "ADD_TIME" && msg.type !== "GET_TODAY") return;
  void (async () => {
    try {
      const day = await enqueue(() => msg.type === "ADD_TIME"
        ? addTime(msg.focus || 0, msg.watch || 0, msg.date)
        : getToday());
      sendResponse(day);
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })();
  return true;
});

// Restore before pruning so recovered days are pruned by the same rule.
async function bootstrap() {
  await restoreFromSync();
  await pruneOldEntries();
}

function start() {
  void enqueue(bootstrap).catch((error) => console.warn("Meter: startup failed", error));
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
