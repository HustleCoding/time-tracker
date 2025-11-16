import { invoke } from "@tauri-apps/api/core";

/**
 * Ensures the SQLite database exists and is migrated before use.
 * Additional database helpers can be colocated here as persistence expands.
 */
export async function initializeDatabase(): Promise<void> {
  await invoke("initialize_database");
}
