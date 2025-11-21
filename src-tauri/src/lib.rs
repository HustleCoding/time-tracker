use std::{fs, io, path::PathBuf, sync::Mutex};

use chrono::{Duration, Local, LocalResult, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_opener::OpenerExt;

mod pdf_generator;

const DB_FILE_NAME: &str = "time_tracker.db";
const DB_URL: &str = "sqlite:time_tracker.db";
const TRAY_ID: &str = "time-tracker-tray";
const MENU_STATUS_ID: &str = "status";
const MENU_START_ID: &str = "start-timer";
const MENU_STOP_ID: &str = "stop-timer";
const MENU_TOGGLE_WINDOW_ID: &str = "toggle-window";
const MENU_QUIT_ID: &str = "quit";
const MENU_TOTAL_ID: &str = "total-today";
const TIMER_STATUS_EVENT: &str = "timer://status";
const CREATE_TIME_ENTRIES_TABLE_SQL: &str = r#"
    CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        hourly_rate REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0
    )
"#;

const CREATE_ACTIVE_TIMER_TABLE_SQL: &str = r#"
    CREATE TABLE IF NOT EXISTS active_timer (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        project_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        hourly_rate REAL NOT NULL DEFAULT 0
    )
"#;

const CREATE_INVOICES_TABLE_SQL: &str = r#"
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        business_info TEXT NOT NULL,
        bill_to_info TEXT NOT NULL,
        total_hours REAL NOT NULL,
        total_amount REAL NOT NULL,
        file_path TEXT NOT NULL,
        entry_count INTEGER NOT NULL
    )
"#;

#[derive(Debug, Serialize)]
pub struct TimeEntry {
    pub id: i64,
    pub project_name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration: i64,
    pub hourly_rate: f64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessInfo {
    pub name: String,
    pub address: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub client_name: Option<String>,
    pub client_address: Option<String>,
    pub client_email: Option<String>,
    pub client_phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    pub id: i64,
    pub created_at: i64,
    pub business_info: String,
    pub bill_to_info: String,
    pub total_hours: f64,
    pub total_amount: f64,
    pub file_path: String,
    pub entry_count: i64,
}

#[derive(Debug, Clone, Serialize)]
struct TimerStatusPayload {
    is_running: bool,
    project_name: Option<String>,
    start_time: Option<i64>,
    elapsed_seconds: Option<i64>,
    hourly_rate: Option<f64>,
}

#[derive(Clone)]
struct ActiveTimer {
    project_name: String,
    start_time: i64,
    hourly_rate: f64,
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
                hourly_rate: Some(active.hourly_rate),
            }
        } else {
            TimerStatusPayload {
                is_running: false,
                project_name: None,
                start_time: None,
                elapsed_seconds: None,
                hourly_rate: None,
            }
        }
    }

    fn start(
        &self,
        project_name: String,
        start_time: i64,
        hourly_rate: f64,
    ) -> Result<TimerStatusPayload, String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "Timer state is unavailable")?;
        if guard.active.is_some() {
            return Err("A timer is already running".into());
        }

        guard.active = Some(ActiveTimer {
            project_name: project_name.clone(),
            start_time,
            hourly_rate,
        });

        Ok(TimerStatusPayload {
            is_running: true,
            project_name: Some(project_name),
            start_time: Some(start_time),
            elapsed_seconds: Some(0),
            hourly_rate: Some(hourly_rate),
        })
    }

    fn take_active(&self) -> Option<ActiveTimer> {
        let mut guard = self.inner.lock().expect("timer state poisoned");
        guard.active.take()
    }

    fn clear(&self) {
        let mut guard = self.inner.lock().expect("timer state poisoned");
        guard.active = None;
    }

    fn restore(&self, timer: ActiveTimer) {
        let mut guard = self.inner.lock().expect("timer state poisoned");
        guard.active = Some(timer);
    }
}

struct TrayAssets {
    idle_icon: Image<'static>,
    running_icon: Image<'static>,
}

impl TrayAssets {
    fn load() -> tauri::Result<Self> {
        Ok(Self {
            idle_icon: build_tray_icon([234, 240, 255, 255], [79, 139, 255, 255]),
            running_icon: build_tray_icon([234, 240, 255, 255], [46, 204, 113, 255]),
        })
    }
}

