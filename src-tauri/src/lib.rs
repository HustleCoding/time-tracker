use std::{fs, path::PathBuf, sync::Mutex};

use chrono::{Duration, Local, LocalResult, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WindowEvent,
};

const DB_FILE_NAME: &str = "time_tracker.db";
const TRAY_ID: &str = "time-tracker-tray";
const MENU_STATUS_ID: &str = "status";
const MENU_START_ID: &str = "start-timer";
const MENU_STOP_ID: &str = "stop-timer";
const MENU_TOGGLE_WINDOW_ID: &str = "toggle-window";
const MENU_QUIT_ID: &str = "quit";
const TIMER_STATUS_EVENT: &str = "timer://status";

#[derive(Debug, Serialize)]
pub struct TimeEntry {
    pub id: i64,
    pub project_name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration: i64,
}

#[derive(Debug, Clone, Serialize)]
struct TimerStatusPayload {
    is_running: bool,
    project_name: Option<String>,
    start_time: Option<i64>,
    elapsed_seconds: Option<i64>,
}

#[derive(Clone)]
struct ActiveTimer {
    project_name: String,
    start_time: i64,
}

#[derive(Default)]
struct TimerInner {
    active: Option<ActiveTimer>,
}

#[derive(Default)]
struct TimerState {
    inner: Mutex<TimerInner>,
}

impl TimerState {
    fn status(&self) -> TimerStatusPayload {
        let guard = self.inner.lock().expect("timer state poisoned");
        if let Some(active) = &guard.active {
            let elapsed = (current_unix_timestamp() - active.start_time).max(0);
            TimerStatusPayload {
                is_running: true,
                project_name: Some(active.project_name.clone()),
                start_time: Some(active.start_time),
                elapsed_seconds: Some(elapsed),
            }
        } else {
            TimerStatusPayload {
                is_running: false,
                project_name: None,
                start_time: None,
                elapsed_seconds: None,
            }
        }
    }

    fn start(&self, project_name: String, start_time: i64) -> Result<TimerStatusPayload, String> {
        let mut guard = self.inner.lock().map_err(|_| "Timer state is unavailable")?;
        if guard.active.is_some() {
            return Err("A timer is already running".into());
        }

        guard.active = Some(ActiveTimer {
            project_name: project_name.clone(),
            start_time,
        });

        Ok(TimerStatusPayload {
            is_running: true,
            project_name: Some(project_name),
            start_time: Some(start_time),
            elapsed_seconds: Some(0),
        })
    }

    fn take_active(&self) -> Option<ActiveTimer> {
        let mut guard = self.inner.lock().expect("timer state poisoned");
        guard.active.take()
    }
}

struct TrayAssets {
    idle_icon: Image<'static>,
    running_icon: Image<'static>,
}

impl TrayAssets {
    fn load() -> tauri::Result<Self> {
        Ok(Self {
            idle_icon: solid_icon_image(32, 32, [138, 138, 138, 255]),
            running_icon: solid_icon_image(32, 32, [46, 204, 113, 255]),
        })
    }
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
    let sanitized_name = sanitize_project_name(project_name);

    persist_time_entry(db_path, sanitized_name, start_time, end_time).await
}

