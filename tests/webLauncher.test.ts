import { test, assert } from './helpers/prestationFixture.ts';

interface FsApi {
  mkdtempSync(prefix: string): string;
  readFileSync(path: URL, encoding: string): string;
  writeFileSync(path: string, content: string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
}
interface PathApi { join(...parts: string[]): string; }
interface ProcessApi { env: Record<string, string | undefined>; platform: string; }
interface ChildApi { spawnSync(command: string, args: string[], options: { cwd: string; encoding: 'utf8' }): { status: number | null; stdout: string; stderr: string }; }
async function native<T>(name: string): Promise<T> { return await import(name) as T; }
const fs = await native<FsApi>('node:fs');
const path = await native<PathApi>('node:path');
const os = await native<{ tmpdir(): string }>('node:os');
const child = await native<ChildApi>('node:child_process');
const { default: process } = await native<{ default: ProcessApi }>('node:process');
const batch = fs.readFileSync(new URL('../Lancer-Gestion-Commerciale.bat', import.meta.url), 'utf8');

test('lanceur web : Node portable, repli Node installe et runtime absent sans ouverture de base', async () => {
  if (process.platform !== 'win32') return;
  for (const mode of ['portable', 'systeme', 'runtime-absent']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-lanceur-web avec espaces-'));
    fs.writeFileSync(path.join(dir, 'Lancer-Gestion-Commerciale.bat'), batch);
    if (mode === 'portable') {
      fs.mkdirSync(path.join(dir, 'node'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node', 'node.exe'), 'FAUX : NE PAS EXECUTER');
    }
    if (mode !== 'runtime-absent') {
      fs.mkdirSync(path.join(dir, 'server', 'runtime'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'server', 'runtime', 'prestations.mjs'), '// factice');
    }
    const result = child.spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'Lancer-Gestion-Commerciale.bat --check'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, mode === 'runtime-absent' ? 1 : 0, result.stderr);
    if (mode === 'runtime-absent') assert.ok(result.stdout.includes('serveur de prestations compile est absent'));
    else {
      assert.ok(result.stdout.includes('Mode : web')); assert.ok(result.stdout.includes(path.join(dir, 'data', 'gestion-commerciale.db')));
      assert.ok(result.stdout.includes(mode === 'portable' ? path.join(dir, 'node', 'node.exe') : 'Node : node'));
    }
  }
  assert.ok(!batch.includes('target\\release')); assert.ok(batch.includes('server\\index.mjs'));
});
