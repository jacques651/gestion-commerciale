import { test, assert, fixture, input, admin, manager, cash, type TestContext } from './helpers/prestationFixture.ts';
import { createVenteReadProjection } from '../src/services/venteReadProjection.ts';
import { createTransactionReadQueries, type TransactionReadSource, type ReadValue } from '../src/services/transactionReadSource.ts';
import { readAllTransactions, transactionTotals, totalsByOrigin, monthlyTransactionTotals, transactionCsv,
  transactionExportRows } from '../src/services/transactionConsolidation.ts';
import { transactionExportHtml } from '../src/utils/transactionExport.ts';
import { createTransactionService } from '../src/services/transactionFacade.ts';
import { venteAdapter } from '../src/services/adapters/venteAdapter.ts';
import type { TransactionServiceContract, TransactionView } from '../src/services/transactionContracts.ts';

async function setup(ctx: TestContext) {
  const f = await fixture(ctx); const sql: string[] = [];
  f.db.exec(`ALTER TABLE ventes ADD COLUMN est_annule INTEGER DEFAULT 0;
    UPDATE ventes SET montant_ttc=200,date_vente='2026-11-18 10:00:00';
    INSERT INTO clients(idClient,NomComplet,TypeClient) VALUES(10,'Client test','client');
    INSERT INTO factures(idFacture,code_facture,idClient,montant_ttc) VALUES(10,'FACTURE-TEST',10,200);
    INSERT INTO reglements(code_reglement,idClient,idFacture,idVente,montant) VALUES('REG-TEST',10,10,1,200);
    INSERT INTO journal_caisse(code_journal,type_mouvement,categorie,designation,montant,solde_apres,reference,idReference,idUtilisateur)
      VALUES('JRN-VENTE','ENTREE','VENTE_COMPTOIR','Vente historique',200,200,'VENTE-INCHANGEABLE',1,1);`);
  const source: TransactionReadSource = { async select<Row extends object>(query: string, params: readonly ReadValue[] = []): Promise<Row[]> {
    assert.ok(/^(SELECT|PRAGMA)\b/i.test(query.trim())); sql.push(query);
    return f.db.prepare(query).all(...params) as unknown as Row[];
  } };
  const projection = createVenteReadProjection(source);
  const sales: TransactionServiceContract = {
    getView: projection.getView, listView: projection.listView,
    create: (request, ctx) => venteAdapter.create(request, ctx), update: (...args) => venteAdapter.update(...args),
    cancel: (...args) => venteAdapter.cancel(...args), delete: (...args) => venteAdapter.delete(...args),
  };
  const service = createTransactionService({ vente: sales, prestation: f.adapter });
  return { ...f, source, projection, service, queries: createTransactionReadQueries(source), sql };
}

test('lecture ventes : données seules conservées, aucun double comptage règlement/journal et aucune écriture', async ctx => {
  const f = await setup(ctx); const before = f.snapshot(); const writes = f.trace.writes.length;
  const rows = await readAllTransactions(f.service, { origin: 'vente' }, admin);
  assert.equal(rows.length, 1); assert.equal(rows[0].montantFacture, 200); assert.equal(rows[0].montantEncaisse, 200);
  assert.equal(rows[0].restantDu, 0); assert.equal(rows[0].etatPaiement, 'PAYEE');
  assert.deepEqual(transactionTotals(rows), { facture:200,encaisseBrut:200,rembourse:0,encaisseNet:200,restantDu:0,recouvrement:100,nombre:1 });
  assert.deepEqual(f.snapshot(), before); assert.equal(f.trace.writes.length, writes);
});

