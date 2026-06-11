// src/database/repositories/decompteRepository.ts

import { getDb } from "../db";
import { stockRevendeurRepository } from "./stockRevendeurRepository";

export interface CreateDecompteInput {
  idClient: number;
  observation?: string;
}

export interface CreateDecompteDetailInput {
  idProduit: number;
  qte_decompte: number;
}

export const decompteRepository = {

  async create(
    decompte: CreateDecompteInput,
    details: CreateDecompteDetailInput[]
  ): Promise<number> {

    const db = await getDb();

    try {

      await db.execute("BEGIN TRANSACTION");

      const codeDecompte =
        `DCP-${Date.now()}`;

      const result =
        await db.execute(
          `
          INSERT INTO decomptes
          (
            idClient,
            code_decompte,
            observation
          )
          VALUES
          (
            ?, ?, ?
          )
          `,
          [
            decompte.idClient,
            codeDecompte,
            decompte.observation ?? null
          ]
        );

      const idDecompte =
        Number(result.lastInsertId);

      let montantAchat = 0;
      let montantVente = 0;
      let montantBenefice = 0;
      let montantCommission = 0;

      for (const detail of details) {

        const produit =
          await db.select<any[]>(
            `
            SELECT *
            FROM products
            WHERE idProduit = ?
            `,
            [detail.idProduit]
          );

        if (produit.length === 0) {

          throw new Error(
            `Produit introuvable`
          );
        }

        const p = produit[0];

        const prixAchat =
          Number(
            p.prix_achat_base
          );

        const prixVente =
          Number(
            p.prix_vente_gros
          );

        const commission =
          Number(
            p.commission_pourcentage
          );

        const totalAchat =
          prixAchat *
          detail.qte_decompte;

        const totalVente =
          prixVente *
          detail.qte_decompte;

        const benefice =
          totalVente -
          totalAchat;

        const montantCommissionLigne =
          benefice *
          commission /
          100;

        montantAchat +=
          totalAchat;

        montantVente +=
          totalVente;

        montantBenefice +=
          benefice;

        montantCommission +=
          montantCommissionLigne;

        await db.execute(
          `
          INSERT INTO decompte_details
          (
            idDecompte,
            idProduit,
            qte_decompte,
            prix_achat,
            prix_vente,
            commission_pourcentage
          )
          VALUES
          (
            ?, ?, ?, ?, ?, ?
          )
          `,
          [
            idDecompte,
            detail.idProduit,
            detail.qte_decompte,
            prixAchat,
            prixVente,
            commission
          ]
        );

        await stockRevendeurRepository.retirer(
          decompte.idClient,
          detail.idProduit,
          detail.qte_decompte
        );

        await db.execute(
          `
          INSERT INTO mouvements_revendeur
          (
            idProduit,
            idRevendeur,
            idDecompte,
            type_mouvement,
            qte_mouvement
          )
          VALUES
          (
            ?, ?, ?, ?, ?
          )
          `,
          [
            detail.idProduit,
            decompte.idClient,
            idDecompte,
            "SORTIE",
            detail.qte_decompte
          ]
        );
      }

      const montantNet =
        montantVente -
        montantCommission;

      await db.execute(
        `
        UPDATE decomptes
        SET
          montant_achat = ?,
          montant_vente = ?,
          montant_benefice = ?,
          montant_commission = ?,
          montant_net = ?
        WHERE idDecompte = ?
        `,
        [
          montantAchat,
          montantVente,
          montantBenefice,
          montantCommission,
          montantNet,
          idDecompte
        ]
      );

      await db.execute(
        "COMMIT"
      );

      return idDecompte;

    } catch (error) {

      await db.execute(
        "ROLLBACK"
      );

      throw error;
    }
  },

  async getById(
    idDecompte: number
  ) {

    const db = await getDb();

    const decompte =
      await db.select<any[]>(
        `
        SELECT

          d.*,

          c.NomComplet,
          c.Societe

        FROM decomptes d

        INNER JOIN clients c
        ON c.idClient = d.idClient

        WHERE d.idDecompte = ?
        `,
        [idDecompte]
      );

    if (
      decompte.length === 0
    ) {

      return null;
    }

    const details =
      await db.select<any[]>(
        `
        SELECT

          dd.*,

          p.designation,
          p.code_produit

        FROM decompte_details dd

        INNER JOIN products p
        ON p.idProduit =
           dd.idProduit

        WHERE dd.idDecompte = ?
        `,
        [idDecompte]
      );

    return {

      ...decompte[0],

      details

    };
  },

  async getAll() {

    const db = await getDb();

    return await db.select<any[]>(
      `
      SELECT

        d.*,

        c.NomComplet

      FROM decomptes d

      INNER JOIN clients c
      ON c.idClient = d.idClient

      ORDER BY d.idDecompte DESC
      `
    );
  },

  async updateStatut(
  idDecompte: number,
  statut: string
) {

  const db = await getDb();

  await db.execute(
    `
    UPDATE decomptes
    SET statut = ?
    WHERE idDecompte = ?
    `,
    [
      statut,
      idDecompte
    ]
  );
},

async rechercher(
  texte: string
) {

  const db = await getDb();

  return await db.select<any[]>(`
    SELECT

      d.*,

      c.NomComplet

    FROM decomptes d

    INNER JOIN clients c
      ON c.idClient = d.idClient

    WHERE

      d.code_decompte LIKE ?

      OR

      c.NomComplet LIKE ?

    ORDER BY
      d.idDecompte DESC
  `,
  [
    `%${texte}%`,
    `%${texte}%`
  ]);
},

 async delete(
  idDecompte: number
) {

  const db = await getDb();

  try {

    await db.execute(
      "BEGIN TRANSACTION"
    );

    const decompte =
      await db.select<any[]>(`
        SELECT *
        FROM decomptes
        WHERE idDecompte = ?
      `,
      [idDecompte]);

    if (
      decompte.length === 0
    ) {
      throw new Error(
        "Décompte introuvable"
      );
    }

    const idRevendeur =
      decompte[0].idClient;

    const details =
      await db.select<any[]>(`
        SELECT *
        FROM decompte_details
        WHERE idDecompte = ?
      `,
      [idDecompte]);

    for (const detail of details) {

      await stockRevendeurRepository
        .approvisionner(
          idRevendeur,
          detail.idProduit,
          detail.qte_decompte
        );

      await db.execute(`
        INSERT INTO mouvements_revendeur
        (
          idProduit,
          idRevendeur,
          idDecompte,
          type_mouvement,
          qte_mouvement
        )
        VALUES
        (
          ?, ?, ?, ?, ?
        )
      `,
      [
        detail.idProduit,
        idRevendeur,
        idDecompte,
        "ANNULATION_DECOMPTE",
        detail.qte_decompte
      ]);
    }

    await db.execute(`
      DELETE FROM decomptes
      WHERE idDecompte = ?
    `,
    [idDecompte]);

    await db.execute(
      "COMMIT"
    );

  } catch(error) {

    await db.execute(
      "ROLLBACK"
    );

    throw error;
  }
}

};