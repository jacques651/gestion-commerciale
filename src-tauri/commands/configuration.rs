use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use rusqlite::{params, Connection};

pub type DbState = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigAtelier {
    pub id: i64,
    pub nom_atelier: Option<String>,
}

#[tauri::command]
pub fn get_configuration(state: State<DbState>) -> Result<ConfigAtelier, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, nom_atelier FROM configuration_atelier WHERE id = 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        Ok(ConfigAtelier {
            id: row.get(0)?,
            nom_atelier: row.get(1)?,
        })
    } else {
        conn.execute("INSERT INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON ATELIER')", [])?;
        get_configuration(state)
    }
}

#[tauri::command]
pub fn update_configuration(nom_atelier: String, state: State<DbState>) -> Result<ConfigAtelier, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE configuration_atelier SET nom_atelier = ?1 WHERE id = 1", params![nom_atelier])?;
    get_configuration(state)
}
