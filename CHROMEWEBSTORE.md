# Chrome Web Store Listing — Meter for YouTube

Last Updated: 2026-11-11

## Store Listing

**Extension Name:** Meter for YouTube

**Short Description:** Track today’s YouTube usage and watch time live, and set an optional daily usage limit.

**Detailed Description:**

Meter for YouTube — see how much time YouTube is really taking.

Meter for YouTube shows how much time you’ve spent on YouTube today, in real
time, at the top-right of the page. Keep the numbers visible to pace yourself,
or set an optional daily Usage limit when you want a clear stopping point.

WHAT YOU SEE ON THE PAGE

A small overlay at the top-right shows two times:
👀 Usage — total time spent on a focused YouTube tab, including browsing,
searching, and reading comments
🎬 Watch — time a video is actually playing

The gap between them shows how much time went to browsing rather than watching.

DAILY USAGE LIMIT

Choose hours and minutes while the limit is off, then turn it on to apply your
setting. When today’s Usage reaches the limit, playback stops and YouTube is
replaced by a quiet break page. The limit resets at local midnight. Turn it off
at any time to change the duration or resume using YouTube.

TRENDS DASHBOARD

Click the toolbar icon to open the popup:
• Summary tiles for today’s Usage, today’s Watch, and your daily average Usage
• A line chart comparing Usage and Watch across days, so you can see trends and
the browsing gap over time
• 7, 30, and 90-day range options

PRIVACY FIRST

Daily totals are stored in your browser and backed up through Chrome sync in
your Google account, so your history can survive a reinstall. Theme and daily
limit settings stay on this device. Beyond Chrome’s built-in sync backup, the
extension makes no network requests and sends nothing to the developer or other
third parties. Records older than 90 days are deleted automatically.

LANGUAGES & THEME

• Follows your browser language automatically, with English and Korean included
• Supports light and dark themes on both the overlay and popup; choose Auto to
follow your system, or select Light or Dark

No separate account, no sign-up, and no ads. Just an honest meter for your
YouTube time.

**Category:** Productivity

**Single Purpose:** Help users manage time spent on YouTube by showing usage and enforcing an optional daily usage limit.

**Primary Language:** English; Korean also bundled.

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|------------|--------|----------|
| Store icon | 128×128 PNG | Existing | icons/icon128.png |
| Small promo tile | 440×280 PNG | Original layout restored | store/promo-small-440x280.png |
| Marquee promo tile | 1400×560 PNG | Updated with daily usage limit | store/promo-marquee-1400x560.png |
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
