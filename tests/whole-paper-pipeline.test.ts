import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticPaperPipeline,automaticPaperStorageKey,AutomaticPaperHttpError,type AutomaticPaperOptions,type AutomaticPaperTransport} from '../lib/automatic/pipeline';
import {createAutomaticPaperPipeline as createLegacy} from '../lib/automatic/legacy-pipeline';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {sha256Text} from '../lib/artifacts/sdk-source';
import {canonicalArtifactJson} from '../shared/figure-compilation';
import {validateWidgetEnvelope,type WidgetEnvelope} from '../shared/widgets';
import type {PaperFigureBrief} from '../lib/enrichment/whole-paper';
import type {GenerationCandidate} from '../shared/artifact-generation';
const lock:NonNullable<AutomaticPaperOptions['lock']>=async(_key,run)=>run();
function storage(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
async function fixture(){
 const {source,artifact}=await createDynamicSequenceArtifact();artifact.authorship={kind:'meta',label:'Test-only model fixture'};
 const plan={objective:'Observe stable identities',mechanism:'Bounded sequence',representation:'conceptual' as const,assumptions:['Authored test'],missingDetails:[],interactions:['Add item']};
 const candidate:GenerationCandidate={plan,artifact,sha256:await sha256Text(canonicalArtifactJson({plan,artifact}))};
 const brief:PaperFigureBrief={id:'one-interaction',title:'Stable identity after removing an item',blockId:source.blocks[0].id,page:1,quote:artifact.anchors[0].quote,kind:'table',whyHere:'This passage distinguishes element identity from position.',learningGoal:'Understand which element survives removal.',interaction:'Compare the before and after rows.',expectedInsight:'A surviving element keeps its identity.',brief:'Show one small before and after example with clear column labels.',reuseId:null};
 const widget=validateWidgetEnvelope({format:'paperplay-widget',schemaVersion:2,id:'selected-values',title:brief.title,source:{documentId:source.id,sourceVersion:source.sourceVersion,blockId:brief.blockId,page:1,quote:brief.quote,citation:{title:source.title,authors:source.authors}},authorship:{kind:'meta',label:'Test-only model fixture'},spec:{kind:'table',mapping:'Compare identity before and after removal.',provenance:'illustrative',columns:[{id:'value',label:'Value',unit:''}],rows:[{id:'item1',cells:{value:1}}]},seed:42},source);
 return {source,candidate,brief,widget};
}
const passing:NonNullable<AutomaticPaperOptions['check']>=async candidate=>({feedback:{candidateSha256:candidate.sha256,compiler:{status:'ready',diagnostics:[]},runtime:{status:'ready'},quality:{status:'passed',diagnostics:[],framesChecked:12,textMeasurements:'provided'}},checks:[],repairable:false});
function fake(f:Awaited<ReturnType<typeof fixture>>,figures:PaperFigureBrief[]=[f.brief]){
 const calls:{endpoint:string;payload:any}[]=[],runs=new Map<string,any>();
 const transport:AutomaticPaperTransport=async(endpoint,payload:any)=>{
  calls.push({endpoint,payload});
  if(endpoint.includes('/enrichment/')){
   if(payload.scope==='paper-outline')return {status:'complete',paperPlan:{summary:'One interaction answers the key reader question.',figures}};
   return {status:'complete',result:{action:'plan',sectionId:payload.sectionId,sectionTitle:f.source.title,catalogVersion:'2.1.0',model:'test-meta',summary:'Implemented the selected figure.',proposals:[{id:f.brief.id,concept:'Identity',reason:'Compare the effect',objective:f.brief.learningGoal,neededData:[],provenance:'illustrative',interactions:[],limitations:[],envelope:f.widget}],customFigures:[],rejected:[],warnings:[],repetitionReason:''}};
  }
  if(endpoint.endsWith('/prepare'))runs.set(payload.runId,{runId:payload.runId,token:'fixture-token',model:'test-meta',createdAt:Date.now(),deadlineAt:Date.now()+300000});
  const run=endpoint.endsWith('/prepare')?runs.get(payload.runId):payload.run;
  return {status:endpoint.endsWith('/prepare')?'prepared':'complete',run,budget:{maxAttempts:3,attemptsClaimed:endpoint.endsWith('/prepare')?0:payload.attempt,maxReservedTokens:666000,reservedTokens:0,maxOutputTokensPerAttempt:6000,maxInputCharactersPerAttempt:900000},...(endpoint.endsWith('/prepare')?{}:{candidate:f.candidate})};
 };
 return {transport,calls};
}
test('a 43-section paper receives one global planning request, then only the single Meta-selected implementation',async()=>{
 const f=await fixture();f.source.blocks=Array.from({length:43},(_,i)=>[{id:`heading-${i}`,kind:'heading' as const,page:1,level:2,text:`Section ${i}`},{...f.source.blocks[0],id:i===0?f.brief.blockId:`passage-${i}`}]).flat();
 const p=fake(f),disk=storage(),c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,check:passing,lock});assert.equal(p.calls.length,0);await c.start();
 assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(c.getSnapshot().sectionsTotal,43);assert.equal(c.getSnapshot().widgets.length,1);
 assert.deepEqual(p.calls.map(c=>c.payload.scope),['paper-outline','paper-figure']);assert.ok(p.calls.every(c=>c.payload.sectionId==='whole-paper'&&c.payload.source.blocks.length===86));assert.equal(c.getSnapshot().figureBindings[0].figureId,f.brief.id);
 const again=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});await again.start();assert.equal(p.calls.length,2);assert.equal(again.getSnapshot().widgets.length,1);
});
test('a whole-paper decision to add no figures creates no implementation request',async()=>{
 const f=await fixture(),p=fake(f,[]),c=await createAutomaticPaperPipeline(f.source,{storage:storage(),transport:p.transport,lock});await c.start();assert.equal(c.getSnapshot().status,'complete');assert.equal(p.calls.length,1);assert.equal(c.getSnapshot().widgets.length,0);assert.equal(c.getSnapshot().generated.length,0);
});
test('Meta can curate 24 older figures down to one reused figure while keeping omitted originals archived',async()=>{
 const f=await fixture(),disk=storage(),seed=await createLegacy(f.source,{storage:disk,transport:fake(f).transport,lock}),state=seed.getSnapshot(),widgets=Array.from({length:24},(_,i)=>({...f.widget,id:`old-${i}`,title:`Earlier view ${i}`}));seed.dispose();
 disk.setItem(automaticPaperStorageKey(f.source,state.fingerprint),JSON.stringify({...state,status:'complete',sectionsDone:1,widgets}));
 const p=fake(f,[{...f.brief,reuseId:'widget:old-7'}]),c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});assert.equal(c.getSnapshot().status,'idle');await c.start();
 assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(p.calls.length,1);assert.equal(p.calls[0].payload.existingFigures.length,24);assert.deepEqual(c.getSnapshot().widgets.map(w=>w.id),['old-7']);assert.equal(c.getSnapshot().archivedWidgets.length,23);assert.equal(c.getSnapshot().figureBindings[0].widgetId,'old-7');
 const again=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});await again.start();assert.equal(p.calls.length,1);assert.equal(again.getSnapshot().archivedWidgets.length,23);
});
test('unresolved outline submission retains the same identity and complete frozen request on reopening',async()=>{
 const f=await fixture(),p=fake(f),disk=storage();let failed=true;const sent:any[]=[];
 const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{if(payload.scope==='paper-outline'){sent.push(payload);if(failed)throw Error('Connection lost after submission');}return p.transport(endpoint,payload,signal);};
 let c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();assert.equal(c.getSnapshot().status,'blocked');failed=false;c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();assert.equal(c.getSnapshot().status,'complete');assert.deepEqual(sent[1],sent[0]);
});
test('accepted outline resumes through status and creates no second outline',async()=>{
 const f=await fixture(),p=fake(f),disk=storage();let fail=true;const calls:string[]=[];
 const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{calls.push(endpoint);if(payload.scope==='paper-outline'&&endpoint.endsWith('/start'))return {status:'queued',job:{token:'accepted-plan',createdAt:1,action:'plan',sectionId:'whole-paper',model:'test-meta'}};if(payload.scope==='paper-outline'&&fail)throw Error('Lost connection while polling');return p.transport(endpoint,payload,signal);};
 let c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock,sleep:async()=>{}});await c.start();assert.equal(c.getSnapshot().status,'blocked');fail=false;c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock,sleep:async()=>{}});await c.start();assert.equal(c.getSnapshot().status,'complete');assert.equal(calls.filter(x=>x.endsWith('/start')).length,2);assert.equal(p.calls.filter(x=>x.payload.scope==='paper-outline').length,1);
});
test('terminal planning and implementation validation failures are corrected without changing the full source or approved objective',async()=>{
 const f=await fixture(),p=fake(f),sent:any[]=[];let outlineFailure=true,figureFailure=true;
 const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{sent.push(payload);if(payload.scope==='paper-outline'&&outlineFailure){outlineFailure=false;return {status:'failed',error:'Invalid exact quote'};}if(payload.scope==='paper-figure'&&figureFailure){figureFailure=false;const r:any=await p.transport(endpoint,payload,signal);return {...r,result:{...r.result,proposals:[],rejected:[{id:f.brief.id,reason:'Invalid table column'}]}};}return p.transport(endpoint,payload,signal);};
 const c=await createAutomaticPaperPipeline(f.source,{storage:storage(),transport,lock});await c.start();assert.equal(c.getSnapshot().status,'complete');assert.equal(sent.length,4);assert.notEqual(sent[0].requestId,sent[1].requestId);assert.notEqual(sent[2].requestId,sent[3].requestId);assert.deepEqual(sent[2].figureBrief,sent[3].figureBrief);assert.match(sent[3].feedback,/Invalid table column/);assert.ok(sent.every(v=>JSON.stringify(v.source)===JSON.stringify(f.source)));
});
test('a model-selected custom interaction receives the complete paper and exact approved anchor; failed layouts are repaired',async()=>{
 const f=await fixture(),p=fake(f,[{...f.brief,kind:'generated'}]);let checks=0;
 const c=await createAutomaticPaperPipeline(f.source,{storage:storage(),transport:p.transport,lock,check:async(...args)=>++checks===1?{feedback:{candidateSha256:f.candidate.sha256,compiler:{status:'ready',diagnostics:[]},runtime:{status:'ready'},quality:{status:'failed',diagnostics:[{code:'text-clipped',scope:'artifact',step:0}],framesChecked:1,textMeasurements:'provided'}},checks:[],repairable:true}:passing(...args)});
 await c.start();assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(c.getSnapshot().generated.length,1);assert.equal(c.getSnapshot().figureBindings[0].generatedSha,f.candidate.sha256);
 const starts=p.calls.filter(c=>c.endpoint==='/api/artifact-generation/start');assert.equal(starts.length,2);assert.deepEqual(starts[1].payload.anchor,{blockId:f.brief.blockId,page:1,quote:f.brief.quote});assert.equal(starts[1].payload.scope,'paper');assert.equal(starts[1].payload.sectionId,'whole-paper');assert.equal(starts[1].payload.attempt,2);assert.equal(starts[1].payload.feedback.quality.status,'failed');
});
test('interrupted custom generation is retrieved with the same scope and anchor without another start',async()=>{
 const f=await fixture(),p=fake(f,[{...f.brief,kind:'generated'}]),disk=storage();let failed=true;
 const transport:AutomaticPaperTransport=async(endpoint,payload,signal)=>{const reply=await p.transport(endpoint,payload,signal);if(endpoint==='/api/artifact-generation/start'&&failed)throw Error('Lost accepted response');return reply;};
 let c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock,check:passing});await c.start();assert.equal(c.getSnapshot().status,'blocked');failed=false;c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock,check:passing});await c.start();assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(p.calls.filter(c=>c.endpoint==='/api/artifact-generation/start').length,1);assert.equal(p.calls.filter(c=>c.endpoint==='/api/artifact-generation/status').length,1);
});
test('stored invalid content or failed durable save authorizes no model calls',async()=>{
 const f=await fixture(),p=fake(f),disk=storage(),seed=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock}),key=automaticPaperStorageKey(f.source,seed.getSnapshot().fingerprint);disk.setItem(key,'{"version":99}');seed.dispose();
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});await c.start();assert.equal(c.getSnapshot().status,'blocked');assert.equal(p.calls.length,0);assert.equal(disk.getItem(key),'{"version":99}');
 const other=await createAutomaticPaperPipeline(f.source,{storage:{getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}},transport:p.transport,lock});await other.start();assert.equal(other.getSnapshot().status,'blocked');assert.equal(p.calls.length,0);
});
test('an unresolved legacy accepted plan is retrieved before whole-paper planning, including a repeated interrupted recovery',async()=>{
 const f=await fixture(),p=fake(f),disk=storage(),seed=await createLegacy(f.source,{storage:disk,transport:p.transport,lock}),s=seed.getSnapshot();seed.dispose();
 const job={token:'old-accepted-job',createdAt:1,action:'plan',sectionId:s.sectionIds[0],model:'test-meta'};
 disk.setItem(automaticPaperStorageKey(f.source,s.fingerprint),JSON.stringify({...s,status:'blocked',pending:{kind:'plan',sectionId:s.sectionIds[0],requestId:crypto.randomUUID(),job}}));
 let failed=true;const calls:any[]=[];const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{calls.push({endpoint,payload});if(!payload.scope){assert.equal(endpoint,'/api/enrichment/status');if(failed)throw Error('Legacy connection interrupted');const r:any=await p.transport(endpoint,payload,signal);return {...r,result:{...r.result,proposals:[]}};}return p.transport(endpoint,payload,signal);};
 let c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();assert.equal(c.getSnapshot().status,'blocked');assert.equal(calls.length,1);failed=false;c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(calls[1].endpoint,'/api/enrichment/status');assert.deepEqual(calls[1].payload.job,job);assert.equal(calls[2].payload.scope,'paper-outline');
});
test('simultaneous readers reload the completed global plan under the same storage lock',async()=>{
 const f=await fixture(),p=fake(f),disk=storage();let queued=Promise.resolve();const exclusive:NonNullable<AutomaticPaperOptions['lock']>=async(_key,run)=>{const previous=queued;let release!:()=>void;queued=new Promise<void>(resolve=>release=resolve);await previous;try{return await run();}finally{release();}};
 const options={storage:disk,transport:p.transport,lock:exclusive},a=await createAutomaticPaperPipeline(f.source,options),b=await createAutomaticPaperPipeline(f.source,options);await Promise.all([a.start(),b.start()]);assert.equal(p.calls.length,2);assert.equal(a.getSnapshot().status,'complete');assert.equal(b.getSnapshot().status,'complete');
});

