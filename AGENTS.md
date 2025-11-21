# Repository Guidelines

## Project Structure & Module Organization
- Frontend lives in `src/`: `main.tsx` boots the app, `App.tsx` controls views, and UI pieces sit in `components/`, `hooks/`, `lib/`, and `types/`. Shared styles are in `App.css`, with static assets under `src/assets/` and `public/`.
- Desktop backend sits in `src-tauri/`: `src/main.rs` launches the Tauri entry point, while `src/lib.rs` contains commands, tray/menu logic, and SQLite access via `tauri-plugin-sql`. PDF generation lives in `src/pdf_generator.rs`. Packaging/configuration is in `tauri.conf.json`.
- Build output goes to `dist/`; Tauri artifacts are produced under `src-tauri/target/`.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies (prefer pnpm to keep the lockfile aligned).
- `pnpm dev` — run the Vite dev server for the React UI.
- `pnpm tauri dev` — launch the desktop app with live reload (requires Rust toolchain + Tauri deps).
- `pnpm build` — type-check with `tsc` then build the web bundle to `dist/`.
- `pnpm preview` — serve the built bundle for sanity checks.
- `pnpm tauri build` — create a release desktop package using the Rust backend and current `dist/`.

## Coding Style & Naming Conventions
- TypeScript + React functional components; use 2-space indentation and keep components in PascalCase (`EntriesSection.tsx`), hooks prefixed `use*`, helpers in `lib/` using camelCase.
- Favor `type` exports in `types/` for shared shapes (e.g., `TimeEntry`). Keep props/state typed explicitly instead of relying on inference when unclear.
- No repo-wide linter/formatter is configured; run your formatter but avoid churn. Keep imports sorted logically and co-locate style classes with their component.

## Testing Guidelines
- No automated test suite is present yet. When adding tests, prefer Vitest/JSDOM for the React layer with `*.test.tsx` alongside components or in `src/__tests__/`.
- For the Rust side, add unit tests near the functions in `src-tauri/src/lib.rs` and ensure DB access uses temp paths to avoid clobbering `time_tracker.db`.
- Before opening a PR, manually exercise timer start/stop, history view, invoice creation, and tray menu actions via `pnpm tauri dev`.

## Commit & Pull Request Guidelines
- Current history uses brief, imperative messages; keep titles under ~70 chars (e.g., `add tray status indicator`). Mention related issues in the body when applicable.
- PRs should include: a summary of changes, screenshots/GIFs for UI updates, notes on database schema tweaks, and confirmation of `pnpm build` plus (if relevant) `pnpm tauri build`.
- Keep changes scoped; split large refactors from feature work. Highlight any new environment/config needs (e.g., Rust toolchain, SQLite migrations).

## Tauri & Configuration Tips
- The SQLite database (`time_tracker.db`) and generated invoices are resolved via Tauri’s app directory; avoid hardcoding absolute paths and let `initialize_database` create needed folders.
- Tray/menu IDs and event names are defined in `src-tauri/src/lib.rs`; mirror those constants on the React side instead of duplicating strings.
- When updating `tauri.conf.json`, ensure icons in `src-tauri/icons/` stay in sync and rebuild packages after config changes.
