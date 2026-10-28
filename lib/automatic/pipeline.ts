import {z} from 'zod';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {validateWidgetEnvelope,widgetEnvelopeSchema,type WidgetEnvelope} from '../../shared/widgets';
import {validateFigureArtifact} from '../../shared/figure-artifacts';
import {generationCandidateSchema,generationRunSchema,generationReplySchema,generationFeedbackSchema,type GenerationCandidate,type GenerationRunRef} from '../../shared/artifact-generation';
import {enrichmentResultSchema,enrichmentCustomFigureSchema,type EnrichmentCustomFigure} from '../enrichment/contracts';
import {buildSourceSections} from '../enrichment/sections';
import {enrichmentFingerprint} from '../enrichment/state';
import {canonicalArtifactJson} from '../../shared/figure-compilation';
import {sha256Text} from '../artifacts/sdk-source';
import type {GenerationCheckResult} from '../artifacts/generation-check';

export const AUTOMATIC_PAPER_POLICY=Object.freeze({version:2,pollMs:1500,maxCacheBytes:20_000_000});
const planningBrief='Choose only figures that help explain these passages. Select the best supported widget kinds and exact insertion passages; omit redundant or unhelpful figures. Keep student explanations clear, distinguish synthetic teaching examples from research findings, and preserve original figures.';
const jobSchema=z.strictObject({token:z.string().max(5000),createdAt:z.number().finite(),action:z.literal('plan'),sectionId:z.string().max(100),model:z.string().max(120)});
const enrichmentReplySchema=z.object({status:z.enum(['queued','analyzing','complete','failed','cancelled','expired','incomplete']),job:jobSchema.optional(),result:enrichmentResultSchema.optional(),error:z.string().max(2000).optional(),uncertain:z.boolean().optional()});
const pendingSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('plan'),sectionId:z.string().max(100),requestId:z.string().uuid(),feedback:z.string().max(1200).optional(),job:jobSchema.optional(),preserveSessionOwner:z.literal(true).optional()}),
 z.strictObject({kind:z.literal('custom'),sectionId:z.string().max(100),brief:z.string().max(1200),runId:z.string().uuid(),run:generationRunSchema.optional(),candidate:generationCandidateSchema.optional(),requestKey:z.string().max(240).optional(),attempt:z.number().int().min(1).max(3).optional(),totalAttempts:z.number().int().nonnegative().optional(),sessionMaxAttempts:z.number().int().min(1).max(3).optional(),previous:generationCandidateSchema.optional(),feedback:generationFeedbackSchema.optional()})
]);
export const automaticPaperStateSchema=z.strictObject({format:z.literal('paperplay-automatic-paper'),version:z.union([z.literal(1),z.literal(2)]),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['idle','planning','generating','checking','complete','partial','paused','blocked','waiting']),retryAt:z.number().int().nonnegative().optional(),quotaReason:z.enum(['session-rate','global-rate','daily-requests','daily-tokens']).optional(),message:z.string().max(1000),sectionsTotal:z.number().int().nonnegative(),sectionIds:z.array(z.string().max(100)).max(1000),sectionsDone:z.number().int().min(0).max(1000),widgets:z.array(widgetEnvelopeSchema).max(3000),generated:z.array(z.strictObject({candidate:generationCandidateSchema,blockId:z.string().max(100),requestKey:z.string().max(240).optional()})).max(8000),customRequests:z.array(z.strictObject({key:z.string().max(240),sectionId:z.string().max(100),request:enrichmentCustomFigureSchema})).max(8000).default([]),customDone:z.array(z.string().max(240)).max(8000).default([]),issues:z.array(z.string().max(1000)).max(16),customAttempted:z.boolean(),pending:pendingSchema.optional()});
export type AutomaticPaperState=z.infer<typeof automaticPaperStateSchema>;
export class AutomaticPaperHttpError extends Error{constructor(readonly status:number,message:string,readonly uncertain=false,readonly retryAt?:number,readonly quotaReason?:AutomaticPaperState['quotaReason']){super(message);this.name='AutomaticPaperHttpError';}}
export type AutomaticPaperTransport=(endpoint:string,payload:unknown,signal:AbortSignal)=>Promise<unknown>;
export type AutomaticPaperOptions={storage?:Pick<Storage,'getItem'|'setItem'>;transport?:AutomaticPaperTransport;check?:(candidate:GenerationCandidate,source:SourceDocument,options:{signal:AbortSignal})=>Promise<GenerationCheckResult>;lock?:<T>(name:string,run:()=>Promise<T>,signal:AbortSignal)=>Promise<T>;sleep?:(signal:AbortSignal)=>Promise<void>;now?:()=>number;waitUntil?:(retryAt:number,signal:AbortSignal)=>Promise<void>};
export function automaticPaperStorageKey(source:SourceDocument,fingerprint:string){return `paperplay:automatic:v1:${source.id}:${fingerprint}`;}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function abort(signal:AbortSignal){if(signal.aborted)throw new DOMException('Automatic preparation paused','AbortError');}
/** Browser defaults are resolved only when a controller is constructed; imports do not start inference. */
export async function createAutomaticPaperPipeline(input:SourceDocument,options:AutomaticPaperOptions={}){
 const source=freeze(validateDocument(clone(input))),fingerprint=await enrichmentFingerprint(source),key=automaticPaperStorageKey(source,fingerprint),sections=buildSourceSections(source);
 const selected=sections;
 const storage=options.storage??(typeof localStorage==='undefined'?undefined:localStorage);
 const now=options.now??Date.now;
 const listeners=new Set<()=>void>();let running:Promise<void>|undefined,controller:AbortController|undefined,disposed=false,invalidCache=false;
 let state:AutomaticPaperState=freeze({format:'paperplay-automatic-paper',version:2,fingerprint,status:'idle',message:'Preparing your paper automatically with Meta.',sectionsTotal:sections.length,sectionIds:selected.map(s=>s.id),sectionsDone:0,widgets:[],generated:[],customRequests:[],customDone:[],issues:[],customAttempted:false});
 function emit(next:AutomaticPaperState){state=freeze(automaticPaperStateSchema.parse(next));for(const fn of listeners)fn();}
 async function load(publish=true){
  const raw=storage?.getItem(key);if(!raw)return;
  if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('The saved automatic preparation is too large. Its original record was retained.');
  let saved=automaticPaperStateSchema.parse(JSON.parse(raw));
  if(saved.fingerprint!==fingerprint||saved.sectionsTotal!==sections.length||saved.sectionsDone>selected.length)throw Error('The saved preparation belongs to different source passages. Its original record was retained.');
  const ids=selected.map(s=>s.id);
  if(saved.version===1){
   if(saved.sectionIds.some((id,index)=>id!==ids[index]))throw Error('The previous source sections no longer match. Their original record was retained.');
   saved={...saved,version:2,sectionIds:ids,issues:[],widgets:saved.widgets.filter(w=>w.authorship.kind==='meta'),status:['complete','partial'].includes(saved.status)&&saved.sectionsDone<ids.length?'idle':saved.status,message:saved.sectionsDone<ids.length?'Meta will continue through the remaining source sections.':saved.message};
   // A previously submitted custom job remains recoverable; an unsubmitted forced example is no longer created.
   if(saved.pending?.kind==='custom'){if(!saved.customAttempted)saved={...saved,pending:undefined};else saved={...saved,pending:{...saved.pending,sessionMaxAttempts:1}};}
  }else if(JSON.stringify(saved.sectionIds)!==JSON.stringify(ids))throw Error('The saved section identities differ from this paper.');
  for(const task of saved.customRequests){const section=sections.find(s=>s.id===task.sectionId),segment=section?.segments.find(s=>s.blockId===task.request.blockId&&s.page===task.request.page);if(!segment||!segment.text.replace(/\s+/g,' ').includes(task.request.quote.replace(/\s+/g,' ')))throw Error('A saved custom request no longer matches its exact source passage.');}
  for(const w of saved.widgets)validateWidgetEnvelope(w,source);
  for(const g of saved.generated){validateFigureArtifact(g.candidate.artifact,source);if(g.blockId!==g.candidate.artifact.anchors[0].blockId||g.candidate.sha256!==await sha256Text(canonicalArtifactJson({plan:g.candidate.plan,artifact:g.candidate.artifact})))throw Error('The saved figure no longer matches its source or content.');}
  if(saved.pending&&!ids.includes(saved.pending.sectionId))throw Error('The saved pending section is unavailable.');
  if(saved.pending?.kind==='plan'&&saved.pending.sectionId!==ids[saved.sectionsDone]||saved.pending&&['complete','partial'].includes(saved.status))throw Error('The saved preparation has an inconsistent recovery reference.');
  if(publish)emit(saved);else state=freeze(saved);
 }
 function save(next:AutomaticPaperState){if(!storage)throw Error('Automatic preparation needs browser storage to keep accepted request references. Reading remains available.');const parsed=automaticPaperStateSchema.parse(next),raw=JSON.stringify(parsed);if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('Automatic preparation could not be saved. No further model request was started.');storage.setItem(key,raw);emit(parsed);}
 function patch(patch:Partial<AutomaticPaperState>){save({...state,...patch});}
 const transport:AutomaticPaperTransport=options.transport??(async(endpoint,payload,signal)=>{
  if(endpoint.endsWith('/start')){const {refreshAdoptionPolicy}=await import('../adoption/policy');const policy=await refreshAdoptionPolicy();if(policy.state!=='ready'||!policy.policy?.newModelCreation||endpoint.includes('artifact-generation')&&!policy.policy.generatedExecution)throw Error('Automatic preparation is disabled or unavailable here. Saved figures and source remain available.');}
  const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
  const raw=await response.text();if(new TextEncoder().encode(raw).length>2_500_000)throw Error('Automatic preparation received an oversized response. Saved requests were retained.');let reply;try{reply=JSON.parse(raw);}catch{throw Error('The response was unreadable. The saved request is retained for recovery.');}if(!response.ok){const quota=z.object({reason:z.enum(['session-rate','global-rate','daily-requests','daily-tokens']),retryAt:z.number().int().nonnegative()}).safeParse(reply.quota);throw new AutomaticPaperHttpError(response.status,typeof reply.error==='string'?reply.error:'Meta could not prepare this paper. Saved request references were retained.',reply.uncertain===true,quota.success?quota.data.retryAt:undefined,quota.success?quota.data.reason:undefined);}return reply;
 });
 let browserSessionReady=false;
 async function prepareBrowserSession(signal:AbortSignal){if(options.transport||browserSessionReady)return;const reply=await transport('/api/enrichment/session',{},signal);abort(signal);if(!z.strictObject({ready:z.literal(true)}).safeParse(reply).success)throw Error('The browser session could not be prepared. No new model request was started.');browserSessionReady=true;}
 const sleep=options.sleep??(signal=>new Promise<void>((resolve,reject)=>{const end=()=>{signal.removeEventListener('abort',stop);resolve();},timer=setTimeout(end,AUTOMATIC_PAPER_POLICY.pollMs),stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new DOMException('Paused','AbortError'));};if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});}));
 const check=options.check??(async(candidate,document,opts)=>(await import('../artifacts/generation-check')).checkGeneratedCandidate(candidate,document,opts));
 const lock=options.lock??(async<T>(name:string,run:()=>Promise<T>,signal:AbortSignal)=>{if(typeof navigator==='undefined'||!navigator.locks)throw Error('This browser cannot safely coordinate automatic preparation across tabs. Use a browser with Web Locks; the paper remains readable.');return navigator.locks.request(name,{signal},run);});
 async function plan(signal:AbortSignal){
  let pending=state.pending?.kind==='plan'?state.pending:undefined;
  // Session bootstrap is free but can renew browser identity. Only fresh plans and
  // the exact pre-reservation missing-session rejection may bootstrap; accepted or ambiguous jobs retain their original owner.
  const knownSessionRejection=!!pending&&!pending.job&&!pending.preserveSessionOwner&&state.status==='blocked'&&state.message==='The browser session for this analysis is missing or expired.';
  if(pending&&!pending.job&&!knownSessionRejection&&!pending.preserveSessionOwner){pending={...pending,preserveSessionOwner:true};patch({pending});}
  if(!pending||knownSessionRejection)await prepareBrowserSession(signal);
  if(!pending){
   const alreadyChosen=[...state.widgets.slice(-10).map(w=>({title:w.title,kind:w.spec.kind,blockId:w.source.blockId})),...state.customRequests.slice(-4).map(t=>({title:t.request.title,kind:'generated',blockId:t.request.blockId}))];
   const feedback=(planningBrief+' Already selected by Meta; avoid redundant additions: '+JSON.stringify(alreadyChosen)).slice(0,1200);
   pending={kind:'plan',sectionId:state.sectionIds[state.sectionsDone],requestId:crypto.randomUUID(),feedback};patch({pending,status:'planning',message:`Meta is choosing figures for section ${state.sectionsDone+1} of ${selected.length}.`});
  }
  if(state.status!=='planning')patch({status:'planning',retryAt:undefined,quotaReason:undefined,message:pending.job?'Retrieving Meta’s saved section plan automatically.':'Resuming Meta’s saved section request automatically.'});
  const context={source,sectionId:pending.sectionId,action:'plan',feedback:pending.feedback??planningBrief};
  let raw;
  try{raw=await transport(`/api/enrichment/${pending.job?'status':'start'}`,{...context,...(pending.job?{job:pending.job}:{requestId:pending.requestId})},signal);}
  catch(error){
   // These exact responses certify zero provider submission under an obsolete
   // frozen prompt. Accepted, ambiguous and generic context failures keep their identity.
   const obsoleteUnsubmitted=error instanceof AutomaticPaperHttpError&&error.status===409&&!error.uncertain&&!pending.job&&['The frozen capability selection changed before this unsubmitted request could resume.','The frozen prompt changed before this unsubmitted request could resume.'].includes(error.message);
   if(!obsoleteUnsubmitted)throw error;
   abort(signal);pending={...pending,requestId:crypto.randomUUID()};patch({pending});
   raw=await transport('/api/enrichment/start',{...context,requestId:pending.requestId},signal);
  }
  let reply=enrichmentReplySchema.parse(raw);
  for(let poll=0;;poll++){
   abort(signal);
   if(reply.job){const job=jobSchema.parse(reply.job);if(job.sectionId!==pending.sectionId)throw Error('The accepted job belongs to another section.');pending={...pending,job};patch({pending});}
   if(!['queued','analyzing'].includes(reply.status))break;
   if(!pending.job)throw Error('Meta accepted work without a recoverable job reference. No replacement was started.');
   await sleep(signal);reply=enrichmentReplySchema.parse(await transport('/api/enrichment/status',{...context,job:pending.job},signal));
  }
  abort(signal);if(reply.uncertain)throw Error(reply.error??'The accepted section request is uncertain. No replacement was created.');
  const issues=[...state.issues],widgets=[...state.widgets],customRequests=[...state.customRequests];let correction='';
  if(reply.status==='complete'&&reply.result){const result=enrichmentResultSchema.parse(reply.result);if(result.sectionId!==pending.sectionId||result.action!=='plan')throw Error('The returned plan belongs to another section.');for(const proposal of result.proposals){const widget=validateWidgetEnvelope(proposal.envelope,source);if(!selected.find(s=>s.id===pending!.sectionId)?.segments.some(s=>s.blockId===widget.source.blockId))throw Error('The returned figure is outside the selected passages.');if(!widgets.some(w=>w.id===widget.id))widgets.push(widget);}for(const request of result.customFigures??[]){const content=canonicalArtifactJson(request),taskKey=pending.sectionId+':'+request.id+':'+await sha256Text(content);if(!customRequests.some(t=>t.sectionId===pending!.sectionId&&canonicalArtifactJson(t.request)===content))customRequests.push({key:taskKey,sectionId:pending.sectionId,request});}if(result.rejected.length)correction=JSON.stringify(result.rejected).slice(0,650);}
  else if(reply.status==='failed'||reply.status==='incomplete')correction=reply.error??`The prior Meta plan ${reply.status}.`;
  else issues.push(reply.error??`Section preparation ${reply.status}; its original source is retained.`);
  if(correction){
   const accepted=[...widgets.filter(w=>selected.find(s=>s.id===pending!.sectionId)?.segments.some(s=>s.blockId===w.source.blockId)).map(w=>({title:w.title,kind:w.spec.kind})),...customRequests.filter(t=>t.sectionId===pending!.sectionId).map(t=>({title:t.request.title,kind:'generated'}))];
   const feedback=('Correct the previous terminal plan failure: '+correction.slice(0,650)+'. Return only corrected replacements for rejected proposals, using complete valid catalog templates and exact source quotes; request customFigures if the bank cannot express the interaction, or omit it if unhelpful. Do not repeat these already accepted illustrations: '+JSON.stringify(accepted).slice(0,250)).slice(0,1200);
   patch({widgets,customRequests,pending:{kind:'plan',sectionId:pending.sectionId,requestId:crypto.randomUUID(),feedback},status:'planning',message:`Meta is correcting its figure plan for section ${state.sectionsDone+1} of ${selected.length}.`});return;
  }
  patch({pending:undefined,widgets,customRequests,sectionsDone:state.sectionsDone+1,issues:issues.slice(-16)});
 }
 function taskBrief(request:EnrichmentCustomFigure,diagnostics=''){
  return ('Use source block '+request.blockId+', page '+request.page+', quote: '+request.quote.slice(0,450)+'. Objective: '+request.objective.slice(0,130)+'. '+request.brief.slice(0,280)+'. '+diagnostics.slice(0,250)).slice(0,1200);
 }
 async function custom(signal:AbortSignal){
  let pending=state.pending?.kind==='custom'?state.pending:undefined;
  if(!pending){const task=state.customRequests.find(t=>!state.customDone.includes(t.key));if(!task)return;pending={kind:'custom',requestKey:task.key,sectionId:task.sectionId,brief:taskBrief(task.request),runId:crypto.randomUUID(),attempt:1,totalAttempts:0};patch({pending,status:'generating',message:'Meta is creating the interaction it selected for this passage.'});}
  while(true){
   abort(signal);const attempt=pending.attempt??1;
   patch({status:'generating',retryAt:undefined,quotaReason:undefined,message:pending.run&&state.customAttempted?'Retrieving Meta’s saved custom figure automatically.':pending.previous?'Meta is correcting its illustration using the local diagnostics.':'Meta is preparing its selected interactive illustration.'});
   const context={source,sectionId:pending.sectionId,brief:pending.brief};
   if(!pending.run){const prepared=generationReplySchema.parse(await transport('/api/artifact-generation/prepare',{...context,runId:pending.runId,maxAttempts:3},signal));abort(signal);if(prepared.status!=='prepared'||prepared.run.runId!==pending.runId)throw Error('The illustration session could not be prepared.');pending={...pending,run:prepared.run,sessionMaxAttempts:prepared.budget.maxAttempts};patch({pending});}
   if(!pending.candidate){
    const submitted=state.customAttempted;patch({customAttempted:true});
    const statusPayload={...context,run:pending.run,attempt};const payload={...statusPayload,...(attempt>1&&pending.previous?{previous:pending.previous,feedback:pending.feedback}:{})};
    let raw;try{raw=await transport(`/api/artifact-generation/${submitted?'status':'start'}`,submitted?statusPayload:payload,signal);}catch(error){abort(signal);if(!submitted||!(error instanceof AutomaticPaperHttpError)||error.status!==409||error.uncertain||error.message!=='This generation attempt has not been claimed.')throw error;raw=await transport('/api/artifact-generation/start',payload,signal);}
    let reply=generationReplySchema.parse(raw);
    while(['queued','analyzing'].includes(reply.status)){abort(signal);await sleep(signal);reply=generationReplySchema.parse(await transport('/api/artifact-generation/status',{...context,run:pending.run,attempt},signal));}
    abort(signal);if(reply.run.runId!==pending.run!.runId)throw Error('The returned illustration belongs to another run.');
    if(reply.uncertain||reply.status==='uncertain')throw Error(reply.error??'The submitted request is uncertain. Its reference is retained.');
    if(reply.status==='cancelled'){finishCustom(pending,'The custom illustration was cancelled; no replacement was submitted.');return;}
    if(reply.status==='complete'&&reply.candidate){validateFigureArtifact(reply.candidate.artifact,source);pending={...pending,candidate:reply.candidate};patch({pending});}
    else{pending=nextCustom(pending,undefined,undefined,reply.error??`Meta response ${reply.status}. Produce a smaller complete interaction.`);patch({pending,customAttempted:false});continue;}
   }
   abort(signal);patch({status:'checking',message:'Checking Meta’s illustration before placing it in the paper.'});
   const result=await check(pending.candidate!,source,{signal});abort(signal);
   if(result.feedback.compiler.status==='ready'&&result.feedback.runtime.status==='ready'&&result.feedback.quality?.status==='passed'){
    patch({pending:undefined,customAttempted:false,generated:[...state.generated,{candidate:pending.candidate!,blockId:pending.candidate!.artifact.anchors[0].blockId,...(pending.requestKey?{requestKey:pending.requestKey}:{})}],customDone:pending.requestKey?[...state.customDone,pending.requestKey]:state.customDone});return;
   }
   if(!result.repairable){finishCustom(pending,'Meta’s selected custom illustration could not execute locally. Its source passage remains available.');return;}
   const diagnostic=JSON.stringify(result.feedback).slice(0,600);
   pending=nextCustom(pending,pending.candidate,result.feedback,diagnostic);patch({pending,customAttempted:false});
  }
 }
 function finishCustom(pending:Extract<NonNullable<AutomaticPaperState['pending']>,{kind:'custom'}>,message:string){patch({pending:undefined,customAttempted:false,customDone:pending.requestKey?[...state.customDone,pending.requestKey]:state.customDone,issues:[...state.issues,message].slice(-16)});}
 function nextCustom(pending:Extract<NonNullable<AutomaticPaperState['pending']>,{kind:'custom'}>,candidate:GenerationCandidate|undefined,feedback:import('../../shared/artifact-generation').GenerationFeedback|undefined,diagnostic:string){
  const totalAttempts=(pending.totalAttempts??0)+1,attempt=pending.attempt??1;
  if(attempt<(pending.sessionMaxAttempts??3)&&pending.run&&now()+2000<pending.run.deadlineAt)return {...pending,attempt:attempt+1,totalAttempts,previous:candidate,feedback,candidate:undefined};
  // A technical provider session ends after three attempts/five minutes, not the user's illustration task.
  // Roll over only after a known terminal failure; accepted or uncertain jobs never reach this branch.
  const task=state.customRequests.find(t=>t.key===pending.requestKey);
  return {...pending,runId:crypto.randomUUID(),run:undefined,attempt:1,sessionMaxAttempts:undefined,totalAttempts,previous:undefined,feedback:undefined,candidate:undefined,brief:task?taskBrief(task.request,'Previous local failure: '+diagnostic+'. Recreate a simpler working interaction.'):(pending.brief.slice(0,800)+' Local failure: '+diagnostic.slice(0,250)+'. Recreate a simpler working interaction.').slice(0,1200)};
 }
 async function executeOnce(signal:AbortSignal){
  await load();abort(signal);if(state.status==='complete'||state.status==='partial')return;
  if(!selected.length){patch({status:'partial',message:'This source contains no readable passages for Meta to illustrate.'});return;}
  if(state.pending?.kind==='custom')await custom(signal);
  while(state.sectionsDone<selected.length){abort(signal);await plan(signal);if(state.pending?.kind==='plan')continue;while(state.customRequests.some(t=>!state.customDone.includes(t.key)))await custom(signal);}
  while(state.customRequests.some(t=>!state.customDone.includes(t.key)))await custom(signal);
  abort(signal);patch({status:state.issues.length?'partial':'complete',message:state.issues.length?'Meta reviewed the entire saved paper. Available illustrations are placed beside their passages; some requested interactions remain unavailable.':state.widgets.length+state.generated.length?'Meta reviewed the entire saved paper. Its selected illustrations are ready in their cited passages.':'Meta reviewed the entire saved paper and selected no additional illustration for these passages.'});
 }
 const waitUntil=options.waitUntil??(async(retryAt:number,signal:AbortSignal)=>{while(now()<retryAt){abort(signal);await new Promise<void>((resolve,reject)=>{const finish=()=>{signal.removeEventListener('abort',cancel);resolve();},timer=setTimeout(finish,Math.min(60_000,Math.max(1,retryAt-now()))),cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new DOMException('Paused','AbortError'));};signal.addEventListener('abort',cancel,{once:true});});}abort(signal);});
 async function execute(signal:AbortSignal){
  await load();
  while(true){
   if(state.status==='waiting'&&state.retryAt){await waitUntil(state.retryAt,signal);abort(signal);}
   try{await executeOnce(signal);return;}
   catch(error){if(signal.aborted||!(error instanceof AutomaticPaperHttpError)||error.status!==429||error.uncertain||!error.retryAt||!error.quotaReason)throw error;
    // A 429 with authoritative quota metadata guarantees rejection before provider submission.
    patch({status:'waiting',retryAt:Math.max(now()+1000,error.retryAt),quotaReason:error.quotaReason,message:error.message,...(state.pending?.kind==='custom'?{customAttempted:false}:{})});
   }
  }
 }
 try{await load();}catch(error){invalidCache=true;emit({...state,status:'blocked',message:error instanceof Error?error.message.slice(0,1000):'The saved automatic preparation is unavailable.'});}
 function stopped(error:unknown,signal:AbortSignal,persist:boolean){if(disposed)return;const paused=signal.aborted,next={...state,status:paused?(state.status==='waiting'?'waiting' as const:'paused' as const):'blocked' as const,message:paused&&state.status==='waiting'?state.message:paused?'Automatic preparation paused. Saved figures and request references are retained.':error instanceof Error?error.message.slice(0,1000):'Automatic preparation stopped. The source and saved requests were retained.'};if(persist){try{save(next);return;}catch{/* Do not start new work when saving fails. */}}emit(next);}
 return Object.freeze({getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  start(){if(disposed||invalidCache)return Promise.resolve();if(running)return running;controller=new AbortController();const signal=controller.signal;
   // Only the lock owner may persist failures; a cancelled waiter has a stale snapshot.
   running=lock(key,async()=>{try{await execute(signal);}catch(error){stopped(error,signal,true);}},signal).catch(error=>stopped(error,signal,false)).finally(()=>{running=undefined;controller=undefined;});return running;
  },
  pause(){if(controller){controller.abort();return running??Promise.resolve();}if(disposed||invalidCache||state.status==='complete'||state.status==='partial')return Promise.resolve();
   emit({...state,status:'paused',message:'Automatic preparation paused. Saved figures remain available.'});const signal=new AbortController().signal;
   // Idle pause must also coordinate with another tab, never overwrite its accepted job.
   return lock(key,async()=>{if(disposed)return;await load(false);if(state.status==='complete'||state.status==='partial'){emit(state);return;}save({...state,status:'paused',message:'Automatic preparation paused. Saved figures and request references are retained.'});},signal).catch(error=>stopped(error,signal,false));
  },dispose(){disposed=true;controller?.abort();listeners.clear();}
 });
}
export type AutomaticPaperPipeline=Awaited<ReturnType<typeof createAutomaticPaperPipeline>>;