#[derive(Debug, Serialize)]
struct TodayTotals {
    total_seconds: i64,
    total_amount: f64,
}

#[tauri::command]
async fn initialize_database(app_handle: tauri::AppHandle) -> Result<(), String> {
    let db_path = resolve_db_path(&app_handle)?;
    let _ = resolve_invoices_dir(&app_handle)?;
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
        query_entries_between(&conn, start_ts, end_ts)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
async fn get_entries_in_range(
    app_handle: tauri::AppHandle,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<TimeEntry>, String> {
    let db_path = resolve_db_path(&app_handle)?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        query_entries_between(&conn, start_time, end_time)
    })
    .await
    .map_err(|err| err.to_string())?
}

fn query_entries_between(
    conn: &Connection,
    start_ts: i64,
    end_ts: i64,
) -> Result<Vec<TimeEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_name, start_time, end_time, duration, hourly_rate, amount
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
                hourly_rate: row.get(5)?,
                amount: row.get(6)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut entries = Vec::new();
    for entry in rows {
        entries.push(entry.map_err(|err| err.to_string())?);
    }

    Ok(entries)
}

#[tauri::command]
async fn get_today_total(app_handle: tauri::AppHandle) -> Result<TodayTotals, String> {
    let db_path = resolve_db_path(&app_handle)?;
    let (start_ts, end_ts) = day_bounds_timestamps()?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        let totals = query_totals_between(&conn, start_ts, end_ts)?;
        Ok::<_, String>(totals)
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
    hourly_rate: Option<f64>,
) -> Result<TimeEntry, String> {
    if end_time <= start_time {
        return Err("End time must be after start time".into());
    }

    let db_path = resolve_db_path(&app_handle)?;
    let sanitized_name = sanitize_project_name(project_name);
    let rate = sanitize_hourly_rate(hourly_rate.unwrap_or(0.0));

    persist_time_entry(db_path, sanitized_name, start_time, end_time, rate).await
}

#[derive(Debug, Serialize)]
struct UpdateResult {
    entry: TimeEntry,
    overlap_warning: Option<OverlapWarning>,
}

#[derive(Debug, Serialize)]
struct OverlapWarning {
    overlapping_entries: Vec<TimeEntry>,
}

#[tauri::command]
async fn update_time_entry(
    app_handle: tauri::AppHandle,
    id: i64,
    project_name: Option<String>,
    hourly_rate: Option<f64>,
    duration: Option<i64>,
) -> Result<UpdateResult, String> {
    let db_path = resolve_db_path(&app_handle)?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        let current = fetch_time_entry(&conn, id)?;

        let updated_name = project_name
            .map(sanitize_project_name)
            .unwrap_or_else(|| current.project_name.clone());
        let updated_rate = hourly_rate
            .map(sanitize_hourly_rate)
            .unwrap_or(current.hourly_rate);

        // Calculate new duration and end_time
        let updated_duration = duration.unwrap_or(current.duration);
        let updated_end_time = current.start_time + updated_duration;
        let updated_amount = calculate_amount(updated_duration, updated_rate);

        // Check for overlapping entries (excluding current entry)
        let overlapping = check_overlapping_entries(&conn, id, current.start_time, updated_end_time)?;
        let overlap_warning = if !overlapping.is_empty() {
            Some(OverlapWarning {
                overlapping_entries: overlapping,
            })
        } else {
            None
        };

        conn.execute(
            "UPDATE time_entries
             SET project_name = ?1,
                 hourly_rate = ?2,
                 duration = ?3,
                 end_time = ?4,
                 amount = ?5
             WHERE id = ?6",
            params![updated_name, updated_rate, updated_duration, updated_end_time, updated_amount, id],
        )
        .map_err(|err| err.to_string())?;

        let entry = TimeEntry {
            id,
            project_name: updated_name,
            start_time: current.start_time,
            end_time: updated_end_time,
            duration: updated_duration,
            hourly_rate: updated_rate,
            amount: updated_amount,
        };

        Ok::<_, String>(UpdateResult {
            entry,
            overlap_warning,
        })
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
    hourly_rate: f64,
) -> Result<TimerStatusPayload, String> {
    start_timer_internal(&app_handle, project_name, hourly_rate)
}