test('legacy proof of a definite missing-session rejection survives migration for session bootstrap',async()=>{
 const f=await fixture(),disk=storage(),seed=await createLegacy(f.source,{storage:disk,transport:fake(f).transport,lock}),s=seed.getSnapshot();seed.dispose();
 const message='The browser session for this analysis is missing or expired.';
 disk.setItem(automaticPaperStorageKey(f.source,s.fingerprint),JSON.stringify({...s,status:'blocked',message,pending:{kind:'plan',sectionId:s.sectionIds[0],requestId:crypto.randomUUID()}}));
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:fake(f).transport,lock});assert.equal(c.getSnapshot().status,'blocked');assert.equal(c.getSnapshot().message,message);assert.equal(c.getSnapshot().pending?.kind,'plan');
});
test('an interrupted final custom save cannot publish a duplicate or issue another paid creation on recovery',async()=>{
 const f=await fixture(),p=fake(f,[{...f.brief,kind:'generated'}]),disk=storage();let denied=true;
 const guarded={getItem:disk.getItem,setItem:(key:string,value:string)=>{if(denied&&JSON.parse(value).generated.length){denied=false;throw Error('Interrupted durable save');}disk.setItem(key,value);}};
 let c=await createAutomaticPaperPipeline(f.source,{storage:guarded,transport:p.transport,lock,check:passing});await c.start();assert.equal(c.getSnapshot().status,'blocked');assert.equal(c.getSnapshot().generated.length,0);
 c=await createAutomaticPaperPipeline(f.source,{storage:guarded,transport:p.transport,lock,check:passing});await c.start();assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(c.getSnapshot().generated.length,1);assert.equal(c.getSnapshot().figureBindings.length,1);assert.equal(p.calls.filter(c=>c.endpoint==='/api/artifact-generation/start').length,1);
});

