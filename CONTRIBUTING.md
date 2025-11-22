## Contributing

Thanks for helping improve Time Tracker! Please follow these steps for changes.

### Getting started

- Install prerequisites from README.md (Node 18+, pnpm via corepack, Rust + Tauri deps).
- Install dependencies: `pnpm install`
- Run dev app: `pnpm tauri dev`
- Run a production build before opening a PR: `pnpm tauri build`

### Coding guidelines

- TypeScript + React functional components; 2-space indent; keep imports tidy.
- Prefer `type` exports for shared shapes in `src/types/`.
- Co-locate component styles; avoid large refactors in feature PRs.

### Submitting changes

- Fork, branch from `main`, keep commits focused.
- Include screenshots/GIFs for UI changes.
- Note any DB or config changes; update README if install steps change.
- Open a PR with a short summary and testing notes (dev run + `pnpm tauri build` at minimum).

### Testing checklist (manual)

- Timer: start/stop, tray icon updates, resume after app restart.
- History: switch days, edit/delete entries.
- Invoice: custom range, generated totals match entries, PDF opens.
