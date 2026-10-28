import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticSelectionStore } from '../lib/interactions/selection-store';
import { captureWidgetNavigation, applyWidgetNavigation } from '../lib/interactions/widget-selection';
import { representationInputRevision, isRepresentationSelection, selectionAnchorIds, initialRepresentationNavigation } from '../shared/representation-selection';
import { semanticSelectionSchema, type SemanticSelection } from '../shared/semantic-selections';
import { validateRepresentationPlan,representationFromWidget } from '../shared/representations';
import { createComposedGuide } from '../lib/representations/composed-guide';
import { createWidgetForSource } from '../lib/widgets/presets';
import { preparedPapers } from '../data/papers';
import { scientificBinding } from '../lib/representations/evidence';
const source=preparedPapers[0].document,block=source.blocks.find(b=>b.kind==='paragraph')!;
function fixture(){const plan=createComposedGuide(source,block.id);const store=createSemanticSelectionStore({revision:representationInputRevision(plan),isValid:value=>isRepresentationSelection(plan,value)});return {plan,store};}
const selected:SemanticSelection={kind:'entity',viewId:'composition',scopeId:'composition',entityId:'second'};
test('one semantic entity selection drives figure, numerical slots and source anchors without recursive feedback',()=>{
 const {plan,store}=fixture();let notifications=0;
 const unsubscribe=store.subscribe(()=>{notifications++;assert.equal(store.select(selected),false);});
 assert.equal(store.select(selected),true);assert.equal(notifications,1);unsubscribe();
 const view=plan.views[0];assert.equal(view.kind,'composed-scene');if(view.kind!=='composed-scene')return;
 const current=store.getSnapshot().selections[0];assert.equal(current.kind,'entity');if(current.kind!=='entity')return;
 const nodes=view.scene.nodes;assert.ok(nodes.some(node=>node.kind==='scene'&&node.marks.some(mark=>mark.kind==='repeat'&&mark.items.some(item=>item.entityId===current.entityId))));
 assert.ok(nodes.some(node=>node.kind==='slot'&&node.values.some(value=>value.entityId===current.entityId)));
 assert.deepEqual(selectionAnchorIds(plan,[current]),['passage']);
 assert.ok(Object.isFrozen(store.getSnapshot()));assert.ok(Object.isFrozen(current));
});
test('seek, reset and undo retain meaningful entity selection while input rebinding prunes unavailable targets',()=>{
 const {plan,store}=fixture();store.select(selected);store.select({kind:'time',viewId:'composition',scopeId:'concepts',frameId:'move',value:0,unit:'walkthrough-step',mode:'authored-step'});
 store.resetFrames('composition','concepts');assert.deepEqual(store.getSnapshot().selections,[selected]);store.undo();assert.equal(store.getSnapshot().selections.length,2);
 const changed=structuredClone(plan);const view=changed.views[0];if(view.kind!=='composed-scene')throw Error();view.scene.entities=view.scene.entities!.filter(e=>e.id!=='second');
 for(const node of view.scene.nodes){if(node.kind==='scene')for(const mark of node.marks){if(mark.kind==='repeat')mark.items.forEach(item=>{if(item.entityId==='second')delete item.entityId;});else if(mark.entityId==='second')delete mark.entityId;}if(node.kind==='slot')node.values.forEach(value=>{if(value.entityId==='second')delete value.entityId;});}
 assert.doesNotThrow(()=>validateRepresentationPlan(changed,source));
 store.rebindInputs(representationInputRevision(changed),value=>isRepresentationSelection(changed,value));assert.ok(!store.getSnapshot().selections.some(s=>s.kind==='entity'));assert.equal(store.undo(),false);
});
test('portable linked selections round-trip without changing scientific identity and reject stale or invented targets',async()=>{
 const {plan,store}=fixture();store.select(selected);const saved=validateRepresentationPlan(JSON.parse(JSON.stringify({...plan,navigation:store.getSnapshot()})),source);
 const restored=createSemanticSelectionStore({revision:representationInputRevision(saved),initial:saved.navigation,isValid:s=>isRepresentationSelection(saved,s)});assert.deepEqual(restored.getSnapshot(),store.getSnapshot());
 assert.equal(await scientificBinding(plan),await scientificBinding(saved));
 const bad=structuredClone(saved);bad.title='New scientific input identity';assert.throws(()=>validateRepresentationPlan(bad,source),/Saved selections/);
 assert.throws(()=>store.select({...selected,entityId:'invented'}),/unavailable/);
 const duplicate=structuredClone(saved);duplicate.navigation!.selections.push(selected);assert.throws(()=>validateRepresentationPlan(duplicate,source),/Duplicate selection channel/);
});
test('time, region, parameter and uncertainty channels are typed and coordinate/source scoped',()=>{
 const {plan,store}=fixture();assert.doesNotThrow(()=>store.select({kind:'region',viewId:'composition',scopeId:'concepts',frame:'authored teaching frame',unit:'illustrative units',min:[0,0],max:[1,1]}));
 assert.throws(()=>store.select({kind:'region',viewId:'composition',scopeId:'concepts',frame:'different frame',unit:'m',min:[0,0],max:[1,1]}),/unavailable/);
 assert.throws(()=>semanticSelectionSchema.parse({kind:'region',viewId:'composition',scopeId:'concepts',frame:'f',unit:'m',min:[2,0],max:[1,1]}));
 assert.throws(()=>store.select({kind:'time',viewId:'composition',scopeId:'concepts',frameId:'move',value:0,unit:'s',mode:'physical-time'}),/unavailable/);
 for(const value of [{kind:'parameter',viewId:'composition',scopeId:'concepts',parameterId:'x'},{kind:'uncertainty',viewId:'composition',scopeId:'quantity',quantityId:'unknown',index:0,mode:'standard'}])assert.ok(!isRepresentationSelection(plan,semanticSelectionSchema.parse(value)));
});
test('legacy widget selection adapts to the shared store, restores view-only state and keeps inputs unchanged',()=>{
 const widget=createWidgetForSource('graph',source),plan=representationFromWidget(widget,source);
 const store=createSemanticSelectionStore({revision:representationInputRevision(plan),initial:initialRepresentationNavigation(plan),isValid:s=>isRepresentationSelection(plan,s)});
 const changed={...widget,view:{...widget.view,selection:'node:b',step:1}};captureWidgetNavigation('figure',changed,store);
 const restored=applyWidgetNavigation('figure',widget,store.getSnapshot());assert.deepEqual(restored.spec,widget.spec);assert.equal(restored.view.selection,'node:b');assert.equal(restored.view.step,1);
 store.undo();assert.deepEqual(store.getSnapshot(),initialRepresentationNavigation(plan));captureWidgetNavigation('figure',changed,store);
 store.clear();const cleared=applyWidgetNavigation('figure',changed,store.getSnapshot());assert.equal(cleared.view.selection,'');assert.equal(cleared.view.step,0);
 assert.equal(representationInputRevision({...plan,views:[{id:'figure',kind:'widget',widget:restored}]}),representationInputRevision(plan));
});

