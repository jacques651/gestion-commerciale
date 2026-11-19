// src/database/repositories/temporaryResellerRepository.ts

import { getDb } from '../db';

export interface TemporaryReseller {
  idRevendeurPonctuel: number;
  nom_complet: string;
  telephone: string;
  email?: string;
  adresse?: string;
  piece_identite?: string;
  numero_piece?: string;
  date_inscription: string;
  est_actif: number;
  notes?: string;
}

export interface Borrow {
  idEmprunt: number;
  code_emprunt: string;
  idRevendeurPonctuel: number;
  date_emprunt: string;
  date_retour_prevue?: string;
  date_retour_effective?: string;
  statut: 'EN_COURS' | 'RETOURNE' | 'PARTIELLEMENT_RETOURNE' | 'VENDU' | 'PERDU';
  montant_total_emprunte: number;
  montant_total_retourne: number;
  notes?: string;
  idUtilisateur?: number;
  nom_revendeur?: string;
  telephone_revendeur?: string;
}

export interface BorrowDetail {
  idEmpruntDetail: number;
  idEmprunt: number;
  idProduit: number;
  quantite_empruntee: number;
  quantite_retournee: number;
  quantite_vendue: number;
  prix_vente_unitaire: number;
  prix_achat_base: number;
  date_retour?: string;
  notes?: string;
  designation?: string;
  code_produit?: string;
}

export interface CreateBorrowInput {
  idRevendeurPonctuel: number;
  date_retour_prevue?: string;
  notes?: string;
  idUtilisateur?: number;
}

class TemporaryResellerRepository {
  
  // ==================== REVENDEURS ====================
  
  async createReseller(data: Omit<TemporaryReseller, 'idRevendeurPonctuel' | 'date_inscription'>): Promise<number> {
    const db = await getDb();
    const result = await db.execute(`
      INSERT INTO revendeurs_ponctuels (
        nom_complet, telephone, email, adresse,
        piece_identite, numero_piece, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.nom_complet,
      data.telephone,
      data.email || null,
      data.adresse || null,
      data.piece_identite || null,
      data.numero_piece || null,
      data.notes || null
    ]);
    return Number(result.lastInsertId);
  }

  async getAllResellers(actifOnly: boolean = true): Promise<TemporaryReseller[]> {
    const db = await getDb();
    const query = actifOnly 
      ? 'SELECT * FROM revendeurs_ponctuels WHERE est_actif = 1 ORDER BY nom_complet ASC'
      : 'SELECT * FROM revendeurs_ponctuels ORDER BY nom_complet ASC';
    return await db.select<TemporaryReseller[]>(query);
  }

  async getResellerById(id: number): Promise<TemporaryReseller | null> {
    const db = await getDb();
    const result = await db.select<TemporaryReseller[]>(
      'SELECT * FROM revendeurs_ponctuels WHERE idRevendeurPonctuel = ?',
      [id]
    );
    return result.length > 0 ? result[0] : null;
  }

  async updateReseller(id: number, data: Partial<TemporaryReseller>): Promise<void> {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['nom_complet', 'telephone', 'email', 'adresse', 'piece_identite', 'numero_piece', 'est_actif', 'notes'];
    for (const key of allowedFields) {
      if (data[key as keyof TemporaryReseller] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key as keyof TemporaryReseller]);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE revendeurs_ponctuels SET ${fields.join(', ')} WHERE idRevendeurPonctuel = ?`,
      values
    );
  }

