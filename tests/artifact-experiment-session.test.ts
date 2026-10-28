import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExperimentSession,type ExperimentSessionDependencies } from '../lib/artifacts/experiment-session';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { compileFigureSource } from '../lib/artifacts/compiler-engine';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { buildFigureArtifact } from '../lib/artifacts/lifecycle';
import { sha256Text } from '../lib/artifacts/sdk-source';
import { validateArtifactCacheRecord,type ArtifactCacheRecord } from '../shared/artifact-experiment';
import { FigureRuntimeError } from '../shared/figure-runtime';
import type { ArtifactExperimentStorage } from '../lib/artifacts/experiment-storage';
import type { FigureQualityFeedback } from '../shared/figure-quality';
const parser=readFileSync('node_modules/acorn/dist/acorn.js','utf8');
function memory(){
 const values=new Map<string,ArtifactCacheRecord>(),originals=new Map<string,string>();
 const storage:ArtifactExperimentStorage={warning:null,async get(key){return values.get(key);},async put(record){await validateArtifactCacheRecord(record);values.delete(record.key);values.set(record.key,record);originals.set(record.key,JSON.stringify(record));},async list(){return [...values.values()].reverse();},async removeRecord(id){for(const [key,record]of values)if(record.id===id)values.delete(key);},async removeOwner(){values.clear();},async exportOriginal(key){return originals.get(key);}};
 return {storage,values,originals};
}
function harness(){
 const counts={build:0,compile:0,execute:0,adapter:0};
 const deps:ExperimentSessionDependencies={async build(...args){counts.build++;return buildFigureArtifact(...args);},async compile(request){counts.compile++;return compileFigureSource(request,parser);},adapter(_built,_compiled,seed){counts.adapter++;return {id:'trusted-reference-session-test',async execute(artifact,input,state,event){counts.execute++;try{return await evaluateGuestFrame(artifact,input,state,event,{seed});}catch{throw new FigureRuntimeError('execution');}}};}};
 return {deps,counts};
}
async function fixture(){const data=await createDynamicSequenceArtifact();data.artifact.resources.maxExecutionMs=1000;return data;}
const passed:FigureQualityFeedback={status:'passed',diagnostics:[],framesChecked:1,textMeasurements:'not-run'};
test('opening is inert; exact transitions replay and private compile is reused across reopen',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();
 const session=createExperimentSession({...data,storage},deps);await session.open();assert.deepEqual(counts,{build:0,compile:0,execute:0,adapter:0});
 await session.step({kind:'initialize'});await session.step({kind:'control',id:'append'});assert.equal(session.snapshot().frame?.table.rows.length,1);assert.equal(counts.compile,1);assert.equal(counts.execute,2);
 await session.step({kind:'initialize'});await session.step({kind:'control',id:'append'});assert.equal(counts.execute,2);
 session.dispose();const reopened=createExperimentSession({...data,storage},deps);await reopened.open();assert.equal(reopened.snapshot().restored,true);assert.equal(reopened.snapshot().frame?.table.rows.length,1);assert.equal(reopened.snapshot().canInteract,false);assert.equal(counts.compile,1);assert.equal(counts.build,1);
 await reopened.resume();assert.equal(reopened.snapshot().canInteract,true);assert.equal(counts.compile,1);assert.equal(counts.build,1);assert.equal(counts.execute,2);
});
test('fresh runtime reload restores validated frames without rebuild, and interaction compiles exactly once',async()=>{
 const data=await fixture(),{storage}=memory(),first=harness();const session=createExperimentSession({...data,storage},first.deps);await session.open();await session.step({kind:'initialize'});await session.step({kind:'control',id:'append'});session.dispose();
 const fresh=harness(),reloaded=createExperimentSession({...data,storage},fresh.deps);await reloaded.open();assert.equal(reloaded.snapshot().restored,true);assert.equal(fresh.counts.build,0);assert.equal(fresh.counts.compile,0);assert.equal(fresh.counts.execute,0);
 await reloaded.resume();assert.equal(fresh.counts.compile,1);assert.equal(fresh.counts.execute,0);await reloaded.step({kind:'control',id:'append'});assert.equal(reloaded.snapshot().frame?.table.rows.length,2);assert.equal(fresh.counts.compile,1);assert.equal(fresh.counts.execute,1);
});
test('changed input order and seed invalidate execution, preserving the exact build and last configured settings',async()=>{
 const data=await fixture();data.artifact.interfaces.input=[{id:'a',kind:'number',description:'Authored a'},{id:'b',kind:'number',description:'Authored b'}];data.artifact.initialInput={a:1,b:2};
 const {storage}=memory(),{deps,counts}=harness(),session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});const initial=session.snapshot().identity!;
 await session.configure({input:{b:2,a:1},seed:13});assert.equal(session.snapshot().frame,null);assert.equal(session.snapshot().report,undefined);assert.notEqual(session.snapshot().identity?.inputSha256,initial.inputSha256);await session.step({kind:'initialize'});assert.equal(counts.compile,1);assert.equal(counts.execute,2);
 const reopened=createExperimentSession({...data,storage},deps);await reopened.open();assert.equal(reopened.snapshot().seed,13);assert.deepEqual(Object.keys(reopened.snapshot().input as object),['b','a']);assert.equal(reopened.snapshot().restored,true);assert.equal(counts.compile,1);
 await session.configure({seed:99});const configured=createExperimentSession({...data,storage},deps);await configured.open();assert.equal(configured.snapshot().seed,99);assert.equal(configured.snapshot().frame,null);
});
test('changed source/code cannot restore another artifact cache or reuse its private build',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();const session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});
 const altered=await fixture();altered.artifact.entry.source+='\n/* distinct authored source */';altered.artifact.entry.sha256=await sha256Text(altered.artifact.entry.source);
 const next=createExperimentSession({...altered,storage},deps);await next.open();assert.equal(next.snapshot().frame,null);await next.step({kind:'initialize'});assert.equal(counts.compile,2);
 const changed=await fixture();changed.source.title+=' revised';const sourceChange=createExperimentSession({...changed,storage},deps);await sourceChange.open();assert.equal(sourceChange.snapshot().frame,null);await sourceChange.step({kind:'initialize'});assert.equal(counts.compile,3);
});
test('reports are scoped to exact execution, environment and quality policy; quality changes retain frames/build',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();let checks=0;const session=createExperimentSession({...data,storage,environment:'host-320px'},deps);await session.open();await session.step({kind:'initialize'});const checker=async()=>{checks++;return passed;};
 await session.quality(checker,{environment:'host-320px'});await session.quality(checker,{environment:'host-320px'});assert.equal(checks,1);
 const reopened=createExperimentSession({...data,storage,environment:'host-320px'},deps);await reopened.open();assert.deepEqual(reopened.snapshot().report,passed);assert.equal(counts.compile,1);
 await reopened.quality(checker,{environment:'host-1200px'});assert.equal(checks,2);
 deps.qualityPolicyVersion='figure-quality-future-test';const newPolicy=createExperimentSession({...data,storage,environment:'host-320px'},deps);await newPolicy.open();assert.equal(newPolicy.snapshot().restored,true);assert.equal(newPolicy.snapshot().report,undefined);await newPolicy.quality(checker,{environment:'host-320px'});assert.equal(checks,3);assert.equal(counts.compile,1);
});
test('invalid domains/settings never run, and failed configuration is atomic',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();const session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});
 const frame=session.snapshot().frame;await session.step({kind:'control',id:'not-declared'});assert.equal(session.snapshot().error,'domain');assert.equal(session.snapshot().frame,frame);assert.equal(counts.execute,1);
 await session.configure({input:{unknown:123},seed:15});assert.equal(session.snapshot().seed,42);assert.equal(session.snapshot().frame,frame);await session.step({kind:'control',id:'append'});assert.equal(session.snapshot().seed,42);assert.equal(counts.execute,2);
});
test('cancelled compilation cannot publish or persist admission and explicit retry works',async()=>{
 const data=await fixture(),{storage,values}=memory(),{deps,counts}=harness();let compiling!:()=>void;let release!:()=>void;
 const reached=new Promise<void>(resolve=>{compiling=resolve;}),paused=new Promise<void>(resolve=>{release=resolve;}),original=deps.compile!;deps.compile=async(request,options)=>{compiling();await paused;return original(request,options);};
 const session=createExperimentSession({...data,storage},deps);await session.open();const pending=session.step({kind:'initialize'});await reached;session.stop();await pending;assert.equal(session.snapshot().frame,null);assert.equal([...values.values()].filter(r=>r.kind==='build').length,0);release();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(session.snapshot().frame,null);
 deps.compile=original;await session.step({kind:'initialize'});assert.equal(session.snapshot().status,'ready');assert.equal(counts.execute,1);
});
test('corrupt stored records preserve original bytes and do not create replacement work',async()=>{
 const data=await fixture(),{storage,values,originals}=memory(),{deps,counts}=harness();const session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});const [key,record]=[...values].find(([,r])=>r.kind==='execution')!;const corrupted={...record,schemaVersion:99} as unknown as ArtifactCacheRecord;values.set(key,corrupted);originals.set(key,'untouched-original-future-bytes');
 const fresh=harness(),reopened=createExperimentSession({...data,storage},fresh.deps);await reopened.open();assert.equal(reopened.snapshot().frame,null);assert.equal(reopened.snapshot().recovery?.original,'untouched-original-future-bytes');assert.equal(fresh.counts.compile,0);assert.equal(fresh.counts.execute,0);assert.equal(counts.compile,1);assert.equal(originals.get(key),'untouched-original-future-bytes');
});
test('parallel identical admissions share one compile; cancelling one waiter preserves the other',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();let arrived!:()=>void,release!:()=>void;const reached=new Promise<void>(resolve=>{arrived=resolve;}),pause=new Promise<void>(resolve=>{release=resolve;}),compile=deps.compile!;deps.compile=async(...args)=>{arrived();await pause;return compile(...args);};
 const first=createExperimentSession({...data,storage},deps),second=createExperimentSession({...data,storage},deps);await first.open();await second.open();const a=first.resume(),b=second.resume();await reached;await new Promise(resolve=>setTimeout(resolve,5));first.stop();release();await Promise.all([a,b]);assert.equal(counts.compile,1);assert.equal(second.snapshot().canInteract,true);assert.equal(first.snapshot().canInteract,false);
});
test('store validation failures expose unchanged recoverable bytes without compiler work',async()=>{
 const data=await fixture(),backing=memory(),{deps,counts}=harness();const originalGet=backing.storage.get;
 backing.storage.get=async key=>{const stored=await originalGet(key);if(stored?.kind==='execution')throw Error('IndexedDB validates before returning');return stored;};
 const first=createExperimentSession({...data,storage:backing.storage},deps);await first.open();await first.step({kind:'initialize'});const execution=[...backing.values.values()].find(r=>r.kind==='execution')!;backing.originals.set(execution.key,'future-format-original');
 const fresh=harness(),second=createExperimentSession({...data,storage:backing.storage},fresh.deps);await second.open();assert.equal(second.snapshot().frame,null);assert.equal(second.snapshot().recovery?.original,'future-format-original');assert.equal(second.snapshot().recovery?.code,'incompatible');assert.equal(fresh.counts.compile,0);assert.equal(counts.compile,1);
});
test('an interrupted adapter cannot commit a late frame or replace the last valid cache',async()=>{
 const data=await fixture(),{storage,values}=memory(),{deps}=harness();let started!:()=>void,release!:()=>void;const reached=new Promise<void>(resolve=>{started=resolve;}),paused=new Promise<void>(resolve=>{release=resolve;});const original=deps.adapter!;
 deps.adapter=(...args)=>{const actual=original(...args);return {...actual,async execute(...runArgs){if(runArgs[3].kind!=='initialize'){started();await paused;}return actual.execute(...runArgs);}};};
 const session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});const before=session.snapshot().frame,stored=[...values.values()].find(r=>r.kind==='execution')!.id;
 const pending=session.step({kind:'control',id:'append'});await reached;session.stop();await pending;release();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(session.snapshot().frame,before);assert.equal([...values.values()].find(r=>r.kind==='execution')!.id,stored);
});
test('exact checked assets are injected into custom inputs; unchecked copies cannot replay cached results',async()=>{
 const {sealScientificAsset}=await import('../lib/assets/local');const data=await fixture();const asset=await sealScientificAsset({format:'paperplay-scientific-asset',schemaVersion:1,id:'points',label:'Authored table',kind:'table',shape:[1,1],coordinates:{system:'Authored rows',axes:[]},missingValues:'reject',provenance:{origin:'illustrative',attribution:'Paperplay fixture',rights:'ISC'},transformations:[],data:{columns:[{id:'v',label:'Value',type:'number',unit:'index'}],rows:[{id:'one',values:[1]}]}});
 data.artifact.interfaces.input=[{id:'parameter',kind:'number',description:'Authored input'},{id:'assets',kind:'object',description:'Declared data only'}];data.artifact.assetIds=['points'];data.artifact.assetBindings=[{id:'points',kind:'table',sha256:asset.checksum.value}];data.artifact.initialInput={parameter:1};
 const {storage}=memory(),{deps,counts}=harness();const session=createExperimentSession({...data,assets:[asset],input:{parameter:2,assets:{unexpected:'never accepted'}},storage},deps);await session.open();assert.equal(session.snapshot().status,'ready');assert.deepEqual(Object.keys((session.snapshot().input as any).assets),['points']);await session.step({kind:'initialize'});
 const copy=createExperimentSession({...data,assets:[structuredClone(asset)],storage},deps);await copy.open();assert.equal(copy.snapshot().status,'failed');assert.equal(copy.snapshot().frame,null);assert.equal(counts.compile,1);
});
test('returning to an exact earlier configuration restores its branch without executing or overwriting it',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();const session=createExperimentSession({...data,storage},deps);await session.open();await session.step({kind:'initialize'});await session.step({kind:'control',id:'append'});const first=session.snapshot().frame;
 await session.configure({seed:43});assert.equal(session.snapshot().frame,null);await session.step({kind:'initialize'});await session.step({kind:'control',id:'append'});await session.step({kind:'control',id:'append'});const executions=counts.execute;
 await session.configure({seed:42});assert.deepEqual(session.snapshot().frame,first);assert.equal(session.snapshot().restored,true);assert.equal(session.snapshot().canInteract,false);assert.equal(counts.execute,executions);assert.equal(counts.compile,1);
 const reopened=createExperimentSession({...data,storage},deps);await reopened.open();assert.equal(reopened.snapshot().seed,42);assert.deepEqual(reopened.snapshot().frame,first);
});

