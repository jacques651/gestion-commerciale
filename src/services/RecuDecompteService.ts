// src/services/RecuDecompteService.ts

import { getDb } from "../database/db";

export default class RecuDecompteService {

  static async getRecuDecompte(
    idDecompte: number
  ) {

    const db = await getDb();


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
      header: [0],
      details
    };
  }
}