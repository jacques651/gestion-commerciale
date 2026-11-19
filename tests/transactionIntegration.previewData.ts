import type { TransactionView, CancellationResult } from '../src/services/transactionContracts';
import type { TransactionJournalView, TransactionActivity } from '../src/services/transactionReadSource';
const today = new Date().toISOString().slice(0, 10);
export const previewUser = { id:1,nom:'Administrateur test',login:'test',role:'admin' as const,est_actif:1,permissions:[],created_at:today };
const allowed = {autorisee:true,disponible:true,raisonBlocage:null};
export const previewSaleSource = {idVente:1,code_vente:'VEN-TEST-1',idClient:null,client_nom:'Client vente',nom_prenom:'Client vente',contact:null,Tel:null,
  date_vente:today+' 10:00:00',montant_ht:200,montant_tva:0,montant_ttc:200,montant_total:200,type_vente:'COMPTOIR',observation:null,est_annule:0};
export const previewRows: TransactionView[] = [
  {origin:'vente',ref:{origin:'vente',id:1},code:'VEN-TEST-1',version:1,client:{idClient:null,nom:'Client vente',contact:null},
    dates:{creation:today+' 10:00:00',modification:null,annulation:null,suppression:null},lines:[],montantFacture:200,montantEncaisse:200,montantRembourse:0,
    restantDu:0,etatCommercial:'ACTIVE',etatPaiement:'PAYEE',observations:null,documents:{},actionsAutorisees:{modifier:allowed,annuler:allowed,supprimer:allowed}},
  {origin:'prestation',ref:{origin:'prestation',id:1},code:'PRE-TEST-1',version:1,client:{idClient:null,nom:'Client prestation',contact:null},
    dates:{creation:today+' 11:00:00',modification:null,annulation:null,suppression:null},
    lines:[{origin:'prestation',designation:'Réparation',quantite:1,prixUnitaire:100,unite:'prestation'}],montantFacture:100,montantEncaisse:40,montantRembourse:0,
    restantDu:60,etatCommercial:'ACTIVE',etatPaiement:'PARTIELLE',observations:null,documents:{},actionsAutorisees:{modifier:allowed,annuler:allowed,
      supprimer:{autorisee:true,disponible:false,raisonBlocage:'Un règlement existe.'}}},
  {origin:'prestation',ref:{origin:'prestation',id:2},code:'PRE-TEST-2',version:2,client:{idClient:null,nom:'Client annulé',contact:null},
    dates:{creation:today+' 12:00:00',modification:null,annulation:today,suppression:null},
    lines:[{origin:'prestation',designation:'Service annulé',quantite:1,prixUnitaire:50,unite:'prestation'}],montantFacture:50,montantEncaisse:50,montantRembourse:50,
    restantDu:0,etatCommercial:'ANNULEE',etatPaiement:'ANNULEE',observations:null,documents:{},actionsAutorisees:{modifier:{...allowed,disponible:false,raisonBlocage:'Déjà annulée.'},
      annuler:{...allowed,disponible:false,raisonBlocage:'Déjà annulée.'},supprimer:{...allowed,disponible:false,raisonBlocage:'Déjà annulée.'}}},
];
export const previewJournal: TransactionJournalView[] = [
  {idJournal:1,code_journal:'JRN-VENTE',date_journal:today+' 10:00:00',type_mouvement:'ENTREE',categorie:'VENTE_COMPTOIR',montant:200,
    designation:'Vente produits',reference:'VEN-TEST-1',idReference:1,origin:'vente',origin_id:1,idJournalContrepasse:null,operation:{origin:'vente',id:1},contrepassationId:null,nom_utilisateur:'Administrateur test'},
  {idJournal:2,code_journal:'JRN-PRESTATION',date_journal:today+' 11:00:00',type_mouvement:'ENTREE',categorie:'VENTE_COMPTOIR',montant:40,
    designation:'Prestation réparation',reference:'PRE-TEST-1',idReference:1,origin:'prestation',origin_id:1,idJournalContrepasse:null,operation:{origin:'prestation',id:1},contrepassationId:null,nom_utilisateur:'Administrateur test'},
  {idJournal:3,code_journal:'JRN-ORIGINAL',date_journal:today+' 12:00:00',type_mouvement:'ENTREE',categorie:'VENTE_COMPTOIR',montant:50,
    designation:'Prestation annulée',reference:'PRE-TEST-2',idReference:2,origin:'prestation',origin_id:2,idJournalContrepasse:null,operation:{origin:'prestation',id:2},contrepassationId:4,nom_utilisateur:'Administrateur test'},
  {idJournal:4,code_journal:'JRN-CONTREPASSATION',date_journal:today+' 12:30:00',type_mouvement:'SORTIE',categorie:'AUTRE_SORTIE',montant:50,
    designation:'Remboursement prestation',reference:'PRE-TEST-2',idReference:2,origin:'prestation',origin_id:2,idJournalContrepasse:3,operation:{origin:'prestation',id:2},contrepassationId:null,nom_utilisateur:'Administrateur test'},
  {idJournal:5,code_journal:'JRN-INCONNU',date_journal:today+' 09:00:00',type_mouvement:'ENTREE',categorie:'AUTRE_ENTREE',montant:10,
    designation:'Ancienne écriture sans origine',reference:null,idReference:null,origin:null,origin_id:null,idJournalContrepasse:null,operation:null,contrepassationId:null,nom_utilisateur:null},
];
export const previewActivity: TransactionActivity[] = ['create','update','cancel','delete'].map((action,index)=>({idOperation:index+1,operation_key:'test-'+index,
  origin:'prestation',origin_id:1,action,date_operation:today+' 13:00:00',motif:action==='cancel'?'Erreur de saisie':action==='delete'?'Doublon':null,
  description:({create:'Création',update:'Modification',cancel:'Annulation',delete:'Masquage'} as Record<string,string>)[action]+' de PRE-TEST-1',acteur:'Administrateur test',code:'PRE-TEST-1'}));
export const previewCancellations = new Map<string,CancellationResult>();
export function fixtureView(row:TransactionView):TransactionView {
  return row.origin==='vente'?Object.assign(structuredClone(row),{typeVente:'COMPTOIR',sourceVente:previewSaleSource}):structuredClone(row);
}
export const previewSession = {idSession:1,code_session:'SESSION-TEST',idUtilisateur:1,nom_operateur:'Administrateur test',nom_utilisateur:'Administrateur test',
  date_ouverture:today+' 08:00:00',date_fermeture:null,statut:'OUVERTE',solde_initial:0,solde_ouverture:0,solde_calcule:250,solde_declare:null,ecart:0,total_entrees:300,total_sorties:50};
