use std::{fs::DirEntry, time::{SystemTime, UNIX_EPOCH}};

use crate::types::ExplorerItem;

fn to_secs(time: std::io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// DirEntry -> ExplorerItem, reading folder configs along the way.
/// Unreadable entries are skipped; unreadable configs are just `None`.
pub fn process_entry(entry: DirEntry, config: Option<crate::types::FolderConfig>) -> Option<ExplorerItem> {
    let path = entry.path();
    let metadata = entry.metadata().ok()?;

    let name = path.file_name()?.to_str()?.to_string();
    let created_at = to_secs(metadata.created());
    let updated_at = to_secs(metadata.modified());

    if metadata.is_dir() {
        Some(ExplorerItem::Folder { name, path: path.to_string_lossy().into_owned(), config, created_at, updated_at })
    } else if metadata.is_file() {
        Some(ExplorerItem::File { name, path: path.to_string_lossy().into_owned(), created_at, updated_at })
    } else {
        None
    }
}