test('response-local proposal IDs cannot overwrite distinct approved figures at the same source passage',async()=>{
 const f=await fixture(),p=fake(f,[f.brief,{...f.brief,id:'other-question',title:'A different reader question',learningGoal:'Compare position rather than identity.'}]),c=await createAutomaticPaperPipeline(f.source,{storage:storage(),transport:p.transport,lock});
 await c.start();assert.equal(c.getSnapshot().status,'complete',c.getSnapshot().message);assert.equal(c.getSnapshot().widgets.length,2);assert.equal(new Set(c.getSnapshot().widgets.map(w=>w.id)).size,2);assert.equal(new Set(c.getSnapshot().figureBindings.map(b=>b.widgetId)).size,2);
});

test('the displayed guide is the Meta implementation guide tied to the actual figure and survives reopening',async()=>{
 const f=await fixture(),p=fake(f),disk=storage(),readingGuide={whyHere:f.brief.whyHere,learningGoal:f.brief.learningGoal,interaction:'Sort the Value column, then select an item row.',expectedInsight:'The item ID stays attached to its value when rows are reordered.'};
 const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{const response:any=await p.transport(endpoint,payload,signal);return payload.scope==='paper-figure'?{...response,result:{...response.result,readingGuide}}:response;};
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();assert.equal(c.getSnapshot().status,'complete');assert.deepEqual(c.getSnapshot().figureBindings[0].readingGuide,readingGuide);
 const reopened=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await reopened.start();assert.deepEqual(reopened.getSnapshot().figureBindings[0].readingGuide,readingGuide);assert.equal(p.calls.length,2);
});

