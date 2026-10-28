import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { WIDGET_KINDS } from '../shared/widgets';
import { validateDocument, type SourceDocument } from '../shared/schema';
import { representationFromWidget, validateRepresentationPlan } from '../shared/representations';
import { buildRepresentation, executeRepresentation, inspectRepresentationFile } from '../lib/representations/lifecycle';
import { createSourceGuide } from '../lib/representations/source-guide';
import { createWidgetForSource } from '../lib/widgets/presets';
import { widgetReferenceSources } from '../data/widget-sources';
import { encodeWidgetSnapshot, decodeWidgetSnapshot } from '../lib/widgets/compatibility';

const sourceFor=(kind:string)=>kind==='attention'?widgetReferenceSources[0]:kind==='probability'?widgetReferenceSources[1]:kind==='signal'?widgetReferenceSources[2]:['custom','linear','equation','function'].includes(kind)?preparedPapers[2].document:preparedPapers[0].document;
test('the representation adapter retains every v2 widget snapshot byte-for-byte, including selection and exact citation',async()=>{
  for(const kind of WIDGET_KINDS){
    const source=sourceFor(kind),widget=createWidgetForSource(kind,source);widget.view.selection='inspected';widget.view.step=0;
    const snapshot=encodeWidgetSnapshot(widget),before=JSON.stringify(widget);
    const plan=representationFromWidget(widget,source),opened=inspectRepresentationFile(JSON.stringify(plan),source);
    assert.equal(opened.status,'ready');if(opened.status!=='ready')continue;
    const view=opened.value.plan.views[0];assert.equal(view.kind,'widget');if(view.kind!=='widget')continue;
    assert.equal(encodeWidgetSnapshot(view.widget),snapshot);assert.equal(JSON.stringify(widget),before);
    assert.deepEqual(decodeWidgetSnapshot(snapshot,source),view.widget);
    const run=await executeRepresentation(opened.value,source);assert.equal(run.status,'ready');
    if(run.status==='ready')assert.equal(run.value.evidence.verified,false);
  }
});

