# Time Tracker (Tauri + React)

Local-first desktop time tracking with invoicing. Built on Tauri (Rust backend, React/TS frontend).

## Demo link

https://drive.google.com/file/d/19ijgUzdIawszL2qVmWDaF3lkQvgwf9xG/view?usp=sharing

## Requirements

- Node 18+ and pnpm (`corepack enable pnpm`)
- Rust toolchain + Tauri deps (`tauri-cli` pulls what it needs)

Platform notes:

- macOS: install Xcode Command Line Tools (`xcode-select --install`).
- Windows: install Visual Studio Build Tools + WebView2 runtime (Tauri requirement).
- Linux: install a recent webkit2gtk; see https://tauri.app/start/prerequisites/ for your distro.

## Build your own installable copy

1. Clone: `git clone https://github.com/<your-handle>/time-tracker.git && cd time-tracker`
2. Enable pnpm: `corepack enable pnpm`
3. Install deps: `pnpm install`
4. (Optional) Dev run to verify: `pnpm tauri dev`
5. Create a production build: `pnpm tauri build` (runs the Vite build and bundles the Tauri app)
6. Grab installers from `src-tauri/target/release/bundle/`
   - macOS: `.dmg` and zipped `.app`
   - Windows: `.msi` (and sometimes `.exe`)
   - Linux: `.AppImage` plus `.deb/.rpm` when supported

Install your build:

- macOS: open the `.dmg`, drag `time-tracker.app` to Applications, first launch via right-click → Open (unsigned).
- Windows: run the `.msi` → More Info → Run anyway if SmartScreen warns (unsigned).
- Linux: `chmod +x time-tracker-*.AppImage && ./time-tracker-*.AppImage` or install the `.deb/.rpm`.

## Setup

```bash
pnpm install
pnpm build         # type-check + Vite build
pnpm tauri dev     # desktop app (Rust backend + Vite dev server)
pnpm tauri build   # production desktop bundle
```

## Usage

- Start/stop timer in the Today view; last-used hourly rate is reused (including from the tray “Quick Task”).
- History view shows a day; create invoices from any date range (calendar in the dialog).
- Invoices open via your system PDF viewer and are copied to Downloads.
- Active timers persist through app restarts.

Shortcuts:

- Cmd/Ctrl+Enter: start/stop (Today view)
- Esc: clear project name when idle

## Data

- SQLite DB and invoice PDFs live under the Tauri app data dir (`app_handle.path().app_data_dir()`; platform-specific).
- Everything is local; no sync.

## Security notes

- CSP is locked down to app assets; commands exposed are limited to what the UI uses.
- File opening uses the opener plugin with canonicalized paths; no shell invocations.
- No encryption at rest—treat the machine as trusted.

## Manual QA checklist

- Start/stop timer; tray icon updates; app restart while running keeps the timer alive.
- Edit time entry with overlap and non-overlap; zero-duration shows inline error.
- Delete entry and ensure totals update.
- Tray “Quick Task” starts with last-used rate and stops correctly.
- History: change day, refresh, delete entry.
- Invoice: pick a custom date range, generate, open PDF, amounts match totals.

## Notes

- If packaging for distribution, configure signing/notarization per platform after `pnpm tauri build`.

## Signed & notarized macOS release (direct download)

To distribute a macOS app via a normal downloadable link (e.g. GitHub Releases) without Gatekeeper warnings, build a **Developer ID signed** and **notarized** `.dmg`.

This repo includes a GitHub Actions workflow that builds a **universal** DMG (Intel + Apple Silicon), notarizes it, and uploads it to the GitHub Release when you push a tag like `v0.1.1`:

- Workflow: `.github/workflows/release-macos.yml`
- Entitlements: `src-tauri/entitlements.plist`

One-time setup:

1. Create/install a **Developer ID Application** certificate in Keychain Access.
2. Create an **App Store Connect API key** for notarization (recommended).
3. In your GitHub repo, add these Secrets (Settings → Secrets and variables → Actions):
   - `APPLE_CERTIFICATE_P12_BASE64`: base64 of a `.p12` export of your Developer ID Application certificate (including private key)
   - `APPLE_CERTIFICATE_P12_PASSWORD`: password you set when exporting the `.p12`
   - `APPLE_SIGNING_IDENTITY`: from `security find-identity -v -p codesigning` (e.g. `Developer ID Application: Your Name (TEAMID)`)
   - `APPLE_NOTARYTOOL_KEY_ID`: API Key ID
   - `APPLE_NOTARYTOOL_ISSUER_ID`: API Issuer ID
   - `APPLE_NOTARYTOOL_API_KEY_P8_BASE64`: base64 of the `.p8` API key file contents

Release steps:

1. Bump version in `package.json` and `src-tauri/tauri.conf.json`.
2. Push a tag (example):
   - `git tag v0.1.2`
   - `git push origin v0.1.2`
3. After the workflow finishes, download the notarized `.dmg` from the GitHub Release assets.

## Unsigned release checklist (manual)

- Bump version in `package.json` and `src-tauri/tauri.conf.json`.
- `pnpm install && pnpm tauri build` (artifacts in `src-tauri/target/release/bundle/`).
- Smoke-test the built app (timer/tray/history/invoice) from the bundle, not dev mode.
- macOS: users must right-click → Open the first time (unsigned/not notarized). Windows: SmartScreen “More info → Run anyway.”
- Zip and publish `.dmg`/`.msi`/`.AppImage` (or `.deb/.rpm`) on GitHub Releases with release notes and known unsigned warning.

## Release notes template (unsigned)

Title: `v{{version}} (unsigned)`

Changes:

- Brief bullet list of changes.

Downloads:

- macOS (unsigned): `time-tracker-{{version}}-macos.zip`
  - Installation: unzip; drag `time-tracker.app` to Applications; first launch requires right-click → Open (Gatekeeper).
- (If present) Windows: `.msi` / `.exe` — SmartScreen may warn; click More Info → Run anyway.
- (If present) Linux: `.AppImage` or `.deb`/`.rpm`; may need `chmod +x` for AppImage.

Notes:

- Local-only: data (SQLite) and invoices are stored in the app data directory.
- No auto-updates; download the latest release to upgrade.

## Contributing

See CONTRIBUTING.md for setup, coding style, and PR expectations.

## Security

Please report vulnerabilities privately via GitHub Security Advisories (details in SECURITY.md).

## License

MIT — see LICENSE for details.
