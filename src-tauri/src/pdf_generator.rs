use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use chrono::Local;

#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct InvoicePeriod {
    pub start_time: i64,
    pub end_time: i64,
}

pub fn generate_invoice(
    entries: Vec<TimeEntry>,
    business_info: BusinessInfo,
    output_path: &str,
    _period: Option<InvoicePeriod>,
) -> Result<(), String> {
    // Create PDF document
    let title_text = "Invoice".to_string();

    let (doc, page1, layer1) = PdfDocument::new(
        &title_text,
        Mm(210.0), // A4 width
        Mm(297.0), // A4 height
        "Layer 1",
    );

    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Failed to load font: {}", e))?;
    let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Failed to load font: {}", e))?;

    let current_layer = doc.get_page(page1).get_layer(layer1);

    let mut y_position: f32 = 260.0;

    // Header
    current_layer.use_text(
        &title_text,
        24.0,
        Mm(20.0),
        Mm(y_position),
        &font_bold,
    );
    y_position -= 12.0_f32;

    let issue_date = Local::now();
    current_layer.use_text(
        &format!("Issue date: {}", issue_date.format("%d/%m/%Y")),
        11.0,
        Mm(20.0),
        Mm(y_position),
        &font_regular,
    );
    y_position -= 10.0_f32;
    y_position -= 8.0_f32;

    // Divider
    draw_line(&current_layer, 20.0, y_position, 190.0, y_position, 0.3);
    y_position -= 14.0_f32;

    // Two columns: Bill from / Bill to
    let from_y = write_contact_block(
        &current_layer,
        &font_bold,
        &font_regular,
        "Bill from",
        20.0,
        85.0,
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
        "Bill to",
        120.0,
        70.0,
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

    y_position = from_y.min(to_y) - 18.0_f32;

    // Table Header
    current_layer.use_text("Description", 10.0, Mm(20.0), Mm(y_position), &font_regular);
    current_layer.use_text("Quantity", 10.0, Mm(110.0), Mm(y_position), &font_regular);
    current_layer.use_text("Unit Price", 10.0, Mm(140.0), Mm(y_position), &font_regular);
    current_layer.use_text("Amount", 10.0, Mm(175.0), Mm(y_position), &font_regular);
    y_position -= 6.0_f32;
    draw_line(&current_layer, 20.0, y_position, 190.0, y_position, 0.4);
    y_position -= 10.0_f32;

    // Aggregate totals
    let total_hours: f64 = entries.iter().map(|e| e.duration as f64 / 3600.0).sum();
    let total_amount: f64 = entries.iter().map(|e| e.amount).sum();
    let unit_price = if total_hours > 0.0 { total_amount / total_hours } else { 0.0 };

    // Single row summary
    current_layer.use_text("Hours worked", 10.0, Mm(20.0), Mm(y_position), &font_regular);
    current_layer.use_text(
        &format!("{:.2}", total_hours),
        10.0,
        Mm(110.0),
        Mm(y_position),
        &font_regular,
    );
    current_layer.use_text(
        &format_money(unit_price),
        10.0,
        Mm(140.0),
        Mm(y_position),
        &font_regular,
    );
    current_layer.use_text(
        &format_money(total_amount),
        10.0,
        Mm(175.0),
        Mm(y_position),
        &font_regular,
    );
    y_position -= 12.0_f32;

    draw_line(&current_layer, 20.0, y_position, 190.0, y_position, 0.3);
    y_position -= 12.0_f32;

    // Totals
    current_layer.use_text(
        "SUBTOTAL",
        10.0,
        Mm(140.0),
        Mm(y_position),
        &font_regular,
    );
    current_layer.use_text(
        &format_money(total_amount),
        10.0,
        Mm(175.0),
        Mm(y_position),
        &font_regular,
    );
    y_position -= 10.0_f32;
    current_layer.use_text(
        "TOTAL",
        12.0,
        Mm(140.0),
        Mm(y_position),
        &font_bold,
    );
    current_layer.use_text(
        &format_money(total_amount),
        12.0,
        Mm(175.0),
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

fn format_money(amount: f64) -> String {
    format!("{:.2} USD", amount)
}

fn write_contact_block(
    layer: &PdfLayerReference,
    font_bold: &IndirectFontRef,
    font_regular: &IndirectFontRef,
    label: &str,
    x: f32,
    max_width_mm: f32,
    mut y: f32,
    name: &str,
    address: &Option<String>,
    email: &Option<String>,
    phone: &Option<String>,
) -> f32 {
    layer.use_text(label, 12.0, Mm(x), Mm(y), font_bold);
    y -= 6.0_f32;

    if !name.trim().is_empty() {
        y = write_wrapped_text(layer, font_regular, name.trim(), 10.0, x, y, max_width_mm);
    }

    if let Some(value) = address {
        if !value.trim().is_empty() {
            y = write_wrapped_text(layer, font_regular, value.trim(), 10.0, x, y, max_width_mm);
        }
    }

    if let Some(value) = email {
        if !value.trim().is_empty() {
            y = write_wrapped_text(
                layer,
                font_regular,
                &format!("Email: {}", value.trim()),
                10.0,
                x,
                y,
                max_width_mm,
            );
        }
    }

    if let Some(value) = phone {
        if !value.trim().is_empty() {
            y = write_wrapped_text(
                layer,
                font_regular,
                &format!("Phone: {}", value.trim()),
                10.0,
                x,
                y,
                max_width_mm,
            );
        }
    }

    y
}

fn write_wrapped_text(
    layer: &PdfLayerReference,
    font: &IndirectFontRef,
    text: &str,
    font_size: f32,
    x: f32,
    mut y: f32,
    max_width_mm: f32,
) -> f32 {
    let max_chars = max_characters_for_width(max_width_mm, font_size);
    for line in wrap_text(text, max_chars) {
        layer.use_text(line, font_size, Mm(x), Mm(y), font);
        y -= 5.0_f32;
    }
    y
}

fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    if max_chars == 0 {
        return vec![text.to_string()];
    }

    let mut lines = Vec::new();
    let mut current_line = String::new();
    let mut current_len = 0usize;

    for word in text.split_whitespace() {
        let word_len = word.chars().count();
        if current_line.is_empty() {
            if word_len > max_chars {
                split_long_word(word, max_chars, &mut lines);
                current_line.clear();
                current_len = 0;
            } else {
                current_line.push_str(word);
                current_len = word_len;
            }
            continue;
        }

        if current_len + 1 + word_len <= max_chars {
            current_line.push(' ');
            current_line.push_str(word);
            current_len += 1 + word_len;
        } else {
            lines.push(current_line);
            current_line = String::new();
            current_len = 0;

            if word_len > max_chars {
                split_long_word(word, max_chars, &mut lines);
            } else {
                current_line.push_str(word);
                current_len = word_len;
            }
        }
    }

    if !current_line.is_empty() {
        lines.push(current_line);
    }

    if lines.is_empty() {
        vec![String::new()]
    } else {
        lines
    }
}

fn split_long_word(word: &str, max_chars: usize, lines: &mut Vec<String>) {
    if max_chars == 0 {
        lines.push(word.to_string());
        return;
    }

    let mut buffer = String::new();
    let mut count = 0usize;

    for ch in word.chars() {
        buffer.push(ch);
        count += 1;

        if count == max_chars {
            lines.push(buffer.clone());
            buffer.clear();
            count = 0;
        }
    }

    if !buffer.is_empty() {
        lines.push(buffer);
    }
}

fn max_characters_for_width(max_width_mm: f32, font_size: f32) -> usize {
    let approx_char_width_mm = font_size * 0.5 * 0.352_778_f32;
    let estimated = (max_width_mm / approx_char_width_mm).floor() as usize;
    estimated.max(8)
}

fn draw_line(layer: &PdfLayerReference, x1: f32, y1: f32, x2: f32, y2: f32, thickness: f32) {
    let line = Line {
        points: vec![
            (Point::new(Mm(x1), Mm(y1)), false),
            (Point::new(Mm(x2), Mm(y2)), false),
        ],
        is_closed: false,
    };
    layer.set_outline_thickness(thickness);
    layer.add_line(line);
}
