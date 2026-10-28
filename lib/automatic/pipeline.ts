import {z} from 'zod';
import {validateDocument,type SourceDocument} from '../../shared/schema';
import {validateWidgetEnvelope,type WidgetEnvelope} from '../../shared/widgets';
import {validateFigureArtifact} from '../../shared/figure-artifacts';
import {generationReplySchema,type GenerationCandidate} from '../../shared/artifact-generation';
import {enrichmentResultSchema} from '../enrichment/contracts';
import {paperPlanSchema,paperFigureBriefSchema,paperReadingGuideSchema,existingPaperFigureSchema,validatePaperPlan,WHOLE_PAPER_SECTION_ID,type PaperFigureBrief,type ExistingPaperFigure} from '../enrichment/whole-paper';
import {buildSourceSections} from '../enrichment/sections';
import {enrichmentFingerprint} from '../enrichment/state';
import {canonicalArtifactJson} from '../../shared/figure-compilation';
import {sha256Text} from '../artifacts/sdk-source';
import {
 automaticPaperStateSchema as legacySchema,createAutomaticPaperPipeline as createLegacyPipeline,
 automaticPaperStorageKey,AutomaticPaperHttpError,type AutomaticPaperOptions as LegacyOptions,
} from './legacy-pipeline';
export {automaticPaperStorageKey,AutomaticPaperHttpError};
export type {AutomaticPaperTransport} from './legacy-pipeline';
export type AutomaticPaperOptions=Omit<LegacyOptions,'recoveryOnly'>;
export const AUTOMATIC_PAPER_POLICY=Object.freeze({version:3,pollMs:1500,maxCacheBytes:20_000_000});
const jobSchema=z.strictObject({token:z.string().max(5000),createdAt:z.number().finite(),action:z.literal('plan'),sectionId:z.string().max(100),model:z.string().max(120)});
const oldPending=legacySchema.shape.pending.unwrap();
const requestFields={requestId:z.string().uuid(),feedback:z.string().max(1200),job:jobSchema.optional()};
const outlinePending=z.strictObject({kind:z.literal('outline'),...requestFields,existingFigures:z.array(existingPaperFigureSchema).max(3000)});
const figurePending=z.strictObject({kind:z.literal('figure'),...requestFields,figureBrief:paperFigureBriefSchema});
const customPending=oldPending.options[1].extend({scope:z.literal('paper').optional(),figureId:z.string().max(40).optional(),anchor:z.strictObject({blockId:z.string().max(100),page:z.number().int().min(1),quote:z.string().max(1000)}).optional()});
const generatedSchema=legacySchema.shape.generated;
export const automaticPaperStateSchema=legacySchema.extend({
 version:z.literal(3),editorialRevision:z.literal(1).optional(),paperPlan:paperPlanSchema.optional(),
 figureTasksDone:z.array(z.string().max(40)).max(12).default([]),
 figureBindings:z.array(z.strictObject({figureId:z.string().max(40),widgetId:z.string().max(100).optional(),generatedSha:z.string().regex(/^[a-f0-9]{64}$/).optional(),readingGuide:paperReadingGuideSchema.optional()})).max(12).default([]),
 archivedWidgets:legacySchema.shape.widgets.default([]),archivedGenerated:generatedSchema.default([]),
 pending:z.discriminatedUnion('kind',[oldPending.options[0],outlinePending,figurePending,customPending]).optional(),
});
export type AutomaticPaperState=z.infer<typeof automaticPaperStateSchema>;
type ModelPending=z.infer<typeof outlinePending>|z.infer<typeof figurePending>;
type CustomPending=z.infer<typeof customPending>;
const replySchema=z.object({status:z.enum(['queued','analyzing','complete','failed','cancelled','expired','incomplete']),job:jobSchema.optional(),paperPlan:paperPlanSchema.optional(),result:enrichmentResultSchema.optional(),error:z.string().max(2000).optional(),uncertain:z.boolean().optional()});
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function abort(signal:AbortSignal){if(signal.aborted)throw new DOMException('Preparation paused','AbortError');}

