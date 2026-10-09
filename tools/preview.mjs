#!/usr/bin/env node

// Run the real Pages router with local assets and local KV, without Workers AI.
// A temporary project keeps the production bindings and credentials files out
// of the preview configuration. Requires the existing Wrangler CLI.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: node tools/preview.mjs [--port 8797]\nRequires Wrangler on PATH. Serves localhost only; AI is unavailable; KV is temporary.';
const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log(usage);
  process.exit(0);
}
const port = args.length === 0 ? 8797 : Number(args[1]);
if ((args.length !== 0 && (args.length !== 2 || args[0] !== '--port'))
    || !Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error(usage);
  process.exit(2);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(join(tmpdir(), 'artbitrage-preview-'));
let child;
const forwardSignal = signal => child?.kill(signal);
const onInterrupt = () => forwardSignal('SIGINT');
const onTerminate = () => forwardSignal('SIGTERM');
try {
  await symlink(join(root, 'functions'), join(work, 'functions'), 'dir');
  await writeFile(join(work, 'wrangler.toml'), [
    'name = "artbitrage-local-preview"',
    'compatibility_date = "2024-01-01"',
    `pages_build_output_dir = ${JSON.stringify(root)}`,
    '',
  ].join('\n'));
  console.log(`Artbitrage preview: http://127.0.0.1:${port}`);
  console.log('Uses the Pages router and current files. AI is unavailable; local KV is discarded on exit.');
  child = spawn('wrangler', [
    'pages', 'dev', root, '--ip', '127.0.0.1', '--port', String(port),
    '--inspector-port', '0', '--kv', 'PEBBLES', '--show-interactive-dev-session=false',
  ], {
    cwd: work,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdio: 'inherit',
  });
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143)));
  });
} catch (error) {
  console.error(error.code === 'ENOENT'
    ? 'Wrangler was not found. Make the existing Wrangler CLI available on PATH.'
    : error.message);
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', onInterrupt);
  process.removeListener('SIGTERM', onTerminate);
  await rm(work, { recursive: true, force: true });
}
