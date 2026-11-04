import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {generationCandidateSchema} from '../../shared/artifact-generation';
import {canonicalArtifactJson} from '../../shared/figure-compilation';
import {sha256Text} from '../../lib/artifacts/sdk-source';
import {buildFigureArtifact} from '../../lib/artifacts/lifecycle';
import {compileFigureSource} from '../../lib/artifacts/compiler-engine';
import {compilerRequestFromBuild} from '../../lib/artifacts/compiler-request';
import {evaluateGuestFrame} from '../../lib/artifacts/guest-engine';
import {figureRuntimeInput} from '../../lib/artifacts/runtime-input';

// Render a saved Meta model into portable replay data using the real isolated interpreter.
// No scientific equations or drawing coordinates are replaced by the video editor.
const [candidatePath,sourcePath]=process.argv.slice(2);
if(!candidatePath||!sourcePath)throw Error('Usage: tsx export-figure-replay.ts admitted.json source-export.json');
const saved=JSON.parse(readFileSync(candidatePath,'utf8'));
const candidate=generationCandidateSchema.parse(saved.candidate??saved);
const source=JSON.parse(readFileSync(sourcePath,'utf8')).source;
assert.equal(candidate.sha256,await sha256Text(canonicalArtifactJson({plan:candidate.plan,artifact:candidate.artifact})));
const built=await buildFigureArtifact(candidate.artifact,source);
assert.equal(built.status,'ready');if(built.status!=='ready'||built.value.manifest.kind!=='generated')throw Error('Invalid model');
const compiled=await compileFigureSource(compilerRequestFromBuild(built.value),readFileSync('node_modules/acorn/dist/acorn.js','utf8'));
assert.equal(compiled.status,'ready');
const artifact=built.value.manifest,input=figureRuntimeInput(built.value);
const base=await evaluateGuestFrame(artifact,input,null,{kind:'initialize'});
const frames=[];
for(let n=-200;n<=200;n++){
 const value=n/100;
 const frame=await evaluateGuestFrame(artifact,input,base.state,{kind:'control',id:'a',value});
 assert.equal((frame.state as {a:number}).a,value);
 assert.ok(Math.abs(Number(frame.table.rows[0][1])-2*value/(1+value*value))<.00006);
 assert.ok(Math.abs(Number(frame.table.rows[1][1])-(value**4+3)/(1+value*value)**2)<.00006);
 frames.push({value,frame});
}
const dynamicIndices=base.marks.flatMap((mark,index)=>frames.some(({frame})=>JSON.stringify(frame.marks[index])!==JSON.stringify(mark))?[index]:[]);
const samples=frames.map(({value,frame})=>({value,geometry:dynamicIndices.map(index=>{
 const mark=frame.marks[index];if(mark.kind==='line')return [...mark.from,...mark.to];if(mark.kind==='text')return mark.at;
 throw Error('Unexpected moving mark; extend the replay format explicitly.');
}),rows:frame.table.rows}));
mkdirSync('demo-video/src/replay',{recursive:true});
writeFileSync('demo-video/src/replay/tilted-noise.json',JSON.stringify({artifactSha256:candidate.sha256,sourceCodeSha256:artifact.entry.sha256,title:artifact.title,base,dynamicIndices,samples}));
console.log(`Exported ${samples.length} validated model states; ${dynamicIndices.length} moving marks. Exact 1D moments checked.`);
