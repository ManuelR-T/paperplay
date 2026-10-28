import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {createArtifactGenerationHandlers} from '../server/artifact-generation/handlers';
import {createEnrichmentStore} from '../server/enrichment/store';
import {createSqliteUsageStore} from '../server/usage/store';
import {readMetaConfig} from '../server/meta/config';
import {generationReplySchema,GENERATION_POLICY} from '../shared/artifact-generation';
import {generationProviderRequest,generationPromptMetrics,GENERATION_INSTRUCTIONS,type GenerationProviderInput,type ArtifactGenerationProvider} from '../server/artifact-generation/provider';
import {WHOLE_PAPER_SECTION_ID} from '../lib/enrichment/whole-paper';
import {validateDocument} from '../shared/schema';

const origin='http://localhost:3000';
const request=(body:unknown,cookie?:string)=>new Request(origin+'/api/artifact-generation/start',{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
async function fixture(t:{after(fn:()=>void):void}){
 const authored=await createDynamicSequenceArtifact();
 const blocks=[...authored.source.blocks,...Array.from({length:10},(_,index)=>({id:`full-${index}`,page:1,kind:'paragraph' as const,text:`BEGIN_PASSAGE_${index} `+'complete paper content '.repeat(500)+` END_PASSAGE_${index}`})),{id:'late-equation',page:1,kind:'equation' as const,latex:'E=mc^2'},{id:'late-figure',page:1,kind:'original-figure' as const,caption:'Final source figure caption included in the complete context.',alt:'An original source relationship.'}];
 const source=validateDocument({...authored.source,source:{kind:'arxiv',url:'https://arxiv.org/abs/2504.17033'},blocks});
 const anchor={blockId:'passage',page:1,quote:authored.artifact.anchors[0].quote};
 const plan={objective:'Inspect the chosen sequence relationship.',mechanism:'Preserve item identity during additions.',representation:'conceptual',assumptions:['Synthetic teaching data.'],missingDetails:[],interactions:['Add an item.']};
 let output={plan,title:'Selected sequence',anchor,sourceCode:authored.artifact.entry.source,inputFields:[],stateFields:authored.artifact.interfaces.state.map(field=>({...field,maxItems:field.maxItems??null})),initialInputJson:'{}',checks:['Existing item identities remain stable.']};
 const received:GenerationProviderInput[]=[];let retrieves=0;
 const provider:ArtifactGenerationProvider={start:async input=>{received.push(input);return {id:'resp_whole_paper_fixture',status:'queued'};},retrieve:async id=>{retrieves++;return {id,status:'completed',output_text:JSON.stringify(output),usage:{input_tokens:500,output_tokens:100,total_tokens:600}};},cancel:async id=>({id,status:'cancelled'})};
 const store=createEnrichmentStore({path:':memory:',enforceLimits:false}),usage=createSqliteUsageStore({path:':memory:',enforceLimits:false});t.after(()=>{store.close();usage.close?.();});
 const dependencies={getConfig:()=>readMetaConfig({MODEL_API_KEY:'whole-paper-test-key',META_ANALYSIS_ENABLED:'true'}),store,usage,provider:()=>provider,signingSecret:'whole-paper-test-signing'};
 const handlers=createArtifactGenerationHandlers(dependencies),context={source,sectionId:WHOLE_PAPER_SECTION_ID,scope:'paper' as const,anchor,brief:'Show the identity-preserving sequence selected in the whole-paper editorial plan.'};
 const response=await handlers.prepare(request({...context,runId:randomUUID(),maxAttempts:3}));assert.equal(response.status,200,await response.clone().text());
 const prepared=generationReplySchema.parse(await response.json()),cookie=response.headers.get('set-cookie')!.split(';')[0];
 return {handlers,dependencies,context,prepared,cookie,received,usage,counts:()=>({starts:received.length,retrieves}),changeOutput:(patch:Partial<typeof output>)=>{output={...output,...patch};}};
}

test('SDK generation sends the complete paper beyond the old section limit, with its selected figure anchor and measured full body',async t=>{
 const f=await fixture(t);assert.equal(f.prepared.budget.maxInputCharactersPerAttempt,900000);
 const body={...f.context,run:f.prepared.run,attempt:1};
 const first=await f.handlers.start(request(body,f.cookie));assert.equal(first.status,200,await first.clone().text());assert.equal((await first.json()).status,'queued');assert.equal(f.received.length,1);
 const actual=generationProviderRequest(f.received[0],'fixture-model'),coverage=JSON.parse(actual.input).sourceCoverage;
 assert.equal(coverage.sourceLink,f.context.source.source.url);assert.deepEqual(coverage.blocks,f.context.source.blocks.map(block=>({...block,blockId:block.id})));
 for(let index=0;index<10;index++){assert.match(actual.input,new RegExp(`BEGIN_PASSAGE_${index}`));assert.match(actual.input,new RegExp(`END_PASSAGE_${index}`));}
 assert.match(actual.input,/Final source figure caption/);assert.match(actual.input,/E=mc/);
 const schema=actual.text.format.schema as any;assert.deepEqual(schema.properties.anchor.properties.blockId.enum,['passage']);assert.deepEqual(schema.properties.anchor.properties.quote.enum,[f.context.anchor.quote]);
 const measured=generationPromptMetrics(f.received[0],'fixture-model');assert.ok(measured.characters>100000);assert.equal(measured.characters,JSON.stringify(actual).length);assert.ok(measured.characters>GENERATION_POLICY.maxInputCharacters);
 const recreated=createArtifactGenerationHandlers(f.dependencies),done=await recreated.status(request(body,f.cookie));assert.equal(done.status,200);const result=generationReplySchema.parse(await done.json());assert.equal(result.status,'complete');assert.equal(result.candidate?.artifact.anchors[0].blockId,'passage');assert.deepEqual(f.counts(),{starts:1,retrieves:1});
 assert.equal((await f.usage.summary()).requests,1);
});

test('whole-paper generation freezes the chosen anchor and cannot move it to another valid paper block',async t=>{
 const f=await fixture(t),body={...f.context,run:f.prepared.run,attempt:1};await f.handlers.start(request(body,f.cookie));
 const block=f.context.source.blocks.find(block=>block.id==='full-9')!;const quote=block.kind==='paragraph'?block.text.slice(0,50):'';
 const changed=await f.handlers.status(request({...body,anchor:{blockId:block.id,page:1,quote}},f.cookie));assert.equal(changed.status,409);assert.equal(f.counts().retrieves,0);
 f.changeOutput({anchor:{blockId:block.id,page:1,quote}});const invalid=generationReplySchema.parse(await(await f.handlers.status(request(body,f.cookie))).json());assert.equal(invalid.status,'failed');assert.equal(invalid.candidate,undefined);assert.equal(f.counts().starts,1);
});

test('paper scope needs a valid selected anchor, while legacy provider instructions and shape remain unchanged',async t=>{
 const f=await fixture(t),{anchor:_,...withoutAnchor}=f.context;
 const missing=await f.handlers.prepare(request({...withoutAnchor,runId:randomUUID(),maxAttempts:3},f.cookie));assert.equal(missing.status,400);assert.match((await missing.json()).error,/selected figure anchor/);assert.equal(f.received.length,0);
 const legacy=generationProviderRequest({context:JSON.stringify({selectedPassages:[{blockId:'passage',page:1,text:f.context.anchor.quote}]}),brief:'Existing accepted section scope',attempt:1});
 assert.equal(legacy.instructions,GENERATION_INSTRUCTIONS);assert.equal('selectedFigure'in JSON.parse(legacy.input),false);
});

test('oversized complete-paper generation fails explicitly before submission and never falls back to section excerpts',async t=>{
 const f=await fixture(t),paragraph=f.context.source.blocks.find(block=>block.kind==='paragraph'&&block.id==='full-0')!;
 const source=validateDocument({...f.context.source,blocks:[...f.context.source.blocks,...Array.from({length:90},(_,index)=>({...paragraph,id:`large-${index}`}))]});
 const response=await f.handlers.prepare(request({...f.context,source,runId:randomUUID(),maxAttempts:3},f.cookie));
 assert.equal(response.status,413);assert.match((await response.json()).error,/complete paper.*No source text was removed/i);assert.equal(f.received.length,0);assert.equal((await f.usage.summary()).requests,0);
});
