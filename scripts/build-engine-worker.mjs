import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
await mkdir('public', { recursive: true });
await build({ entryPoints: [resolve('lib/execution/worker.ts')], outfile: resolve('public/engine.worker.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof', tsconfig: resolve('tsconfig.json') });
console.log('Built the trusted engine worker as executable browser ESM.');

await build({ entryPoints: [resolve('lib/widgets/worker.ts')], outfile: resolve('public/widget.worker.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof', tsconfig: resolve('tsconfig.json') });
await build({ entryPoints: [resolve('lib/reading/search-worker.ts')], outfile: resolve('public/library.worker.mjs'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof', tsconfig: resolve('tsconfig.json') });

// Only trusted compiler infrastructure is bundled here; generated source is never a build entry.
const { artifactCompilerPlugin } = await import('./artifact-compiler-plugin.mjs');
await build({ entryPoints:[resolve('lib/artifacts/compiler-worker.ts')],outfile:resolve('public/artifact-compiler.worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',tsconfig:resolve('tsconfig.json'),plugins:[artifactCompilerPlugin] });
