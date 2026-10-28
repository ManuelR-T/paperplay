import variant from '@jitl/quickjs-singlefile-browser-release-sync';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import type { GeneratedArtifact } from '../../shared/figure-artifacts';
import { sdkEventSchema,validateSdkFrame,type SdkEvent } from '../../shared/figure-sdk';
import { FIGURE_SDK_SOURCE } from './sdk-source';
/** Restricted-interpreter reference adapter. Product execution stays disabled until worker/isolation gates pass. */
export async function evaluateGuestFrame(artifact:GeneratedArtifact,input:unknown,state:unknown,event:SdkEvent){
 const checkedEvent=sdkEventSchema.parse(event),payload=JSON.stringify({input,state,event:checkedEvent});
 if(new TextEncoder().encode(payload).length>artifact.resources.maxInputBytes+artifact.resources.maxStateBytes+1024)throw Error('Guest input exceeds its byte budget.');
 const quickjs=await newQuickJSWASMModuleFromVariant(variant),runtime=quickjs.newRuntime();runtime.setMemoryLimit(artifact.resources.maxMemoryBytes);runtime.setMaxStackSize(artifact.resources.maxStackBytes);const deadline=Date.now()+artifact.resources.maxExecutionMs;runtime.setInterruptHandler(()=>Date.now()>deadline);
 const context=runtime.newContext();
 try{
   // No host functions, module loader, IO, DOM or timers are exposed to guest code.
   // The harness serializes inside QuickJS so getters/toJSON/infinite output are inside its interrupt/heap limits.
   const code=`(function(){'use strict';const parse=JSON.parse,stringify=JSON.stringify;${FIGURE_SDK_SOURCE}\nconst invoke=(function(){${artifact.entry.source}\nreturn typeof update==='function'?update:null;})();if(!invoke)throw Error('Missing update entry');const payload=parse(${JSON.stringify(payload)});const frame=invoke(payload.input,payload.state,payload.event);const result=stringify(frame);if(typeof result!=='string'||result.length>${artifact.resources.maxOutputBytes})throw Error('Output exceeds guest budget');return result;})()`;
   const result=context.evalCode(code,'figure.js');if(result.error){result.error.dispose();throw Error('Guest execution failed or exceeded its resource policy.');}
   try{const json=context.getString(result.value);return validateSdkFrame(JSON.parse(json),artifact.resources,artifact.anchors.map(a=>a.id),artifact.capabilityRequests);}finally{result.value.dispose();}
 }finally{context.dispose();runtime.dispose();}
}
