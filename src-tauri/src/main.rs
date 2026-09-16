// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// CLI shims for OS thumbnail integration, run before Tauri boots:
///   folish thumbnail <input.flsh> <out.png>   (Linux freedesktop thumbnailer)
fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() == 4 && args[1] == "thumbnail" {
        match folish_lib::compress::extract_thumbnail(&args[2]) {
            Ok(png) => std::fs::write(&args[3], png).unwrap_or_else(|e| {
                eprintln!("folish: failed to write {}: {e}", args[3]);
                std::process::exit(1);
            }),
            Err(e) => {
                eprintln!("folish: {e}");
                std::process::exit(1);
            }
        }
    } else {
        folish_lib::run()
    }
}
