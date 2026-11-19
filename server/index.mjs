// server/index.mjs
// Serveur web portable pour Gestion Commerciale.
// - Node 22+ uniquement (utilise le module natif node:sqlite et http).
// - Aucune dependance npm : tourne avec un node.exe portable sur la cle USB.
// - Sert le frontend (dossier ../dist) ET une API SQL partagee (SQLite unique).
//
// Le fichier SQLite est ouvert par CE SEUL processus. Tous les postes du reseau
// local (LAN/WiFi) passent par l'API HTTP -> multi-utilisateur cote serveur.

import { DatabaseSync, backup } from 'node:sqlite';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createPrestationApi, preparerPrestations, etatMigrationPrestations } from './runtime/prestations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuration (surchargée par variables d'environnement)
// ---------------------------------------------------------------------------
const PORT = Number(process.env.GC_PORT || 8090);
const HOST = process.env.GC_HOST || '0.0.0.0'; // 0.0.0.0 = accessible sur le LAN
const DIST_DIR = process.env.GC_DIST || path.join(__dirname, '..', 'dist');
const DATA_DIR = process.env.GC_DATA || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.GC_DB || path.join(DATA_DIR, 'gestion-commerciale.db');
// Jeton d'acces optionnel : si defini, chaque requete /api doit fournir
// l'en-tete "x-gc-token". Laisser vide pour un LAN de confiance.
const TOKEN = process.env.GC_TOKEN || '';
const databaseIdentity = path.resolve(DB_PATH);
const databaseId = createHash('sha256').update(process.platform === 'win32' ? databaseIdentity.toLowerCase() : databaseIdentity).digest('hex');
const prestationApi = createPrestationApi(DB_PATH);

// ---------------------------------------------------------------------------
// Base de donnees (une seule connexion, partagee, sérialisée par Node)
// ---------------------------------------------------------------------------
fs.mkdirSync(DATA_DIR, { recursive: true });
function ouvrirBase() {
  const connexion = new DatabaseSync(DB_PATH);
  connexion.exec('PRAGMA journal_mode = WAL;');   // lectures concurrentes
  connexion.exec('PRAGMA foreign_keys = ON;');
  connexion.exec('PRAGMA synchronous = NORMAL;');
  connexion.exec('PRAGMA busy_timeout = 30000;');
  return connexion;
}
// Connexion partagee ; remplacee uniquement pendant une restauration.
let db = ouvrirBase();
let maintenance = false;

// ---------------------------------------------------------------------------
// Restauration de la base de l'ancienne version (meme logique que legacy_db.rs)
// Emplacements detectes automatiquement ; aucun chemin n'est accepte du navigateur.
// ---------------------------------------------------------------------------
const NOM_BASE = 'gestion-commerciale.db';
const TABLES_COMPTEES = ['ventes', 'clients', 'produits', 'commandes', 'factures'];
const cleChemin = (p) => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };

function cheminsAnciennesBases() {
  const liste = [];
  if (process.env.APPDATA) liste.push(path.join(process.env.APPDATA, 'com.user.gestion-commerciale', NOM_BASE));
  liste.push(path.join(os.homedir(), 'GestionCommerciale', 'data', NOM_BASE));
  if (process.env.GC_LEGACY_DB_PATHS) liste.push(...process.env.GC_LEGACY_DB_PATHS.split(path.delimiter).filter(Boolean));
  const vus = new Set([cleChemin(DB_PATH)]);
  return liste.filter((p) => { const k = cleChemin(p); if (vus.has(k)) return false; vus.add(k); return true; });
}

function compter(connexion) {
  const resultat = {};
  for (const table of TABLES_COMPTEES) {
    try {
      const existe = connexion.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      resultat[table] = existe ? Number(connexion.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n) : 0;
    } catch { resultat[table] = 0; }
  }
  return resultat;
}
const totalLignes = (compteurs) => Object.values(compteurs).reduce((a, b) => a + b, 0);

