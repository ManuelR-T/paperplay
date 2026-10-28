import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument} from '../shared/schema';
import {compileEnrichmentPlan,enrichmentPlanSchema,enrichmentResultSchema,type EnrichmentCustomFigure} from '../lib/enrichment/contracts';
import {buildSourceSections} from '../lib/enrichment/sections';
import {getWidgetDescriptor,WIDGET_CATALOG_VERSION} from '../lib/widgets/catalog';
import {createWidgetPreset} from '../lib/widgets/presets';
import {enrichmentJsonSchema,ENRICHMENT_INSTRUCTIONS,providerInput} from '../server/enrichment/provider';

const source=validateDocument({schemaVersion:1,id:'meta-planner-decisions',sourceVersion:'authored-v1',title:'An unfamiliar mechanism',authors:['Fixture authors'],source:{kind:'prepared'},pageCount:1,blocks:[
 {id:'opening',kind:'heading',page:1,level:2,text:'Mechanism'},
 {id:'mechanism',kind:'paragraph',page:1,text:'A set of cells exchanges synthetic teaching signals along explicitly supplied links.'},
 {id:'later',kind:'heading',page:1,level:2,text:'Separate result'},
 {id:'result',kind:'paragraph',page:1,text:'The separate result remains outside the first selected passage and its explanation.'},
],anchors:[],extractionWarnings:['Project-authored decision fixture, not a scientific evaluation.']});
const section=buildSourceSections(source)[0],quote=source.blocks[1].kind==='paragraph'?source.blocks[1].text:'';
const custom=(patch:Partial<EnrichmentCustomFigure>={}):EnrichmentCustomFigure=>({id:'flow',title:'Inspect a signal flow',concept:'Signal propagation',objective:'Observe a bounded synthetic signal as it moves between named cells.',blockId:'mechanism',page:1,quote,brief:'Create an isolated interactive two-cell teaching scene with a signal slider and a play step; explicitly label synthetic values and assumptions.',...patch});
const plan=(customFigures:EnrichmentCustomFigure[]=[])=>({summary:'Meta chooses an explanation for this selected passage.',proposals:[],customFigures,warnings:[],repetitionReason:''});
function compile(value:unknown){return compileEnrichmentPlan(value,{source,section,action:'plan',model:'meta-fixture',catalogVersion:WIDGET_CATALOG_VERSION,allowedInteractions:kind=>getWidgetDescriptor(kind).controls});}

test('Meta can explicitly request a new SDK figure with its own grounded placement and generation brief',()=>{
 const before=JSON.stringify(source),request=custom(),result=compile(plan([request]));
 assert.deepEqual(result.customFigures,[request]);assert.equal(result.proposals.length,0);assert.equal(result.rejected.length,0);
 assert.equal(JSON.stringify(source),before);assert.deepEqual(enrichmentResultSchema.parse(result).customFigures,[request]);
});

test('a planner decision of no custom figure remains empty and legacy cached plans/results default to no requests',()=>{
 const current=compile(plan());assert.deepEqual(current.customFigures,[]);
 const legacyPlan={summary:'Earlier cached plan',proposals:[],warnings:[],repetitionReason:''};
 assert.deepEqual(enrichmentPlanSchema.parse(legacyPlan).customFigures,[]);
 const {customFigures:_,...legacyResult}=current;assert.deepEqual(enrichmentResultSchema.parse(legacyResult).customFigures,[]);
 assert.equal((enrichmentJsonSchema.required as string[]).includes('customFigures'),true);
 assert.equal(((enrichmentJsonSchema.properties as Record<string,Record<string,unknown>>).customFigures).default,undefined);
 assert.match(ENRICHMENT_INSTRUCTIONS,/An empty customFigures array is a valid deliberate choice/);
});

test('invented source locators, false quotes and neighboring-section requests are rejected without replacing a valid request',()=>{
 const result=compile(plan([custom(),custom({id:'wrongId',blockId:'invented'}),custom({id:'wrongQuote',quote:'This statement does not appear in the source.'}),custom({id:'outside',blockId:'result',quote:source.blocks[3].kind==='paragraph'?source.blocks[3].text:''})]));
 assert.equal(result.customFigures?.length,1);assert.equal(result.customFigures?.[0].id,'flow');assert.equal(result.rejected.length,3);
 assert.ok(result.rejected.some(rejected=>rejected.reason.includes('selected section')));
});

test('the application validates a Meta-chosen catalog view without a source-keyword applicability veto',()=>{
 const value=plan();const spec=createWidgetPreset('graph');spec.mapping='A synthetic path through the supplied teaching links illustrates the source relationship, not a claim that the paper ran this algorithm.';
 const proposal={id:'selectedGraph',title:'Meta-selected relationship explorer',concept:'Named relationships',blockId:'mechanism',page:1,quote,reason:'The explicit links are useful to inspect.',objective:'Explore one small teaching configuration.',neededData:['Authored synthetic links'],provenance:'illustrative',interactions:[getWidgetDescriptor('graph').controls[0]],specJson:JSON.stringify(spec),limitations:['The values are synthetic teaching additions.']};
 const result=compile({...value,proposals:[proposal]});
 assert.equal(/Dijkstra|shortest path|priority queue/i.test(quote),false);
 assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].envelope.authorship.kind,'meta');assert.equal(result.rejected.length,0);
});

test('targeted widget edits do not authorize unrelated custom creation and planner tool metadata stays data-only',()=>{
 const result=compileEnrichmentPlan(plan([custom()]),{source,section,action:'edit',model:'meta-fixture',catalogVersion:WIDGET_CATALOG_VERSION,allowedInteractions:kind=>getWidgetDescriptor(kind).controls});
 assert.deepEqual(result.customFigures,[]);assert.equal(result.rejected.length,1);
 const text=providerInput({action:'plan',context:JSON.stringify({selectedPassages:section.segments}),feedback:'Choose figures for these passages.'});
 assert.equal(text.includes('generationRuntimePrivileges'),false);assert.equal(text.includes('selectedPassages'),true);
});
