import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';

export interface GestionProAsset { key: string; sha256: string; size: number; }
export interface GestionProManifest { format: 1; buildId: string; version: string; files: GestionProAsset[]; }
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export function applicationAsset(key: string): boolean {
  return !key.includes('\\') && !key.split('/').some(part => !part || part === '.' || part === '..')
    && (key.startsWith('dist/') || key === 'server/index.mjs' || key === 'server/runtime/prestations.mjs')
    && !/\.(?:db|sqlite|sqlite3)(?:-|$)/i.test(key);
}

/** Liste blanche : aucune donnée, sauvegarde, variable d’environnement ou dépendance npm embarquée. */
export function collectGestionProAssets(root: string, version: string): GestionProManifest {
  const keys = ['server/index.mjs', 'server/runtime/prestations.mjs'];
  function walk(directory: string) {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const key = directory + '/' + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Lien symbolique interdit dans les fichiers à embarquer : ' + key);
      if (entry.isDirectory()) walk(key); else if (entry.isFile()) keys.push(key);
    }
  }
  walk('dist');
  if (!keys.includes('dist/index.html')) throw new Error('Interface compilée absente.');
  const files = keys.sort().map(key => {
    if (!applicationAsset(key)) throw new Error('Fichier non autorisé dans l’exécutable : ' + key);
    if (!lstatSync(path.join(root, key)).isFile()) throw new Error('Fichier applicatif invalide : ' + key);
    const bytes = readFileSync(path.join(root, key));
    return { key, sha256: sha256(bytes), size: bytes.length };
  });
  return { format: 1, buildId: sha256(JSON.stringify({ version, files })).slice(0, 24), version, files };
}
