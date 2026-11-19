import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preparerPrestations } from '../server/preparerPrestations.ts';

const executable = path.resolve('Preparer-prestations.exe');
function oldDatabase() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gc-preparation ancienne base-'));
  mkdirSync(path.join(dir, 'data'));
  const file = path.join(dir, 'data', 'gestion-commerciale.db');
  const db = new DatabaseSync(file);
  const source = readFileSync(new URL('../src/database/db.ts',import.meta.url),'utf8');
  const schema = source.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1]; assert.ok(schema);
  db.exec(schema);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
    INSERT INTO ventes(code_vente,montant_ttc) VALUES('ANCIENNE-VENTE',250);
    INSERT INTO journal_caisse(code_journal,type_mouvement,categorie,designation,montant,solde_apres,reference,idReference,idUtilisateur)
      VALUES('JRN-ANCIEN','ENTREE','VENTE_COMPTOIR','Ancienne vente',50,50,'ANCIENNE-VENTE',1,1);`);
  return {dir,file,db};
}

test('préparation portable sans Node : sauvegarde du WAL, migration explicite et relance sans doublon', {
  skip:process.platform!=='win32'||!existsSync(executable),timeout:30000,
}, async ctx => {
  const f=oldDatabase();ctx.after(()=>f.db.close());
  copyFileSync(executable,path.join(f.dir,'Preparer-prestations.exe'));
  const other=mkdtempSync(path.join(tmpdir(),'gc-preparation-cwd-'));
  const env={...process.env};delete env.GC_DB;delete env.GC_DATA;delete env.NODE_OPTIONS;
  const run=()=>spawnSync(path.join(f.dir,'Preparer-prestations.exe'),['--no-pause'],{cwd:other,env,encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PREPARATION TERMINEE/);
  assert.equal(f.db.prepare("SELECT migration_id FROM prestation_migrations WHERE version=1").get()?.migration_id,'prestations_v1');
  assert.equal(f.db.prepare('SELECT montant_ttc FROM ventes WHERE idVente=1').get()?.montant_ttc,250);
  assert.equal(f.db.prepare('SELECT SUM(montant) AS total FROM journal_caisse').get()?.total,50);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ventes_prestations').get()?.n,0);
  const folder=path.join(f.dir,'data','sauvegardes-prestations');
  const files=readdirSync(folder).filter(name=>name.endsWith('.db'));assert.equal(files.length,1);
  const saved=new DatabaseSync(path.join(folder,files[0]),{readOnly:true});
  try {
    assert.equal(saved.prepare('SELECT montant_ttc FROM ventes WHERE idVente=1').get()?.montant_ttc,250);
    assert.equal(saved.prepare('SELECT SUM(montant) AS n FROM journal_caisse').get()?.n,50);
    assert.equal(saved.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='prestation_migrations'").get()?.n,0);
  } finally {saved.close();}
  const report=JSON.parse(readFileSync(path.join(folder,files[0]+'.rapport.json'),'utf8')) as {historiquesPreserves:boolean};
  assert.equal(report.historiquesPreserves,true);
  const second=run();assert.equal(second.status,0,second.stderr);assert.match(second.stdout,/deja preparees/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM prestation_migrations').get()?.n,1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ventes').get()?.n,1);
  assert.equal(existsSync(path.join(f.dir,'node')),false);assert.equal(existsSync(path.join(f.dir,'node_modules')),false);
});

test('préparation : base absente refusée sans création de base vide ni de sauvegarde', async () => {
  const dir=mkdtempSync(path.join(tmpdir(),'gc-preparation-absente-'));
  const source=path.join(dir,'data','gestion-commerciale.db');const backups=path.join(dir,'backups');
  await assert.rejects(()=>preparerPrestations(source,backups),/Base introuvable/);
  assert.equal(existsSync(source),false);assert.equal(existsSync(backups),false);
});

test('préparation : schéma incompatible conservé et sauvegarde disponible après refus', async ctx => {
  const dir=mkdtempSync(path.join(tmpdir(),'gc-preparation-incompatible-'));const file=path.join(dir,'ancienne.db');
  const db=new DatabaseSync(file);ctx.after(()=>db.close());db.exec("CREATE TABLE memos(id INTEGER PRIMARY KEY,texte TEXT);INSERT INTO memos VALUES(1,'A CONSERVER');");
  await assert.rejects(()=>preparerPrestations(file,path.join(dir,'backups')),/schéma incompatible/);
  assert.equal(db.prepare('SELECT texte FROM memos WHERE id=1').get()?.texte,'A CONSERVER');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='prestation_migrations'").get()?.n,0);
  assert.equal(readdirSync(path.join(dir,'backups')).filter(name=>name.endsWith('.db')).length,1);
});

test('préparation : sauvegarde impossible bloque toute migration', async ctx => {
  const f=oldDatabase();ctx.after(()=>f.db.close());const bad=path.join(f.dir,'pas-un-dossier');writeFileSync(bad,'fichier');
  await assert.rejects(()=>preparerPrestations(f.file,bad));
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='prestation_migrations'").get()?.n,0);
  assert.equal(f.db.prepare('SELECT montant_ttc FROM ventes WHERE idVente=1').get()?.montant_ttc,250);
});
