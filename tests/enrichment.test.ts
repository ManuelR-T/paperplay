import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparedPapers } from '../data/papers';
import { widgetReferenceSources } from '../data/widget-sources';
import { createWidgetForSource, createWidgetPreset } from '../lib/widgets/presets';
import { getWidgetDescriptor, WIDGET_CATALOG_VERSION } from '../lib/widgets/catalog';
import { buildSourceSections, sectionContext, sourceBlockText } from '../lib/enrichment/sections';
import { compileEnrichmentPlan, configurationDiff } from '../lib/enrichment/contracts';
import { acceptEnrichmentWidget, emptyEnrichmentState, enrichmentFingerprint, parseEnrichmentState, serializeEnrichmentState, undoEnrichmentWidget } from '../lib/enrichment/state';
import { createEnrichmentStore } from '../server/enrichment/store';
import { createEnrichmentHandlers } from '../server/enrichment/handlers';
import { createSqliteUsageStore } from '../server/usage/store';
import { readMetaConfig } from '../server/meta/config';
import { AnalysisHttpError } from '../server/analysis/security';
import { providerInput, type EnrichmentProvider } from '../server/enrichment/provider';
import { validateDocument, type SourceDocument } from '../shared/schema';
import type { WidgetEnvelope, WidgetKind } from '../shared/widgets';

const source = preparedPapers[0].document;
const contentBlock = (s: SourceDocument) => s.blocks.find(b => b.kind !== 'heading')!;
function plan(s: SourceDocument, kind: WidgetKind = 'diagram', target?: WidgetEnvelope) {
  const block = target ? s.blocks.find(b => b.id === target.source.blockId)! : contentBlock(s);
  return { summary: 'A bounded source-linked teaching view.', warnings: [], repetitionReason: '', proposals: [{ id: 'concept', title: 'Inspect this concept', concept: 'A cited mechanism', blockId: block.id, page: block.page, quote: target?.source.quote ?? sourceBlockText(block).slice(0, 80), reason: 'This visual exposes the declared relationship.', objective: 'Inspect one supplied teaching state.', neededData: ['Explicit synthetic teaching data'], provenance: 'synthetic', interactions: [getWidgetDescriptor(kind).controls[0]], specJson: JSON.stringify(target?.spec ?? createWidgetPreset(kind)), limitations: ['Synthetic values, not paper measurements.'] }] };
}
function compile(value: unknown, s = source, target?: WidgetEnvelope, action: 'plan' | 'repair' | 'edit' = 'plan') {
  const blockId = target?.source.blockId ?? contentBlock(s).id;
  const section = buildSourceSections(s).find(v => v.segments.some(x => x.blockId === blockId))!;
  return compileEnrichmentPlan(value, { source: s, section, action, target, model: 'fixture-model', catalogVersion: WIDGET_CATALOG_VERSION, allowedInteractions: kind => getWidgetDescriptor(kind).controls });
}
test('long-source sections preserve every fragment and expose bounded partial coverage', () => {
  const long = validateDocument({ schemaVersion: 1, id: 'long-paper', sourceVersion: 'frozen-sections-v1', title: 'Long source fixture', authors: ['Fixture authors'], source: { kind: 'prepared' }, pageCount: 50,
    blocks: Array.from({ length: 120 }, (_,i) => i % 40 === 0 ? { id: `b${i}`, kind: 'heading' as const, page: Math.min(50,i+1), level: 2, text: 'Repeated heading' } : { id: `b${i}`, kind: 'paragraph' as const, page: Math.min(50,i+1), text: `Fragment ${i}: ` + 'An explicit source sentence. '.repeat(i === 1 ? 600 : 40) + (i === 119 ? ' FINAL_UNANALYZED_SENTINEL' : '') }), anchors: [], extractionWarnings: [] });
  const before = JSON.stringify(long); const sections = buildSourceSections(long);
  assert.ok(sections.length > 8); assert.ok(sections.some(s => s.partial));
  assert.equal(sections.flatMap(s => s.segments.map(v => v.text)).join(''), long.blocks.map(sourceBlockText).join(''));
  assert.equal(new Set(sections.map(s => s.id)).size, sections.length);
  for (const s of sections) assert.ok(s.characters <= 12_000);
  const context = sectionContext(long, sections[0].id);
  assert.ok(context.text.length <= 20_000); assert.ok(!context.text.includes('FINAL_UNANALYZED_SENTINEL'));
  assert.equal(JSON.stringify(long), before);
  assert.throws(() => sectionContext(long, 'missing-section'));
});

