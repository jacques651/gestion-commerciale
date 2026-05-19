// src/database/repositories/clientRepository.ts
import { getDb } from '../db';

export interface Client {
  idClient: number;
  NomComplet: string;
  Societe: string | null;
  Adresse: string | null;
  Tel: string | null;
  Email: string | null;
  Ville: string | null;
  TypeClient: 'client' | 'revendeur';
}

export type CreateClientInput = Omit<Client, 'idClient'>;

export const clientRepository = {
  getAll: async (): Promise<Client[]> => {
    const db = await getDb();
    // CORRECTION: Utiliser les bons noms de colonnes
    const clients = await db.select<any[]>(`
      SELECT 
        idClient,
        NomComplet,
        Societe,
        Adresse,
        Tel,
        Email,
        Ville,
        TypeClient
      FROM clients
      ORDER BY idClient DESC
    `);
    console.log('📊 Clients récupérés:', clients.length);
    return clients as Client[];
  },

  getById: async (id: number): Promise<Client | null> => {
    const db = await getDb();
    const clients = await db.select<any[]>(`
      SELECT 
        idClient,
        NomComplet,
        Societe,
        Adresse,
        Tel,
        Email,
        Ville,
        TypeClient
      FROM clients 
      WHERE idClient = ?
    `, [id]);
    return clients[0] || null;
  },

  search: async (term: string): Promise<Client[]> => {
    const db = await getDb();
    const clients = await db.select<any[]>(`
      SELECT 
        idClient,
        NomComplet,
        Societe,
        Adresse,
        Tel,
        Email,
        Ville,
        TypeClient
      FROM clients 
      WHERE (NomComplet LIKE ? OR Societe LIKE ? OR Tel LIKE ? OR Email LIKE ? OR Ville LIKE ?)
      LIMIT 50
    `, [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);
    return clients as Client[];
  },

  create: async (client: CreateClientInput): Promise<number> => {
    const db = await getDb();
    
    const result = await db.execute(`
      INSERT INTO clients (
        NomComplet, 
        Societe, 
        Adresse, 
        Tel, 
        Email, 
        Ville, 
        TypeClient
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      client.NomComplet,
      client.Societe || null,
      client.Adresse || null,
      client.Tel || null,
      client.Email || null,
      client.Ville || null,
      client.TypeClient
    ]);
    
    const lastId = result.lastInsertId;
    return Number(lastId);
  },

  update: async (id: number, client: Partial<CreateClientInput>): Promise<void> => {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (client.NomComplet !== undefined) {
      fields.push('NomComplet = ?');
      values.push(client.NomComplet);
    }
    if (client.Societe !== undefined) {
      fields.push('Societe = ?');
      values.push(client.Societe);
    }
    if (client.Adresse !== undefined) {
      fields.push('Adresse = ?');
      values.push(client.Adresse);
    }
    if (client.Tel !== undefined) {
      fields.push('Tel = ?');
      values.push(client.Tel);
    }
    if (client.Email !== undefined) {
      fields.push('Email = ?');
      values.push(client.Email);
    }
    if (client.Ville !== undefined) {
      fields.push('Ville = ?');
      values.push(client.Ville);
    }
    if (client.TypeClient !== undefined) {
      fields.push('TypeClient = ?');
      values.push(client.TypeClient);
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    await db.execute(`UPDATE clients SET ${fields.join(', ')} WHERE idClient = ?`, values);
  },

  delete: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`DELETE FROM clients WHERE idClient = ?`, [id]);
  },

  getByType: async (type: string): Promise<Client[]> => {
    const db = await getDb();
    const clients = await db.select<any[]>(`
      SELECT 
        idClient,
        NomComplet,
        Societe,
        Adresse,
        Tel,
        Email,
        Ville,
        TypeClient
      FROM clients 
      WHERE TypeClient = ?
      ORDER BY NomComplet
    `, [type]);
    return clients as Client[];
  }
};