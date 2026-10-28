import test from 'node:test';
import assert from 'node:assert/strict';
import { preparedPapers } from '../data/papers';
import { createWidgetForSource } from '../lib/widgets/presets';
import { representationFromWidget, validateRepresentationPlan } from '../shared/representations';
import { scientificBinding, runScientificCheck, assessScientificEvidence } from '../lib/representations/evidence';
const source=preparedPapers[0].document;
const plan=()=>representationFromWidget(createWidgetForSource('graph',source),source);
const checker={id:'reference-fixture',subject:{kind:'view' as const,id:'figure'},level:'mechanism-reproduction' as const,reference:'Independently authored policy fixture, not scientific validation',scope:'Checks the fixture result only',run:async()=>({passed:true,details:'Fixture matches.'})};

test('portable model declarations cannot promote verification, including copied application receipts',async()=>{
  const p=plan(),binding=await scientificBinding(p);
  p.evidence=[{id:'claim-check',subject:{kind:'view',id:'figure'},origin:'independent-reference',anchorIds:['passage'],assumptions:[],references:[],dependsOn:[]}];
  const declared=await assessScientificEvidence(p);assert.match(declared.at(-1)!.label,/not independently verified/);
  const receipt=await runScientificCheck(p,checker);const owned=await assessScientificEvidence(p,[receipt]);assert.match(owned.at(-1)!.label,/Mechanism checked/);
  const forged=JSON.parse(JSON.stringify(receipt));assert.match((await assessScientificEvidence(p,[forged])).at(-1)!.label,/not independently verified/);
  assert.notEqual(binding,receipt.binding);
});
test('parameter, seed, artifact, engine and dataset changes invalidate old checks; view navigation does not',async()=>{
  const p=plan(),bindings={assetHashes:{measurements:'a'.repeat(64)},engineVersions:{solver:'1.0.0'},artifactHash:'b'.repeat(64)},receipt=await runScientificCheck(p,checker,bindings);
  const view=structuredClone(p);if(view.views[0].kind==='widget'){view.views[0].widget.view.step=1;view.views[0].widget.view.selection='node:b';}
  assert.equal(await scientificBinding(view,bindings),receipt.binding);
  const seed=structuredClone(p);if(seed.views[0].kind==='widget')seed.views[0].widget.seed++;
  const changed=await scientificBinding(seed,bindings);assert.notEqual(changed,receipt.binding);const evidence=(await assessScientificEvidence(seed,[receipt],bindings)).at(-1)!;assert.equal(evidence.staleChecks,1);assert.match(evidence.label,/not independently/);
  for(const modified of [{...bindings,assetHashes:{measurements:'c'.repeat(64)}},{...bindings,engineVersions:{solver:'2.0.0'}},{...bindings,artifactHash:'d'.repeat(64)}])assert.notEqual(await scientificBinding(p,modified),receipt.binding);
  const spec=structuredClone(p);if(spec.views[0].kind==='widget'&&spec.views[0].widget.spec.kind==='graph')spec.views[0].widget.spec.edges[0].weight++;
  assert.notEqual(await scientificBinding(spec,bindings),receipt.binding);
});
test('failed independent checks never promote evidence; subject scope and reference are required',async()=>{
  const p=plan();const failed=await runScientificCheck(p,{...checker,run:async()=>{throw Error('Reference mismatch.');}});
  assert.equal(failed.passed,false);assert.match((await assessScientificEvidence(p,[failed])).at(-1)!.label,/not independently/);
  await assert.rejects(()=>runScientificCheck(p,{...checker,reference:''}),/reference/);
  await assert.rejects(()=>runScientificCheck(p,{...checker,subject:{kind:'claim',id:'missing'}}),/unavailable/);
});
test('mixed declared data origins remain distinct and dependency cycles/forged statuses are rejected',async()=>{
  const p=plan();p.assets=[{id:'observed',kind:'table',description:'Reported observations'},{id:'synthetic',kind:'table',description:'Illustrative values'}];
  p.evidence=[{id:'raw',subject:{kind:'asset',id:'observed'},origin:'observed-data',anchorIds:['passage'],assumptions:[],references:[],dependsOn:[]},{id:'teaching',subject:{kind:'asset',id:'synthetic'},origin:'authored-assumption',anchorIds:[],assumptions:['Illustrative values.'],references:[],dependsOn:[]}];
  assert.deepEqual(validateRepresentationPlan(p,source).evidence,p.evidence);
  const assessed=await assessScientificEvidence(p);assert.deepEqual(assessed.filter(item=>item.subject.kind==='asset').map(item=>item.origins[0]),['observed-data','authored-assumption']);
  const circular=structuredClone(p);circular.evidence![0].dependsOn=['teaching'];circular.evidence![1].dependsOn=['raw'];assert.throws(()=>validateRepresentationPlan(circular,source),/cycle/);
  const forged=structuredClone(p) as unknown as {evidence:Record<string,unknown>[]};forged.evidence[0].verified=true;assert.throws(()=>validateRepresentationPlan(forged,source));
});

test('exported check history survives import without regaining trust or changing scientific identity',async()=>{
  const p=plan();const receipt=await runScientificCheck(p,checker);
  p.reportedChecks=[JSON.parse(JSON.stringify(receipt))];
  const reopened=validateRepresentationPlan(JSON.parse(JSON.stringify(p)),source);
  assert.deepEqual(reopened.reportedChecks,p.reportedChecks);
  assert.equal(await scientificBinding(reopened),receipt.binding);
  assert.match((await assessScientificEvidence(reopened,reopened.reportedChecks)).at(-1)!.label,/not independently verified/);
  const changed=structuredClone(reopened);if(changed.views[0].kind==='widget')changed.views[0].widget.seed++;
  assert.deepEqual(changed.reportedChecks,p.reportedChecks);assert.notEqual(await scientificBinding(changed),receipt.binding);
});