test('the frozen six-family guard corpus yields diverse validated views without pretending to be a Meta/user study', () => {
  const corpus: Array<[SourceDocument, WidgetKind]> = [[preparedPapers[0].document,'graph'],[preparedPapers[1].document,'diagram'],[preparedPapers[2].document,'function'],[widgetReferenceSources[0],'attention'],[widgetReferenceSources[1],'probability'],[widgetReferenceSources[2],'signal']];
  const kinds = new Set<string>();
  for (const [s,kind] of corpus) { const result = compile(plan(s,kind),s); assert.equal(result.proposals.length,1); assert.equal(result.rejected.length,0); assert.equal(result.proposals[0].envelope.source.documentId,s.id); kinds.add(result.proposals[0].envelope.spec.kind); }
  assert.equal(kinds.size,6);
});

test('wrong citations, unavailable controls and fabricated table provenance reject only their proposals', () => {
  const value = plan(source); const valid = value.proposals[0];
  value.proposals.push({ ...valid, id: 'badQuote', quote: 'A quote which never appears in this source.' });
  value.proposals.push({ ...valid, id: 'badControl', interactions: ['Train the original model'] });
  value.proposals.push({ ...valid, id: 'fakeMeasurements', specJson: JSON.stringify({ ...createWidgetPreset('table'), provenance: 'computed' }) });
  const result = compile(value); assert.equal(result.proposals.length,1); assert.equal(result.rejected.length,3);
  assert.ok(result.rejected.some(r => r.reason.includes('exact quote')));
  assert.ok(result.rejected.some(r => r.reason.includes('interaction')));
  assert.ok(result.rejected.some(r => r.reason.includes('Generated tables')));
});

test('targeted edits protect source/type/title and expose reviewable differences with local undo', () => {
  const target = createWidgetForSource('equation',source,contentBlock(source).id); const original = JSON.stringify(target);
  const value = plan(source,'equation',target); const changed = structuredClone(target.spec);
  assert.equal(changed.kind,'equation'); if (changed.kind === 'equation') changed.variables[0].value = 3;
  value.proposals[0].specJson = JSON.stringify(changed); value.proposals[0].title = 'A model may not change protected metadata';
  const result = compile(value,source,target,'edit'); const envelope = result.proposals[0].envelope;
  assert.equal(envelope.id,target.id); assert.equal(envelope.title,target.title); assert.deepEqual(envelope.source,target.source);
  assert.equal(envelope.authorship.kind,'meta'); assert.match(envelope.authorship.label,/revision/);
  assert.equal(target.authorship.kind,'prepared');
  assert.ok(result.proposals[0].diff?.some(c => c.path === 'variables'));
  let state = emptyEnrichmentState('a'.repeat(64)); state = acceptEnrichmentWidget(state,target); state = acceptEnrichmentWidget(state,envelope);
  const undone = undoEnrichmentWidget(state,target.id); assert.deepEqual(undone.envelope,target);
  assert.equal(JSON.stringify(target),original);
  const wrongType = plan(source,'equation',target); wrongType.proposals[0].specJson = JSON.stringify(createWidgetPreset('diagram'));
  assert.equal(compile(wrongType,source,target,'edit').proposals.length,0);
  const injection = plan(source,'equation',target); injection.proposals[0].specJson = JSON.stringify({ ...changed, engineImplementation: 'eval(source)' });
  assert.equal(compile(injection,source,target,'edit').proposals.length,0);
  assert.equal(compile(plan(source,'equation',target),source,target,'repair').proposals.length,0);
  assert.throws(() => configurationDiff(Object.fromEntries(Array.from({length:101},(_,i)=>[i,0])),Object.fromEntries(Array.from({length:101},(_,i)=>[i,1]))));
});

test('explicit prose promises cannot invent graph, cell, slider or training controls',()=>{
  for(const objective of ['Drag the nodes to find a new layout.','You can toggle blocked cells.','Use the parameter slider to change a parameter.','Train the original transformer.']){
    const p=plan(source);p.proposals[0].objective=objective;assert.equal(compile(p).proposals.length,0,objective);
  }
});
test('computed kinds need catalog-declared concept support while illustrative fallback stays available',()=>{
  const s=validateDocument({schemaVersion:1,id:'unrelated-source',sourceVersion:'v1',title:'An authored terminology fixture',authors:['Test author'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'text',kind:'paragraph',page:1,text:'This source passage discusses terminology and the assumptions a reader should check before accepting an explanation. It contains no supported computational mechanism and provides no measurements.'}],anchors:[],extractionWarnings:[]});
  const unrelated=compile(plan(s,'attention'),s);assert.equal(unrelated.proposals.length,0);assert.match(unrelated.rejected[0].reason,/concept support/);
  assert.equal(compile(plan(s,'diagram'),s).proposals.length,1);
});
test('a structurally valid configuration with an invalid initial computation is not activated',()=>{
  const s=widgetReferenceSources[0];const p=plan(s,'attention');const spec=createWidgetPreset('attention');assert.equal(spec.kind,'attention');if(spec.kind==='attention')spec.mask=spec.queries.map(()=>spec.keys.map(()=>false));
  p.proposals[0].specJson=JSON.stringify(spec);assert.equal(compile(p,s).proposals.length,0);
});

