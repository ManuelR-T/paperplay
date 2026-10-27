import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base = dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir('public/pdfjs', { recursive: true });
await cp(join(base, 'build/pdf.worker.min.mjs'), 'public/pdf.worker.min.mjs');
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) await cp(join(base, directory), join('public/pdfjs', directory), { recursive: true });
console.log('Copied PDF.js worker, CMaps, fonts and WASM to local public assets.');
