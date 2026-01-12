use serde::{Deserialize, Serialize};

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
