use crate::commands::UpdateMetaRequest;
use crate::compress::{compress_to_file_atomic, decompress_from_file, PROJECT_EXTENSION};
use crate::types::{CanvasDocument, ExplorerItem, FileMeta, FolderConfig};
use crate::utils::process_entry;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const CONFIG_FILE: &str = "config.yaml";

/// returns the base directory (~/Documents/Folish on macOS/Linux, %USERPROFILE%/Documents/Folish on Windows)
fn get_canvas_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let canvas_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to resolve document_dir: {e}"))?
        .join("Folish");

    fs::create_dir_all(&canvas_dir)
        .map_err(|e| format!("Failed to create Folish directory: {e}"))?;

    Ok(canvas_dir)
}

/// full path for a folish file (without extension)
fn canvas_file_path(canvas_dir: impl AsRef<Path>, filename: &str) -> PathBuf {
    canvas_dir
        .as_ref()
        .join(format!("{}.{}", filename, PROJECT_EXTENSION))
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

/// loads a document, tolerating pre-meta files: an old bare-JSON canvas
/// becomes a default CanvasDocument with the geometry in `canvas`.
fn read_document(path: &Path) -> Result<CanvasDocument, String> {
    let json = decompress_from_file(path).map_err(|e| format!("Decompression failed: {e}"))?;
    parse_document(&json)
}

fn parse_document(json: &str) -> Result<CanvasDocument, String> {
    serde_json::from_str::<CanvasDocument>(json)
        .map_err(|e| format!("Deserialization failed: {e}"))
        .and_then(|doc| {
            // pre-meta files kept the canvas at the top level
            if doc.canvas.is_null() {
                let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
                if value.get("layers").is_some() {
                    return Ok(CanvasDocument { version: 1, meta: FileMeta::default(), canvas: value });
                }
            }
            Ok(doc)
        })
}

/// serde handles Option-filling and stale-field dropping; only the timestamp
/// policy needs code: creation time is written once and preserved forever.
fn merge_meta(current: &mut FileMeta, update: FileMeta) {
    current.description = update.description;
    current.tags = update.tags;
    current.thumbnail = update.thumbnail;
    current.created_at = current.created_at.or(update.created_at);
}

/// saves a canvas (creating the file if needed) and merges metadata; `parent`
/// defaults to the Folish root. Returns the file's full path.
#[tauri::command(rename_all = "camelCase")]
pub async fn save_canvas(
    app_handle: AppHandle,
    parent: Option<PathBuf>,
    filename: String,
    canvas: serde_json::Value,
    meta: Option<FileMeta>,
) -> Result<String, String> {
    let dir = match parent {
        Some(p) => p,
        None => get_canvas_dir(&app_handle)?,
    };
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create folder: {e}"))?;
    }
    let path = canvas_file_path(&dir, &filename);

    let mut doc = if path.exists() {
        read_document(&path)?
    } else {
        CanvasDocument::default()
    };

    doc.canvas = canvas;
    merge_meta(&mut doc.meta, meta.unwrap_or_default());
    doc.meta.created_at = doc.meta.created_at.or(Some(now_secs()));

    let json = serde_json::to_string(&doc).map_err(|e| format!("Serialization failed: {e}"))?;

    compress_to_file_atomic(&path, json.as_bytes())
        .map_err(|e| format!("Compression failed: {e}"))?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn load_canvas(
    app_handle: AppHandle,
    parent: Option<PathBuf>,
    filename: String,
) -> Result<CanvasDocument, String> {
    let dir = match parent {
        Some(p) => p,
        None => get_canvas_dir(&app_handle)?,
    };
    let path = canvas_file_path(&dir, &filename);

    if !path.exists() {
        return Err(format!("Folish canvas not found: {}", filename));
    }

    read_document(&path)
}

/// dashboard thumbnails: reads each file's embedded PNG data URL, keyed by
/// path (same paths save_canvas returns); files with no thumbnail get ""
#[tauri::command(rename_all = "camelCase")]
pub async fn get_thumbnails(
    paths: Vec<PathBuf>,
) -> Result<HashMap<String, String>, String> {
    Ok(paths
        .into_iter()
        .map(|p| {
            let data_url = read_document(&p)
                .ok()
                .and_then(|doc| doc.meta.thumbnail)
                .unwrap_or_default();
            (p.to_string_lossy().into_owned(), data_url)
        })
        .collect())
}

/// creates a folder (inside `parent`, default the Folish root) with a starter
/// config.yaml so every folder is born with metadata; returns its full path
#[tauri::command(rename_all = "camelCase")]
pub async fn create_folder(
    app_handle: AppHandle,
    parent: Option<PathBuf>,
    folder_name: String,
) -> Result<String, String> {
    let dir = match parent {
        Some(p) => p,
        None => get_canvas_dir(&app_handle)?,
    };
    let path = dir.join(&folder_name);

    if !path.exists() {
        fs::create_dir(&path).map_err(|e| format!("Failed to create folder: {e}"))?;
        write_folder_config(&path, &FolderConfig { title: Some(folder_name), ..Default::default() })?;
    }

    Ok(path.to_string_lossy().into_owned())
}

/// writes/updates a folder's config.yaml (description, grouping, sorting live here)
#[tauri::command(rename_all = "camelCase")]
pub async fn save_folder_config(path: PathBuf, config: FolderConfig) -> Result<(), String> {
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    write_folder_config(&path, &config)
}

fn write_folder_config(dir: &Path, config: &FolderConfig) -> Result<(), String> {
    let yaml = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    fs::write(dir.join(CONFIG_FILE), yaml).map_err(|e| e.to_string())
}

/// reads a folder's config.yaml if present and valid; missing/corrupt config is
/// not an error -- a stray folder just has no metadata
fn read_folder_config(dir: &Path) -> Option<FolderConfig> {
    fs::read_to_string(dir.join(CONFIG_FILE))
        .ok()
        .and_then(|yaml| serde_yaml::from_str::<FolderConfig>(&yaml).ok())
}

/// lists a directory's contents; `None` lists the Folish root, creating it
/// (with a starter config) on first launch
#[tauri::command(rename_all = "camelCase")]
pub async fn get_dir_contents(app_handle: AppHandle, path: Option<PathBuf>) -> Result<Vec<ExplorerItem>, String> {
    let dir = match path {
        Some(p) => p,
        None => get_canvas_dir(&app_handle)?,
    };
    if !dir.exists() {
        return Err("Path does not exist".to_string());
    }
    if !read_folder_config(&dir).is_some() {
        let title = dir.file_name().and_then(|n| n.to_str()).map(str::to_string);
        write_folder_config(&dir, &FolderConfig { title, ..Default::default() }).ok();
    }

    let items = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        // config.yaml is folder plumbing, not user content
        .filter(|e| e.file_name().to_str().map_or(true, |n| n != CONFIG_FILE && !n.starts_with('.')))
        .map(|e| {
            let config = read_folder_config(&e.path());
            process_entry(e, config)
        })
        .collect::<Vec<_>>();

    Ok(items.into_iter().flatten().collect())
}

/// renames a file or folder in place
#[tauri::command(rename_all = "camelCase")]
pub async fn rename_item(path: PathBuf, new_name: String) -> Result<(), String> {
    let target = path.with_file_name(&new_name);
    if target.exists() {
        return Err("Name already taken".to_string());
    }
    fs::rename(&path, &target).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn update_canvas_meta(update: UpdateMetaRequest) -> Result<(), String> {
    let mut doc = read_document(&update.path)?;

    if let Some(description) = update.description {
        doc.meta.description = Some(description);
    }
    if let Some(tags) = update.tags {
        doc.meta.tags = Some(tags);
    }

    let json = serde_json::to_string(&doc).map_err(|e| format!("Serialization failed: {e}"))?;
    compress_to_file_atomic(&update.path, json.as_bytes())
        .map_err(|e| format!("Compression failed: {e}"))?;

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn check_folder_config(path: PathBuf) -> Result<FolderConfig, String> {
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    read_folder_config(&path)
        .ok_or_else(|| "No valid config.yaml found in directory".to_string())
}
