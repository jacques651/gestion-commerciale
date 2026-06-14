// src/services/stockService.ts

import { getDb } from "../db";
import { lotRepository } from "./lotRepository";
import { mouvementRepository } from "./mouvementRepository";
import { productRepository } from "./productRepository";


// src/services/stockService.ts (extrait des interfaces)
export interface EntreeStockInput {
  prix_vente: number;
  idProduit: number;
  quantite: number;
  prix_achat: number;
  marge_fixe?: number;  // ✅ Ajouté pour la marge fixe en FCFA
  date_entree: string;
  reference_facture?: string;
  idFournisseur?: number;
  notes?: string;
  nouveauPrixVente?: number; // Optionnel, calculé si non fourni
}

export interface SortieStockInput {
  idProduit: number;
  quantite: number;
  prix_vente: number;
  reference?: string;
  notes?: string;
}

export interface ResultStock {
  success: boolean;
  message: string;
  nouveauStock?: number;
  nouveauPMP?: number;
  nouveauPrixVente?: number;
  benefice?: number;
  coutAchatTotal?: number;
}

class StockService {
  // src/database/repositories/stockService.ts
async entreeStock(data: EntreeStockInput): Promise<ResultStock> {
  try {
    const product = await productRepository.getById(data.idProduit);
    if (!product) {
      return { success: false, message: 'Produit non trouvé' };
    }

    // Utiliser la marge_fixe passée ou celle du produit
    const margeFixe = data.marge_fixe ?? product.commission_pourcentage ?? 5000;
    
    // Calculer le nouveau prix de vente
    const nouveauPrixVente = data.prix_achat + margeFixe;

    // Récupérer le stock actuel et PMP
    const currentStats = await lotRepository.recalculerPMP(data.idProduit);
    const stockAvant = currentStats.stockTotal;
    const pmpAvant = currentStats.pmp;

    // Créer le lot
    const idLot = await lotRepository.createLot({
      idProduit: data.idProduit,
      quantite_entree: data.quantite,
      prix_achat_unitaire: data.prix_achat,
      prix_vente_unitaire: nouveauPrixVente,
      date_entree: data.date_entree,
      reference_facture: data.reference_facture,
      idFournisseur: data.idFournisseur,
      notes: data.notes
    });

    // Calculer le nouveau stock et PMP
    const nouveauStock = stockAvant + data.quantite;
    const nouveauPMP = ((stockAvant * pmpAvant) + (data.quantite * data.prix_achat)) / nouveauStock;

    // ✅ CRUCIAL: Mettre à jour le produit avec le nouveau prix de vente
    await productRepository.update(data.idProduit, {
      prix_achat_base: nouveauPMP,
      prix_vente_detail: nouveauPrixVente,  // ← C'est cette ligne qui est importante !
      qte_stock: nouveauStock
    });

    // Enregistrer le mouvement
    await mouvementRepository.create({
      idProduit: data.idProduit,
      type_mouvement: 'ENTREE',
      quantite: data.quantite,
      stock_avant: stockAvant,
      stock_apres: nouveauStock,
      prix_unitaire: data.prix_achat,
      reference: data.reference_facture,
      notes: data.notes,
      idLot: idLot
    });

    return {
      success: true,
      message: `✅ ${data.quantite} unités ajoutées. Nouveau prix vente: ${nouveauPrixVente.toLocaleString()} F`,
      nouveauStock: nouveauStock,
      nouveauPMP: nouveauPMP,
      nouveauPrixVente: nouveauPrixVente
    };

  } catch (error) {
    console.error('Erreur entrée stock:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de l\'entrée de stock'
    };
  }
}

