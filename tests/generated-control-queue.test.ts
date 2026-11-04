import test from 'node:test';import assert from 'node:assert/strict';import{createLatestControlQueue}from'../lib/artifacts/control-queue';
test('dragging several SDK controls retains the latest value for each without reordering independent controls',()=>{
 const queue=createLatestControlQueue();queue.push({kind:'control',id:'shift',value:1});queue.push({kind:'control',id:'count',value:60});queue.push({kind:'control',id:'shift',value:3});
 assert.deepEqual(queue.take(),{kind:'control',id:'shift',value:3});assert.deepEqual(queue.take(),{kind:'control',id:'count',value:60});assert.equal(queue.take(),undefined);
});
test('stop discards pending slider events and buttons are never coalesced into slider values',()=>{
 const queue=createLatestControlQueue();queue.push({kind:'control',id:'resample'});assert.equal(queue.take(),undefined);queue.push({kind:'control',id:'shift',value:2});queue.clear();assert.equal(queue.take(),undefined);
});
