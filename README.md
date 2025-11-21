# Time Tracker (Tauri + React)

Local-first desktop time tracking with invoicing. Built on Tauri (Rust backend, React/TS frontend).

## Requirements
- Node 18+ and pnpm (`corepack enable pnpm`)
- Rust toolchain + Tauri deps (`tauri-cli` pulls what it needs)

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
