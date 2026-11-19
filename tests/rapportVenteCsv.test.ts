import { test, assert } from './helpers/prestationFixture.ts';
import { construireRapportCsv } from '../src/services/rapportVenteCsv.ts';
import type { RapportVente } from '../src/services/rapportVenteService.ts';
function report():RapportVente {
  return {libellePeriode:'Test isolé',operateurNom:'Opérateur test',codeSession:null,statutSession:null,dateOuverture:null,dateFermeture:null,
    report:10,mouvements:[{origin:'vente',date_journal:'2026-11-18',designation:'Vente test',type_mouvement:'ENTREE',categorie:'VENTE_COMPTOIR',
      mode_paiement:'ESPECES',montant:200,solde_apres:210,reference:'VEN-1',nom_utilisateur:'Opérateur test'}],
    totalEntrees:200,totalSorties:0,soldeCalcule:210,soldeDeclare:null,ecart:null,totalVentesComptoir:200,totalReglements:0,totalDecomptes:0,totalCharges:0,
    ventilation:{total:200,totalEntrees:200,totalSorties:0,especes:200,especesEntrees:200,especesSorties:0,transferts:0,mobileMoney:0,orangeMoney:0,
      moovMoney:0,telecelMoney:0,sankMoney:0,wave:0,autreMobile:0,virements:0,cheques:0,autres:0,nonPrecise:0,nbOperations:1,nbNonPrecise:0},
    especesAttendues:210,provisoire:true};
}
test('CSV rapport ventes seules : origine ajoutée, chiffres et synthèse historique conservés',async()=>{
  const value=report(),before=JSON.stringify(value),csv=construireRapportCsv(value);
  assert.ok(csv.includes('Origine;N°;Date;Désignation'));
  assert.ok(csv.includes('Vente;1;2026-11-18;Vente test;ENTREE;VENTE_COMPTOIR;ESPECES;200;210;VEN-1;Opérateur test'));
  assert.ok(csv.includes('Report (fond de caisse);10\nTotal entrées;200\nTotal sorties;0\nTotal général (report inclus);210'));
  assert.ok(csv.includes('Espèces en caisse (report inclus);210'));assert.equal(JSON.stringify(value),before);
});
test('CSV rapport mixte : remboursement positif en SORTIE et origine inconnue conservée',async()=>{
  const value=report();value.mouvements.push({origin:'prestation',date_journal:'2026-11-18',designation:'Remboursement',type_mouvement:'SORTIE',
    categorie:'AUTRE_SORTIE',montant:50,solde_apres:160,reference:'PRE-1'},
    {date_journal:'2026-11-18',designation:'Historique',type_mouvement:'ENTREE',montant:10,solde_apres:170,reference:'PRE-HISTORIQUE'});
  const csv=construireRapportCsv(value);
  assert.ok(csv.includes('Prestation;2;2026-11-18;Remboursement;SORTIE;AUTRE_SORTIE;Non précisé;50;160;PRE-1;'));
  assert.ok(csv.includes('·;3;2026-11-18;Historique;ENTREE;'));assert.equal(csv.includes('Prestation;3;'),false);
});
