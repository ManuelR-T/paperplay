import { readFile, writeFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const rows = [];
const notices = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path || !path.startsWith('node_modules/')) continue;
  let pkg;
  try { pkg = JSON.parse(await readFile(`${path}/package.json`, 'utf8')); } catch { continue; }
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'COPYING']) {
    try { const text = await readFile(`${path}/${name}`, 'utf8'); notices.push(`\n${'='.repeat(72)}\n${pkg.name}@${pkg.version} · ${name}\n${'='.repeat(72)}\n${text}`); break; } catch { /* This package may use another license filename. */ }
  }
  rows.push({ name: pkg.name, version: pkg.version, license: typeof pkg.license === 'string' ? pkg.license : 'See installed package license', homepage: pkg.homepage ?? pkg.repository?.url ?? '' });
}
// Application-owned TypeScript port of the separately pinned upstream PCG reference.
// Keep its license and modification notice in distributable notices without an npm dependency.
for (const path of ['licenses/pcg-c-basic-LICENSE.txt', 'licenses/pcg32-NOTICE.txt']) {
  const text = await readFile(path, 'utf8');
  notices.push(`\n${'='.repeat(72)}\nPCG32 reference port · ${path}\n${'='.repeat(72)}\n${text}`);
}
rows.push({name:'pcg-c-basic (TypeScript port)',version:'bc39cd76ac3d541e618606bcc6e1e5ba5e5e6aa3',license:'Apache-2.0',homepage:'https://github.com/imneme/pcg-c-basic'});
rows.sort((a,b) => a.name.localeCompare(b.name));
const body = '# Dependency notice inventory\n\nGenerated from the installed, locked dependency tree and explicitly admitted source ports. Package license files remain authoritative; this inventory does not relicense dependencies or bundled papers. Only packages installed on this platform and admitted source ports appear below.\n\n| Package | Version | Declared license |\n| --- | --- | --- |\n' + rows.map(row => `| ${row.name} | ${row.version} | ${row.license.replaceAll('|', '/')} |`).join('\n') + '\n';
await writeFile('docs/dependency-notices.md', body);
await writeFile('THIRD_PARTY_NOTICES.txt', 'Third-party license notices from the installed locked dependency tree and admitted source ports.\nSource-paper licenses are recorded separately in public/papers/ATTRIBUTION.md and data source attribution.\n' + notices.join('\n').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, ''));
console.log(`Recorded ${rows.length} dependency/source-port declarations and ${notices.length} license texts.`);
