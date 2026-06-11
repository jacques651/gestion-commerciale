// src/database/repositories/factureRepository.ts

import { getDb } from "../db";

export interface Facture {
  NomComplet: string;
  client_nom: string;
  idFacture: number;
  code_facture: string;
  idClient: number;
  idCommande: number;
  date_facture: string;
  montant_ttc: number;
  montant_regle: number;
  statut: string;
}

export const factureRepository = {

  async getAll(): Promise<any[]> {

    const db = await getDb();

    return await db.select<any[]>(`

      SELECT

        f.*,

        c.NomComplet,
        c.Societe,

        cmd.code_commande

      FROM factures f

      LEFT JOIN clients c
        ON c.idClient = f.idClient

      LEFT JOIN commandes cmd
        ON cmd.idCommande = f.idCommande

      ORDER BY f.idFacture DESC

    `);
  },

  async getById(
    idFacture: number
  ) {

    const db = await getDb();

    const facture =
      await db.select<any[]>(`

        SELECT

          f.*,

          c.NomComplet,
          c.Societe,
          c.Tel,
          c.Adresse,

          cmd.code_commande,
          cmd.type_commande

        FROM factures f

        INNER JOIN clients c
          ON c.idClient = f.idClient

        INNER JOIN commandes cmd
          ON cmd.idCommande = f.idCommande

        WHERE f.idFacture = ?

      `, [idFacture]);

    if (facture.length === 0) {
      return null;
    }

    const details =
      await db.select<any[]>(`

        SELECT

          cd.idDetail,
          cd.idProduit,
          cd.qte_commande,
          cd.prix_unitaire_vente,

          p.code_produit,
          p.designation,
          p.categorie,
          p.unite_base,

          p.prix_achat_base,
          p.prix_vente_gros,
          p.commission_pourcentage

        FROM commande_details cd

        INNER JOIN products p
          ON p.idProduit = cd.idProduit

        WHERE cd.idCommande = ?

      `, [
        facture[0].idCommande
      ]);

    return {
      ...facture[0],
      details
    };
  },

  async createFromCommande(
    idCommande: number
  ): Promise<number> {

    const db = await getDb();

    const commande =
      await db.select<any[]>(`

        SELECT *

        FROM commandes

        WHERE idCommande = ?

      `, [idCommande]);

    if (commande.length === 0) {

      throw new Error(
        "Commande introuvable"
      );
    }

    const cmd =
      commande[0];

    const existe =
      await db.select<any[]>(`

        SELECT idFacture

        FROM factures

        WHERE idCommande = ?

      `, [idCommande]);

    if (existe.length > 0) {

      return Number(
        existe[0].idFacture
      );
    }

    const codeFacture =
      `FAC-${Date.now()}`;

    const result =
      await db.execute(`

        INSERT INTO factures
        (
          code_facture,
          idClient,
          idCommande,
          montant_ttc,
          montant_regle,
          statut
        )
        VALUES
        (
          ?,?,?,?,?,?
        )

      `, [

        codeFacture,
        cmd.idClient,
        idCommande,
        cmd.montant_ttc,
        0,
        "EN_ATTENTE"

      ]);

    await db.execute(`

      UPDATE commandes

      SET code_facture = ?

      WHERE idCommande = ?

    `, [

      codeFacture,
      idCommande

    ]);

    return Number(
      result.lastInsertId
    );
  },

  async updateStatus(
    idFacture: number,
    statut: string
  ) {

    const db = await getDb();

    await db.execute(`

      UPDATE factures

      SET statut = ?

      WHERE idFacture = ?

    `, [
      statut,
      idFacture
    ]);
  },

  async getUnpaidInvoices() {

    const db = await getDb();

    return await db.select<any[]>(`

      SELECT *

      FROM factures

      WHERE statut <> 'REGLEE'

      ORDER BY idFacture DESC

    `);
  },

  async delete(
    idFacture: number
  ) {

    const db = await getDb();

    await db.execute(`

      DELETE FROM factures

      WHERE idFacture = ?

    `, [idFacture]);
  }

};