import { access, cp, mkdir, readFile, rm, symlink, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd();
const scratch = join(root, '.hosting-build'); const frontend = join(scratch, 'frontend'); const output = join(root, 'dist');
const exists = async (path: string) => { try { await access(path); return true; } catch { return false; } };
function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: options.cwd ?? root, env: options.env ?? process.env, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`Hosted build command failed with exit ${code}.`)));
  });
}
const manifestPath = await exists(join(root, '.openai', 'hosting.json')) ? join(root, '.openai', 'hosting.json') : join(root, '.paperplay-sites', '.openai', 'hosting.json');
if (!await exists(manifestPath)) throw new Error('Hosted build needs the retained .openai/hosting.json Site manifest. Local Next build/start does not require it.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.project_id || manifest.d1 !== 'DB') throw new Error('Hosted Paperplay requires its retained Site identity and shared DB binding.');

await run(process.execPath, [join(root, 'scripts', 'build-engine-worker.mjs')]);

// Build only authored public UI. No environment file, runtime ledger or source checkout
// credential is copied into this isolated Next export directory.
await rm(frontend, { recursive: true, force: true }); await mkdir(frontend, { recursive: true });
for (const dir of ['components', 'data', 'lib', 'public', 'shared']) await cp(join(root, dir), join(frontend, dir), { recursive: true });
await cp(join(root, 'app'), join(frontend, 'app'), { recursive: true, filter: source => {
  const path = relative(join(root, 'app'), source).split(/[\\/]/)[0]; return path !== 'api' && path !== 's';
} });
for (const name of ['package.json', 'postcss.config.mjs', 'tsconfig.json', 'next-env.d.ts']) if (await exists(join(root, name))) await cp(join(root, name), join(frontend, name));
await symlink(join(root, 'node_modules'), join(frontend, 'node_modules'), 'dir');
await writeFile(join(frontend, 'next.config.mjs'), `export default ${JSON.stringify({ output: 'export', poweredByHeader: false, reactStrictMode: true, images: { unoptimized: true }, turbopack: { root }, outputFileTracingRoot: root })};\n`);
const safeEnvironment: NodeJS.ProcessEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(safeEnvironment)) if (/MODEL_API_KEY|SIGNING_SECRET|UPSTASH|SHORT_LINKS|META_|ANALYSIS_APP_ORIGIN|USAGE_/i.test(key)) delete safeEnvironment[key];
await run(process.execPath, [join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', frontend], { env: safeEnvironment });
await rm(join(output, 'client'), { recursive: true, force: true }); await mkdir(join(output, 'server'), { recursive: true });
await cp(join(frontend, 'out'), join(output, 'client'), { recursive: true });

// The backend retains the exact tested Web Request/Response handlers. D1 is
// injected for every paid route; local SQLite is never a hosted fallback.
await build({
  absWorkingDir: root, entryPoints: [join(root, 'deploy', 'worker.ts')], outfile: join(output, 'server', 'index.js'),
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', mainFields: ['browser', 'module', 'main'], conditions: ['worker', 'browser', 'import'],
  minify: true, sourcemap: false, legalComments: 'eof',
  plugins: [{ name: 'hosted-runtime-only', setup(builder) {
    builder.onResolve({ filter: /^node:sqlite$/ }, () => ({ path: join(root, 'deploy', 'sqlite-unavailable.ts') }));
    builder.onResolve({ filter: /^node:/ }, args => ({ path: args.path, external: true }));
    builder.onResolve({ filter: /(?:^|\/)usage\/service$/ }, () => ({ path: join(root, 'deploy', 'usage-store-unavailable.ts') }));
  } }],
});
const db = { binding: 'DB', database_name: 'paperplay-shared', database_id: '00000000-0000-4000-8000-000000000000', migrations_dir: '../.openai/drizzle' };
await writeFile(join(output, 'server', 'wrangler.json'), JSON.stringify({ name: 'paperplay', main: 'index.js', compatibility_date: '2026-10-27', compatibility_flags: ['nodejs_compat'],
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: true }, d1_databases: [db] }, null, 2) + '\n');

// Preserve the actual Sites build integration: its closeBundle hook packages the
// retained hosting manifest and Drizzle journal into dist/.openai.
const metadataRoot = join(scratch, 'metadata');
await mkdir(join(metadataRoot, '.openai'), { recursive: true }); await mkdir(join(metadataRoot, 'drizzle', 'meta'), { recursive: true });
await writeFile(join(metadataRoot, '.openai', 'hosting.json'), JSON.stringify(manifest, null, 2) + '\n');
await cp(join(root, 'deploy', 'migrations', '0000_paperplay.sql'), join(metadataRoot, 'drizzle', '0000_paperplay.sql'));
await writeFile(join(metadataRoot, 'drizzle', 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'sqlite', entries: [{ idx: 0, version: '6', when: Date.UTC(2026, 9, 27), tag: '0000_paperplay', breakpoints: true }] }, null, 2) + '\n');
const suppliedPlugin = join(root, 'scripts', 'vite', 'sites-vite-plugin.ts');
const pluginModule = await import(pathToFileURL(await exists(suppliedPlugin) ? suppliedPlugin : join(root, 'deploy', 'vendor', 'sites-vite-plugin.mts')).href);
const plugin = pluginModule.sites({ mockAuth: false });
await plugin.configResolved({ root: metadataRoot, command: 'build' }); await plugin.closeBundle();
await rm(join(output, '.openai'), { recursive: true, force: true }); await cp(join(metadataRoot, 'dist', '.openai'), join(output, '.openai'), { recursive: true });

async function filesUnder(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name); if (item.isDirectory()) result.push(...await filesUnder(path)); else result.push(path);
  }
  return result;
}
const privateValues = ['MODEL_API_KEY', 'ANALYSIS_SIGNING_SECRET', 'SHORT_LINKS_SIGNING_SECRET', 'UPSTASH_REDIS_REST_TOKEN'].map(key => process.env[key]).filter((value): value is string => !!value && value.length > 8);
for (const path of await filesUnder(output)) {
  if (/(?:^|[/\\])\.env(?:[./\\]|$)|[/\\]\.paperplay[/\\]/.test(path)) throw new Error('Private runtime data entered the hosted artifact.');
  if (/\.(?:js|html|json|txt|css)$/.test(path)) {
    const content = await readFile(path, 'utf8'); if (privateValues.some(value => content.includes(value))) throw new Error('A configured private credential entered the hosted artifact.');
  }
}
console.log('Hosted artifact ready: dist/client + dist/server + dist/.openai. Runtime secrets are supplied separately.');
