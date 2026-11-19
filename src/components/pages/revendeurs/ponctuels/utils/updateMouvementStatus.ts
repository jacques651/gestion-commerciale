// src/components/pages/revendeurs/ponctuels/utils/updateMouvementStatus.ts

interface MouvementData {
  quantite_sortie: number;
  quantite_retournee: number;
  quantite_vendue: number;
  quantite_perdue: number;
}

/**
 * Calcule le statut d'un mouvement en fonction des quantités
 * Cycle de vie : OUVERT → (RETOURS/VENTES) → CLOTURE
 */
export const calculateMouvementStatus = (data: MouvementData): {
  statut: 'OUVERT' | 'CLOTURE' | 'PARTIELLEMENT_RETOURNE' | 'PARTIELLEMENT_VENDU';
  quantite_restante: number;
  quantite_traitee: number;
} => {
  const { quantite_sortie, quantite_retournee, quantite_vendue, quantite_perdue } = data;
  
  const quantite_traitee = quantite_retournee + quantite_vendue + quantite_perdue;
  const quantite_restante = quantite_sortie - quantite_traitee;

  // Si tout est traité, mouvement clôturé
  if (quantite_restante <= 0) {
    return { statut: 'CLOTURE', quantite_restante: 0, quantite_traitee };
  }

  // Si rien n'est traité, mouvement ouvert
  if (quantite_traitee === 0) {
    return { statut: 'OUVERT', quantite_restante, quantite_traitee };
  }

  // Si des retours ont été effectués
  if (quantite_retournee > 0 && quantite_vendue === 0 && quantite_perdue === 0) {
    return { statut: 'PARTIELLEMENT_RETOURNE', quantite_restante, quantite_traitee };
  }

  // Si des ventes ont été effectuées
  if (quantite_vendue > 0 && quantite_retournee === 0 && quantite_perdue === 0) {
    return { statut: 'PARTIELLEMENT_VENDU', quantite_restante, quantite_traitee };
  }

  // Si des retours ET des ventes ont été effectués
  if (quantite_retournee > 0 && quantite_vendue > 0) {
    return { statut: 'PARTIELLEMENT_RETOURNE', quantite_restante, quantite_traitee };
  }

  // Cas par défaut
  return { statut: 'OUVERT', quantite_restante, quantite_traitee };
};

/**
 * Met à jour le statut d'un mouvement et enregistre l'historique
 */
export const updateMouvementStatus = async (
  db: any,
  idMouvement: number,
  idUtilisateur?: number
): Promise<void> => {
  // Récupérer les quantités
  const mouvement = await db.select(`
    SELECT quantite_sortie FROM mouvements_revendeurs WHERE idMouvement = ?
  `, [idMouvement]) as any[];

  const evenements = await db.select(`
    SELECT type_evenement, quantite FROM mouvement_evenements WHERE idMouvement = ?
  `, [idMouvement]) as any[];

  const quantite_sortie = mouvement[0]?.quantite_sortie || 0;
  let quantite_retournee = 0;
  let quantite_vendue = 0;
  let quantite_perdue = 0;

  for (const e of evenements) {
    if (e.type_evenement === 'RETOUR') quantite_retournee += e.quantite;
    if (e.type_evenement === 'VENTE') quantite_vendue += e.quantite;
    if (e.type_evenement === 'PERTE') quantite_perdue += e.quantite;
  }

  const { statut } = calculateMouvementStatus({
    quantite_sortie,
    quantite_retournee,
    quantite_vendue,
    quantite_perdue
  });

  // Récupérer l'ancien statut
  const oldStatus = await db.select(`
    SELECT statut FROM mouvements_revendeurs WHERE idMouvement = ?
  `, [idMouvement]) as any[];

  const ancienStatut = oldStatus[0]?.statut || 'OUVERT';

  // Mettre à jour le statut
  await db.execute(`
    UPDATE mouvements_revendeurs 
    SET statut = ?, 
        date_cloture = CASE WHEN ? = 'CLOTURE' THEN datetime('now') ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE idMouvement = ?
  `, [statut, statut, idMouvement]);

  // Enregistrer le changement d'état si différent
  if (ancienStatut !== statut) {
    await db.execute(`
      INSERT INTO mouvement_etats (
        idMouvement, ancien_statut, nouveau_statut, raison, idUtilisateur
      ) VALUES (?, ?, ?, 'Mise à jour automatique du statut', ?)
    `, [idMouvement, ancienStatut, statut, idUtilisateur || null]);
  }
};