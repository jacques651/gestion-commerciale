/** SQL simulé en mémoire pour le rendu des écrans historiques. Aucune connexion ni base réelle. */
import { previewJournal, previewSaleSource, previewSession, previewUser } from './transactionIntegration.previewData';
export async function getDb(){return {
  async select<T>(query:string,params:unknown[]=[]):Promise<T>{
    let rows:unknown[]=[];
    if(/PRAGMA table_info/i.test(query))rows=[...Object.keys(previewJournal[0]),'mode_paiement','mode_paiement_detail','idSession','idUtilisateur','solde_initial','solde_apres'].map(name=>({name}));
    else if(/sqlite_master/i.test(query))rows=/COUNT/i.test(query)?[{n:1,count:1,total:1}]:[{name:'journal_caisse'}];
    else if(/FROM utilisateurs/i.test(query))rows=[{...previewUser,role:'ADMIN'}];
    else if(/FROM journal_caisse/i.test(query)){
      if(/COUNT\(/i.test(query))rows=[{n:previewJournal.length,count:previewJournal.length,total:previewJournal.length}];
      else if(/SUM\(/i.test(query))rows=[{solde:250,total:250,total_entrees:300,total_sorties:50}];
      else if(/date\(date_journal\) </i.test(query))rows=[];
      else rows=previewJournal.filter(row=>!query.includes('j.origin = ?')||!params.length||row.origin===params[params.length-1]).map((row,index)=>({...row,
        solde_apres:[200,240,290,240,250][index],idSession:1,idUtilisateur:1,mode_paiement:'ESPECES',mode_paiement_detail:'Espèces',created_at:row.date_journal,report:0}));
    }else if(/FROM sessions_caisse/i.test(query))rows=[previewSession];
    else if(/FROM moyens_paiement/i.test(query))rows=[{id:1,code:'ESPECES',libelle:'Espèces',categorie:'ESPECES',est_actif:1,est_systeme:1,ordre:1}];
    else if(/FROM configuration_atelier/i.test(query))rows=[{nom_atelier:'Banc isolé'}];
    else if(/FROM config_parametres/i.test(query))rows=[{valeur:'A4'}];
    else if(/FROM ventes\b/i.test(query)&&!/SUM\(|COUNT\(/i.test(query))rows=[{...previewSaleSource,id:1,date:previewSaleSource.date_vente,code:previewSaleSource.code_vente,
      montant:200,who:previewSaleSource.client_nom,annule:0}];
    else if(/GROUP BY/i.test(query))rows=[];
    else if(/SUM\(|COUNT\(|AVG\(/i.test(query))rows=[{total:0,nb:0,count:0,benefice:0,couts:0,n:0,ca:0,cout:0}];
    return structuredClone(rows) as T;
  },
  async execute(){return {rowsAffected:0,lastInsertId:0};},async close(){return true;}
};}
export async function initDatabase(){return getDb();}
