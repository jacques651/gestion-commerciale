// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Forcer le chemin de la base de données vers Roaming (APPDATA)
    let db_path = std::env::var("APPDATA")
        .unwrap_or_else(|_| ".".to_string())
        + "/com.user.gestion-commerciale/gestion-commerciale.db";
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default()
            .build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
