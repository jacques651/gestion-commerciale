// src/database/repositories/factureRevendeurRepository.ts

import { getDb } from "../db";

export interface FactureRevendeur {
  idFactureRevendeur: number;
  idCommande: number;
  idRevendeur: number;
  code_facture: string;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  commission: number;
  statut: string;
}

export const factureRevendeurRepository = {

  async getAll() {

    const db = await getDb();

    return await db.select<any[]>(`

      SELECT

        fr.*,

        c.NomComplet,
        c.Societe

      FROM factures_revendeur fr

      INNER JOIN clients c
        ON c.idClient = fr.idRevendeur

      ORDER BY fr.idFactureRevendeur DESC

    `);
  },

  async getById(
  idFactureRevendeur: number
) {

  const db = await getDb();

  const facture =
    await db.select<any[]>(`

      SELECT

        fr.*,

        c.idClient,

        c.NomComplet,

        c.Societe,

        c.Tel,

        c.Adresse,

        c.Email

      FROM factures_revendeur fr

      INNER JOIN clients c
        ON c.idClient = fr.idRevendeur

      WHERE fr.idFactureRevendeur = ?

    `, [idFactureRevendeur]);

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

        p.commission_pourcentage,

        (
          p.prix_vente_gros -
          p.prix_achat_base
        ) * cd.qte_commande
          AS benefice_ligne,

        (
          (
            p.prix_vente_gros -
            p.prix_achat_base
          )
          * cd.qte_commande
          * p.commission_pourcentage
          / 100
        ) AS commission_ligne

      FROM commande_details cd

      INNER JOIN products p
        ON p.idProduit = cd.idProduit

      WHERE cd.idCommande = ?

      ORDER BY p.designation

    `, [facture[0].idCommande]);

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

    const cmd = commande[0];

    if (
      cmd.type_commande !==
      "REVENDEUR"
    ) {

      throw new Error(
        "Cette commande n'est pas une commande revendeur"
      );
    }

    const existe =
      await db.select<any[]>(`

        SELECT *
        FROM factures_revendeur
        WHERE idCommande = ?

      `, [idCommande]);

    if (existe.length > 0) {

      return Number(
        existe[0]
        .idFactureRevendeur
      );
    }

    const details =
      await db.select<any[]>(`

        SELECT

          cd.*,

          p.prix_achat_base,

          p.prix_vente_gros,

          p.commission_pourcentage

        FROM commande_details cd

        INNER JOIN products p
          ON p.idProduit =
             cd.idProduit

        WHERE cd.idCommande = ?

      `, [idCommande]);

    let montantHT = 0;
    let montantTTC = 0;
    let commission = 0;

    for (const d of details) {

      const qte =
        Number(d.qte_commande);

      const achat =
        Number(d.prix_achat_base);

      const vente =
        Number(d.prix_vente_gros);

      const taux =
        Number(
          d.commission_pourcentage
        );

      const totalAchat =
        achat * qte;

      const totalVente =
        vente * qte;

      const benefice =
        totalVente -
        totalAchat;

      montantHT += totalVente;
      montantTTC += totalVente;

      commission +=
        (benefice * taux) / 100;
    }

    const codeFacture =
      `FR-${Date.now()}`;

    const result =
      await db.execute(`

        INSERT INTO
        factures_revendeur
        (
          idCommande,
          idRevendeur,
          code_facture,
          montant_ht,
          montant_ttc,
          commission,
          statut
        )
        VALUES
        (
          ?,?,?,?,?,?,?
        )

      `, [

        idCommande,
        cmd.idClient,
        codeFacture,
        montantHT,
        montantTTC,
        commission,
        "EN_ATTENTE"

      ]);

    return Number(
      result.lastInsertId
    );
  },

  async updateStatut(
    idFactureRevendeur: number,
    statut: string
  ) {

    const db = await getDb();

    await db.execute(`

      UPDATE factures_revendeur

      SET statut = ?

      WHERE idFactureRevendeur = ?

    `, [
      statut,
      idFactureRevendeur
    ]);
  },

  async delete(
    idFactureRevendeur: number
  ) {

    const db = await getDb();

    await db.execute(`

      DELETE
      FROM factures_revendeur

      WHERE idFactureRevendeur = ?

    `, [idFactureRevendeur]);
  }

};