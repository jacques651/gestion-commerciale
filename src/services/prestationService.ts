import { getDb } from '../database/db';
import { journalCaisseService, MoyenPaiement } from './journalCaisseService';

export type StatutPrestation = 'ACTIVE' | 'INACTIVE';
export type StatutPaiementPrestation = 'PAYEE' | 'PARTIELLE' | 'IMPAYEE' | 'ANNULEE';

export interface Prestation {
  idPrestation: number;
  code_prestation: string;
  designation: string;
  categorie?: string | null;
  description?: string | null;
  prix_defaut: number;
  prix_libre: number;
  unite_facturation: string;
  statut: StatutPrestation;
  observations?: string | null;
}

export type PrestationInput = Omit<Prestation, 'idPrestation' | 'code_prestation'> & {
  code_prestation?: string;
};

export interface LignePrestation {
  idPrestation?: number | null;
  designation: string;
  unite_facturation: string;
  quantite: number;
  prix_unitaire: number;
  observations?: string;
}

export interface VentePrestationInput {
  idClient?: number | null;
  client_nom?: string | null;
  client_contact?: string | null;
  montant_paye: number;
  moyenPaiement?: MoyenPaiement | null;
  observations?: string;
  lignes: LignePrestation[];
}

const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

class PrestationService {
  private async validUserId(db: any, user: any): Promise<number | null> {
    const id = Number(user?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const existing = await db.select(`SELECT 1 FROM utilisateurs WHERE id = ? LIMIT 1`, [id]);
      if (existing.length) return id;
      await db.execute(
        `INSERT INTO utilisateurs (id, nom, login, mot_de_passe_hash, email, role) VALUES (?, ?, ?, '-', ?, ?)`,
        [id, String(user?.nom || user?.login || 'Opérateur'), String(user?.login || user?.email || `user_${id}`), user?.email || null, String(user?.role || 'COMMERCIAL')]
      );
      return id;
    } catch {
      return null;
    }
  }

  async nextCode(): Promise<string> {
    const db = await getDb();
    const rows = await db.select<any[]>('SELECT COUNT(*) AS total FROM prestations');
    return `PRS-${String(Number(rows[0]?.total || 0) + 1).padStart(5, '0')}`;
  }

  async list(activeOnly = false): Promise<Prestation[]> {
    const db = await getDb();
    return db.select<Prestation[]>(`
      SELECT * FROM prestations ${activeOnly ? "WHERE statut = 'ACTIVE'" : ''}
      ORDER BY statut ASC, designation COLLATE NOCASE ASC
    `);
  }

