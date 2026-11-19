mod legacy_db;
mod prestation_bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(prestation_bridge::PrestationBridge::default())
        .invoke_handler(tauri::generate_handler![
            prestation_bridge::prestation_begin,
            prestation_bridge::prestation_query,
            prestation_bridge::prestation_execute,
            prestation_bridge::prestation_finish,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                legacy_db::check_and_restore_legacy(&handle);
                // Le preload SQL attend la decision ; React attend le preload.
                if let Err(error) = handle.plugin(tauri_plugin_sql::Builder::default().build()) {
                    legacy_db::log_startup_error(
                        &handle,
                        &format!("Ouverture SQL impossible : {error}"),
                    );
                    handle.exit(1);
                    return;
                }
                let result = handle
                    .config()
                    .app
                    .windows
                    .first()
                    .ok_or_else(|| "Configuration de fenetre absente".to_string())
                    .and_then(|config| {
                        tauri::WebviewWindowBuilder::from_config(&handle, config)
                            .map_err(|error| error.to_string())?
                            .build()
                            .map_err(|error| error.to_string())
                    });
                match result {
                    Ok(window) => {
                        let _ = window.set_focus();
                    }
                    Err(error) => {
                        legacy_db::log_startup_error(
                            &handle,
                            &format!("Ouverture de la fenetre impossible : {error}"),
                        );
                        handle.exit(1);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
