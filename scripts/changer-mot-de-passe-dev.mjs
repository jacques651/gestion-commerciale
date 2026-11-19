// scripts/changer-mot-de-passe-dev.mjs
// Change le mot de passe développeur commun à toutes les installations.
// Écrit uniquement une empreinte salée dans config/developpeur.json (jamais le mot de passe).
// Le nouveau mot de passe s'applique après recompilation (build.bat) et redistribution de GestionPro.exe.
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fichier = path.join(racine, 'config', 'developpeur.json');

function saisieMasquee(question) {
  return new Promise((resolve) => {
    const entree = process.stdin;
    process.stdout.write(question);
    if (!entree.isTTY) {
      // Entrée redirigée (tests) : lignes lues une à une depuis un tampon commun.
      if (!saisieMasquee.lignes) {
        saisieMasquee.lignes = [];
        saisieMasquee.attente = [];
        entree.setEncoding('utf8');
        let reste = '';
        entree.on('data', (d) => {
          reste += d;
          const parts = reste.split(/\r?\n/); reste = parts.pop();
          for (const l of parts) { const r = saisieMasquee.attente.shift(); if (r) r(l); else saisieMasquee.lignes.push(l); }
        });
        entree.on('end', () => { while (saisieMasquee.attente.length) saisieMasquee.attente.shift()(reste); });
      }
      process.stdout.write('\n');
      if (saisieMasquee.lignes.length) resolve(saisieMasquee.lignes.shift()); else saisieMasquee.attente.push(resolve);
      return;
    }
    let valeur = '';
    entree.setRawMode(true); entree.resume(); entree.setEncoding('utf8');
    const lire = (caractere) => {
      for (const c of caractere) {
        if (c === '\r' || c === '\n') {
          entree.setRawMode(false); entree.pause(); entree.removeListener('data', lire);
          process.stdout.write('\n'); resolve(valeur); return;
        }
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(1); }
        if (c === '\u0008' || c === '\u007f') { if (valeur) { valeur = valeur.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        valeur += c; process.stdout.write('*');
      }
    };
    entree.on('data', lire);
  });
}

console.log('CHANGEMENT DU MOT DE PASSE DEVELOPPEUR');
console.log('Commun a toutes les installations. Insensible a la casse. 8 caracteres minimum.\n');
const premier = (await saisieMasquee('Nouveau mot de passe   : ')).trim();
const second = (await saisieMasquee('Confirmer le mot de passe : ')).trim();
if (premier.length < 8) { console.error('\n[ERREUR] 8 caracteres minimum. Rien n a ete modifie.'); process.exit(1); }
if (premier.toUpperCase() !== second.toUpperCase()) { console.error('\n[ERREUR] Les deux saisies different. Rien n a ete modifie.'); process.exit(1); }

const sel = randomBytes(16).toString('hex');
const empreinte = createHash('sha256').update(sel + premier.toUpperCase()).digest('hex');
mkdirSync(path.dirname(fichier), { recursive: true });
writeFileSync(fichier, JSON.stringify({
  commentaire: 'Empreinte du mot de passe developpeur (jamais le mot de passe en clair). Modifier avec Changer-mot-de-passe-developpeur.bat puis recompiler avec build.bat.',
  sel, empreinte,
}, null, 2) + '\r\n');
console.log('\n[OK] Mot de passe developpeur enregistre (empreinte dans config\\developpeur.json).');
console.log('Etape suivante : lancer build.bat, puis redistribuer GestionPro.exe.');
console.log('Les installations deja deployees gardent l ancien mot de passe jusqu a leur mise a jour.');
