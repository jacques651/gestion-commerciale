//! Connexions reservees pour les seules operations de prestations.
//! Aucun chargement de base ni migration au demarrage.
use rusqlite::{
    types::{Value, ValueRef},
    Connection, OpenFlags,
};
use serde::Deserialize;
use serde_json::{Map, Value as Json};
use std::{
    collections::{hash_map::RandomState, HashMap},
    hash::{BuildHasher, Hasher},
    path::Path,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    utilisateur_id: i64,
    espace_id: Option<String>,
    role: String,
}
struct Lease {
    connection: Connection,
    action: String,
    expires: Instant,
}
#[derive(Default)]
pub struct PrestationBridge {
    leases: Mutex<HashMap<String, Lease>>,
}

fn begin_at(
    bridge: &PrestationBridge,
    path: &Path,
    ctx: &Context,
    action: &str,
) -> Result<String, String> {
    if !["read", "create", "update", "cancel", "delete"].contains(&action) {
        return Err("Operation inconnue".into());
    }
    if ctx.utilisateur_id <= 0 || ctx.espace_id.is_some() {
        return Err("FORBIDDEN: Acteur ou espace invalide".into());
    }
    // Nettoyage des transactions abandonnees : la fermeture SQLite les annule.
    bridge
        .leases
        .lock()
        .map_err(|e| e.to_string())?
        .retain(|_, lease| lease.expires > Instant::now());
    let flags = if action == "read" {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    } else {
        OpenFlags::SQLITE_OPEN_READ_WRITE
    };
    let connection = Connection::open_with_flags(path, flags).map_err(|e| e.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(10))
        .map_err(|e| e.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    if action == "read" {
        connection.execute_batch("BEGIN DEFERRED")
    } else {
        connection.execute_batch("BEGIN IMMEDIATE")
    }
    .map_err(|e| e.to_string())?;
    let (role, active) = connection
        .query_row(
            "SELECT role, est_actif FROM utilisateurs WHERE id = ?",
            [ctx.utilisateur_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
        )
        .map_err(|_| "FORBIDDEN: Acteur absent de la base".to_string())?;
    let actual_role = role.to_lowercase();
    // Correspond aux droits par defaut ventes.view/create/delete existants.
    let allowed = if ["cancel", "delete"].contains(&action) {
        actual_role == "admin"
    } else {
        ["admin", "gestionnaire", "caissier"].contains(&actual_role.as_str())
    };
    if active != 1 || actual_role != ctx.role || !allowed {
        return Err("FORBIDDEN: Droits insuffisants ou role incoherent".into());
    }
    let mut hasher = RandomState::new().build_hasher();
    hasher.write_u64(std::process::id() as u64);
    hasher.write_i64(ctx.utilisateur_id);
    let mut other = RandomState::new().build_hasher();
    other.write_u64(hasher.finish());
    let token = format!("{:016x}{:016x}", hasher.finish(), other.finish());
    let mut leases = bridge.leases.lock().map_err(|e| e.to_string())?;
    if leases.contains_key(&token) {
        return Err("Collision de connexion reservee".into());
    }
    leases.insert(
        token.clone(),
        Lease {
            connection,
            action: action.into(),
            expires: Instant::now() + Duration::from_secs(60),
        },
    );
    Ok(token)
}

fn parameters(values: Vec<Json>) -> Result<Vec<Value>, String> {
    values
        .into_iter()
        .map(|v| match v {
            Json::Null => Ok(Value::Null),
            Json::String(s) => Ok(Value::Text(s)),
            Json::Number(n) => {
                if let Some(i) = n.as_i64() {
                    Ok(Value::Integer(i))
                } else {
                    n.as_f64()
                        .filter(|n| n.is_finite())
                        .map(Value::Real)
                        .ok_or_else(|| "Nombre SQLite invalide".into())
                }
            }
            _ => Err("Parametre SQLite non scalaire".into()),
        })
        .collect()
}

fn query(
    bridge: &PrestationBridge,
    token: &str,
    sql: &str,
    values: Vec<Json>,
) -> Result<Vec<Json>, String> {
    if !sql.trim_start().to_lowercase().starts_with("select ") {
        return Err("Seules les requetes SELECT sont autorisees".into());
    }
    let leases = bridge.leases.lock().map_err(|e| e.to_string())?;
    let lease = leases
        .get(token)
        .filter(|l| l.expires > Instant::now())
        .ok_or("Connexion reservee absente ou expiree")?;
    let mut statement = lease.connection.prepare(sql).map_err(|e| e.to_string())?;
    if !statement.readonly() {
        return Err("La lecture ne peut pas modifier la base".into());
    }
    let names: Vec<String> = statement
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    let args = parameters(values)?;
    let mut rows = statement
        .query(rusqlite::params_from_iter(args))
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut object = Map::new();
        for (i, name) in names.iter().enumerate() {
            let value = match row.get_ref(i).map_err(|e| e.to_string())? {
                ValueRef::Null => Json::Null,
                ValueRef::Integer(n) => Json::from(n),
                ValueRef::Real(n) => Json::from(n),
                ValueRef::Text(s) => Json::String(String::from_utf8_lossy(s).into()),
                ValueRef::Blob(bytes) => {
                    Json::Array(bytes.iter().map(|n| Json::from(*n)).collect())
                }
            };
            object.insert(name.clone(), value);
        }
        result.push(Json::Object(object));
    }
    Ok(result)
}

fn execute(
    bridge: &PrestationBridge,
    token: &str,
    sql: &str,
    values: Vec<Json>,
) -> Result<Json, String> {
    let leases = bridge.leases.lock().map_err(|e| e.to_string())?;
    let lease = leases
        .get(token)
        .filter(|l| l.expires > Instant::now())
        .ok_or("Connexion reservee absente ou expiree")?;
    if lease.action == "read" {
        return Err("Connexion en lecture seule".into());
    }
    let normalized = sql
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let allowed: &[&str] = match lease.action.as_str() {
        "create" => &[
            "insert into ventes_prestations ",
            "insert into vente_prestation_details ",
            "insert into reglements_prestations ",
            "insert into journal_caisse ",
            "insert into transaction_operations ",
            "update transaction_operations ",
        ],
        "update" => &[
            "update ventes_prestations ",
            "delete from vente_prestation_details ",
            "insert into vente_prestation_details ",
            "insert into reglements_prestations ",
            "insert into journal_caisse ",
            "insert into transaction_operations ",
            "update transaction_operations ",
        ],
        "cancel" => &[
            "update ventes_prestations ",
            "update reglements_prestations ",
            "insert into reglements_prestations ",
            "insert into journal_caisse ",
            "insert into transaction_operations ",
            "update transaction_operations ",
        ],
        "delete" => &[
            "update ventes_prestations ",
            "insert into transaction_operations ",
            "update transaction_operations ",
        ],
        _ => &[],
    };
    if !allowed.iter().any(|prefix| normalized.starts_with(prefix)) {
        return Err("Instruction interdite pour cette operation de prestation".into());
    }
    let args = parameters(values)?;
    let affected = lease
        .connection
        .execute(sql, rusqlite::params_from_iter(args))
        .map_err(|e| e.to_string())?;
    Ok(
        serde_json::json!({"rowsAffected": affected, "lastInsertId": lease.connection.last_insert_rowid()}),
    )
}

fn finish(bridge: &PrestationBridge, token: &str, commit: bool) -> Result<(), String> {
    let lease = bridge
        .leases
        .lock()
        .map_err(|e| e.to_string())?
        .remove(token)
        .ok_or("Connexion reservee absente")?;
    if commit && lease.expires <= Instant::now() {
        lease
            .connection
            .execute_batch("ROLLBACK")
            .map_err(|e| e.to_string())?;
        return Err("Connexion expiree : transaction annulee".into());
    }
    lease
        .connection
        .execute_batch(if commit { "COMMIT" } else { "ROLLBACK" })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn prestation_begin(
    app: AppHandle,
    state: State<'_, PrestationBridge>,
    ctx: Context,
    action: String,
) -> Result<String, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("gestion-commerciale.db");
    begin_at(&state, &path, &ctx, &action)
}
#[tauri::command]
pub async fn prestation_query(
    state: State<'_, PrestationBridge>,
    token: String,
    sql: String,
    parameters: Vec<Json>,
) -> Result<Vec<Json>, String> {
    query(&state, &token, &sql, parameters)
}
#[tauri::command]
pub async fn prestation_execute(
    state: State<'_, PrestationBridge>,
    token: String,
    sql: String,
    parameters: Vec<Json>,
) -> Result<Json, String> {
    execute(&state, &token, &sql, parameters)
}
#[tauri::command]
pub async fn prestation_finish(
    state: State<'_, PrestationBridge>,
    token: String,
    commit: bool,
) -> Result<(), String> {
    finish(&state, &token, commit)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (std::path::PathBuf, PrestationBridge, Context) {
        let path = std::env::temp_dir().join(format!(
            "gc-prestation-bridge-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE utilisateurs(id INTEGER PRIMARY KEY, role TEXT, est_actif INTEGER); INSERT INTO utilisateurs VALUES(1,'ADMIN',1); \
            CREATE TABLE ventes_prestations(id INTEGER PRIMARY KEY, code TEXT); CREATE TABLE ventes(id INTEGER PRIMARY KEY);").unwrap();
        (
            path,
            PrestationBridge::default(),
            Context {
                utilisateur_id: 1,
                espace_id: None,
                role: "admin".into(),
            },
        )
    }
    #[test]
    fn one_connection_and_rollback() {
        let (path, bridge, ctx) = fixture();
        let token = begin_at(&bridge, &path, &ctx, "create").unwrap();
        execute(
            &bridge,
            &token,
            "INSERT INTO ventes_prestations (code) VALUES (?)",
            vec![Json::from("PRE-1")],
        )
        .unwrap();
        assert_eq!(
            query(
                &bridge,
                &token,
                "SELECT count(*) AS n FROM ventes_prestations",
                vec![]
            )
            .unwrap()[0]["n"],
            1
        );
        finish(&bridge, &token, false).unwrap();
        assert_eq!(
            Connection::open(&path)
                .unwrap()
                .query_row("SELECT count(*) FROM ventes_prestations", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn commit_permissions_and_no_sale_write() {
        let (path, bridge, mut ctx) = fixture();
        ctx.role = "gestionnaire".into();
        assert!(begin_at(&bridge, &path, &ctx, "create").is_err());
        ctx.role = "admin".into();
        let token = begin_at(&bridge, &path, &ctx, "create").unwrap();
        assert!(execute(
            &bridge,
            &token,
            "INSERT INTO ventes (id) VALUES (1)",
            vec![]
        )
        .is_err());
        assert!(query(&bridge, &token, "DELETE FROM ventes_prestations", vec![]).is_err());
        assert!(query(&bridge, &token, "COMMIT", vec![]).is_err());
        execute(
            &bridge,
            &token,
            "INSERT INTO ventes_prestations (code) VALUES (?)",
            vec![Json::from("PRE-2")],
        )
        .unwrap();
        finish(&bridge, &token, true).unwrap();
        let token = begin_at(&bridge, &path, &ctx, "read").unwrap();
        assert!(execute(
            &bridge,
            &token,
            "UPDATE ventes_prestations SET code = 'x'",
            vec![]
        )
        .is_err());
        assert_eq!(
            query(
                &bridge,
                &token,
                "SELECT code FROM ventes_prestations",
                vec![]
            )
            .unwrap()[0]["code"],
            "PRE-2"
        );
        finish(&bridge, &token, true).unwrap();
    }
    #[test]
    fn expired_commit_is_an_error_and_rolls_back() {
        let (path, bridge, ctx) = fixture();
        let token = begin_at(&bridge, &path, &ctx, "create").unwrap();
        execute(
            &bridge,
            &token,
            "INSERT INTO ventes_prestations (code) VALUES (?)",
            vec![Json::from("EXPIRED")],
        )
        .unwrap();
        bridge
            .leases
            .lock()
            .unwrap()
            .get_mut(&token)
            .unwrap()
            .expires = Instant::now();
        assert!(finish(&bridge, &token, true).is_err());
        assert_eq!(
            Connection::open(path)
                .unwrap()
                .query_row("SELECT count(*) FROM ventes_prestations", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
