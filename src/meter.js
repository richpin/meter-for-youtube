// Shared policy for the popup, content script, and break page.
globalThis.Meter = (() => {
  const LIMIT_KEY = "__dailyLimit";
  const DEFAULT_LIMIT = Object.freeze({ enabled: false, minutes: 60 });

  function todayKey(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function validMinutes(minutes) {
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1439;
  }

  function limitReached(limit, usage) {
    return limit?.enabled === true && validMinutes(limit.minutes) && usage >= limit.minutes * 60;
  }

  return { LIMIT_KEY, DEFAULT_LIMIT, todayKey, validMinutes, limitReached };
})();
