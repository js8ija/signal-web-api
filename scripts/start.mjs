import { spawn } from 'node:child_process';
import { existsSync, symlinkSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prebuilds = join(root, 'prebuilds');
const target = join(root, 'node_modules/@signalapp/libsignal-client/prebuilds');
try {
  if (!existsSync(prebuilds) && existsSync(target)) {
    symlinkSync(target, prebuilds);
  } else if (existsSync(prebuilds)) {
    lstatSync(prebuilds); // ok if symlink or dir
  }
} catch (e) {
  console.warn('[start] prebuilds symlink:', e.message);
}

process.env.SIGNAL_ASSETS_ROOT ??= root;
process.env.PORT ??= '8915';

const child = spawn('npx', ['tsx', 'src/server/index.node.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});
child.on('exit', (code) => process.exit(code ?? 1));
