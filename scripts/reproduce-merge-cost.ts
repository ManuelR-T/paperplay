/** Explicit, provider-free replay of the original author's deterministic merge-cost experiment. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const commit = '4418605e48a9598a7980e4c432ecc79cf11a38e1';
if (!process.argv.includes('--run')) {
  console.log('Opt-in: npx tsx scripts/reproduce-merge-cost.ts --run. Downloads pinned MIT author code, needs Git + Linux taskset + a JDK compiler and up to 512 MiB JVM heap. No Meta calls.');
  process.exit(0);
}
const directory = await mkdtemp(join(tmpdir(), 'paperplay-merge-cost-'));
const checkout = join(directory, 'upstream'); const classes = join(directory, 'classes');
await exec('git', ['clone', '--quiet', '--no-checkout', 'https://github.com/sebawild/nearly-optimal-mergesort-code.git', checkout], { timeout: 60000 });
await exec('git', ['-C', checkout, 'checkout', '--quiet', commit], { timeout: 30000 });
const head = (await exec('git', ['-C', checkout, 'rev-parse', 'HEAD'])).stdout.trim();
if (head !== commit) throw Error('Author artifact does not match its pinned paper-release commit.');
async function javaSources(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const paths = await Promise.all(entries.map(entry => entry.isDirectory() ? javaSources(join(path, entry.name)) : entry.name.endsWith('.java') ? [join(path, entry.name)] : []));
  return paths.flat();
}
await mkdir(classes);
const sources = await javaSources(join(checkout, 'src'));
const driver = join(process.cwd(), 'scripts/fixtures/BoundedFigure5.java');
const java = await exec('java', ['-version']);
// This source/target translation runs under the installed JDK, not the paper's original JVM.
await exec('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-source', '8', '-target', '8', '-d', classes, ...sources, driver], { timeout: 60000 });
const started = Date.now();
const result = await exec('taskset', ['-c', '0', 'java', '-ea', '-Xmx512m', '-XX:+UnlockDiagnosticVMOptions', '-XX:-TieredCompilation', '-cp', classes, 'BoundedFigure5'], { timeout: 240000, maxBuffer: 200000 });
const rows = result.stdout.trim().split('\n').map(line => JSON.parse(line) as { algorithm: string; n: number; seed: number; repetition: number; mergeCost: number; sorted: boolean });
if (rows.length !== 12 || rows.some(row => !row.sorted)) throw Error('The bounded author replay did not complete all expected checks.');
const means = Object.fromEntries([...new Set(rows.map(row => row.algorithm))].map(algorithm => {
 const costs = rows.filter(row => row.algorithm === algorithm && row.repetition > 0).map(row => row.mergeCost);
 return [algorithm, costs.reduce((sum, value) => sum + value, 0) / costs.length];
}));
const powersort = Object.entries(means).find(([name]) => name.startsWith('PowerSort'))![1];
const topDown = Object.entries(means).find(([name]) => name.startsWith('TopDown'))![1];
const timsortTrot = means.TimsortTrot;
const report = { checkedAt: new Date().toISOString(), source: 'https://github.com/sebawild/nearly-optimal-mergesort-code/tree/' + commit,
 commit, license: 'MIT', paper: 'https://doi.org/10.4230/LIPIcs.ESA.2018.63', originalProtocol: 'Figure 5 / section 4.4; Timsort-drag, n=2^24, minimum run 32, author seed248442268.',
 scope: 'Deterministic merge-cost subexperiment replay, not a hardware runtime reproduction or verification of the browser TypeScript implementation.',
 environment: { java: (java.stdout + java.stderr).trim(), os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, heapLimitMiB: 512, core: 0 },
 modifications: ['Unmodified author algorithms and generator at the paper tag.', 'Own bounded harness: three generated inputs per method, first excluded, no timed warmup or runtime claim.', 'Installed JDK compiles source/target8; original Oracle8u161 and hardware not recreated.'],
 driverSha256: createHash('sha256').update(await readFile(driver)).digest('hex'), elapsedMs: Date.now() - started, rows, meanMergeCosts: means,
 comparison: { paperTimsortOverheadApprox: 0.30, observedTimsortTrotOverTopDown: timsortTrot / topDown - 1, powersortToTopDown: powersort / topDown,
 tolerance: 'Qualitative rounded-paper check only: 25–35% overhead; not a preregistered statistical tolerance or equality to inaccessible original CSVs.', consistentWithRoundedPaperClaim: timsortTrot / topDown - 1 >= .25 && timsortTrot / topDown - 1 <= .35 } };
await writeFile('docs/reproduction-merge-cost.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: 'docs/reproduction-merge-cost.json', completedChecks: rows.length, consistentWithRoundedPaperClaim: report.comparison.consistentWithRoundedPaperClaim }));
