/** Construction d’un exécutable web autonome. Aucun accès aux bases SQLite. */
import { build } from 'vite';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectGestionProAssets, sha256, type GestionProManifest } from './gestionproAssets.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function run(command: string, args: string[], capture = false) {
  const result = spawnSync(command, args, { cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} a échoué (${result.status}). ${capture ? result.stderr : ''}`);
  return result.stdout || '';
}

async function main() {
  const preparation = process.argv.includes('--preparer-prestations');
  const executableName = preparation ? 'Preparer-prestations.exe' : 'GestionPro.exe';
  if (process.platform !== 'win32') throw new Error('La construction de GestionPro.exe doit être exécutée sous Windows.');
  const portable = path.join(root, 'node', 'node.exe');
  const runtime = existsSync(portable) ? portable : process.execPath;
  const runtimeVersion = JSON.parse(run(runtime, ['-p', 'JSON.stringify({version:process.versions.node,arch:process.arch})'], true)) as { version: string; arch: string };
  const [major,minor] = runtimeVersion.version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 20)) throw new Error('Node 22.20 ou plus récent est requis pour générer GestionPro.exe.');
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
  const manifest: GestionProManifest = preparation ? { format: 1, version: pkg.version, files: [],
    buildId: sha256(['scripts/preparer-prestations.ts','server/preparerPrestations.ts','src/database/migration_prestations_v1.ts']
      .map(file => readFileSync(path.join(root,file),'utf8')).join('\n')).slice(0,24) } : collectGestionProAssets(root, pkg.version);
  const stagingRoot = path.join(root, '.build-gestionpro'); mkdirSync(stagingRoot, { recursive: true });
  const stage = mkdtempSync(path.join(stagingRoot, 'build-'));
  try {
    await build({ configFile: false, build: { target: 'node22', outDir: stage, emptyOutDir: false, minify: false,
      lib: { entry: path.join(root,'scripts',preparation ? 'preparer-prestations.ts' : 'gestionproBootstrap.ts'), formats: ['cjs'], fileName: () => 'bootstrap.cjs' },
      rollupOptions: { external: id => id.startsWith('node:'), output: { inlineDynamicImports: true } },
    } });
    const manifestPath = path.join(stage, 'manifest.json'); writeFileSync(manifestPath, JSON.stringify(manifest));
    const assets = Object.fromEntries(manifest.files.map(file => [file.key, path.join(root, file.key)]));
    assets['gestionpro-manifest.json'] = manifestPath;
    const config = path.join(stage,'sea-config.json');
    writeFileSync(config, JSON.stringify({ main: path.join(stage,'bootstrap.cjs'), output: path.join(stage,'app.blob'),
      disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, execArgv: ['--experimental-sqlite'], assets }));
    console.log(`${executableName} : Node ${runtimeVersion.version} (${runtimeVersion.arch}) ; aucune base embarquée.`);
    run(runtime, ['--experimental-sea-config', config]);
    const executable = path.join(stage, executableName); copyFileSync(runtime, executable);
    run(process.execPath, [path.join(root,'node_modules','postject','dist','cli.js'), executable, 'NODE_SEA_BLOB', path.join(stage,'app.blob'),
      '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']);
    const check = JSON.parse(run(executable, ['--check'], true)) as { application: string; buildId: string; mode: string };
    if (preparation ? check.application !== 'GestionPro-Preparation' || check.mode !== 'maintenance'
      : check.application !== 'GestionPro' || check.mode !== 'web' || check.buildId !== manifest.buildId) throw new Error('Vérification du nouvel exécutable échouée.');
    const target = path.join(root, executableName);
    if (existsSync(target)) {
      const backups = path.join(root, 'backups', 'builds'); mkdirSync(backups, { recursive: true });
      copyFileSync(target, path.join(backups, path.basename(executableName,'.exe') + '-' + new Date().toISOString().replace(/[:.]/g,'-') + '.exe'));
    }
    // Renommage final seulement après la vérification ; si le fichier est ouvert, l’ancienne version reste intacte.
    renameSync(executable, target);
    writeFileSync(path.join(root, path.basename(executableName,'.exe') + '.build.json'), JSON.stringify({ application: check.application, mode: check.mode,
      version: pkg.version, buildId: manifest.buildId, files: manifest.files.length, runtime: runtimeVersion,
      generatedAt: new Date().toISOString() }, null, 2));
    console.log('Compilation terminée : ' + target);
    console.log(preparation ? 'Outil manuel prêt : placer à côté de GestionPro.exe et du dossier data.'
      : 'Le dossier data existant est conservé. Double-cliquez sur GestionPro.exe pour ouvrir l’application.');
  } finally {
    // Seul le sous-dossier temporaire créé ici est supprimé ; vérification des chemins absolus avant suppression.
    const allowed = realpathSync(stagingRoot); const resolved = realpathSync(stage);
    if (path.dirname(resolved) !== allowed || !path.basename(resolved).startsWith('build-')) throw new Error('Nettoyage temporaire refusé.');
    rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => { console.error('Compilation GestionPro : ' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; });
