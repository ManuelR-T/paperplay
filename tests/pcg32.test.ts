import test from 'node:test';
import assert from 'node:assert/strict';
import {createPcg32,parsePcgInteger,openUniform53} from '../lib/stochastic/pcg32';
test('PCG port matches the six upstream minimal-C demo words at seed42 sequence54',()=>{
 const rng=createPcg32('42','54');assert.deepEqual(Array.from({length:6},()=>rng.nextUint32().toString(16).padStart(8,'0')),['a15c02b7','7b47f409','ba1d3330','83d2f293','bfa4784b','cbed606e']);
});
test('full uint64 seed and distinct canonical uint63 selectors replay without unsafe-number coercion',()=>{
 const first=createPcg32('18446744073709551615','9223372036854775807'),second=createPcg32('18446744073709551615','9223372036854775807');assert.deepEqual(Array.from({length:20},()=>first.nextUint32()),Array.from({length:20},()=>second.nextUint32()));
 for(const invalid of ['01','-1','1.0','1e3',' 42','18446744073709551616'])assert.throws(()=>parsePcgInteger(invalid));assert.throws(()=>parsePcgInteger('9223372036854775808','sequence'));
 const a=createPcg32('42','0'),b=createPcg32('42','1');assert.notDeepEqual(Array.from({length:6},()=>a.nextUint32()),Array.from({length:6},()=>b.nextUint32()));
});
test('every generated word, including seeding and rejected-zero pairs, is accounted for',()=>{
 let words=0;const rng=createPcg32('42','54',()=>{words++;});assert.equal(words,2);rng.nextUint32();assert.equal(words,3);
 const supplied=[0,0,0xffffffff,0xffffffff];let cursor=0;const maximum=openUniform53(()=>supplied[cursor++]);assert.equal(cursor,4);assert.equal(maximum,1-2**-53);assert.ok(maximum>0&&maximum<1);const minimum=openUniform53(()=>[0,64][(cursor++)%2]);assert.ok(minimum>0&&minimum<1);
 let attempts=0;assert.throws(()=>openUniform53(()=>{if(++attempts>6)throw Error('budget');return 0;}),/budget/);assert.throws(()=>openUniform53(()=>-1),/uint32/);
});
