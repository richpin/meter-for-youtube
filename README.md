<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Meter for YouTube icon" />
</p>

<h1 align="center">Meter for YouTube</h1>

<p align="center">
  See how much of your day YouTube is really taking — live, on the page.
</p>

A Chrome extension that shows **how much time you've spent today** in real time at the top-right of the YouTube screen. It doesn't block anything — it just keeps the current state visible so you can pace yourself.

## What it shows

**On the page** — a top-right overlay with two stacked times:

- **👀 Usage** — total time spent on a YouTube tab (browsing, searching, comments included)
- **🎬  Watch** — time a video is actually playing

The gap between the two is **time leaked into browsing.**

**In the popup** — click the toolbar icon for the trends dashboard:

- Summary tiles for today's usage, today's watch, and daily average usage
- A line chart of usage vs watch across days, so the trend and the leak gap are visible over time
- 7 / 30 / 90-day range toggle

## Privacy

All data stays in your own browser and Google account. Nothing is sent to any third party. A backup copy is kept in `chrome.storage.sync` so your history survives a reinstall, and records older than 90 days are cleaned up automatically.

## Languages & theme

- The UI follows your browser's language automatically (English and Korean bundled).
- Light and dark themes are supported on both the overlay and the popup — **Auto** follows your OS setting, or pick **Light** / **Dark** from the popup footer.

## Structure

```
manifest.json      # MV3 config
_locales/          # en (default) + ko translations
src/
  content.js       # overlay render + time tracking
  background.js    # service worker, per-date accumulation
  popup.html       # dashboard layout + styles
  popup.js         # storage read + SVG trend chart
icons/             # 16 / 48 / 128px
```