  // Sortie de stock (vente) - Méthode FIFO
  async sortieStock(data: SortieStockInput): Promise<ResultStock> {
    try {
      // 1. Vérifier le stock
      const product = await productRepository.getById(data.idProduit);
      if (!product) {
        return { success: false, message: 'Produit non trouvé' };
      }

      if (product.qte_stock < data.quantite) {
        return { 
          success: false, 
          message: `Stock insuffisant. Stock actuel: ${product.qte_stock}` 
        };
      }

      // 2. Récupérer les lots disponibles (FIFO - premier entré, premier sorti)
      const lots = await lotRepository.getAvailableLots(data.idProduit);
      let quantiteRestante = data.quantite;
      let coutTotalAchat = 0;
      const sortiesDetails: any[] = [];

      for (const lot of lots) {
        if (quantiteRestante <= 0) break;

        const quantiteSortie = Math.min(lot.quantite_restante, quantiteRestante);
        coutTotalAchat += quantiteSortie * lot.prix_achat_unitaire;

        // Mettre à jour le lot
        await lotRepository.updateLotQuantity(lot.idLot, quantiteSortie);

        sortiesDetails.push({
          idLot: lot.idLot,
          quantite: quantiteSortie,
          prixAchat: lot.prix_achat_unitaire,
          prixVenteLot: lot.prix_vente_unitaire,
          codeLot: lot.code_lot,
          dateEntree: lot.date_entree
        });

        quantiteRestante -= quantiteSortie;
      }

      // 3. Nouveau stock
      const nouveauStock = product.qte_stock - data.quantite;

      // 4. Enregistrer le mouvement
      const idMouvement = await mouvementRepository.create({
        idProduit: data.idProduit,
        type_mouvement: 'SORTIE',
        quantite: data.quantite,
        stock_avant: product.qte_stock,
        stock_apres: nouveauStock,
        prix_unitaire: data.prix_vente,
        reference: data.reference,
        notes: data.notes
      });

      // 5. Enregistrer les sorties par lot
      for (const sortie of sortiesDetails) {
        await lotRepository.createSortieLot({
          idLot: sortie.idLot,
          idMouvement: idMouvement,
          quantite_sortie: sortie.quantite,
          prix_vente_unitaire: data.prix_vente
        });
      }

      // 6. Mettre à jour le produit (uniquement le stock)
      await productRepository.update(data.idProduit, {
        qte_stock: nouveauStock
        // prix_vente_detail: NE PAS MODIFIER
      });

      // 7. Calculer le bénéfice
      const chiffreAffaire = data.quantite * data.prix_vente;
      const benefice = chiffreAffaire - coutTotalAchat;
      const margePourcentage = (benefice / coutTotalAchat) * 100;

      // 8. Déterminer quels lots ont été utilisés pour l'affichage
      const lotsUtilises = sortiesDetails.map(s => 
        `Lot ${s.codeLot} (${s.dateEntree}): ${s.quantite} x ${s.prixAchat.toLocaleString()} F`
      ).join('\n');

      return {
        success: true,
        message: `✅ Vente de ${data.quantite} unités. Bénéfice: ${benefice.toLocaleString()} F (${margePourcentage.toFixed(1)}%)\n${lotsUtilises}`,
        nouveauStock: nouveauStock,
        benefice: benefice,
        coutAchatTotal: coutTotalAchat
      };

    } catch (error) {
      console.error('Erreur sortie stock:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de la sortie de stock'
      };
    }
  }

  // Mettre à jour manuellement le prix de vente d'un produit
  async updatePrixVente(idProduit: number, nouveauPrixVente: number, motif: string): Promise<ResultStock> {
    try {
      const product = await productRepository.getById(idProduit);
      if (!product) {
        return { success: false, message: 'Produit non trouvé' };
      }

      const ancienPrixVente = product.prix_vente_detail;

      await productRepository.update(idProduit, {
        prix_vente_detail: nouveauPrixVente
      });

      // Enregistrer dans l'historique
      const db = await getDb();
      await db.execute(`
        INSERT INTO historique_prix (
          idProduit, date_changement, ancien_prix_vente, nouveau_prix_vente, motif
        ) VALUES (?, datetime('now'), ?, ?, ?)
      `, [idProduit, ancienPrixVente, nouveauPrixVente, motif]);

      return {
        success: true,
        message: `Prix de vente modifié: ${ancienPrixVente.toLocaleString()} F → ${nouveauPrixVente.toLocaleString()} F`,
        nouveauStock: product.qte_stock
      };

    } catch (error) {
      console.error('Erreur mise à jour prix vente:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de la mise à jour du prix'
      };
    }
  }

  // Obtenir le détail des lots d'un produit
  async getDetailsLots(idProduit: number): Promise<{
    lots: any[];
    stockTotal: number;
    pmp: number;
    prixVenteActuel: number;
  }> {
    const product = await productRepository.getById(idProduit);
    const lots = await lotRepository.getLotsByProduct(idProduit);
    const stats = await lotRepository.recalculerPMP(idProduit);

    return {
      lots: lots.map(lot => ({
        ...lot,
        valeur_totale: lot.quantite_restante * lot.prix_achat_unitaire
      })),
      stockTotal: stats.stockTotal,
      pmp: stats.pmp,
      prixVenteActuel: product?.prix_vente_detail || 0
    };
  }

  // Obtenir l'historique complet d'un produit
  async getHistoriqueComplet(idProduit: number): Promise<{
    produit: any;
    lots: any[];
    mouvements: any[];
    historiquePrix: any[];
  }> {
    const produit = await productRepository.getById(idProduit);
    const lots = await lotRepository.getLotsByProduct(idProduit);
    const mouvements = await mouvementRepository.getByProduct(idProduit);
    const historiquePrix = await lotRepository.getHistoriquePrix(idProduit);

    return {
      produit,
      lots,
      mouvements,
      historiquePrix
    };
  }

  // Obtenir les alertes de stock
  async getAlertesStock(): Promise<any[]> {
    return await productRepository.getStockAlert();
  }

  // Obtenir les statistiques des lots
  async getStatistiquesLots(): Promise<any> {
    return await lotRepository.getStatistiques();
  }
}

export const stockService = new StockService();