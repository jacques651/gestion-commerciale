// src/database/repositories/commandeRepository.ts
import { getDb } from '../db';
import { factureRevendeurRepository } from "./factureRevendeurRepository";
import { factureRepository } from "./factureRepository";

export interface Commande {
  idFacture: string | undefined;
  idFactureRevendeur: any;
  date_facture: any;
  NomComplet: string;
  Societe: string;
  idCommande: number;
  code_commande: string;
  idClient: number;
  type_commande: string;
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  code_facture?: string;
  statut: string;
}

export interface CreateCommandeInput {
  code_commande: string;
  idClient: number;
  type_commande: string;
  montant_ht: number;
  montant_ttc: number;
  statut?: string;
}

export interface CreateCommandeDetailInput {
  idProduit: number;
  qte_commande: number;
  prix_unitaire_vente: number;
}

export const commandeRepository = {
  async getAll(): Promise<any[]> {
    const db = await getDb();

    return await db.select<any[]>(`
      SELECT
        c.*,
        cl.NomComplet,
        cl.Societe,
        cl.TypeClient,
        f.idFacture,
        f.code_facture AS code_facture_standard,
        f.date_facture AS date_facture_standard,
        fr.idFactureRevendeur,
        fr.code_facture AS code_facture_revendeur,
        fr.date_facture AS date_facture_revendeur,
        COALESCE(fr.code_facture, f.code_facture) AS code_facture,
        COALESCE(fr.date_facture, f.date_facture) AS date_facture
      FROM commandes c
      INNER JOIN clients cl ON cl.idClient = c.idClient
      LEFT JOIN factures f ON f.idCommande = c.idCommande
      LEFT JOIN factures_revendeur fr ON fr.idCommande = c.idCommande
      ORDER BY c.idCommande DESC
    `);
  },

  async getById(idCommande: number) {
    const db = await getDb();
    const commande = await db.select<any[]>(`
      SELECT
        c.*,
        cl.NomComplet,
        cl.Societe,
        cl.Tel
      FROM commandes c
      INNER JOIN clients cl ON cl.idClient = c.idClient
      WHERE c.idCommande = ?
    `, [idCommande]);

    if (commande.length === 0) {
      return null;
    }

    const details = await db.select<any[]>(`
      SELECT
        cd.*,
        p.code_produit,
        p.designation
      FROM commande_details cd
      INNER JOIN products p ON p.idProduit = cd.idProduit
      WHERE cd.idCommande = ?
    `, [idCommande]);

    return {
      ...commande[0],
      details
    };
  },

  async create(
    commande: CreateCommandeInput,
    details: CreateCommandeDetailInput[]
  ): Promise<number> {
    const db = await getDb();

    try {
      console.log("================================");
      console.log("DEBUT CREATION COMMANDE");
      console.log("Commande :", commande);
      console.log("Détails :", details);
      console.log("================================");

      // ✅ Insertion avec les colonnes correctes
      const result = await db.execute(`
        INSERT INTO commandes (
          code_commande,
          idClient,
          type_commande,
          montant_ht,
          montant_ttc,
          statut
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        commande.code_commande,
        commande.idClient,
        commande.type_commande,
        commande.montant_ht,
        commande.montant_ttc,
        commande.statut || "CONFIRMEE"
      ]);

      const idCommande = Number(result.lastInsertId);

      console.log("Commande créée avec ID =", idCommande);

      for (const detail of details) {
        console.log("Traitement produit :", detail.idProduit);

        const produit = await db.select<any[]>(`
          SELECT *
          FROM products
          WHERE idProduit = ?
        `, [detail.idProduit]);

        if (produit.length === 0) {
          throw new Error(`Produit introuvable : ${detail.idProduit}`);
        }

        const p = produit[0];

        console.log("Produit trouvé :", p.designation);

        // ✅ Vérification du stock
        if (Number(p.qte_stock) < detail.qte_commande) {
          throw new Error(`Stock insuffisant pour ${p.designation}`);
        }

        await db.execute(`
          INSERT INTO commande_details (
            idCommande,
            idProduit,
            qte_commande,
            prix_unitaire_vente
          )
          VALUES (?, ?, ?, ?)
        `, [
          idCommande,
          detail.idProduit,
          detail.qte_commande,
          detail.prix_unitaire_vente
        ]);

        console.log("Détail commande enregistré");

        // ✅ Mise à jour du stock
        const stockAvant = Number(p.qte_stock);
        const stockApres = stockAvant - detail.qte_commande;

        await db.execute(`
          UPDATE products
          SET qte_stock = ?
          WHERE idProduit = ?
        `, [stockApres, detail.idProduit]);

        console.log("Stock mis à jour :", stockAvant, "->", stockApres);

        // ✅ Mouvement de stock
        await db.execute(`
          INSERT INTO mouvements_stock (
            idProduit,
            type_mouvement,
            quantite,
            stock_avant,
            stock_apres,
            idCommande
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          detail.idProduit,
          "SORTIE",
          detail.qte_commande,
          stockAvant,
          stockApres,
          idCommande
        ]);

        console.log("Mouvement stock enregistré");

        // ✅ Gestion stock revendeur
        if (commande.type_commande === "REVENDEUR") {
          console.log("Gestion stock revendeur");

          const stockRevendeur = await db.select<any[]>(`
            SELECT *
            FROM stock_revendeur
            WHERE idProduit = ? AND idRevendeur = ?
          `, [detail.idProduit, commande.idClient]);

          if (stockRevendeur.length > 0) {
            await db.execute(`
              UPDATE stock_revendeur
              SET qte_stock = qte_stock + ?
              WHERE idStockRevendeur = ?
            `, [
              detail.qte_commande,
              stockRevendeur[0].idStockRevendeur
            ]);

            console.log("Stock revendeur mis à jour");
          } else {
            await db.execute(`
              INSERT INTO stock_revendeur (
                idProduit,
                idRevendeur,
                qte_stock,
                prix_achat,
                prix_vente,
                commission_pourcentage
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              detail.idProduit,
              commande.idClient,
              detail.qte_commande,
              p.prix_achat_base || 0,
              p.prix_vente_gros || 0,
              p.commission_pourcentage || 60
            ]);

            console.log("Stock revendeur créé");
          }

          await db.execute(`
            INSERT INTO mouvements_revendeur (
              idProduit,
              idRevendeur,
              idCommande,
              type_mouvement,
              qte_mouvement
            )
            VALUES (?, ?, ?, ?, ?)
          `, [
            detail.idProduit,
            commande.idClient,
            idCommande,
            "ENTREE",
            detail.qte_commande
          ]);

          console.log("Mouvement revendeur enregistré");
        }
      }

      console.log("type_commande reçu =", JSON.stringify(commande.type_commande));
      console.log("Début génération facture...");

      // ✅ Génération de la facture
      if (commande.type_commande === "REVENDEUR") {
        console.log("Création facture revendeur");
        const factureId = await factureRevendeurRepository.createFromCommande(idCommande);
        console.log("Facture revendeur créée :", factureId);
      } else {
        console.log("Création facture standard");
        const factureId = await factureRepository.createFromCommande(idCommande);
        console.log("Facture standard créée :", factureId);
      }

      console.log("FIN CREATION COMMANDE");

      return idCommande;

    } catch (error) {
      console.error("ERREUR CREATION COMMANDE :", error);
      throw error;
    }
  },

  async updateStatus(idCommande: number, statut: string) {
    const db = await getDb();
    await db.execute(`
      UPDATE commandes
      SET statut = ?
      WHERE idCommande = ?
    `, [statut, idCommande]);
  },

  async cancel(idCommande: number): Promise<void> {
    const db = await getDb();

    try {
      const commande = await db.select<any[]>(`
        SELECT *
        FROM commandes
        WHERE idCommande = ?
      `, [idCommande]);

      if (commande.length === 0) {
        throw new Error("Commande introuvable");
      }

      const cmd = commande[0];

      if (cmd.statut === "ANNULEE") {
        throw new Error("Commande déjà annulée");
      }

      const details = await db.select<any[]>(`
        SELECT *
        FROM commande_details
        WHERE idCommande = ?
      `, [idCommande]);

      for (const detail of details) {
        const produit = await db.select<any[]>(`
          SELECT *
          FROM products
          WHERE idProduit = ?
        `, [detail.idProduit]);

        if (produit.length === 0) continue;

        const p = produit[0];
        const stockAvant = Number(p.qte_stock);
        const stockApres = stockAvant + Number(detail.qte_commande);

        await db.execute(`
          UPDATE products
          SET qte_stock = ?
          WHERE idProduit = ?
        `, [stockApres, detail.idProduit]);

        await db.execute(`
          INSERT INTO mouvements_stock (
            idProduit,
            type_mouvement,
            quantite,
            stock_avant,
            stock_apres,
            idCommande
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          detail.idProduit,
          "ANNULATION",
          detail.qte_commande,
          stockAvant,
          stockApres,
          idCommande
        ]);

        if (cmd.type_commande === "REVENDEUR") {
          const stockRevendeur = await db.select<any[]>(`
            SELECT *
            FROM stock_revendeur
            WHERE idProduit = ? AND idRevendeur = ?
          `, [detail.idProduit, cmd.idClient]);

          if (stockRevendeur.length > 0) {
            const sr = stockRevendeur[0];
            const nouveauStock = Math.max(0, Number(sr.qte_stock) - Number(detail.qte_commande));

            await db.execute(`
              UPDATE stock_revendeur
              SET qte_stock = ?
              WHERE idStockRevendeur = ?
            `, [nouveauStock, sr.idStockRevendeur]);
          }

          await db.execute(`
            INSERT INTO mouvements_revendeur (
              idProduit,
              idRevendeur,
              idCommande,
              type_mouvement,
              qte_mouvement
            )
            VALUES (?, ?, ?, ?, ?)
          `, [
            detail.idProduit,
            cmd.idClient,
            idCommande,
            "ANNULATION",
            detail.qte_commande
          ]);
        }
      }

      await db.execute(`
        UPDATE commandes
        SET statut = 'ANNULEE'
        WHERE idCommande = ?
      `, [idCommande]);

    } catch (error) {
      console.error("Erreur annulation commande:", error);
      throw error;
    }
  },

  async getByClient(idClient: number) {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT *
      FROM commandes
      WHERE idClient = ?
      ORDER BY idCommande DESC
    `, [idClient]);
  },

  async getByStatus(statut: string) {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT *
      FROM commandes
      WHERE statut = ?
      ORDER BY idCommande DESC
    `, [statut]);
  },

  async getTodayCommandes() {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(montant_ttc), 0) as montant
      FROM commandes
      WHERE date(date_commande) = date('now')
      AND statut != 'ANNULEE'
    `);
    return {
      total: Number(result[0]?.total || 0),
      montant: Number(result[0]?.montant || 0)
    };
  }
};