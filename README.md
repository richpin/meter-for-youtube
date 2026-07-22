# Meter for YouTube

A Chrome extension that shows **how much time you've spent today** in real time at the top-right of the YouTube screen.
It doesn't block anything — it just keeps the current state visible so you can pace yourself.

## What it shows

The top-right overlay displays two times, stacked:

- **▶ Usage** — total time you actually spend looking at a YouTube tab (browsing, searching, comments included)
- **👁 Watch** — time a video is actually playing

The gap between the two is **"time leaked into browsing."**

## How it works

- **Usage time**: only counts seconds while the tab is visible (`visibilityState`) and the window is focused (`hasFocus`)
- **Watch time**: only counts seconds while the page's `<video>` is playing
- Counts in 1-second increments and accumulates to `chrome.storage.local` by date every few seconds
- All data is stored locally only and never sent anywhere
- YouTube is an SPA with no reload on navigation, so `yt-navigate-finish` and a `MutationObserver` keep the overlay alive
- The overlay is isolated in a Shadow DOM so it doesn't conflict with YouTube's CSS

## Install (developer mode)

1. Go to `chrome://extensions`
2. Turn on **Developer mode** at the top-right
3. Click **Load unpacked**
4. Select this folder
5. Open YouTube → confirm the time overlay appears at the top-right

There is no build step. After editing the code, just click the refresh icon on the extensions page to apply changes.

## Structure

```
manifest.json      # MV3 config
src/
  content.js       # overlay render + time tracking
  background.js    # service worker, per-date accumulation
icons/             # 16 / 48 / 128px (placeholders)
```

## Storage format

```json
{ "2026-07-16": { "focus": 4980, "watch": 2820 } }
```

`focus` = usage time (seconds), `watch` = watch time (seconds). Records older than 90 days are cleaned up automatically.

## Status

MVP — currently shows today's usage/watch time as an overlay. Intervention features like color changes and threshold alerts are planned after real-world use.
