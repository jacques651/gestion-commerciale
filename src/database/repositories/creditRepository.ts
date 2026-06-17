// src/database/repositories/creditRepository.ts

import { getDb } from '../db';

export interface Credit {
  idCredit: number;
  code_credit: string;
  date_credit: string;
  designation: string;
  montant_total: number;
  montant_restant: number;
  beneficiaire: string;
  type_credit: 'CLIENT' | 'FOURNISSEUR' | 'AUTRE';
  reference: string;
  notes: string;
  statut: 'EN_COURS' | 'TERMINE' | 'ANNULE';
  idJournal: number;
  created_at: string;
  updated_at: string;
}

export interface Remboursement {
  idRemboursement: number;
  code_remboursement: string;
  date_remboursement: string;
  idCredit: number;
  montant: number;
  mode_paiement: 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'MOBILE_MONEY' | 'AUTRE';
  reference_paiement: string;
  notes: string;
  idJournal: number;
  created_at: string;
}

export interface CreditAvecRemboursements extends Credit {
  remboursements: Remboursement[];
  total_rembourse: number;
  reste_a_rembourser: number;
}

export interface StatistiquesCredits {
  totalCredits: number;
  totalMontant: number;
  totalRembourse: number;
  totalRestant: number;
  enCours: number;
  termines: number;
  annules: number;
}

class CreditRepository {
  async getAll(): Promise<Credit[]> {
    const db = await getDb();
    return db.select<Credit[]>(`
      SELECT * FROM credits 
      ORDER BY date_credit DESC
    `);
  }

  async getById(id: number): Promise<Credit | null> {
    const db = await getDb();
    const result = await db.select<Credit[]>(`
      SELECT * FROM credits WHERE idCredit = ?
    `, [id]);
    return result[0] || null;
  }

  async getByBeneficiaire(beneficiaire: string): Promise<Credit[]> {
    const db = await getDb();
    return db.select<Credit[]>(`
      SELECT * FROM credits 
      WHERE beneficiaire LIKE ?
      ORDER BY date_credit DESC
    `, [`%${beneficiaire}%`]);
  }

  async getByStatut(statut: string): Promise<Credit[]> {
    const db = await getDb();
    return db.select<Credit[]>(`
      SELECT * FROM credits 
      WHERE statut = ?
      ORDER BY date_credit DESC
    `, [statut]);
  }

  async getByType(type: string): Promise<Credit[]> {
    const db = await getDb();
    return db.select<Credit[]>(`
      SELECT * FROM credits 
      WHERE type_credit = ?
      ORDER BY date_credit DESC
    `, [type]);
  }

  async getCreditAvecRemboursements(idCredit: number): Promise<CreditAvecRemboursements | null> {
    const db = await getDb();
    
    const credit = await this.getById(idCredit);
    if (!credit) return null;

    const remboursements = await db.select<Remboursement[]>(`
      SELECT * FROM remboursements 
      WHERE idCredit = ?
      ORDER BY date_remboursement DESC
    `, [idCredit]);

    const total_rembourse = remboursements.reduce((sum, r) => sum + r.montant, 0);

    return {
      ...credit,
      remboursements,
      total_rembourse,
      reste_a_rembourser: credit.montant_total - total_rembourse
    };
  }

  async getRemboursementsByCredit(idCredit: number): Promise<Remboursement[]> {
    const db = await getDb();
    return db.select<Remboursement[]>(`
      SELECT * FROM remboursements 
      WHERE idCredit = ?
      ORDER BY date_remboursement DESC
    `, [idCredit]);
  }

  async createCredit(data: {
    date_credit: string;
    designation: string;
    montant_total: number;
    beneficiaire: string;
    type_credit: 'CLIENT' | 'FOURNISSEUR' | 'AUTRE';
    reference?: string;
    notes?: string;
    statut?: 'EN_COURS' | 'TERMINE' | 'ANNULE';
    idJournal?: number | null;
  }): Promise<number> {
    const db = await getDb();
    const now = new Date().toISOString();
    
    // Générer le code crédit
    const count = await db.select<{ count: number }[]>(`
      SELECT COUNT(*) as count FROM credits
    `);
    const codeCredit = `CRD-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;

    const result = await db.execute(`
      INSERT INTO credits (
        code_credit, date_credit, designation, montant_total, montant_restant,
        beneficiaire, type_credit, reference, notes, statut, idJournal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeCredit,
      data.date_credit || new Date().toISOString(),
      data.designation,
      data.montant_total,
      data.montant_total, // au départ, montant_restant = montant_total
      data.beneficiaire,
      data.type_credit || 'AUTRE',
      data.reference || null,
      data.notes || null,
      data.statut || 'EN_COURS',
      data.idJournal || null,
      now,
      now
    ]);