  async deleteReseller(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      'UPDATE revendeurs_ponctuels SET est_actif = 0 WHERE idRevendeurPonctuel = ?',
      [id]
    );
  }

  // ==================== EMPRUNTS ====================

  private async generateBorrowCode(db: any): Promise<string> {
    const count = await db.select('SELECT COUNT(*) as count FROM emprunts_revendeurs');
    const num = ((count as any[])[0]?.count || 0) + 1;
    return `EMP-${String(num).padStart(4, '0')}`;
  }

  async createBorrow(
    data: CreateBorrowInput,
    details: Omit<BorrowDetail, 'idEmpruntDetail' | 'idEmprunt'>[]
  ): Promise<number> {
    const db = await getDb();
    
    // Générer le code
    const code = await this.generateBorrowCode(db);

    // Calculer le montant total
    const montantTotal = details.reduce((sum, d) => sum + (d.quantite_empruntee * d.prix_vente_unitaire), 0);

    // Créer l'emprunt
    const result = await db.execute(`
      INSERT INTO emprunts_revendeurs (
        code_emprunt, idRevendeurPonctuel, date_retour_prevue,
        montant_total_emprunte, montant_total_retourne, statut,
        notes, idUtilisateur
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code,
      data.idRevendeurPonctuel,
      data.date_retour_prevue || null,
      montantTotal,
      0, // montant_total_retourne initial
      'EN_COURS', // statut initial
      data.notes || null,
      data.idUtilisateur || null
    ]);

    const idEmprunt = Number(result.lastInsertId);

    // Créer les détails et enregistrer les mouvements de stock
    for (const detail of details) {
      // Vérifier le stock
      const stock = await this.getProductStock(detail.idProduit);
      const quantiteEnPieces = detail.quantite_empruntee;
      
      if (stock < quantiteEnPieces) {
        throw new Error(`Stock insuffisant pour le produit ${detail.idProduit}. Disponible: ${stock}, Demandé: ${quantiteEnPieces}`);
      }

      // Insérer le détail
      await db.execute(`
        INSERT INTO emprunt_details (
          idEmprunt, idProduit, quantite_empruntee,
          prix_vente_unitaire, prix_achat_base, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        idEmprunt,
        detail.idProduit,
        detail.quantite_empruntee,
        detail.prix_vente_unitaire,
        detail.prix_achat_base || 0,
        detail.notes || null
      ]);

      // Enregistrer le mouvement de stock (sortie)
      const stockAvant = stock;
      const stockApres = stockAvant - quantiteEnPieces;

      // Mettre à jour le stock du produit
      await db.execute(
        'UPDATE products SET qte_stock = ? WHERE idProduit = ?',
        [stockApres, detail.idProduit]
      );

      // Enregistrer le mouvement
      await db.execute(`
        INSERT INTO mouvements_revendeurs_ponctuels (
          idEmprunt, idProduit, type_mouvement,
          quantite, stock_avant, stock_apres,
          prix_unitaire, notes, idUtilisateur
        ) VALUES (?, ?, 'SORTIE_EMPRUNT', ?, ?, ?, ?, ?, ?)
      `, [
        idEmprunt,
        detail.idProduit,
        detail.quantite_empruntee,
        stockAvant,
        stockApres,
        detail.prix_vente_unitaire,
        detail.notes || null,
        data.idUtilisateur || null
      ]);
    }

    return idEmprunt;
  }

  async getAllBorrows(filters?: {
    statut?: string;
    dateDebut?: string;
    dateFin?: string;
    idRevendeur?: number;
  }): Promise<(Borrow & { nom_revendeur: string; telephone_revendeur: string })[]> {
    const db = await getDb();
    let query = `
      SELECT 
        e.*,
        r.nom_complet as nom_revendeur,
        r.telephone as telephone_revendeur
      FROM emprunts_revendeurs e
      JOIN revendeurs_ponctuels r ON e.idRevendeurPonctuel = r.idRevendeurPonctuel
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.statut && filters.statut !== 'TOUS') {
      query += ' AND e.statut = ?';
      params.push(filters.statut);
    }

    if (filters?.dateDebut) {
      query += ' AND date(e.date_emprunt) >= ?';
      params.push(filters.dateDebut);
    }

    if (filters?.dateFin) {
      query += ' AND date(e.date_emprunt) <= ?';
      params.push(filters.dateFin);
    }

    if (filters?.idRevendeur) {
      query += ' AND e.idRevendeurPonctuel = ?';
      params.push(filters.idRevendeur);
    }

    query += ' ORDER BY e.date_emprunt DESC';

    return await db.select<any[]>(query, params);
  }

  async getBorrowById(id: number): Promise<(Borrow & { nom_revendeur: string; telephone_revendeur: string }) | null> {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT 
        e.*,
        r.nom_complet as nom_revendeur,
        r.telephone as telephone_revendeur
      FROM emprunts_revendeurs e
      JOIN revendeurs_ponctuels r ON e.idRevendeurPonctuel = r.idRevendeurPonctuel
      WHERE e.idEmprunt = ?
    `, [id]);
    return result.length > 0 ? result[0] : null;
  }

  async getBorrowDetails(idEmprunt: number): Promise<(BorrowDetail & { designation: string; code_produit: string })[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT 
        ed.*,
        p.designation,
        p.code_produit
      FROM emprunt_details ed
      JOIN products p ON ed.idProduit = p.idProduit
      WHERE ed.idEmprunt = ?
    `, [idEmprunt]);
  }

  // ==================== RETOURS ====================

  async retournerProduits(
    idEmprunt: number,
    retours: { idEmpruntDetail: number; quantite: number; prixVente?: number }[],
    idUtilisateur?: number
  ): Promise<void> {
    const db = await getDb();

    for (const retour of retours) {
      // Récupérer le détail
      const detail = await db.select<any[]>(
        'SELECT * FROM emprunt_details WHERE idEmpruntDetail = ? AND idEmprunt = ?',
        [retour.idEmpruntDetail, idEmprunt]
      );

      if (!detail.length) {
        throw new Error(`Détail d'emprunt ${retour.idEmpruntDetail} introuvable`);
      }

      const d = detail[0];
      const quantiteRestante = d.quantite_empruntee - d.quantite_retournee - d.quantite_vendue;

      if (retour.quantite > quantiteRestante) {
        throw new Error(`Quantité de retour trop élevée. Restant: ${quantiteRestante}`);
      }

      // Mettre à jour le détail
      const nouvelleQuantiteRetournee = d.quantite_retournee + retour.quantite;
      await db.execute(`
        UPDATE emprunt_details 
        SET quantite_retournee = ?
        WHERE idEmpruntDetail = ?
      `, [nouvelleQuantiteRetournee, retour.idEmpruntDetail]);

      // Récupérer le stock actuel du produit
      const stockActuel = await this.getProductStock(d.idProduit);
      const nouveauStock = stockActuel + retour.quantite;

      // Mettre à jour le stock du produit
      await db.execute(
        'UPDATE products SET qte_stock = ? WHERE idProduit = ?',
        [nouveauStock, d.idProduit]
      );

      // Enregistrer le mouvement
      await db.execute(`
        INSERT INTO mouvements_revendeurs_ponctuels (
          idEmprunt, idProduit, type_mouvement,
          quantite, stock_avant, stock_apres,
          prix_unitaire, notes, idUtilisateur
        ) VALUES (?, ?, 'RETOUR', ?, ?, ?, ?, ?, ?)
      `, [
        idEmprunt,
        d.idProduit,
        retour.quantite,
        stockActuel,
        nouveauStock,
        retour.prixVente || d.prix_vente_unitaire,
        `Retour de ${retour.quantite} unités`,
        idUtilisateur || null
      ]);

      // Calculer le montant total retourné
      await this.updateBorrowTotals(idEmprunt);
    }

    // Mettre à jour le statut de l'emprunt
    await this.updateBorrowStatus(idEmprunt);
  }

  // ==================== VENTES ====================

  async vendreProduits(
    idEmprunt: number,
    ventes: { idEmpruntDetail: number; quantite: number; prixVente: number }[],
    idUtilisateur?: number
  ): Promise<{ total: number; details: any[] }> {
    const db = await getDb();
    let totalVentes = 0;
    const detailsVentes = [];

    for (const vente of ventes) {
      // Récupérer le détail
      const detail = await db.select<any[]>(
        'SELECT * FROM emprunt_details WHERE idEmpruntDetail = ? AND idEmprunt = ?',
        [vente.idEmpruntDetail, idEmprunt]
      );

      if (!detail.length) {
        throw new Error(`Détail d'emprunt ${vente.idEmpruntDetail} introuvable`);
      }

      const d = detail[0];
      const quantiteRestante = d.quantite_empruntee - d.quantite_retournee - d.quantite_vendue;

      if (vente.quantite > quantiteRestante) {
        throw new Error(`Quantité de vente trop élevée. Restant: ${quantiteRestante}`);
      }

      // Mettre à jour le détail
      const nouvelleQuantiteVendue = d.quantite_vendue + vente.quantite;
      await db.execute(`
        UPDATE emprunt_details 
        SET quantite_vendue = ?
        WHERE idEmpruntDetail = ?
      `, [nouvelleQuantiteVendue, vente.idEmpruntDetail]);

      // Enregistrer le mouvement
      await db.execute(`
        INSERT INTO mouvements_revendeurs_ponctuels (
          idEmprunt, idProduit, type_mouvement,
          quantite, stock_avant, stock_apres,
          prix_unitaire, notes, idUtilisateur
        ) VALUES (?, ?, 'VENTE', ?, ?, ?, ?, ?, ?)
      `, [
        idEmprunt,
        d.idProduit,
        vente.quantite,
        d.quantite_empruntee - d.quantite_retournee - nouvelleQuantiteVendue + vente.quantite,
        d.quantite_empruntee - d.quantite_retournee - nouvelleQuantiteVendue,
        vente.prixVente,
        `Vente de ${vente.quantite} unités par revendeur ponctuel`,
        idUtilisateur || null
      ]);

      totalVentes += vente.quantite * vente.prixVente;
      detailsVentes.push({
        idProduit: d.idProduit,
        quantite: vente.quantite,
        prixVente: vente.prixVente,
        total: vente.quantite * vente.prixVente
      });
    }

    // Mettre à jour les totaux et le statut
    await this.updateBorrowTotals(idEmprunt);
    await this.updateBorrowStatus(idEmprunt);

    return { total: totalVentes, details: detailsVentes };
  }

  // ==================== UTILITAIRES ====================

  private async getProductStock(idProduit: number): Promise<number> {
    const db = await getDb();
    const result = await db.select<any[]>(
      'SELECT qte_stock FROM products WHERE idProduit = ?',
      [idProduit]
    );
    return result.length > 0 ? Number(result[0].qte_stock) : 0;
  }

  private async updateBorrowTotals(idEmprunt: number): Promise<void> {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT 
        SUM(quantite_empruntee * prix_vente_unitaire) as total_emprunte,
        SUM(quantite_retournee * prix_vente_unitaire) as total_retourne
      FROM emprunt_details
      WHERE idEmprunt = ?
    `, [idEmprunt]);

    if (result.length > 0) {
      await db.execute(`
        UPDATE emprunts_revendeurs 
        SET 
          montant_total_emprunte = ?,
          montant_total_retourne = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE idEmprunt = ?
      `, [
        result[0].total_emprunte || 0,
        result[0].total_retourne || 0,
        idEmprunt
      ]);
    }
  }

  private async updateBorrowStatus(idEmprunt: number): Promise<void> {
    const db = await getDb();
    const details = await db.select<any[]>(
      'SELECT quantite_empruntee, quantite_retournee, quantite_vendue FROM emprunt_details WHERE idEmprunt = ?',
      [idEmprunt]
    );

    let totalEmprunte = 0;
    let totalRetourne = 0;
    let totalVendu = 0;

    for (const d of details) {
      totalEmprunte += d.quantite_empruntee;
      totalRetourne += d.quantite_retournee;
      totalVendu += d.quantite_vendue;
    }

    let statut = 'EN_COURS';
    if (totalRetourne + totalVendu === 0) {
      statut = 'EN_COURS';
    } else if (totalRetourne + totalVendu === totalEmprunte) {
      statut = totalVendu > 0 ? 'VENDU' : 'RETOURNE';
    } else if (totalRetourne + totalVendu < totalEmprunte && totalRetourne + totalVendu > 0) {
      statut = 'PARTIELLEMENT_RETOURNE';
    }

    await db.execute(`
      UPDATE emprunts_revendeurs 
      SET statut = ?, updated_at = CURRENT_TIMESTAMP
      WHERE idEmprunt = ?
    `, [statut, idEmprunt]);
  }

  async getBorrowStats(idRevendeur?: number): Promise<{
    totalEmprunts: number;
    enCours: number;
    retournes: number;
    vendus: number;
    montantTotalEmprunte: number;
    montantTotalRetourne: number;
  }> {
    const db = await getDb();
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'EN_COURS' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'RETOURNE' THEN 1 ELSE 0 END) as retournes,
        SUM(CASE WHEN statut = 'VENDU' THEN 1 ELSE 0 END) as vendus,
        SUM(montant_total_emprunte) as total_emprunte,
        SUM(montant_total_retourne) as total_retourne
      FROM emprunts_revendeurs
    `;
    const params: any[] = [];

    if (idRevendeur) {
      query += ' WHERE idRevendeurPonctuel = ?';
      params.push(idRevendeur);
    }

    const result = await db.select<any[]>(query, params);
    return result.length > 0 ? {
      totalEmprunts: result[0].total || 0,
      enCours: result[0].en_cours || 0,
      retournes: result[0].retournes || 0,
      vendus: result[0].vendus || 0,
      montantTotalEmprunte: result[0].total_emprunte || 0,
      montantTotalRetourne: result[0].total_retourne || 0
    } : {
      totalEmprunts: 0,
      enCours: 0,
      retournes: 0,
      vendus: 0,
      montantTotalEmprunte: 0,
      montantTotalRetourne: 0
    };
  }

  async getMouvementsByReseller(idRevendeur: number): Promise<any[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT 
        m.*,
        e.code_emprunt,
        e.date_emprunt,
        p.designation,
        p.code_produit
      FROM mouvements_revendeurs_ponctuels m
      JOIN emprunts_revendeurs e ON m.idEmprunt = e.idEmprunt
      JOIN products p ON m.idProduit = p.idProduit
      WHERE e.idRevendeurPonctuel = ?
      ORDER BY m.date_mouvement DESC
    `, [idRevendeur]);
  }
}

export const temporaryResellerRepository = new TemporaryResellerRepository();