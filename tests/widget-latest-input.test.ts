import test from 'node:test';import assert from 'node:assert/strict';
import {createLatestInputRunner} from '../lib/widgets/latest-input';
test('rapid inputs keep calculations running, display intermediate results, and skip queued obsolete values',async()=>{
 const requests:{value:number;resolve:(n:number)=>void;signal:AbortSignal}[]=[],shown:number[]=[];
 const runner=createLatestInputRunner<number,number>((value,signal)=>new Promise(resolve=>requests.push({value,resolve,signal})),(_,result)=>shown.push(result),()=>assert.fail('Unexpected failure'));
 runner.submit(1);runner.submit(2);runner.submit(3);
 assert.equal(requests.length,1);assert.equal(requests[0].signal.aborted,false);
 requests[0].resolve(1);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(shown,[1]);assert.equal(requests[1].value,3);
 requests[1].resolve(3);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(shown,[1,3]);runner.dispose();
});
test('disposing aborts active work and prevents stale results or pending execution',async()=>{
 let complete!:(n:number)=>void,signal!:AbortSignal,started=0;
 const runner=createLatestInputRunner<number,number>((_,s)=>{started++;signal=s;return new Promise(resolve=>complete=resolve);},()=>assert.fail('Stale result'),()=>assert.fail('Stale error'));
 runner.submit(1);runner.submit(2);runner.dispose();assert.equal(signal.aborted,true);complete(1);await new Promise(resolve=>setImmediate(resolve));assert.equal(started,1);
});
