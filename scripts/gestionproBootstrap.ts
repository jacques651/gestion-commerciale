/** Entrée embarquée dans GestionPro.exe. Le mode web et sa base historique sont conservés. */
import { getAsset, isSea } from 'node:sea';
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { applicationAsset, sha256, type GestionProManifest } from './gestionproAssets.ts';

async function portBusy(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}

function openBrowser(url: string) {
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, windowsHide: true, stdio: 'ignore' });
  browser.on('error', () => console.log('Ouvrez votre navigateur sur ' + url)); browser.unref();
}

/** Fichier .lnk (format MS-SHLLINK) écrit directement : aucun programme externe n'est lancé. */
function fichierRaccourci(cible: string, dossier: string, icone: string | null, description: string): Buffer {
  const utf16 = (t: string) => Buffer.from(t, 'utf16le');
  const chaine = (t: string) => { const n = Buffer.alloc(2); n.writeUInt16LE(t.length); return Buffer.concat([n, utf16(t)]); };
  // En-tête (76 octets) : HasLinkInfo | HasName | HasWorkingDir | HasIconLocation? | IsUnicode
  const entete = Buffer.alloc(76);
  entete.writeUInt32LE(0x4c, 0);
  Buffer.from('0114020000000000c000000000000046', 'hex').copy(entete, 4);
  entete.writeUInt32LE(0x02 | 0x04 | 0x10 | (icone ? 0x40 : 0) | 0x80, 20);
  entete.writeUInt32LE(0x20, 24);          // FILE_ATTRIBUTE_ARCHIVE
  entete.writeUInt32LE(1, 60);             // SW_SHOWNORMAL
  // LinkInfo : VolumeID + chemin local (ANSI et Unicode, pour les chemins accentués)
  const volume = Buffer.alloc(17);
  volume.writeUInt32LE(17, 0); volume.writeUInt32LE(3, 4); volume.writeUInt32LE(0, 8); volume.writeUInt32LE(16, 12);
  const ansi = Buffer.from(cible.replace(/[^\x20-\x7e]/g, '?') + '\0', 'latin1');
  const suffixe = Buffer.from([0]);
  const unicode = utf16(cible + '\0');
  const suffixeUnicode = Buffer.from([0, 0]);
  const tailleEntete = 0x24;
  const offVolume = tailleEntete;
  const offAnsi = offVolume + volume.length;
  const offSuffixe = offAnsi + ansi.length;
  const offUnicode = offSuffixe + suffixe.length;
  const offSuffixeUnicode = offUnicode + unicode.length;
  const tailleInfo = offSuffixeUnicode + suffixeUnicode.length;
  const info = Buffer.alloc(tailleEntete);
  info.writeUInt32LE(tailleInfo, 0); info.writeUInt32LE(tailleEntete, 4); info.writeUInt32LE(1, 8);
  info.writeUInt32LE(offVolume, 12); info.writeUInt32LE(offAnsi, 16); info.writeUInt32LE(0, 20);
  info.writeUInt32LE(offSuffixe, 24); info.writeUInt32LE(offUnicode, 28); info.writeUInt32LE(offSuffixeUnicode, 32);
  const linkInfo = Buffer.concat([info, volume, ansi, suffixe, unicode, suffixeUnicode]);
  // StringData (ordre imposé : nom, dossier de travail, icône) + bloc de fin
  const chaines = [chaine(description), chaine(dossier), ...(icone ? [chaine(icone)] : [])];
  return Buffer.concat([entete, linkInfo, ...chaines, Buffer.alloc(4)]);
}

/** Bureau de l'utilisateur, y compris redirigé vers OneDrive (sans lancer de programme). */
function dossierBureau(): string | null {
  const profil = process.env.USERPROFILE;
  const candidats = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial]
    .filter((d): d is string => !!d).flatMap(d => [path.join(d, 'Desktop'), path.join(d, 'Bureau')]);
  if (profil) candidats.push(path.join(profil, 'Desktop'), path.join(profil, 'Bureau'));
  return candidats.find(d => existsSync(d)) ?? null;
}

/**
 * Raccourci « GestionPro » sur le bureau (créé, ou réécrit s'il pointe ailleurs).
 * Écrit directement le fichier .lnk : les antivirus bloquent souvent un exe non signé
 * qui lance PowerShell caché, ce qui empêchait la création. Un échec n'empêche jamais
 * l'application de démarrer ; il est consigné dans GestionPro-erreurs.log.
 * Désactivable avec --no-shortcut ou GC_NO_SHORTCUT=1.
 */
