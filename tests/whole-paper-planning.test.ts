import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateDocument,type SourceDocument} from '../shared/schema';
import {WHOLE_PAPER_SECTION_ID,wholePaperContext,validatePaperPlan,paperReadingGuideSchema,type PaperFigureBrief,type ExistingPaperFigure} from '../lib/enrichment/whole-paper';
import {enrichmentResultSchema} from '../lib/enrichment/contracts';
import {enrichmentRetrievalQuery,retrieveCapabilities,generationRetrievalQuery} from '../lib/retrieval/selection';
import {createEnrichmentHandlers} from '../server/enrichment/handlers';
import {createEnrichmentStore} from '../server/enrichment/store';
import {createSqliteUsageStore} from '../server/usage/store';
import {readMetaConfig} from '../server/meta/config';
import {enrichmentProviderRequest,enrichmentPromptMetrics,enrichmentJsonSchema,paperFigureJsonSchema,type EnrichmentInput,type EnrichmentProvider} from '../server/enrichment/provider';
import {createWidgetPreset} from '../lib/widgets/presets';
import {getWidgetDescriptor} from '../lib/widgets/catalog';

const origin='http://localhost:3000';
function document(large=false):SourceDocument{
 return validateDocument({schemaVersion:1,id:'whole-paper-fixture',sourceVersion:'authored-v1',title:'An authored whole-paper planning fixture',authors:['Paperplay'],source:{kind:'prepared',url:'https://example.org/paper'},pageCount:3,
  blocks:[...Array.from({length:43},(_,index)=>[{id:`heading-${index}`,kind:'heading',level:2,page:1,text:`Section ${index}`},{id:`body-${index}`,kind:'paragraph',page:1,text:`Passage ${index} explains a distinct teaching relationship in this complete source. ${large?'Full source context. '.repeat(160):''}`}]).flat(),
   {id:'math',kind:'equation',page:2,latex:'E = mc^2',label:'Energy relationship'},
   {id:'original',kind:'original-figure',page:2,caption:'An original illustration already explains the central relation.',alt:'Original figure',imageUrls:['https://example.org/figure.png']},
   {id:'last',kind:'paragraph',page:3,text:'The final source passage is supplied completely and remains available to the paper-wide planner.'}],anchors:[],extractionWarnings:['Project-authored fixture, not a scientific experiment.']});
}
const source=document();
function brief(patch:Partial<PaperFigureBrief>={}):PaperFigureBrief{return {id:'centralRelation',title:'Explore the central relation',blockId:'body-25',page:1,quote:'Passage 25 explains a distinct teaching relationship in this complete source.',kind:'diagram',whyHere:'This passage introduces the relation that the later argument depends on.',learningGoal:'How do these two stages relate?',interaction:'Move between the two explicitly described stages.',expectedInsight:'The later stage depends on the earlier stage.',brief:'Use a small two-stage conceptual scene with clear labels and one active stage.',reuseId:null,...patch};}
function readingGuide(){const {whyHere,learningGoal,expectedInsight}=brief();return {whyHere,learningGoal,expectedInsight,interaction:'Press Next to inspect the next predefined stage and notice which relationship is highlighted.'};}
const request=(body:unknown,cookie?:string)=>new Request(origin+'/api/enrichment/start',{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
async function fixture(t:{after(fn:()=>void):void},output:unknown,sourceValue=source){
 const inputs:EnrichmentInput[]=[],store=createEnrichmentStore({path:':memory:',enforceLimits:false}),usage=createSqliteUsageStore({path:':memory:',enforceLimits:false});let retrieves=0;
 const provider:EnrichmentProvider={async start(input){inputs.push(input);return {id:'resp_whole_paper',status:'queued'};},async retrieve(id){retrieves++;return {id,status:'completed',output_text:JSON.stringify(output),usage:null};},async cancel(id){return {id,status:'cancelled'};}};
 const config=readMetaConfig({MODEL_API_KEY:'whole-paper-test-fixture',META_ANALYSIS_ENABLED:'true'}),handlers=createEnrichmentHandlers({getConfig:()=>config,store,usage,provider:()=>provider,signingSecret:'whole-paper-test-secret'});
 const cookie=(await handlers.session(request({}))).headers.get('set-cookie')!.split(';')[0];
 const body={source:sourceValue,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:'paper-outline',feedback:'',existingFigures:[],requestId:randomUUID()};
 t.after(()=>{store.close();usage.close?.();});
 return {handlers,inputs,usage,cookie,body,retrieves:()=>retrieves};
}
function proposal(){return {id:'centralRelation',title:brief().title,concept:'Teaching stages',blockId:brief().blockId,page:brief().page,quote:brief().quote,reason:brief().whyHere,objective:brief().learningGoal,neededData:[],provenance:'illustrative',interactions:[getWidgetDescriptor('diagram').controls[0]],specJson:JSON.stringify({...createWidgetPreset('diagram'),mapping:'Two illustrative stages help explain this particular source relationship.'}),limitations:['Authored teaching values, not source measurements.']};}

test('whole-paper input includes every block, final passage, equations, source figure metadata and source link without truncation',async()=>{
 const complete=document(true),context=wholePaperContext(complete),serialized=JSON.parse(context.text);
 assert.equal(context.section.id,WHOLE_PAPER_SECTION_ID);assert.equal(context.section.partial,false);assert.equal(serialized.blocks.length,complete.blocks.length);
 for(let index=0;index<complete.blocks.length;index++){const {blockId,...block}=serialized.blocks[index];assert.equal(blockId,complete.blocks[index].id);assert.deepEqual(block,complete.blocks[index]);}
 const last=complete.blocks.at(-1);assert.equal(serialized.blocks.at(-1).text,last?.kind==='paragraph'?last.text:undefined);
 assert.equal(serialized.sourceLink,'https://example.org/paper');assert.deepEqual(serialized.extractionWarnings,complete.extractionWarnings);
 const query=await enrichmentRetrievalQuery({source:complete,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:'paper-outline',feedback:''}),retrieval=await retrieveCapabilities(query);
 const input:EnrichmentInput={action:'plan',scope:'paper-outline',context:context.text,feedback:'',retrieval,existingFigures:[]};
 const body=enrichmentProviderRequest(input,'fixture-model'),payload=JSON.parse(body.input),metrics=enrichmentPromptMetrics(input,'fixture-model');
 assert.ok(metrics.characters>100_000);assert.deepEqual(payload.fullPaper,serialized);assert.equal(payload.selectedSource,undefined);assert.equal(payload.capabilityManifest.selected.length,10);assert.equal(body.text.format.name,'paperplay_reading_plan');assert.equal(body.input.includes('selectedPassages'),false);
 const generation=await generationRetrievalQuery({source:complete,sectionId:WHOLE_PAPER_SECTION_ID,scope:'paper',brief:'Implement the chosen relation.'});assert.equal(generation.sourceFingerprint,query.sourceFingerprint);assert.ok(generation.context.length<1000);
});

test('outline admission sends the complete large source once and accepted recovery remains bound to its scope',async t=>{
 const f=await fixture(t,{summary:'Only one distinct conceptual illustration is useful.',figures:[brief()]},document(true));
 const started=await f.handlers.start(request(f.body,f.cookie)),first=await started.json();assert.equal(started.status,200,JSON.stringify(first));assert.equal(f.inputs.length,1);
 assert.ok(enrichmentPromptMetrics(f.inputs[0]).characters>100_000);assert.equal((await f.usage.summary()).requests,1);
 const {requestId:_,...context}=f.body;
 const changed=await f.handlers.status(request({...context,scope:'paper-figure',existingFigures:undefined,figureBrief:brief(),job:first.job},f.cookie));assert.equal(changed.status,403);assert.equal(f.retrieves(),0);
 const done=await(await f.handlers.status(request({...context,job:first.job},f.cookie))).json();assert.equal(done.status,'complete');assert.equal(done.paperPlan.figures.length,1);assert.equal(done.paperPlan.figures[0].blockId,'body-25');assert.equal(done.result,undefined);assert.equal(f.inputs.length,1);
 await f.handlers.start(request(f.body,f.cookie));assert.equal(f.inputs.length,1);
});

test('Meta may retain only one useful saved illustration, omit all others, or select no additional figures',()=>{
 const saved:ExistingPaperFigure[]=[{id:'saved-central',title:'Existing central relation',kind:'diagram',blockId:brief().blockId,quote:brief().quote,mapping:'A correct conceptual relation.'},{id:'saved-redundant',title:'The same relation again',kind:'diagram',blockId:'body-26',quote:'Passage 26 explains a distinct teaching relationship in this complete source.',mapping:'The same two stages under different labels.'}];
 assert.equal(validatePaperPlan({summary:'Keep just the central explanation.',figures:[brief({reuseId:'saved-central'})]},source,saved).figures.length,1);
 assert.deepEqual(validatePaperPlan({summary:'Original illustrations already explain the material.',figures:[]},source,saved).figures,[]);
 assert.throws(()=>validatePaperPlan({summary:'Invalid reuse',figures:[brief({reuseId:'invented'})]},source,saved),/supplied saved figure/);
 assert.throws(()=>validatePaperPlan({summary:'Wrong kind',figures:[brief({kind:'graph',reuseId:'saved-central'})]},source,saved),/same kind/);
 assert.throws(()=>validatePaperPlan({summary:'Invented location',figures:[brief({blockId:'not-in-source'})]},source,saved),/exact block/);
 assert.throws(()=>validatePaperPlan({summary:'Repeated identity',figures:[brief(),brief()]},source),/repeats/);
});

test('implementation receives the complete paper and one approved brief, then returns only its anchored widget',async t=>{
 const f=await fixture(t,{summary:'Implement the selected teaching relation.',proposals:[proposal()],customFigures:[],warnings:[],repetitionReason:'',readingGuide:readingGuide()});
 const body={...f.body,scope:'paper-figure',existingFigures:undefined,figureBrief:brief()};const first=await(await f.handlers.start(request(body,f.cookie))).json();assert.equal(f.inputs[0].scope,'paper-figure');assert.equal(JSON.parse(f.inputs[0].context).blocks.length,source.blocks.length);assert.deepEqual(f.inputs[0].figureBrief,brief());
 const {requestId:_,...context}=body,done=await(await f.handlers.status(request({...context,job:first.job},f.cookie))).json();assert.equal(done.status,'complete');assert.equal(done.result.proposals.length,1);assert.equal(done.result.proposals[0].envelope.source.blockId,brief().blockId);assert.deepEqual(done.result.readingGuide,readingGuide());assert.notEqual(done.result.readingGuide.interaction,brief().interaction);assert.deepEqual(enrichmentResultSchema.parse(done.result).readingGuide,readingGuide());
 const {readingGuide:oldGuide,...legacyResult}=done.result;assert.equal(enrichmentResultSchema.parse(legacyResult).readingGuide,undefined);
 const missing=await f.handlers.start(request({...body,figureBrief:undefined,requestId:randomUUID()},f.cookie));assert.equal(missing.status,400);assert.equal(f.inputs.length,1);
});

test('outline receives exact saved configurations for semantic comparison and rejects a mislabeled kind before submission',async t=>{
 const f=await fixture(t,{summary:'Review the actual saved mechanism.',figures:[]});
 const spec=createWidgetPreset('diagram'),existing:ExistingPaperFigure={id:'saved-example',title:'Saved relation',kind:'diagram',blockId:brief().blockId,quote:brief().quote,mapping:'An illustrative relationship whose actual configuration must be inspected.',spec};
 const result=await f.handlers.start(request({...f.body,existingFigures:[existing]},f.cookie));assert.equal(result.status,200);
 const payload=JSON.parse(enrichmentProviderRequest(f.inputs[0]).input);assert.deepEqual(payload.existingFigures[0].spec,spec);assert.equal(payload.fullPaper.blocks.length,source.blocks.length);
 const invalid=await f.handlers.start(request({...f.body,requestId:randomUUID(),existingFigures:[{...existing,kind:'equation'}]},f.cookie));assert.equal(invalid.status,400);assert.equal(f.inputs.length,1);
});

test('an implementation cannot expand the chosen plan with an extra figure or move it to another passage',async t=>{
 for(const proposals of [[proposal(),{...proposal(),id:'unplanned'}],[{...proposal(),blockId:'body-26',quote:'Passage 26 explains a distinct teaching relationship in this complete source.'}]]){
  const f=await fixture(t,{summary:'An invalid implementation.',proposals,customFigures:[],warnings:[],repetitionReason:'',readingGuide:readingGuide()});const body={...f.body,scope:'paper-figure',existingFigures:undefined,figureBrief:brief()},first=await(await f.handlers.start(request(body,f.cookie))).json(),{requestId:_,...context}=body;
  const done=await(await f.handlers.status(request({...context,job:first.job},f.cookie))).json();assert.equal(done.status,'failed');assert.match(done.error,/one approved|approved illustration/);assert.equal(done.result,undefined);
 }
});

test('only the implementation wire requires a plain-text guide; section requests and legacy results remain compatible',async t=>{
 assert.equal((enrichmentJsonSchema.required as string[]).includes('readingGuide'),false);assert.equal((enrichmentJsonSchema.properties as Record<string,unknown>).readingGuide,undefined);
 assert.equal((paperFigureJsonSchema.required as string[]).includes('readingGuide'),true);
 assert.throws(()=>paperReadingGuideSchema.parse({...readingGuide(),interaction:'<button>Change k</button>'}),/plain explanatory text/);
 assert.throws(()=>paperReadingGuideSchema.parse({...readingGuide(),whyHere:'x'.repeat(601)}));
 for(const guide of [undefined,{...readingGuide(),interaction:'<script>invented control</script>'}]){
  const f=await fixture(t,{summary:'Implement the selected relation.',proposals:[proposal()],customFigures:[],warnings:[],repetitionReason:'',...(guide?{readingGuide:guide}:{})});
  const body={...f.body,scope:'paper-figure',existingFigures:undefined,figureBrief:brief()},first=await(await f.handlers.start(request(body,f.cookie))).json(),{requestId:_,...context}=body;
  const done=await(await f.handlers.status(request({...context,job:first.job},f.cookie))).json();assert.equal(done.status,'failed');assert.match(done.error,/readingGuide/);assert.equal(done.result,undefined);
 }
});

test('oversized complete input is rejected explicitly before provider submission and never replaced by excerpts',async t=>{
 const large=validateDocument({...source,blocks:Array.from({length:70},(_,index)=>({id:`large-${index}`,kind:'paragraph',page:1,text:'Whole input remains intact. '.repeat(650)}))}),f=await fixture(t,{summary:'Unused',figures:[]},large);
 const response=await f.handlers.start(request(f.body,f.cookie)),body=await response.json();assert.equal(response.status,413);assert.match(body.error,/complete paper|complete source/);assert.equal(f.inputs.length,0);assert.equal((await f.usage.summary()).requests,0);
});

test('checking an unknown saved request cannot reserve tokens or start Meta, while an accepted request remains retrievable',async t=>{
 const f=await fixture(t,{summary:'Only useful illustrations.',figures:[]});
 const absent=await f.handlers.start(request({...f.body,verifyOnly:true},f.cookie));
 assert.equal(absent.status,409);assert.equal(f.inputs.length,0);assert.equal((await f.usage.summary()).requests,0);
 const started=await f.handlers.start(request(f.body,f.cookie));assert.equal(started.status,200);assert.equal(f.inputs.length,1);
 const checked=await f.handlers.start(request({...f.body,verifyOnly:true},f.cookie)),saved=await checked.json();
 assert.equal(checked.status,200);assert.ok(saved.job);assert.equal(f.inputs.length,1);assert.equal((await f.usage.summary()).requests,1);
 const {requestId:_,...context}=f.body;
 const done=await(await f.handlers.status(request({...context,job:saved.job},f.cookie))).json();
 assert.equal(done.status,'complete');assert.equal(f.inputs.length,1);
});

test('host-owned synchronous Meta inference returns a polling handle before completion and never submits twice',async t=>{
 const store=createEnrichmentStore({path:':memory:',enforceLimits:false}),usage=createSqliteUsageStore({path:':memory:',enforceLimits:false});
 t.after(()=>{store.close();usage.close?.();});
 let finish!:(value:any)=>void,starts=0,retrieves=0;
 const response=new Promise<any>(resolve=>{finish=resolve;});
 const provider:EnrichmentProvider={executionMode:'host',async start(){starts++;return response;},async retrieve(id){retrieves++;return {id,status:'completed',output_text:JSON.stringify({summary:'Original source is sufficient.',figures:[]})};},async cancel(id){return {id,status:'cancelled'};}};
 const config=readMetaConfig({MODEL_API_KEY:'host-test-key'}),secret='host-test-secret';
 const handlers=createEnrichmentHandlers({getConfig:()=>config,store,usage,provider:()=>provider,signingSecret:secret});
 const cookie=(await handlers.session(request({}))).headers.get('set-cookie')!.split(';')[0];
 const body={source,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:'paper-outline',feedback:'',existingFigures:[],requestId:randomUUID()};
 const started=await handlers.start(request(body,cookie)),first=await started.json();assert.equal(first.status,'queued');assert.ok(first.job);assert.equal(starts,1);
 const {requestId:_,...context}=body;
 const pending=await(await handlers.status(request({...context,job:first.job},cookie))).json();assert.equal(pending.status,'queued');assert.equal(retrieves,0);
 const duplicate=await(await handlers.start(request({...body,verifyOnly:true},cookie))).json();assert.equal(duplicate.status,'queued');assert.equal(starts,1);
 finish({id:'resp_real_sync_response',status:'completed',output_text:JSON.stringify({summary:'Original source is sufficient.',figures:[]}),usage:null});
 await new Promise(resolve=>setTimeout(resolve,0));
 const done=await(await handlers.status(request({...context,job:first.job},cookie))).json();assert.equal(done.status,'complete');assert.deepEqual(done.paperPlan.figures,[]);assert.equal(starts,1);assert.equal(retrieves,0);
 // A new handler instance has no in-memory task but can recover the actual provider ID.
 const restarted=createEnrichmentHandlers({getConfig:()=>config,store,usage,provider:()=>provider,signingSecret:secret});
 const recovered=await(await restarted.status(request({...context,job:first.job},cookie))).json();assert.equal(recovered.status,'complete');assert.equal(starts,1);assert.equal(retrieves,1);
});

test('host-owned pending work survives duplicate checks but an interrupted server never replaces the original request',async t=>{
 const store=createEnrichmentStore({path:':memory:',enforceLimits:false}),usage=createSqliteUsageStore({path:':memory:',enforceLimits:false});t.after(()=>{store.close();usage.close?.();});
 let starts=0,finish!:(value:any)=>void;const work=new Promise<any>(resolve=>{finish=resolve;});
 const provider:EnrichmentProvider={executionMode:'host',async start(){starts++;return work;},async retrieve(){throw Error('No provider ID yet');},async cancel(){throw Error('No provider ID yet');}};
 const config=readMetaConfig({MODEL_API_KEY:'host-test-key'}),dependencies={getConfig:()=>config,store,usage,provider:()=>provider,signingSecret:'host-test-secret'},handlers=createEnrichmentHandlers(dependencies);
 const cookie=(await handlers.session(request({}))).headers.get('set-cookie')!.split(';')[0],body={source,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:'paper-outline',feedback:'',existingFigures:[],requestId:randomUUID()};
 const first=await(await handlers.start(request(body,cookie))).json(),{requestId:_,...context}=body;
 const restarted=createEnrichmentHandlers(dependencies),lost=await restarted.status(request({...context,job:first.job},cookie));assert.equal(lost.status,409);assert.equal((await lost.json()).uncertain,true);assert.equal(starts,1);
 const cancelled=await handlers.status(request({...context,job:first.job},cookie),true);assert.equal(cancelled.status,409);assert.equal(starts,1);
 finish({id:'resp_finished_after_check',status:'completed',output_text:JSON.stringify({summary:'Original source is sufficient.',figures:[]}),usage:null});await new Promise(resolve=>setTimeout(resolve,0));
});

test('Meta enrichment uses synchronous provider execution instead of the failing upstream background mode',async()=>{
 const retrieval=await retrieveCapabilities(await enrichmentRetrievalQuery({source,sectionId:WHOLE_PAPER_SECTION_ID,action:'plan',scope:'paper-outline',feedback:''}));
 const body=enrichmentProviderRequest({action:'plan',scope:'paper-outline',context:wholePaperContext(source).text,feedback:'',retrieval,existingFigures:[]});assert.equal(body.background,false);
});

test('long papers receive length-aware guidance and enough output capacity without a figure quota',async()=>{
 const {paperIllustrationScale,paperPlanSchema}=await import('../lib/enrichment/whole-paper');
 const source={...document(),pageCount:153};
 const scale=paperIllustrationScale(source);
 assert.deepEqual(scale.advisoryFigures,{from:20,to:39});
 const input:EnrichmentInput={action:'plan',context:wholePaperContext(source).text,feedback:'',scope:'paper-outline'};
 const body=enrichmentProviderRequest(input);
 assert.ok(body.max_output_tokens>6000);
 assert.equal(enrichmentPromptMetrics(input).maxOutputTokens,body.max_output_tokens);
 assert.match(body.instructions,/not a target, quota/);
 assert.doesNotMatch(body.instructions,/three to six/);
 assert.equal(paperPlanSchema.parse({summary:'No useful additions.',figures:[]}).figures.length,0);
 const html={...source,pageCount:1,source:{kind:'arxiv' as const,url:'https://arxiv.org/html/2611.00558v1'}};
 assert.equal(paperIllustrationScale(html).basis,'estimated-text-pages');
});
