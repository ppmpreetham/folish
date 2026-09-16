// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
pub mod compress;
mod file;
mod types;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            file::save_canvas,
            file::load_canvas,
            file::get_thumbnails,
            file::folder_previews,
            file::rename_item,
            file::get_dir_contents,
            file::create_folder,
            file::save_folder_config,
            file::update_canvas_meta,
            file::check_folder_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
