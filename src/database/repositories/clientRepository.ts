// src/database/repositories/clientRepository.ts
import { getDb } from '../db';

export interface Client {
  idClient: number;
  NomComplet: string;
  Societe: string | null;
  Adresse: string | null;
  adresse_postale: string | null;
  Tel: string | null;
  Email: string | null;
  Ville: string | null;
  TypeClient: 'client' | 'revendeur';
  ifu: string | null;
  rccm: string | null;
  // Champs d'annulation (remplace la suppression)
  est_annule?: number;
  date_annulation?: string | null;
  annule_par?: string | null;
  motif_annulation?: string | null;
}

export type CreateClientInput = Omit<Client, 'idClient'>;

const SELECT_COLS = `
  idClient, NomComplet, Societe, Adresse,
  COALESCE(adresse_postale, '') as adresse_postale,
  Tel, Email, Ville, TypeClient,
  COALESCE(ifu, '') as ifu,
  COALESCE(rccm, '') as rccm,
  COALESCE(est_annule, 0) as est_annule, date_annulation, annule_par, motif_annulation
`;

export const clientRepository = {
  getAll: async (): Promise<Client[]> => {
    const db = await getDb();
    const clients = await db.select<any[]>(`SELECT ${SELECT_COLS} FROM clients ORDER BY idClient DESC`);
    return clients as Client[];
  },

  getById: async (id: number): Promise<Client | null> => {
    const db = await getDb();
    const clients = await db.select<any[]>(
      `SELECT ${SELECT_COLS} FROM clients WHERE idClient = ?`, [id]
    );
    return clients[0] || null;
  },

  search: async (term: string): Promise<Client[]> => {
    const db = await getDb();
    const clients = await db.select<any[]>(
      `SELECT ${SELECT_COLS} FROM clients
       WHERE (NomComplet LIKE ? OR Societe LIKE ? OR Tel LIKE ? OR Email LIKE ? OR Ville LIKE ? OR ifu LIKE ? OR rccm LIKE ?)
       LIMIT 50`,
      [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
    );
    return clients as Client[];
  },

  create: async (client: CreateClientInput): Promise<number> => {
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO clients (NomComplet, Societe, Adresse, adresse_postale, Tel, Email, Ville, TypeClient, ifu, rccm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client.NomComplet,
        client.Societe || null,
        client.Adresse || null,
        client.adresse_postale || null,
        client.Tel || null,
        client.Email || null,
        client.Ville || null,
        client.TypeClient,
        client.ifu || null,
        client.rccm || null,
      ]
    );
    return Number(result.lastInsertId);
  },

  update: async (id: number, client: Partial<CreateClientInput>): Promise<void> => {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];

    const map: [keyof CreateClientInput, string][] = [
      ['NomComplet',      'NomComplet = ?'],
      ['Societe',         'Societe = ?'],
      ['Adresse',         'Adresse = ?'],
      ['adresse_postale', 'adresse_postale = ?'],
      ['Tel',             'Tel = ?'],
      ['Email',           'Email = ?'],
      ['Ville',           'Ville = ?'],
      ['TypeClient',      'TypeClient = ?'],
      ['ifu',             'ifu = ?'],
      ['rccm',            'rccm = ?'],
    ];

    for (const [key, sql] of map) {
      if (client[key] !== undefined) {
        fields.push(sql);
        values.push(client[key]);
      }
    }

    if (fields.length === 0) return;
    values.push(id);
    await db.execute(`UPDATE clients SET ${fields.join(', ')} WHERE idClient = ?`, values);
  },

  delete: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`DELETE FROM clients WHERE idClient = ?`, [id]);
  },

  // Annuler un client (au lieu de le supprimer) : conservé et tracé, exclu des sélections
  annuler: async (id: number, par?: string, motif?: string): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE clients SET est_annule = 1, date_annulation = datetime('now'), annule_par = ?, motif_annulation = ? WHERE idClient = ?`,
      [par || null, motif || null, id]
    );
  },

  restaurer: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE clients SET est_annule = 0, date_annulation = NULL, annule_par = NULL, motif_annulation = NULL WHERE idClient = ?`,
      [id]
    );
  },

  getByType: async (type: string): Promise<Client[]> => {
    const db = await getDb();
    const clients = await db.select<any[]>(
      `SELECT ${SELECT_COLS} FROM clients WHERE TypeClient = ? AND COALESCE(est_annule, 0) = 0 ORDER BY NomComplet`, [type]
    );
    return clients as Client[];
  },
};
