use serde::{Deserialize, Serialize};

/// Metadata embedded in every .flsh file. All fields optional so pre-meta
/// files (and partial save requests) deserialize cleanly.
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct FileMeta {
    pub description: Option<String>,
    /// In-file creation time: survives copy/move, unlike filesystem ctime.
    pub created_at: Option<u64>,
    pub tags: Option<Vec<String>>,
    pub app_version: Option<String>,
    /// Small PNG data URL rendered at save time, shown by the dashboard and
    /// extracted by OS thumbnail providers.
    pub thumbnail: Option<String>,
}

/// What's on disk for a .flsh file. `canvas` stays opaque: the Rust side never
/// mirrors the frontend's drawing model, so new canvas features need no backend change.
#[derive(Serialize, Deserialize, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct CanvasDocument {
    pub version: u32,
    pub meta: FileMeta,
    pub canvas: serde_json::Value,
}

impl Default for CanvasDocument {
    fn default() -> Self {
        Self { version: 1, meta: FileMeta::default(), canvas: serde_json::Value::Null }
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Grouping {
    CreatedAt,
    UpdatedAt,
    Folder,
    None,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Sorting {
    DateCreated,
    DateUpdated,
    Alphabetical,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum SortBy {
    Ascending,
    Descending,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderLayout {
    pub grouping: Option<GroupingConfig>,
    pub sorting: Option<SortingConfig>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GroupingConfig {
    pub grouping: Grouping,
    pub sort_by: SortBy,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SortingConfig {
    pub sorting: Sorting,
    pub sort_by: SortBy,
}

/// The exact structure of a folder's config.yaml.
#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct FolderConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<FolderLayout>,
}

/// Items inside a directory, sent to the frontend. Note: `rename_all` on the
/// enum only renames variants, so each variant needs its own for its fields.
#[derive(Serialize, Debug)]
#[serde(tag = "type")]
pub enum ExplorerItem {
    #[serde(rename_all = "camelCase")]
    Folder {
        name: String,
        path: String,
        config: Option<FolderConfig>,
        created_at: u64,
        updated_at: u64,
    },
    #[serde(rename_all = "camelCase")]
    File {
        name: String,
        path: String,
        created_at: u64,
        updated_at: u64,
    },
}