#[tauri::command]
async fn stop_timer(app_handle: tauri::AppHandle) -> Result<Option<TimeEntry>, String> {
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
    let db_path = resolve_db_path(&app_handle)?;
    let last_rate = tauri::async_runtime::spawn_blocking(move || last_used_hourly_rate(db_path))
        .await
        .map_err(|e| e.to_string())??;
    start_timer_internal(&app_handle, name, last_rate)
}

#[tauri::command]
async fn stop_timer_from_tray(app_handle: tauri::AppHandle) -> Result<Option<TimeEntry>, String> {
    stop_timer_internal(&app_handle).await
}

#[tauri::command]
async fn save_invoice(
    app_handle: tauri::AppHandle,
    business_info: BusinessInfo,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> Result<Invoice, String> {
    let db_path = resolve_db_path(&app_handle)?;
    let invoices_dir = resolve_invoices_dir(&app_handle)?;

    // Get all entries
    let entries = tauri::async_runtime::spawn_blocking({
        let db_path = db_path.clone();
        let start = start_time;
        let end = end_time;
        move || {
            let conn = open_connection(db_path)?;

            let map_entry = |row: &rusqlite::Row| -> rusqlite::Result<TimeEntry> {
                Ok(TimeEntry {
                    id: row.get(0)?,
                    project_name: row.get(1)?,
                    start_time: row.get(2)?,
                    end_time: row.get(3)?,
                    duration: row.get(4)?,
                    hourly_rate: row.get(5)?,
                    amount: row.get(6)?,
                })
            };

            let entries = if let (Some(start), Some(end)) = (start, end) {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, project_name, start_time, end_time, duration, hourly_rate, amount
                         FROM time_entries
                         WHERE start_time >= ?1 AND start_time < ?2
                         ORDER BY start_time ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(params![start, end], |row| map_entry(row))
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?
            } else {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, project_name, start_time, end_time, duration, hourly_rate, amount
                         FROM time_entries
                         ORDER BY start_time ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map([], |row| map_entry(row))
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?
            };

            Ok::<Vec<TimeEntry>, String>(entries)
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if entries.is_empty() {
        return Err("No time entries in the selected period to include in the invoice".into());
    }

    // Calculate totals
    let mut total_hours = 0.0;
    let mut total_amount = 0.0;
    for entry in &entries {
        total_hours += entry.duration as f64 / 3600.0;
        total_amount += entry.amount;
    }
    let entry_count = entries.len() as i64;

    // Generate filename
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("invoice_{}.pdf", timestamp);
    let output_path = invoices_dir.join(&filename);
    let output_path_str = output_path
        .to_str()
        .ok_or("Invalid file path")?
        .to_string();

    // Convert entries to pdf_generator format
    let pdf_entries: Vec<pdf_generator::TimeEntry> = entries
        .into_iter()
        .map(|e| pdf_generator::TimeEntry {
            id: e.id,
            project_name: e.project_name,
            start_time: e.start_time,
            end_time: e.end_time,
            duration: e.duration,
            hourly_rate: e.hourly_rate,
            amount: e.amount,
        })
        .collect();

    let pdf_business_info = pdf_generator::BusinessInfo {
        name: business_info.name.clone(),
        address: business_info.address.clone(),
        email: business_info.email.clone(),
        phone: business_info.phone.clone(),
        client_name: business_info.client_name.clone(),
        client_address: business_info.client_address.clone(),
        client_email: business_info.client_email.clone(),
        client_phone: business_info.client_phone.clone(),
    };

    // Generate PDF
    let period = start_time.and_then(|s| end_time.map(|e| pdf_generator::InvoicePeriod { start_time: s, end_time: e }));
    pdf_generator::generate_invoice(pdf_entries, pdf_business_info, &output_path_str, period)?;

    // Serialize business info to JSON
    let business_info_json = serde_json::to_string(&business_info)
        .map_err(|e| format!("Failed to serialize business info: {}", e))?;
    let bill_to_json = serde_json::to_string(&serde_json::json!({
        "name": business_info.client_name,
        "address": business_info.client_address,
        "email": business_info.client_email,
        "phone": business_info.client_phone,
    }))
    .map_err(|e| format!("Failed to serialize bill to info: {}", e))?;

    let created_at = current_unix_timestamp();

    // Save to database
    let invoice = tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;

        conn.execute(
            "INSERT INTO invoices (created_at, business_info, bill_to_info, total_hours, total_amount, file_path, entry_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![created_at, business_info_json, bill_to_json, total_hours, total_amount, output_path_str, entry_count],
        )
        .map_err(|err| err.to_string())?;

        let id = conn.last_insert_rowid();

        Ok::<Invoice, String>(Invoice {
            id,
            created_at,
            business_info: business_info_json,
            bill_to_info: bill_to_json,
            total_hours,
            total_amount,
            file_path: output_path_str,
            entry_count,
        })
    })
    .await
    .map_err(|err| err.to_string())??;

    Ok(invoice)
}

#[tauri::command]
async fn get_all_invoices(app_handle: tauri::AppHandle) -> Result<Vec<Invoice>, String> {
    let db_path = resolve_db_path(&app_handle)?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;

        let mut stmt = conn
            .prepare("SELECT id, created_at, business_info, bill_to_info, total_hours, total_amount, file_path, entry_count FROM invoices ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let invoices = stmt
            .query_map([], |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    business_info: row.get(2)?,
                    bill_to_info: row.get(3)?,
                    total_hours: row.get(4)?,
                    total_amount: row.get(5)?,
                    file_path: row.get(6)?,
                    entry_count: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(invoices)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_invoice_pdf_path(
    app_handle: tauri::AppHandle,
    id: i64,
) -> Result<String, String> {
    let db_path = resolve_db_path(&app_handle)?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;

        let file_path: String = conn
            .query_row(
                "SELECT file_path FROM invoices WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Invoice not found: {}", e))?;

        Ok(file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn delete_invoice(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let db_path = resolve_db_path(&app_handle)?;

    // Fetch file path and delete row in a single connection to avoid locking issues.
    let file_path = tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        let file_path: String = conn
            .query_row("SELECT file_path FROM invoices WHERE id = ?1", params![id], |row| row.get(0))
            .map_err(|e| format!("Invoice not found: {}", e))?;

        conn.execute("DELETE FROM invoices WHERE id = ?1", params![id])
            .map_err(|err| err.to_string())?;

        Ok::<String, String>(file_path)
    })
    .await
    .map_err(|err| err.to_string())??;

    // Delete file
    if let Err(e) = fs::remove_file(&file_path) {
        // If we can't delete the PDF (e.g. locked by a viewer), log it but still treat as success
        if e.kind() != io::ErrorKind::NotFound {
            eprintln!("Failed to delete invoice file {}: {}", file_path, e);
        }
    }

    Ok(())
}

#[tauri::command]
async fn export_invoice_to_downloads(
    app_handle: tauri::AppHandle,
    id: i64,
) -> Result<String, String> {
    let file_path = get_invoice_pdf_path(app_handle.clone(), id).await?;

    // Get downloads directory
    let downloads_path = app_handle
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get downloads directory: {}", e))?;

    // Extract filename from path
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .ok_or("Invalid file path")?
        .to_str()
        .ok_or("Invalid filename")?;

    let dest_path = downloads_path.join(filename);
    let dest_path_str = dest_path.to_str().ok_or("Invalid destination path")?;

    // Copy file to downloads
    fs::copy(&file_path, &dest_path)
        .map_err(|e| format!("Failed to copy invoice to downloads: {}", e))?;

    Ok(dest_path_str.to_string())
}

#[tauri::command]
async fn open_file_in_default_app(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let resolved = PathBuf::from(path);
    let canonical = resolved
        .canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    app_handle
        .opener()
        .open_path(canonical.to_string_lossy().to_string(), None::<String>)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, database_migrations())
                .build(),
        )
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
            get_entries_in_range,
            get_today_total,
            create_time_entry,
            update_time_entry,
            delete_time_entry,
            get_timer_status,
            start_timer,
            stop_timer,
            start_timer_from_tray,
            stop_timer_from_tray,
            save_invoice,
            get_all_invoices,
            get_invoice_pdf_path,
            delete_invoice,
            export_invoice_to_downloads,
            open_file_in_default_app
        ])
        .setup(|app| {
            let assets = TrayAssets::load()?;
            app.manage(assets);
            setup_tray(app)?;
            restore_active_timer(&app.handle()).map_err(to_tauri_error)?;
            refresh_tray(&app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_timer_internal(
    app_handle: &AppHandle,
    project_name: String,
    hourly_rate: f64,
) -> Result<TimerStatusPayload, String> {
    let timer_state = app_handle.state::<TimerState>();
    let sanitized_name = sanitize_project_name(project_name);
    let sanitized_rate = sanitize_hourly_rate(hourly_rate);
    let start_time = current_unix_timestamp();
    let active_timer = ActiveTimer {
        project_name: sanitized_name.clone(),
        start_time,
        hourly_rate: sanitized_rate,
    };
    let status = timer_state.start(sanitized_name, start_time, sanitized_rate)?;
    let db_path = resolve_db_path(app_handle)?;
    if let Err(err) = persist_active_timer(db_path, &active_timer) {
        timer_state.clear();
        return Err(err);
    }
    refresh_tray(app_handle).map_err(|err| err.to_string())?;
    emit_timer_status(app_handle, &status);
    Ok(status)
}

async fn stop_timer_internal(app_handle: &AppHandle) -> Result<Option<TimeEntry>, String> {
    let timer_state = app_handle.state::<TimerState>();
    let Some(active) = timer_state.take_active() else {
        return Err("No timer is currently running".into());
    };

    let end_time = current_unix_timestamp().max(active.start_time + 1);
    let db_path = resolve_db_path(app_handle)?;

    let entry = persist_time_entry(
        db_path,
        active.project_name.clone(),
        active.start_time,
        end_time,
        active.hourly_rate,
    )
    .await?;
    let _ = clear_active_timer(resolve_db_path(app_handle)?);

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

fn resolve_invoices_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;

    dir.push("invoices");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

async fn persist_time_entry(
    db_path: PathBuf,
    project_name: String,
    start_time: i64,
    end_time: i64,
    hourly_rate: f64,
) -> Result<TimeEntry, String> {
    let duration = end_time - start_time;
    let amount = calculate_amount(duration, hourly_rate);

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_connection(db_path)?;
        conn.execute(
            "INSERT INTO time_entries (project_name, start_time, end_time, duration, hourly_rate, amount)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_name, start_time, end_time, duration, hourly_rate, amount],
        )
        .map_err(|err| err.to_string())?;

        let id = conn.last_insert_rowid();

        Ok::<_, String>(TimeEntry {
            id,
            project_name,
            start_time,
            end_time,
            duration,
            hourly_rate,
            amount,
        })
    })
    .await
    .map_err(|err| err.to_string())?
}

fn open_connection(db_path: PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|err| err.to_string())?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|err| err.to_string())?;
    conn.execute(CREATE_TIME_ENTRIES_TABLE_SQL, [])
        .map_err(|err| err.to_string())?;
    conn.execute(CREATE_ACTIVE_TIMER_TABLE_SQL, [])
        .map_err(|err| err.to_string())?;
    conn.execute(CREATE_INVOICES_TABLE_SQL, [])
        .map_err(|err| err.to_string())?;
    ensure_rate_columns(&conn)?;
    Ok(conn)
}

fn fetch_time_entry(conn: &Connection, id: i64) -> Result<TimeEntry, String> {
    conn
        .query_row(
            "SELECT id, project_name, start_time, end_time, duration, hourly_rate, amount
             FROM time_entries
             WHERE id = ?1",
            params![id],
            |row| {
                Ok(TimeEntry {
                    id: row.get(0)?,
                    project_name: row.get(1)?,
                    start_time: row.get(2)?,
                    end_time: row.get(3)?,
                    duration: row.get(4)?,
                    hourly_rate: row.get(5)?,
                    amount: row.get(6)?,
                })
            },
        )
        .map_err(|err| err.to_string())
}

fn database_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_time_entries",
            sql: CREATE_TIME_ENTRIES_TABLE_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_invoices",
            sql: CREATE_INVOICES_TABLE_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_active_timer",
            sql: CREATE_ACTIVE_TIMER_TABLE_SQL,
            kind: MigrationKind::Up,
        },
    ]
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
    let today_total = current_today_totals(&app_handle).map_err(to_tauri_error)?;
    let initial_menu = build_tray_menu(
        &app_handle,
        &initial_status,
        today_total.total_seconds,
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
                let _ = start_timer_internal(app, "Quick Task".to_string(), 0.0);
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
    let totals = current_today_totals(app).map_err(to_tauri_error)?;

    apply_tray_updates(app, &status, totals.total_seconds)
}

