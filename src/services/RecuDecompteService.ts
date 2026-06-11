// src/services/RecuDecompteService.ts

import { getDb } from "../database/db";

export default class RecuDecompteService {

  static async getRecuDecompte(
    idDecompte: number
  ) {

    const db = await getDb();

    const header = await db.select(
      `
      SELECT

          d.idDecompte,
          d.code_decompte,
          d.date_decompte,

          c.idClient,
          c.NomComplet,

          d.montant_achat,
          d.montant_vente,
          d.montant_benefice,
          d.montant_commission,
          d.montant_net

      FROM decomptes d

      INNER JOIN clients c
      ON c.idClient = d.idClient

      WHERE d.idDecompte = ?
      `,
      [idDecompte]
    );

    const details = await db.select(
      `
      SELECT

          dd.idProduit,

          p.designation,

          dd.qte_decompte,

          dd.prix_achat,

          dd.prix_vente,

          dd.commission_pourcentage

      FROM decompte_details dd

      INNER JOIN products p
      ON p.idProduit = dd.idProduit

      WHERE dd.idDecompte = ?
      `,
      [idDecompte]
    );

    return {
      header: header[0],
      details
    };
  }
}