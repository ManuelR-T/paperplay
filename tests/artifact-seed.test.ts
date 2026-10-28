import test from 'node:test';
import assert from 'node:assert/strict';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { deriveFigureSeed } from '../lib/artifacts/random-seed';
import { figureSeedSchema,FIGURE_RUNTIME_VERSION } from '../shared/figure-runtime';
async function fixture(){const {artifact}=await createDynamicSequenceArtifact();artifact.resources.maxExecutionMs=1000;artifact.entry.source=`function update(input,state,event){return sdk.frame({title:'Seeded engineering fixture',description:'No scientific RNG claim',coordinateSpace:{width:100,height:80},table:{caption:'Seeded sample',columns:['Value'],rows:[[Math.random()],[Math.random()],[Math.random()]]},state:{items:[],nextId:1}});}`;return artifact;}
test('guest randomness is replayable from exact payload and seed with distinct input/state/event streams',async()=>{
 const artifact=await fixture(),event={kind:'initialize' as const};const one=await evaluateGuestFrame(artifact,{a:1,b:2},null,event,{seed:42}),two=await evaluateGuestFrame(artifact,{a:1,b:2},null,event,{seed:42});assert.deepEqual(two,one);assert.equal(FIGURE_RUNTIME_VERSION,'quickjs-seeded-sdk@1.1.0');
 assert.notDeepEqual((await evaluateGuestFrame(artifact,{a:1,b:2},null,event,{seed:43})).table.rows,one.table.rows);
 assert.notDeepEqual((await evaluateGuestFrame(artifact,{b:2,a:1},null,event,{seed:42})).table.rows,one.table.rows);
 assert.notDeepEqual((await evaluateGuestFrame(artifact,{a:1,b:2},{items:[],nextId:2},event,{seed:42})).table.rows,one.table.rows);
 assert.notDeepEqual((await evaluateGuestFrame(artifact,{a:1,b:2},null,{kind:'control',id:'next'},{seed:42})).table.rows,one.table.rows);
 assert.ok(one.table.rows.every(row=>typeof row[0]==='number'&&row[0]>=0&&row[0]<1));
});
test('seed validation is uint32, finite and versioned; default42 remains explicit',async()=>{
 for(const seed of [-1,1.5,Infinity,NaN,2**32]){assert.equal(figureSeedSchema.safeParse(seed).success,false);assert.throws(()=>deriveFigureSeed(seed,'fixture'));}
 const artifact=await fixture();assert.deepEqual(await evaluateGuestFrame(artifact,{},null,{kind:'initialize'}),await evaluateGuestFrame(artifact,{},null,{kind:'initialize'},{seed:42}));
 assert.equal(deriveFigureSeed(0xffffffff,'ordered JSON'),deriveFigureSeed(0xffffffff,'ordered JSON'));assert.notEqual(deriveFigureSeed(42,'{"a":1,"b":2}'),deriveFigureSeed(42,'{"b":2,"a":1}'));
});