function decrireBase(chemin) {
  const stat = fs.statSync(chemin, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.size === 0) return null;
  const wal = fs.statSync(chemin + '-wal', { throwIfNoEntry: false });
  const info = {
    id: createHash('sha256').update(cleChemin(chemin)).digest('hex').slice(0, 16),
    chemin, taille: stat.size + (wal ? wal.size : 0),
    modifie: new Date(Math.max(stat.mtimeMs, wal ? wal.mtimeMs : 0)).toISOString(),
    compteurs: {}, valide: false, vide: true, erreur: null,
  };
  let connexion;
  try {
    connexion = new DatabaseSync(chemin, { readOnly: true });
    const controle = connexion.prepare('PRAGMA quick_check').get();
    info.compteurs = compter(connexion);
    info.vide = totalLignes(info.compteurs) === 0;
    info.valide = controle && controle.quick_check === 'ok';
    if (!info.valide) info.erreur = 'Base endommagee.';
  } catch (e) {
    info.erreur = 'Base illisible : ' + (e && e.message ? e.message : e);
  } finally {
    try { connexion?.close(); } catch { /* ignore */ }
  }
  return info;
}

function erreurHttp(status, message) { const e = new Error(message); e.status = status; return e; }

function verifierAdmin(ctx) {
  const id = Number(ctx && ctx.utilisateurId);
  if (!Number.isSafeInteger(id) || id <= 0) throw erreurHttp(403, 'Session invalide.');
  const u = db.prepare('SELECT role, est_actif FROM utilisateurs WHERE id = ?').get(id);
  if (!u || Number(u.est_actif) !== 1 || String(u.role).toLowerCase() !== 'admin') {
    throw erreurHttp(403, "Restauration reservee a l'administrateur.");
  }
}

function etatRestauration(ctx) {
  verifierAdmin(ctx);
  return {
    baseVide: totalLignes(compter(db)) === 0,
    candidats: cheminsAnciennesBases().map(decrireBase).filter(Boolean),
  };
}

function supprimerAnnexes() {
  for (const suffixe of ['-wal', '-shm']) {
    try { fs.rmSync(DB_PATH + suffixe, { force: true }); } catch { /* ignore */ }
  }
}

async function restaurerAncienneBase(id, ctx) {
  verifierAdmin(ctx);
  const candidat = cheminsAnciennesBases().map(decrireBase).find((c) => c && c.id === id);
  if (!candidat) throw erreurHttp(404, 'Ancienne base introuvable sur ce PC.');
  if (!candidat.valide) throw erreurHttp(409, candidat.erreur || 'Ancienne base invalide.');
  if (candidat.vide) throw erreurHttp(409, "L'ancienne base ne contient aucune donnee.");

  const dossier = path.join(path.dirname(DB_PATH), 'sauvegardes-restauration');
  fs.mkdirSync(dossier, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const sauvegarde = path.join(dossier, `avant-restauration-${horodatage}.db`);
  const temporaire = DB_PATH + '.restauration-tmp';
  const journal = path.join(path.dirname(DB_PATH), 'Restauration.log');
  maintenance = true;
  let baseFermee = false;
  try {
    // 1. Copie coherente de l'ancienne base (WAL inclus), puis controle d'integrite.
    fs.rmSync(temporaire, { force: true });
    const source = new DatabaseSync(candidat.chemin, { readOnly: true });
    try { await backup(source, temporaire); } finally { source.close(); }
    const copie = new DatabaseSync(temporaire);
    try {
      const r = copie.prepare('PRAGMA integrity_check').get();
      if (!r || r.integrity_check !== 'ok') throw new Error("Controle d'integrite de l'ancienne base echoue.");
      copie.exec('PRAGMA journal_mode = DELETE;');
    } finally { copie.close(); }
    // 2. Sauvegarde complete de la base actuelle.
    await backup(db, sauvegarde);
    // 3. Remplacement.
    db.close(); baseFermee = true;
    supprimerAnnexes();
    fs.renameSync(temporaire, DB_PATH);
    db = ouvrirBase(); baseFermee = false;
  } catch (e) {
    try { fs.rmSync(temporaire, { force: true }); } catch { /* ignore */ }
    if (baseFermee) { db = ouvrirBase(); }
    maintenance = false;
    try { fs.appendFileSync(journal, new Date().toISOString() + ' | echec | ' + (e && e.message ? e.message : e) + '\n'); } catch { /* ignore */ }
    throw e;
  }
  // 4. Migration prestations sur la base restauree ; en cas d'echec, retour a la base precedente.
  try {
    await preparerAuDemarrage();
  } catch (e) {
    db.close(); supprimerAnnexes();
    fs.copyFileSync(sauvegarde, DB_PATH);
    db = ouvrirBase();
    maintenance = false;
    try { fs.appendFileSync(journal, new Date().toISOString() + ' | annulee | ' + (e && e.message ? e.message : e) + '\n'); } catch { /* ignore */ }
    throw erreurHttp(500, 'Restauration annulee, base precedente remise en place : ' + (e && e.message ? e.message : e));
  }
  maintenance = false;
  const resultat = { ok: true, source: candidat.chemin, compteurs: candidat.compteurs, sauvegarde };
  try { fs.appendFileSync(journal, JSON.stringify({ date: new Date().toISOString(), ...resultat }) + '\n'); } catch { /* ignore */ }
  console.log('  Ancienne base restauree depuis : ' + candidat.chemin);
  console.log('  Sauvegarde de la base precedente : ' + sauvegarde);
  return resultat;
}

function normParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    return p;
  });
}

