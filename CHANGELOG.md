# Changelog

All notable changes to this project will be documented here.

## [0.2.0] - 2025-09-07
### 🛠 Minor Update
- Updated refreshtokens to clear stored tokens and trigger full re-authentication when refresh token is revoked
- Added a reconnect commands

## [0.2.0] - 2025-09-07
### 🛠 Minor Update
- Updated `MiniPlayer` to correctly load track information on first open without requiring user interaction
- Improved **ensure active device** logic to reliably detect and activate a Spotify device before playback.  

## [0.1.0] - 2025-08-26
### 🎉 MVP Release
- Added Spotify authentication flow using VS Code `UriHandler`.
- Implemented **active device detection** with Spotify Web API.
- Enabled **device activation** and **playback transfer** between devices.
- Built a **MiniPlayer UI** for play/pause, track updates, and album art.
- Added error handling:
  - Missing devices → prompts user to open Spotify on any device.
  - Device activation failures → shows clear error messages.
- Included test coverage:
  - Authentication flow.
  - Device handling (with and without active devices).
  - MiniPlayer creation, disposal, and playback toggle.
- Implemented **default album art** fallback when track has no artwork.
- Structured project for **Next.js-style build pipeline** with `tsc`, ESLint, and Mocha tests.
