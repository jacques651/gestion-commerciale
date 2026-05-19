use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use rusqlite::{params, Connection};

pub type DbState = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Client {
    pub idClient: i64,
    pub code_client: String,
    pub nom_complet: String,
    pub societe: Option<String>,
    pub type_client: String,
}

#[tauri::command]
pub fn get_all_clients(state: State<DbState>) -> Result<Vec<Client>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT idClient, code_client, nom_complet, societe, type_client FROM clients WHERE est_supprime = 0")?;
    let clients = stmt.query_map([], |row| {
        Ok(Client {
            idClient: row.get(0)?,
            code_client: row.get(1)?,
            nom_complet: row.get(2)?,
            societe: row.get(3)?,
            type_client: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    clients.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_client_by_id(idClient: i64, state: State<DbState>) -> Result<Option<Client>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT idClient, code_client, nom_complet, societe, type_client FROM clients WHERE idClient = ?1")?;
    let mut rows = stmt.query(params![idClient])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Client {
            idClient: row.get(0)?,
            code_client: row.get(1)?,
            nom_complet: row.get(2)?,
            societe: row.get(3)?,
            type_client: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn get_client_by_code(code_client: String, state: State<DbState>) -> Result<Option<Client>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT idClient, code_client, nom_complet, societe, type_client FROM clients WHERE code_client = ?1")?;
    let mut rows = stmt.query(params![code_client])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Client {
            idClient: row.get(0)?,
            code_client: row.get(1)?,
            nom_complet: row.get(2)?,
            societe: row.get(3)?,
            type_client: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}