function doSelect(sql, params) {
  const stmt = db.prepare(sql);
  return stmt.all(...normParams(params));
}

function doExecute(sql, params) {
  const p = normParams(params);
  if (p.length > 0) {
    // Instruction unique parametree (INSERT/UPDATE/DELETE...) -> lastInsertId dispo
    const info = db.prepare(sql).run(...p);
    return { rowsAffected: info.changes, lastInsertId: Number(info.lastInsertRowid) };
  }
  // Sans parametres : PRAGMA, BEGIN/COMMIT, ALTER, CREATE, ou script complet
  // multi-instructions (schema). db.exec gere toutes ces formes de maniere fiable.
  // (prepare().run() n'executerait que la 1re instruction d'un script.)
  db.exec(sql);
  return { rowsAffected: 0, lastInsertId: 0 };
}

function doBatch(statements) {
  const results = [];
  db.exec('BEGIN');
  try {
    for (const s of statements || []) {
      results.push(doExecute(s.sql, s.params));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Serveur HTTP : API + fichiers statiques (SPA)
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-gc-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 50e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(DIST_DIR, urlPath);
  // Empeche la sortie du dossier dist
  if (!filePath.startsWith(DIST_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Fallback SPA : renvoyer index.html pour les routes cote client
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (err2, index) => {
        if (err2) { res.writeHead(404); return res.end('Not found (dist/ manquant ?)'); }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        });
        res.end(index);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // The HTML entry point must never retain outdated chunk names after a deployment.
    if (ext === '.html') headers['Cache-Control'] = 'no-store, max-age=0';
    else if (urlPath.startsWith('/assets/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, headers);
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }

  if (url.startsWith('/api/')) {
    // Jeton optionnel
    if (TOKEN && req.headers['x-gc-token'] !== TOKEN) {
      return sendJson(res, 401, { error: 'Jeton invalide' });
    }
    if (url === '/api/health') return sendJson(res, 200, { ok: true, db: path.basename(DB_PATH), prestationApi: 1,
      application: 'GestionPro', databaseId, buildId: process.env.GC_BUILD_ID || null });
    if (maintenance) return sendJson(res, 503, { error: 'Restauration en cours, patientez quelques secondes.' });

    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      if (url === '/api/prestations') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Méthode POST requise.', code: 'INVALID_INPUT' });
        return sendJson(res, 200, { result: await prestationApi(payload) });
      }
      if (url === '/api/restauration/etat') {
        return sendJson(res, 200, etatRestauration(payload.ctx));
      }
      if (url === '/api/restauration/appliquer') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Methode POST requise.' });
        return sendJson(res, 200, await restaurerAncienneBase(String(payload.id || ''), payload.ctx));
      }
      if (url === '/api/select') {
        return sendJson(res, 200, { rows: doSelect(payload.sql, payload.params) });
      }
      if (url === '/api/execute') {
        return sendJson(res, 200, doExecute(payload.sql, payload.params));
      }
      if (url === '/api/batch') {
        return sendJson(res, 200, { results: doBatch(payload.statements) });
      }
      return sendJson(res, 404, { error: 'Endpoint inconnu' });
    } catch (e) {
      const code = url === '/api/prestations' && e?.name === 'PrestationAdapterError' && typeof e?.code === 'string' ? e.code : undefined;
      if (e && Number.isInteger(e.status)) return sendJson(res, e.status, { error: String(e.message) });
      return sendJson(res, code === 'FORBIDDEN' ? 403 : code === 'INVALID_INPUT' ? 400 : code ? 409 : 500,
        { error: String(e && e.message ? e.message : e), ...(code ? { code } : {}) });
    }
  }

  // Fichiers statiques
  serveStatic(req, res);
});