test('cached plans keep source/catalog identity, signed pending references stay outside portable widget data', () => {
  const fingerprint = 'b'.repeat(64); let state = emptyEnrichmentState(fingerprint); state.plans = [compile(plan(source))];
  const text = serializeEnrichmentState(state); assert.equal(parseEnrichmentState(text,source,fingerprint).plans.length,1);
  assert.throws(() => parseEnrichmentState(text,source,'c'.repeat(64)));
  assert.throws(() => parseEnrichmentState(text.replace('"catalogVersion":"2.0.0"','"catalogVersion":"99.0.0"'),source,fingerprint));
  const altered = structuredClone(source); altered.sourceVersion = 'changed'; assert.throws(() => parseEnrichmentState(text,altered,fingerprint));
  assert.equal('job' in state.plans[0].proposals[0].envelope,false);
});

test('per-paper ceilings are durable across connections and unresolved reservations remain conservative', t => {
  const directory = mkdtempSync(join(tmpdir(),'paperplay-enrichment-')); t.after(() => rmSync(directory,{recursive:true,force:true}));
  const a = createEnrichmentStore({ path: join(directory,'ledger.sqlite'), limits: { maxRequests: 2,maxTokens: 1000 } });
  const b = createEnrichmentStore({ path: join(directory,'ledger.sqlite'), limits: { maxRequests: 2,maxTokens: 1000 } }); t.after(()=>{a.close();b.close();});
  const input = { owner: 'a'.repeat(48), documentHash: 'b'.repeat(64), contextHash: 'c'.repeat(64), action: 'plan' as const, sectionId: 'section', reservedTokens: 400 };
  a.reserve({ ...input,id:'1'.repeat(64) }); a.settle('1'.repeat(64),{status:'accepted',providerId:'resp_fixture',actualTokens:0});
  assert.equal(b.budget(input.owner,input.documentHash).accountedTokens,400);
  b.reserve({ ...input,id:'2'.repeat(64) }); assert.throws(()=>a.reserve({...input,id:'3'.repeat(64)}),/allowance/);
  a.settle('1'.repeat(64),{status:'completed',actualTokens:50}); a.settle('1'.repeat(64),{status:'accepted',actualTokens:0}); assert.equal(b.budget(input.owner,input.documentHash).accountedTokens,450);
  assert.equal(b.reserve({...input,id:'1'.repeat(64)}).created,false);
  assert.throws(()=>b.reserve({...input,id:'1'.repeat(64),contextHash:'d'.repeat(64)}),/different context/);
});

