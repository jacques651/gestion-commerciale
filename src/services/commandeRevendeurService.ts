// src/services/commandeRevendeurService.ts
import { getDb } from '../database/db';
import StockRevendeurService from './StockRevendeurService';
import { generateCommandeCode, generateFactureCode } from '../utils/codeGenerator';
import { confirm } from '../utils/confirm';
import { revendeurAuditService } from './revendeurAuditService';

export interface PanierItem {
  idProduit: number;
  designation: string;
  code_produit: string;
  categorie: string;
  unite_mesure: string;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  total: number;
}

export const enregistrerCommandeRevendeur = async (
  idClient: number,
  dateCommande: Date,
  panier: PanierItem[],
  montantHT: number,
  montantTTC: number,
  typeCommande: string
): Promise<{ idCommande: number; codeFacture: string | null }> => {
  const db = await getDb();
  let transactionStarted = false;
  let idCommande: number = 0; // Initialiser avec une valeur par défaut

  try {
    await db.execute('BEGIN TRANSACTION');
    transactionStarted = true;

    // 1. Générer le code commande
    const codeCommande = await generateCommandeCode();

    // 2. Insérer la commande
    const result = await db.execute(`
      INSERT INTO commandes (
        code_commande,
        idClient,
        date_commande,
        montant_ht,
        montant_ttc,
        type_commande,
        statut
      ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMEE')
    `, [
      codeCommande,
      idClient,
      dateCommande.toISOString().split('T')[0],
      montantHT,
      montantTTC,
      typeCommande
    ]);

    // CORRECTION: S'assurer que lastInsertId est un nombre
    idCommande = result.lastInsertId ? Number(result.lastInsertId) : 0;
    
    if (idCommande === 0) {
      throw new Error('Impossible de récupérer l\'ID de la commande');
    }

    // 3. Pour chaque produit : entrée de stock revendeur via le SERVICE unique
    //    transactionnel (stock + mouvement + audit, atomiques).
    for (const item of panier) {
      await StockRevendeurService.increaseStock(idClient, item.idProduit, item.quantite, {
        typeMouvement: 'ENTREE',
        idCommande,
        prixUnitaire: item.prix_achat,
        prixVente: item.prix_vente,
      });

      // Le transfert n'est validé que si le stock central couvre la quantité demandée.
      const stockGeneral = await db.execute(`
        UPDATE products
        SET qte_stock = qte_stock - ?
        WHERE idProduit = ? AND qte_stock >= ?
      `, [item.quantite, item.idProduit, item.quantite]);

      if (stockGeneral.rowsAffected !== 1) {
        throw new Error(`Stock général insuffisant pour « ${item.designation} ».`);
      }
    }

    // 4. Proposition de génération de facture
    let codeFacture: string | null = null;
    const reponse = await confirm("Voulez-vous générer une facture pour cette commande ?", "Génération facture");
    
    if (reponse) {
      codeFacture = await generateFactureCode();
      
      // Mettre à jour la commande
      await db.execute(`
        UPDATE commandes SET code_facture = ?, date_facture = date('now')
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);
      
      // Le code facture est porté par la commande et les mouvements
      // (stock_revendeur ne stocke pas de code_facture : source unique de solde).
      await db.execute(`
        UPDATE mouvements_revendeur SET code_facture = ?
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);
    }

    await revendeurAuditService.tracer({
      action: 'CREATION_COMMANDE',
      entite: 'STOCK',
      idRevendeur: idClient,
      idReference: idCommande,
      details: {
        codeCommande,
        codeFacture,
        lignes: panier.length,
        montantTTC,
        typeCommande,
      },
    });

    await db.execute('COMMIT');
    transactionStarted = false;

    return { idCommande, codeFacture };
    
  } catch (error) {
    if (transactionStarted) {
      try { await db.execute('ROLLBACK'); } catch (_) {}
    }
    throw error;
  }
};
