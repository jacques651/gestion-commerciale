// src/services/StockRevendeurService.ts
//
// SERVICE UNIQUE ET TRANSACTIONNEL du stock revendeur.
// Chaque mouvement (entrée, sortie, ajustement) met à jour `stock_revendeur`
// ET écrit un mouvement dans `mouvements_revendeur`, dans UNE seule transaction,
// avec trace d'audit. Le stock et son historique ne peuvent plus diverger.
//
// Convention de signe (compatible avec l'existant et le contrôle de cohérence) :
//   quantité stockée en MAGNITUDE ; le TYPE indique le sens
//   (ENTREE/ANNULATION_DECOMPTE/AJUSTEMENT_ENTREE = +,
//    DECOMPTE/SORTIE/AJUSTEMENT_SORTIE = -).
import { getDb } from "../database/db";
import { revendeurAuditService } from "./revendeurAuditService";

export interface MouvementOptions {
  /** Libellé du mouvement (défaut : 'ENTREE' ou 'SORTIE' selon le sens). */
  typeMouvement?: string;
  idCommande?: number | null;
  idDecompte?: number | null;
  prixUnitaire?: number;
  prixVente?: number;
  codeFacture?: string | null;
  motif?: string;
  utilisateur?: string;
}

export default class StockRevendeurService {

  /** Cœur transactionnel : applique un delta signé au stock + écrit le mouvement. */
  private static async _appliquer(
    idRevendeur: number,
    idProduit: number,
    delta: number,               // signé (+ entrée, - sortie)
    sens: "ENTREE" | "SORTIE",
    opts: MouvementOptions = {}
  ): Promise<void> {
    const db = await getDb();
    const q = Math.abs(delta);
    if (q === 0) return;
    const type = opts.typeMouvement || sens;

    // Transaction propre SI aucune n'est déjà active. Si un appelant a déjà
    // ouvert une transaction (BEGIN échoue), on s'y insère sans la gérer.
    let ownTx = false;
    try { await db.execute("BEGIN TRANSACTION"); ownTx = true; } catch { ownTx = false; }
    try {
      const ex = await db.select<any[]>(
        `SELECT idStockRevendeur FROM stock_revendeur WHERE idRevendeur = ? AND idProduit = ?`,
        [idRevendeur, idProduit]
      );
      if (ex.length > 0) {
        await db.execute(
          `UPDATE stock_revendeur SET qte_stock = qte_stock + ? WHERE idRevendeur = ? AND idProduit = ?`,
          [delta, idRevendeur, idProduit]
        );
      } else {
        await db.execute(
          `INSERT INTO stock_revendeur (idProduit, idRevendeur, qte_stock, prix_achat, prix_vente, commission_pourcentage)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [idProduit, idRevendeur, delta, opts.prixUnitaire ?? 0, opts.prixVente ?? 0]
        );
      }
      await db.execute(
        `INSERT INTO mouvements_revendeur
           (idProduit, idRevendeur, idCommande, idDecompte, type_mouvement, qte_mouvement, prix_unitaire, code_facture, date_mouvement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [idProduit, idRevendeur, opts.idCommande ?? null, opts.idDecompte ?? null, type, q, opts.prixUnitaire ?? 0, opts.codeFacture ?? null]
      );
      if (ownTx) await db.execute("COMMIT");
    } catch (e) {
      if (ownTx) { try { await db.execute("ROLLBACK"); } catch { /* ignore */ } }
      throw e;
    }

    try {
      await revendeurAuditService.tracer({
        action: `STOCK_${type}`,
        entite: "STOCK",
        idRevendeur,
        details: { idProduit, sens, quantite: q, type, motif: opts.motif, par: opts.utilisateur },
      });
    } catch { /* audit non bloquant */ }
  }

  /** Entrée de stock revendeur (transfert reçu, réappro, correction +). */
  static async increaseStock(
    idRevendeur: number,
    idProduit: number,
    quantite: number,
    opts: MouvementOptions = {}
  ): Promise<void> {
    await this._appliquer(idRevendeur, idProduit, Math.abs(Number(quantite) || 0), "ENTREE",
      { typeMouvement: "ENTREE", ...opts });
  }

  /** Sortie de stock revendeur (vente/décompte, correction −). */
  static async decreaseStock(
    idRevendeur: number,
    idProduit: number,
    quantite: number,
    opts: MouvementOptions = {}
  ): Promise<void> {
    const db = await getDb();
    const stock = await db.select<any[]>(
      `SELECT qte_stock FROM stock_revendeur WHERE idRevendeur = ? AND idProduit = ?`,
      [idRevendeur, idProduit]
    );
    if (!stock.length) throw new Error("Produit absent du stock revendeur");
    if (Number(stock[0].qte_stock) < Math.abs(Number(quantite) || 0)) {
      throw new Error("Stock revendeur insuffisant");
    }
    await this._appliquer(idRevendeur, idProduit, -Math.abs(Number(quantite) || 0), "SORTIE",
      { typeMouvement: "SORTIE", ...opts });
  }

  /**
   * Ajuste le stock d'un produit à une NOUVELLE quantité cible (inventaire /
   * correction manuelle) : calcule le delta et applique un mouvement tracé.
   */
  static async ajuster(
    idRevendeur: number,
    idProduit: number,
    nouvelleQuantite: number,
    motif: string,
    utilisateur?: string
  ): Promise<void> {
    const db = await getDb();
    const cur = await db.select<any[]>(
      `SELECT qte_stock FROM stock_revendeur WHERE idRevendeur = ? AND idProduit = ?`,
      [idRevendeur, idProduit]
    );
    const actuel = cur.length ? Number(cur[0].qte_stock) || 0 : 0;
    const delta = (Number(nouvelleQuantite) || 0) - actuel;
    if (delta === 0) return;
    await this._appliquer(idRevendeur, idProduit, delta, delta > 0 ? "ENTREE" : "SORTIE", {
      typeMouvement: delta > 0 ? "AJUSTEMENT_ENTREE" : "AJUSTEMENT_SORTIE",
      motif,
      utilisateur,
    });
  }
}
