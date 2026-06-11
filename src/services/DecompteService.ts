// services/DecompteService.ts

import { executeTransaction }
from "./TransactionService";

import StockRevendeurService
from "./StockRevendeurService";
import { CreateDecompteDto } from "../types/Decompte";

export default class DecompteService {

  static async createDecompte(
    dto: CreateDecompteDto
  ) {

    await executeTransaction(
      async (db) => {

        await db.execute(
          `
          INSERT INTO decomptes
          (
            idClient
          )
          VALUES (?)
          `,
          [
            dto.idRevendeur
          ]
        );

        const result = await (db.select as (query: string) => Promise<any[]>)(
            `
            SELECT last_insert_rowid()
            AS id
            `
          );

        const idDecompte =
          result[0].id;

        for (
          const item
          of dto.details
        ) {

          await db.execute(
            `
            INSERT INTO
            decompte_details
            (
              idDecompte,
              idProduit,
              qte_decompte,
              prix_unitaire_vente
            )
            VALUES
            (
              ?,?,?,?
            )
            `,
            [
              idDecompte,
              item.idProduit,
              item.quantite,
              item.prixVente
            ]
          );

          await StockRevendeurService
            .decreaseStock(
              dto.idRevendeur,
              item.idProduit,
              item.quantite
            );
        }

        return idDecompte;
      }
    );
  }
}