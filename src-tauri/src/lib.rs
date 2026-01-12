// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod compress;
mod file;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            file::save_canvas,
            file::load_canvas,
            file::list_canvases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