test('imported replay input binding must match exact serialized input before admission; explicit changes form a new branch',async()=>{
 const data=await fixture(),{storage}=memory(),{deps,counts}=harness();
 data.artifact.interfaces.input=[{id:'a',kind:'number',description:'First ordered value'},{id:'b',kind:'number',description:'Second ordered value'}];data.artifact.initialInput={a:1,b:2};
 const expectedInputSha256=await sha256Text(JSON.stringify({a:1,b:2}));
 const invalid=createExperimentSession({...data,input:{b:2,a:1},expectedInputSha256,storage},deps);await invalid.open();assert.equal(invalid.snapshot().error,'integrity');assert.equal(counts.compile,0);assert.equal(counts.execute,0);
 const valid=createExperimentSession({...data,input:{a:1,b:2},expectedInputSha256,storage},deps);await valid.open();assert.equal(valid.snapshot().status,'ready');await valid.configure({input:{b:2,a:1}});await valid.step({kind:'initialize'});assert.equal(valid.snapshot().status,'ready');assert.equal(counts.compile,1);
});
test('a cancelled open cannot overwrite a newer configuration after delayed cache validation',async()=>{
 const {createArtifactExperimentIdentity,createArtifactCacheRecord}=await import('../shared/artifact-experiment');
 const data=await fixture(),backing=memory(),{deps,counts}=harness();
 const identity=await createArtifactExperimentIdentity({...data,input:{},seed:43});
 const candidate=await createArtifactCacheRecord('execution',identity,{inputJson:'{}',entries:[],currentKey:null});await backing.storage.put(candidate,'test');
 const {id:ignored,...body}=candidate;void ignored;const needle=JSON.stringify(body);
 const originalDigest=crypto.subtle.digest;let matches=0,heldResolve!:()=>void,release!:()=>void;
 const held=new Promise<void>(resolve=>{heldResolve=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 crypto.subtle.digest=async function(...args:Parameters<SubtleCrypto['digest']>){
  if(new TextDecoder().decode(args[1] as ArrayBuffer)===needle&&++matches===2){heldResolve();await gate;}
  return originalDigest.apply(crypto.subtle,args);
 };
 let opening:Promise<unknown>|undefined;
 try{
  const session=createExperimentSession({...data,storage:backing.storage},deps);opening=session.open();await held;
  session.stop();await session.configure({seed:99});release();await opening;
  const exported=JSON.parse(await session.exportBundle());assert.equal(session.snapshot().seed,99);assert.equal(exported.identity.seed,99);assert.deepEqual(session.snapshot().input,{});assert.equal(exported.inputJson,'{}');assert.equal(counts.compile,0);assert.equal(counts.execute,0);
  await session.step({kind:'initialize'});assert.equal(session.snapshot().seed,99);assert.equal(session.snapshot().status,'ready');assert.equal(counts.compile,1);
 }finally{release();await opening;crypto.subtle.digest=originalDigest;}
});