    return Number(result.lastInsertId);
  }

  async addRemboursement(data: {
    date_remboursement: string;
    idCredit: number;
    montant: number;
    mode_paiement: 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'MOBILE_MONEY' | 'AUTRE';
    reference_paiement?: string;
    notes?: string;
    idJournal?: number | null;
  }): Promise<number> {
    const db = await getDb();
    const now = new Date().toISOString();

    // Générer le code remboursement
    const count = await db.select<{ count: number }[]>(`
      SELECT COUNT(*) as count FROM remboursements
    `);
    const codeRemboursement = `REM-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;

    const result = await db.execute(`
      INSERT INTO remboursements (
        code_remboursement, date_remboursement, idCredit, montant,
        mode_paiement, reference_paiement, notes, idJournal, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeRemboursement,
      data.date_remboursement || new Date().toISOString(),
      data.idCredit,
      data.montant,
      data.mode_paiement || 'ESPECES',
      data.reference_paiement || null,
      data.notes || null,
      data.idJournal || null,
      now
    ]);

    // Mettre à jour le montant restant du crédit
    await this.updateMontantRestant(data.idCredit);

    return Number(result.lastInsertId);
  }

  async updateMontantRestant(idCredit: number): Promise<void> {
    const db = await getDb();
    
    // Calculer le total des remboursements
    const total = await db.select<{ total: number }[]>(`
      SELECT COALESCE(SUM(montant), 0) as total 
      FROM remboursements 
      WHERE idCredit = ?
    `, [idCredit]);

    const totalRembourse = total[0]?.total || 0;

    // Récupérer le montant total
    const credit = await this.getById(idCredit);
    if (!credit) return;

    const montantRestant = credit.montant_total - totalRembourse;
    const statut = montantRestant <= 0 ? 'TERMINE' : 'EN_COURS';

    await db.execute(`
      UPDATE credits 
      SET montant_restant = ?, statut = ?, updated_at = ?
      WHERE idCredit = ?
    `, [montantRestant, statut, new Date().toISOString(), idCredit]);
  }

  async getStatistiques(): Promise<StatistiquesCredits> {
    const db = await getDb();

    const stats = await db.select<{
      total_credits: number;
      total_montant: number;
      total_restant: number;
      en_cours: number;
      termines: number;
      annules: number;
    }[]>(`
      SELECT 
        COUNT(*) as total_credits,
        COALESCE(SUM(montant_total), 0) as total_montant,
        COALESCE(SUM(montant_restant), 0) as total_restant,
        COUNT(CASE WHEN statut = 'EN_COURS' THEN 1 END) as en_cours,
        COUNT(CASE WHEN statut = 'TERMINE' THEN 1 END) as termines,
        COUNT(CASE WHEN statut = 'ANNULE' THEN 1 END) as annules
      FROM credits
    `);

    const totalMontant = stats[0]?.total_montant || 0;
    const totalRestant = stats[0]?.total_restant || 0;

    return {
      totalCredits: stats[0]?.total_credits || 0,
      totalMontant: totalMontant,
      totalRembourse: totalMontant - totalRestant,
      totalRestant: totalRestant,
      enCours: stats[0]?.en_cours || 0,
      termines: stats[0]?.termines || 0,
      annules: stats[0]?.annules || 0,
    };
  }

  async search(term: string): Promise<Credit[]> {
    const db = await getDb();
    return db.select<Credit[]>(`
      SELECT * FROM credits 
      WHERE beneficiaire LIKE ? 
      OR designation LIKE ? 
      OR code_credit LIKE ?
      OR reference LIKE ?
      ORDER BY date_credit DESC
    `, [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);
  }

  async deleteCredit(idCredit: number): Promise<void> {
    const db = await getDb();
    await db.execute(`
      DELETE FROM credits WHERE idCredit = ?
    `, [idCredit]);
  }

  async annulerCredit(idCredit: number): Promise<void> {
    const db = await getDb();
    await db.execute(`
      UPDATE credits 
      SET statut = 'ANNULE', updated_at = ?
      WHERE idCredit = ?
    `, [new Date().toISOString(), idCredit]);
  }

  async getMontantTotalRembourseParCredit(idCredit: number): Promise<number> {
    const db = await getDb();
    const result = await db.select<{ total: number }[]>(`
      SELECT COALESCE(SUM(montant), 0) as total 
      FROM remboursements 
      WHERE idCredit = ?
    `, [idCredit]);
    return result[0]?.total || 0;
  }
}

export const creditRepository = new CreditRepository();