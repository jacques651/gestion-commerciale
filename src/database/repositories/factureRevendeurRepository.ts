// src/database/repositories/factureRevendeurRepository.ts
import { getDb } from '../db';

export const factureRevendeurRepository = {
  
  async getById(id: number): Promise<any> {
    try {
      const db = await getDb();
      
      // ✅ Récupérer la facture avec toutes les infos
      const facture = await db.select<any[]>(`
        SELECT 
          fr.*,
          c.NomComplet,
          c.Societe,
          c.Tel,
          c.Adresse,
          cmd.code_commande,
          cmd.date_commande
        FROM factures_revendeur fr
        LEFT JOIN clients c ON c.idClient = fr.idRevendeur
        LEFT JOIN commandes cmd ON cmd.idCommande = fr.idCommande
        WHERE fr.idFactureRevendeur = ?
      `, [id]);

      console.log('📄 Facture brute:', facture);

      if (facture.length === 0) {
        return null;
      }

      // ✅ Récupérer les détails
      const details = await db.select<any[]>(`
        SELECT 
          frd.*,
          p.designation,
          p.code_produit,
          p.unite_base,
          p.categorie
        FROM factures_revendeur_details frd
        LEFT JOIN products p ON p.idProduit = frd.idProduit
        WHERE frd.idFactureRevendeur = ?
      `, [id]);

      console.log('📄 Détails bruts:', details);

      const factureData = facture[0];
      
      // ✅ CALCULER LES MONTANTS À PARTIR DES DÉTAILS
      let montantHT = 0;
      let totalAchat = 0;
      
      if (details.length > 0) {
        for (const detail of details) {
          const qte = detail.qte_commande || 0;
          const prixVente = detail.prix_unitaire_vente || 0;
          const prixAchat = detail.prix_achat_base || 0;
          
          montantHT += prixVente * qte;
          totalAchat += prixAchat * qte;
        }
      }
      
      const benefice = montantHT - totalAchat;
      const tauxCommission = factureData.taux_commission || 60;
      const commission = (benefice * tauxCommission) / 100;
      const montantTTC = montantHT * 1.18; // TVA 18%
      
      // ✅ Si les montants sont à 0 dans la base, les mettre à jour
      if (montantHT > 0 && factureData.montant_ht === 0) {
        try {
          await db.execute(`
            UPDATE factures_revendeur 
            SET montant_ht = ?, 
                montant_ttc = ?, 
                commission = ?
            WHERE idFactureRevendeur = ?
          `, [montantHT, montantTTC, commission, id]);
          console.log('✅ Montants mis à jour dans la base:', { montantHT, montantTTC, commission });
        } catch (updateError) {
          console.warn('⚠️ Impossible de mettre à jour les montants:', updateError);
        }
      }

      const result = {
        ...factureData,
        montant_ht: montantHT || factureData.montant_ht || 0,
        montant_ttc: montantTTC || factureData.montant_ttc || 0,
        commission: commission || factureData.commission || 0,
        taux_commission: tauxCommission,
        details: details || []
      };

      console.log('📄 Résultat final:', {
        id: result.idFactureRevendeur,
        code: result.code_facture,
        montant_ht: result.montant_ht,
        montant_ttc: result.montant_ttc,
        commission: result.commission,
        detailsCount: result.details.length
      });

      return result;

    } catch (error) {
      console.error('❌ Erreur getById facture revendeur:', error);
      throw error;
    }
  },

  async getAll(): Promise<any[]> {
    try {
      const db = await getDb();
      
      const factures = await db.select<any[]>(`
        SELECT 
          fr.*,
          c.NomComplet,
          c.Societe,
          c.Tel,
          c.Adresse,
          cmd.code_commande,
          cmd.date_commande
        FROM factures_revendeur fr
        LEFT JOIN clients c ON c.idClient = fr.idRevendeur
        LEFT JOIN commandes cmd ON cmd.idCommande = fr.idCommande
        ORDER BY fr.idFactureRevendeur DESC
      `);

      const result = [];
      for (const facture of factures) {
        const details = await db.select<any[]>(`
          SELECT 
            frd.*,
            p.designation,
            p.code_produit,
            p.unite_base,
            p.categorie
          FROM factures_revendeur_details frd
          LEFT JOIN products p ON p.idProduit = frd.idProduit
          WHERE frd.idFactureRevendeur = ?
        `, [facture.idFactureRevendeur]);
        
        // ✅ Calculer les montants
        let montantHT = 0;
        let totalAchat = 0;
        
        for (const detail of details) {
          const qte = detail.qte_commande || 0;
          const prixVente = detail.prix_unitaire_vente || 0;
          const prixAchat = detail.prix_achat_base || 0;
          
          montantHT += prixVente * qte;
          totalAchat += prixAchat * qte;
        }
        
        const benefice = montantHT - totalAchat;
        const tauxCommission = facture.taux_commission || 60;
        const commission = (benefice * tauxCommission) / 100;
        const montantTTC = montantHT * 1.18;
        
        result.push({
          ...facture,
          montant_ht: montantHT || facture.montant_ht || 0,
          montant_ttc: montantTTC || facture.montant_ttc || 0,
          commission: commission || facture.commission || 0,
          details: details || []
        });
      }

      return result;

    } catch (error) {
      console.error('Erreur getAll factures revendeur:', error);
      return [];
    }
  },

  // ✅ RECALCULER LES MONTANTS D'UNE FACTURE
  async recalculerMontants(idFacture: number): Promise<{ montant_ht: number; montant_ttc: number; commission: number }> {
    try {
      const db = await getDb();
      
      const details = await db.select<any[]>(`
        SELECT frd.*, p.prix_achat_base
        FROM factures_revendeur_details frd
        LEFT JOIN products p ON p.idProduit = frd.idProduit
        WHERE frd.idFactureRevendeur = ?
      `, [idFacture]);

      let totalHT = 0;
      let totalAchat = 0;
      
      for (const detail of details) {
        const qte = detail.qte_commande || 0;
        const prixVente = detail.prix_unitaire_vente || 0;
        const prixAchat = detail.prix_achat_base || 0;
        
        totalHT += prixVente * qte;
        totalAchat += prixAchat * qte;
      }

      const benefice = totalHT - totalAchat;
      const tauxCommission = 60; // Valeur par défaut
      const commission = (benefice * tauxCommission) / 100;
      const totalTTC = totalHT * 1.18;

      await db.execute(`
        UPDATE factures_revendeur 
        SET montant_ht = ?, 
            montant_ttc = ?, 
            commission = ?
        WHERE idFactureRevendeur = ?
      `, [totalHT, totalTTC, commission, idFacture]);

      console.log('✅ Montants recalculés:', { totalHT, totalTTC, commission });
      
      return { montant_ht: totalHT, montant_ttc: totalTTC, commission };

    } catch (error) {
      console.error('❌ Erreur recalculMontants:', error);
      throw error;
    }
  },

  // ✅ CRÉER UNE FACTURE À PARTIR D'UNE COMMANDE
  async createFromCommande(idCommande: number): Promise<number> {
    try {
      const db = await getDb();
      
      // 1. Récupérer la commande
      const commande = await db.select<any[]>(`
        SELECT c.*, cl.idClient as idRevendeur, cl.NomComplet
        FROM commandes c
        LEFT JOIN clients cl ON cl.idClient = c.idClient
        WHERE c.idCommande = ? AND c.type_commande = 'REVENDEUR'
      `, [idCommande]);

      if (commande.length === 0) {
        throw new Error('Commande revendeur non trouvée');
      }

      // 2. Récupérer les détails
      const details = await db.select<any[]>(`
        SELECT cd.*, p.designation, p.prix_achat_base
        FROM commande_details cd
        LEFT JOIN products p ON p.idProduit = cd.idProduit
        WHERE cd.idCommande = ?
      `, [idCommande]);

      if (details.length === 0) {
        throw new Error('Aucun détail de commande trouvé');
      }

      // 3. Calculer les montants
      let totalHT = 0;
      let totalAchat = 0;
      
      for (const d of details) {
        const prixVente = d.prix_unitaire_vente || 0;
        const qte = d.qte_commande || 0;
        const prixAchat = d.prix_achat_base || 0;
        
        totalHT += prixVente * qte;
        totalAchat += prixAchat * qte;
      }

      const benefice = totalHT - totalAchat;
      const tauxCommission = 60;
      const commission = (benefice * tauxCommission) / 100;
      const totalTTC = totalHT * 1.18;

      // 4. Générer le code facture
      const codeFacture = await generateFactureRevendeurCode();

      // 5. Insérer la facture
      const result = await db.execute(`
        INSERT INTO factures_revendeur (
          idCommande,
          idRevendeur,
          code_facture,
          date_facture,
          montant_ht,
          montant_ttc,
          commission,
          taux_commission,
          statut
        )
        VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
      `, [
        idCommande,
        commande[0].idRevendeur,
        codeFacture,
        totalHT,
        totalTTC,
        commission,
        tauxCommission,
        'EN_ATTENTE'
      ]);

      const idFacture = Number(result.lastInsertId);

      // 6. Insérer les détails
      for (const detail of details) {
        await db.execute(`
          INSERT INTO factures_revendeur_details (
            idFactureRevendeur,
            idProduit,
            qte_commande,
            prix_achat_base,
            prix_unitaire_vente
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          idFacture,
          detail.idProduit,
          detail.qte_commande,
          detail.prix_achat_base || 0,
          detail.prix_unitaire_vente
        ]);
      }

      // 7. Mettre à jour la commande
      await db.execute(`
        UPDATE commandes 
        SET code_facture = ?, date_facture = datetime('now')
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);

      console.log('✅ Facture revendeur créée avec succès ID:', idFacture);
      return idFacture;

    } catch (error) {
      console.error('❌ Erreur createFromCommande:', error);
      throw error;
    }
  },

  async updateStatut(id: number, statut: string): Promise<void> {
    try {
      const db = await getDb();
      await db.execute(`
        UPDATE factures_revendeur 
        SET statut = ?
        WHERE idFactureRevendeur = ?
      `, [statut, id]);
    } catch (error) {
      console.error('Erreur updateStatut facture revendeur:', error);
      throw error;
    }
  },

  async getByCommande(idCommande: number): Promise<any[]> {
    try {
      const db = await getDb();
      return await db.select<any[]>(`
        SELECT 
          fr.*,
          c.NomComplet,
          c.Societe,
          c.Tel
        FROM factures_revendeur fr
        LEFT JOIN clients c ON c.idClient = fr.idRevendeur
        WHERE fr.idCommande = ?
        ORDER BY fr.idFactureRevendeur DESC
      `, [idCommande]);
    } catch (error) {
      console.error('Erreur getByCommande:', error);
      return [];
    }
  },

  async getByRevendeur(idRevendeur: number): Promise<any[]> {
    try {
      const db = await getDb();
      return await db.select<any[]>(`
        SELECT 
          fr.*,
          c.NomComplet,
          c.Societe,
          c.Tel,
          cmd.code_commande
        FROM factures_revendeur fr
        LEFT JOIN clients c ON c.idClient = fr.idRevendeur
        LEFT JOIN commandes cmd ON cmd.idCommande = fr.idCommande
        WHERE fr.idRevendeur = ?
        ORDER BY fr.idFactureRevendeur DESC
      `, [idRevendeur]);
    } catch (error) {
      console.error('Erreur getByRevendeur:', error);
      return [];
    }
  }
};

// ✅ Fonction pour générer le code facture revendeur (FCR-XXXXX)
const generateFactureRevendeurCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const prefix = 'FCR';
    
    const lastCode = await db.select<{ max_code: string }[]>(`
      SELECT code_facture as max_code 
      FROM factures_revendeur 
      WHERE code_facture LIKE '${prefix}-%' 
      ORDER BY code_facture DESC 
      LIMIT 1
    `);

    let sequence = 1;
    if (lastCode.length > 0 && lastCode[0].max_code) {
      const match = lastCode[0].max_code.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}-${String(sequence).padStart(5, '0')}`;
  } catch (error) {
    console.error('Erreur génération code facture revendeur:', error);
    return `FCR-${String(Date.now()).slice(-5)}`;
  }
};