test('earlier completed global plans are reviewed once to align saved figures and their actual controls',async()=>{
 const f=await fixture(),disk=storage(),first=fake(f),c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:first.transport,lock});await c.start();
 const snapshot=c.getSnapshot(),key=automaticPaperStorageKey(f.source,snapshot.fingerprint),{editorialRevision:_,...earlier}=snapshot;disk.setItem(key,JSON.stringify(earlier));c.dispose();
 const revised={...f.brief,reuseId:'widget:'+snapshot.widgets[0].id,interaction:'Sort the existing Value column.'},p=fake(f,[revised]),reopened=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});
 assert.equal(reopened.getSnapshot().status,'idle');await reopened.start();assert.equal(reopened.getSnapshot().status,'complete');assert.equal(p.calls.length,1);assert.equal(reopened.getSnapshot().paperPlan?.figures[0].interaction,revised.interaction);assert.equal(reopened.getSnapshot().widgets[0].id,snapshot.widgets[0].id);
 const again=await createAutomaticPaperPipeline(f.source,{storage:disk,transport:p.transport,lock});await again.start();assert.equal(p.calls.length,1);
});

test('checking an uncertain outline uses its frozen identity and stops before implementing any new selected figure',async()=>{
 const f=await fixture(),p=fake(f),disk=storage(),calls:any[]=[];let recover=false;
 const transport:AutomaticPaperTransport=async(endpoint,payload:any,signal)=>{
  calls.push({endpoint,payload});
  if(!recover)throw new AutomaticPaperHttpError(504,'The submission outcome is uncertain.',true);
  assert.equal(payload.verifyOnly,true);
  return p.transport(endpoint,payload,signal);
 };
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();
 const pending=c.getSnapshot().pending;assert.equal(pending?.kind,'outline');assert.equal(c.getSnapshot().status,'blocked');
 recover=true;await c.checkSavedRequest();
 assert.equal(calls.length,2);assert.equal(calls[0].payload.requestId,calls[1].payload.requestId);
 assert.equal(c.getSnapshot().status,'paused');assert.equal(c.getSnapshot().paperPlan?.figures.length,1);assert.equal(c.getSnapshot().widgets.length,0);
 assert.equal(c.getSnapshot().pending,undefined);
});

