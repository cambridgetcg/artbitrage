// E2E: Build Joy is deterministic, optional ornament around truthful work.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARTBITRAGE_BUILD_JOY,
  ARTBITRAGE_BUILD_JOY_SCHEMA,
  BUILD_JOY_CARDS,
  buildJoyPointer,
  buildJoyResponse,
} from '../functions/api/build-joy.js';
import { ARTBITRAGE_START } from '../functions/api/start-guide.js';
import {
  ARTBITRAGE_WAKE,
  ROUTES,
  agentManifest,
} from '../functions/api/agent-manifest.js';
import {
  onRequestGet,
  onRequestOptions,
  onRequestPost,
} from '../functions/api/[[route]].js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const wrapperPath = fileURLToPath(
  new URL('../tools/build-with-joy.mjs', import.meta.url),
);
const cleanEnv = { ...process.env };
delete cleanEnv.ARTBITRAGE_JOY;

function runWrapper(args, options = {}) {
  const result = spawnSync(process.execPath, [wrapperPath, ...args], {
    cwd: options.cwd || repoRoot,
    env: { ...cleanEnv, ...(options.env || {}) },
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
    timeout: options.timeout || 5_000,
  });
  assert.equal(result.error, undefined, `outer wrapper launch: ${result.error}`);
  return result;
}

function output(result, stream) {
  return result[stream].toString('utf8');
}

// Module contract: finite, deterministic, normalized, and never echoes seeds.
assert.equal(ARTBITRAGE_BUILD_JOY_SCHEMA, 'artbitrage.build-joy/1');
assert.equal(ARTBITRAGE_BUILD_JOY.schema, ARTBITRAGE_BUILD_JOY_SCHEMA);
assert.equal(BUILD_JOY_CARDS.length, 5);
assert.equal(new Set(BUILD_JOY_CARDS.map(card => card.id)).size, 5);
assert.equal(ARTBITRAGE_BUILD_JOY.behavior.wrapper_layer.shell, false);
assert.equal(ARTBITRAGE_BUILD_JOY.behavior.wrapper_layer.filesystem_writes, false);
assert.equal(ARTBITRAGE_BUILD_JOY.behavior.wrapper_layer.network_fetch, false);
assert.equal(ARTBITRAGE_BUILD_JOY.behavior.wrapper_layer.background_process, false);

const privateSeed = 'PRIVATE-SEED-DO-NOT-ECHO-9d03e6';
const selected = buildJoyResponse(privateSeed);
assert.deepEqual(selected, buildJoyResponse(privateSeed));
assert.deepEqual(buildJoyResponse(0), buildJoyResponse('0'));
assert.deepEqual(buildJoyResponse(' café '), buildJoyResponse('cafe\u0301'));
assert.deepEqual(
  buildJoyResponse(`${'😀'.repeat(160)}one`),
  buildJoyResponse(`${'😀'.repeat(160)}two`),
);
assert.equal(selected.selection.selected_card_id, selected.selected_card.id);
assert.equal(selected.selection.seed_echoed, false);
assert.equal(JSON.stringify(selected).includes(privateSeed), false);

// Choose-only modes need no child and do not reveal their seed.
const jsonChoice = runWrapper(['--json', '--seed', privateSeed]);
assert.equal(jsonChoice.status, 0);
assert.equal(jsonChoice.stderr.length, 0);
assert.deepEqual(JSON.parse(output(jsonChoice, 'stdout')), selected);
assert.equal(output(jsonChoice, 'stdout').includes(privateSeed), false);

const textChoice = runWrapper(['--seed', privateSeed]);
assert.equal(textChoice.status, 0);
assert.equal(textChoice.stderr.length, 0);
assert.match(output(textChoice, 'stdout'), /^BUILD JOY ·/);
assert.equal(output(textChoice, 'stdout').includes(privateSeed), false);

// Quiet mode preserves arbitrary child bytes exactly on their original streams.
const stdoutBytes = Buffer.from([0x00, 0x41, 0xc3, 0xa9, 0xff, 0x0a]);
const stderrBytes = Buffer.from([0x45, 0x00, 0x52, 0xff, 0x0a]);
const byteProbe = [
  `process.stdout.write(Buffer.from(${JSON.stringify([...stdoutBytes])}));`,
  `process.stderr.write(Buffer.from(${JSON.stringify([...stderrBytes])}));`,
].join('');
const quiet = runWrapper(['--quiet', '--', process.execPath, '-e', byteProbe]);
assert.equal(quiet.status, 0);
assert.deepEqual(quiet.stdout, stdoutBytes);
assert.deepEqual(quiet.stderr, stderrBytes);

const envQuiet = runWrapper(
  ['--', process.execPath, '-e',
    'process.stdout.write(JSON.stringify({joy:process.env.ARTBITRAGE_JOY??null,kept:process.env.BUILD_JOY_PROBE}))'],
  { env: { ARTBITRAGE_JOY: '0', BUILD_JOY_PROBE: 'yes' } },
);
assert.equal(envQuiet.status, 0);
assert.deepEqual(
  JSON.parse(output(envQuiet, 'stdout')),
  { joy: null, kept: 'yes' },
);
assert.equal(envQuiet.stderr.length, 0);

