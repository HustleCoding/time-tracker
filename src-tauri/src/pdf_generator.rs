use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use chrono::{DateTime, Local};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct TimeEntry {
    pub id: i64,
    pub project_name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration: i64,
    pub hourly_rate: f64,
    pub amount: f64,
}

#[derive(Debug, Clone)]
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

pub fn generate_invoice(
    entries: Vec<TimeEntry>,
    business_info: BusinessInfo,
    output_path: &str,
) -> Result<(), String> {
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        "Time Tracking Invoice",
        Mm(210.0), // A4 width
        Mm(297.0), // A4 height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Load fonts
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Failed to load font: {}", e))?;
    let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Failed to load font: {}", e))?;

    let mut y_position: f32 = 260.0; // Start from top

    // Title
    current_layer.use_text(
        "TIME TRACKING INVOICE",
        24.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 10.0_f32;

    // Invoice metadata
    let now = Local::now();
    current_layer.use_text(
        &format!("Invoice Date: {}", now.format("%B %d, %Y")),
        10.0,
        Mm(20.0),
        Mm(y_position),
        &font_regular,
    );
    y_position -= 12.0_f32;

    let from_y = write_contact_block(
        &current_layer,
        &font_bold,
        &font_regular,
        "FROM",
        20.0,
        y_position,
        &business_info.name,
        &business_info.address,
        &business_info.email,
        &business_info.phone,
    );

    let to_y = write_contact_block(
        &current_layer,
        &font_bold,
        &font_regular,
        "BILL TO",
        130.0,
        y_position,
        business_info
            .client_name
            .as_deref()
            .unwrap_or("")
            .trim(),
        &business_info.client_address,
        &business_info.client_email,
        &business_info.client_phone,
    );

    y_position = from_y.min(to_y) - 10.0_f32;

    // Group entries by project
    let mut projects: HashMap<String, Vec<TimeEntry>> = HashMap::new();
    for entry in entries {
        projects
            .entry(entry.project_name.clone())
            .or_insert_with(Vec::new)
            .push(entry);
    }

    // Time entries section
    current_layer.use_text(
        "TIME ENTRIES:",
        12.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 8.0_f32;

    let mut total_hours = 0.0;
    let mut total_amount = 0.0;

    // Sort projects by name for consistent ordering
    let mut project_names: Vec<String> = projects.keys().cloned().collect();
    project_names.sort();

    for project_name in project_names {
        let project_entries = projects.get(&project_name).unwrap();

        // Project header
        current_layer.use_text(
            &project_name,
            11.0,
            Mm(20.0),
            Mm(y_position),
            &font_bold,
        );
            y_position -= 6.0_f32;

        let mut project_duration = 0;
        let mut project_amount = 0.0;

        for entry in project_entries {
            let start_dt = DateTime::from_timestamp(entry.start_time, 0)
                .unwrap_or_else(|| Local::now().into());
            let end_dt = DateTime::from_timestamp(entry.end_time, 0)
                .unwrap_or_else(|| Local::now().into());

            let date_str = start_dt.format("%b %d, %Y").to_string();
            let time_range = format!(
                "{} - {}",
                start_dt.format("%H:%M"),
                end_dt.format("%H:%M")
            );

            let duration_str = format_duration(entry.duration);

            current_layer.use_text(
                &format!("  {} | {} | {} hrs @ ${}/hr",
                    date_str, time_range, duration_str, entry.hourly_rate),
                9.0,
                Mm(25.0),
                Mm(y_position),
                &font_regular,
            );

            current_layer.use_text(
                &format!("${:.2}", entry.amount),
                9.0,
                Mm(170.0),
                Mm(y_position),
                &font_regular,
            );

            y_position -= 5.0_f32;
            project_duration += entry.duration;
            project_amount += entry.amount;
        }

        // Project subtotal
        current_layer.use_text(
            &format!("  Subtotal: {}", format_duration(project_duration)),
            10.0,
            Mm(25.0),
            Mm(y_position),
            &font_bold,
        );

        current_layer.use_text(
            &format!("${:.2}", project_amount),
            10.0,
            Mm(170.0),
            Mm(y_position),
            &font_bold,
        );

        y_position -= 8.0_f32;

        total_hours += project_duration as f64 / 3600.0;
        total_amount += project_amount;
    }

    y_position -= 5.0_f32;

    // Separator line (using text characters as a simple alternative)
    current_layer.use_text(
        "―――――――――――――――――――――――――――――――――――――――――――――――――――",
        10.0,
        Mm(20.0),
        Mm(y_position),
        &font_regular,
    );

    y_position -= 8.0_f32;

    // Total section
    current_layer.use_text(
        &format!("TOTAL HOURS: {}", format_total_hours(total_hours)),
        12.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );

    current_layer.use_text(
        &format!("${:.2}", total_amount),
        14.0,
        Mm(160.0),
        Mm(y_position),
        &font_bold,
    );

    // Save PDF
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create PDF file: {}", e))?;
    let mut buf_writer = BufWriter::new(file);

    doc.save(&mut buf_writer)
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(())
}

fn format_duration(seconds: i64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;

    if hours > 0 {
        format!("{}.{:02}", hours, (minutes as f64 / 60.0 * 100.0) as i32)
    } else {
        format!("0.{:02}", (minutes as f64 / 60.0 * 100.0) as i32)
    }
}

fn format_total_hours(hours: f64) -> String {
    format!("{:.2} hrs", hours)
}

fn write_contact_block(
    layer: &PdfLayerReference,
    font_bold: &IndirectFontRef,
    font_regular: &IndirectFontRef,
    label: &str,
    x: f32,
    mut y: f32,
    name: &str,
    address: &Option<String>,
    email: &Option<String>,
    phone: &Option<String>,
) -> f32 {
    layer.use_text(label, 12.0, Mm(x), Mm(y), font_bold);
    y -= 6.0_f32;

    if !name.trim().is_empty() {
        layer.use_text(name, 10.0, Mm(x), Mm(y), font_regular);
        y -= 5.0_f32;
    }

    if let Some(value) = address {
        if !value.trim().is_empty() {
            layer.use_text(value.trim(), 10.0, Mm(x), Mm(y), font_regular);
            y -= 5.0_f32;
        }
    }

    if let Some(value) = email {
        if !value.trim().is_empty() {
            layer.use_text(
                &format!("Email: {}", value.trim()),
                10.0,
                Mm(x),
                Mm(y),
                font_regular,
            );
            y -= 5.0_f32;
        }
    }

    if let Some(value) = phone {
        if !value.trim().is_empty() {
            layer.use_text(
                &format!("Phone: {}", value.trim()),
                10.0,
                Mm(x),
                Mm(y),
                font_regular,
            );
            y -= 5.0;
        }
    }

    y
}
