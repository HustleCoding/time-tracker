use std::{fs, path::PathBuf};

use chrono::{Duration, Local, LocalResult, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{
    menu::MenuBuilder,
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

const DB_FILE_NAME: &str = "time_tracker.db";

#[derive(Debug, Serialize)]
pub struct TimeEntry {
    pub id: i64,
    pub project_name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration: i64,
}

#[tauri::command]
async fn initialize_database(app_handle: tauri::AppHandle) -> Result<(), String> {
    let db_path = resolve_db_path(&app_handle)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _ = open_connection(db_path)?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn get_today_entries(app_handle: tauri::AppHandle) -> Result<Vec<TimeEntry>, String> {
    let db_path = resolve_db_path(&app_handle)?;
    let (start_ts, end_ts) = day_bounds_timestamps()?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, project_name, start_time, end_time, duration
                 FROM time_entries
                 WHERE start_time >= ?1 AND start_time < ?2
                 ORDER BY start_time DESC",
            )
            .map_err(|err| err.to_string())?;

        let rows = stmt
            .query_map(params![start_ts, end_ts], |row| {
                Ok(TimeEntry {
                    id: row.get(0)?,
                    project_name: row.get(1)?,
                    start_time: row.get(2)?,
                    end_time: row.get(3)?,
                    duration: row.get(4)?,
                })
            })
            .map_err(|err| err.to_string())?;

        let mut entries = Vec::new();
        for entry in rows {
            entries.push(entry.map_err(|err| err.to_string())?);
        }

        Ok::<_, String>(entries)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn create_time_entry(
    app_handle: tauri::AppHandle,
    project_name: String,
    start_time: i64,
    end_time: i64,
) -> Result<TimeEntry, String> {
    if end_time <= start_time {
        return Err("End time must be after start time".into());
    }

    let db_path = resolve_db_path(&app_handle)?;
    let mut sanitized_name = project_name.trim().to_string();
    if sanitized_name.is_empty() {
        sanitized_name = "Untitled Task".to_string();
    }
    let duration = end_time - start_time;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        conn.execute(
            "INSERT INTO time_entries (project_name, start_time, end_time, duration)
             VALUES (?1, ?2, ?3, ?4)",
            params![sanitized_name, start_time, end_time, duration],
        )
        .map_err(|err| err.to_string())?;

        let id = conn.last_insert_rowid();

        Ok::<_, String>(TimeEntry {
            id,
            project_name: sanitized_name,
            start_time,
            end_time,
            duration,
        })
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn update_time_entry_name(
    app_handle: tauri::AppHandle,
    id: i64,
    project_name: String,
) -> Result<String, String> {
    let db_path = resolve_db_path(&app_handle)?;
    let mut sanitized_name = project_name.trim().to_string();
    if sanitized_name.is_empty() {
        sanitized_name = "Untitled Task".to_string();
    }

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        conn.execute(
            "UPDATE time_entries SET project_name = ?1 WHERE id = ?2",
            params![sanitized_name, id],
        )
        .map_err(|err| err.to_string())?;

        Ok::<_, String>(sanitized_name)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn delete_time_entry(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let db_path = resolve_db_path(&app_handle)?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        conn.execute("DELETE FROM time_entries WHERE id = ?1", params![id])
            .map_err(|err| err.to_string())?;
        Ok::<_, String>(())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            initialize_database,
            get_today_entries,
            create_time_entry,
            update_time_entry_name,
            delete_time_entry
        ])
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn resolve_db_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;

    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    dir.push(DB_FILE_NAME);
    Ok(dir)
}

fn open_connection(db_path: PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|err| err.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            duration INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|err| err.to_string())?;
    Ok(conn)
}

fn day_bounds_timestamps() -> Result<(i64, i64), String> {
    let now = Local::now();
    let start_local = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| "Failed to compute start of day".to_string())?;

    let start_local_dt = match Local.from_local_datetime(&start_local) {
        LocalResult::Single(dt) => dt,
        _ => return Err("Unable to resolve local time".into()),
    };

    let end_local_dt = start_local_dt + Duration::days(1);

    let start_ts = start_local_dt.with_timezone(&Utc).timestamp();
    let end_ts = end_local_dt.with_timezone(&Utc).timestamp();

    Ok((start_ts, end_ts))
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("toggle-window", "Show / Hide Window")
        .separator()
        .text("quit", "Quit")
        .build()?;

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Time Tracker");

    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    tray_builder
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle-window" => toggle_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|icon, event| {
            if let TrayIconEvent::Click { .. } = event {
                toggle_main_window(&icon.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(true);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