/** One editorial decision over the complete source; only Meta-selected figures are implemented. */
export async function createAutomaticPaperPipeline(input:SourceDocument,options:AutomaticPaperOptions={}){
 const source=freeze(validateDocument(clone(input))),fingerprint=await enrichmentFingerprint(source),key=automaticPaperStorageKey(source,fingerprint),sections=buildSourceSections(source);
 const storage=options.storage??(typeof localStorage==='undefined'?undefined:localStorage),now=options.now??Date.now;
 const listeners=new Set<()=>void>();let running:Promise<void>|undefined,controller:AbortController|undefined,disposed=false,invalidCache=false,sessionReady=false;
 let state:AutomaticPaperState=freeze(automaticPaperStateSchema.parse({format:'paperplay-automatic-paper',version:3,editorialRevision:1,fingerprint,status:'idle',message:'Meta will read the complete paper and choose a few useful illustrations.',sectionsTotal:sections.length,sectionIds:sections.map(s=>s.id),sectionsDone:0,widgets:[],generated:[],customRequests:[],customDone:[],issues:[],customAttempted:false}));
 function emit(next:AutomaticPaperState){state=freeze(automaticPaperStateSchema.parse(next));listeners.forEach(fn=>fn());}
 function save(next:AutomaticPaperState){if(!storage)throw Error('Browser storage is needed to retain accepted Meta requests.');const checked=automaticPaperStateSchema.parse(next),raw=JSON.stringify(checked);if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('The saved illustrations exceed browser storage capacity. No new request was started.');storage.setItem(key,raw);emit(checked);}
 function patch(next:Partial<AutomaticPaperState>){save({...state,...next});}
 async function load(publish=true){
  const raw=storage?.getItem(key);if(!raw)return;
  if(new TextEncoder().encode(raw).length>AUTOMATIC_PAPER_POLICY.maxCacheBytes)throw Error('The saved illustrations exceed browser storage capacity. Their original record was retained.');
  const value=JSON.parse(raw);let saved:AutomaticPaperState;
  if(value.version!==3){
   const old=legacySchema.parse(value),ids=sections.map(s=>s.id);
   if(old.sectionIds.some((id,i)=>id!==ids[i]))throw Error('The earlier source sections no longer match this paper.');
   // Keep accepted references and all prior figures. Meta will choose what to reuse in its new global plan.
   saved=automaticPaperStateSchema.parse({...old,version:3,sectionIds:ids,status:old.pending?old.status:'idle',message:old.pending?old.message:'Meta is reviewing the complete paper to keep the most useful illustrations.',issues:[]});
   if(old.version===1&&saved.pending?.kind==='custom'){
    if(!old.customAttempted&&!saved.pending.candidate)saved.pending=undefined;
    else saved.pending={...saved.pending,sessionMaxAttempts:1};
   }
  }else saved=automaticPaperStateSchema.parse(value);
  if(!saved.editorialRevision&&!saved.pending)saved={...saved,editorialRevision:1,paperPlan:undefined,figureTasksDone:[],figureBindings:[],status:'idle',issues:[],message:'Meta is reviewing the saved figures and matching each guide to its actual controls.'};
  if(saved.fingerprint!==fingerprint||saved.sectionsTotal!==sections.length||JSON.stringify(saved.sectionIds)!==JSON.stringify(sections.map(s=>s.id)))throw Error('The saved plan belongs to different source content.');
  for(const widget of [...saved.widgets,...saved.archivedWidgets])validateWidgetEnvelope(widget,source);
  for(const entry of [...saved.generated,...saved.archivedGenerated]){
   validateFigureArtifact(entry.candidate.artifact,source);
   if(entry.blockId!==entry.candidate.artifact.anchors[0].blockId||entry.candidate.sha256!==await sha256Text(canonicalArtifactJson({plan:entry.candidate.plan,artifact:entry.candidate.artifact})))throw Error('The saved illustration content or source changed.');
  }
  if(saved.paperPlan){
   validatePaperPlan(saved.paperPlan,source,existingFigures(saved));
   const ids=new Set(saved.paperPlan.figures.map(f=>f.id));
   if(saved.figureTasksDone.some(id=>!ids.has(id))||saved.figureBindings.some(b=>!ids.has(b.figureId)||b.widgetId&&!saved.widgets.some(w=>w.id===b.widgetId)||b.generatedSha&&!saved.generated.some(g=>g.candidate.sha256===b.generatedSha)))throw Error('A saved illustration binding no longer matches its plan.');
  }
  if(publish)emit(saved);else state=freeze(saved);
 }
 const transport=options.transport??(async(endpoint:string,payload:unknown,signal:AbortSignal)=>{
  if(endpoint.endsWith('/start')){const {refreshAdoptionPolicy}=await import('../adoption/policy');const policy=await refreshAdoptionPolicy();if(policy.state!=='ready'||!policy.policy?.newModelCreation||endpoint.includes('artifact-generation')&&!policy.policy.generatedExecution)throw Error('Automatic illustrations are unavailable here. Saved results remain readable.');}
  const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
  const text=await response.text();if(new TextEncoder().encode(text).length>2_500_000)throw Error('The response was too large. Its accepted reference is retained.');let reply;try{reply=JSON.parse(text);}catch{throw Error('Meta’s response could not be read. Its request reference is retained.');}
  if(!response.ok){const quota=z.object({reason:z.enum(['session-rate','global-rate','daily-requests','daily-tokens']),retryAt:z.number().int().nonnegative()}).safeParse(reply.quota);throw new AutomaticPaperHttpError(response.status,typeof reply.error==='string'?reply.error:'Meta could not prepare this paper.',reply.uncertain===true,quota.success?quota.data.retryAt:undefined,quota.success?quota.data.reason:undefined);}return reply;
 });
 const sleep=options.sleep??(async(signal:AbortSignal)=>{abort(signal);await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new DOMException('Paused','AbortError'));},timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},AUTOMATIC_PAPER_POLICY.pollMs);signal.addEventListener('abort',stop,{once:true});});});
 const lock=options.lock??(async<T>(name:string,run:()=>Promise<T>,signal:AbortSignal)=>{if(typeof navigator==='undefined'||!navigator.locks)throw Error('This browser cannot coordinate saved Meta requests across tabs.');return navigator.locks.request(name,{signal},run);});
 const check=options.check??(async(candidate,document,opts)=>(await import('../artifacts/generation-check')).checkGeneratedCandidate(candidate,document,opts));
 async function prepareSession(signal:AbortSignal){if(sessionReady||options.transport)return;const result=await transport('/api/enrichment/session',{},signal);abort(signal);if(!z.strictObject({ready:z.literal(true)}).safeParse(result).success)throw Error('The browser session could not be prepared.');sessionReady=true;}
 function existingFigures(s=state):ExistingPaperFigure[]{
  const widgets=new Map([...s.archivedWidgets,...s.widgets].filter(w=>w.authorship.kind==='meta').map(w=>[w.id,w]));
  const generated=new Map([...s.archivedGenerated,...s.generated].filter(g=>g.candidate.artifact.authorship.kind==='meta').map(g=>[g.candidate.sha256,g]));
  return [...[...widgets.values()].map(w=>({id:'widget:'+w.id,title:w.title,kind:w.spec.kind,blockId:w.source.blockId,quote:w.source.quote,mapping:w.spec.mapping,spec:w.spec})),...[...generated.values()].map(g=>({id:'generated:'+g.candidate.sha256,title:g.candidate.artifact.title,kind:'generated' as const,blockId:g.blockId,quote:g.candidate.artifact.anchors[0].quote,mapping:[g.candidate.plan.objective,g.candidate.plan.mechanism,...g.candidate.plan.interactions].join(' · ').slice(0,2000)}))];
 }
 function modelContext(pending:ModelPending){return {source,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:pending.kind==='outline'?'paper-outline':'paper-figure',feedback:pending.feedback,...(pending.kind==='outline'?{existingFigures:pending.existingFigures}:{figureBrief:pending.figureBrief})};}
 async function requestModel(initial:ModelPending,signal:AbortSignal){
  let pending=initial;const context=modelContext(pending);let raw;
  try{raw=await transport(`/api/enrichment/${pending.job?'status':'start'}`,{...context,...(pending.job?{job:pending.job}:{requestId:pending.requestId})},signal);}
  catch(error){
   const unsubmitted=error instanceof AutomaticPaperHttpError&&error.status===409&&!error.uncertain&&!pending.job&&['The frozen capability selection changed before this unsubmitted request could resume.','The frozen prompt changed before this unsubmitted request could resume.'].includes(error.message);
   if(!unsubmitted)throw error;abort(signal);pending={...pending,requestId:crypto.randomUUID()};patch({pending});raw=await transport('/api/enrichment/start',{...context,requestId:pending.requestId},signal);
  }
  let reply=replySchema.parse(raw);
  while(true){
   abort(signal);
   if(reply.job){if(reply.job.sectionId!==WHOLE_PAPER_SECTION_ID)throw Error('The returned job belongs to another paper context.');pending={...pending,job:reply.job};patch({pending});}
   if(!['queued','analyzing'].includes(reply.status))break;
   if(!pending.job)throw Error('Meta accepted work without a recoverable reference. No replacement was started.');
   await sleep(signal);reply=replySchema.parse(await transport('/api/enrichment/status',{...context,job:pending.job},signal));
  }
  if(reply.uncertain)throw Error(reply.error??'The accepted request is uncertain. Its reference is retained.');
  return reply;
 }
 function correct(pending:ModelPending,diagnostic:string){patch({pending:{...pending,requestId:crypto.randomUUID(),job:undefined,feedback:('Correct the known terminal response failure: '+diagnostic+'. Keep the complete-paper editorial objective: a few distinct, useful illustrations, exact source anchors, and no renamed repeats.').slice(0,1200)},message:pending.kind==='outline'?'Meta is refining its illustration plan for the complete paper.':'Meta is correcting the selected illustration.'});}
 async function outline(signal:AbortSignal){
  let pending=state.pending?.kind==='outline'?state.pending:undefined;
  if(!pending){await prepareSession(signal);pending={kind:'outline',requestId:crypto.randomUUID(),feedback:'Choose a concise set of complementary interactions for the complete paper. Prefer a few high-value figures over exhaustive coverage. Reuse only saved figures that actually explain their chosen passage; omit redundant or misleading examples.',existingFigures:existingFigures()};patch({pending,status:'planning',message:'Meta is reading the complete paper and choosing the most useful places for an interaction.'});}
  else patch({status:'planning',message:'Retrieving Meta’s illustration plan for the complete paper.'});
  const reply=await requestModel(pending,signal);abort(signal);
  if(reply.status==='failed'||reply.status==='incomplete'){correct(pending,reply.error??reply.status);return;}
  if(reply.status!=='complete'||!reply.paperPlan)throw Error(reply.error??'The complete-paper plan could not be retrieved.');
  let plan;try{plan=validatePaperPlan(reply.paperPlan,source,pending.existingFigures);}catch(error){correct(pending,error instanceof Error?error.message:'Invalid paper plan');return;}
  const oldWidgets=[...new Map([...state.archivedWidgets,...state.widgets].map(w=>[w.id,w])).values()],oldGenerated=[...new Map([...state.archivedGenerated,...state.generated].map(g=>[g.candidate.sha256,g])).values()];
  const widgets:WidgetEnvelope[]=[],generated:AutomaticPaperState['generated']=[],figureBindings:AutomaticPaperState['figureBindings']=[],done:string[]=[];
  for(const figure of plan.figures){
   if(figure.reuseId?.startsWith('widget:')){const widget=oldWidgets.find(w=>'widget:'+w.id===figure.reuseId);if(!widget)throw Error('The chosen saved figure is unavailable.');widgets.push(widget);figureBindings.push({figureId:figure.id,widgetId:widget.id});done.push(figure.id);}
   if(figure.reuseId?.startsWith('generated:')){const entry=oldGenerated.find(g=>'generated:'+g.candidate.sha256===figure.reuseId);if(!entry)throw Error('The chosen saved interaction is unavailable.');generated.push(entry);figureBindings.push({figureId:figure.id,generatedSha:entry.candidate.sha256});done.push(figure.id);}
  }
  patch({paperPlan:plan,widgets,generated,archivedWidgets:oldWidgets.filter(w=>!widgets.some(keep=>keep.id===w.id)),archivedGenerated:oldGenerated.filter(g=>!generated.some(keep=>keep.candidate.sha256===g.candidate.sha256)),figureBindings,figureTasksDone:done,pending:undefined,sectionsDone:sections.length,issues:[],message:plan.summary});
 }
 function finishFigure(id:string,binding?:AutomaticPaperState['figureBindings'][number],issue?:string,content:Partial<Pick<AutomaticPaperState,'widgets'|'generated'>>={}){patch({...content,pending:undefined,customAttempted:false,figureTasksDone:[...new Set([...state.figureTasksDone,id])],figureBindings:binding?[...state.figureBindings.filter(b=>b.figureId!==id),binding]:state.figureBindings,issues:issue?[...state.issues,issue].slice(-16):state.issues});}
 function customBrief(figure:PaperFigureBrief,diagnostic=''){return ('Objective: '+figure.learningGoal.slice(0,200)+'. Interaction: '+figure.interaction.slice(0,250)+'. Insight: '+figure.expectedInsight.slice(0,200)+'. '+figure.brief.slice(0,300)+'. '+diagnostic.slice(0,200)).slice(0,1200);}
 function beginCustom(figure:PaperFigureBrief,brief=customBrief(figure)){
  const pending:CustomPending={kind:'custom',scope:'paper',figureId:figure.id,sectionId:WHOLE_PAPER_SECTION_ID,anchor:{blockId:figure.blockId,page:figure.page,quote:figure.quote},brief,runId:crypto.randomUUID(),attempt:1,totalAttempts:0};patch({pending,customAttempted:false,status:'generating',message:`Meta is building “${figure.title}”.`});
 }
 async function buildSelectedFigure(figure:PaperFigureBrief,signal:AbortSignal){
  if(figure.kind==='generated'){beginCustom(figure);return;}
  let pending=state.pending?.kind==='figure'?state.pending:undefined;
  if(!pending){await prepareSession(signal);pending={kind:'figure',requestId:crypto.randomUUID(),feedback:'Implement only this selected illustration. Preserve its reader question, source placement and useful interaction. Make the purpose, labels and visual relationships immediately clear.',figureBrief:figure};patch({pending,status:'generating',message:`Meta is building “${figure.title}”.`});}
  else patch({status:'generating',message:`Retrieving “${figure.title}”.`});
  const reply=await requestModel(pending,signal);abort(signal);
  if(reply.status==='failed'||reply.status==='incomplete'){correct(pending,reply.error??reply.status);return;}
  if(reply.status!=='complete'||!reply.result)throw Error(reply.error??'The selected illustration could not be retrieved.');
  const result=reply.result;
  if(result.rejected.length){correct(pending,JSON.stringify(result.rejected).slice(0,850));return;}
  if(result.proposals.length+(result.customFigures?.length??0)>1){correct(pending,'Implement exactly one approved illustration, not several replacements.');return;}
  if(result.proposals.length){
   // Provider proposal IDs are local to one response. Bind the installed identity
   // to the approved global-plan entry, so separate figures cannot overwrite one another.
   const widget=validateWidgetEnvelope({...result.proposals[0].envelope,id:'meta-'+(await sha256Text(fingerprint+':'+figure.id)).slice(0,32)},source);
   if(widget.authorship.kind!=='meta'||widget.source.blockId!==figure.blockId||widget.source.page!==figure.page||widget.spec.kind!==figure.kind){correct(pending,'The implementation must preserve the approved widget kind and exact source placement.');return;}
   finishFigure(figure.id,{figureId:figure.id,widgetId:widget.id,...(result.readingGuide?{readingGuide:result.readingGuide}:{})},undefined,{widgets:[...state.widgets.filter(w=>w.id!==widget.id),widget]});
  }else if(result.customFigures?.length){
   const request=result.customFigures[0];if(request.blockId!==figure.blockId||request.page!==figure.page){correct(pending,'A custom fallback must preserve the approved source placement.');return;}
   beginCustom(figure,customBrief({...figure,brief:request.brief}));
  }else finishFigure(figure.id);
 }
 function nextCustom(pending:CustomPending,candidate:GenerationCandidate|undefined,feedback:import('../../shared/artifact-generation').GenerationFeedback|undefined,diagnostic:string):CustomPending{
  const attempt=pending.attempt??1,totalAttempts=(pending.totalAttempts??0)+1;
  if(attempt<(pending.sessionMaxAttempts??3)&&pending.run&&now()+2000<pending.run.deadlineAt)return {...pending,attempt:attempt+1,totalAttempts,previous:candidate,feedback,candidate:undefined};
  const figure=state.paperPlan!.figures.find(f=>f.id===pending.figureId)!;
  return {...pending,runId:crypto.randomUUID(),run:undefined,attempt:1,sessionMaxAttempts:undefined,totalAttempts,previous:undefined,feedback:undefined,candidate:undefined,brief:customBrief(figure,'Correct prior local failure: '+diagnostic)};
 }
 async function generate(signal:AbortSignal){
  let pending=state.pending as CustomPending;
  while(true){
   abort(signal);const attempt=pending.attempt??1,context={source,sectionId:WHOLE_PAPER_SECTION_ID,scope:'paper',anchor:pending.anchor,brief:pending.brief};
   patch({status:'generating',message:pending.previous?'Meta is improving the interaction using its layout and execution checks.':'Meta is creating the selected interaction.'});
   if(!pending.run){const prepared=generationReplySchema.parse(await transport('/api/artifact-generation/prepare',{...context,runId:pending.runId,maxAttempts:3},signal));abort(signal);if(prepared.status!=='prepared'||prepared.run.runId!==pending.runId)throw Error('The illustration session could not be prepared.');pending={...pending,run:prepared.run,sessionMaxAttempts:prepared.budget.maxAttempts};patch({pending});}
   if(!pending.candidate){
    const submitted=state.customAttempted;patch({customAttempted:true});const statusPayload={...context,run:pending.run,attempt},payload={...statusPayload,...(attempt>1&&pending.previous?{previous:pending.previous,feedback:pending.feedback}:{})};let raw;
    try{raw=await transport(`/api/artifact-generation/${submitted?'status':'start'}`,submitted?statusPayload:payload,signal);}catch(error){abort(signal);if(!submitted||!(error instanceof AutomaticPaperHttpError)||error.status!==409||error.uncertain||error.message!=='This generation attempt has not been claimed.')throw error;raw=await transport('/api/artifact-generation/start',payload,signal);}
    let reply=generationReplySchema.parse(raw);
    while(['queued','analyzing'].includes(reply.status)){abort(signal);await sleep(signal);reply=generationReplySchema.parse(await transport('/api/artifact-generation/status',statusPayload,signal));}
    abort(signal);if(reply.run.runId!==pending.run!.runId)throw Error('The custom response belongs to another run.');if(reply.uncertain||reply.status==='uncertain')throw Error(reply.error??'The accepted custom request is uncertain. Its reference is retained.');
    if(reply.status==='cancelled'){finishFigure(pending.figureId!,undefined,'The selected interaction was cancelled.');return;}
    if(reply.status==='complete'&&reply.candidate){validateFigureArtifact(reply.candidate.artifact,source);if(!reply.candidate.artifact.anchors.some(a=>a.blockId===pending.anchor!.blockId&&a.page===pending.anchor!.page&&a.quote===pending.anchor!.quote))throw Error('The generated interaction changed its approved source placement.');pending={...pending,candidate:reply.candidate};patch({pending});}
    else{pending=nextCustom(pending,undefined,undefined,reply.error??'Return a complete useful interaction.');patch({pending,customAttempted:false});continue;}
   }
   patch({status:'checking',message:'Checking the interaction’s layout, labels and controls.'});const result=await check(pending.candidate!,source,{signal});abort(signal);
   if(result.feedback.compiler.status==='ready'&&result.feedback.runtime.status==='ready'&&result.feedback.quality?.status==='passed'){
    finishFigure(pending.figureId!,{figureId:pending.figureId!,generatedSha:pending.candidate!.sha256},undefined,{generated:[...state.generated.filter(g=>g.candidate.sha256!==pending.candidate!.sha256),{candidate:pending.candidate!,blockId:pending.anchor!.blockId,requestKey:pending.figureId}]});return;
   }
   if(!result.repairable){finishFigure(pending.figureId!,undefined,'A selected interaction could not be opened locally.');return;}
   pending=nextCustom(pending,pending.candidate,result.feedback,JSON.stringify(result.feedback).slice(0,600));patch({pending,customAttempted:false});
  }
 }
 async function recoverLegacy(signal:AbortSignal){
  const pending=state.pending;if(pending?.kind!=='plan'&&!(pending?.kind==='custom'&&!pending.scope))return;
  // Already accepted section-era work is resolved with its original frozen request before any new whole-paper call.
  const {paperPlan:_,figureBindings:__,figureTasksDone:___,archivedWidgets:____,archivedGenerated:_____,editorialRevision:______,...base}=state;
  let legacyRaw=JSON.stringify({...base,version:2});
  const bridge={getItem:(name:string)=>name===key?legacyRaw:storage?.getItem(name)??null,setItem:(name:string,value:string)=>{if(!storage)throw Error('Accepted recovery needs browser storage.');storage.setItem(name,value);if(name===key)legacyRaw=value;}};
  const recovery=await createLegacyPipeline(source,{...options,storage:bridge,transport:options.transport,recoveryOnly:true,lock:async(_key,run)=>run()});
  const stop=()=>recovery.pause();signal.addEventListener('abort',stop,{once:true});
  try{await recovery.start();const result=recovery.getSnapshot();await load(false);abort(signal);if(result.pending||result.status==='blocked')throw Error(result.message);patch({pending:undefined,status:'idle'});}finally{signal.removeEventListener('abort',stop);recovery.dispose();}
 }
 async function executeOnce(signal:AbortSignal){
  await recoverLegacy(signal);abort(signal);
  if(state.status==='complete'||state.status==='partial')return;
  while(!state.paperPlan){abort(signal);await outline(signal);}
  while(state.paperPlan.figures.some(f=>!state.figureTasksDone.includes(f.id))){
   abort(signal);if(state.pending?.kind==='custom')await generate(signal);
   else{const figure=state.paperPlan.figures.find(f=>!state.figureTasksDone.includes(f.id))!;await buildSelectedFigure(figure,signal);}
  }
  if(!state.editorialRevision){patch({editorialRevision:1,paperPlan:undefined,figureBindings:[],figureTasksDone:[],pending:undefined,status:'planning',issues:[]});return executeOnce(signal);}
  patch({pending:undefined,status:state.issues.length?'partial':'complete',message:state.widgets.length+state.generated.length?'Meta selected complementary illustrations for the complete paper. Each one explains a specific passage.':'Meta reviewed the complete paper and selected no additional interaction that would improve its explanation.'});
 }
 const waitUntil=options.waitUntil??(async(retryAt:number,signal:AbortSignal)=>{while(now()<retryAt){abort(signal);await sleep(signal);}});
 async function execute(signal:AbortSignal){
  await load();
  while(true){
   if(state.status==='waiting'&&state.retryAt)await waitUntil(state.retryAt,signal);abort(signal);
   try{await executeOnce(signal);return;}
   catch(error){if(signal.aborted||!(error instanceof AutomaticPaperHttpError)||error.status!==429||error.uncertain||!error.retryAt||!error.quotaReason)throw error;patch({status:'waiting',retryAt:Math.max(now()+1000,error.retryAt),quotaReason:error.quotaReason,message:error.message,...(state.pending?.kind==='custom'?{customAttempted:false}:{})});}
  }
 }
 try{await load();}catch(error){invalidCache=true;emit({...state,status:'blocked',message:error instanceof Error?error.message.slice(0,1000):'The saved plan could not be read.'});}
 function stopped(error:unknown,signal:AbortSignal,persist:boolean){if(disposed)return;const next={...state,status:signal.aborted?(state.status==='waiting'?'waiting' as const:'paused' as const):'blocked' as const,message:signal.aborted?'Preparation paused. Saved figures and accepted requests are retained.':error instanceof Error?error.message.slice(0,1000):'Preparation stopped. The source remains readable.'};if(persist){try{save(next);return;}catch{}}emit(next);}
 return Object.freeze({getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  start(){if(disposed||invalidCache)return Promise.resolve();if(running)return running;controller=new AbortController();const signal=controller.signal;running=lock(key,async()=>{try{await execute(signal);}catch(error){stopped(error,signal,true);}},signal).catch(error=>stopped(error,signal,false)).finally(()=>{running=undefined;controller=undefined;});return running;},
  pause(){if(controller){controller.abort();return running??Promise.resolve();}if(disposed||invalidCache||state.status==='complete'||state.status==='partial')return Promise.resolve();const signal=new AbortController().signal;return lock(key,async()=>{if(disposed)return;await load(false);if(state.status==='complete'||state.status==='partial'){emit(state);return;}patch({status:'paused',message:'Preparation paused. Saved requests are retained.'});},signal).catch(error=>stopped(error,signal,false));},
  dispose(){disposed=true;controller?.abort();listeners.clear();},
 });
}
export type AutomaticPaperPipeline=Awaited<ReturnType<typeof createAutomaticPaperPipeline>>;
