# Chrome Web Store Listing — Meter for YouTube

Last Updated: 2026-11-10

## Store Listing

**Extension Name:** Meter for YouTube

**Short Description:** Track today’s YouTube usage and watch time live, and set an optional daily usage limit.

**Detailed Description:**

See how much of your day YouTube is taking, with live usage and watch times shown
on the page. Compare daily trends over 7, 30, or 90 days in the toolbar popup.

Choose hours and minutes while the daily usage limit is off, then switch it on.
Turn it off again to change the time. When you reach the limit, playback stops
and a quiet break page replaces YouTube. Your allowance starts again at local
midnight. The limit is off until you enable it.

English and Korean are supported, with automatic, light, and dark themes.
Your daily totals stay in your browser and your own Google account backup.
Your settings stay on this device. Nothing is sent to the developer.

**Category:** Productivity

**Single Purpose:** Help users manage time spent on YouTube by showing usage and enforcing an optional daily usage limit.

**Primary Language:** English; Korean also bundled.

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|------------|--------|----------|
| Store icon | 128×128 PNG | Existing | icons/icon128.png |
| Popup screenshot | 1280×800 or 640×400 | Needs capture with toggle and hour/minute menus | — |
| Break page screenshot | 1280×800 or 640×400 | Needs capture, light and dark variants | — |

## Permissions Justification

| Permission / access | Type | Justification |
|---------------------|------|---------------|
| storage | permissions | Store daily usage and watch totals, back up totals to the user's account, and save the theme and daily usage limit. |
| `*://*.youtube.com/*` | content_scripts matches | Show live times, measure usage and watch time, and stop playback and display the break page when the configured limit is reached. |
| src/blocked.html, limited to YouTube origins | web_accessible_resources | Allow a YouTube tab to navigate to the extension's break page. |

No new API permissions are required for this feature.

## Privacy & Data Use

Daily usage and watch totals are stored locally and backed up to the user's own
Google account. Records older than 90 days are removed automatically. Theme and
limit settings remain local. No data is transmitted to the developer or third
parties. No page contents or browsing history are saved by the extension.
The original YouTube address is passed in the break page's URL fragment solely
for returning to that page after unblocking; it is not stored or synced.

- Data is not sold to third parties.
- Data is used only for the extension's time-management functionality.
- Data is not used for creditworthiness or lending.

**Privacy policy:** PRIVACY.md; confirm the live policy URL in the existing store listing before submission.

## Distribution & Developer Info

Existing store distribution and publisher identity are unchanged; confirm these
in the developer dashboard before submitting a release.

**Contact / support:** richpinkr99@gmail.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.2 | 2026-11-10 | Optional daily Usage limit with an immediate toggle and hour/minute menus, localized break page, and more reliable usage accumulation. | Draft |

## Review Notes

The limit applies to this browser's Usage, not a combined allowance across devices.
Users can turn the limit off immediately, change its duration, and turn it on
again through the popup. The publisher will update the popup and break-page
screenshots before submitting 0.1.2. This release has not been submitted yet.
