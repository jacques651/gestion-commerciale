/** Migration MANUELLE de la base web, jamais appelée par le serveur ou le lanceur. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparerPrestations } from '../server/preparerPrestations.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.GC_DB || path.join(process.env.GC_DATA || path.join(root, 'data'), 'gestion-commerciale.db'));
const testCopy = process.argv.includes('--test-copy');
if (!testCopy && !process.argv.includes('--apply')) throw new Error('Préciser --test-copy ou --apply. Aucune modification effectuée.');
const directory = testCopy ? mkdtempSync(path.join(tmpdir(), 'gc-web-migration-')) : path.join(root, 'backups');
console.log(JSON.stringify(await preparerPrestations(source, directory, testCopy), null, 2));
