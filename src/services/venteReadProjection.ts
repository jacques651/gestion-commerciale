/** Projection autorisée en 3.7 : exclusivement SELECT/PRAGMA, aucune mutation des ventes. */
import type { TransactionContext, TransactionFilters, TransactionPagination, TransactionRef,
  TransactionServiceContract, TransactionView } from './transactionContracts.ts';
import { authorizeTransactionRead, readColumns, transactionReadSource, type TransactionReadSource } from './transactionReadSource.ts';
import { PrestationAdapterError } from './adapters/prestationPersistence.ts';
type SaleView = Extract<TransactionView, { origin: 'vente' }>;
interface SaleRow { idVente: number; code_vente: string; idClient: number | null; nom_prenom: string | null; contact: string | null;
  client_nom: string | null; client_contact: string | null; date_vente: string; montant_ttc: number; type_vente: string;
  observation: string | null; version?: number; updated_at?: string | null; est_annule?: number; date_annulation?: string | null; deleted_at?: string | null; }
interface SaleDetail { idDetail: number; idVente: number; idProduit: number; designation: string; quantite: number;
  prix_unitaire_ht: number; prix_unitaire_ttc: number; remise_percent: number; tva_taux: number; }
interface SalePayment { idVente: number; montant: number; statut: string; est_annule: number; }
interface SaleCash { idJournal: number; type_mouvement: string; montant: number; idReference: number | null; reference: string | null;
  origin?: string | null; origin_id?: number | null; idJournalContrepasse?: number | null; categorie: string; notes: string | null; }

