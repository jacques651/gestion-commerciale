// src/database/repositories/attestationRepository.ts
// Persistance des attestations d'achat-vente (matériel d'occasion).
import { getDb } from '../db';

export interface Attestation {
  idAttestation: number;
  code_attestation: string;
  date_attestation: string;
  idVente?: number | null;
  cedant_nom?: string;
  cedant_domicile?: string;
  cedant_tel?: string;
  cedant_doc?: string;
  cedant_ref?: string;
  cess_nom?: string;
  cess_domicile?: string;
  cess_tel?: string;
  cess_doc?: string;
  cess_ref?: string;
  materiel?: string;
  en_echange?: string;
  montant?: number;
  sens?: 'ACHAT' | 'VENTE';
  fait_a?: string;
  date_acte?: string;
  nb_exemplaires?: string;
  created_by?: string;
  est_annule?: number;
  date_annulation?: string | null;
  annule_par?: string | null;
  motif_annulation?: string | null;
}

export type CreateAttestationInput = Omit<Attestation, 'idAttestation' | 'code_attestation' | 'date_attestation' | 'est_annule'>;

const COLS = `
  idAttestation, code_attestation, date_attestation, idVente,
  cedant_nom, cedant_domicile, cedant_tel, cedant_doc, cedant_ref,
  cess_nom, cess_domicile, cess_tel, cess_doc, cess_ref,
  materiel, en_echange, montant, sens, fait_a, date_acte, nb_exemplaires,
  created_by,
  COALESCE(est_annule, 0) as est_annule, date_annulation, annule_par, motif_annulation
`;

async function generateCode(): Promise<string> {
  const db = await getDb();
  const now = new Date();
  const prefix = `ATT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
  const r = await db.select<any[]>(`SELECT COUNT(*) as n FROM attestations WHERE code_attestation LIKE ?`, [prefix + '%']);
  return `${prefix}${String((r[0]?.n || 0) + 1).padStart(3, '0')}`;
}

export const attestationRepository = {
  getAll: async (): Promise<Attestation[]> => {
    const db = await getDb();
    return await db.select<Attestation[]>(
      `SELECT ${COLS} FROM attestations ORDER BY date_attestation DESC, idAttestation DESC`
    );
  },

  getById: async (id: number): Promise<Attestation | null> => {
    const db = await getDb();
    const rows = await db.select<Attestation[]>(`SELECT ${COLS} FROM attestations WHERE idAttestation = ?`, [id]);
    return rows[0] || null;
  },

  create: async (a: CreateAttestationInput): Promise<{ id: number; code: string }> => {
    const db = await getDb();
    const code = await generateCode();
    const result = await db.execute(
      `INSERT INTO attestations (
         code_attestation, idVente,
         cedant_nom, cedant_domicile, cedant_tel, cedant_doc, cedant_ref,
         cess_nom, cess_domicile, cess_tel, cess_doc, cess_ref,
         materiel, en_echange, montant, sens, fait_a, date_acte, nb_exemplaires, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, a.idVente ?? null,
        a.cedant_nom || null, a.cedant_domicile || null, a.cedant_tel || null, a.cedant_doc || null, a.cedant_ref || null,
        a.cess_nom || null, a.cess_domicile || null, a.cess_tel || null, a.cess_doc || null, a.cess_ref || null,
        a.materiel || null, a.en_echange || null, a.montant || 0, a.sens || 'ACHAT', a.fait_a || null, a.date_acte || null, a.nb_exemplaires || null,
        a.created_by || null,
      ]
    );
    return { id: Number(result.lastInsertId), code };
  },

  // Annuler une attestation (au lieu de la supprimer) : conservée et tracée
  annuler: async (id: number, par?: string, motif?: string): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE attestations SET est_annule = 1, date_annulation = datetime('now'), annule_par = ?, motif_annulation = ? WHERE idAttestation = ?`,
      [par || null, motif || null, id]
    );
  },

  restaurer: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE attestations SET est_annule = 0, date_annulation = NULL, annule_par = NULL, motif_annulation = NULL WHERE idAttestation = ?`,
      [id]
    );
  },
};
