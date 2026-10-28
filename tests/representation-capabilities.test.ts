import test from 'node:test';
import assert from 'node:assert/strict';
import { representationRegistry, representationAdapters, getRepresentationCapabilities } from '../lib/representations/adapters';
import { createCapabilityRegistry, type RepresentationAdapter } from '../lib/representations/registry';
import { createSourceGuide } from '../lib/representations/source-guide';
import { preparedPapers } from '../data/papers';
import { representationFromWidget } from '../shared/representations';
import { createWidgetForSource } from '../lib/widgets/presets';
import { buildRepresentation, executeRepresentation } from '../lib/representations/lifecycle';
import { WIDGET_CATALOG_VERSION, widgetCatalog } from '../lib/widgets/catalog';
import { GET } from '../app/api/representation-capabilities/route';
const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
const local={facilities:['trusted-computation','asset-integrity'] as const,offline:true};
const need={behaviors:['source-annotation'],assetKinds:[],interactions:['select-step'] as const,inputBytes:100,requestedEvidence:'illustration' as const};
test('capabilities select actual modalities by behavior and data without a discipline classifier',()=>{
 const guide=representationRegistry.select({...need,interactions:[...need.interactions]},local);assert.deepEqual(guide.candidates.map(c=>c.id),['source-guide']);
 const data=representationRegistry.select({behaviors:['inspect-data'],assetKinds:['graph'],interactions:['inspect-data'],inputBytes:100,requestedEvidence:'illustration'},local);assert.deepEqual(data.candidates.map(c=>c.id),['asset-inspector']);
 const unavailable=representationRegistry.select({behaviors:['ode-integration'],assetKinds:[],interactions:[],inputBytes:0,requestedEvidence:'illustration'},local);assert.equal(unavailable.candidates.length,0);assert.ok(unavailable.gaps.some(gap=>gap.kind==='capability'));
 assert.throws(()=>representationRegistry.select({...need,interactions:[],discipline:'biology'} as never,local));
});
test('missing worker, offline network and input limits are explicit gaps without unrelated engine fallback',()=>{
 const graph=representationFromWidget(createWidgetForSource('graph',source),source),built=buildRepresentation(graph,source,{environment:{facilities:[],offline:true}});assert.equal(built.status,'unsupported');
 const guide=createSourceGuide(source,block.id);assert.equal(buildRepresentation(guide,source,{environment:{facilities:[],offline:true}}).status,'ready');
 const oversized=representationRegistry.select({behaviors:['catalog-widgets'],assetKinds:[],interactions:['widget-controls'],inputBytes:200000,requestedEvidence:'illustration'},local);assert.equal(oversized.candidates.length,0);assert.ok(oversized.gaps.some(gap=>gap.kind==='resource'));
 const descriptor={...representationAdapters[1].descriptor,id:'network-guide',facilities:['network'] as const,permissions:{network:true,generatedCode:false as const}};
 const remote=createCapabilityRegistry([{descriptor:{...descriptor,facilities:[...descriptor.facilities]},execute:representationAdapters[1].execute}]);
 const result=remote.select({...need,interactions:[...need.interactions]},{facilities:['network'],offline:true});assert.equal(result.candidates.length,0);assert.equal(result.gaps[0].kind,'environment');
});
test('exact adapter versions are pinned and registered execution works through the same lifecycle',async()=>{
 let calls=0;const original=representationAdapters[1];const custom:RepresentationAdapter={descriptor:{...original.descriptor,id:'fixture-guide',version:'1.1.0'},execute:async(view,context)=>{calls++;return original.execute(view,context);}};
 const registry=createCapabilityRegistry([...representationAdapters,custom]);const guide=createSourceGuide(source,block.id);guide.views[0].adapter={id:'fixture-guide',version:'1.1.0'};guide.execution.capabilities=[{id:'fixture-guide',version:'1.1.0'}];
 const built=buildRepresentation(guide,source,{registry,environment:local});assert.equal(built.status,'ready');if(built.status!=='ready')return;
 const result=await executeRepresentation(built.value,source,{registry,environment:local});assert.equal(result.status,'ready');assert.equal(calls,1);
 const unknown=structuredClone(guide);unknown.views[0].adapter!.version='1.2.0';unknown.execution.capabilities[0].version='1.2.0';const failed=buildRepresentation(unknown,source,{registry,environment:local});assert.equal(failed.status,'unsupported');assert.equal(calls,1);assert.equal(failed.original,unknown);
});
test('model manifests cannot install executable capabilities or self-promote scientific evidence',()=>{
 const original=representationAdapters[1];assert.throws(()=>createCapabilityRegistry([{descriptor:original.descriptor} as RepresentationAdapter]),/executable adapter/);
 assert.throws(()=>createCapabilityRegistry([original,original]),/Duplicate/);
 const listing=representationRegistry.list();listing[0].behaviors.push('invented');assert.ok(!representationRegistry.list()[0].behaviors.includes('invented'));
 const reproduction=representationRegistry.select({...need,interactions:[...need.interactions],requestedEvidence:'experiment-reproduction'},local);assert.equal(reproduction.candidates.length,1);assert.ok(reproduction.gaps.some(gap=>gap.kind==='evidence'));
 assert.equal(getRepresentationCapabilities().policy.generatedCode,false);
});
test('capability discovery uses the existing widget catalog and filters without model calls or private input',async()=>{
 const metadata=getRepresentationCapabilities();assert.deepEqual(metadata.widgetCatalog,widgetCatalog.filter(entry=>entry.format==='paperplay-widget'));
 assert.equal(metadata.adapters.find(cap=>cap.id==='widget-v2')!.version,WIDGET_CATALOG_VERSION);
 const all=await GET(new Request('http://localhost/api/representation-capabilities')).json();assert.equal(all.adapters.length,9);assert.ok(all.adapters.every((entry:object)=>!Object.hasOwn(entry,'execute')));
 const response=await GET(new Request('http://localhost/api/representation-capabilities?behavior=source-annotation&interaction=select-step')).json();assert.equal(response.candidates[0].id,'source-guide');
 assert.equal(GET(new Request('http://localhost/api/representation-capabilities?source=private')).status,400);
 assert.equal(GET(new Request('http://localhost/api/representation-capabilities?bytes=0x10')).status,400);
});

test('adapter failures, malformed output and insufficient actual input budgets remain typed and recoverable',async()=>{
 const guide=createSourceGuide(source,block.id),original=representationAdapters[1];
 const broken=createCapabilityRegistry([{...original,execute:async()=>({kind:'source-guide',id:guide.views[0].id,steps:[]} as never)}]);
 const built=buildRepresentation(guide,source,{registry:broken,environment:local});assert.equal(built.status,'ready');if(built.status!=='ready')return;
 assert.equal((await executeRepresentation(built.value,source,{registry:broken,environment:local})).status,'failed');
 const limited=buildRepresentation(guide,source,{environment:{...local,maxInputBytes:10}});assert.equal(limited.status,'unsupported');
});
