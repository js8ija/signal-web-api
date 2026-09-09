import { spawn } from 'node:child_process';
import { existsSync, symlinkSync, lstatSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prebuilds = join(root, 'prebuilds');
const target = join(root, 'node_modules/@signalapp/libsignal-client/prebuilds');

function isBrokenSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink() && !existsSync(path);
  } catch {
    return false;
  }
}

try {
  if (isBrokenSymlink(prebuilds)) {
    unlinkSync(prebuilds);
  }
  if (!existsSync(prebuilds) && existsSync(target)) {
    symlinkSync(target, prebuilds);
  }
} catch (e) {
  console.warn('[start] prebuilds symlink:', e.message);
}

process.env.SIGNAL_ASSETS_ROOT ??= root;
process.env.PORT ??= '8915';

const tsxCli = join(root, 'node_modules/tsx/dist/cli.mjs');
if (!existsSync(tsxCli)) {
  console.error('[start] tsx not found at', tsxCli, '— run npm install');
  process.exit(1);
}

const child = spawn(process.execPath, [tsxCli, 'src/server/index.node.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('[start] failed to spawn tsx:', err);
  process.exit(1);
});