function fixture(title:string,passage:string):SourceDocument {
  return validateDocument({schemaVersion:1,id:'structural-fixture',sourceVersion:'fixture-v1',title,authors:['Paperplay synthetic structural fixture'],source:{kind:'prepared'},pageCount:1,blocks:[{id:'passage',kind:'paragraph',page:1,text:passage}],anchors:[],extractionWarnings:['Synthetic contract fixture; not a real research paper or scientific validation.']});
}
test('biological processes, empirical results and theoretical arguments use the same executable source-guide adapter',async()=>{
  const cases=[['Biological process','A synthetic pathway activates a downstream state under a declared condition.'],['Empirical result','The illustrative observational summary reports a difference without establishing causation.'],['Theoretical argument','Under the stated assumptions, the illustrative argument derives its stated conclusion.']];
  for(const [title,passage] of cases){
    const source=fixture(title,passage),plan=createSourceGuide(source,'passage');
    const reopened=inspectRepresentationFile(JSON.stringify(plan),source);assert.equal(reopened.status,'ready');if(reopened.status!=='ready')continue;
    assert.deepEqual(reopened.value.plan,plan);assert.equal(plan.execution.kind,'none');
    let computes=0;const run=await executeRepresentation(reopened.value,source,{compute:async()=>{computes++;throw Error('Guide must not compute.');}});
    assert.equal(run.status,'ready');assert.equal(computes,0);
    if(run.status==='ready'){assert.equal(run.value.views[0].kind,'source-guide');assert.equal(run.value.evidence.verified,false);}
  }
});
test('physical recurrence and algorithm traces keep requested evidence distinct from source assertions',async()=>{
  for(const kind of ['custom','graph'] as const){const source=sourceFor(kind);const plan=representationFromWidget(createWidgetForSource(kind,source),source);
    plan.requestedEvidence='experiment-reproduction';const artifact=buildRepresentation(plan,source);assert.equal(artifact.status,'ready');if(artifact.status!=='ready')continue;
    const run=await executeRepresentation(artifact.value,source);assert.equal(run.status,'ready');if(run.status==='ready')assert.deepEqual(run.value.evidence,{requested:'experiment-reproduction',verified:false});
    assert.ok(plan.claims.every(claim=>claim.kind==='pedagogical-addition'));
  }
});
test('invalid source quotations and promoted pedagogical text cannot be accepted as source claims',()=>{
  const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!,plan=createSourceGuide(source,block.id);
  const bad=structuredClone(plan);bad.claims[0].text='This invented conclusion is absent from the paper.';
  assert.throws(()=>validateRepresentationPlan(bad,source),/source claim/);
  const changed=structuredClone(plan);changed.source.sourceVersion='other';assert.throws(()=>validateRepresentationPlan(changed,source),/exact source/);
  const quote=structuredClone(plan);quote.anchors[0].quote='Fabricated source text.';assert.throws(()=>validateRepresentationPlan(quote,source),/quote/);
  const missing=structuredClone(plan);missing.claims[0].anchorIds=['absent'];assert.throws(()=>validateRepresentationPlan(missing,source),/undeclared/);
});
test('unknown versions and unsupported capabilities retain the original record and an actionable gap',()=>{
  const source=preparedPapers[0].document,widget=createWidgetForSource('graph',source),plan=representationFromWidget(widget,source);
  for(const input of [{...plan,schemaVersion:99},{...plan,execution:{...plan.execution,capabilities:[...plan.execution.capabilities,{id:'unavailable-solver',version:'1.0.0'}]}}]){
    const before=JSON.stringify(input),opened=buildRepresentation(input,source);assert.equal(opened.status,'unsupported');
    assert.equal(opened.original,input);assert.ok(opened.nextAction.length>0);assert.equal(JSON.stringify(input),before);
  }
});
test('missing assets and undeclared dependencies stop before any computation',async()=>{
  const source=preparedPapers[0].document,plan=representationFromWidget(createWidgetForSource('graph',source),source);
  plan.assets=[{id:'observations',kind:'table',description:'Unavailable experimental observations.'}];plan.execution.assetIds=['observations'];
  const built=buildRepresentation(plan,source);assert.equal(built.status,'missing-data');assert.deepEqual(built.gaps,['observations']);
  let called=false;const run=await executeRepresentation({format:'paperplay-representation-artifact',schemaVersion:1,plan},source,{compute:async()=>{called=true;throw Error('Unexpected computation.');}});
  assert.equal(run.status,'missing-data');assert.equal(called,false);
  plan.execution.assetIds=['undeclared'];assert.equal(buildRepresentation(plan,source).status,'invalid');
});
test('malformed, oversized and duplicate records are non-destructively rejected',()=>{
  const source=preparedPapers[0].document,plan=representationFromWidget(createWidgetForSource('graph',source),source);
  assert.equal(inspectRepresentationFile('{',source).status,'invalid');assert.equal(inspectRepresentationFile(' '.repeat(256*1024+1),source).status,'invalid');
  const copy=structuredClone(plan);copy.views.push(copy.views[0]);assert.equal(buildRepresentation(copy,source).status,'invalid');
  const unknown=structuredClone(plan) as unknown as Record<string,unknown>;unknown.script='do not execute';assert.equal(buildRepresentation(unknown,source).status,'invalid');
});
test('cancellation and computation failure return typed outcomes without partial success or inferred evidence',async()=>{
  const source=preparedPapers[0].document,plan=representationFromWidget(createWidgetForSource('graph',source),source),built=buildRepresentation(plan,source);assert.equal(built.status,'ready');if(built.status!=='ready')return;
  const controller=new AbortController();controller.abort();let called=false;
  const cancelled=await executeRepresentation(built.value,source,{signal:controller.signal,compute:async()=>{called=true;throw Error('Unexpected call.');}});assert.equal(cancelled.status,'cancelled');assert.equal(called,false);
  const failed=await executeRepresentation(built.value,source,{compute:async()=>{throw Error('Independent adapter failure.');}});assert.equal(failed.status,'failed');
  assert.match(failed.reason,/adapter failure/);assert.equal(failed.original,built.value.plan);
});
