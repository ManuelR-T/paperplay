import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReasoningGuide } from '../shared/reasoning-guides';
import { createReasoningExample } from '../lib/representations/reasoning-examples';
import { buildRepresentation,executeRepresentation } from '../lib/representations/lifecycle';
import { validateRepresentationPlan } from '../shared/representations';
import { representationInputRevision,isRepresentationSelection,selectionAnchorIds } from '../shared/representation-selection';
import { serializeDataStudy,parseDataStudy } from '../lib/representations/data-study';
import { renderReasoningEquation } from '../lib/representations/equation-display';
import { representationRegistry } from '../lib/representations/adapters';
function fixture(){const study=createReasoningExample('bell'),view=study.plan.views[0];if(view.kind!=='reasoning-guide')throw Error();return {...study,guide:structuredClone(view.guide)};}
test('development theory and partial experiment use the same local non-executing adapter',async()=>{
 for(const kind of ['bell','voltage-clamp'] as const){const study=createReasoningExample(kind),built=buildRepresentation(study.plan,study.source,{environment:{facilities:[],offline:true}});assert.equal(built.status,'ready');if(built.status!=='ready')throw Error();const run=await executeRepresentation(built.value,study.source,{environment:{facilities:[],offline:true}});assert.equal(run.status,'ready');if(run.status==='ready'){assert.equal(run.value.views[0].kind,'reasoning-guide');assert.equal(run.value.evidence.verified,false);}assert.equal(study.plan.execution.kind,'none');}
});
test('authored assumptions, source quotations, references and missing details cannot silently change roles',()=>{
 const {guide,plan,source}=fixture();validateReasoningGuide(guide,plan.anchors);
 const invented=structuredClone(guide);invented.steps[0].origin='source-quotation';assert.throws(()=>validateReasoningGuide(invented,plan.anchors),/quote/);
 const noAssumption=structuredClone(guide);noAssumption.steps.find(s=>s.origin==='authored-explanation')!.assumptions=[];assert.throws(()=>validateReasoningGuide(noAssumption),/assumptions/);
 const noGap=structuredClone(guide);noGap.steps.at(-1)!.missingDetails=[];assert.throws(()=>validateReasoningGuide(noGap),/missing details/);
 const fake=structuredClone(plan);Object.assign(fake.views[0],{formallyVerified:true});assert.throws(()=>validateRepresentationPlan(fake,source),/Unrecognized/);
 const noSource=structuredClone(guide);noSource.steps[0].anchorIds=['invented'];assert.throws(()=>validateReasoningGuide(noSource,plan.anchors),/undeclared/);
 const hh=createReasoningExample('voltage-clamp');const hhView=hh.plan.views[0];if(hhView.kind!=='reasoning-guide')throw Error();assert.ok(hhView.guide.steps.some(s=>s.kind==='gap'&&s.missingDetails.length>=4));
});
test('argument dependencies reject cycles, dangling steps and duplicate identities',()=>{
 const {guide}=fixture();guide.steps[0].dependsOn=[guide.steps[1].id];assert.throws(()=>validateReasoningGuide(guide),/cycle/);
 const missing=fixture().guide;missing.steps[0].dependsOn=['absent'];assert.throws(()=>validateReasoningGuide(missing),/Missing/);
 const duplicate=fixture().guide;duplicate.steps[1].id=duplicate.steps[0].id;assert.throws(()=>validateReasoningGuide(duplicate),/Duplicate/);
});
test('equation display retains unsupported/uncertain input and never evaluates or trusts markup',()=>{
 const {guide}=fixture();for(const step of guide.steps)if(step.equation)assert.equal(renderReasoningEquation(step.equation.latex,step.equation.notation).status,'rendered');
 for(const notation of ['unsupported','uncertain'] as const)assert.equal(renderReasoningEquation('\\unsupported{x}',notation).status,'raw');
 assert.equal(renderReasoningEquation('\\doesnotexist{x}','transcribed').status,'raw');
 const dangerous=renderReasoningEquation('\\href{javascript:alert(1)}{click}','transcribed');assert.ok(dangerous.status==='raw'||!dangerous.html.includes('href="javascript:'));
 const uncertain=fixture().guide;uncertain.steps[1].equation!.notation='uncertain';assert.throws(()=>validateReasoningGuide(uncertain),/missing details/);
});
test('step selection is source-linked, portable, bounded and rejects stale identities',async()=>{
 const {plan,source,guide}=fixture(),index=4;const selection={kind:'time' as const,viewId:'reasoning',scopeId:'reasoning',frameId:guide.steps[index].id,value:index,unit:'guide-step',mode:'authored-step' as const};assert.ok(isRepresentationSelection(plan,selection));assert.equal(isRepresentationSelection(plan,{...selection,value:0}),false);assert.deepEqual(selectionAnchorIds(plan,[selection]),['excerpt']);
 const saved={...plan,navigation:{format:'paperplay-semantic-navigation' as const,schemaVersion:1 as const,revision:representationInputRevision(plan),selections:[selection]}};const restored=await parseDataStudy(serializeDataStudy(source,saved));assert.deepEqual(restored.plan.navigation,saved.navigation);
 const changed=structuredClone(saved);if(changed.views[0].kind!=='reasoning-guide')throw Error();changed.views[0].guide.steps[index].text+=' Added new assumption.';assert.throws(()=>validateRepresentationPlan(changed,source),/Saved selections/);
});
test('Bell illustrative angle substitution fails its declared bound without claiming detector evidence',()=>{
 const correlation=(degrees:number)=>-Math.cos(degrees*Math.PI/180),pab=correlation(60),pac=correlation(120),pbc=correlation(60);assert.ok(Math.abs(pab+.5)<1e-14);assert.ok(Math.abs(pac-.5)<1e-14);assert.ok(1+pbc<Math.abs(pab-pac));
 const result=representationRegistry.select({behaviors:['argument-map'],assetKinds:[],interactions:['select-step','return-source'],inputBytes:1000,requestedEvidence:'mechanism-reproduction'},{facilities:[],offline:true});assert.deepEqual(result.candidates.map(c=>c.id),['reasoning-guide']);assert.ok(result.gaps.some(g=>g.kind==='evidence'));
});