// Classe une interface reseau d'apres son nom (Windows / Linux / macOS)
function classifyInterface(name) {
  const n = (name || '').toLowerCase();
  if (/(virtual|vethernet|vmware|hyper-?v|\bwsl\b|vbox|virtualbox|bluetooth|\bvpn\b|\btap\b|\btun\b|docker|loopback|zerotier|tailscale)/.test(n)) return 'Virtuel';
  if (/(wi-?fi|wlan|wireless|sans.?fil|802\.11)/.test(n)) return 'WiFi';
  if (/(ethernet|eth\d|\ben\d|\blan\b|filaire|local area)/.test(n)) return 'Ethernet';
  return 'Reseau';
}

// Retourne les adresses IPv4 locales, classees et triees (WiFi/Ethernet d'abord)
function localAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      // family peut valoir 'IPv4' (chaine) ou 4 (nombre) selon la version de Node
      const isV4 = net.family === 'IPv4' || net.family === 4;
      if (isV4 && !net.internal) out.push({ name, address: net.address, type: classifyInterface(name) });
    }
  }
  const ordre = { WiFi: 0, Ethernet: 1, Reseau: 2, Virtuel: 3 };
  out.sort((a, b) => (ordre[a.type] - ordre[b.type]) || a.address.localeCompare(b.address));
  return out;
}

// Si le port est deja pris, c'est que l'application est deja lancee : au lieu
// de planter avec une longue erreur, on l'indique clairement et on quitte.
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log('===================================================');
    console.log('  Gestion Commerciale est DEJA lancee.');
    console.log(`  Ouvrez simplement : http://localhost:${PORT}`);
    console.log('  (Inutile de la relancer une seconde fois.)');
    console.log('===================================================');
    process.exit(0);
  }
  console.error('Erreur serveur :', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Migration prestations 3.1 automatique au demarrage (sauvegarde complete avant,
// transaction, controle des donnees historiques). Sans effet si deja appliquee.
// En cas d'echec : la base reste intacte et le serveur ne demarre pas.
// ---------------------------------------------------------------------------
async function preparerAuDemarrage() {
  const etat = etatMigrationPrestations(DB_PATH);
  if (etat !== 'a-preparer') return;
  const journal = path.join(path.dirname(DB_PATH), 'Preparation-prestations.log');
  console.log('  Preparation des prestations : sauvegarde puis migration...');
  try {
    const result = await preparerPrestations(DB_PATH, path.join(path.dirname(DB_PATH), 'sauvegardes-prestations'));
    fs.appendFileSync(journal, JSON.stringify({ date: new Date().toISOString(), automatique: true, ...result }) + '\n');
    console.log('  Preparation terminee. Sauvegarde : ' + result.backup);
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    try { fs.appendFileSync(journal, new Date().toISOString() + ' | automatique | ' + message + '\n'); } catch { /* console conservee */ }
    throw new Error('Preparation des prestations impossible : ' + message + ' (base inchangee, voir ' + journal + ')');
  }
}

preparerAuDemarrage().then(() => server.listen(PORT, HOST, () => {
  const all = localAddresses();
  // On privilegie WiFi/Ethernet ; on n'affiche les virtuels que si rien d'autre
  const reels = all.filter(a => a.type !== 'Virtuel');
  const aAfficher = reels.length ? reels : all;
  console.log('===================================================');
  console.log('  Gestion Commerciale - serveur portable demarre');
  console.log('===================================================');
  console.log(`  Base de donnees : ${DB_PATH}`);
  console.log('---------------------------------------------------');
  console.log(`  Sur ce PC          : http://localhost:${PORT}`);
  if (aAfficher.length === 0) {
    console.log('  (Aucune connexion reseau detectee - PC hote uniquement)');
  } else {
    console.log('  Acces depuis les autres postes (meme WiFi/reseau) :');
    for (const a of aAfficher) {
      const label = a.type === 'WiFi' ? 'WiFi    ' : a.type === 'Ethernet' ? 'Ethernet' : 'Reseau  ';
      console.log(`    - ${label} : http://${a.address}:${PORT}`);
    }
  }
  if (all.some(a => a.type === 'Virtuel') && reels.length) {
    console.log('  (adaptateurs virtuels ignores : VirtualBox/WSL/VPN...)');
  }
  if (TOKEN) console.log("  Jeton d'acces      : ACTIVE");
  console.log('---------------------------------------------------');
  console.log("  Laissez cette fenetre ouverte pendant l'utilisation.");
  console.log('===================================================');
})).catch((e) => {
  console.error('[ERREUR] ' + (e && e.message ? e.message : e));
  try { db.close(); } catch { /* ignore */ }
  process.exit(1);
});
