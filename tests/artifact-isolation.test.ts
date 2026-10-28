import test from 'node:test';
import assert from 'node:assert/strict';
import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant,newVariant } from 'quickjs-emscripten-core';
import { GUEST_WASM_MAX_BYTES,evaluateGuestFrame } from '../lib/artifacts/guest-engine';
import { createDynamicSequenceArtifact } from '../lib/artifacts/fixtures/dynamic-sequence';
import { isolationCases } from '../scripts/isolation/cases';
test('the selected published interpreter accepts the supplied linear memory and enforces its 64 MiB maximum',async()=>{
 const memory=new WebAssembly.Memory({initial:256,maximum:GUEST_WASM_MAX_BYTES/65536}),module=await newQuickJSWASMModuleFromVariant(newVariant(variant,{wasmMemory:memory}));
 assert.equal(module.getWasmMemory(),memory);assert.equal(memory.buffer.byteLength,16*1024*1024);assert.throws(()=>memory.grow(GUEST_WASM_MAX_BYTES/65536),RangeError);
 const runtime=module.newRuntime(),context=runtime.newContext();try{const value=context.evalCode('1+2');if(value.error)throw Error();assert.equal(context.dump(value.value),3);value.value.dispose();}finally{context.dispose();runtime.dispose();}
});
test('guest authority, constructor access and numerical commands are independent of host globals',async()=>{
 const {artifact}=await createDynamicSequenceArtifact();for(const id of ['ambient-authority','constructor-escape','numerical-workload']){const probe=isolationCases.find(item=>item.id===id)!,copy=structuredClone(artifact);copy.entry.source=probe.source;copy.resources.maxExecutionMs=1000;const frame=await evaluateGuestFrame(copy,{},null,{kind:'initialize'});assert.deepEqual(frame.table.rows,[[id==='ambient-authority'?'No ambient authority':id==='constructor-escape'?'undefinedundefinedundefined':332833500]]);}
});
test('untrusted getters, serialization, typed allocation and external import fail inside the restricted engine',async()=>{
 const {artifact}=await createDynamicSequenceArtifact();for(const id of ['serialization-getter','serialization-tojson','typed-array','module-import','message-flood','promise-storm']){const copy=structuredClone(artifact);copy.entry.source=isolationCases.find(item=>item.id===id)!.source;copy.resources.maxExecutionMs=20;await assert.rejects(()=>evaluateGuestFrame(copy,{},null,{kind:'initialize'}),/failed/);}
});