  async save(input: PrestationInput, id?: number): Promise<number> {
    const db = await getDb();
    const payload = {
      ...input,
      designation: input.designation.trim(),
      unite_facturation: input.unite_facturation?.trim() || 'prestation',
      prix_defaut: Number(input.prix_defaut) || 0,
      prix_libre: input.prix_libre ? 1 : 0,
      statut: input.statut || 'ACTIVE',
    };
    if (!payload.designation) throw new Error('La désignation de la prestation est requise.');
    if (!payload.prix_libre && payload.prix_defaut < 0) throw new Error('Le prix fixe ne peut pas être négatif.');

    if (id) {
      await db.execute(`
        UPDATE prestations SET code_prestation = ?, designation = ?, categorie = ?, description = ?,
          prix_defaut = ?, prix_libre = ?, unite_facturation = ?, statut = ?, observations = ?,
          updated_at = datetime('now')
        WHERE idPrestation = ?
      `, [payload.code_prestation || `PRS-${String(id).padStart(5, '0')}`, payload.designation,
        payload.categorie || null, payload.description || null, payload.prix_defaut, payload.prix_libre,
        payload.unite_facturation, payload.statut, payload.observations || null, id]);
      return id;
    }

    const code = payload.code_prestation?.trim() || await this.nextCode();
    const result = await db.execute(`
      INSERT INTO prestations (code_prestation, designation, categorie, description, prix_defaut, prix_libre, unite_facturation, statut, observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, payload.designation, payload.categorie || null, payload.description || null,
      payload.prix_defaut, payload.prix_libre, payload.unite_facturation, payload.statut, payload.observations || null]);
    return Number(result.lastInsertId);
  }

  async toggle(id: number, statut: StatutPrestation): Promise<void> {
    const db = await getDb();
    await db.execute(`UPDATE prestations SET statut = ?, updated_at = datetime('now') WHERE idPrestation = ?`, [statut, id]);
  }

  private async nextInvoiceCode(db: any): Promise<string> {
    const prefix = `PRE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
    const rows = await db.select(`SELECT COUNT(*) AS total FROM ventes_prestations WHERE code_facture LIKE ?`, [`${prefix}%`]);
    return `${prefix}${String(Number(rows[0]?.total || 0) + 1).padStart(4, '0')}`;
  }

  async createSale(input: VentePrestationInput): Promise<{ idVentePrestation: number; codeFacture: string; statut: StatutPaiementPrestation }> {
    const lignes = input.lignes.filter(l => l.designation.trim() && Number(l.quantite) > 0 && Number(l.prix_unitaire) >= 0);
    if (!lignes.length) throw new Error('Ajoutez au moins une prestation facturée.');
    const total = lignes.reduce((sum, l) => sum + Number(l.quantite) * Number(l.prix_unitaire), 0);
    const paye = Math.max(0, Math.min(Number(input.montant_paye) || 0, total));
    const statut: StatutPaiementPrestation = paye >= total ? 'PAYEE' : paye > 0 ? 'PARTIELLE' : 'IMPAYEE';
    const db = await getDb();
    const codeFacture = await this.nextInvoiceCode(db);
    const user = currentUser();
    const utilisateurId = await this.validUserId(db, user);
    const sessionId = await journalCaisseService.getSessionActiveId(db);

    await db.execute('BEGIN TRANSACTION');
    try {
      const result = await db.execute(`
        INSERT INTO ventes_prestations (code_facture, idClient, client_nom, client_contact, montant_total, montant_paye,
          mode_paiement, mode_paiement_detail, statut_paiement, idUtilisateur, idSession, observations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [codeFacture, input.idClient || null, input.client_nom || null, input.client_contact || null,
        total, paye, input.moyenPaiement?.categorie || null, input.moyenPaiement?.libelle || null,
        statut, utilisateurId, sessionId, input.observations || null]);
      const idVentePrestation = Number(result.lastInsertId);
      for (const ligne of lignes) {
        await db.execute(`
          INSERT INTO vente_prestation_details (idVentePrestation, idPrestation, designation, unite_facturation, quantite, prix_unitaire, total, observations)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [idVentePrestation, ligne.idPrestation || null, ligne.designation.trim(), ligne.unite_facturation || 'prestation',
          Number(ligne.quantite), Number(ligne.prix_unitaire), Number(ligne.quantite) * Number(ligne.prix_unitaire), ligne.observations || null]);
      }
      // Deliberately no stock service call: a prestation has no inventory impact.
      if (paye > 0) {
        await journalCaisseService.ajouterPrestation({
          montant: paye,
          idVentePrestation,
          codeFacture,
          clientNom: input.client_nom || undefined,
          modePaiement: input.moyenPaiement?.categorie,
          modePaiementDetail: input.moyenPaiement?.libelle,
        });
      }
      await db.execute('COMMIT');
      return { idVentePrestation, codeFacture, statut };
    } catch (error) {
      try { await db.execute('ROLLBACK'); } catch { /* already ended */ }
      throw error;
    }
  }

  async listSales(): Promise<any[]> {
    const db = await getDb();
    const ventes = await db.select<any[]>(`
      SELECT vp.*, c.NomComplet FROM ventes_prestations vp
      LEFT JOIN clients c ON c.idClient = vp.idClient
      WHERE COALESCE(vp.est_annule, 0) = 0
      ORDER BY vp.date_vente DESC, vp.idVentePrestation DESC
    `);
    for (const vente of ventes) {
      vente.details = await db.select<any[]>(`SELECT * FROM vente_prestation_details WHERE idVentePrestation = ? ORDER BY idDetailPrestation`, [vente.idVentePrestation]);
    }
    return ventes;
  }
}

export const prestationService = new PrestationService();
