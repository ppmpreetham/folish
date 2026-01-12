use crate::commands::CanvasState;
use crate::compress::{compress_to_file_str, decompress_from_file, PROJECT_EXTENSION};

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// returns the base directory (~/AppData/Roaming/folish/canvases on Windows)
fn get_canvas_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {}", e))?;

    let canvas_dir = app_data.join("canvases");

    fs::create_dir_all(&canvas_dir)
        .map_err(|e| format!("Failed to create canvases directory: {}", e))?;

    Ok(canvas_dir)
}

/// full path for a folish file (without extension)
fn canvas_file_path(canvas_dir: impl AsRef<Path>, filename: &str) -> PathBuf {
    canvas_dir
        .as_ref()
        .join(format!("{}.{}", filename, PROJECT_EXTENSION))
}

/// checks if a filename looks like a folish project file
pub fn is_project_file(name: &str) -> bool {
    name.ends_with(&format!(".{}", PROJECT_EXTENSION))
}

/// removes the project extension from a filename
pub fn strip_project_extension(name: &str) -> String {
    name.trim_end_matches(&format!(".{}", PROJECT_EXTENSION))
        .to_string()
}

#[tauri::command]
pub async fn save_canvas(
    app_handle: AppHandle,
    canvas: CanvasState,
    filename: String,
) -> Result<String, String> {
    let dir = get_canvas_dir(&app_handle)?;
    let path = canvas_file_path(&dir, &filename);

    let json =
        serde_json::to_string(&canvas).map_err(|e| format!("Serialization failed: {}", e))?;

    compress_to_file_str(&path, &json).map_err(|e| format!("Compression failed: {}", e))?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn load_canvas(app_handle: AppHandle, filename: String) -> Result<CanvasState, String> {
    let dir = get_canvas_dir(&app_handle)?;
    let path = canvas_file_path(&dir, &filename);

    if !path.exists() {
        return Err(format!("Folish canvas not found: {}", filename));
    }

    let json = decompress_from_file(&path).map_err(|e| format!("Decompression failed: {}", e))?;

    let canvas = serde_json::from_str::<CanvasState>(&json)
        .map_err(|e| format!("Deserialization failed: {}", e))?;

    Ok(canvas)
}

#[tauri::command]
pub async fn list_canvases(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let dir = get_canvas_dir(&app_handle)?;

    let mut names = Vec::new();

    for entry in
        fs::read_dir(&dir).map_err(|e| format!("Failed to read canvases directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;

        if let Some(name) = entry.file_name().to_str() {
            if is_project_file(name) {
                names.push(strip_project_extension(name));
            }
        }
    }

    names.sort();
    Ok(names)
}
