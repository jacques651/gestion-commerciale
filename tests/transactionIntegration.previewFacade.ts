import type { TransactionContext, TransactionServiceContract } from '../src/services/transactionContracts';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence';
import { readAllTransactions } from '../src/services/transactionConsolidation';
import { fixtureView, previewActivity, previewCancellations, previewJournal, previewRows } from './transactionIntegration.previewData';
export * from '../src/services/transactionContracts';
const base:TransactionServiceContract={
  async listView(filters,pagination) {
    const rows=previewRows.filter(row=>row.origin===filters.origin&&(filters.afficherSupprimees||!row.dates.suppression)
      &&(!filters.dateDebut||row.dates.creation.slice(0,10)>=filters.dateDebut)&&(!filters.dateFin||row.dates.creation.slice(0,10)<=filters.dateFin)
      &&(!filters.etatCommercial||row.etatCommercial===filters.etatCommercial)&&(!filters.etatPaiement||row.etatPaiement===filters.etatPaiement)
      &&(!filters.recherche||[row.code,row.client.nom,...row.lines.map(line=>line.designation)].join(' ').toLowerCase().includes(filters.recherche.toLowerCase())));
    return {...pagination,total:rows.length,items:rows.slice((pagination.page-1)*pagination.pageSize,pagination.page*pagination.pageSize).map(fixtureView)};
  },
  async getView(ref) {const row=previewRows.find(row=>row.ref.id===ref.id&&row.origin===ref.origin);if(!row)throw new Error('Introuvable');return fixtureView(row);},
  async create(){throw new Error('Création hors de ce banc de lecture');},
  async update(ref,modifications,version){const row=previewRows.find(row=>row.ref.id===ref.id&&row.origin===ref.origin)!;
    if(row.version!==version)throw new PrestationAdapterError('VERSION_CONFLICT','Conflit');
    if(modifications.origin==='prestation'&&row.origin==='prestation'&&modifications.lines)row.lines=modifications.lines;
    row.observations=modifications.observations??row.observations;row.version++;return fixtureView(row);},
  async cancel(ref,motif,treatment,key){const existing=previewCancellations.get(key);if(existing)return existing;
    const row=previewRows.find(row=>row.ref.id===ref.id&&row.origin===ref.origin)!;row.etatCommercial='ANNULEE';row.etatPaiement='ANNULEE';row.montantRembourse=treatment.montantRembourse;row.restantDu=0;
    const result={success:true,ref,motif,montantRembourse:treatment.montantRembourse,ecritureContrepasseId:6,ecrituresContrepasseIds:[6]};previewCancellations.set(key,result);return result;},
  async delete(ref){const row=previewRows.find(row=>row.ref.id===ref.id&&row.origin===ref.origin)!;row.dates.suppression=new Date().toISOString();return {success:true,ref,mode:'soft'};},
};
export const transactionService={...base,
  listAll:(filters:Parameters<typeof readAllTransactions>[1],ctx:TransactionContext)=>readAllTransactions(base,filters,ctx),
  async readJournal(ids:readonly number[]){return previewJournal.filter(row=>ids.includes(row.idJournal));},
  async readPrestationActivity(){return previewActivity;},
};