test('declared parameter and uncertainty focus remain view navigation rather than data modification',()=>{
 const widget=createWidgetForSource('equation',source),plan=representationFromWidget(widget,source),spec=widget.spec;if(spec.kind!=='equation')throw Error();
 const store=createSemanticSelectionStore({revision:representationInputRevision(plan),isValid:s=>isRepresentationSelection(plan,s)});
 captureWidgetNavigation('figure',{...widget,view:{...widget.view,selection:`symbol:${spec.variables[0].name}`}},store);
 assert.ok(store.getSnapshot().selections.some(s=>s.kind==='parameter'));
 const {plan:quantities}=fixture();quantities.quantities=[{id:'temperature',symbol:'T',unit:'K',description:'Synthetic uncertainty',measurement:{format:'paperplay-quantity',schemaVersion:1,unitCatalogVersion:'1.0.0',id:'temperature',label:'Synthetic temperature',kind:'scalar',unit:'K',temperatureMode:'absolute',value:300,uncertainty:{kind:'standard',values:[.5]}}}];
 quantities.views.push({id:'quantity',kind:'quantity',quantityId:'temperature',requirement:{kind:'scalar',unit:'K',shape:[]}});quantities.execution.capabilities.push({id:'quantity-inspector',version:'1.0.0'});
 const checked=validateRepresentationPlan(quantities,source),selection:SemanticSelection={kind:'uncertainty',viewId:'quantity',scopeId:'quantity',quantityId:'temperature',index:0,mode:'standard'};
 assert.ok(isRepresentationSelection(checked,selection));assert.ok(!isRepresentationSelection(checked,{...selection,index:1}));assert.ok(!isRepresentationSelection(checked,{...selection,mode:'interval'}));
});

test('selection channel budgets keep the prior snapshot and undo history without hidden eviction',()=>{
 let warning='';const store=createSemanticSelectionStore({revision:'0000000000000000',isValid:()=>true,onLimit:value=>{warning=value;}});
 for(let i=0;i<32;i++)store.select({kind:'entity',viewId:'view',scopeId:`scope${i}`,entityId:'entity'});
 const previous=store.getSnapshot();assert.equal(store.select({kind:'entity',viewId:'view',scopeId:'extra',entityId:'entity'}),false);assert.equal(store.getSnapshot(),previous);assert.ok(warning.includes('32'));
 store.undo();assert.equal(store.getSnapshot().selections.length,31);assert.equal(warning,'');
});
