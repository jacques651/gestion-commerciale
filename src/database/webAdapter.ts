// src/database/webAdapter.ts
// Adaptateur "web" qui reproduit l'interface de @tauri-apps/plugin-sql
// (Database.load / db.select / db.execute / db.close) mais route chaque
// operation vers le serveur portable via HTTP.
//
// Objectif : permettre au code existant (qui appelle db.select / db.execute)
// de fonctionner dans un navigateur, sans reecriture, en mode web multi-utilisateur.

export interface ExecuteResult {
  rowsAffected: number;
  lastInsertId: number;
}

// Base de l'API : meme origine que la page (le serveur sert aussi le frontend).
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE || '';

// Jeton optionnel (si le serveur est demarre avec GC_TOKEN).
const API_TOKEN = (import.meta as any)?.env?.VITE_API_TOKEN || '';

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['x-gc-token'] = API_TOKEN;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Serveur local non démarré (npm run server) ou inaccessible.');
  }

  if (!res.ok) {
    let msg = `Erreur serveur (${res.status})`;
    if ([404, 502, 503].includes(res.status)) {
      throw new Error('Serveur local non démarré (npm run server) ou inaccessible.');
    }
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/**
 * Classe compatible avec l'API de @tauri-apps/plugin-sql utilisee dans le code.
 */
export class WebDatabase {
  path: string;
  constructor(pathStr: string) {
    this.path = pathStr;
  }

  static async load(pathStr: string): Promise<WebDatabase> {
    return new WebDatabase(pathStr);
  }

  async select<T = any>(query: string, bindValues: any[] = []): Promise<T> {
    const data = await apiPost<{ rows: any[] }>('select', { sql: query, params: bindValues });
    return data.rows as unknown as T;
  }

  async execute(query: string, bindValues: any[] = []): Promise<ExecuteResult> {
    return apiPost<ExecuteResult>('execute', { sql: query, params: bindValues });
  }

  /**
   * Execute plusieurs instructions dans une seule transaction cote serveur.
   * (Optionnel, utilisable pour optimiser les boucles d'insertion.)
   */
  async batch(statements: { sql: string; params?: any[] }[]): Promise<ExecuteResult[]> {
    const data = await apiPost<{ results: ExecuteResult[] }>('batch', { statements });
    return data.results;
  }

  async close(): Promise<boolean> {
    // Rien a fermer cote client : la connexion vit dans le serveur.
    return true;
  }
}

export default WebDatabase;
