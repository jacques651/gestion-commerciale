// src/services/licenceService.ts
// ─── Système de licence : période d'essai 60 jours + activation définitive ───
//
// COMMENT ÇA MARCHE :
//   1. À chaque installation chez un client, allez dans Admin → Licence.
//   2. Dans la section "Configuration développeur", entrez votre mot de passe
//      développeur et définissez le code d'activation unique du client.
//   3. Donnez ce code au client pour qu'il puisse activer son application.
//   Écran verrouillé : saisir le mot de passe développeur comme code rend
//   l'installation définitive.
//
// MOT DE PASSE DÉVELOPPEUR : commun à toutes les installations, il n'est jamais
// écrit en clair. Seule son empreinte salée (config/developpeur.json) est
// embarquée. Pour le changer : Changer-mot-de-passe-developpeur.bat, puis build.bat.
//
// Le code client est stocké dans la base de données SQLite de la machine.
// ─────────────────────────────────────────────────────────────────────────────

import { getDb } from '../database/db';
import { sha256Hex } from '../utils/sha256';

// Mot de passe réservé au développeur, comparé par empreinte (insensible à la casse).
function estMotDePasseDeveloppeur(saisie: string): boolean {
  const sel = typeof __GC_DEV_SEL__ !== 'undefined' ? __GC_DEV_SEL__ : '';
  const empreinte = typeof __GC_DEV_EMPREINTE__ !== 'undefined' ? __GC_DEV_EMPREINTE__ : '';
  if (!sel || !empreinte) return false;
  return sha256Hex(sel + saisie.trim().toUpperCase()) === empreinte;
}

export const TRIAL_DAYS = 60;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LicenceStatus {
  statut: 'ACTIF' | 'EXPIRE' | 'DEFINITIF';
  joursRestants: number;
  firstLaunchDate: string;
  licenceType: 'BETA' | 'DEFINITIF';
  message: string;
  codeClientConfigured: boolean; // indique si un code a été configuré pour ce client
}

// ─── Service ──────────────────────────────────────────────────────────────────
class LicenceService {

