/** Explicit one-creation Meta design check. Completed/pending private checkpoints are reused. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { numericPaper } from '../data/numeric-paper';
import { createWidgetForSource } from '../lib/widgets/presets';
import { buildSourceSections } from '../lib/enrichment/sections';
import type { EnrichmentReply } from '../lib/enrichment/contracts';

if(!process.argv.includes('--live')){console.log('No inference. Pass --live for one bounded custom-design check.');process.exit(0);}
const origin='http://localhost:3011',file='.paperplay/custom-design-check.json';
const source=numericPaper.document,target=createWidgetForSource('diagram',source,'q-recurrence');
const section=buildSourceSections(source).find(s=>s.segments.some(v=>v.blockId===target.source.blockId))!;
type Checkpoint={cookie:string;sent:boolean;request:Record<string,unknown>;reply?:EnrichmentReply};
let state:Checkpoint;
try{state=JSON.parse(await readFile(file,'utf8'));}catch{state={cookie:'',sent:false,request:{source,target,sectionId:section.id,action:'repair',requestId:crypto.randomUUID(),feedback:'Please replace this conceptual diagram with a small custom runtime-v1 teaching widget for the quoted momentum recurrence. The missing capability is an editable scalar phase-space scene showing w and z evolving together, not only a static curve or explanation. Use the one-dimensional synthetic restriction A=lambda, explicit alpha/beta/lambda/b parameters, and two simultaneous registers. Because w next uses z next, substitute the new-z expression in the w update. Include exact numerical metrics, a step slider and a moving point or simple physical schematic. Keep 20 steps, small values and at most 4 marks. Preserve the source quote. Explain the catalog gap and the scalar restriction; no reproduction claim.'}};}
await mkdir('.paperplay',{recursive:true,mode:0o700});
const save=()=>writeFile(file,JSON.stringify(state),{mode:0o600});
async function call(path:string,body:unknown){const response=await fetch(origin+'/api/enrichment/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(state.cookie?{Cookie:state.cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});const cookie=response.headers.get('set-cookie')?.split(';')[0];if(cookie)state.cookie=cookie;const reply=await response.json();if(!response.ok)throw Error(`Enrichment HTTP ${response.status}: ${reply.error??'request rejected'}`);return reply;}
if(!state.reply){if(state.sent)throw Error('Previous acceptance is uncertain. No replacement paid request was sent.');await call('session',{});state.sent=true;await save();state.reply=await call('start',state.request);await save();}
for(let i=0;i<90&&['queued','analyzing'].includes(state.reply!.status);i++){await new Promise(r=>setTimeout(r,2000));state.reply=await call('status',{source,sectionId:section.id,action:'repair',feedback:state.request.feedback,target,job:state.reply!.job});await save();}
const result=state.reply!.result;
const report={checkedAt:new Date().toISOString(),scope:'Actual official Meta targeted design on a selected Distill equation. Developer check, no participants, not a full-paper evaluation.',status:state.reply!.status,recordedCreations:1,model:result?.model,usage:result?.usage,proposals:result?.proposals.map(p=>({kind:p.envelope.spec.kind,title:p.envelope.title,source:p.envelope.source,reason:p.reason,objective:p.objective,limitations:p.limitations,spec:p.envelope.spec})),rejected:result?.rejected,error:state.reply!.error};
await writeFile('docs/custom-design-live-check.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,usage:report.usage,kinds:report.proposals?.map(p=>p.kind),rejected:report.rejected}));
