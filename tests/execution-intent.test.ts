import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFixture,arrayFigureFixture} from '../shared/fixtures';
import {getExecutionScheduler} from '../lib/execution/scheduler';
import {runScientificValidation,hasScientificValidationRun} from '../lib/validation/model';

test('Stop all during source hashing prevents a later scientific worker or passing receipt even with no admitted job',async()=>{
 const scheduler=getExecutionScheduler(),workerDescriptor=Object.getOwnPropertyDescriptor(globalThis,'Worker'),windowDescriptor=Object.getOwnPropertyDescriptor(globalThis,'window'),digest=crypto.subtle.digest.bind(crypto.subtle);let created=0,release!:()=>void,entered!:()=>void,first=true;
 const gate=new Promise<void>(resolve=>{release=resolve;}),seen=new Promise<void>(resolve=>{entered=resolve;});
 class ForbiddenWorker{constructor(){created++;throw Error('No worker may start after this intent was stopped.');}}
 Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:ForbiddenWorker});Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{}});
 crypto.subtle.digest=(async(...args:Parameters<SubtleCrypto['digest']>)=>{if(first){first=false;entered();await gate;}return digest(...args);}) as SubtleCrypto['digest'];
 try{const figure=structuredClone(arrayFigureFixture);if(figure.kind!=='array')throw Error('Fixture changed.');const pending=runScientificValidation({kind:'legacy-engine',source:structuredClone(sourceFixture),figure:{...figure,controls:[],execution:{mode:'computed',binding:{engineId:'powersort',engineVersion:'1.0.0',parameters:{operationLimit:10000}}}},seed:42});await seen;assert.equal(scheduler.getSnapshot().active,0);scheduler.cancelAll();release();const result=await pending;assert.equal(result.report.status,'cancelled');assert.equal(hasScientificValidationRun(result),false);assert.equal(created,0);}
 finally{release();crypto.subtle.digest=digest;if(workerDescriptor)Object.defineProperty(globalThis,'Worker',workerDescriptor);else Reflect.deleteProperty(globalThis,'Worker');if(windowDescriptor)Object.defineProperty(globalThis,'window',windowDescriptor);else Reflect.deleteProperty(globalThis,'window');}
});
