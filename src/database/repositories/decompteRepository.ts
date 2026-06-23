// src/database/repositories/decompteRepository.ts
import { getDb } from "../db";
import { stockRevendeurRepository } from "./stockRevendeurRepository";

export interface CreateDecompteInput {
  idClient: number;
  observation?: string;
  periode_debut?: string;
  periode_fin?: string;
  notes?: string;
}

export interface CreateDecompteDetailInput {
  idProduit: number;
  qte_decompte: number;
}

export interface DecompteStatistiques {
  total: number;
  totalValide: number;
  totalPaye: number;
  totalAnnule: number;
  totalBrouillon: number;
  montantTotal: number;
  montantTotalVente: number;
  montantTotalCommission: number;
  montantTotalBenefice: number;
}

export const decompteRepository = {

  // Vérifier si la table existe
  async tableExists(): Promise<boolean> {
    try {
      const db = await getDb();
      const result = await db.select<{ count: number }[]>(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='decomptes'
      `);
      return result[0]?.count > 0;
    } catch (error) {
      console.error('Erreur vérification table decomptes:', error);
      return false;
    }
  },

  // Créer la table si elle n'existe pas
  async ensureTable(): Promise<void> {
    try {
      const exists = await this.tableExists();
      if (!exists) {
        const db = await getDb();
        
        await db.execute(`
          CREATE TABLE IF NOT EXISTS decomptes (
            idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
            idClient INTEGER NOT NULL,
            code_decompte TEXT UNIQUE,
            date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_achat REAL DEFAULT 0,
            montant_vente REAL DEFAULT 0,
            montant_benefice REAL DEFAULT 0,
            montant_commission REAL DEFAULT 0,
            montant_net REAL DEFAULT 0,
            statut TEXT DEFAULT 'brouillon',
            observation TEXT,
            periode_debut TEXT,
            periode_fin TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS decompte_details (
            idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idDecompte INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte_decompte REAL NOT NULL DEFAULT 0,
            prix_achat REAL DEFAULT 0,
            prix_vente REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            designation TEXT,
            total REAL DEFAULT 0,
            FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);

        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient);
          CREATE INDEX IF NOT EXISTS idx_decomptes_date ON decomptes(date_decompte);
          CREATE INDEX IF NOT EXISTS idx_decomptes_statut ON decomptes(statut);
          CREATE INDEX IF NOT EXISTS idx_decomptes_code ON decomptes(code_decompte);
          CREATE INDEX IF NOT EXISTS idx_decompte_details_decompte ON decompte_details(idDecompte);
          CREATE INDEX IF NOT EXISTS idx_decompte_details_produit ON decompte_details(idProduit);
        `);

        console.log('✅ Table decomptes créée avec succès');
      }
    } catch (error) {
      console.error('Erreur création table decomptes:', error);
      throw error;
    }
  },

  // Récupérer les statistiques
  async getStatistiques(): Promise<DecompteStatistiques> {
    try {
      await this.ensureTable();
      const db = await getDb();
      
      const result = await db.select<any[]>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'valide' THEN 1 ELSE 0 END) as totalValide,
          SUM(CASE WHEN statut = 'paye' THEN 1 ELSE 0 END) as totalPaye,
          SUM(CASE WHEN statut = 'annule' THEN 1 ELSE 0 END) as totalAnnule,
          SUM(CASE WHEN statut = 'brouillon' THEN 1 ELSE 0 END) as totalBrouillon,
          SUM(montant_net) as montantTotal,
          SUM(montant_vente) as montantTotalVente,
          SUM(montant_commission) as montantTotalCommission,
          SUM(montant_benefice) as montantTotalBenefice
        FROM decomptes
        WHERE statut != 'annule'
      `);
      
      const stats = result[0] || {};
      
      return {
        total: stats.total || 0,
        totalValide: stats.totalValide || 0,
        totalPaye: stats.totalPaye || 0,
        totalAnnule: stats.totalAnnule || 0,
        totalBrouillon: stats.totalBrouillon || 0,
        montantTotal: stats.montantTotal || 0,
        montantTotalVente: stats.montantTotalVente || 0,
        montantTotalCommission: stats.montantTotalCommission || 0,
        montantTotalBenefice: stats.montantTotalBenefice || 0
      };
      
    } catch (error) {
      console.error('Erreur getStatistiques:', error);
      return {
        total: 0,
        totalValide: 0,
        totalPaye: 0,
        totalAnnule: 0,
        totalBrouillon: 0,
        montantTotal: 0,
        montantTotalVente: 0,
        montantTotalCommission: 0,
        montantTotalBenefice: 0
      };
    }
  },

  // =====================================================
  // CREATE SANS TRANSACTION - VERSION SIMPLIFIÉE
  // =====================================================
  async create(
    decompte: CreateDecompteInput,
    details: CreateDecompteDetailInput[]
  ): Promise<number> {
    const db = await getDb();

    try {
      const codeDecompte = `DCP-${Date.now()}`;

      const result = await db.execute(
        `
        INSERT INTO decomptes
        (
          idClient,
          code_decompte,
          observation,
          periode_debut,
          periode_fin,
          notes,
          statut
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          decompte.idClient,
          codeDecompte,
          decompte.observation ?? null,
          decompte.periode_debut ?? null,
          decompte.periode_fin ?? null,
          decompte.notes ?? null,
          'brouillon'
        ]
      );

      const idDecompte = Number(result.lastInsertId);

      let montantAchat = 0;
      let montantVente = 0;
      let montantBenefice = 0;
      let montantCommission = 0;

      for (const detail of details) {
        const produit = await db.select<any[]>(
          `SELECT * FROM products WHERE idProduit = ?`,
          [detail.idProduit]
        );

        if (produit.length === 0) {
          throw new Error(`Produit introuvable`);
        }

        const p = produit[0];

        const prixAchat = Number(p.prix_achat_base || 0);
        const prixVente = Number(p.prix_vente_gros || 0);
        const commission = Number(p.commission_pourcentage || 0);

        const totalAchat = prixAchat * detail.qte_decompte;
        const totalVente = prixVente * detail.qte_decompte;
        const benefice = totalVente - totalAchat;
        const montantCommissionLigne = benefice * commission / 100;

        montantAchat += totalAchat;
        montantVente += totalVente;
        montantBenefice += benefice;
        montantCommission += montantCommissionLigne;

        // Insertion dans decompte_details
        await db.execute(
          `
          INSERT INTO decompte_details
          (
            idDecompte,
            idProduit,
            qte_decompte,
            prix_achat,
            prix_vente,
            commission_pourcentage,
            designation,
            total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            idDecompte,
            detail.idProduit,
            detail.qte_decompte,
            prixAchat,
            prixVente,
            commission,
            p.designation || 'Produit',
            totalVente
          ]
        );

        // Retirer du stock revendeur
        await stockRevendeurRepository.retirer(
          decompte.idClient,
          detail.idProduit,
          detail.qte_decompte
        );

        // Enregistrer le mouvement
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
          VALUES (?, ?, ?, ?, ?)
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

      const montantNet = montantVente - montantCommission;

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

      return idDecompte;

    } catch (error) {
      console.error('❌ Erreur lors de la création du décompte:', error);
      throw error;
    }
  },

  async getById(idDecompte: number) {
    const db = await getDb();

    const decompte = await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet,
        c.Societe,
        c.Tel,
        c.Adresse
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      WHERE d.idDecompte = ?
      `,
      [idDecompte]
    );

    if (decompte.length === 0) {
      return null;
    }

    const details = await db.select<any[]>(
      `
      SELECT
        dd.*,
        p.designation,
        p.code_produit
      FROM decompte_details dd
      INNER JOIN products p ON p.idProduit = dd.idProduit
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
    await this.ensureTable();

    return await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      ORDER BY d.idDecompte DESC
      `
    );
  },

  async updateStatut(idDecompte: number, statut: string) {
    const db = await getDb();

    await db.execute(
      `
      UPDATE decomptes
      SET 
        statut = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE idDecompte = ?
      `,
      [statut, idDecompte]
    );
  },

  async rechercher(texte: string) {
    const db = await getDb();

    return await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      WHERE d.code_decompte LIKE ? OR c.NomComplet LIKE ?
      ORDER BY d.idDecompte DESC
      `,
      [`%${texte}%`, `%${texte}%`]
    );
  },

  // =====================================================
  // DELETE SANS TRANSACTION
  // =====================================================
  async delete(idDecompte: number): Promise<void> {
    const db = await getDb();

    try {
      // Récupérer les informations nécessaires
      const decompte = await db.select<any[]>(
        `SELECT * FROM decomptes WHERE idDecompte = ?`,
        [idDecompte]
      );

      if (decompte.length === 0) {
        throw new Error("Décompte introuvable");
      }

      const idRevendeur = decompte[0].idClient;

      // Récupérer les détails
      const details = await db.select<any[]>(
        `SELECT * FROM decompte_details WHERE idDecompte = ?`,
        [idDecompte]
      );

      console.log(`📦 Restauration des stocks pour ${details.length} produits...`);

      // Restaurer les stocks UN PAR UN
      for (const detail of details) {
        try {
          const stockExists = await db.select<any[]>(
            `SELECT * FROM stock_revendeur 
             WHERE idRevendeur = ? AND idProduit = ?`,
            [idRevendeur, detail.idProduit]
          );

          if (stockExists.length > 0) {
            await db.execute(
              `UPDATE stock_revendeur 
               SET qte_stock = qte_stock + ?
               WHERE idRevendeur = ? AND idProduit = ?`,
              [detail.qte_decompte, idRevendeur, detail.idProduit]
            );
            console.log(`✅ Stock restauré pour produit ${detail.idProduit}`);
          } else {
            console.warn(`⚠️ Stock non trouvé pour produit ${detail.idProduit}, création...`);
            await db.execute(
              `INSERT INTO stock_revendeur (idRevendeur, idProduit, qte_stock, prix_achat, prix_vente, commission_pourcentage) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                idRevendeur, 
                detail.idProduit, 
                detail.qte_decompte,
                detail.prix_achat || 0,
                detail.prix_vente || 0,
                detail.commission_pourcentage || 0
              ]
            );
          }

          await db.execute(`
            INSERT INTO mouvements_revendeur
            (idProduit, idRevendeur, idDecompte, type_mouvement, qte_mouvement)
            VALUES (?, ?, ?, ?, ?)
          `,
          [detail.idProduit, idRevendeur, idDecompte, "ANNULATION_DECOMPTE", detail.qte_decompte]);

        } catch (productError) {
          console.error(`❌ Erreur pour le produit ${detail.idProduit}:`, productError);
        }
      }

      // Supprimer les enregistrements
      await db.execute(`DELETE FROM mouvements_revendeur WHERE idDecompte = ?`, [idDecompte]);
      console.log(`✅ Mouvements supprimés`);

      await db.execute(`DELETE FROM decompte_details WHERE idDecompte = ?`, [idDecompte]);
      console.log(`✅ Détails supprimés`);

      await db.execute(`DELETE FROM decomptes WHERE idDecompte = ?`, [idDecompte]);
      console.log(`✅ Décompte supprimé`);

      console.log(`✅ Suppression du décompte ${idDecompte} terminée`);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      throw error;
    }
  },

  // Récupérer les décomptes par statut
  async getByStatut(statut: string) {
    const db = await getDb();
    await this.ensureTable();

    return await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      WHERE d.statut = ?
      ORDER BY d.idDecompte DESC
      `,
      [statut]
    );
  },

  // Récupérer les décomptes par client
  async getByClient(idClient: number) {
    const db = await getDb();
    await this.ensureTable();

    return await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      WHERE d.idClient = ?
      ORDER BY d.idDecompte DESC
      `,
      [idClient]
    );
  },

  // Récupérer les décomptes par période
  async getByPeriode(dateDebut: string, dateFin: string) {
    const db = await getDb();
    await this.ensureTable();

    return await db.select<any[]>(
      `
      SELECT
        d.*,
        c.NomComplet
      FROM decomptes d
      INNER JOIN clients c ON c.idClient = d.idClient
      WHERE d.date_decompte BETWEEN ? AND ?
      ORDER BY d.idDecompte DESC
      `,
      [dateDebut, dateFin]
    );
  }
};