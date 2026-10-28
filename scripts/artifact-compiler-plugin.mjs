import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
/** Trusted project build plugin: exposes only the exact reviewed parser as text, never model files. */
export const artifactCompilerPlugin={name:'paperplay-pinned-acorn',setup(build){
 build.onStart(async()=>{const engine=await readFile(resolve('node_modules/@jitl/quickjs-singlefile-browser-release-sync/dist/emscripten-module.browser-XIKQQPVU.mjs'));if(createHash('sha256').update(engine).digest('hex')!=='49c171aa6ee9c782f40229c95cdfaeb282b6740dd8eea4cc8e655986276a766a')throw Error('Pinned interpreter module changed.');});
 build.onResolve({filter:/^paperplay:acorn-source$/},()=>({path:'pinned-acorn',namespace:'paperplay-parser'}));
 build.onLoad({filter:/^pinned-acorn$/,namespace:'paperplay-parser'},async()=>{const contents=await readFile(resolve('node_modules/acorn/dist/acorn.js'),'utf8');if(createHash('sha256').update(contents).digest('hex')!=='b95392d79457d0357555c5ed3e56302d074b92dff119bcf3b44179500b10e9df')throw Error('Pinned parser source changed.');return {contents,loader:'text'};});
}};