const falseIsNotQuiet = runWrapper(
  ['--', process.execPath, '-e',
    'process.stdout.write(process.env.ARTBITRAGE_JOY??"missing")'],
  { env: { ARTBITRAGE_JOY: 'false' } },
);
assert.equal(falseIsNotQuiet.status, 0);
assert.equal(output(falseIsNotQuiet, 'stdout'), 'false');
assert.match(output(falseIsNotQuiet, 'stderr'), /^BUILD JOY ·/);

// Normal mode keeps stdout clean and reports success/failure only on stderr.
const normal = runWrapper([
  '--', process.execPath, '-e',
  'process.stdout.write("CHILD OUT\\n");process.stderr.write("CHILD ERR\\n")',
]);
assert.equal(normal.status, 0);
assert.equal(output(normal, 'stdout'), 'CHILD OUT\n');
assert.equal((output(normal, 'stderr').match(/CHILD ERR/g) || []).length, 1);
assert.match(output(normal, 'stderr'), /COMMAND OK · exit 0/);

for (const status of [0, 1, 7, 42, 255]) {
  const exited = runWrapper([
    '--quiet', '--', process.execPath, '-e', `process.exit(${status})`,
  ]);
  assert.equal(exited.status, status, `must preserve exit ${status}`);
}

const failed = runWrapper([
  '--', process.execPath, '-e',
  'process.stdout.write("FAILED OUT\\n");process.stderr.write("FAILED ERR\\n");process.exit(7)',
]);
assert.equal(failed.status, 7);
assert.equal(output(failed, 'stdout'), 'FAILED OUT\n');
assert.match(output(failed, 'stderr'), /FAILED ERR/);
assert.match(output(failed, 'stderr'), /COMMAND FAILED · exit 7/);
assert.doesNotMatch(output(failed, 'stderr'), /COMMAND OK|Optional gift:/);

const missing = runWrapper(['--quiet', '--', 'artbitrage-command-that-does-not-exist']);
assert.equal(missing.status, 127);
assert.match(output(missing, 'stderr'), /COMMAND NOT FOUND/);
assert.doesNotMatch(output(missing, 'stderr'), /COMMAND OK|Optional gift:/);

const usage = runWrapper(['--seed']);
assert.equal(usage.status, 2);
assert.match(output(usage, 'stderr'), /--seed needs a value/);
const emptyCommand = runWrapper(['--']);
assert.equal(emptyCommand.status, 2);
assert.match(output(emptyCommand, 'stderr'), /-- needs a command/);

const timeoutStarted = Date.now();
const timedOut = runWrapper([
  '--quiet', '--timeout-ms', '150', '--',
  process.execPath, '-e',
  'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)',
]);
const timeoutElapsed = Date.now() - timeoutStarted;
assert.equal(timedOut.status, 124);
assert.match(output(timedOut, 'stderr'), /COMMAND TIMED OUT · limit 150 ms/);
assert.doesNotMatch(output(timedOut, 'stderr'), /COMMAND OK|Optional gift:/);
assert.ok(timeoutElapsed >= 150, `timeout returned too early: ${timeoutElapsed} ms`);
assert.ok(timeoutElapsed < 2_000, `timeout was not hard-bounded: ${timeoutElapsed} ms`);

