use serde::Deserialize;

/// Request for `update_canvas_meta`: only provided fields change.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetaRequest {
    pub path: std::path::PathBuf,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}
