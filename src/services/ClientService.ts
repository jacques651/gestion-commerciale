// src/services/ClientService.ts

import { getDb } from "../database/db";

export interface ClientDto {
  idClient?: number;

  NomComplet: string;

  Societe?: string;

  Adresse?: string;

  Tel?: string;

  Email?: string;

  Ville?: string;

  TypeClient: "client" | "revendeur";
}

export default class ClientService {

  /**
   * Créer un client
   */
  static async createClient(
    client: ClientDto
  ): Promise<number> {

    const db = await getDb();

    await db.execute(
      `
      INSERT INTO clients
      (
        NomComplet,
        Societe,
        Adresse,
        Tel,
        Email,
        Ville,
        TypeClient
      )
      VALUES
      (
        ?,?,?,?,?,?,?
      )
      `,
      [
        client.NomComplet,
        client.Societe ?? null,
        client.Adresse ?? null,
        client.Tel ?? null,
        client.Email ?? null,
        client.Ville ?? null,
        client.TypeClient
      ]
    );

    const result = await db.select(
      `
      SELECT last_insert_rowid() AS id
      `
    ) as { id:number }[];

    return result[0].id;
  }

  /**
   * Modifier un client
   */
  static async updateClient(
    idClient: number,
    client: ClientDto
  ): Promise<void> {

    const db = await getDb();

    await db.execute(
      `
      UPDATE clients
      SET
        NomComplet = ?,
        Societe = ?,
        Adresse = ?,
        Tel = ?,
        Email = ?,
        Ville = ?,
        TypeClient = ?
      WHERE idClient = ?
      `,
      [
        client.NomComplet,
        client.Societe ?? null,
        client.Adresse ?? null,
        client.Tel ?? null,
        client.Email ?? null,
        client.Ville ?? null,
        client.TypeClient,
        idClient
      ]
    );
  }

  /**
   * Supprimer un client
   */
  static async deleteClient(
    idClient: number
  ): Promise<void> {

    const db = await getDb();

    await db.execute(
      `
      DELETE FROM clients
      WHERE idClient = ?
      `,
      [idClient]
    );
  }

  /**
   * Obtenir un client
   */
 static async getClientById(
  idClient: number
): Promise<ClientDto | null> {

  const db = await getDb();

  const result = await db.select(
    `
    SELECT *
    FROM clients
    WHERE idClient = ?
    `,
    [idClient]
  ) as ClientDto[];

  return result.length > 0
    ? result[0]
    : null;
}

  /**
   * Tous les clients
   */
  static async getAllClients() {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM clients
      ORDER BY NomComplet
      `
    );
  }

  /**
   * Clients standards
   */
  static async getClientsStandards() {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM clients
      WHERE TypeClient = 'client'
      ORDER BY NomComplet
      `
    );
  }

  /**
   * Revendeurs
   */
  static async getRevendeurs() {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM clients
      WHERE TypeClient = 'revendeur'
      ORDER BY NomComplet
      `
    );
  }

  /**
   * Recherche
   */
  static async rechercher(
    texte: string
  ) {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM clients
      WHERE
        NomComplet LIKE ?
        OR Societe LIKE ?
        OR Tel LIKE ?
      ORDER BY NomComplet
      `,
      [
        `%${texte}%`,
        `%${texte}%`,
        `%${texte}%`
      ]
    );
  }
}