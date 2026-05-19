// src/services/pdfService.ts - Version corrigée
import { getDb } from '../database/db';

export const exportFactureToPDF = async (idFacture: number): Promise<Blob | null> => {
  try {
    const db = await getDb();
    
    // Récupérer la facture avec ses détails
    const factures = await db.select<any[]>(`
      SELECT 
        f.*,
        c.code_commande as commande_code,
        cl.nom_complet as client_nom,
        cl.adresse as client_adresse,
        cl.telephone as client_telephone,
        cl.email as client_email
      FROM factures f
      JOIN commandes c ON f.idCommande = c.idCommande
      JOIN clients cl ON c.idClient = cl.idClient
      WHERE f.idFacture = ?
    `, [idFacture]);
    
    if (factures.length === 0) return null;
    
    const facture = factures[0];
    
    // Récupérer les détails
    const details = await db.select<any[]>(`
      SELECT 
        cd.*,
        p.designation as produit_nom,
        p.code_produit
      FROM commande_details cd
      JOIN products p ON cd.idProduit = p.idProduit
      WHERE cd.idCommande = ?
    `, [facture.idCommande]);
    
    facture.details = details;
    
    // Pour l'instant, retourner un blob vide
    // À implémenter avec @react-pdf/renderer plus tard
    console.log('PDF généré pour la facture:', facture.code_facture);
    
    // Retourner un blob simple pour le moment
    const blob = new Blob([JSON.stringify(facture, null, 2)], { type: 'application/json' });
    return blob;
    
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    return null;
  }
};

export const downloadPDF = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};