function creerRaccourciBureau(directory: string) {
  if (process.platform !== 'win32' || process.argv.includes('--no-shortcut') || process.env.GC_NO_SHORTCUT === '1') return;
  const journal = path.join(directory, 'GestionPro-erreurs.log');
  const noter = (message: string) => { try { appendFileSync(journal, new Date().toISOString() + ' | raccourci | ' + message + '\n'); } catch { /* ignore */ } };
  try {
    // Icône stable à côté de l'exe (le cache change à chaque version).
    let icone: string | null = path.join(directory, 'GestionPro.ico');
    try {
      const octets = Buffer.from(getAsset('dist/favicon.ico'));
      if (!existsSync(icone) || sha256(readFileSync(icone)) !== sha256(octets)) writeFileSync(icone, octets);
    } catch (e) { noter('icône non écrite : ' + (e instanceof Error ? e.message : String(e))); icone = existsSync(icone) ? icone : null; }
    const bureau = dossierBureau();
    if (!bureau) { noter('bureau introuvable (USERPROFILE / OneDrive).'); return; }
    const lien = path.join(bureau, 'GestionPro.lnk');
    const contenu = fichierRaccourci(process.execPath, directory, icone, 'GestionPro');
    if (existsSync(lien) && readFileSync(lien).equals(contenu)) return;
    writeFileSync(lien, contenu);
    console.log('Raccourci GestionPro créé sur le bureau : ' + lien);
  } catch (e) {
    noter(e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  if (!isSea()) throw new Error('Ce fichier doit être exécuté dans GestionPro.exe.');
  const manifest = JSON.parse(getAsset('gestionpro-manifest.json', 'utf8')) as GestionProManifest;
  if (manifest.format !== 1 || !/^[a-f0-9]{24}$/.test(manifest.buildId) || !Array.isArray(manifest.files)
    || manifest.files.some(file => !applicationAsset(file.key) || !/^[a-f0-9]{64}$/.test(file.sha256))) {
    throw new Error('Manifeste GestionPro invalide.');
  }
  const directory = path.dirname(process.execPath);
  const data = path.resolve(directory, process.env.GC_DATA || 'data');
  const database = path.resolve(directory, process.env.GC_DB || path.join(data, 'gestion-commerciale.db'));
  let port = Number(process.env.GC_PORT || 8090);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('GC_PORT doit être compris entre 1 et 65535.');
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({ application: 'GestionPro', mode: 'web', version: manifest.version,
      buildId: manifest.buildId, node: process.version, architecture: process.arch, files: manifest.files.length, database, port }));
    return;
  }
  creerRaccourciBureau(directory);
  const headers: Record<string, string> = process.env.GC_TOKEN ? { 'x-gc-token': process.env.GC_TOKEN } : {};
  const startPort = port;
  const lastPort = process.env.GC_PORT ? port : 8099;
  for (; port <= lastPort; port++) {
    if (!(await portBusy(port))) break;
    let compatible = false;
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, { headers, signal: AbortSignal.timeout(2000) });
      const health = await response.json() as { application?: string; databaseId?: string; buildId?: string; prestationApi?: number };
      const databaseId = sha256(process.platform === 'win32' ? database.toLowerCase() : database);
      compatible = response.ok && health.application === 'GestionPro' && health.databaseId === databaseId
        && health.buildId === manifest.buildId && health.prestationApi === 1;
    } catch { /* ne jamais ouvrir une application ou une base non identifiée */ }
    if (compatible) {
      console.log('GestionPro est déjà ouvert. Réouverture de votre application.');
      if (!process.argv.includes('--no-browser')) openBrowser(`http://localhost:${port}`);
      return;
    }
    if (process.env.GC_PORT) throw new Error(`Une ancienne version ou une autre application utilise le port ${port}. Fermez l’ancienne console serveur avec Ctrl+C, puis relancez GestionPro.exe.`);
  }
  if (port > lastPort) throw new Error('Aucune adresse locale libre entre les ports 8090 et 8099. Fermez une ancienne console serveur puis réessayez.');
  const url = `http://localhost:${port}`;
  if (port !== startPort) console.log(`L’ancien serveur reste ouvert. GestionPro utilise ${url} avec votre base habituelle.`);
  const cache = path.join(directory, '.gestionpro-cache', manifest.buildId);
  for (const file of manifest.files) {
    const bytes = Buffer.from(getAsset(file.key));
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error('Fichier embarqué endommagé : ' + file.key);
    const destination = path.resolve(cache, file.key);
    if (!destination.startsWith(cache + path.sep)) throw new Error('Chemin applicatif invalide.');
    if (existsSync(destination) && sha256(readFileSync(destination)) === file.sha256) continue;
    mkdirSync(path.dirname(destination), { recursive: true });
    const temporary = destination + '.' + process.pid + '.tmp';
    writeFileSync(temporary, bytes); renameSync(temporary, destination);
  }
  process.env.GC_DATA = data;
  process.env.GC_DB = database;
  process.env.GC_DIST = path.join(cache, 'dist');
  process.env.GC_BUILD_ID = manifest.buildId;
  process.env.GC_PORT = String(port);
  console.log('GestionPro — mode web ; base : ' + database);
  // createRequire charge le serveur ESM extrait avec le moteur Node inclus dans cet exécutable.
  createRequire(path.join(cache, 'bootstrap.cjs'))(path.join(cache, 'server', 'index.mjs'));
  if (!process.argv.includes('--no-browser')) {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(url + '/api/health', { headers, signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          openBrowser(url);
          return;
        }
      } catch { /* attendre que le serveur soit prêt avant d’ouvrir le navigateur */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Ouvrez votre navigateur sur ' + url);
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nGestionPro : ' + message);
  const log = path.join(path.dirname(process.execPath), 'GestionPro-erreurs.log');
  try { appendFileSync(log, new Date().toISOString() + ' | ' + message + '\n'); console.error('Détail conservé dans : ' + log); }
  catch { /* l’erreur reste affichée même si le dossier est en lecture seule */ }
  process.exitCode = 1;
  if (process.stdin.isTTY && !process.argv.includes('--no-browser') && !process.argv.includes('--check')) {
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try { await reader.question('\nAppuyez sur Entrée pour fermer cette fenêtre.'); } finally { reader.close(); }
  }
});
