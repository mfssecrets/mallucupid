# MalluCupid Android — Changelog

All notable changes to the MalluCupid Capacitor Android app.

## [1.10.0] — 2026-08-22

### Added
- Initial Capacitor Android app wrapping the live mallucupid.com web app.
- Origin-match auth strategy (server.hostname='www.mallucupid.com' + androidScheme='https').
- Mobile-only build path (.env.mobile + build:mobile script). Original web build untouched.
- Play Store release signing (RSA-2048 PKCS12 keystore).
- 8 Capacitor plugins: app, browser, clipboard, device, filesystem, haptics, keyboard, keep-awake, local-notifications, network, preferences, push-notifications, share, splash-screen, status-bar, in-app-review, biometric-auth.
- 4 native plugins: ExternalIntent, McToast, McRatePrompt, McAppInfo.
- Native back-button history navigation + "press back again to exit".
- Branded offline overlay with auto-retry and connectivity pulse.
- Branded error screen for WebView load failures.
- Runtime notification channels (reminders, chat, general).
- FLAG_SECURE screenshot prevention.
- WebView performance tuning (DOM storage, cache, viewport).
- App shortcuts (Home, Wallet, Chat).
- Network security config (HTTPS enforcement).
- Backup rules (selective Auto Backup).
- JS bridge v1.10.0 (34 APIs + metadata).
- docs/play-store-listing.md, docs/deep-linking.md, docs/assetlinks.json, docs/CHANGELOG.md, docs/RELEASE.md.
- scripts/build-release.sh.
- 6 Play Store screenshots (1080×1920).

### Technical
- Capacitor 7.6.8, Gradle 8.11.1, AGP 8.7.2, compileSdk 35, minSdk 23, targetSdk 35.
- R8 compat mode (fullMode=false).
