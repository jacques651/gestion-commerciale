// src/services/commandeRevendeurService.ts
import { getDb } from '../database/db';
import { generateCommandeCode, generateFactureCode } from '../utils/codeGenerator';

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

    // 3. Pour chaque produit, mettre à jour le stock revendeur
    for (const item of panier) {
      // Vérifier si le produit existe déjà dans le stock du revendeur
      const existing = await db.select<any[]>(`
        SELECT idProduitRevendeur, qte_stock 
        FROM produits_revendeur 
        WHERE idProduit = ? AND idRevendeur = ?
      `, [item.idProduit, idClient]);

      const dateEntree = dateCommande.toISOString().split('T')[0];

      if (existing.length === 0) {
        // Insertion d'un nouveau produit revendeur
        await db.execute(`
          INSERT INTO produits_revendeur (
            idCommande, idProduit, code_produit, categorie, 
            designation, unite_mesure, qte_stock, prix_achat, 
            prix_vente, idRevendeur, date_entree
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idCommande,
          item.idProduit,
          item.code_produit,
          item.categorie || '',
          item.designation,
          item.unite_mesure || 'pièce',
          item.quantite,
          item.prix_achat,
          item.prix_vente,
          idClient,
          dateEntree
        ]);
      } else {
        // Mise à jour du stock existant
        await db.execute(`
          UPDATE produits_revendeur 
          SET qte_stock = qte_stock + ?, idCommande = ?
          WHERE idProduit = ? AND idRevendeur = ?
        `, [item.quantite, idCommande, item.idProduit, idClient]);
      }

      // Enregistrer le mouvement d'entrée
      await db.execute(`
        INSERT INTO mouvements_revendeur (
          date_mouvement, idProduit, idRevendeur, 
          type_mouvement, qte_mouvement, prix_unitaire, idCommande
        ) VALUES (?, ?, ?, 'ENTREE', ?, ?, ?)
      `, [
        dateEntree,
        item.idProduit,
        idClient,
        item.quantite,
        item.prix_achat,
        idCommande
      ]);

      // Mettre à jour le stock général
      await db.execute(`
        UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?
      `, [item.quantite, item.idProduit]);
    }

    // 4. Proposition de génération de facture
    let codeFacture: string | null = null;
    const reponse = confirm("Voulez-vous générer une facture pour cette commande ?");
    
    if (reponse) {
      codeFacture = await generateFactureCode();
      
      // Mettre à jour la commande
      await db.execute(`
        UPDATE commandes SET code_facture = ?, date_facture = date('now')
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);
      
      // Mettre à jour produits_revendeur
      await db.execute(`
        UPDATE produits_revendeur SET code_facture = ?
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);
      
      // Mettre à jour mouvements_revendeur
      await db.execute(`
        UPDATE mouvements_revendeur SET code_facture = ?
        WHERE idCommande = ?
      `, [codeFacture, idCommande]);
    }

    await db.execute('COMMIT');
    transactionStarted = false;

    return { idCommande, codeFacture };
    
  } catch (error) {
    if (transactionStarted) {
      await db.execute('ROLLBACK');
    }
    throw error;
  }
};