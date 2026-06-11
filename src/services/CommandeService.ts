import { executeTransaction } from "./TransactionService";
import StockService from "./StockService";
import StockRevendeurService from "./StockRevendeurService";

import {
  CreateCommandeDto
} from "../types/Commande";

export default class CommandeService {

  static async createCommande(
    dto: CreateCommandeDto
  ): Promise<number> {

    return await executeTransaction(
      async (db: any) => {

        const codeCommande =
          `CMD-${Date.now()}`;

        let montantHT = 0;

        await db.execute(
          `
          INSERT INTO commandes
          (
            code_commande,
            idClient,
            type_commande,
            montant_ht,
            montant_ttc
          )
          VALUES (?, ?, ?, 0, 0)
          `,
          [
            codeCommande,
            dto.idClient,
            dto.typeCommande
          ]
        );

        const result =
          await db.select(
            `
            SELECT last_insert_rowid() AS id
            `
          ) as { id:number }[];

        const idCommande =
          result[0].id;

        for (const item of dto.details) {

          const totalLigne =
            item.quantite *
            item.prixUnitaire;

          montantHT += totalLigne;

          await db.execute(
            `
            INSERT INTO commande_details
            (
              idCommande,
              idProduit,
              qte_commande,
              prix_unitaire_vente
            )
            VALUES (?, ?, ?, ?)
            `,
            [
              idCommande,
              item.idProduit,
              item.quantite,
              item.prixUnitaire
            ]
          );

          await StockService.decreaseStock(
            item.idProduit,
            item.quantite,
            "Commande"
          );

          if (
            dto.typeCommande ===
            "REVENDEUR"
          ) {

            await StockRevendeurService
              .increaseStock(
                dto.idClient,
                item.idProduit,
                item.quantite
              );
          }
        }

        await db.execute(
          `
          UPDATE commandes
          SET montant_ht = ?,
              montant_ttc = ?
          WHERE idCommande = ?
          `,
          [
            montantHT,
            montantHT,
            idCommande
          ]
        );

        return idCommande;
      }
    );
  }

  static async getCommandeById(
    idCommande: number
  ) {

    const db =
      await import("../database/db")
      .then(m => m.getDb());

    const commande =
      await db.select(
        `
        SELECT *
        FROM commandes
        WHERE idCommande = ?
        `,
        [idCommande]
      ) as any[];

    return commande[0];
  }

  static async getAllCommandes() {

    const db =
      await import("../database/db")
      .then(m => m.getDb());

    return await db.select(
      `
      SELECT
        c.*,
        cl.NomComplet
      FROM commandes c
      INNER JOIN clients cl
      ON cl.idClient = c.idClient
      ORDER BY c.idCommande DESC
      `
    );
  }

  static async deleteCommande(
    idCommande: number
  ) {

    return await executeTransaction(
      async (db: any) => {

        await db.execute(
          `
          DELETE FROM commande_details
          WHERE idCommande = ?
          `,
          [idCommande]
        );

        await db.execute(
          `
          DELETE FROM commandes
          WHERE idCommande = ?
          `,
          [idCommande]
        );
      }
    );
  }
}