import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { DatabaseSync, backup } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applicationAsset, collectGestionProAssets } from '../scripts/gestionproAssets.ts';
import { fixture, input, admin } from './helpers/prestationFixture.ts';
import { createPrestationHttpTransport, createPrestationWebAdapter } from '../src/services/adapters/prestationWebAdapter.ts';

function assetsFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gc-assets-'));
  mkdirSync(path.join(dir,'dist'),{recursive:true}); mkdirSync(path.join(dir,'server','runtime'),{recursive:true});
  writeFileSync(path.join(dir,'dist','index.html'),'<html>test</html>');
  writeFileSync(path.join(dir,'server','index.mjs'),'// serveur');
  writeFileSync(path.join(dir,'server','runtime','prestations.mjs'),'// prestations');
  return dir;
}

test('exécutable : seuls les fichiers applicatifs sont embarqués, contenu identifié par hash', () => {
  const dir=assetsFixture(); mkdirSync(path.join(dir,'data')); writeFileSync(path.join(dir,'data','gestion-commerciale.db'),'DONNEES PRIVEES');
  writeFileSync(path.join(dir,'.env'),'SECRET');
  const a=collectGestionProAssets(dir,'1.0'); assert.equal(a.files.length,3);
  assert.ok(a.files.every(file=>!file.key.includes('data')&&!file.key.includes('.env')));
  writeFileSync(path.join(dir,'data','gestion-commerciale.db'),'AUTRES DONNEES');
  assert.equal(collectGestionProAssets(dir,'1.0').buildId,a.buildId);
  writeFileSync(path.join(dir,'server','runtime','prestations.mjs'),'// nouvelle version');
  assert.notEqual(collectGestionProAssets(dir,'1.0').buildId,a.buildId);
});

test('exécutable : chemin sortant ou base accidentelle dans dist refusés', () => {
  for(const key of ['data/base.db','dist/../data/base.db','dist/secret.sqlite','dist\\app.js','/dist/index.html','server/autre.mjs'])assert.equal(applicationAsset(key),false,key);
  const dir=assetsFixture(); writeFileSync(path.join(dir,'dist','ancienne.db'),'SQLite');
  assert.throws(()=>collectGestionProAssets(dir,'1.0'),/non autorisé/);
});

test('build.bat --pull : modifications locales conservées, arrêt avant mise à jour', {skip:process.platform!=='win32'}, () => {
  const dir=mkdtempSync(path.join(tmpdir(),'gc-build avec espaces-'));
  copyFileSync(new URL('../build.bat',import.meta.url),path.join(dir,'build.bat'));
  writeFileSync(path.join(dir,'package.json'),'{}'); writeFileSync(path.join(dir,'modification.ts'),'const conserve = true;');
  const git=spawnSync('git',['init','--quiet'],{cwd:dir,encoding:'utf8'}); assert.equal(git.status,0,git.stderr);
  const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','build.bat --pull --no-pause'],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stdout,/modifications locales presentes/);
  assert.equal(readFileSync(path.join(dir,'modification.ts'),'utf8'),'const conserve = true;');
  assert.equal(existsSync(path.join(dir,'GestionPro.exe')),false);
});

const executable=path.resolve('GestionPro.exe');
test('GestionPro.exe seul : moteur et interface embarqués, ancienne base conservée, prestations HTTP actives', {
  skip:process.platform!=='win32'||!existsSync(executable),timeout:30000,
}, async ctx => {
  const f=await fixture(ctx);
  const dir=mkdtempSync(path.join(tmpdir(),'gc GestionPro autonome-'));
  const other=mkdtempSync(path.join(tmpdir(),'gc-cwd-'));
  const exe=path.join(dir,'GestionPro.exe'); copyFileSync(executable,exe);
  const env={...process.env}; delete env.GC_DB; delete env.GC_DATA; delete env.GC_DIST; delete env.GC_PORT; delete env.NODE_OPTIONS;
  const check=spawnSync(exe,['--check'],{cwd:other,env,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr); const info=JSON.parse(check.stdout) as {mode:string;database:string};
  assert.equal(info.mode,'web'); assert.equal(info.database,path.join(dir,'data','gestion-commerciale.db'));
  assert.equal(existsSync(path.join(dir,'data')),false); assert.equal(existsSync(path.join(dir,'.gestionpro-cache')),false);
  mkdirSync(path.join(dir,'data')); const dbFile=path.join(dir,'data','gestion-commerciale.db');
  await backup(f.db as unknown as DatabaseSync,dbFile);
  const probe=createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const address=probe.address(); if(!address||typeof address==='string')throw new Error('Port absent');
  const port=address.port; await new Promise<void>(resolve=>probe.close(()=>resolve()));
  env.GC_PORT=String(port);env.GC_HOST='127.0.0.1';env.GC_TOKEN='test-autonome';
  const child=spawn(exe,['--no-browser'],{cwd:other,env,stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',chunk=>{logs+=String(chunk);});child.stderr.on('data',chunk=>{logs+=String(chunk);});
  ctx.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
  const url=`http://127.0.0.1:${port}`;let ready=false;
  for(let attempt=0;attempt<150;attempt++){
    if(child.exitCode!==null)throw new Error(logs);
    try{const r=await fetch(url+'/api/health',{headers:{'x-gc-token':'test-autonome'}});if(r.ok){ready=true;break;}}catch{/* démarrage de l’exécutable */}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(ready,logs);
  const html=await(await fetch(url)).text(); assert.match(html,/<html/);
  const js=html.match(/<script[^>]+src="([^"]+)"/)?.[1];assert.ok(js);
  const asset=await fetch(url+js);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type')||'',/javascript/);
  const service=createPrestationWebAdapter(createPrestationHttpTransport(url,'test-autonome'));
  const created=await service.create(input(40),admin);assert.equal(created.restantDu,60);
  const db=new DatabaseSync(dbFile,{readOnly:true});
  try{
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ventes').get()?.n,1);
    assert.equal(db.prepare('SELECT montant_ttc FROM ventes WHERE idVente=1').get()?.montant_ttc,1234);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ventes_prestations').get()?.n,1);
  }finally{db.close();}
  const busy=spawnSync(exe,['--no-browser'],{cwd:other,env,encoding:'utf8'});assert.equal(busy.status,0);assert.match(busy.stdout,/déjà ouvert/);
  const wrongDatabase=path.join(dir,'autre-base.db');
  const refused=spawnSync(exe,['--no-browser'],{cwd:other,env:{...env,GC_DB:wrongDatabase},encoding:'utf8'});
  assert.equal(refused.status,1);assert.match(refused.stderr,/ancienne version ou une autre application/);
  assert.equal(existsSync(wrongDatabase),false);assert.match(readFileSync(path.join(dir,'GestionPro-erreurs.log'),'utf8'),/port/);
  assert.equal(existsSync(path.join(dir,'node')),false);assert.equal(existsSync(path.join(dir,'node_modules')),false);
  assert.equal(existsSync(path.join(dir,'server')),false);assert.equal(existsSync(path.join(dir,'dist')),false);
});
