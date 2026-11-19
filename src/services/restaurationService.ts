// src/services/restaurationService.ts
// Restauration de la base de l'ancienne version (GestionPro.exe, mode web uniquement).
// Le serveur detecte lui-meme les emplacements ; aucun chemin n'est envoye depuis le navigateur.
import type { TransactionContext } from './transactionContracts';

export interface AncienneBase {
  id: string;
  chemin: string;
  taille: number;
  modifie: string;
  compteurs: Record<string, number>;
  valide: boolean;
  vide: boolean;
  erreur: string | null;
}

export interface EtatRestauration {
  baseVide: boolean;
  candidats: AncienneBase[];
}

export interface ResultatRestauration {
  ok: true;
  source: string;
  compteurs: Record<string, number>;
  sauvegarde: string;
}

/** La restauration au demarrage de l'application Tauri reste geree par legacy_db.rs. */
export const restaurationDisponible = (): boolean =>
  typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

async function appel<T>(route: string, corps: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env?.VITE_API_TOKEN) headers['x-gc-token'] = env.VITE_API_TOKEN;
  const reponse = await fetch(`${env?.VITE_API_BASE ?? ''}/api/restauration/${route}`, {
    method: 'POST', headers, body: JSON.stringify(corps),
  });
  let donnees: unknown = null;
  try { donnees = await reponse.json(); } catch { /* reponse sans corps */ }
  if (!reponse.ok) {
    const message = (donnees as { error?: string } | null)?.error;
    throw new Error(message || `Erreur serveur (${reponse.status})`);
  }
  return donnees as T;
}

export const restaurationService = {
  etat: (ctx: TransactionContext) => appel<EtatRestauration>('etat', { ctx }),
  appliquer: (id: string, ctx: TransactionContext) => appel<ResultatRestauration>('appliquer', { id, ctx }),
};

const LIBELLES: Record<string, string> = {
  ventes: 'ventes', clients: 'clients', produits: 'produits', commandes: 'commandes', factures: 'factures',
};

export function resumeContenu(compteurs: Record<string, number>): string {
  const parties = Object.entries(compteurs).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${LIBELLES[t] ?? t}`);
  return parties.length ? parties.join(' · ') : 'Aucune donnée';
}

export function tailleLisible(octets: number): string {
  return octets >= 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export const dateLisible = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