test('a failed saved-request check preserves its identity and never silently retries under a new reference',async()=>{
 const f=await fixture(),disk=storage(),calls:any[]=[];
 const transport:AutomaticPaperTransport=async(endpoint,payload)=>{calls.push({endpoint,payload});throw new AutomaticPaperHttpError(409,'An earlier submission is unresolved.',true);};
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock});await c.start();const pending=c.getSnapshot().pending;
 await c.checkSavedRequest();assert.equal(calls.length,2);assert.deepEqual(c.getSnapshot().pending,pending);assert.equal(calls[1].payload.verifyOnly,true);assert.equal(c.getSnapshot().status,'blocked');
});

test('checking a saved custom request only retrieves its accepted attempt and never prepares, starts or repairs another',async()=>{
 const f=await fixture(),p=fake(f,[{...f.brief,kind:'generated'}]),disk=storage(),calls:any[]=[];let recover=false;
 const transport:AutomaticPaperTransport=async(endpoint,payload,signal)=>{
  calls.push({endpoint,payload});
  if(endpoint==='/api/artifact-generation/start'&&!recover)throw new AutomaticPaperHttpError(504,'The accepted interaction is uncertain.',true);
  return p.transport(endpoint,payload,signal);
 };
 const c=await createAutomaticPaperPipeline(f.source,{storage:disk,transport,lock,check:passing});await c.start();
 assert.equal(c.getSnapshot().status,'blocked');const pending=c.getSnapshot().pending;assert.equal(pending?.kind,'custom');
 const before=calls.length;recover=true;await c.checkSavedRequest();
 const checkCalls=calls.slice(before);assert.deepEqual(checkCalls.map(c=>c.endpoint),['/api/artifact-generation/status']);
 assert.equal(checkCalls[0].payload.run.runId,pending?.kind==='custom'?pending.run?.runId:undefined);
 assert.equal(c.getSnapshot().generated.length,1);assert.equal(c.getSnapshot().status,'paused');
});
