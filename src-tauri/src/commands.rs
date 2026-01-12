use crate::compress::{compress_to_file_str, decompress_from_file, COMPRESSED_EXTENSION};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Point {
    x: f32,
    y: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Stroke {
    id: String,
    points: Vec<Point>,
    color: String,
    width: f32,
    #[serde(rename = "layerId")]
    layer_id: String,
    timestamp: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Layer {
    id: String,
    name: String,
    visible: bool,
    locked: bool,
    opacity: f32,
    #[serde(rename = "strokeIds")]
    stroke_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Camera {
    x: f32,
    y: f32,
    zoom: f32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CanvasState {
    layers: Vec<Layer>,
    strokes: std::collections::HashMap<String, Stroke>,
    camera: Camera,
    #[serde(rename = "activeLayerId")]
    active_layer_id: String,
    #[serde(rename = "activeTool")]
    active_tool: String,
    #[serde(rename = "activeColor")]
    active_color: String,
    #[serde(rename = "activeWidth")]
    active_width: f32,
}

fn get_canvas_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    // C:\Users\...\AppData\Roaming\folish\canvases
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {}", e))?;

    let canvas_dir = app_data.join("canvases");

    std::fs::create_dir_all(&canvas_dir)
        .map_err(|e| format!("Failed to create canvases dir: {}", e))?;

    Ok(canvas_dir)
}

#[tauri::command]
pub async fn save_canvas(
    app_handle: tauri::AppHandle,
    canvas: CanvasState,
    filename: String,
) -> Result<String, String> {
    let canvas_dir = get_canvas_dir(&app_handle)?;

    // constant extension
    let file_path = canvas_dir.join(format!("{}.{}", filename, COMPRESSED_EXTENSION));

    let json = serde_json::to_string(&canvas).map_err(|e| format!("Failed to serialize: {}", e))?;

    compress_to_file_str(&file_path, &json).map_err(|e| format!("Compression failed: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