const origin = 'http://localhost:3000';
function request(body: unknown,cookie?: string,path='start') { return new Request(`${origin}/api/enrichment/${path}`,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}); }
async function fixture(t: { after(fn:()=>void):void }) {
  let creates=0,retrieves=0,cancels=0,enabled=true; const clock=10_000;
  const usage=createSqliteUsageStore({path:':memory:',now:()=>clock}); const store=createEnrichmentStore({path:':memory:',now:()=>clock});t.after(()=>{usage.close?.();store.close();});
  const provider:EnrichmentProvider={async start(){creates++;return{id:`resp_fixture_${creates}`,status:'queued'}},async retrieve(id){retrieves++;return{id,status:'completed',output_text:JSON.stringify(plan(source)),usage:{input_tokens:40,output_tokens:60,total_tokens:100}}},async cancel(id){cancels++;return{id,status:'cancelled'}}};
  const dependencies={getConfig:()=>readMetaConfig({MODEL_API_KEY:'not-real-fixture',META_ANALYSIS_ENABLED:enabled?'true':'false'}),usage,store,provider:()=>provider,signingSecret:'enrichment-fixture-signing',now:()=>clock};
  const handlers=createEnrichmentHandlers(dependencies);const bootstrap=await handlers.session(request({},undefined,'session'));assert.equal(bootstrap.status,200);const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0];
  const body={source,sectionId:buildSourceSections(source).find(s=>s.segments.some(x=>x.blockId===contentBlock(source).id))!.id,action:'plan',feedback:'',requestId:'enrichment-request-00001'};
  return{handlers,dependencies,cookie,body,store,usage,provider,counts:()=>({creates,retrieves,cancels}),disable:()=>{enabled=false}};
}
test('accepted jobs resume across handler instances, deduplicate and remain retrievable when creation is disabled',async t=>{
  const f=await fixture(t);assert.equal((await f.handlers.start(request(f.body))).status,403);assert.equal(f.counts().creates,0);
  const started=await f.handlers.start(request(f.body,f.cookie));assert.equal(started.status,200);const {job}=await started.json();
  const recreated=createEnrichmentHandlers(f.dependencies);const duplicate=await recreated.start(request(f.body,f.cookie));assert.equal(duplicate.status,200);assert.equal(f.counts().creates,1);
  f.disable();const {requestId:_,...context}=f.body;const fetched=await recreated.status(request({...context,job},f.cookie,'status'));assert.equal(fetched.status,200);const completed=await fetched.json();assert.equal(completed.status,'complete');assert.equal(completed.result.proposals.length,1);assert.equal(completed.result.usage.totalTokens,100);assert.equal(completed.budget.accountedTokens,100);
  assert.equal((await recreated.start(request({...f.body,requestId:'enrichment-request-00002'},f.cookie))).status,503);assert.equal(f.counts().creates,1);
});
test('ownership/context guards and cancellation use only the accepted provider reference',async t=>{
  const f=await fixture(t);const response=await f.handlers.start(request(f.body,f.cookie));const {job}=await response.json();const {requestId:_,...context}=f.body;
  const other=await f.handlers.session(request({},undefined,'session'));const otherCookie=other.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await f.handlers.status(request({...context,job},otherCookie,'status'))).status,403);
  assert.equal((await f.handlers.status(request({...context,source:{...source,title:'Changed'},job},f.cookie,'status'))).status,403);
  assert.equal((await f.handlers.status(request({...context,feedback:'changed',job},f.cookie,'status'))).status,403);
  assert.equal(f.counts().retrieves,0);
  const cancelled=await f.handlers.status(request({...context,job},f.cookie,'cancel'),true);assert.equal((await cancelled.json()).status,'cancelled');assert.deepEqual(f.counts(),{creates:1,retrieves:0,cancels:1});
});
test('adding application figure anchors does not change source identity or lose accepted jobs',async t=>{
  const f=await fixture(t);const started=await f.handlers.start(request(f.body,f.cookie));const {job}=await started.json();
  const augmented=structuredClone(source);const block=contentBlock(source);augmented.anchors.push({id:'new-application-anchor',blockId:block.id,page:block.page,quote:sourceBlockText(block).slice(0,40)});
  assert.equal(await enrichmentFingerprint(source),await enrichmentFingerprint(augmented));
  const {requestId:_,...context}=f.body;const resumed=await f.handlers.status(request({...context,source:augmented,job},f.cookie,'status'));assert.equal(resumed.status,200);assert.equal((await resumed.json()).status,'complete');assert.equal(f.counts().creates,1);
});
test('document/global quota, ledger failure and executable edits stop before paid creation',async t=>{
  const f=await fixture(t);const broken=createEnrichmentHandlers({...f.dependencies,store:{...f.store,reserve(){throw new AnalysisHttpError(503,'Ledger unavailable')}}});
  assert.equal((await broken.start(request(f.body,f.cookie))).status,503);assert.equal(f.counts().creates,0);
  const target=createWidgetForSource('equation',source,contentBlock(source).id);
  assert.equal((await f.handlers.start(request({...f.body,action:'edit',target,feedback:'eval(process.env.MODEL_API_KEY)'},f.cookie))).status,400);assert.equal(f.counts().creates,0);
  const tinyUsage=createSqliteUsageStore({path:':memory:',limits:{globalHourlyRequests:20,sessionTenMinuteRequests:5,dailyRequests:100,dailyTokens:1}});t.after(()=>tinyUsage.close?.());
  const limited=createEnrichmentHandlers({...f.dependencies,usage:tinyUsage});assert.equal((await limited.start(request(f.body,f.cookie))).status,429);assert.equal(f.counts().creates,0);
});
test('provider input contains only selected section context, declared capabilities and a bounded target',()=>{
  const section=buildSourceSections(source)[0];const selected=sectionContext(source,section.id);const input=JSON.parse(providerInput({action:'plan',context:selected.text,feedback:''}));
  assert.equal(input.catalogVersion,WIDGET_CATALOG_VERSION);assert.equal(input.templates.length,9);assert.equal(input.selectedSource.section.id,section.id);assert.equal(input.selectedSource.coverage.includes('Only selected'),true);assert.equal('source' in input,false);
});