fn apply_tray_updates(
    app: &AppHandle,
    status: &TimerStatusPayload,
    today_total_seconds: i64,
) -> tauri::Result<()> {
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
        let menu = build_tray_menu(
            app,
            status,
            today_total_seconds,
            is_main_window_visible(app),
        )?;
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    status: &TimerStatusPayload,
    today_total_seconds: i64,
    window_visible: bool,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let status_item = MenuItemBuilder::with_id(MENU_STATUS_ID, build_status_text(status))
        .enabled(false)
        .build(app)?;
    let total_item = MenuItemBuilder::with_id(
        MENU_TOTAL_ID,
        format!("Total Today: {}", format_duration(today_total_seconds)),
    )
    .enabled(false)
    .build(app)?;
    let start_item = MenuItemBuilder::with_id(MENU_START_ID, "Start Timer")
        .enabled(!status.is_running)
        .build(app)?;
    let stop_item = MenuItemBuilder::with_id(MENU_STOP_ID, "Stop Timer")
        .enabled(status.is_running)
        .build(app)?;
    let toggle_label = if window_visible {
        "Hide Window"
    } else {
        "Show Window"
    };
    let toggle_item = MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW_ID, toggle_label).build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT_ID, "Quit").build(app)?;

    MenuBuilder::new(app)
        .item(&status_item)
        .item(&total_item)
        .separator()
        .item(&start_item)
        .item(&stop_item)
        .separator()
        .item(&toggle_item)
        .item(&quit_item)
        .build()
}

