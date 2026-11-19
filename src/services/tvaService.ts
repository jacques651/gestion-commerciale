// src/services/tvaService.ts
// ============================================================================
// SOURCE DE VÉRITÉ UNIQUE POUR LA TVA
// ----------------------------------------------------------------------------
// Historiquement la TVA était stockée à 3 endroits différents :
//   1. config_parametres      (categorie='TVA', code_param='tva_actif')  <- écrit par ParametresTVA
//   2. configuration_atelier.tva_active                                  <- lu par les factures
//   3. config_generale.taux_tva_default                                  <- le taux
// Résultat : désactiver la TVA dans les paramètres n'avait aucun effet sur les
// factures standards et les reçus.
//
// Ce service centralise la lecture/écriture. L'écriture met TOUS les
// emplacements en cohérence, la lecture applique un ordre de priorité stable.
// ============================================================================

import { getDb } from '../database/db';

export interface TVAConfig {
  /** TVA activée ou non */
  active: boolean;
  /** Taux en pourcentage (ex: 18 pour 18 %) */
  taux: number;
}

export const TVA_DEFAULT: TVAConfig = { active: true, taux: 18 };

/** Cache mémoire pour éviter de requêter la base à chaque ligne de facture. */
let cache: TVAConfig | null = null;

export const tvaService = {
  /** Invalide le cache (à appeler après toute écriture). */
  invalidate(): void {
    cache = null;
  },

  /**
   * Lit la configuration TVA effective.
   * Priorité : config_parametres > configuration_atelier > défaut.
   */
  async get(force = false): Promise<TVAConfig> {
    if (cache && !force) return cache;

    try {
      const db = await getDb();

      // --- Taux ---
      let taux = TVA_DEFAULT.taux;
      try {
        const g = await db.select<any[]>(
          `SELECT taux_tva_default FROM config_generale WHERE id_config = 1`
        );
        const v = Number(g?.[0]?.taux_tva_default);
        if (Number.isFinite(v) && v >= 0) taux = v;
      } catch {
        /* table absente : on garde le défaut */
      }

      // --- Activation : priorité 1, config_parametres ---
      let active: boolean | null = null;
      try {
        const p = await db.select<any[]>(
          `SELECT valeur FROM config_parametres
           WHERE categorie = 'TVA' AND code_param = 'tva_actif'`
        );
        if (p && p.length > 0 && p[0].valeur != null && p[0].valeur !== '') {
          active = String(p[0].valeur) !== '0';
        }
      } catch {
        /* ignore */
      }

      // --- Activation : priorité 2, configuration_atelier ---
      if (active === null) {
        try {
          const a = await db.select<any[]>(
            `SELECT tva_active FROM configuration_atelier WHERE id = 1`
          );
          if (a && a.length > 0 && a[0].tva_active != null) {
            active = Number(a[0].tva_active) === 1;
          }
        } catch {
          /* ignore */
        }
      }

      cache = {
        active: active === null ? TVA_DEFAULT.active : active,
        taux,
      };
      return cache;
    } catch (error) {
      console.error('Erreur lecture configuration TVA:', error);
      return { ...TVA_DEFAULT };
    }
  },

  /**
   * Écrit la configuration TVA en synchronisant TOUS les emplacements de stockage.
   */
  async set(active: boolean, taux?: number): Promise<void> {
    const db = await getDb();

    // 1. Taux dans config_generale
    if (taux !== undefined && Number.isFinite(taux)) {
      await db.execute(
        `UPDATE config_generale SET taux_tva_default = ? WHERE id_config = 1`,
        [taux]
      );
    }

    // 2. Activation dans config_parametres
    await db.execute(
      `INSERT INTO config_parametres (categorie, code_param, valeur, type_valeur, description)
       VALUES ('TVA', 'tva_actif', ?, 'boolean', 'Activation de la TVA')
       ON CONFLICT(categorie, code_param) DO UPDATE SET valeur = excluded.valeur`,
      [active ? '1' : '0']
    );

    // 3. Activation dans configuration_atelier (lu par les documents imprimés)
    try {
      const exists = await db.select<any[]>(
        `SELECT id FROM configuration_atelier WHERE id = 1`
      );
      if (exists && exists.length > 0) {
        await db.execute(
          `UPDATE configuration_atelier SET tva_active = ? WHERE id = 1`,
          [active ? 1 : 0]
        );
      } else {
        await db.execute(
          `INSERT INTO configuration_atelier (id, tva_active) VALUES (1, ?)`,
          [active ? 1 : 0]
        );
      }
    } catch (e) {
      console.error('Erreur synchronisation tva_active (configuration_atelier):', e);
    }

    tvaService.invalidate();
  },

  /**
   * Calcule la ventilation HT / TVA / TTC à partir d'un montant hors taxe,
   * en respectant la configuration courante.
   */
  async ventilerDepuisHT(montantHT: number): Promise<{ ht: number; tva: number; ttc: number; taux: number; active: boolean }> {
    const cfg = await tvaService.get();
    const tva = cfg.active ? montantHT * (cfg.taux / 100) : 0;
    return { ht: montantHT, tva, ttc: montantHT + tva, taux: cfg.taux, active: cfg.active };
  },

  /**
   * Calcule la ventilation à partir d'un montant TTC (prix affichés TTC).
   */
  async ventilerDepuisTTC(montantTTC: number): Promise<{ ht: number; tva: number; ttc: number; taux: number; active: boolean }> {
    const cfg = await tvaService.get();
    if (!cfg.active) {
      return { ht: montantTTC, tva: 0, ttc: montantTTC, taux: cfg.taux, active: false };
    }
    const ht = montantTTC / (1 + cfg.taux / 100);
    return { ht, tva: montantTTC - ht, ttc: montantTTC, taux: cfg.taux, active: true };
  },

  /**
   * Normalise les factures quand la TVA est DÉSACTIVÉE : met montant_ttc = montant_ht
   * (et montant_tva = 0). Corrige les anciennes factures dont le TTC a été stocké
   * gonflé (× 1,18) alors que la TVA ne doit pas s'appliquer. Idempotent et sans
   * effet si la TVA est active.
   */
  async normaliserFacturesSiDesactivee(): Promise<boolean> {
    const cfg = await tvaService.get(true);
    if (cfg.active) return false;
    const db = await getDb();
    try {
      await db.execute(`UPDATE factures SET montant_tva = 0, montant_ttc = montant_ht WHERE montant_ttc <> montant_ht`);
    } catch { /* ignore */ }
    try {
      await db.execute(`UPDATE factures_revendeur SET montant_ttc = montant_ht WHERE montant_ttc <> montant_ht`);
    } catch { /* ignore */ }
    try {
      await db.execute(`UPDATE factures_approvisionnement SET montant_ttc = montant_ht WHERE montant_ttc <> montant_ht`);
    } catch { /* ignore */ }
    return true;
  },
};

export default tvaService;