export function createVenteReadProjection(source: TransactionReadSource = transactionReadSource): Pick<TransactionServiceContract, 'getView' | 'listView'> {
  async function load(ctx: TransactionContext): Promise<SaleView[]> {
    await authorizeTransactionRead(source, ctx);
    const rows = await source.select<SaleRow>(`SELECT v.*, c.NomComplet AS client_nom, c.Tel AS client_contact, c.Societe AS client_societe
      FROM ventes v LEFT JOIN clients c ON c.idClient=v.idClient ORDER BY v.date_vente DESC, v.idVente DESC`);
    if (!rows.length) return [];
    const details = await source.select<SaleDetail>(`SELECT d.*, COALESCE(p.designation,'Produit #' || d.idProduit) AS designation
      FROM vente_details d LEFT JOIN products p ON p.idProduit=d.idProduit ORDER BY d.idDetail`);
    const payments = await source.select<SalePayment>('SELECT idVente, montant, statut, est_annule FROM reglements WHERE idVente IS NOT NULL');
    const journal = await source.select<SaleCash>('SELECT * FROM journal_caisse');
    // Une référence historique exacte peut servir au rapprochement financier ; son origine en caisse reste inconnue.
    const codeCounts = new Map<string, number>();
    rows.forEach(row => codeCounts.set(row.code_vente, (codeCounts.get(row.code_vente) ?? 0) + 1));
    const [hasPrestations] = await source.select<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='ventes_prestations'");
    if (hasPrestations?.n) for (const row of await source.select<{ code_facture: string }>('SELECT code_facture FROM ventes_prestations')) {
      codeCounts.set(row.code_facture, (codeCounts.get(row.code_facture) ?? 0) + 1);
    }
    return rows.map(row => {
      const cash = journal.filter(entry => entry.origin === 'vente' ? entry.origin_id === row.idVente
        : !entry.origin && entry.idReference === row.idVente && entry.reference === row.code_vente && codeCounts.get(row.code_vente) === 1
          && (entry.categorie === 'VENTE_COMPTOIR' || (entry.type_mouvement === 'SORTIE' && entry.notes?.startsWith('CONTREPASSATION vente '))));
      const incoming = cash.filter(entry => entry.type_mouvement === 'ENTREE');
      const incomingIds = new Set(incoming.map(entry => entry.idJournal));
      const grossCash = incoming.reduce((sum, entry) => sum + Number(entry.montant), 0);
      const validPayments = payments.filter(payment => payment.idVente === row.idVente && !payment.est_annule && payment.statut !== 'ANNULE');
      // Les règlements et leur journal représentent le même encaissement : aucune addition entre ces deux sources.
      const gross = Math.max(grossCash, validPayments.reduce((sum, payment) => sum + Number(payment.montant), 0));
      const refunded = cash.filter(entry => entry.type_mouvement === 'SORTIE' &&
        (entry.idJournalContrepasse != null ? incomingIds.has(entry.idJournalContrepasse) : entry.reference === row.code_vente && entry.notes?.startsWith('CONTREPASSATION vente ')))
        .reduce((sum, entry) => sum + Number(entry.montant), 0);
      const cancelled = Boolean(row.est_annule); const total = Number(row.montant_ttc);
      const blocked = { autorisee: false, disponible: false, raisonBlocage: 'Utilisez les actions existantes de la vente.' };
      return { ref: { origin: 'vente', id: row.idVente }, origin: 'vente', code: row.code_vente, version: row.version ?? 1,
        client: { idClient: row.idClient, nom: row.client_nom ?? row.nom_prenom, contact: row.client_contact ?? row.contact },
        dates: { creation: row.date_vente, modification: row.updated_at ?? null, annulation: row.date_annulation ?? null, suppression: row.deleted_at ?? null },
        typeVente: row.type_vente, sourceVente: row, observations: row.observation, montantFacture: total, montantEncaisse: gross, montantRembourse: refunded,
        restantDu: cancelled ? 0 : Math.max(0, total - gross + refunded), etatCommercial: cancelled ? 'ANNULEE' : 'ACTIVE',
        etatPaiement: cancelled ? 'ANNULEE' : gross - refunded >= total ? 'PAYEE' : gross > refunded ? 'PARTIELLE' : 'IMPAYEE',
        lines: details.filter(line => line.idVente === row.idVente).map(line => {
          const ttc = line.quantite * line.prix_unitaire_ttc * (1 - (line.remise_percent ?? 0) / 100);
          return { origin: 'vente', idLigne: line.idDetail, idProduit: line.idProduit, designation: line.designation, quantite: line.quantite,
            prixUnitaireHt: line.prix_unitaire_ht, prixUnitaireTtc: line.prix_unitaire_ttc, remisePourcentage: line.remise_percent ?? 0,
            tauxTva: line.tva_taux ?? 0, totalHt: line.quantite * line.prix_unitaire_ht * (1 - (line.remise_percent ?? 0) / 100), totalTtc: ttc };
        }), documents: {}, actionsAutorisees: { modifier: blocked, annuler: blocked, supprimer: blocked } };
    });
  }
  return {
    async getView(ref: TransactionRef, ctx) {
      if (ref.origin !== 'vente' || !Number.isSafeInteger(ref.id) || ref.id <= 0) throw new PrestationAdapterError('INVALID_INPUT', 'Référence de vente invalide.');
      const row = (await load(ctx)).find(row => row.ref.id === ref.id);
      if (!row || (row.dates.suppression && ctx.role !== 'admin')) throw new PrestationAdapterError('NOT_FOUND', 'Vente introuvable.');
      return row;
    },
    async listView(filters: TransactionFilters, pagination: TransactionPagination, ctx) {
      if (filters.origin !== 'vente' || !Number.isSafeInteger(pagination.page) || pagination.page < 1
        || !Number.isSafeInteger(pagination.pageSize) || pagination.pageSize < 1 || pagination.pageSize > 100) {
        throw new PrestationAdapterError('INVALID_INPUT', 'Origine ou pagination invalide.');
      }
      if (filters.afficherSupprimees && ctx.role !== 'admin') throw new PrestationAdapterError('FORBIDDEN', 'Consultation des éléments masqués réservée aux administrateurs.');
      const query = filters.recherche?.trim().toLocaleLowerCase();
      const rows = (await load(ctx)).filter(row => (filters.afficherSupprimees || !row.dates.suppression)
        && (!filters.etatCommercial || row.etatCommercial === filters.etatCommercial)
        && (!filters.etatPaiement || row.etatPaiement === filters.etatPaiement)
        && (filters.clientId === undefined || row.client.idClient === filters.clientId)
        && (!filters.dateDebut || row.dates.creation.slice(0, 10) >= filters.dateDebut)
        && (!filters.dateFin || row.dates.creation.slice(0, 10) <= filters.dateFin)
        && (!query || [row.code, row.client.nom, row.client.contact, ...row.lines.map(line => line.designation)].join(' ').toLocaleLowerCase().includes(query)));
      return { ...pagination, total: rows.length, items: rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize) };
    },
  };
}