fn build_tray_icon(ring_color: [u8; 4], hand_color: [u8; 4]) -> Image<'static> {
    let size: u32 = 32;
    let len = (size * size * 4) as usize;
    let mut data = vec![0u8; len];
    let center = (size as f32 - 1.0) / 2.0;
    let outer = 11.5f32;
    let inner = outer - 2.4f32;
    let hand_length = 9.0f32;
    let hand_thickness = 1.3f32;

    let set_px = |data: &mut [u8], x: u32, y: u32, color: [u8; 4]| {
        let idx = ((y * size + x) * 4) as usize;
        data[idx..idx + 4].copy_from_slice(&color);
    };

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist <= outer && dist >= inner {
                set_px(&mut data, x, y, ring_color);
            }
        }
    }

    // vertical hand
    for y in 0..size {
        for x in 0..size {
            let dx = (x as f32 - center).abs();
            let y_top = center - hand_length;
            if dx <= hand_thickness && (y as f32) >= y_top && (y as f32) <= center {
                set_px(&mut data, x, y, hand_color);
            }
        }
    }

    // horizontal hand
    for y in 0..size {
        for x in 0..size {
            let dy = (y as f32 - center).abs();
            let x_right = center + hand_length;
            if dy <= hand_thickness && (x as f32) >= center && (x as f32) <= x_right {
                set_px(&mut data, x, y, hand_color);
            }
        }
    }

    // center cap
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist <= 2.0 {
                set_px(&mut data, x, y, ring_color);
            }
        }
    }

    Image::new_owned(data, size, size)
}

