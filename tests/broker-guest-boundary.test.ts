import test from 'node:test';
import assert from 'node:assert/strict';
import {createDynamicSequenceArtifact} from '../lib/artifacts/fixtures/dynamic-sequence';
import {validateFigureArtifact} from '../shared/figure-artifacts';
import {evaluateGuestFrame} from '../lib/artifacts/guest-engine';
import {sha256} from '../lib/assets/local';

test('a generated manifest cannot request broker permissions or install an external adapter',async()=>{
 const {artifact,source}=await createDynamicSequenceArtifact();
 assert.throws(()=>validateFigureArtifact({...artifact,capabilityRequests:[...artifact.capabilityRequests,'broker-submit']},source));
 assert.throws(()=>validateFigureArtifact({...artifact,broker:{adapter:'deterministic-demo',consent:true}},source));
 assert.throws(()=>validateFigureArtifact({...artifact,permissions:{network:true,broker:true}},source));
});
test('guest code cannot invoke a same-origin broker route through the host fetch',async()=>{
 const {artifact,source}=await createDynamicSequenceArtifact();artifact.resources.maxExecutionMs=1000;
 artifact.entry.source="function update(){return fetch('/api/broker/start',{method:'POST',body:'{}'});}";artifact.entry.sha256=await sha256(artifact.entry.source);validateFigureArtifact(artifact,source);
 const original=globalThis.fetch;let brokerCalls=0;
 globalThis.fetch=async(input,init)=>{if(String(input).includes('/api/broker/')){brokerCalls++;throw Error('Unexpected host broker request.');}return original(input,init);};
 try{await assert.rejects(evaluateGuestFrame(artifact,{},null,{kind:'initialize'}));assert.equal(brokerCalls,0);}finally{globalThis.fetch=original;}
});