test('liste mixte : identifiants égaux dans deux origines, filtres et projections distinctes', async ctx => {
  const f = await setup(ctx); const partial = await f.service.create(input(40), admin);
  assert.equal(partial.ref.id, 1);
  const rows = await readAllTransactions(f.service, {}, admin);
  assert.equal(rows.length, 2); assert.deepEqual([...new Set(rows.map(row=>`${row.ref.origin}:${row.ref.id}`))].sort(), ['prestation:1','vente:1']);
  assert.equal((await readAllTransactions(f.service, {origin:'prestation'}, admin)).length, 1);
  assert.equal((await readAllTransactions(f.service, {origin:'vente'}, admin)).length, 1);
  const sale = await f.service.getView({origin:'vente',id:1}, admin);
  assert.equal(sale.code, 'VENTE-INCHANGEABLE'); assert.equal(sale.montantEncaisse, 200);
  assert.equal((await f.service.getView({origin:'prestation',id:1}, admin)).montantEncaisse, 40);
  assert.equal((await readAllTransactions(f.service,{origin:'vente',recherche:'INCHANGEABLE'},admin)).length,1);
  assert.equal((await readAllTransactions(f.service,{origin:'vente',dateDebut:'2026-12-01'},admin)).length,0);
  assert.equal(partial.actionsAutorisees.modifier.disponible,true);
  assert.equal(sale.actionsAutorisees.modifier.disponible,false); // Les boutons historiques des ventes restent dédiés.
});

test('KPI consolidés connus : facturé, encaissement net, impayés, remboursement, répartition et mois', async ctx => {
  const f = await setup(ctx);
  await f.service.create(input(40), admin); await f.service.create(input(0,80), admin);
  const cancelled = await f.service.create(input(50,50), admin);
  await f.service.cancel(cancelled.ref,'Annulation test',{type:'remboursement',montantRembourse:50,moyenPaiement:cash},'consolidated-cancel',admin);
  const hidden = await f.service.create(input(0,30), admin); await f.service.delete(hidden.ref,'Doublon','soft',admin);
  f.db.exec("UPDATE ventes_prestations SET date_vente='2026-11-18 10:00:00'");
  const rows = await readAllTransactions(f.service, {}, admin); const totals = transactionTotals([...rows,...rows]);
  assert.equal(rows.length,4); assert.equal(totals.facture,380); assert.equal(totals.encaisseBrut,290);
  assert.equal(totals.rembourse,50); assert.equal(totals.encaisseNet,240); assert.equal(totals.restantDu,140);
  assert.ok(Math.abs(totals.recouvrement-240/380*100)<1e-10);
  const grouped = totalsByOrigin(rows); assert.equal(grouped.vente.facture,200); assert.equal(grouped.prestation.facture,180);
  assert.equal(grouped.vente.encaisseNet+grouped.prestation.encaisseNet,240);
  const months = monthlyTransactionTotals(rows); assert.equal(months.length,1); assert.equal(months[0].facture,380);
  const journal = f.db.prepare("SELECT SUM(CASE WHEN type_mouvement='ENTREE' THEN montant ELSE -montant END) AS solde FROM journal_caisse").get();
  assert.equal(journal?.solde,240); assert.equal(totals.encaisseNet, journal?.solde); // Aucun ajout du montant de prestation au solde déjà alimenté.
});

test('journal : origine explicite, historique inconnu et liens exacts vers la contrepassation', async ctx => {
  const f = await setup(ctx); const paid = await f.service.create(input(100),admin);
  const result = await f.service.cancel(paid.ref,'Erreur',{type:'remboursement',montantRembourse:100,moyenPaiement:cash},'journal-link',admin);
  const ids = f.db.prepare('SELECT idJournal FROM journal_caisse').all().map(row=>Number(row.idJournal));
  const before=f.snapshot(); const rows=await f.queries.readJournal(ids,admin);
  const legacy=rows.find(row=>row.code_journal==='JRN-VENTE')!; assert.equal(legacy.origin,null); assert.equal(legacy.operation,null);
  const inverse=rows.find(row=>row.idJournal===result.ecritureContrepasseId)!;
  assert.deepEqual(inverse.operation,paid.ref); assert.equal(inverse.origin,'prestation');
  const original=rows.find(row=>row.idJournal===inverse.idJournalContrepasse)!;
  assert.equal(original.contrepassationId,inverse.idJournal); assert.deepEqual(original.operation,paid.ref);
  assert.equal(rows.filter(row=>row.origin==='prestation').length,2); assert.deepEqual(f.snapshot(),before);
});

