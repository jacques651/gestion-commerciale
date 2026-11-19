import { getDb } from '../database/db';

type AuditInput = {
  action: string;
  entite: 'STOCK' | 'DECOMPTE' | 'IMPORT' | 'HISTORIQUE';
  idRevendeur?: number | null;
  idReference?: number | null;
  details?: Record<string, unknown>;
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

class RevendeurAuditService {
  private initialized = false;

  private async ensureTable() {
    if (this.initialized) return;
    const db = await getDb();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS audit_revendeurs (
        idAudit INTEGER PRIMARY KEY AUTOINCREMENT,
        date_action DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        entite TEXT NOT NULL,
        idRevendeur INTEGER,
        idReference INTEGER,
        idUtilisateur INTEGER,
        nom_utilisateur TEXT,
        details TEXT
      )
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_revendeurs_date ON audit_revendeurs(date_action DESC)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_revendeurs_revendeur ON audit_revendeurs(idRevendeur)`);
    this.initialized = true;
  }

  async tracer(input: AuditInput) {
    const db = await getDb();
    await this.ensureTable();
    const user = getCurrentUser();
    await db.execute(
      `INSERT INTO audit_revendeurs
       (action, entite, idRevendeur, idReference, idUtilisateur, nom_utilisateur, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.action,
        input.entite,
        input.idRevendeur ?? null,
        input.idReference ?? null,
        user?.id ?? null,
        user?.nom ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ]
    );
  }
}

export const revendeurAuditService = new RevendeurAuditService();