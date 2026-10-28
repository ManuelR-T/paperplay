/** Local PP-094 measurement harness, not a production execution endpoint. */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { build } from 'esbuild';
import { artifactCompilerPlugin } from './artifact-compiler-plugin.mjs';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { isolationCases } from './isolation/cases';
const output=await mkdtemp(join(tmpdir(),'paperplay-isolation-'));
await build({entryPoints:[resolve('scripts/isolation/worker.ts')],outfile:join(output,'worker.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',tsconfig:resolve('tsconfig.json')});
await build({entryPoints:[resolve('lib/artifacts/compiler-worker.ts')],outfile:join(output,'compiler.mjs'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',tsconfig:resolve('tsconfig.json'),plugins:[artifactCompilerPlugin]});
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paperplay isolation spike</title><h1>Isolated guest measurements</h1><p>Original reader/source remains separate.</p><p>Reader heartbeat: <output id="heartbeat">0</output></p><button id="stop">Stop all guests</button><button id="run">Run isolation probes</button><button id="compile">Run compiler probes</button><button id="download">Download probe report</button><svg id="scene" width="640" height="320" viewBox="0 0 640 320" role="img" aria-label="Trusted command renderer"></svg><pre id="result"></pre><script type="module" src="/host.mjs"></script></html>';
const fixture=await createDynamicSequenceArtifact();
const digest=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const metadata={workerSha256:digest(await readFile(join(output,'worker.mjs'))),engineSha256:digest(await readFile('lib/artifacts/guest-engine.ts')),casesSha256:digest(JSON.stringify(isolationCases)),fixtureSourceSha256:fixture.artifact.entry.sha256,sdkSha256:fixture.artifact.dependencyLock[0].sha256,interpreter:'quickjs-emscripten-core@0.32.0 / singlefile-browser-release-sync@0.32.0',wasmMaxBytes:64*1024*1024};
const requests:string[]=[];
const server=createServer(async(req,res)=>{
 const path=req.url??'';requests.push(path);if(requests.length>200)requests.shift();
 const policy=(path==='/worker.mjs'||path==='/compiler.mjs')?"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'":"default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
 res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
 try{if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(path==='/worker.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(join(output,'worker.mjs')));}else if(path==='/compiler.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(join(output,'compiler.mjs')));}else if(path==='/host.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('scripts/isolation/host.js'));}else if(path==='/fixture.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixture.artifact));}else if(path==='/cases.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(isolationCases));}else if(path==='/metadata'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(metadata));}else if(path==='/requests'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(requests));}else{res.statusCode=404;res.end('Not found');}}catch{res.statusCode=500;res.end('Harness asset unavailable');}
});
const close=()=>server.close(()=>{void rm(output,{recursive:true,force:true}).then(()=>process.exit(0));});process.once('SIGINT',close);process.once('SIGTERM',close);
server.listen(3002,'127.0.0.1',()=>console.log('Local isolation harness: http://127.0.0.1:3002 (no model endpoints; product execution remains disabled)'));