test('historique prestations : quatre opérations, acteur et motifs sans doubler les flux', async ctx => {
  const f = await setup(ctx); const paid = await f.service.create(input(100), admin);
  await f.service.update(paid.ref,{origin:'prestation',cleOperation:'history-update',observations:'Note'},1,admin);
  await f.service.cancel(paid.ref,'Motif annulation',{type:'remboursement',montantRembourse:100,moyenPaiement:cash},'history-cancel',admin);
  const unpaid = await f.service.create(input(),admin); await f.service.delete(unpaid.ref,'Motif masquage','soft',admin);
  const before = f.snapshot(); const activity = await f.queries.readPrestationActivity(admin);
  assert.deepEqual([...new Set(activity.map(row=>row.action))].sort(),['cancel','create','delete','update']);
  assert.ok(activity.every(row=>Boolean(row.acteur))); assert.ok(activity.every(row=>row.origin==='prestation'));
  assert.equal(activity.find(row=>row.action==='cancel')?.motif,'Motif annulation');
  assert.equal(activity.find(row=>row.action==='delete')?.motif,'Motif masquage'); assert.deepEqual(f.snapshot(),before);
});

test('export commun : mêmes colonnes et montants, origine, guillemets CSV et HTML échappé', async ctx => {
  const f=await setup(ctx); await f.service.create(input(40),admin);
  const rows=await readAllTransactions(f.service,{},admin); const csv=transactionCsv(rows);
  assert.ok(csv.startsWith('"Origine";"Code"')); assert.ok(csv.includes('"Prestation"')); assert.ok(csv.includes('"Vente"'));
  assert.equal(transactionExportRows(rows).length,2); assert.ok(csv.includes('"100";"40";"0";"60"'));
  const malicious:TransactionView={...rows[0],client:{...rows[0].client,nom:'<script>"test"</script>'}};
  const html=transactionExportHtml([malicious]); assert.equal(html.includes('<script>"test"</script>'),false);
  assert.ok(html.includes('&lt;script&gt;')); assert.equal(html.includes('--tk-'),false); assert.equal(html.includes('var('),false);
});

test('lectures protégées : acteur incohérent, espace inconnu et origine masquée refusés', async ctx => {
  const f=await setup(ctx);
  await assert.rejects(()=>f.projection.listView({origin:'vente'},{page:1,pageSize:10},{...manager,role:'admin'}),/rôle incohérent/);
  await assert.rejects(()=>f.projection.getView({origin:'vente',id:1},{...admin,espaceId:'autre'}),/session/);
  await assert.rejects(()=>f.queries.readJournal([1],{...admin,utilisateurId:999}),/Acteur absent/);
  await assert.rejects(()=>f.projection.listView({origin:'vente',afficherSupprimees:true},{page:1,pageSize:10},manager),/administrateurs/);
});

test('ventes sans journal : aucun paiement inventé et annulation historique conservée', async ctx => {
  const f=await setup(ctx); f.db.exec('DELETE FROM journal_caisse; DELETE FROM reglements;');
  let row=await f.projection.getView({origin:'vente',id:1},admin); assert.equal(row.montantEncaisse,0); assert.equal(row.restantDu,200);
  f.db.exec('UPDATE ventes SET est_annule=1'); row=await f.projection.getView({origin:'vente',id:1},admin);
  assert.equal(row.etatCommercial,'ANNULEE'); assert.equal(row.restantDu,0); assert.equal(transactionTotals([row]).facture,0);
});

test('consolidation paginée : toutes les pages des deux origines sont parcourues sans collision',async ctx=>{
  const f=await setup(ctx);const sale=await f.service.getView({origin:'vente',id:1},admin);const prestation=await f.service.create(input(40),admin);
  const calls:string[]=[];
  const rows=await readAllTransactions({async listView(filters,pagination){
    calls.push(`${filters.origin}:${pagination.page}`);
    const base=filters.origin==='vente'?sale:prestation;
    const all=Array.from({length:205},(_,index):TransactionView=>({...base,ref:{origin:base.ref.origin,id:index+1}} as TransactionView));
    return {...pagination,total:all.length,items:all.slice((pagination.page-1)*pagination.pageSize,pagination.page*pagination.pageSize)};
  }},{},admin);
  assert.equal(rows.length,410);assert.equal(new Set(rows.map(row=>`${row.origin}:${row.ref.id}`)).size,410);
  assert.deepEqual(calls,['vente:1','vente:2','vente:3','prestation:1','prestation:2','prestation:3']);
});
