import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createUsageStore} from '../server/usage/service';
import {createSqliteUsageStore,type UsageRequest} from '../server/usage/store';
import {createEnrichmentStore} from '../server/enrichment/store';
import {applicationQuotasEnabled} from '../server/usage/model';
import {createRedisUsageStore,RESERVE_LUA} from '../server/usage/redis';
const request=(id:string):UsageRequest=>({id,sessionId:'one-browser',kind:'analysis',maxOutputTokens:6000,inputCharacters:500,model:'fixture-model',fingerprint:'one-paper'});
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');

test('hackathon SQLite metering passes former hourly/session/daily/token ceilings and keeps durable identities',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'paperplay-hackathon-')),path=join(directory,'usage.sqlite');
 let store=createSqliteUsageStore({path,enforceLimits:false});
 try{
  for(let i=0;i<105;i++)assert.equal((await store.reserve(request(`request-${i}`))).created,true);
  const before=await store.summary();assert.equal(before.quotasEnabled,false);assert.equal(before.requests,105);assert.equal(before.accountedTokens,105*24000);assert.ok(before.accountedTokens>before.limits.dailyTokens);
  store.close?.();store=createSqliteUsageStore({path,enforceLimits:false});
  assert.equal((await store.reserve(request('request-0'))).created,false);
  await assert.rejects(store.reserve({...request('request-0'),sessionId:'other-browser'}),/different input/);
  await store.settle('request-0',{status:'completed',providerId:'resp_fixture',usage:{inputTokens:20,outputTokens:17,totalTokens:37}});
  await store.settle('request-0',{status:'uncertain',usage:{inputTokens:0,outputTokens:0,totalTokens:0}});
  const after=await store.summary();assert.equal(after.requests,105);assert.equal(after.accountedTokens,104*24000+37);assert.equal(after.byStatus.completed,1);
 }finally{store.close?.();rmSync(directory,{recursive:true,force:true});}
});

test('runtime configuration disables application quotas by default and enables them only on explicit opt-in',async()=>{
 assert.equal(applicationQuotasEnabled({}),false);assert.equal(applicationQuotasEnabled({PAPERPLAY_QUOTAS_ENABLED:'false'}),false);assert.equal(applicationQuotasEnabled({PAPERPLAY_QUOTAS_ENABLED:'true'}),true);
 assert.throws(()=>applicationQuotasEnabled({PAPERPLAY_QUOTAS_ENABLED:'invalid'}),/true or false/);
 const directory=mkdtempSync(join(tmpdir(),'paperplay-runtime-metering-'));
 const environment={USAGE_SQLITE_PATH:join(directory,'usage.sqlite'),USAGE_DAILY_REQUESTS:'1',USAGE_DAILY_TOKENS:'1'};
 const hackathon=createUsageStore(environment),optionalQuota=createUsageStore({...environment,PAPERPLAY_QUOTAS_ENABLED:'true'});
 try{await hackathon.reserve(request('first'));await hackathon.reserve(request('second'));assert.equal((await hackathon.summary()).quotasEnabled,false);await assert.rejects(optionalQuota.reserve(request('third')),/allowance/);assert.equal((await optionalQuota.summary()).quotasEnabled,true);assert.equal((await hackathon.summary()).requests,2);}
 finally{hackathon.close?.();optionalQuota.close?.();rmSync(directory,{recursive:true,force:true});}
});

test('per-paper hackathon metering supports all43sections and repair reservations without the old request/token budgets',()=>{
 const store=createEnrichmentStore({path:':memory:',enforceLimits:false}),owner='a'.repeat(48),documentHash='d'.repeat(64),contextHash='c'.repeat(64);
 const plan=(i:number)=>({id:hash(`plan-${i}`),owner,documentHash,contextHash,action:'plan' as const,sectionId:`section-${i}`,reservedTokens:30000});
 try{
  for(let i=0;i<43;i++)assert.equal(store.reserve(plan(i)).created,true);
  assert.equal(store.reserve(plan(0)).created,false);assert.equal(store.budget(owner,documentHash).requests,43);assert.equal(store.budget(owner,documentHash).accountedTokens,1290000);
  const run=store.prepareGenerationRun({runId:randomUUID(),owner,documentHash,contextHash,model:'fixture-model',sectionId:'section-0',maxAttempts:3});
  for(let attempt=1;attempt<=3;attempt++){
   const input={...plan(attempt),id:hash(`custom-${attempt}`),sectionId:'section-0',action:'artifact' as const,reservedTokens:300000};
   assert.equal(store.claimGenerationAttempt(run.runId,owner,attempt,input).created,true);
   store.settle(input.id,{status:'failed',providerId:`resp_fixture${attempt}`,actualTokens:123});
   assert.equal(store.claimGenerationAttempt(run.runId,owner,attempt,input).created,false);
  }
  assert.equal(store.generationRun(run.runId,owner).reservedTokens,900000);assert.equal(store.budget(owner,documentHash).requests,46);
  assert.throws(()=>store.prepareGenerationRun({...run,runId:randomUUID(),maxAttempts:4}),/Invalid generation run/);
 }finally{store.close();}
});

test('Redis forwards the quota-disabled mode into its atomic admission while preserving identity checks',async()=>{
 const commands:unknown[][]=[],record={...request('redis-mode'),status:'reserved',reservedTokens:24000,createdAt:1,updatedAt:1};
 const store=createRedisUsageStore({url:'https://redis.example',token:'fixture-only',enforceLimits:false,now:()=>1,fetch:async(_url,init)=>{const command=JSON.parse(String(init?.body));commands.push(command);return Response.json({result:JSON.stringify({created:true,record})});}});
 assert.equal((await store.reserve(request('redis-mode'))).created,true);assert.equal(commands[0][1],RESERVE_LUA);assert.equal(commands[0].at(-1),'0');
 assert.match(RESERVE_LUA,/if enforce and/);assert.match(RESERVE_LUA,/if old then/);
});
