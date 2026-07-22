# Meter for YouTube

A Chrome extension that shows **how much time you've spent today** in real time at the top-right of the YouTube screen.
It doesn't block anything — it just keeps the current state visible so you can pace yourself.

## What it shows

**On the page** — a top-right overlay with two times, stacked:

- **▶ Usage** — total time you actually spend looking at a YouTube tab (browsing, searching, comments included)
- **👁 Watch** — time a video is actually playing

The gap between the two is **"time leaked into browsing."**

**In the popup** — click the toolbar icon for the trends dashboard:

- Summary tiles for today's usage, today's watch, and daily average usage
- A line chart of usage vs watch across days, so the trend and the leak gap are visible over time
- 7 / 30 / 90-day range toggle

## How it works

- **Usage time**: only counts seconds while the tab is visible (`visibilityState`) and the window is focused (`hasFocus`)
- **Watch time**: only counts seconds while the page's `<video>` is playing
- Counts in 1-second increments and accumulates to `chrome.storage.local` by date every few seconds
- All data is stored locally only and never sent anywhere
- YouTube is an SPA with no reload on navigation, so `yt-navigate-finish` and a `MutationObserver` keep the overlay alive
- The overlay is isolated in a Shadow DOM so it doesn't conflict with YouTube's CSS
- The dashboard chart is hand-rolled inline SVG — no chart library, no build step

## Languages

Uses Chrome's native i18n, so the UI follows the browser's language automatically.

- Translations live in `_locales/<locale>/messages.json`
- `en` is the default locale; `ko` is also bundled
- Adding a language means dropping in a new `_locales/<code>/messages.json` — no code changes

Every key used in code must exist in each locale file, or `chrome.i18n.getMessage` returns an empty string.

## Install (developer mode)

1. Go to `chrome://extensions`
2. Turn on **Developer mode** at the top-right
3. Click **Load unpacked**
4. Select this folder
5. Open YouTube → confirm the time overlay appears at the top-right
6. Click the toolbar icon → confirm the trends dashboard opens

There is no build step. After editing the code, just click the refresh icon on the extensions page to apply changes.

## Structure

```
manifest.json      # MV3 config
_locales/
  en/messages.json # default locale
  ko/messages.json # Korean
src/
  content.js       # overlay render + time tracking
  background.js    # service worker, per-date accumulation
  popup.html       # dashboard layout + styles
  popup.js         # storage read + SVG trend chart
icons/             # 16 / 48 / 128px (placeholders)
```

## Storage format

```json
{ "2026-07-16": { "focus": 4980, "watch": 2820 } }
```

`focus` = usage time (seconds), `watch` = watch time (seconds). Records older than 90 days are cleaned up automatically.

To inspect or edit the data, open the service worker DevTools from `chrome://extensions`, then use
**Application → Storage → Extension storage → Local**, or the console:

```js
chrome.storage.local.get(null, console.log)   // view all days
chrome.storage.local.remove("2026-07-16")     // delete one day
```

## Status

MVP — overlay plus a trends dashboard. Intervention features like color changes and threshold alerts are planned after real-world use.
