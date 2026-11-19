/** Outil portable explicite, exécuté séparément de GestionPro.exe. Node et migration embarqués. */
import { isSea } from 'node:sea';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { preparerPrestations } from '../server/preparerPrestations.ts';

async function main() {
  const directory = isSea() ? path.dirname(process.execPath) : process.cwd();
  const data = path.resolve(directory, process.env.GC_DATA || 'data');
  const source = path.resolve(directory, process.env.GC_DB || path.join(data, 'gestion-commerciale.db'));
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({ application: 'GestionPro-Preparation', mode: 'maintenance', database: source })); return;
  }
  try {
    console.log('PREPARATION DES PRESTATIONS\n');
    console.log('Base utilisee : ' + source);
    console.log('Sauvegarde complete, puis mise a jour de la structure. Veuillez patienter...\n');
    const result = await preparerPrestations(source, path.join(path.dirname(source), 'sauvegardes-prestations'));
    console.log(result.alreadyApplied ? 'Les prestations sont deja preparees.' : 'PREPARATION TERMINEE.');
    console.log('Vos anciennes donnees sont conservees.');
    console.log('Sauvegarde : ' + result.backup);
    console.log('\nRetournez dans GestionPro et appuyez sur F5.');
    appendFileSync(path.join(directory, 'Preparation-prestations.log'), JSON.stringify(result) + '\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\nPREPARATION IMPOSSIBLE : ' + message);
    console.error('Ne supprimez pas le dossier data. Conservez ce message pour le diagnostic.');
    try { appendFileSync(path.join(directory, 'Preparation-prestations.log'), new Date().toISOString() + ' | ' + message + '\n'); } catch { /* console conservée */ }
    process.exitCode = 1;
  }
  if (process.stdin.isTTY && !process.argv.includes('--no-pause')) {
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try { await reader.question('\nAppuyez sur Entree pour fermer cette fenetre.'); } finally { reader.close(); }
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
