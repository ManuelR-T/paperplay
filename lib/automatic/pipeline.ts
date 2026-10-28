import {z} from 'zod';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {validateWidgetEnvelope,widgetEnvelopeSchema,type WidgetEnvelope} from '../../shared/widgets';
import {validateFigureArtifact} from '../../shared/figure-artifacts';
import {generationCandidateSchema,generationRunSchema,generationReplySchema,type GenerationCandidate,type GenerationRunRef} from '../../shared/artifact-generation';
import {enrichmentResultSchema} from '../enrichment/contracts';
import {buildSourceSections} from '../enrichment/sections';
import {enrichmentFingerprint} from '../enrichment/state';
import {canonicalArtifactJson} from '../../shared/figure-compilation';
import {sha256Text} from '../artifacts/sdk-source';
import type {GenerationCheckResult} from '../artifacts/generation-check';

export const AUTOMATIC_PAPER_POLICY=Object.freeze({version:1,maxSections:4,maxGeneratedAttempts:1,maxPolls:120,pollMs:1500,maxCacheBytes:2_000_000});
const planningBrief='Choose only figures that help explain these passages. Select the best supported widget kinds and exact insertion passages; omit redundant or unhelpful figures. Keep student explanations clear, distinguish synthetic teaching examples from research findings, and preserve original figures.';
const customBrief='Create one bespoke interactive teaching figure for a central concept in the selected passages, complementary to existing figures. Choose the most useful exact source anchor and place the figure there. Use readable labels, generous padding and bounded controls. State assumptions and missing data; never invent experimental observations. This is a conceptual teaching illustration, not scientific verification.';
const jobSchema=z.strictObject({token:z.string().max(5000),createdAt:z.number().finite(),action:z.literal('plan'),sectionId:z.string().max(100),model:z.string().max(120)});
const enrichmentReplySchema=z.object({status:z.enum(['queued','analyzing','complete','failed','cancelled','expired','incomplete']),job:jobSchema.optional(),result:enrichmentResultSchema.optional(),error:z.string().max(2000).optional(),uncertain:z.boolean().optional()});
const pendingSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('plan'),sectionId:z.string().max(100),requestId:z.string().uuid(),job:jobSchema.optional(),preserveSessionOwner:z.literal(true).optional()}),
 z.strictObject({kind:z.literal('custom'),sectionId:z.string().max(100),brief:z.string().max(1200),runId:z.string().uuid(),run:generationRunSchema.optional(),candidate:generationCandidateSchema.optional()})
]);
export const automaticPaperStateSchema=z.strictObject({format:z.literal('paperplay-automatic-paper'),version:z.literal(1),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['idle','planning','generating','checking','complete','partial','paused','blocked']),message:z.string().max(1000),sectionsTotal:z.number().int().nonnegative(),sectionIds:z.array(z.string().max(100)).max(4),sectionsDone:z.number().int().min(0).max(4),widgets:z.array(widgetEnvelopeSchema).max(16),generated:z.array(z.strictObject({candidate:generationCandidateSchema,blockId:z.string().max(100)})).max(1),issues:z.array(z.string().max(1000)).max(16),customAttempted:z.boolean(),pending:pendingSchema.optional()});
export type AutomaticPaperState=z.infer<typeof automaticPaperStateSchema>;
export class AutomaticPaperHttpError extends Error{constructor(readonly status:number,message:string,readonly uncertain=false){super(message);this.name='AutomaticPaperHttpError';}}
export type AutomaticPaperTransport=(endpoint:string,payload:unknown,signal:AbortSignal)=>Promise<unknown>;
export type AutomaticPaperOptions={storage?:Pick<Storage,'getItem'|'setItem'>;transport?:AutomaticPaperTransport;check?:(candidate:GenerationCandidate,source:SourceDocument,options:{signal:AbortSignal})=>Promise<GenerationCheckResult>;lock?:<T>(name:string,run:()=>Promise<T>,signal:AbortSignal)=>Promise<T>;sleep?:(signal:AbortSignal)=>Promise<void>};
export function automaticPaperStorageKey(source:SourceDocument,fingerprint:string){return `paperplay:automatic:v1:${source.id}:${fingerprint}`;}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function abort(signal:AbortSignal){if(signal.aborted)throw new DOMException('Automatic preparation paused','AbortError');}
/** Browser defaults are resolved only when a controller is constructed; imports do not start inference. */
export async function createAutomaticPaperPipeline(input:SourceDocument,options:AutomaticPaperOptions={}){
 const source=freeze(validateDocument(clone(input))),fingerprint=await enrichmentFingerprint(source),key=automaticPaperStorageKey(source,fingerprint),sections=buildSourceSections(source);
 const selected=sections.slice(0,AUTOMATIC_PAPER_POLICY.maxSections);
 const storage=options.storage??(typeof localStorage==='undefined'?undefined:localStorage);
 const listeners=new Set<()=>void>();let running:Promise<void>|undefined,controller:AbortController|undefined,disposed=false,invalidCache=false;
 let state:AutomaticPaperState=freeze({format:'paperplay-automatic-paper',version:1,fingerprint,status:'idle',message:'Preparing your paper automatically with Meta.',sectionsTotal:sections.length,sectionIds:selected.map(s=>s.id),sectionsDone:0,widgets:[],generated:[],issues:[],customAttempted:false});
 function emit(next:AutomaticPaperState){state=freeze(automaticPaperStateSchema.parse(next));for(const fn of listeners)fn();}
 async function load(publish=true){const raw=storage?.getItem(key);if(!raw)return;if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('The saved automatic preparation is too large. Its original record was retained.');const saved=automaticPaperStateSchema.parse(JSON.parse(raw));if(saved.fingerprint!==fingerprint||JSON.stringify(saved.sectionIds)!==JSON.stringify(selected.map(s=>s.id))||saved.sectionsTotal!==sections.length||saved.sectionsDone>selected.length)throw Error('The saved preparation belongs to different source passages. Its original record was retained.');for(const w of saved.widgets)validateWidgetEnvelope(w,source);for(const g of saved.generated){validateFigureArtifact(g.candidate.artifact,source);if(g.blockId!==g.candidate.artifact.anchors[0].blockId||g.candidate.sha256!==await sha256Text(canonicalArtifactJson({plan:g.candidate.plan,artifact:g.candidate.artifact})))throw Error('The saved custom figure no longer matches its source or content.');}if(saved.pending&&!saved.sectionIds.includes(saved.pending.sectionId))throw Error('The saved pending section is unavailable.');if(saved.pending?.kind==='plan'&&saved.pending.sectionId!==saved.sectionIds[saved.sectionsDone]||saved.pending?.kind==='custom'&&saved.sectionsDone!==selected.length||saved.pending&&['complete','partial'].includes(saved.status))throw Error('The saved preparation has an inconsistent recovery reference.');if(publish)emit(saved);else state=freeze(saved);}
 function save(next:AutomaticPaperState){if(!storage)throw Error('Automatic preparation needs browser storage to keep accepted request references. Reading remains available.');const parsed=automaticPaperStateSchema.parse(next),raw=JSON.stringify(parsed);if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('Automatic preparation could not be saved. No further model request was started.');storage.setItem(key,raw);emit(parsed);}
 function patch(patch:Partial<AutomaticPaperState>){save({...state,...patch});}
 const transport:AutomaticPaperTransport=options.transport??(async(endpoint,payload,signal)=>{
  if(endpoint.endsWith('/start')){const {refreshAdoptionPolicy}=await import('../adoption/policy');const policy=await refreshAdoptionPolicy();if(policy.state!=='ready'||!policy.policy?.newModelCreation||endpoint.includes('artifact-generation')&&!policy.policy.generatedExecution)throw Error('Automatic preparation is disabled or unavailable here. Saved figures and source remain available.');}
  const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
  const raw=await response.text();if(new TextEncoder().encode(raw).length>2_500_000)throw Error('Automatic preparation received an oversized response. Saved requests were retained.');let reply;try{reply=JSON.parse(raw);}catch{throw Error('The response was unreadable. The saved request is retained for recovery.');}if(!response.ok)throw new AutomaticPaperHttpError(response.status,typeof reply.error==='string'?reply.error:'Meta could not prepare this paper. Saved request references were retained.',reply.uncertain===true);return reply;
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
  if(!pending){pending={kind:'plan',sectionId:state.sectionIds[state.sectionsDone],requestId:crypto.randomUUID()};patch({pending,status:'planning',message:`Meta is choosing figures for section ${state.sectionsDone+1} of ${selected.length}.`});}
  // Restored jobs are active again before their first awaited response; do not leave the reader showing a stale paused/blocked state.
  if(state.status!=='planning')patch({status:'planning',message:pending.job?'Retrieving Meta’s saved section plan automatically.':'Resuming Meta’s saved section request automatically.'});
  const context={source,sectionId:pending.sectionId,action:'plan',feedback:planningBrief};
  let reply=enrichmentReplySchema.parse(await transport(`/api/enrichment/${pending.job?'status':'start'}`,{...context,...(pending.job?{job:pending.job}:{requestId:pending.requestId})},signal));
  for(let poll=0;;poll++){
   abort(signal);
   if(reply.job){const job=jobSchema.parse(reply.job);if(job.sectionId!==pending.sectionId)throw Error('The accepted job belongs to another section.');pending={...pending,job};patch({pending});}
   if(!['queued','analyzing'].includes(reply.status))break;
   if(!pending.job)throw Error('Meta accepted work without a recoverable job reference. No replacement was started.');
   if(poll>=AUTOMATIC_PAPER_POLICY.maxPolls)throw Error('Meta is taking longer than expected. Resume to retrieve the saved request.');
   await sleep(signal);reply=enrichmentReplySchema.parse(await transport('/api/enrichment/status',{...context,job:pending.job},signal));
  }
  abort(signal);if(reply.uncertain)throw Error(reply.error??'The accepted section request is uncertain. No replacement was created.');
  const issues=[...state.issues],widgets=[...state.widgets];
  if(reply.status==='complete'&&reply.result){const result=enrichmentResultSchema.parse(reply.result);if(result.sectionId!==pending.sectionId||result.action!=='plan')throw Error('The returned plan belongs to another section.');for(const proposal of result.proposals){const widget=validateWidgetEnvelope(proposal.envelope,source);if(!selected.find(s=>s.id===pending!.sectionId)?.segments.some(s=>s.blockId===widget.source.blockId))throw Error('The returned figure is outside the selected passages.');if(!widgets.some(w=>w.id===widget.id))widgets.push(widget);}for(const rejected of result.rejected)issues.push(`A proposed figure was rejected: ${rejected.reason}`);}
  else issues.push(reply.error??`Section preparation ${reply.status}; its original source is retained.`);
  patch({pending:undefined,widgets,sectionsDone:state.sectionsDone+1,issues:issues.slice(-16)});
 }
 async function custom(signal:AbortSignal){
  let pending=state.pending?.kind==='custom'?state.pending:undefined;
  if(!pending){const proposal=state.widgets[0],section=selected.find(s=>s.segments.some(x=>x.blockId===proposal?.source.blockId))??selected[0];if(!section)return;const brief=(customBrief+(proposal?` Complement Meta's selected concept: ${proposal.title}.`:'' )).slice(0,1200);pending={kind:'custom',sectionId:section.id,brief,runId:crypto.randomUUID()};patch({pending,status:'generating',message:'Meta is creating a custom interactive figure for this paper.'});}
  if(state.status!=='generating')patch({status:'generating',message:pending.run&&state.customAttempted?'Retrieving Meta’s saved custom figure automatically.':'Meta is preparing a custom interactive figure automatically.'});
  const context={source,sectionId:pending.sectionId,brief:pending.brief};
  if(!pending.run){const prepared=generationReplySchema.parse(await transport('/api/artifact-generation/prepare',{...context,runId:pending.runId,maxAttempts:1},signal));abort(signal);if(prepared.status!=='prepared'||prepared.run.runId!==pending.runId||prepared.budget.maxAttempts!==1)throw Error('A bounded custom-figure run could not be prepared.');pending={...pending,run:prepared.run};patch({pending});}
  if(!pending.candidate){
   const wasAttempted=state.customAttempted;patch({customAttempted:true});
   const payload={...context,run:pending.run,attempt:1};let raw;try{raw=await transport(`/api/artifact-generation/${wasAttempted?'status':'start'}`,payload,signal);}catch(error){abort(signal);if(!wasAttempted||!(error instanceof AutomaticPaperHttpError)||error.status!==409||error.uncertain||error.message!=='This generation attempt has not been claimed.')throw error;
    // The durable server says this exact attempt was never claimed. Reuse its run/attempt; a concurrent claim still deduplicates server-side.
    raw=await transport('/api/artifact-generation/start',payload,signal);
   }let reply=generationReplySchema.parse(raw);
   for(let poll=0;['queued','analyzing'].includes(reply.status);poll++){abort(signal);if(poll>=AUTOMATIC_PAPER_POLICY.maxPolls)throw Error('The custom figure is still being prepared. Resume to retrieve the accepted attempt.');await sleep(signal);reply=generationReplySchema.parse(await transport('/api/artifact-generation/status',{...context,run:pending.run,attempt:1},signal));}
   abort(signal);if(reply.run.runId!==pending.run!.runId)throw Error('The custom figure belongs to another run.');
   if(reply.status!=='complete'||!reply.candidate){if(reply.uncertain||reply.status==='uncertain')throw Error(reply.error??'The custom attempt is uncertain. No replacement was created.');patch({pending:undefined,issues:[...state.issues,reply.error??`Custom figure ${reply.status}; no fabricated replacement was inserted.`].slice(-16)});return;}
   validateFigureArtifact(reply.candidate.artifact,source);pending={...pending,candidate:reply.candidate};patch({pending});
  }
  abort(signal);patch({status:'checking',message:'Checking the custom figure’s layout and interactions locally.'});
  const result=await check(pending.candidate!,source,{signal});abort(signal);
  if(result.feedback.compiler.status==='ready'&&result.feedback.runtime.status==='ready'&&result.feedback.quality?.status==='passed')patch({pending:undefined,generated:[{candidate:pending.candidate!,blockId:pending.candidate!.artifact.anchors[0].blockId}]});
  else patch({pending:undefined,issues:[...state.issues,'The custom figure did not pass local layout/execution checks and was not inserted. No additional paid repair was started.'].slice(-16)});
 }
 async function execute(signal:AbortSignal){await load();abort(signal);if(state.status==='complete'||state.status==='partial')return;if(!selected.length){patch({status:'partial',message:'This source contains no readable passages for Meta to illustrate.'});return;}while(state.sectionsDone<selected.length){abort(signal);await plan(signal);}if(!state.customAttempted||state.pending?.kind==='custom')await custom(signal);abort(signal);const remaining=sections.length-selected.length,partial=remaining>0||state.issues.length>0||state.generated.length===0;patch({status:partial?'partial':'complete',message:partial?`Automatic preparation finished with limits. ${remaining>0?`${remaining} additional source sections were outside this run’s budget. `:''}${state.generated.length?'A custom figure is ready.':'No custom figure passed admission; the original source remains available.'}`:'Your figures are ready. Meta selected the figures and their cited passages.'});}
 try{await load();}catch(error){invalidCache=true;emit({...state,status:'blocked',message:error instanceof Error?error.message.slice(0,1000):'The saved automatic preparation is unavailable.'});}
 function stopped(error:unknown,signal:AbortSignal,persist:boolean){if(disposed)return;const paused=signal.aborted,next={...state,status:paused?'paused' as const:'blocked' as const,message:paused?'Automatic preparation paused. Saved figures and request references are retained.':error instanceof Error?error.message.slice(0,1000):'Automatic preparation stopped. The source and saved requests were retained.'};if(persist){try{save(next);return;}catch{/* Do not start new work when saving fails. */}}emit(next);}
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