fn sanitize_project_name(project_name: String) -> String {
    let trimmed = project_name.trim();
    if trimmed.is_empty() {
        "Untitled Task".to_string()
    } else {
        trimmed.to_string()
    }
}

fn sanitize_hourly_rate(rate: f64) -> f64 {
    if rate.is_finite() {
        rate.max(0.0)
    } else {
        0.0
    }
}

fn current_unix_timestamp() -> i64 {
    Utc::now().timestamp()
}

fn persist_active_timer(db_path: PathBuf, timer: &ActiveTimer) -> Result<(), String> {
    let conn = open_connection(db_path)?;
    conn.execute(
        "INSERT OR REPLACE INTO active_timer (id, project_name, start_time, hourly_rate)
         VALUES (1, ?1, ?2, ?3)",
        params![timer.project_name, timer.start_time, timer.hourly_rate],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

fn clear_active_timer(db_path: PathBuf) -> Result<(), String> {
    let conn = open_connection(db_path)?;
    conn.execute("DELETE FROM active_timer WHERE id = 1", [])
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn load_active_timer(db_path: PathBuf) -> Result<Option<ActiveTimer>, String> {
    let conn = open_connection(db_path)?;
    let result = conn.query_row(
        "SELECT project_name, start_time, hourly_rate FROM active_timer WHERE id = 1",
        [],
        |row| {
            Ok(ActiveTimer {
                project_name: row.get(0)?,
                start_time: row.get(1)?,
                hourly_rate: row.get(2)?,
            })
        },
    );
    match result {
        Ok(timer) => Ok(Some(timer)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

fn last_used_hourly_rate(db_path: PathBuf) -> Result<f64, String> {
    let conn = open_connection(db_path)?;
    let result = conn.query_row(
        "SELECT hourly_rate FROM time_entries ORDER BY start_time DESC LIMIT 1",
        [],
        |row| row.get::<_, f64>(0),
    );
    match result {
        Ok(rate) => Ok(sanitize_hourly_rate(rate)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0.0),
        Err(err) => Err(err.to_string()),
    }
}

fn restore_active_timer(app: &AppHandle) -> Result<(), String> {
    let db_path = resolve_db_path(app)?;
    if let Some(timer) = load_active_timer(db_path)? {
        let timer_state = app.state::<TimerState>();
        timer_state.restore(timer);
        let status = timer_state.status();
        let _ = refresh_tray(app);
        emit_timer_status(app, &status);
    }
    Ok(())
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

fn calculate_amount(duration_seconds: i64, hourly_rate: f64) -> f64 {
    let hours = duration_seconds as f64 / 3600.0;
    let raw_amount = hours * hourly_rate;
    (raw_amount * 100.0).round() / 100.0
}

fn current_today_totals(app: &AppHandle) -> Result<TodayTotals, String> {
    let db_path = resolve_db_path(app)?;
    let (start_ts, end_ts) = day_bounds_timestamps()?;
    let conn = open_connection(db_path)?;
    query_totals_between(&conn, start_ts, end_ts)
}

fn to_tauri_error(message: String) -> tauri::Error {
    tauri::Error::from(io::Error::new(io::ErrorKind::Other, message))
}

fn query_totals_between(
    conn: &Connection,
    start_ts: i64,
    end_ts: i64,
) -> Result<TodayTotals, String> {
    conn.query_row(
        "SELECT
                COALESCE(SUM(duration), 0) as total_duration,
                COALESCE(SUM(amount), 0) as total_amount
             FROM time_entries
             WHERE start_time >= ?1 AND start_time < ?2",
        params![start_ts, end_ts],
        |row| {
            Ok(TodayTotals {
                total_seconds: row.get(0)?,
                total_amount: row.get(1)?,
            })
        },
    )
    .map_err(|err| err.to_string())
}

fn ensure_rate_columns(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(time_entries)")
        .map_err(|err| err.to_string())?;
    let mut has_hourly_rate = false;
    let mut has_amount = false;
    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(1)?;
            Ok(name)
        })
        .map_err(|err| err.to_string())?;

    for col in rows {
        let name = col.map_err(|err| err.to_string())?;
        if name == "hourly_rate" {
            has_hourly_rate = true;
        }
        if name == "amount" {
            has_amount = true;
        }
    }

    if !has_hourly_rate {
        conn.execute(
            "ALTER TABLE time_entries ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    if !has_amount {
        conn.execute(
            "ALTER TABLE time_entries ADD COLUMN amount REAL NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn check_overlapping_entries(
    conn: &Connection,
    current_id: i64,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<TimeEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_name, start_time, end_time, duration, hourly_rate, amount
             FROM time_entries
             WHERE id != ?1
             AND NOT (end_time <= ?2 OR start_time >= ?3)
             ORDER BY start_time ASC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![current_id, start_time, end_time], |row| {
            Ok(TimeEntry {
                id: row.get(0)?,
                project_name: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration: row.get(4)?,
                hourly_rate: row.get(5)?,
                amount: row.get(6)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut entries = Vec::new();
    for entry in rows {
        entries.push(entry.map_err(|err| err.to_string())?);
    }

    Ok(entries)
}