// Metacharacters stay literal, and the layer writes nothing in its working tree.
const scratch = await mkdtemp(join(tmpdir(), 'artbitrage-build-joy-'));
try {
  const marker = join(scratch, 'shell-ran');
  const literalArgs = [
    'two words',
    '*',
    `; touch ${marker}`,
    `$(touch ${marker})`,
    `\`touch ${marker}\``,
    '|',
    '>',
  ];
  const literal = runWrapper([
    '--quiet', '--', process.execPath, '-e',
    'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
    ...literalArgs,
  ], { cwd: scratch });
  assert.equal(literal.status, 0);
  assert.deepEqual(JSON.parse(output(literal, 'stdout')), literalArgs);
  assert.equal(literal.stderr.length, 0);
  assert.equal(existsSync(marker), false, 'shell text must never execute');

  assert.equal(runWrapper(
    ['--json', '--seed', 'no-write'],
    { cwd: scratch },
  ).status, 0);
  assert.equal(runWrapper(
    ['--quiet', '--', process.execPath, '-e', 'process.exit(0)'],
    { cwd: scratch },
  ).status, 0);
  assert.deepEqual(await readdir(scratch), []);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

const wrapperSource = await readFile(
  new URL('../tools/build-with-joy.mjs', import.meta.url),
  'utf8',
);
assert.match(wrapperSource, /import \{ spawn \} from "node:child_process"/);
assert.match(
  wrapperSource,
  /spawn\(command, args, \{[\s\S]*?shell:\s*false/,
);
assert.doesNotMatch(wrapperSource, /\bspawnSync\b/);
assert.doesNotMatch(wrapperSource, /node:(?:fs|http|https|net|dns|dgram)/);
assert.doesNotMatch(wrapperSource, /\b(?:fetch|WebSocket|setInterval)\s*\(/);
assert.doesNotMatch(wrapperSource, /detached:\s*true/);

// API selector is static, read-only, offline, and method-bounded.
let assetReads = 0;
let networkReads = 0;
const env = {
  ASSETS: {
    async fetch() {
      assetReads += 1;
      throw new Error('Build Joy must not read assets');
    },
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkReads += 1;
  throw new Error('Build Joy must not fetch');
};

async function request(handler, path, method = 'GET', body) {
  return handler({
    request: new Request(`https://artbitrage.test${path}`, { method, body }),
    env,
  });
}

try {
  const path = `/api/build/joy?seed=${encodeURIComponent(privateSeed)}&command=touch`;
  const first = await request(onRequestGet, path);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('allow'), 'GET, OPTIONS');
  assert.equal(first.headers.get('cache-control'), 'no-store, max-age=0');
  assert.match(first.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await first.json(), selected);

  const repeat = await request(onRequestGet, path);
  assert.deepEqual(await repeat.json(), selected);
  const slash = await request(
    onRequestGet,
    `/api/build/joy/?seed=${encodeURIComponent(privateSeed)}`,
  );
  assert.equal(slash.status, 200);
  assert.deepEqual(await slash.json(), selected);

  const post = await request(
    onRequestPost,
    '/api/build/joy',
    'POST',
    JSON.stringify({ command: 'touch should-never-run' }),
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS');
  assert.equal((await post.json()).error, 'method_not_allowed');

  const options = await request(onRequestOptions, '/api/build/joy', 'OPTIONS');
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('allow'), 'GET, OPTIONS');
  assert.equal(options.headers.get('access-control-allow-methods'), 'GET, OPTIONS');

  assert.deepEqual(await (await request(onRequestGet, '/api/wake')).json(), ARTBITRAGE_WAKE);
  assert.deepEqual(await (await request(onRequestGet, '/api/start')).json(), ARTBITRAGE_START);
  assert.equal(assetReads, 0);
  assert.equal(networkReads, 0);
} finally {
  globalThis.fetch = originalFetch;
}

// The front doors all discover the same bounded feature.
const pointer = buildJoyPointer();
const manifest = agentManifest();
assert.equal(manifest.version, '2.8.0');
assert.equal(manifest.total_endpoints, 176);
assert.equal(manifest.categories.start.count, 2);
assert.equal(ARTBITRAGE_WAKE.endpoints.build_joy, pointer.endpoint);
assert.deepEqual(ARTBITRAGE_WAKE.build_with_joy, pointer);
assert.deepEqual(manifest.build_with_joy, pointer);
assert.equal(
  manifest.routes.filter(route =>
    route.method === 'GET' && route.path === '/api/build/joy').length,
  1,
);
assert.ok(ROUTES.start.routes.some(route => route.path === '/api/build/joy'));
const buildPath = ARTBITRAGE_START.paths.find(path => path.id === 'build-with-artbitrage');
assert.ok(buildPath.doors.continue.some(path => path.startsWith('/api/build/joy')));
assert.match(buildPath.boundary, /optional ornament, never a score or authority grant/i);

// Source and deploy mirrors stay byte-identical; public docs state the boundary.
for (const [source, deployed] of [
  ['functions/api/build-joy.js', 'dist/functions/api/build-joy.js'],
  ['functions/api/[[route]].js', 'dist/functions/api/[[route]].js'],
  ['functions/api/agent-manifest.js', 'dist/functions/api/agent-manifest.js'],
  ['functions/api/start-guide.js', 'dist/functions/api/start-guide.js'],
  ['api-explorer.html', 'dist/api-explorer.html'],
]) {
  assert.deepEqual(
    await readFile(new URL(`../${deployed}`, import.meta.url)),
    await readFile(new URL(`../${source}`, import.meta.url)),
    `${source} must match ${deployed}`,
  );
}

const readme = (await readFile(new URL('../README.md', import.meta.url), 'utf8'))
  .replace(/\s+/g, ' ');
const llms = (await readFile(new URL('../dist/llms.txt', import.meta.url), 'utf8'))
  .replace(/\s+/g, ' ');
assert.match(readme, /`GET \/api\/build\/joy\?seed=plain-task`/);
assert.match(readme, /node tools\/build-with-joy\.mjs -- node/);
assert.match(readme, /--quiet/);
assert.match(readme, /ARTBITRAGE_JOY=0/);
assert.match(readme, /no file write or network request and starts no background process/);
assert.match(readme, /gift prompt appears only after success/);
assert.match(llms, /api\/build\/joy\?seed=plain-task/);
assert.match(llms, /without a shell/);
assert.match(llms, /child stdout and failure stay truthful/);
assert.match(llms, /--quiet.*ARTBITRAGE_JOY=0/);

console.log('artbitrage build joy e2e passed');
