use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use rusqlite::{params, Connection};

pub type DbState = Mutex<Connection>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub idProduit: i64,
    pub code_produit: String,
    pub designation: String,
    pub qte_stock: f64,
}

#[tauri::command]
pub fn get_all_products(state: State<DbState>) -> Result<Vec<Product>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT idProduit, code_produit, designation, qte_stock FROM products WHERE est_supprime = 0")?;
    let products = stmt.query_map([], |row| {
        Ok(Product {
            idProduit: row.get(0)?,
            code_produit: row.get(1)?,
            designation: row.get(2)?,
            qte_stock: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    products.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_product_by_id(idProduit: i64, state: State<DbState>) -> Result<Option<Product>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT idProduit, code_produit, designation, qte_stock FROM products WHERE idProduit = ?1")?;
    let mut rows = stmt.query(params![idProduit])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Product {
            idProduit: row.get(0)?,
            code_produit: row.get(1)?,
            designation: row.get(2)?,
            qte_stock: row.get(3)?,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn update_product_stock(idProduit: i64, quantite_delta: f64, state: State<DbState>) -> Result<Product, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE products SET qte_stock = qte_stock + ?1 WHERE idProduit = ?2", params![quantite_delta, idProduit])?;
    get_product_by_id(idProduit, state).map(|opt| opt.unwrap())
}