  /** Enregistre la date du premier lancement si ce n'est pas encore fait */
  async initialiserLicence(): Promise<void> {
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(`SELECT id FROM licence_application WHERE id = 1`);
      if (rows.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        await db.execute(
          `INSERT INTO licence_application (id, first_launch_date, licence_type, statut)
           VALUES (1, ?, 'BETA', 'ACTIF')`,
          [today]
        );
        console.log(`Premier lancement enregistré : ${today}`);
      }
    } catch (error) {
      console.error('Erreur initialiserLicence:', error);
    }
  }

  /** Vérifie le statut courant de la licence */
  async verifierLicence(): Promise<LicenceStatus> {
    try {
      const db = await getDb();
      await this.initialiserLicence();

      const rows = await db.select<any[]>(`SELECT * FROM licence_application WHERE id = 1`);
      if (rows.length === 0) {
        return this._statusActif(TRIAL_DAYS, new Date().toISOString().split('T')[0], false);
      }

      const licence = rows[0];
      const codeClientConfigured = !!licence.valid_activation_key;
      // Lire la durée d'essai depuis la DB (fallback : constante TRIAL_DAYS)
      const trialDays: number = licence.trial_days ?? TRIAL_DAYS;

      // Version définitive → toujours active
      if (licence.licence_type === 'DEFINITIF') {
        return {
          statut: 'DEFINITIF',
          joursRestants: 9999,
          firstLaunchDate: licence.first_launch_date,
          licenceType: 'DEFINITIF',
          message: 'Version définitive activée',
          codeClientConfigured
        };
      }

      // Date de premier lancement — normalisée (corrige les valeurs nulles/invalides qui donnaient NaN)
      let firstLaunchStr: string = licence.first_launch_date;
      if (!firstLaunchStr || isNaN(new Date(firstLaunchStr + 'T00:00:00').getTime())) {
        firstLaunchStr = new Date().toISOString().split('T')[0];
        try { await db.execute(`UPDATE licence_application SET first_launch_date = ? WHERE id = 1`, [firstLaunchStr]); } catch (_) {}
      }
      const firstLaunch = new Date(firstLaunchStr + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysElapsed = Math.floor((today.getTime() - firstLaunch.getTime()) / msPerDay);
      const joursRestants = Number.isFinite(daysElapsed) ? Math.max(0, trialDays - daysElapsed) : trialDays;

      if (joursRestants <= 0) {
        try {
          await db.execute(`UPDATE licence_application SET statut = 'EXPIRE' WHERE id = 1`);
        } catch (_) {}
        return {
          statut: 'EXPIRE',
          joursRestants: 0,
          firstLaunchDate: firstLaunchStr,
          licenceType: 'BETA',
          message: `Votre période d'essai de ${trialDays} jours est expirée. Activez la version définitive pour continuer.`,
          codeClientConfigured
        };
      }

      const msg = joursRestants <= 7
        ? `Version bêta — plus que ${joursRestants} jour(s) d'essai !`
        : `Version bêta — ${joursRestants} jour(s) restant(s)`;

      return this._statusActif(joursRestants, firstLaunchStr, codeClientConfigured, msg);

    } catch (error) {
      console.error('Erreur verifierLicence:', error);
      return this._statusActif(TRIAL_DAYS, new Date().toISOString().split('T')[0], false);
    }
  }

  /**
   * Active la version définitive avec le code fourni par le développeur.
   * Compare le code saisi par le client avec le code stocké en base de données.
   */
  async activerLicence(key: string): Promise<{ success: boolean; message: string }> {
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) {
      return { success: false, message: 'Veuillez entrer un code d\'activation.' };
    }

    // Déblocage développeur : le mot de passe développeur saisi comme code rend
    // l'installation définitive (même effet que « Rendre définitive » dans Admin → Licence).
    // Indispensable quand l'application est verrouillée et qu'aucun code client n'a été configuré.
    if (estMotDePasseDeveloppeur(cleanKey)) {
      return this.activerDefinitifDev(cleanKey);
    }

    try {
      const db = await getDb();
      const rows = await db.select<any[]>(`SELECT valid_activation_key FROM licence_application WHERE id = 1`);
      const validKey = rows[0]?.valid_activation_key?.trim().toUpperCase();

      if (!validKey) {
        return {
          success: false,
          message: 'Aucun code d\'activation configuré pour cette application. Contactez votre revendeur.'
        };
      }

      if (cleanKey !== validKey) {
        return { success: false, message: 'Code d\'activation invalide. Vérifiez le code ou contactez votre revendeur.' };
      }

      await db.execute(
        `UPDATE licence_application SET licence_key = ?, licence_type = 'DEFINITIF', statut = 'ACTIF' WHERE id = 1`,
        [cleanKey]
      );

      console.log(`Licence activée avec succès.`);
      return { success: true, message: 'Application activée avec succès ! Bienvenue dans la version définitive.' };

    } catch (error) {
      console.error('Erreur activerLicence:', error);
      return { success: false, message: "Erreur lors de l'activation. Réessayez." };
    }
  }

  /**
   * RÉSERVÉ AU DÉVELOPPEUR.
   * Définit le code d'activation unique de ce client dans la base de données.
   * Nécessite le mot de passe développeur.
   */
  async configurerCleClient(
    motDePasseDev: string,
    nouvelleClé: string
  ): Promise<{ success: boolean; message: string }> {
    if (!estMotDePasseDeveloppeur(motDePasseDev)) {
      return { success: false, message: 'Mot de passe développeur incorrect.' };
    }

    const cleFormatée = nouvelleClé.trim().toUpperCase();
    if (cleFormatée.length < 6) {
      return { success: false, message: 'Le code doit contenir au moins 6 caractères.' };
    }

    try {
      const db = await getDb();

      // Si déjà en DEFINITIF, ne pas réinitialiser le statut
      const rows = await db.select<any[]>(`SELECT licence_type FROM licence_application WHERE id = 1`);
      const isDefinitif = rows[0]?.licence_type === 'DEFINITIF';

      let sql = `UPDATE licence_application SET valid_activation_key = ?`;
      if (!isDefinitif) {
        sql += `, licence_key = NULL, licence_type = 'BETA', statut = 'ACTIF'`;
      }
      sql += ` WHERE id = 1`;
      await db.execute(sql, [cleFormatée]);

      console.log(`Code client configuré.`);
      return {
        success: true,
        message: `Code configuré : ${cleFormatée}\n\nDonnez ce code au client pour activer son application.`
      };
    } catch (error) {
      console.error('Erreur configurerCleClient:', error);
      return { success: false, message: 'Erreur lors de la configuration. Réessayez.' };
    }
  }

  /** DÉVELOPPEUR — Récupère toutes les infos licence (nécessite le mot de passe dev) */
  async getLicenceDevInfo(masterKey: string): Promise<{
    success: boolean;
    message?: string;
    data?: {
      statut: string;
      licenceType: string;
      firstLaunchDate: string;
      validActivationKey: string | null;
      licenceKeyUsed: string | null;
      joursRestants: number;
      trialDays: number;
      createdAt: string;
    };
  }> {
    if (!estMotDePasseDeveloppeur(masterKey)) {
      return { success: false, message: 'Mot de passe développeur incorrect.' };
    }
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(`SELECT * FROM licence_application WHERE id = 1`);
      if (rows.length === 0) return { success: false, message: 'Aucune entrée licence trouvée.' };
      const row = rows[0];
      const firstLaunch = new Date(row.first_launch_date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysElapsed = Math.floor((today.getTime() - firstLaunch.getTime()) / 86400000);
      const trialDays: number = row.trial_days ?? TRIAL_DAYS;
      const joursRestants = Number.isFinite(daysElapsed) ? Math.max(0, trialDays - daysElapsed) : trialDays;
      return {
        success: true,
        data: {
          statut: row.statut,
          licenceType: row.licence_type,
          firstLaunchDate: row.first_launch_date,
          validActivationKey: row.valid_activation_key || null,
          licenceKeyUsed: row.licence_key || null,
          joursRestants,
          trialDays,
          createdAt: row.created_at
        }
      };
    } catch {
      return { success: false, message: 'Erreur lecture base de données.' };
    }
  }

  /** DÉVELOPPEUR — Réinitialise la licence en mode BÊTA */
  async resetLicence(masterKey: string): Promise<{ success: boolean; message: string }> {
    if (!estMotDePasseDeveloppeur(masterKey)) {
      return { success: false, message: 'Mot de passe développeur incorrect.' };
    }
    try {
      const db = await getDb();
      await db.execute(
        `UPDATE licence_application SET licence_type='BETA', statut='ACTIF', licence_key=NULL WHERE id=1`
      );
      return { success: true, message: 'Licence réinitialisée en mode BÊTA.' };
    } catch {
      return { success: false, message: 'Erreur lors de la réinitialisation.' };
    }
  }

  /** DÉVELOPPEUR — Rend DIRECTEMENT cette installation définitive (raccourci 1 clic) */
  async activerDefinitifDev(masterKey: string): Promise<{ success: boolean; message: string }> {
    if (!estMotDePasseDeveloppeur(masterKey)) {
      return { success: false, message: 'Mot de passe développeur incorrect.' };
    }
    try {
      const db = await getDb();
      await this.initialiserLicence();
      await db.execute(`UPDATE licence_application SET licence_type='DEFINITIF', statut='ACTIF' WHERE id=1`);
      return { success: true, message: 'Cette installation est maintenant DÉFINITIVE (aucune expiration).' };
    } catch {
      return { success: false, message: "Erreur lors de l'activation définitive." };
    }
  }

  /** DÉVELOPPEUR — Modifie la durée d'essai (en jours) */
  async configurerDureeEssai(masterKey: string, jours: number): Promise<{ success: boolean; message: string }> {
    if (!estMotDePasseDeveloppeur(masterKey)) {
      return { success: false, message: 'Mot de passe développeur incorrect.' };
    }
    if (!Number.isInteger(jours) || jours < 1 || jours > 3650) {
      return { success: false, message: 'Durée invalide (1 à 3650 jours).' };
    }
    try {
      const db = await getDb();
      await db.execute(`UPDATE licence_application SET trial_days = ? WHERE id = 1`, [jours]);
      // Réactiver la licence si elle était expirée (recalcul au prochain verifierLicence)
      await db.execute(`UPDATE licence_application SET statut = 'ACTIF' WHERE id = 1 AND licence_type = 'BETA'`);
      return { success: true, message: `Durée d'essai configurée à ${jours} jour(s).` };
    } catch {
      return { success: false, message: 'Erreur lors de la configuration.' };
    }
  }

  private _statusActif(joursRestants: number, firstLaunchDate: string, codeClientConfigured: boolean, message?: string): LicenceStatus {
    return {
      statut: 'ACTIF',
      joursRestants,
      firstLaunchDate,
      licenceType: 'BETA',
      message: message ?? `Version bêta — ${joursRestants} jour(s) restant(s)`,
      codeClientConfigured
    };
  }
}

export const licenceService = new LicenceService();