#[tauri::command]
async fn update_time_entry_name(
    app_handle: tauri::AppHandle,
    id: i64,
    project_name: String,
) -> Result<String, String> {
    let db_path = resolve_db_path(&app_handle)?;
    let sanitized_name = sanitize_project_name(project_name);

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

#[tauri::command]
async fn get_timer_status(app_handle: tauri::AppHandle) -> Result<TimerStatusPayload, String> {
    let timer_state = app_handle.state::<TimerState>();
    Ok(timer_state.status())
}

#[tauri::command]
async fn start_timer(
    app_handle: tauri::AppHandle,
    project_name: String,
) -> Result<TimerStatusPayload, String> {
    start_timer_internal(&app_handle, project_name)
}

#[tauri::command]
async fn stop_timer(
    app_handle: tauri::AppHandle,
) -> Result<Option<TimeEntry>, String> {
    stop_timer_internal(&app_handle).await
}

#[tauri::command]
async fn start_timer_from_tray(
    app_handle: tauri::AppHandle,
    project_name: String,
) -> Result<TimerStatusPayload, String> {
    let name = if project_name.trim().is_empty() {
        "Quick Task".to_string()
    } else {
        project_name
    };
    start_timer_internal(&app_handle, name)
}

#[tauri::command]
async fn stop_timer_from_tray(
    app_handle: tauri::AppHandle,
) -> Result<Option<TimeEntry>, String> {
    stop_timer_internal(&app_handle).await
}

#[tauri::command]
async fn toggle_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    toggle_main_window(&app_handle);
    refresh_tray(&app_handle).map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TimerState::default())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.hide().is_ok() {
                    let _ = refresh_tray(&window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            initialize_database,
            get_today_entries,
            create_time_entry,
            update_time_entry_name,
            delete_time_entry,
            get_timer_status,
            start_timer,
            stop_timer,
            start_timer_from_tray,
            stop_timer_from_tray,
            toggle_window
        ])
        .setup(|app| {
            let assets = TrayAssets::load()?;
            app.manage(assets);
            setup_tray(app)?;
            refresh_tray(&app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_timer_internal(
    app_handle: &AppHandle,
    project_name: String,
) -> Result<TimerStatusPayload, String> {
    let timer_state = app_handle.state::<TimerState>();
    let sanitized_name = sanitize_project_name(project_name);
    let start_time = current_unix_timestamp();
    let status = timer_state.start(sanitized_name, start_time)?;
    refresh_tray(app_handle).map_err(|err| err.to_string())?;
    emit_timer_status(app_handle, &status);
    Ok(status)
}

async fn stop_timer_internal(
    app_handle: &AppHandle,
) -> Result<Option<TimeEntry>, String> {
    let timer_state = app_handle.state::<TimerState>();
    let Some(active) = timer_state.take_active() else {
        return Err("No timer is currently running".into());
    };

    let end_time = current_unix_timestamp().max(active.start_time + 1);
    let db_path = resolve_db_path(app_handle)?;

    let entry =
        persist_time_entry(db_path, active.project_name.clone(), active.start_time, end_time)
            .await?;

    let status = timer_state.status();
    refresh_tray(app_handle).map_err(|err| err.to_string())?;
    emit_timer_status(app_handle, &status);

    Ok(Some(entry))
}

fn emit_timer_status(app_handle: &AppHandle, status: &TimerStatusPayload) {
    let _ = app_handle.emit(TIMER_STATUS_EVENT, status);
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

async fn persist_time_entry(
    db_path: PathBuf,
    project_name: String,
    start_time: i64,
    end_time: i64,
) -> Result<TimeEntry, String> {
    let duration = end_time - start_time;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        conn.execute(
            "INSERT INTO time_entries (project_name, start_time, end_time, duration)
             VALUES (?1, ?2, ?3, ?4)",
            params![project_name, start_time, end_time, duration],
        )
        .map_err(|err| err.to_string())?;

        let id = conn.last_insert_rowid();

        Ok::<_, String>(TimeEntry {
            id,
            project_name,
            start_time,
            end_time,
            duration,
        })
    })
    .await
    .map_err(|err| err.to_string())?
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
    let assets = app.state::<TrayAssets>();
    let initial_status = {
        let timer_state = app.state::<TimerState>();
        timer_state.status()
    };
    let app_handle = app.handle();
    let initial_menu = build_tray_menu(
        &app_handle,
        &initial_status,
        is_main_window_visible(&app_handle),
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(assets.idle_icon.clone())
        .tooltip("Time Tracker")
        .menu(&initial_menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_STATUS_ID => {}
            MENU_START_ID => {
                let _ = start_timer_internal(app, "Quick Task".to_string());
            }
            MENU_STOP_ID => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = stop_timer_internal(&app_handle).await;
                });
            }
            MENU_TOGGLE_WINDOW_ID => toggle_main_window(app),
            MENU_QUIT_ID => app.exit(0),
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
        let _ = refresh_tray(app);
    }
}

fn refresh_tray(app: &AppHandle) -> tauri::Result<()> {
    let status = {
        let timer_state = app.state::<TimerState>();
        timer_state.status()
    };
    apply_tray_updates(app, &status)
}

fn apply_tray_updates(app: &AppHandle, status: &TimerStatusPayload) -> tauri::Result<()> {
    let tray_assets = app.state::<TrayAssets>();
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let icon = if status.is_running {
            tray_assets.running_icon.clone()
        } else {
            tray_assets.idle_icon.clone()
        };
        tray.set_icon(Some(icon))?;

        let tooltip = build_status_text(status);
        if tooltip.is_empty() {
            tray.set_tooltip(None::<&str>)?;
        } else {
            tray.set_tooltip(Some(tooltip.as_str()))?;
        }
        let menu = build_tray_menu(app, status, is_main_window_visible(app))?;
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    status: &TimerStatusPayload,
    window_visible: bool,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let status_item = MenuItemBuilder::with_id(MENU_STATUS_ID, build_status_text(status))
        .enabled(false)
        .build(app)?;
    let start_item = MenuItemBuilder::with_id(MENU_START_ID, "Start Timer")
        .enabled(!status.is_running)
        .build(app)?;
    let stop_item = MenuItemBuilder::with_id(MENU_STOP_ID, "Stop Timer")
        .enabled(status.is_running)
        .build(app)?;
    let toggle_label = if window_visible { "Hide Window" } else { "Show Window" };
    let toggle_item = MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW_ID, toggle_label).build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT_ID, "Quit").build(app)?;

    MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&start_item)
        .item(&stop_item)
        .separator()
        .item(&toggle_item)
        .item(&quit_item)
        .build()
}

fn solid_icon_image(width: u32, height: u32, color: [u8; 4]) -> Image<'static> {
    let pixel_count = (width * height) as usize;
    let mut data = vec![0u8; pixel_count * 4];
    for chunk in data.chunks_exact_mut(4) {
        chunk.copy_from_slice(&color);
    }
    Image::new_owned(data, width, height)
}

fn sanitize_project_name(project_name: String) -> String {
    let trimmed = project_name.trim();
    if trimmed.is_empty() {
        "Untitled Task".to_string()
    } else {
        trimmed.to_string()
    }
}

fn current_unix_timestamp() -> i64 {
    Utc::now().timestamp()
}

fn is_main_window_visible(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

fn build_status_text(status: &TimerStatusPayload) -> String {
    if let (Some(name), Some(elapsed)) = (&status.project_name, status.elapsed_seconds) {
        format!("Running: {} ({})", name, format_duration(elapsed))
    } else {
        "Status: No timer running".to_string()
    }
}

fn format_duration(total_seconds: i64) -> String {
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}")
}
