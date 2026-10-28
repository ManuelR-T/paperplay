import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createArtifactGenerationHandlers} from '../server/artifact-generation/handlers';
import {createEnrichmentStore} from '../server/enrichment/store';
import {createSqliteUsageStore} from '../server/usage/store';
import {readMetaConfig} from '../server/meta/config';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {buildSourceSections} from '../lib/enrichment/sections';
import type {ArtifactGenerationProvider} from '../server/artifact-generation/provider';
const origin='http://localhost:3000';
function req(body:unknown,cookie?:string){return new Request(origin+'/api/artifact-generation/start',{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});}
test('generated operator off blocks new paid creation while accepted start/status/cancel recover unchanged identity',async t=>{
 const prior=process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED; t.after(()=>{if(prior===undefined)delete process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED;else process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED=prior;});
 const {source}=await createDynamicSequenceArtifact(),store=createEnrichmentStore({path:':memory:'}),usage=createSqliteUsageStore({path:':memory:'});t.after(()=>{store.close();usage.close?.();});
 let enabled=true,starts=0,retrieves=0,cancels=0;const provider:ArtifactGenerationProvider={async start(){starts++;return{id:'resp_adoption_accepted',status:'queued'};},async retrieve(id){retrieves++;return{id,status:'queued'};},async cancel(id){cancels++;return{id,status:'cancelled'};}};
 const dependencies={getConfig:()=>readMetaConfig({MODEL_API_KEY:'fake-adoption-key',META_ANALYSIS_ENABLED:enabled?'true':'false'}),store,usage,provider:()=>provider,signingSecret:'adoption-test-signing'};
 const handler=createArtifactGenerationHandlers(dependencies),context={source,runId:randomUUID(),sectionId:buildSourceSections(source)[0].id,brief:'Inspect this bounded authored sequence.',maxAttempts:1};
 const prepared=await handler.prepare(req(context));assert.equal(prepared.status,200);const body=await prepared.json(),cookie=prepared.headers.get('set-cookie')!.split(';')[0],start={source,sectionId:context.sectionId,brief:context.brief,run:body.run,attempt:1};
 process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED='false';assert.equal((await handler.start(req(start,cookie))).status,503);assert.equal(starts,0);process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED='true';assert.equal((await handler.start(req(start,cookie))).status,200);assert.equal(starts,1);
 process.env.PAPERPLAY_GENERATED_EXECUTION_ENABLED='false';enabled=false;const recreated=createArtifactGenerationHandlers(dependencies);
 const recovered=await recreated.start(req(start,cookie));assert.equal(recovered.status,200);assert.equal(starts,1);assert.ok(retrieves>=1);assert.equal(cancels,0);
 assert.equal((await recreated.status(req(start,cookie))).status,200);assert.equal(starts,1);assert.equal(cancels,0);
 assert.equal((await recreated.cancel(req({run:body.run},cookie))).status,200);assert.equal(cancels,1);assert.equal(starts,1);
});
